import { isAIMessage } from "@langchain/core/messages"
import type { LangChainCallbackHandler } from "@posthog/ai/langchain"

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

// Structural type for any LangGraph compiled agent graph
interface StreamableAgentGraph {
    stream(input: unknown, options?: unknown): Promise<AsyncIterable<unknown>>
}

function buildCallbacks(
    posthog?: { client: any; distinctId: string },
    context?: Record<string, any>,
): LangChainCallbackHandler[] | undefined {
    if (!posthog?.client) return undefined
    try {
        // Dynamic import to avoid hard dep when posthog not configured
        const { LangChainCallbackHandler } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("@posthog/ai/langchain") as {
                LangChainCallbackHandler: new (opts: any) => LangChainCallbackHandler
            }
        return [
            new LangChainCallbackHandler({
                client: posthog.client,
                distinctId: posthog.distinctId,
                properties: {
                    b_id_farm: context?.b_id_farm,
                },
            }),
        ]
    } catch {
        return undefined
    }
}

/**
 * Common runner for one-shot agent execution in fdm-agents.
 * @param agent The compiled LangGraph agent to run.
 * @param input The user input string.
 * @param context Extra context to provide via config.configurable (e.g. principalId, nmiApiKey).
 * @param posthog Optional PostHog client and distinctId for tracking.
 * @param timeoutMs Maximum milliseconds to wait for the agent to complete (default: 20 minutes). Throws AgentTimeoutError on expiry.
 * @returns The final response and token usage from the agent.
 */
export async function runOneShotAgent(
    agent: StreamableAgentGraph,
    input: string,
    context: Record<string, any> = {},
    posthog?: { client: any; distinctId: string },
    timeoutMs = 20 * 60 * 1000,
): Promise<OneShotAgentResult> {
    const abortController = new AbortController()
    const callbacks = buildCallbacks(posthog, context)

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            abortController.abort()
            reject(new AgentTimeoutError(timeoutMs))
        }, timeoutMs)
    })

    const streamPromise = (async (): Promise<OneShotAgentResult> => {
        let finalResponse = ""
        let inputTokens = 0
        let outputTokens = 0
        const toolCalls: string[] = []

        const stream = (await agent.stream(
            { messages: [{ role: "user", content: input }] },
            {
                configurable: context,
                streamMode: ["updates", "custom"],
                signal: abortController.signal,
                ...(callbacks ? { callbacks } : {}),
            },
        )) as AsyncIterable<unknown>

        for await (const rawChunk of stream) {
            const chunk = rawChunk as [string, Record<string, any>] | Record<string, any>
            // streamMode array yields [mode, data] tuples
            const [mode, data] = Array.isArray(chunk)
                ? (chunk as [string, Record<string, any>])
                : (["updates", chunk] as [string, Record<string, any>])

            if (mode === "updates") {
                const node = Object.keys(data ?? {})[0]
                const nodeData = node ? data[node] : data

                if (node === "agent" && Array.isArray(nodeData?.messages)) {
                    const lastMsg = nodeData.messages.at(-1)
                    if (isAIMessage(lastMsg)) {
                        if (lastMsg.usage_metadata) {
                            inputTokens += lastMsg.usage_metadata.input_tokens ?? 0
                            outputTokens += lastMsg.usage_metadata.output_tokens ?? 0
                        }
                        if (lastMsg.tool_calls?.length) {
                            for (const tc of lastMsg.tool_calls) {
                                if (tc.name) toolCalls.push(tc.name)
                            }
                        } else {
                            // No pending tool calls — this is the final response
                            const content = lastMsg.content
                            finalResponse =
                                typeof content === "string"
                                    ? content
                                    : JSON.stringify(content)
                        }
                    }
                }

                if (node === "tools" && Array.isArray(nodeData?.messages)) {
                    for (const msg of nodeData.messages) {
                        if (msg?.name && !toolCalls.includes(msg.name)) {
                            toolCalls.push(msg.name)
                        }
                    }
                }
            }
            // "custom" mode: progress events from config.writer — consumed by callers
            // who use the raw stream; ignored here since runOneShotAgent is one-shot.
        }

        const uniqueToolCalls = [...new Set(toolCalls)]
        const totalTokens = inputTokens + outputTokens

        return {
            result: finalResponse,
            usage: totalTokens > 0 ? { inputTokens, outputTokens, totalTokens } : null,
            toolCalls: uniqueToolCalls,
        }
    })()

    try {
        return await Promise.race([streamPromise, timeoutPromise])
    } finally {
        clearTimeout(timeoutHandle)
    }
}
