import { randomUUID } from "node:crypto"
import type { LangChainCallbackHandler } from "@posthog/ai/langchain"
import type { AgentGraph } from "../agents/gerrit/agent"

export interface StreamEvent {
    event: "on_chat_model_stream" | "reasoning" | "on_tool_start" | "on_tool_end" | "on_chain_end" | "complete" | "error"
    data?: any
}

function buildCallbacks(
    posthog?: { client: any; distinctId: string },
    context?: Record<string, any>,
): LangChainCallbackHandler[] | undefined {
    if (!posthog?.client) return undefined
    try {
        const { LangChainCallbackHandler } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("@posthog/ai/langchain") as {
                LangChainCallbackHandler: new (
                    opts: any,
                ) => LangChainCallbackHandler
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
 * Runner for streaming agent execution in fdm-agents.
 * @param agent The compiled LangGraph agent to run.
 * @param input The user input string.
 * @param context Extra context to provide via config.configurable.
 * @param posthog Optional PostHog client and distinctId for tracking.
 * @param recursionLimit Maximum number of graph steps before LangGraph aborts.
 * @returns An AsyncGenerator yielding structured events.
 */
export async function* runStreamAgent(
    agent: AgentGraph,
    input: string,
    context: Record<string, any> = {},
    posthog?: { client: any; distinctId: string },
    recursionLimit = 100,
): AsyncGenerator<StreamEvent, void, unknown> {
    const callbacks = buildCallbacks(posthog, context)
    const runId = randomUUID()
    // Unique thread ID per invocation so all LLM and tool runs for this request
    // are grouped under a single thread in LangSmith.
    const threadId = randomUUID()

    try {
        const stream = agent.streamEvents(
            { messages: [{ role: "user", content: input }] },
            {
                version: "v2",
                configurable: context,
                recursionLimit,
                runId,
                runName: "gerrit-stream",
                metadata: {
                    b_id_farm: context.b_id_farm,
                    thread_id: threadId,
                },
                ...(callbacks ? { callbacks } : {}),
            },
        ) as AsyncIterable<Record<string, any>>

        for await (const event of stream) {
            const { event: eventType, name, data } = event

            if (eventType === "on_chat_model_stream") {
                const content = data?.chunk?.content
                // With reasoning enabled, streamed content is an array of parts.
                // Surface only "thinking" parts as reasoning; the final answer
                // text (plan JSON / structured response) is intentionally not
                // shown in the live feed — it is delivered via on_chain_end.
                if (Array.isArray(content)) {
                    for (const part of content) {
                        if (
                            part?.type === "thinking" &&
                            typeof part.thinking === "string" &&
                            part.thinking
                        ) {
                            yield {
                                event: "reasoning",
                                data: { chunk: part.thinking },
                            }
                        }
                    }
                }
            } else if (eventType === "on_tool_start") {
                yield {
                    event: "on_tool_start",
                    data: { name, inputs: data?.input },
                }
            } else if (eventType === "on_tool_end") {
                yield {
                    event: "on_tool_end",
                    data: { name, output: data?.output },
                }
            } else if (eventType === "on_chain_end") {
                // Return structuredResponse if it's the main agent graph
                if (name === "Gerrit" && data?.output?.structuredResponse) {
                    yield {
                        event: "on_chain_end",
                        data: { structuredResponse: data.output.structuredResponse, result: data.output.result },
                    }
                }
            }
        }
    } catch (err: unknown) {
        let message = "Unknown error"
        if (err instanceof Error) {
            message = err.message
        }
        yield { event: "error", data: { message } }
    }
}
