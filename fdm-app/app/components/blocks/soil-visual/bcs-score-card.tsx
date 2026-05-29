import { BCS_INDICATORS, type BcsScores, SCORE_BAR_CLASSES, SCORE_BG_CLASSES, SCORE_TEXT_CLASSES, type BcsColor } from "~/components/blocks/soil-visual/bcs-color-utils"
import { cn } from "~/lib/utils"

interface BcsScoreCardProps {
    scores: BcsScores
    /** Pre-computed D_BCS score (server-side) */
    d_bcs: number
    /** Pre-computed I_BCS indicator (0-1) */
    i_bcs: number
    /** Pre-computed color band */
    scoreColor: BcsColor
    /** Pre-computed label (e.g., "Goed") */
    scoreLabel: string
    className?: string
}

/**
 * Displays the BCS score breakdown with indicator contributions and an overall gauge.
 * All calculation is done server-side; this component only renders.
 */
export function BcsScoreCard({ scores, d_bcs, i_bcs, scoreColor, scoreLabel, className }: BcsScoreCardProps) {
    const d_bcs_max = 40

    return (
        <div className={cn("rounded-lg border p-4 space-y-4", className)}>
            {/* Overall score header */}
            <div className={cn("rounded-md p-3 flex items-center justify-between", SCORE_BG_CLASSES[scoreColor])}>
                <div>
                    <p className="text-xs font-medium text-muted-foreground">BCS Score</p>
                    <p className={cn("text-3xl font-bold", SCORE_TEXT_CLASSES[scoreColor])}>
                        {d_bcs.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        van max {d_bcs_max}
                    </p>
                </div>
                <div className="text-right">
                    <p className={cn("text-lg font-semibold", SCORE_TEXT_CLASSES[scoreColor])}>{scoreLabel}</p>
                    <p className="text-xs text-muted-foreground">
                        {(i_bcs * 100).toFixed(0)}%
                    </p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-500", SCORE_BAR_CLASSES[scoreColor])}
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
            </div>
        </div>
    )
}
