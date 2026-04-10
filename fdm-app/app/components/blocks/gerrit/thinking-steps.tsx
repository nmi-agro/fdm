import type { ThinkingStep } from "@nmi-agro/fdm-agents"
import { Bot, CheckCircle2, Circle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

interface ThinkingStepsProps {
    steps: ThinkingStep[]
    isGenerating: boolean
    elapsed: number
}

export function ThinkingSteps({ steps, isGenerating, elapsed }: ThinkingStepsProps) {
    const elapsedStr =
        elapsed >= 60
            ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
            : `${elapsed}s`

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
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
            <CardContent>
                <ol
                    role="status"
                    aria-live="polite"
                    aria-busy={isGenerating}
                    className="space-y-2"
                >
                    {steps.length === 0 && (
                        <li className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                            <span>Plan wordt opgestart…</span>
                        </li>
                    )}
                    {steps.map((step, i) => {
                        const isLast = i === steps.length - 1
                        const isDone = !isLast || !isGenerating

                        return (
                            <li
                                key={`${step.tool}-${step.iteration}-${i}`}
                                className="flex items-start gap-3 text-sm"
                            >
                                {isDone ? (
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                                ) : (
                                    <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-primary" />
                                )}
                                <span
                                    className={
                                        isDone
                                            ? "text-muted-foreground"
                                            : "text-foreground font-medium"
                                    }
                                >
                                    {step.description}
                                    {step.iteration > 1 && (
                                        <span className="ml-1.5 text-xs text-muted-foreground">
                                            (iteratie {step.iteration})
                                        </span>
                                    )}
                                </span>
                            </li>
                        )
                    })}
                    {isGenerating && steps.length > 0 && (
                        <li className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                            <span>Bezig…</span>
                        </li>
                    )}
                </ol>
            </CardContent>
        </Card>
    )
}
