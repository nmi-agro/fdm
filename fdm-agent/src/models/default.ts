import { Gemini } from '@google/adk';

/**
 * Creates a Gemini model configuration for the fdm-agent workspace.
 * @param apiKey Optional API key. If not provided, it looks for standard environment variables.
 * @returns A Gemini model instance.
 */
export function createDefaultModel(apiKey?: string) {
    return new Gemini({
        model: 'gemini-3.1-pro',
        apiKey: apiKey
    });
}
