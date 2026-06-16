import {
    Bot,
    Check,
    ChevronDown,
    Circle,
    Sparkles,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { Progress } from "~/components/ui/progress"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

interface StreamEvent {
    type: string
    data: any
}

type PhaseStatus = "pending" | "active" | "done"

/**
 * Ordered phases that describe what Gerrit does. Each phase is tied to one or
 * more agent tools; its state is derived from the live tool events. Phases
 * without tools (connect/finalize) are driven by surrounding progress signals.
 */
const PHASES: { id: string; label: string; tools: string[] }[] = [
    { id: "connect", label: "Gegevens verzamelen", tools: ["getFarmFields"] },
    { id: "guide", label: "Teelthandleiding raadplegen", tools: ["getCropFertilizerGuide"] },
    { id: "advice", label: "Bemestingsadvies ophalen", tools: ["getFarmNutrientAdvice"] },
    { id: "norms", label: "Wettelijke normen berekenen", tools: ["getFarmLegalNorms"] },
    { id: "fertilizers", label: "Meststoffen zoeken", tools: ["searchFertilizers"] },
    { id: "simulate", label: "Plan doorrekenen", tools: ["simulateFarmPlan"] },
    { id: "finalize", label: "Plan afronden", tools: [] },
]

interface ToolStep {
    status: "running" | "done"
    count: number
}

interface DerivedState {
    steps: Map<string, ToolStep>
    reasoning: string
    statusMessage: string | null
    hasStarted: boolean
    finalizing: boolean
}

function deriveState(events: StreamEvent[]): DerivedState {
    const steps = new Map<string, ToolStep>()
    let reasoning = ""
    let statusMessage: string | null = null
    let hasStarted = false
    let finalizing = false

    for (const event of events) {
        if (event.type === "on_tool_start") {
            const name = event.data?.name
            if (!name) continue
            hasStarted = true
            const existing = steps.get(name)
            if (existing) {
                existing.count += 1
                existing.status = "running"
            } else {
                steps.set(name, { status: "running", count: 1 })
            }
        } else if (event.type === "on_tool_end") {
            const name = event.data?.name
            if (!name) continue
            const existing = steps.get(name)
            if (existing) existing.status = "done"
        } else if (event.type === "reasoning") {
            reasoning += event.data?.chunk ?? ""
        } else if (event.type === "status" || event.type === "start") {
            statusMessage = event.data?.message ?? statusMessage
            hasStarted = true
            if (event.data?.phase === "finalize") finalizing = true
        }
    }

    return { steps, reasoning, statusMessage, hasStarted, finalizing }
}

function phaseCount(
    phase: { tools: string[] },
    derived: DerivedState,
): number {
    let count = 0
    for (const tool of phase.tools) {
        const step = derived.steps.get(tool)
        if (step) count += step.count
    }
    return count
}

/**
 * Computes monotonic phase statuses from the live events. Progress only ever
 * moves forward: a phase is `done` once a later phase has begun (or once the
 * server signals finalization), the single furthest-reached phase is `active`
 * (it stays active during inter-tool "thinking" gaps so the UI never flickers
 * back to "Plan afronden"), and the rest are `pending`. The `finalize` phase
 * activates only on the explicit server `phase: "finalize"` signal.
 */
function computePhases(
    derived: DerivedState,
): { id: string; label: string; status: PhaseStatus; count: number }[] {
    // Tool-bearing phases are indices 1..(PHASES.length - 2); index 0 is the
    // connect phase and the last index is finalize.
    const lastToolIndex = PHASES.length - 2

    let reachedIndex = -1
    for (let i = 1; i <= lastToolIndex; i++) {
        const reached = PHASES[i].tools.some((t) => derived.steps.has(t))
        if (reached) reachedIndex = i
    }

    return PHASES.map((phase, index) => {
        const count = phaseCount(phase, derived)

        // Connect phase.
        if (index === 0) {
            if (derived.finalizing || reachedIndex >= 1) {
                return { ...phase, status: "done" as PhaseStatus, count }
            }
            if (derived.hasStarted) {
                return { ...phase, status: "active" as PhaseStatus, count }
            }
            return { ...phase, status: "pending" as PhaseStatus, count }
        }

        // Finalize phase (last).
        if (index === PHASES.length - 1) {
            return {
                ...phase,
                status: (derived.finalizing
                    ? "active"
                    : "pending") as PhaseStatus,
                count,
            }
        }

        // Tool phases: active only while the tool is actually running. During
        // the "thinking" gap after a tool ends (before the next one starts) the
        // phase shows as done and a separate "denkt na" indicator conveys that
        // Gerrit is reasoning — so a long wait never looks like a hung tool.
        if (derived.finalizing || index < reachedIndex) {
            return { ...phase, status: "done" as PhaseStatus, count }
        }
        if (index === reachedIndex) {
            const running = phase.tools.some(
                (t) => derived.steps.get(t)?.status === "running",
            )
            return {
                ...phase,
                status: (running ? "active" : "done") as PhaseStatus,
                count,
            }
        }
        return { ...phase, status: "pending" as PhaseStatus, count }
    })
}

export function GerritLoading({ events = [] }: { events?: StreamEvent[] }) {
    const [elapsed, setElapsed] = useState(0)
    const [reasoningOpen, setReasoningOpen] = useState(false)
    const startRef = useRef(Date.now())
    const reasoningRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const id = setInterval(
            () =>
                setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
            1000,
        )
        return () => clearInterval(id)
    }, [])

    const derived = useMemo(() => deriveState(events), [events])

    // Auto-scroll the reasoning feed when it's open and growing.
    useEffect(() => {
        if (reasoningOpen && reasoningRef.current) {
            reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight
        }
    }, [derived.reasoning, reasoningOpen])

    const phases = useMemo(() => computePhases(derived), [derived])

    const doneCount = phases.filter((p) => p.status === "done").length
    const progressValue = Math.round((doneCount / phases.length) * 100)

    const anyToolRunning = [...derived.steps.values()].some(
        (s) => s.status === "running",
    )
    // Gerrit is "thinking" when at least one tool has run, none is currently
    // running, and we are not yet finalizing — i.e. an inter-tool reasoning gap.
    const isThinking =
        derived.hasStarted &&
        !anyToolRunning &&
        !derived.finalizing &&
        derived.steps.size > 0

    const elapsedStr =
        elapsed >= 60
            ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
            : `${elapsed}s`

    const reasoningPreview = derived.reasoning
        .trim()
        .split("\n")
        .map((l) => l.replace(/[*#`]/g, "").trim())
        .filter(Boolean)
        .pop()

    return (
        <Card className="shadow-sm flex flex-col">
            <CardHeader className="border-b shrink-0">
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                    <span className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary animate-pulse" />
                        Gerrit is aan het werk…
                    </span>
                    <span className="text-sm font-normal tabular-nums text-muted-foreground">
                        {elapsedStr}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {/* Overall progress */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                            {derived.statusMessage ?? "Voorbereiden…"}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                            {doneCount}/{phases.length}
                        </span>
                    </div>
                    <Progress value={progressValue} />
                </div>

                {/* Phase checklist */}
                <ol className="space-y-1" aria-live="polite">
                    {phases.map((phase) => (
                        <li
                            key={phase.id}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                                phase.status === "active" && "bg-primary/5",
                            )}
                        >
                            <span className="shrink-0">
                                {phase.status === "done" ? (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                                        <Check className="h-3.5 w-3.5 text-green-600" />
                                    </span>
                                ) : phase.status === "active" ? (
                                    <Spinner className="h-5 w-5 text-primary" />
                                ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground/30" />
                                )}
                            </span>
                            <span
                                className={cn(
                                    "flex-1",
                                    phase.status === "done" &&
                                        "text-muted-foreground",
                                    phase.status === "active" &&
                                        "font-medium text-foreground",
                                    phase.status === "pending" &&
                                        "text-muted-foreground/60",
                                )}
                            >
                                {phase.label}
                            </span>
                            {phase.count > 1 && (
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                                    ×{phase.count}
                                </span>
                            )}
                        </li>
                    ))}
                </ol>

                {/* Reasoning (Gerrit's thinking) — collapsed by default. While
                    Gerrit reasons between tools the trigger turns into a pulsing
                    "denkt na" indicator + live preview, doubling as the obvious
                    click target to reveal the full thoughts. */}
                {derived.reasoning.trim() && (
                    <Collapsible
                        open={reasoningOpen}
                        onOpenChange={setReasoningOpen}
                        className={cn(
                            "rounded-md border bg-muted/30",
                            isThinking && "border-primary/40 bg-primary/5",
                        )}
                    >
                        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors rounded-md">
                            <Sparkles
                                className={cn(
                                    "h-4 w-4 shrink-0 text-primary",
                                    isThinking && "animate-pulse",
                                )}
                            />
                            <span className="font-medium text-foreground shrink-0">
                                {isThinking
                                    ? "Gerrit denkt na over de resultaten…"
                                    : "Gerrit's overwegingen"}
                            </span>
                            {!reasoningOpen && reasoningPreview && (
                                <span className="flex-1 truncate text-muted-foreground/80 italic">
                                    {reasoningPreview}
                                </span>
                            )}
                            <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-primary">
                                {reasoningOpen ? "Verbergen" : "Bekijken"}
                                <ChevronDown
                                    className={cn(
                                        "h-4 w-4 transition-transform",
                                        reasoningOpen && "rotate-180",
                                    )}
                                />
                            </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div
                                ref={reasoningRef}
                                className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t px-3 py-2 text-sm leading-relaxed text-muted-foreground"
                            >
                                {derived.reasoning.trim()}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </CardContent>
        </Card>
    )
}
