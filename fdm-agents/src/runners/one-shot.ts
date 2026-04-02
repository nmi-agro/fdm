import type { BaseAgent } from "@google/adk"
import { InMemoryRunner, isFinalResponse, stringifyContent } from "@google/adk"

export interface OneShotAgentResult {
    result: string
    usage: {
        inputTokens: number
        outputTokens: number
        totalTokens: number
    } | null
    toolCalls?: string[]
}

export class AgentTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`Agent timed out after ${timeoutMs / 1000}s`)
        this.name = "AgentTimeoutError"
    }
}

/**
 * Common runner for one-shot agent execution in fdm-agents.
 * @param agent The agent instance to run.
 * @param input The user input string.
 * @param context Extra context to provide to the agent (e.g. fdm, principalId).
 * @param posthog Optional PostHog client and distinctId for tracking.
 * @param timeoutMs Maximum milliseconds to wait for the agent to complete (default: 20 minutes). Throws AgentTimeoutError on expiry.
 * @returns The final response and token usage from the agent.
 */
export async function runOneShotAgent(
    agent: BaseAgent,
    input: string,
    context: Record<string, any> = {},
    posthog?: { client: any; distinctId: string },
    timeoutMs = 20 * 60 * 1000,
): Promise<OneShotAgentResult> {
    const runner = new InMemoryRunner({ agent, appName: "fdm-agents" })

    const stream = runner.runEphemeral({
        userId: "system",
        newMessage: {
            role: "user",
            parts: [{ text: input }],
        },
        stateDelta: context,
    })

    let finalResponse = ""
    let inputTokens = 0
    let outputTokens = 0
    let totalTokens = 0
    const toolCalls: string[] = []

    function extractToolCalls(obj: any, visited = new Set<any>()) {
        if (!obj || typeof obj !== "object" || visited.has(obj)) return
        visited.add(obj)

        if (Array.isArray(obj)) {
            for (const item of obj) extractToolCalls(item, visited)
            return
        }

        // 1. Check for standard ADK/Gemini function call structure
        const calls = obj.modelTurn?.parts?.filter((p: any) => !!p.functionCall)
        if (calls && Array.isArray(calls)) {
            for (const p of calls) {
                if (p.functionCall?.name) {
                    toolCalls.push(p.functionCall.name)
                }
            }
        }

        // 2. Fallback for other potential structures or raw tool calls
        const rawName = obj.functionCall?.name || obj.toolCall?.name
        if (typeof rawName === "string") {
            const cleanName = rawName.replace(/[[\]"]/g, "").trim()
            if (cleanName) {
                toolCalls.push(cleanName)
            }
        }

        for (const key of Object.keys(obj)) {
            extractToolCalls(obj[key], visited)
        }
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    const closeStream = async () => {
        const iterator = stream as AsyncIterator<unknown> & {
            return?: () => Promise<unknown>
        }
        if (typeof iterator.return === "function") {
            try {
                await iterator.return()
            } catch {
                // best effort
            }
        }
    }
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            void closeStream()
            reject(new AgentTimeoutError(timeoutMs))
        }, timeoutMs)
    })

    const streamPromise = (async () => {
        for await (const event of stream) {
            // Surface model errors immediately instead of silently returning empty string.
            // When Gemini returns a non-200 (e.g. 400), the LlmAgent emits an event
            // with errorCode/errorMessage but no content.
            if (event.errorCode) {
                throw new Error(
                    `Gemini API error [${event.errorCode}]: ${event.errorMessage ?? "unknown error"}`,
                )
            }

            // Accumulate usage metadata across all events.
            const usage = event.usageMetadata
            if (usage) {
                inputTokens += usage.promptTokenCount ?? 0
                outputTokens += usage.candidatesTokenCount ?? 0
                totalTokens += usage.totalTokenCount ?? 0
            }

            extractToolCalls(event)

            // Only capture the final text response, not intermediate reasoning or tool calls.
            if (isFinalResponse(event)) {
                const text = stringifyContent(event)
                if (text) {
                    finalResponse = text
                }
            }
        }
    })()

    try {
        await Promise.race([streamPromise, timeoutPromise])
    } finally {
        clearTimeout(timeoutHandle)
    }

    const uniqueToolCalls = [...new Set(toolCalls)]

    // PostHog LLM Tracking
    if (posthog?.client) {
        try {
            posthog.client.capture({
                distinctId: posthog.distinctId,
                event: "$ai_generation",
                properties: {
                    agent_name: agent.name,
                    b_id_farm: context.b_id_farm,
                    principal_id: context.principalId,
                    strategies: context.strategies,
                    additional_context: context.additionalContext,
                    $ai_tools_called: uniqueToolCalls,
                    $ai_tool_call_count: uniqueToolCalls.length,
                },
            })
        } catch (e) {
            console.error("Failed to log to PostHog:", e)
        }
    }

    return {
        result: finalResponse,
        usage:
            totalTokens > 0 ? { inputTokens, outputTokens, totalTokens } : null,
        toolCalls: uniqueToolCalls,
    }
}
