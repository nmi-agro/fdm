import { Gemini } from "@google/adk"
import { gerritModels } from "../config"

/**
 * Creates a Gemini model configuration for the fdm-agents workspace.
 * @param apiKey Optional API key. If not provided, it looks for standard environment variables.
 * @param model Optional model name override. Defaults to `gerritModels.planning`.
 * @returns A Gemini model instance.
 */
export function createDefaultModel(apiKey?: string, model?: string) {
    return new Gemini({
        model: model ?? gerritModels.planning,
        apiKey: apiKey,
    })
}
