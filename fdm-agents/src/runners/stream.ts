import { randomUUID } from "node:crypto"
import type { LangChainCallbackHandler } from "@posthog/ai/langchain"
import type { AgentGraph } from "../agents/gerrit/agent"

/**
 * Extracts the final text string from an AI message content value.
 * @langchain/google-genai can return content as an array of parts
 * (e.g. [{type:"thinking",...},{type:"text",text:"..."}]) instead of a plain
 * string. All text parts are concatenated in order; thinking parts are ignored.
 */
function extractTextContent(content: unknown): string {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
        const texts: string[] = []
        for (const part of content) {
            const p = part as Record<string, unknown>
            if (p?.type === "text" && typeof p.text === "string") texts.push(p.text)
            else if (typeof part === "string") texts.push(part)
        }
        return texts.join("")
    }
    return ""
}

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
 * @param timeoutMs Maximum milliseconds before the stream is aborted (default: 20 minutes).
 * @returns An AsyncGenerator yielding structured events.
 */
export async function* runStreamAgent(
    agent: AgentGraph,
    input: string,
    context: Record<string, any> = {},
    posthog?: { client: any; distinctId: string },
    recursionLimit = 100,
    timeoutMs = 20 * 60 * 1000,
): AsyncGenerator<StreamEvent, void, unknown> {
    const abortController = new AbortController()
    const callbacks = buildCallbacks(posthog, context)
    const runId = randomUUID()
    // Unique thread ID per invocation so all LLM and tool runs for this request
    // are grouped under a single thread in LangSmith.
    const threadId = randomUUID()

    const timeoutHandle = setTimeout(() => {
        abortController.abort()
    }, timeoutMs)

    try {
        const stream = agent.streamEvents(
            { messages: [{ role: "user", content: input }] },
            {
                version: "v2",
                configurable: context,
                recursionLimit,
                runId,
                runName: "gerrit-stream",
                signal: abortController.signal,
                metadata: {
                    b_id_farm: context.b_id_farm,
                    thread_id: threadId,
                },
                ...(callbacks ? { callbacks } : {}),
            },
        ) as AsyncIterable<Record<string, any>>

        // Robustly capture the final plan payload. The agent state exposes
        // `structuredResponse` (from the responseFormat tool) and `messages`.
        // We capture from ANY on_chain_end that carries them (last one wins)
        // rather than matching a specific chain name, which is brittle.
        let structuredResponse: Record<string, unknown> | undefined
        let finalText = ""

        for await (const event of stream) {
            const { event: eventType, data } = event

            if (eventType === "on_chat_model_end") {
                // Inside the agent graph, "thinking" (reasoning) parts are only
                // present on the completed message, NOT on the streamed chunks.
                // Emit one reasoning event per thinking part of each model turn.
                const content = data?.output?.content
                if (Array.isArray(content)) {
                    for (const part of content) {
                        if (
                            part?.type === "thinking" &&
                            typeof part.thinking === "string" &&
                            part.thinking
                        ) {
                            yield {
                                event: "reasoning",
                                data: { chunk: `${part.thinking}\n\n` },
                            }
                        }
                    }
                }
            } else if (eventType === "on_tool_start") {
                yield {
                    event: "on_tool_start",
                    data: { name: event.name, inputs: data?.input },
                }
            } else if (eventType === "on_tool_end") {
                yield {
                    event: "on_tool_end",
                    data: { name: event.name, output: data?.output },
                }
            } else if (eventType === "on_chain_end") {
                const output = data?.output
                if (output?.structuredResponse) {
                    structuredResponse = output.structuredResponse
                }
                if (Array.isArray(output?.messages)) {
                    const lastMessage = output.messages.at(-1)
                    const text = extractTextContent(lastMessage?.content)
                    if (text) finalText = text
                }
            }
        }

        yield {
            event: "on_chain_end",
            data: { structuredResponse, result: finalText },
        }
    } catch (err: unknown) {
        let message = "Unknown error"
        if (err instanceof Error) {
            message = err.message
        }
        yield { event: "error", data: { message } }
    } finally {
        clearTimeout(timeoutHandle)
    }
}
