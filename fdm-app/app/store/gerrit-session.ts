import type { IntentQuestion, ThinkingStep } from "@nmi-agro/fdm-agents"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ssrSafeJSONStorage } from "./storage"
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

// ─── Session key ────────────────────────────────────────────────────────────

export function makeGerritSessionKey(
    farmId: string,
    calendar: string,
): string {
    return `${farmId}-${calendar}`
}

// ─── Persisted per-session data ──────────────────────────────────────────────

interface PersistedSession {
    sessionId: string
    farmId: string
    calendar: string
    phase: GerritPhase
    intentQuestions: IntentQuestion[]
    intentAnswers: Record<string, string>
    messages: GerritMessage[]
    currentPlan: GerritPlan | null
    errorMessage: string | null
    /** Timestamp of last read/write — used for LRU pruning */
    lastAccessed: number
}

const MAX_SESSIONS = 20

function pruneSessions(
    sessions: Record<string, PersistedSession>,
): Record<string, PersistedSession> {
    const entries = Object.entries(sessions)
    if (entries.length <= MAX_SESSIONS) return sessions
    entries.sort(([, a], [, b]) => b.lastAccessed - a.lastAccessed)
    return Object.fromEntries(entries.slice(0, MAX_SESSIONS))
}

// ─── Active-session fields (flat mirror on store root) ───────────────────────

interface ActiveSessionFields {
    sessionId: string | null
    farmId: string | null
    calendar: string | null
    phase: GerritPhase
    intentQuestions: IntentQuestion[]
    intentAnswers: Record<string, string>
    messages: GerritMessage[]
    currentPlan: GerritPlan | null
    errorMessage: string | null
}

const IDLE_ACTIVE: ActiveSessionFields = {
    sessionId: null,
    farmId: null,
    calendar: null,
    phase: "idle",
    intentQuestions: [],
    intentAnswers: {},
    messages: [],
    currentPlan: null,
    errorMessage: null,
}

/** Snapshot of active session fields suitable for writing to the sessions map. */
function buildSnapshot(
    state: ActiveSessionFields,
    overrides: Partial<ActiveSessionFields> = {},
): PersistedSession {
    const m = { ...state, ...overrides }
    return {
        sessionId: m.sessionId ?? "",
        farmId: m.farmId ?? "",
        calendar: m.calendar ?? "",
        // Never persist mid-flight phases — restore as idle
        phase:
            m.phase === "generating" || m.phase === "loading_intent"
                ? "idle"
                : m.phase,
        intentQuestions: m.intentQuestions,
        intentAnswers: m.intentAnswers,
        messages: m.messages,
        currentPlan: m.currentPlan,
        errorMessage: m.errorMessage,
        lastAccessed: Date.now(),
    }
}

/** Produces a partial store update that sets fields AND syncs to sessions map. */
function withSync(
    updates: Partial<ActiveSessionFields>,
): (state: GerritSessionsStore) => Partial<GerritSessionsStore> {
    return (state) => {
        if (!state.activeKey) return updates
        return {
            ...updates,
            sessions: pruneSessions({
                ...state.sessions,
                [state.activeKey]: buildSnapshot(state, updates),
            }),
        }
    }
}

// ─── Store interface ─────────────────────────────────────────────────────────

interface GerritSessionsStore extends ActiveSessionFields {
    /** All stored sessions — the only field persisted to localStorage */
    sessions: Record<string, PersistedSession>

    /** Key of the currently active session (runtime only, not persisted) */
    activeKey: string | null

    /** Transient thinking steps — not persisted */
    thinkingSteps: ThinkingStep[]

    /**
     * Activates the session for this farm+calendar.
     * Returns `{ hadMeaningfulState: true }` when an existing session with a
     * plan, messages, or non-idle phase was found — signals that no auto-start
     * is needed. Returns `false` when no session exists (first visit).
     */
    loadSession(
        farmId: string,
        calendar: string,
    ): { hadMeaningfulState: boolean }

    /** Creates a fresh session for this farm+calendar (discards any existing). */
    startNewSession(farmId: string, calendar: string): void

    /** @deprecated Use startNewSession */
    startSession(farmId: string, calendar: string): void

