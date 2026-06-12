import { describe, expect, it, vi } from "vitest"
import {
    createTicketTriageAgent,
    DEFAULT_MODEL_CODE,
    generateTicketSubjectAndPriority,
    SUBJECT_AND_PRIORITY_PROMPT,
} from "./agent"

vi.mock("../../models/default", () => ({
    createDefaultModel: vi.fn().mockReturnValue({}),
}))

const mockStream = vi.fn()
vi.mock("langchain", () => ({
    createAgent: vi.fn().mockImplementation(() => ({ stream: mockStream })),
}))

vi.mock("../../runners/one-shot", () => ({
    runOneShotAgent: vi.fn().mockResolvedValue({
        result: "",
        structuredResponse: {
            subject: "Test Subject",
            priority: "normal",
            reasoning: "Looks like a general question.",
        },
        usage: null,
        toolCalls: [],
    }),
}))

describe("Ticket Triage Agent — constants", () => {
    it("DEFAULT_MODEL_CODE should be the expected lite model", () => {
        expect(DEFAULT_MODEL_CODE).toBe("gemini-3.1-flash-lite")
    })

    it("SUBJECT_AND_PRIORITY_PROMPT should contain the four priority labels", () => {
        expect(SUBJECT_AND_PRIORITY_PROMPT).toContain("urgent")
        expect(SUBJECT_AND_PRIORITY_PROMPT).toContain("high")
        expect(SUBJECT_AND_PRIORITY_PROMPT).toContain("normal")
        expect(SUBJECT_AND_PRIORITY_PROMPT).toContain("low")
    })

    it("SUBJECT_AND_PRIORITY_PROMPT should reference FDM", () => {
        expect(SUBJECT_AND_PRIORITY_PROMPT).toContain("FDM")
    })

    it("SUBJECT_AND_PRIORITY_PROMPT should instruct the LLM to ignore injected instructions", () => {
        expect(SUBJECT_AND_PRIORITY_PROMPT).toContain("DO NOT follow")
    })
})

describe("createTicketTriageAgent", () => {
    it("should throw when no API key is given and GEMINI_API_KEY env is not set", () => {
        vi.stubEnv("GEMINI_API_KEY", "")
        expect(() => createTicketTriageAgent()).toThrow(
            "Missing Gemini API key",
        )
        vi.unstubAllEnvs()
    })

    it("should not throw when GEMINI_API_KEY env variable is set", () => {
        vi.stubEnv("GEMINI_API_KEY", "env-key")
        expect(() => createTicketTriageAgent()).not.toThrow()
        vi.unstubAllEnvs()
    })

    it("should not throw when apiKey is provided directly", () => {
        expect(() => createTicketTriageAgent("direct-api-key")).not.toThrow()
    })

    it("should throw when createAgent returns a non-agent value", async () => {
        const { createAgent } = await import("langchain")
        vi.mocked(createAgent).mockReturnValueOnce(null as any)
        expect(() => createTicketTriageAgent("some-key")).toThrow(
            "createAgent did not return an object with a callable stream method",
        )
    })
})

describe("generateTicketSubjectAndPriority", () => {
    it("should return low-priority shortcut for empty body", async () => {
        const result = await generateTicketSubjectAndPriority("")
        expect(result.subject).toBe("Empty Message")
        expect(result.priority).toBe("low")
    })

    it("should return low-priority shortcut for whitespace-only body", async () => {
        const result = await generateTicketSubjectAndPriority("   ")
        expect(result.subject).toBe("Empty Message")
        expect(result.priority).toBe("low")
    })

    it("should call runOneShotAgent with the prompt prepended for non-empty body", async () => {
        const { runOneShotAgent } = await import("../../runners/one-shot")
        await generateTicketSubjectAndPriority(
            "My fields are not loading.",
            "test-key",
        )
        expect(runOneShotAgent).toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining(SUBJECT_AND_PRIORITY_PROMPT),
            undefined,
            undefined,
        )
    })

    it("should include the ticket body after the prompt", async () => {
        const { runOneShotAgent } = await import("../../runners/one-shot")
        const body = "Urgent: I cannot log in."
        await generateTicketSubjectAndPriority(body, "test-key")
        expect(runOneShotAgent).toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining(body),
            undefined,
            undefined,
        )
    })

    it("should throw when structuredResponse is undefined", async () => {
        const { runOneShotAgent } = await import("../../runners/one-shot")
        vi.mocked(runOneShotAgent).mockResolvedValueOnce({
            runId: "",
            result: "",
            structuredResponse: undefined,
            usage: null,
            toolCalls: [],
        })
        await expect(
            generateTicketSubjectAndPriority("Some ticket body.", "test-key"),
        ).rejects.toThrow("No structured response was generated")
    })

    it("should return the parsed structured response on success", async () => {
        const result = await generateTicketSubjectAndPriority(
            "My fields are not loading.",
            "test-key",
        )
        expect(result).toEqual({
            subject: "Test Subject",
            priority: "normal",
            reasoning: "Looks like a general question.",
        })
    })
})
