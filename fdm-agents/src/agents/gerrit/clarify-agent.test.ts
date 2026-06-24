import { describe, expect, it, vi } from "vitest"
import {
    CLARIFY_INSTRUCTION,
    CLARIFY_NAME,
    createClarifyAgent,
} from "./clarify-agent"
import {
    ClarificationAnswerSchema,
    ClarifyingQuestionsSchema,
} from "./clarify-schema"

vi.mock("../../models/default", () => ({
    createDefaultModel: vi.fn().mockReturnValue({}),
}))

vi.mock("../../tools/fertilizer-planner", () => ({
    createFertilizerPlannerTools: vi.fn().mockReturnValue([
        { name: "getFarmFields" },
        { name: "searchFertilizers" },
        { name: "simulateFarmPlan" },
    ]),
    createClarifyAgentTools: vi.fn().mockReturnValue([
        { name: "getFarmFields" },
        { name: "searchFertilizers" },
    ]),
}))

vi.mock("langchain", () => ({
    createAgent: vi.fn().mockReturnValue({ stream: vi.fn(), streamEvents: vi.fn() }),
    dynamicSystemPromptMiddleware: vi.fn().mockReturnValue({}),
    toolStrategy: vi.fn().mockReturnValue({}),
}))

describe("clarify agent", () => {
    it("should have the correct name", () => {
        expect(CLARIFY_NAME).toBe("Gerrit Verduidelijking")
    })

    it("should have a Dutch instruction with TAAL directive", () => {
        expect(CLARIFY_INSTRUCTION).toContain("TAAL")
        expect(CLARIFY_INSTRUCTION).toContain("Nederlands")
        expect(CLARIFY_INSTRUCTION).toContain("STAP 1")
        expect(CLARIFY_INSTRUCTION).toContain("STAP 2")
        expect(CLARIFY_INSTRUCTION).toContain("STAP 3")
    })

    it("should throw when no API key is provided", () => {
        vi.stubEnv("GEMINI_API_KEY", "")
        expect(() => createClarifyAgent({} as any)).toThrow("Missing Gemini API key")
        vi.unstubAllEnvs()
    })

    it("should create an agent graph when API key is provided", () => {
        const agent = createClarifyAgent({} as any, "test-api-key")
        expect(agent).toBeDefined()
        expect(typeof agent.stream).toBe("function")
        expect(typeof agent.streamEvents).toBe("function")
    })

    it("should pass CLARIFY_INSTRUCTION as the system prompt via middleware callback", async () => {
        const { dynamicSystemPromptMiddleware } = await import("langchain")
        let capturedCallback: (() => string) | undefined
        vi.mocked(dynamicSystemPromptMiddleware).mockImplementationOnce((cb: any) => {
            capturedCallback = cb
            return {} as any
        })
        createClarifyAgent({} as any, "test-api-key")
        expect(capturedCallback).toBeDefined()
        expect(capturedCallback!()).toBe(CLARIFY_INSTRUCTION)
    })

    it("should throw when createAgent returns a non-graph object", async () => {
        const { createAgent } = await import("langchain")
        vi.mocked(createAgent).mockReturnValueOnce(null as any)
        expect(() => createClarifyAgent({} as any, "test-api-key")).toThrow(
            "createAgent did not return an object with a callable stream method.",
        )
    })

    it("should throw when createAgent returns an object missing streamEvents", async () => {
        const { createAgent } = await import("langchain")
        vi.mocked(createAgent).mockReturnValueOnce({ stream: vi.fn() } as any)
        expect(() => createClarifyAgent({} as any, "test-api-key")).toThrow(
            "createAgent did not return an object with a callable stream method.",
        )
    })
})

describe("ClarifyingQuestionsSchema", () => {
    it("should parse a valid empty questions list", () => {
        const result = ClarifyingQuestionsSchema.safeParse({ questions: [] })
        expect(result.success).toBe(true)
    })

    it("should parse a single-select question with 2 options", () => {
        const result = ClarifyingQuestionsSchema.safeParse({
            questions: [
                {
                    id: "q1",
                    question: "Welk mesttype heeft de voorkeur?",
                    selection: "single",
                    options: [
                        { id: "a", label: "Rundveedrijfmest" },
                        { id: "b", label: "Varkensdrijfmest" },
                    ],
                },
            ],
        })
        expect(result.success).toBe(true)
    })

    it("should reject more than 5 questions", () => {
        const q = {
            id: "q1",
            question: "Vraag?",
            selection: "single" as const,
            options: [
                { id: "a", label: "Optie A" },
                { id: "b", label: "Optie B" },
            ],
        }
        const result = ClarifyingQuestionsSchema.safeParse({
            questions: [q, q, q, q, q, q],
        })
        expect(result.success).toBe(false)
    })

    it("should reject a question with only 1 option", () => {
        const result = ClarifyingQuestionsSchema.safeParse({
            questions: [
                {
                    id: "q1",
                    question: "Vraag?",
                    selection: "single",
                    options: [{ id: "a", label: "Optie A" }],
                },
            ],
        })
        expect(result.success).toBe(false)
    })

    it("should reject a question with more than 4 options", () => {
        const result = ClarifyingQuestionsSchema.safeParse({
            questions: [
                {
                    id: "q1",
                    question: "Vraag?",
                    selection: "multi",
                    options: [
                        { id: "a", label: "A" },
                        { id: "b", label: "B" },
                        { id: "c", label: "C" },
                        { id: "d", label: "D" },
                        { id: "e", label: "E" },
                    ],
                },
            ],
        })
        expect(result.success).toBe(false)
    })
})

describe("ClarificationAnswerSchema", () => {
    it("should parse a valid answer with selected options", () => {
        const result = ClarificationAnswerSchema.safeParse({
            questionId: "q1",
            question: "Welk mesttype?",
            selectedOptionIds: ["a"],
            selectedOptionLabels: ["Rundveedrijfmest"],
        })
        expect(result.success).toBe(true)
    })

    it("should parse an answer with an 'other' text", () => {
        const result = ClarificationAnswerSchema.safeParse({
            questionId: "q1",
            question: "Welk mesttype?",
            selectedOptionIds: [],
            selectedOptionLabels: [],
            other: "Kippenmost van buurman",
        })
        expect(result.success).toBe(true)
    })
})
