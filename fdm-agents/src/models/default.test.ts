import { beforeEach, describe, expect, it, vi } from "vitest"
import { createDefaultModel } from "./default"

// Mock @langchain/google-genai
const mockChatGoogleGenerativeAI = vi.fn()
vi.mock("@langchain/google-genai", () => ({
    ChatGoogleGenerativeAI: class {
        constructor(opts: any) {
            mockChatGoogleGenerativeAI(opts)
        }
    },
}))

describe("Default Model", () => {
    beforeEach(() => {
        mockChatGoogleGenerativeAI.mockClear()
    })

    it("should create a ChatGoogleGenerativeAI model with default values", () => {
        createDefaultModel("fake-api-key")

        expect(mockChatGoogleGenerativeAI).toHaveBeenCalledTimes(1)
        expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: "fake-api-key",
                model: "gemini-3.1-pro-preview",
            }),
        )
    })

    it("should allow overriding the model name", () => {
        createDefaultModel("fake-api-key", "custom-model")

        expect(mockChatGoogleGenerativeAI).toHaveBeenCalledTimes(1)
        expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: "fake-api-key",
                model: "custom-model",
            }),
        )
    })
})
