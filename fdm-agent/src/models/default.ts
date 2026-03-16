import { Gemini } from "@google/adk"

/**
 * Creates a Gemini model configuration for the fdm-agent workspace.
 * @param apiKey Optional API key. If not provided, it looks for standard environment variables.
 * @param model Optional model name. Defaults to gemini-3.1-pro-preview.
 * @returns A Gemini model instance.
 */
export function createDefaultModel(apiKey?: string, model?: string) {
    return new Gemini({
        model: model ?? "gemini-3.1-pro-preview",
        apiKey: apiKey,
    })
}
