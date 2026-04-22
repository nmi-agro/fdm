import type { BaseAgent } from "@google/adk"
import { FeatureName, InMemoryRunner, getFunctionCalls, isFinalResponse, overrideFeatureEnabled, stringifyContent } from "@google/adk"

overrideFeatureEnabled(FeatureName.PROGRESSIVE_SSE_STREAMING, true)

/** A single thinking step emitted during streaming (tool call observed). */
export interface ThinkingStep {
    tool: string
    description: string
    /** 1-based iteration count for repeated calls to the same tool. */
    iteration: number
}

export type AgentStreamEvent =
    | { type: "thinking_step"; step: ThinkingStep }
    | { type: "text_chunk"; text: string }
    | { type: "final_response"; text: string; toolCalls: string[]; usage: StreamUsage | null }
    | { type: "error"; message: string }

export interface StreamUsage {
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

/** Maps ADK tool names to human-readable Dutch descriptions. */
const TOOL_DESCRIPTIONS: Record<string, string> = {
    getFarmFields: "Percelen en gewassen ophalen",
    getFarmNutrientAdvice: "Bemestingsadvies berekenen",
    getFarmLegalNorms: "Wettelijke gebruiksruimte ophalen",
    searchFertilizers: "Beschikbare meststoffen bestuderen",
    getFertilizerDetails: "Beschikbare meststoffen bestuderen",
    getCropFertilizerGuide: "Gewasspecifieke bemestingstips ophalen",
    simulateFarmPlan: "Bemestingsplan voorstellen en controleren",
    // SkillToolset tools
    list_skills: "Beschikbare tips ophalen",
    load_skill: "Gewasspecifieke tips laden",
    load_skill_resource: "Bemestingstips laden",
    run_skill_script: "Aangepaste berekeningen uitvoeren",
    run_skill_inline_script: "Aangepaste berekeningen uitvoeren",
}

function toolDescription(name: string): string {
    return TOOL_DESCRIPTIONS[name] ?? name
}

/**
 * Streaming runner for Gerrit — emits typed AgentStreamEvent values.
 *
 * @param agent        The agent instance to run.
 * @param input        The user message string.
 * @param context      Extra context injected into the ADK session state.
 * @param _sessionId   Reserved for future multi-turn session reuse (not yet wired to ADK InMemoryRunner).
 * @param timeoutMs    Maximum ms before the generator yields an error event.
 * @param maxLlmCalls  Limit on total LLM calls for this run (default: unlimited).
 */
export async function* runStreamingAgent(
    agent: BaseAgent,
    input: string,
    context: Record<string, unknown> = {},
    // sessionId is reserved for future multi-turn session reuse
    _sessionId?: string,
    timeoutMs = 20 * 60 * 1000,
    maxLlmCalls?: number,
): AsyncGenerator<AgentStreamEvent> {
    const runner = new InMemoryRunner({ agent, appName: "fdm-agents" })
    const userId = (context.principalId as string) ?? "system"

    const session = await runner.sessionService.createSession({
        appName: runner.appName,
        userId,
    })

    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

    const stream = runner.runAsync({
        userId,
        sessionId: session.id,
        newMessage: {
            role: "user",
            parts: [{ text: input }],
        },
        stateDelta: context,
        abortSignal: controller.signal,
        runConfig: maxLlmCalls != null ? { maxLlmCalls } : undefined,
    })

    let inputTokens = 0
    let outputTokens = 0
    let totalTokens = 0
    const toolCallCounts: Record<string, number> = {}
    const seenToolCalls: string[] = []

    try {
        for await (const event of stream) {
            if (controller.signal.aborted) {
                yield { type: "error", message: `Agent timed out after ${timeoutMs / 1000}s` }
                return
            }

            if (event.errorCode) {
                yield {
                    type: "error",
                    message: `Gemini API error [${event.errorCode}]: ${event.errorMessage ?? "unknown error"}`,
                }
                return
            }

            // Accumulate usage
            const usage = event.usageMetadata
            if (usage) {
                inputTokens += usage.promptTokenCount ?? 0
                outputTokens += usage.candidatesTokenCount ?? 0
                totalTokens += usage.totalTokenCount ?? 0
            }

            // Detect tool (function) calls and emit thinking steps
            const functionCalls = getFunctionCalls(event)
            for (const fc of functionCalls) {
                const toolName = fc.name
                if (!toolName) continue
                toolCallCounts[toolName] = (toolCallCounts[toolName] ?? 0) + 1
                seenToolCalls.push(toolName)
                yield {
                    type: "thinking_step",
                    step: {
                        tool: toolName,
                        description: toolDescription(toolName),
                        iteration: toolCallCounts[toolName],
                    },
                }
            }

            // Emit progressive text chunks while the agent is still streaming.
            // event.partial === true means this is an intermediate chunk (not the final turn).
            // Skip events that contain function calls — those are tool invocations, not text output.
            if (event.partial && functionCalls.length === 0) {
                const chunkText = stringifyContent(event)
                if (chunkText) {
                    yield { type: "text_chunk", text: chunkText }
                }
            }

            // Emit the final response text (complete turn)
            if (isFinalResponse(event)) {
                const text = stringifyContent(event)
                if (text) {
                    yield { type: "text_chunk", text }
                    yield {
                        type: "final_response",
                        text,
                        toolCalls: [...new Set(seenToolCalls)],
                        usage: totalTokens > 0
                            ? { inputTokens, outputTokens, totalTokens }
                            : null,
                    }
                }
            }
        }
    } finally {
        controller.abort()
        clearTimeout(timeoutHandle)
        await runner.sessionService.deleteSession({
            appName: runner.appName,
            userId,
            sessionId: session.id,
        })
    }
}
