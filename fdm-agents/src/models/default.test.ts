import { describe, expect, it, vi } from "vitest"
import { createDefaultModel } from "./default"

// Mock ADK models
const mockGemini = vi.fn()
vi.mock("@google/adk", async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        Gemini: class {
            constructor(opts: any) {
                mockGemini(opts)
            }
        },
    }
})

describe("Default Model", () => {
    it("should create a Gemini model with default values", () => {
        createDefaultModel("fake-api-key")
        
        expect(mockGemini).toHaveBeenCalledWith(expect.objectContaining({
            apiKey: "fake-api-key",
            model: "gemini-3.1-pro-preview"
        }))
    })

    it("should allow overriding the model name", () => {
        createDefaultModel("fake-api-key", "custom-model")
        
        expect(mockGemini).toHaveBeenCalledWith(expect.objectContaining({
            apiKey: "fake-api-key",
            model: "custom-model"
        }))
    })
})
