import { describe, expect, it, vi } from "vitest"
import {
    GERRIT_DESCRIPTION,
    GERRIT_INSTRUCTION,
    GERRIT_NAME,
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
})
