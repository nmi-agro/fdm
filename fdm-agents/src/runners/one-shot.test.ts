import { describe, expect, it, vi, beforeEach } from "vitest"
import { runOneShotAgent } from "./one-shot"
import { InMemoryRunner } from "@google/adk"

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
        expect(result).toBe("The plan is ready.")
    })

    it("should throw an error if the model returns an error code", async () => {
        const mockStream = (async function* () {
            yield { errorCode: "400", errorMessage: "Bad Request" }
        })()

        mockRunEphemeral.mockReturnValue(mockStream)

        await expect(runOneShotAgent(mockAgent, "Generate plan")).rejects.toThrow("Gemini API error [400]: Bad Request")
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
            additionalContext: "None"
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
})