    setPhase(phase: GerritPhase): void
    setIntentQuestions(questions: IntentQuestion[]): void
    setIntentAnswer(questionId: string, value: string): void
    addThinkingStep(step: ThinkingStep): void
    clearThinkingSteps(): void
    setPlan(plan: GerritPlan): void
    addMessage(msg: Omit<GerritMessage, "timestamp">): void
    updateLastAssistantMessage(content: string): void
    setError(message: string): void
    /** Clears the active session and removes it from the sessions map. */
    resetSession(): void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useGerritSession = create<GerritSessionsStore>()(
    persist(
        (set, get) => ({
            // Persisted
            sessions: {},

            // Runtime only
            activeKey: null,
            thinkingSteps: [],

            // Active session mirror (populated by loadSession)
            ...IDLE_ACTIVE,

            loadSession: (farmId, calendar) => {
                const key = makeGerritSessionKey(farmId, calendar)
                const { sessions } = get()
                const existing = sessions[key]

                if (existing) {
                    const restoredPhase =
                        existing.phase === "generating" ||
                        existing.phase === "loading_intent"
                            ? "idle"
                            : existing.phase

                    set({
                        activeKey: key,
                        sessionId: existing.sessionId,
                        farmId: existing.farmId,
                        calendar: existing.calendar,
                        phase: restoredPhase,
                        intentQuestions: existing.intentQuestions,
                        intentAnswers: existing.intentAnswers,
                        thinkingSteps: [],
                        messages: existing.messages,
                        currentPlan: existing.currentPlan,
                        errorMessage: existing.errorMessage,
                        sessions: {
                            ...sessions,
                            [key]: { ...existing, lastAccessed: Date.now() },
                        },
                    })

                    const hadMeaningfulState =
                        restoredPhase !== "idle" ||
                        !!existing.currentPlan ||
                        existing.messages.length > 0 ||
                        existing.intentQuestions.length > 0

                    return { hadMeaningfulState }
                }

                // No stored session — start idle
                set({
                    activeKey: key,
                    ...IDLE_ACTIVE,
                    farmId,
                    calendar,
                    thinkingSteps: [],
                })
                return { hadMeaningfulState: false }
            },

            startNewSession: (farmId, calendar) => {
                const key = makeGerritSessionKey(farmId, calendar)
                const newSessionId = `gerrit-${farmId}-${calendar}-${Date.now()}`
                set((state) => ({
                    activeKey: key,
                    sessionId: newSessionId,
                    farmId,
                    calendar,
                    phase: "loading_intent",
                    intentQuestions: [],
                    intentAnswers: {},
                    thinkingSteps: [],
                    messages: [],
                    currentPlan: null,
                    errorMessage: null,
                    sessions: pruneSessions({
                        ...state.sessions,
                        [key]: {
                            sessionId: newSessionId,
                            farmId,
                            calendar,
                            phase: "idle",
                            intentQuestions: [],
                            intentAnswers: {},
                            messages: [],
                            currentPlan: null,
                            errorMessage: null,
                            lastAccessed: Date.now(),
                        },
                    }),
                }))
            },

            startSession: (farmId, calendar) =>
                get().startNewSession(farmId, calendar),

            setPhase: (phase) => set(withSync({ phase })),

            setIntentQuestions: (intentQuestions) =>
                set(withSync({ intentQuestions, phase: "intent" })),

            setIntentAnswer: (questionId, value) =>
                set((state) => {
                    const intentAnswers = {
                        ...state.intentAnswers,
                        [questionId]: value,
                    }
                    return withSync({ intentAnswers })(state)
                }),

            addThinkingStep: (step) =>
                set((state) => ({
                    thinkingSteps: [...state.thinkingSteps, step],
                })),

            clearThinkingSteps: () => set({ thinkingSteps: [] }),

            setPlan: (currentPlan) =>
                set(
                    withSync({
                        currentPlan,
                        phase: "plan_ready",
                        errorMessage: null,
                    }),
                ),

            addMessage: (msg) =>
                set((state) => {
                    const messages = [
                        ...state.messages,
                        { ...msg, timestamp: Date.now() },
                    ]
                    return withSync({ messages, phase: "follow_up" })(state)
                }),

            updateLastAssistantMessage: (content) =>
                set((state) => {
                    const messages = [...state.messages]
                    const lastIdx = messages.length - 1
                    if (
                        lastIdx >= 0 &&
                        messages[lastIdx].role === "assistant"
                    ) {
                        messages[lastIdx] = { ...messages[lastIdx], content }
                    } else {
                        messages.push({
                            role: "assistant",
                            content,
                            type: "follow_up",
                            timestamp: Date.now(),
                        })
                    }
                    return withSync({ messages })(state)
                }),

            setError: (errorMessage) =>
                set(withSync({ errorMessage, phase: "idle" })),

            resetSession: () => {
                const { activeKey } = get()
                set((state) => {
                    const sessions = { ...state.sessions }
                    if (activeKey) delete sessions[activeKey]
                    return {
                        sessions,
                        activeKey,
                        ...IDLE_ACTIVE,
                        thinkingSteps: [],
                    }
                })
            },
        }),
        {
            name: "gerrit-sessions",
            storage: createJSONStorage(() => ssrSafeJSONStorage),
            // Only persist the sessions map — flat active state is repopulated
            // by loadSession() on every route mount.
            partialize: (state) => ({ sessions: state.sessions }),
        },
    ),
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
            parts.push(`${q.question} → ${answer}`)
        } else if (option) {
            parts.push(`${q.question} → ${option.label}`)
        }
    }
    return parts.join(". ")
}


