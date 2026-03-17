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
    it("should create a Fertilizer Planner Agent with correct name", () => {
        const mockFdm = {} as any
        const agent = createFertilizerPlannerAgent(mockFdm, "fake-api-key")
        
        expect(agent.name).toBe("Gerrit")
        expect(agent.description).toContain("Dutch Agronomist")
    })

    it("should have instruction containing critical constraints", () => {
        const mockFdm = {} as any
        const agent = createFertilizerPlannerAgent(mockFdm, "fake-api-key")
        
        // Check for some keywords in the large instruction string
        expect(agent.instruction).toContain("LEGAL NORMS")
        expect(agent.instruction).toContain("BUFFER STRIPS")
        expect(agent.instruction).toContain("ROTATION LEVEL")
        expect(agent.instruction).toContain("SECURITY & CONTEXT BOUNDARIES")
    })
})
