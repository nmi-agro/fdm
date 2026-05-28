import { BCS_INDICATORS, getBcsScoreColor, type BcsScores } from "~/lib/bcs-calculation"
import { calculateBcs } from "~/lib/bcs-calculation"
import { cn } from "~/lib/utils"

interface BcsScoreCardProps {
    scores: BcsScores
    className?: string
}

/**
 * Displays the BCS score breakdown with indicator contributions and an overall gauge.
 */
export function BcsScoreCard({ scores, className }: BcsScoreCardProps) {
    const { d_bcs, i_bcs, d_bcs_max, includes_lab_scores } = calculateBcs(scores)
    const color = getBcsScoreColor(i_bcs)

    const colorClasses = {
        red: "text-destructive",
        orange: "text-orange-500",
        green: "text-green-600",
    }

    const bgClasses = {
        red: "bg-destructive/10",
        orange: "bg-orange-50",
        green: "bg-green-50",
    }

    const barClasses = {
        red: "bg-destructive",
        orange: "bg-orange-500",
        green: "bg-green-600",
    }

    return (
        <div className={cn("rounded-lg border p-4 space-y-4", className)}>
            {/* Overall score header */}
            <div className={cn("rounded-md p-3 flex items-center justify-between", bgClasses[color])}>
                <div>
                    <p className="text-xs font-medium text-muted-foreground">BCS Score</p>
                    <p className={cn("text-3xl font-bold", colorClasses[color])}>
                        {d_bcs.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        van max {d_bcs_max}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-medium text-muted-foreground">Indicator</p>
                    <p className={cn("text-3xl font-bold", colorClasses[color])}>
                        {(i_bcs * 100).toFixed(0)}
                        <span className="text-base font-normal">%</span>
                    </p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-500", barClasses[color])}
                    style={{ width: `${Math.min(i_bcs * 100, 100)}%` }}
                />
            </div>

            {/* Indicator breakdown */}
            <div className="space-y-2">
                {BCS_INDICATORS.map((indicator) => {
                    const score = scores[indicator.key]
                    const hasScore = score != null
                    const contribution = hasScore
                        ? indicator.direction === "positive"
                            ? indicator.weight * score
                            : -(indicator.weight * score)
                        : 0

                    return (
                        <div key={indicator.key} className="flex items-center gap-2 text-sm">
                            <span className="w-4 text-center text-muted-foreground">
                                {indicator.direction === "negative" ? "−" : "+"}
                            </span>
                            <span className="flex-1 truncate text-muted-foreground">
                                {indicator.name}
                            </span>
                            <span className="w-6 text-center font-medium">
                                {hasScore ? score : "—"}
                            </span>
                            <span
                                className={cn(
                                    "w-8 text-right text-xs tabular-nums",
                                    contribution > 0
                                        ? "text-green-600"
                                        : contribution < 0
                                          ? "text-destructive"
                                          : "text-muted-foreground",
                                )}
                            >
                                {hasScore
                                    ? (contribution > 0 ? "+" : "") + contribution.toFixed(0)
                                    : ""}
                            </span>
                        </div>
                    )
                })}

                {/* Derived lab scores */}
                {(scores.bcs_ph != null || scores.bcs_om != null) && (
                    <>
                        <div className="border-t pt-2 mt-1">
                            <p className="text-xs text-muted-foreground mb-1">Afgeleid van laboratoriumanalyse:</p>
                        </div>
                        {scores.bcs_ph != null && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="w-4 text-center text-muted-foreground">+</span>
                                <span className="flex-1 truncate text-muted-foreground italic">pH (afgeleid)</span>
                                <span className="w-6 text-center font-medium">{scores.bcs_ph}</span>
                                <span className="w-8 text-right text-xs tabular-nums text-green-600">
                                    +{(3 * scores.bcs_ph).toFixed(0)}
                                </span>
                            </div>
                        )}
                        {scores.bcs_om != null && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="w-4 text-center text-muted-foreground">+</span>
                                <span className="flex-1 truncate text-muted-foreground italic">Org. stof (afgeleid)</span>
                                <span className="w-6 text-center font-medium">{scores.bcs_om}</span>
                                <span className="w-8 text-right text-xs tabular-nums text-green-600">
                                    +{(3 * scores.bcs_om).toFixed(0)}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {!includes_lab_scores && (
                <p className="text-xs text-muted-foreground">
                    Koppel een laboratoriumanalyse om de pH- en OS-scores automatisch mee te rekenen.
                </p>
            )}
        </div>
    )
}
