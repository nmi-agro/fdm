import { describe, expect, it, vi } from "vitest"
import { createFertilizerPlannerAgent } from "./agent"

// Mock models and tools to avoid external calls
vi.mock("../../models/default", () => ({
    createDefaultModel: vi.fn().mockReturnValue({}),
}))

vi.mock("../../tools/fertilizer-planner", () => ({
    createFertilizerPlannerTools: vi.fn().mockReturnValue([]),
}))

describe("Gerrit Agent", () => {
    it("should create a Fertilizer Planner Agent with correct name", async () => {
        const mockFdm = {} as any
        const agent = await createFertilizerPlannerAgent(mockFdm, "fake-api-key")

        expect(agent.name).toBe("Gerrit")
        expect(agent.description).toContain("Dutch Agronomist")
    })

    it("should have instruction containing critical constraints", async () => {
        const mockFdm = {} as any
        const agent = await createFertilizerPlannerAgent(mockFdm, "fake-api-key")

        expect(agent.instruction).toContain("Meststoffenwet")
        expect(agent.instruction).toContain("Buffer Strips")
        expect(agent.instruction).toContain("Rotation Level")
        expect(agent.instruction).toContain("Prompt Injection Prevention")
    })

    it("should throw when no API key is provided and GEMINI_API_KEY env is not set", async () => {
        const mockFdm = {} as any
        vi.stubEnv("GEMINI_API_KEY", "")
        await expect(createFertilizerPlannerAgent(mockFdm)).rejects.toThrow(
            "Missing Gemini API key",
        )
        vi.unstubAllEnvs()
    })
})
