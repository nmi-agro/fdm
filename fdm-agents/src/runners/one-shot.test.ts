import { beforeEach, describe, expect, it, vi } from "vitest"
import { runOneShotAgent } from "./one-shot"

// Mock ADK
const mockRunEphemeral = vi.fn()
vi.mock("@google/adk", async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        InMemoryRunner: class {
            runEphemeral = mockRunEphemeral
        },
        isFinalResponse: vi.fn(),
        stringifyContent: vi.fn(),
    }
})

import { isFinalResponse, stringifyContent } from "@google/adk"

describe("runOneShotAgent", () => {
    const mockAgent = { name: "TestAgent" } as any
    const mockPosthog = {
        client: { capture: vi.fn() },
        distinctId: "user-123",
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("should return the final response on success", async () => {
        const mockEvent = { type: "final" }
        const mockStream = (async function* () {
            yield mockEvent
        })()

        mockRunEphemeral.mockReturnValue(mockStream)
        ;(isFinalResponse as any).mockReturnValue(true)
        ;(stringifyContent as any).mockReturnValue("The plan is ready.")

        const result = await runOneShotAgent(mockAgent, "Generate plan")
        expect(result.result).toBe("The plan is ready.")
    })

    it("should throw an error if the model returns an error code", async () => {
        const mockStream = (async function* () {
            yield { errorCode: "400", errorMessage: "Bad Request" }
        })()

        mockRunEphemeral.mockReturnValue(mockStream)

        await expect(
            runOneShotAgent(mockAgent, "Generate plan"),
        ).rejects.toThrow("Gemini API error [400]: Bad Request")
    })

    it("should capture an event in PostHog if provided", async () => {
        const mockEvent = { type: "final" }
        const mockStream = (async function* () {
            yield mockEvent
        })()

        mockRunEphemeral.mockReturnValue(mockStream)
        ;(isFinalResponse as any).mockReturnValue(true)
        ;(stringifyContent as any).mockReturnValue("Done.")

        const context = {
            principalId: "p-1",
            b_id_farm: "f-1",
            strategies: { isOrganic: true },
            additionalContext: "None",
        }

        await runOneShotAgent(mockAgent, "Generate plan", context, mockPosthog)

        expect(mockPosthog.client.capture).toHaveBeenCalledWith({
            distinctId: "user-123",
            event: "$ai_generation",
            properties: expect.objectContaining({
                agent_name: "TestAgent",
                b_id_farm: "f-1",
                principal_id: "p-1",
                strategies: { isOrganic: true },
                additional_context: "None",
            }),
        })
    })

    it("should accumulate usage metadata from stream events", async () => {
        const mockStream = (async function* () {
            yield {
                usageMetadata: {
                    promptTokenCount: 100,
                    candidatesTokenCount: 50,
                    totalTokenCount: 150,
                },
            }
            yield { type: "final" }
        })()

        mockRunEphemeral.mockReturnValue(mockStream)
        ;(isFinalResponse as any).mockImplementation(
            (e: any) => e.type === "final",
        )
        ;(stringifyContent as any).mockReturnValue("Done.")

        const result = await runOneShotAgent(mockAgent, "Generate plan")
        expect(result.usage).toEqual({
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
        })
    })

    it("should return null usage when no usage metadata is present", async () => {
        const mockStream = (async function* () {
            yield { type: "final" }
        })()

        mockRunEphemeral.mockReturnValue(mockStream)
        ;(isFinalResponse as any).mockReturnValue(true)
        ;(stringifyContent as any).mockReturnValue("Done.")

        const result = await runOneShotAgent(mockAgent, "Generate plan")
        expect(result.usage).toBeNull()
    })

    it("should extract tool call names from modelTurn.parts", async () => {
        const mockStream = (async function* () {
            yield {
                modelTurn: {
                    parts: [
                        { functionCall: { name: "getFarmFields" } },
                        { text: "thinking..." },
                    ],
                },
            }
            yield { type: "final" }
        })()

        mockRunEphemeral.mockReturnValue(mockStream)
        ;(isFinalResponse as any).mockImplementation(
            (e: any) => e.type === "final",
        )
        ;(stringifyContent as any).mockReturnValue("Done.")

        const result = await runOneShotAgent(mockAgent, "Generate plan")
        expect(result.toolCalls).toContain("getFarmFields")
    })

    it("should extract tool call names from direct functionCall property", async () => {
        const mockStream = (async function* () {
            yield { functionCall: { name: "simulateFarmPlan" } }
            yield { type: "final" }
        })()

        mockRunEphemeral.mockReturnValue(mockStream)
        ;(isFinalResponse as any).mockImplementation(
            (e: any) => e.type === "final",
        )
        ;(stringifyContent as any).mockReturnValue("Done.")

        const result = await runOneShotAgent(mockAgent, "Generate plan")
        expect(result.toolCalls).toContain("simulateFarmPlan")
    })

    it("should deduplicate repeated tool call names", async () => {
        const mockStream = (async function* () {
            yield { functionCall: { name: "searchFertilizers" } }
            yield { functionCall: { name: "searchFertilizers" } }
            yield { type: "final" }
        })()

        mockRunEphemeral.mockReturnValue(mockStream)
        ;(isFinalResponse as any).mockImplementation(
            (e: any) => e.type === "final",
        )
        ;(stringifyContent as any).mockReturnValue("Done.")

        const result = await runOneShotAgent(mockAgent, "Generate plan")
        expect(
            result.toolCalls?.filter((n) => n === "searchFertilizers"),
        ).toHaveLength(1)
    })

    it("should handle PostHog capture failure gracefully", async () => {
        const failingPosthog = {
            client: {
                capture: vi.fn().mockImplementation(() => {
                    throw new Error("PostHog unavailable")
                }),
            },
            distinctId: "user-1",
        }

        const mockStream = (async function* () {
            yield { type: "final" }
        })()

        mockRunEphemeral.mockReturnValue(mockStream)
        ;(isFinalResponse as any).mockReturnValue(true)
        ;(stringifyContent as any).mockReturnValue("Done.")

        // Should not throw even though PostHog throws
        const result = await runOneShotAgent(
            mockAgent,
            "Generate plan",
            {},
            failingPosthog,
        )
        expect(result.result).toBe("Done.")
    })
})
