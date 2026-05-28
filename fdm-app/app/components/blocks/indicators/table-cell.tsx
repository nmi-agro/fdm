import { memo } from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import type { IndicatorInfo } from "~/lib/indicators"
import {
    getScoreColor,
    getScoreVerdict,
    scoreToDisplay,
} from "~/lib/indicators"

type HeatmapCellProps = {
    indicator: IndicatorInfo
    /** Score on a 0–1 scale (null = no data). */
    score01: number | null
    /** Index (without measures) on a 0–1 scale. */
    index01: number | null
    /** Whether to show index instead of score. */
    showIndex: boolean
}

/**
 * A single heatmap cell showing a colour-coded circle with a score.
 *
 * - Coloured circle: green ≥70, yellow 40–69, red <40 (on 0–100 scale)
 * - Tooltip: indicator name + Dutch verdict
 * - Optional delta badge when measures have significant impact
 * - Grey when no data
 */
export const HeatmapCell = memo(function HeatmapCell({
    indicator,
    score01,
    index01,
    showIndex,
}: HeatmapCellProps) {
    const active01 = showIndex ? (index01 ?? score01) : score01
    const display = active01 !== null ? scoreToDisplay(active01) : null
    const color = display !== null ? getScoreColor(display) : null
    const verdict = display !== null ? getScoreVerdict(display) : null

    // Delta badge: show when measures improve this indicator by >5 points
    const hasMeaningfulDelta =
        !showIndex &&
        score01 !== null &&
        index01 !== null &&
        scoreToDisplay(score01) - scoreToDisplay(index01) >= 5
    const delta =
        hasMeaningfulDelta && score01 !== null && index01 !== null
            ? scoreToDisplay(score01) - scoreToDisplay(index01)
            : null

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="relative flex items-center justify-center">
                    {/* Coloured score circle */}
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                        style={{
                            backgroundColor: color ?? "#e5e7eb",
                            color: color ? "white" : "#6b7280",
                        }}
                    >
                        {display !== null ? display : "—"}
                    </div>

                    {/* Delta badge (top-right corner) */}
                    {delta !== null && (
                        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[9px] font-bold rounded-full px-1 leading-tight">
                            +{delta}
                        </span>
                    )}
                </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-center">
                <p className="font-semibold">{indicator.name}</p>
                {verdict ? (
                    <p>
                        {verdict} ({display}/100)
                    </p>
                ) : (
                    <p>Geen bodemanalyse beschikbaar</p>
                )}
            </TooltipContent>
        </Tooltip>
    )
})
