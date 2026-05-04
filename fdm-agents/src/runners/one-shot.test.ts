import { afterEach, describe, expect, it, vi } from "vitest"
import { AgentTimeoutError, runOneShotAgent } from "./one-shot"

function makeAIMessage(
    content: string | Array<Record<string, unknown>>,
    opts: { tool_calls?: any[]; usage_metadata?: any } = {},
): any {
    return {
        _getType: () => "ai",
        content,
        tool_calls: opts.tool_calls ?? [],
        usage_metadata: opts.usage_metadata ?? null,
    }
}

function makeToolMessage(name: string): any {
    return { _getType: () => "tool", name }
}

function createMockAgent(chunks: Array<[string, Record<string, any>]>): any {
    return {
        stream: vi.fn().mockResolvedValue(
            (async function* () {
                for (const chunk of chunks) {
                    yield chunk
                }
            })(),
        ),
    }
}

function createThrowingAgent(error: Error): any {
    return {
        stream: vi.fn().mockResolvedValue(
            (async function* () {
                throw error
                // biome-ignore lint: unreachable but needed for generator type
                yield ["updates", {}] as any
            })(),
        ),
    }
}

describe("runOneShotAgent", () => {
    const mockPosthog = {
        client: { capture: vi.fn() },
        distinctId: "user-123",
    }

    afterEach(() => {
        vi.clearAllMocks()
    })

    it("should extract text from array content (e.g. Gemini thinking models)", async () => {
        const agent = createMockAgent([
            [
                "updates",
                {
                    agent: {
                        messages: [
                            makeAIMessage([
                                { type: "thinking", thinking: "Let me plan..." },
                                { type: "text", text: '{"summary":"s","plan":[]}' },
                            ]),
                        ],
                    },
                },
            ],
        ])
        const result = await runOneShotAgent(agent, "Generate plan")
        expect(result.result).toBe('{"summary":"s","plan":[]}')
    })

    it("should return the final response on success", async () => {
        const agent = createMockAgent([
            [
                "updates",
                { agent: { messages: [makeAIMessage("The plan is ready.")] } },
            ],
        ])
        const result = await runOneShotAgent(agent, "Generate plan")
        expect(result.result).toBe("The plan is ready.")
    })

    it("should throw when the stream throws an error", async () => {
        const agent = createThrowingAgent(
            new Error("Gemini API error [400]: Bad Request"),
        )
        await expect(runOneShotAgent(agent, "Generate plan")).rejects.toThrow(
            "Gemini API error [400]: Bad Request",
        )
    })

    it("should pass context to agent.stream when posthog is provided", async () => {
        const agent = createMockAgent([
            ["updates", { agent: { messages: [makeAIMessage("Done.")] } }],
        ])
        const context = { principalId: "p-1", b_id_farm: "f-1" }
        const result = await runOneShotAgent(agent, "Generate plan", context, mockPosthog)
        // Verify the run succeeded and context was passed through
        expect(result.result).toBe("Done.")
        expect(agent.stream).toHaveBeenCalledWith(
            expect.objectContaining({ messages: expect.any(Array) }),
            expect.objectContaining({ configurable: context }),
        )
    })

    it("should accumulate usage metadata across multiple LLM calls", async () => {
        const agent = createMockAgent([
            [
                "updates",
                {
                    agent: {
                        messages: [
                            makeAIMessage("", {
                                tool_calls: [{ name: "getFarmFields" }],
                                usage_metadata: {
                                    input_tokens: 100,
                                    output_tokens: 50,
                                },
                            }),
                        ],
                    },
                },
            ],
            [
                "updates",
                {
                    agent: {
                        messages: [
                            makeAIMessage("Done.", {
                                usage_metadata: {
                                    input_tokens: 20,
                                    output_tokens: 30,
                                },
                            }),
                        ],
                    },
                },
            ],
        ])
        const result = await runOneShotAgent(agent, "Generate plan")
        expect(result.usage).toEqual({
            inputTokens: 120,
            outputTokens: 80,
            totalTokens: 200,
        })
    })

    it("should return null usage when no usage metadata is present", async () => {
        const agent = createMockAgent([
            ["updates", { agent: { messages: [makeAIMessage("Done.")] } }],
        ])
        const result = await runOneShotAgent(agent, "Generate plan")
        expect(result.usage).toBeNull()
    })

    it("should extract tool call names from tools node updates", async () => {
        const agent = createMockAgent([
            [
                "updates",
                { tools: { messages: [makeToolMessage("getFarmFields")] } },
            ],
            ["updates", { agent: { messages: [makeAIMessage("Done.")] } }],
        ])
        const result = await runOneShotAgent(agent, "Generate plan")
        expect(result.toolCalls).toContain("getFarmFields")
    })

    it("should also capture tool call names from agent node tool_calls", async () => {
        const agent = createMockAgent([
            [
                "updates",
                {
                    agent: {
                        messages: [
                            makeAIMessage("", {
                                tool_calls: [{ name: "simulateFarmPlan" }],
                            }),
                        ],
                    },
                },
            ],
            ["updates", { agent: { messages: [makeAIMessage("Done.")] } }],
        ])
        const result = await runOneShotAgent(agent, "Generate plan")
        expect(result.toolCalls).toContain("simulateFarmPlan")
    })

    it("should deduplicate repeated tool call names", async () => {
        const agent = createMockAgent([
            [
                "updates",
                { tools: { messages: [makeToolMessage("searchFertilizers")] } },
            ],
            [
                "updates",
                { tools: { messages: [makeToolMessage("searchFertilizers")] } },
            ],
            ["updates", { agent: { messages: [makeAIMessage("Done.")] } }],
        ])
        const result = await runOneShotAgent(agent, "Generate plan")
        expect(
            result.toolCalls?.filter((n) => n === "searchFertilizers"),
        ).toHaveLength(1)
    })

    it("should throw AgentTimeoutError when the agent exceeds timeoutMs", async () => {
        vi.useFakeTimers()
        const neverYieldingAgent = {
            stream: vi.fn().mockResolvedValue(
                (async function* () {
                    await new Promise(() => {})
                    yield ["updates", {}] as any
                })(),
            ),
        }
        const runPromise = runOneShotAgent(
            neverYieldingAgent,
            "Generate plan",
            {},
            undefined,
            5000,
        )
        vi.advanceTimersByTime(6000)
        await expect(runPromise).rejects.toThrow(AgentTimeoutError)
        vi.useRealTimers()
    })
})

