import { AIMessage } from "@langchain/core/messages"
import { describe, expect, it, vi } from "vitest"
import {
    DEFAULT_TOOL_ROUND_LIMIT,
    GERRIT_DESCRIPTION,
    GERRIT_INSTRUCTION,
    GERRIT_NAME,
    TOOL_LIMIT_WARNING,
    countToolRoundtrips,
    createFertilizerPlannerAgent,
} from "./agent"

// Mock models and tools to avoid external calls
vi.mock("../../models/default", () => ({
    createDefaultModel: vi.fn().mockReturnValue({}),
}))

vi.mock("../../tools/fertilizer-planner", () => ({
    createFertilizerPlannerTools: vi.fn().mockReturnValue([]),
}))

describe("Gerrit Agent", () => {
    it("should have the correct name and description", () => {
        expect(GERRIT_NAME).toBe("Gerrit")
        expect(GERRIT_DESCRIPTION).toContain("Dutch Agronomist")
    })

    it("should have instruction containing critical constraints", () => {
        expect(GERRIT_INSTRUCTION).toContain("LEGAL NORMS")
        expect(GERRIT_INSTRUCTION).toContain("BUFFER STRIPS")
        expect(GERRIT_INSTRUCTION).toContain("ROTATION LEVEL")
        expect(GERRIT_INSTRUCTION).toContain("SECURITY & CONTEXT BOUNDARIES")
    })

    it("should throw when no API key is provided and GEMINI_API_KEY env is not set", () => {
        const mockFdm = {} as any
        vi.stubEnv("GEMINI_API_KEY", "")
        expect(() => createFertilizerPlannerAgent(mockFdm)).toThrow(
            "Missing Gemini API key",
        )
        vi.unstubAllEnvs()
    })

    it("should export a default tool round limit", () => {
        expect(DEFAULT_TOOL_ROUND_LIMIT).toBe(40)
    })

    it("should export a tool limit warning message", () => {
        expect(TOOL_LIMIT_WARNING).toContain("final fertilizer plan NOW")
    })
})

describe("countToolRoundtrips", () => {
    it("should return 0 for empty messages", () => {
        expect(countToolRoundtrips([])).toBe(0)
    })

    it("should count AI messages with tool calls", () => {
        const messages = [
            new AIMessage({
                content: "",
                tool_calls: [
                    { name: "getFarmFields", args: {}, id: "1", type: "tool_call" },
                ],
            }),
            new AIMessage({
                content: "",
                tool_calls: [
                    {
                        name: "simulateFarmPlan",
                        args: {},
                        id: "2",
                        type: "tool_call",
                    },
                ],
            }),
            new AIMessage({ content: "Final answer" }),
        ]
        expect(countToolRoundtrips(messages)).toBe(2)
    })

    it("should not count AI messages without tool calls", () => {
        const messages = [new AIMessage({ content: "Just talking" })]
        expect(countToolRoundtrips(messages)).toBe(0)
    })

    it("should count a single AI message with multiple parallel tool calls as one roundtrip", () => {
        const messages = [
            new AIMessage({
                content: "",
                tool_calls: [
                    { name: "toolA", args: {}, id: "1", type: "tool_call" },
                    { name: "toolB", args: {}, id: "2", type: "tool_call" },
                ],
            }),
        ]
        expect(countToolRoundtrips(messages)).toBe(1)
    })
})
