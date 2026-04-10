/**
 * Model configuration for fdm-agents.
 *
 * Each property selects the Gemini model used for a specific call type.
 * Override individual entries to swap models without changing agent code.
 */
export const gerritModels = {
    /** Main fertilizer planning agent — ADK streaming runner */
    planning: "gemini-3-flash-preview",
    /** Conversational follow-up after plan generation — ADK streaming runner */
    followUp: "gemini-3-flash-preview",
    /** Lightweight intent questions — direct generateContent call */
    intent: "gemini-3-flash-preview",
} as const satisfies Record<string, string>

export type GerritModelConfig = typeof gerritModels
