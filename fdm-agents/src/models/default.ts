import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

/**
 * Creates a ChatGoogleGenerativeAI model configuration for the fdm-agents workspace.
 * @param apiKey Optional API key. If not provided, it looks for standard environment variables.
 * @param model Optional model name. Defaults to gemini-3.1-pro-preview.
 * @returns A ChatGoogleGenerativeAI model instance.
 */
export function createDefaultModel(apiKey?: string, model?: string) {
    return new ChatGoogleGenerativeAI({
        model: model ?? "gemini-3.1-pro-preview",
        apiKey: apiKey,
    })
}
