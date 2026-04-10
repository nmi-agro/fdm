import type { IntentQuestion, ThinkingStep } from "@nmi-agro/fdm-agents"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeSessionJSONStorage } from "./storage"
import type { FarmTotals, ParsedPlan } from "../components/blocks/gerrit/types"

export type GerritPhase =
    | "idle"
    | "loading_intent"
    | "intent"
    | "generating"
    | "plan_ready"
    | "follow_up"

export interface GerritMessage {
    role: "user" | "assistant"
    content: string
    type: "question" | "answer" | "plan" | "follow_up" | "error"
    timestamp: number
}

export interface EnrichedPlanRow {
    b_id: string
    b_name: string
    b_lu_catalogue: string
    b_lu_name: string
    b_lu_croprotation: string | null
    b_area: number | null
    b_bufferstrip: boolean
    applications: Array<{
        p_id_catalogue: string
        p_app_amount: number
        p_app_date: string
        p_app_method?: string | null
        p_name_nl: string | null
        p_type: string
        p_app_method_name?: string | null
    }>
    fieldMetrics: import("../components/blocks/gerrit/types").FieldMetrics | null
}

export interface GerritPlan {
    summary: string
    suggestedFollowUps: string[]
    plan: EnrichedPlanRow[]
    metrics: { farmTotals: FarmTotals } | null
    rawPlan: ParsedPlan
}

interface GerritSessionState {
    sessionId: string | null
    farmId: string | null
    calendar: string | null
    phase: GerritPhase

    /** Intent questions returned from the /intent call */
    intentQuestions: IntentQuestion[]
    /** User's selected answers: questionId → option value (or open text) */
    intentAnswers: Record<string, string>

    /** Live thinking steps accumulated during streaming */
    thinkingSteps: ThinkingStep[]

    /** Conversation messages (post-plan follow-up chat) */
    messages: GerritMessage[]

    /** The accepted plan once generation is complete */
    currentPlan: GerritPlan | null

    /** Generation error message, if any */
    errorMessage: string | null

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------
    startSession: (farmId: string, calendar: string) => void
    setPhase: (phase: GerritPhase) => void
    setIntentQuestions: (questions: IntentQuestion[]) => void
    setIntentAnswer: (questionId: string, value: string) => void
    addThinkingStep: (step: ThinkingStep) => void
    clearThinkingSteps: () => void
    setPlan: (plan: GerritPlan) => void
    addMessage: (msg: Omit<GerritMessage, "timestamp">) => void
    updateLastAssistantMessage: (content: string) => void
    setError: (message: string) => void
    resetSession: () => void
}

const initialState: Omit<GerritSessionState, keyof Record<string, (...args: any[]) => any>> = {
    sessionId: null,
    farmId: null,
    calendar: null,
    phase: "idle",
    intentQuestions: [],
    intentAnswers: {},
    thinkingSteps: [],
    messages: [],
    currentPlan: null,
    errorMessage: null,
}

export const useGerritSession = create<GerritSessionState>()(
    persist(
        (set) => ({
            sessionId: null,
            farmId: null,
            calendar: null,
            phase: "idle",
            intentQuestions: [],
            intentAnswers: {},
            thinkingSteps: [],
            messages: [],
            currentPlan: null,
            errorMessage: null,

            startSession: (farmId, calendar) =>
                set({
                    ...initialState,
                    farmId,
                    calendar,
                    sessionId: `gerrit-${farmId}-${calendar}-${Date.now()}`,
                    phase: "loading_intent",
                }),

            setPhase: (phase) => set({ phase }),

            setIntentQuestions: (questions) =>
                set({ intentQuestions: questions, phase: "intent" }),

            setIntentAnswer: (questionId, value) =>
                set((state) => ({
                    intentAnswers: { ...state.intentAnswers, [questionId]: value },
                })),

            addThinkingStep: (step) =>
                set((state) => ({
                    thinkingSteps: [...state.thinkingSteps, step],
                })),

            clearThinkingSteps: () => set({ thinkingSteps: [] }),

            setPlan: (plan) =>
                set({
                    currentPlan: plan,
                    phase: "plan_ready",
                    errorMessage: null,
                }),

            addMessage: (msg) =>
                set((state) => ({
                    messages: [
                        ...state.messages,
                        { ...msg, timestamp: Date.now() },
                    ],
                    phase: "follow_up",
                })),

            updateLastAssistantMessage: (content) =>
                set((state) => {
                    const messages = [...state.messages]
                    const lastIdx = messages.length - 1
                    if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
                        messages[lastIdx] = { ...messages[lastIdx], content }
                    } else {
                        messages.push({
                            role: "assistant",
                            content,
                            type: "follow_up",
                            timestamp: Date.now(),
                        })
                    }
                    return { messages }
                }),

            setError: (message) =>
                set({ errorMessage: message, phase: "idle" }),

            resetSession: () => set({ ...initialState }),
        }),
        {
            name: "gerrit-session",
            storage: createJSONStorage(() => ssrSafeSessionJSONStorage),
            // Don't persist thinking steps — they're transient generation state
            partialize: (state) => ({
                sessionId: state.sessionId,
                farmId: state.farmId,
                calendar: state.calendar,
                phase:
                    state.phase === "generating" || state.phase === "loading_intent"
                        ? "idle"
                        : state.phase,
                intentQuestions: state.intentQuestions,
                intentAnswers: state.intentAnswers,
                messages: state.messages,
                currentPlan: state.currentPlan,
                errorMessage: state.errorMessage,
                // thinkingSteps intentionally excluded
            }),
        },
    ),
)

/**
 * Serializes the user's intent answers into a Dutch paragraph for injection
 * into additionalContext before plan generation.
 */
export function serializeIntentAnswers(
    questions: IntentQuestion[],
    answers: Record<string, string>,
): string {
    const parts: string[] = []
    for (const q of questions) {
        const answer = answers[q.id]
        if (!answer) continue
        const option = q.options.find((o) => o.value === answer)
        if (option?.isOpen) {
            // open-text answer
            parts.push(`${q.question} → ${answer}`)
        } else if (option) {
            parts.push(`${q.question} → ${option.label}`)
        }
    }
    return parts.join(". ")
}
