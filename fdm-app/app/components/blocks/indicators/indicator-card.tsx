/**
 * Expandable indicator card for the field-level indicator detail page.
 *
 * Collapsed (default): shows indicator name, category badge, status/target
 * values, a stacked progress bar (field state + measures contribution), and
 * the verdict badge.
 *
 * Expanded (on click): reveals the full indicator description, a list of
 * active measures on this field, and a link to the Maatregelen page.
 */
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { cn } from "~/lib/utils"
import {
    getScoreColor,
    getScoreTier,
    scoreToDisplay,
    type FieldMeasure,
    type IndicatorInfo,
} from "~/lib/indicators"
import { ScoreBadge } from "./score-badge"
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"

type IndicatorCardProps = {
    info: IndicatorInfo
    result: Bln3IndicatorResult
    /** All measures active on this field */
    fieldMeasures: FieldMeasure[]
    /** Link to the Maatregelen page for this field */
    measuresHref: string
    /** When true, display index instead of score */
    showIndex: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
    Gewasproductie: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    Koolstofvastlegging: "bg-stone-100 text-stone-700 dark:bg-stone-950/30 dark:text-stone-400",
    Waterkwaliteit: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    "Nutriëntenkringloop": "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
}

function StackedScoreBar({
    indexValue,
    impactValue,
    indexColor,
}: {
    indexValue: number
    impactValue: number
    indexColor: string
}) {
    const indexWidth = Math.max(0, Math.min(indexValue, 100))
    const impactWidth = Math.max(0, Math.min(impactValue, 100 - indexWidth))
    return (
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/10">
            <div
                className="absolute left-0 top-0 h-full rounded-l-full transition-all duration-500"
                style={{ width: `${indexWidth}%`, backgroundColor: indexColor }}
            />
            {impactWidth > 0 && (
                <div
                    className="absolute top-0 h-full bg-green-500/60 transition-all duration-500"
                    style={{
                        left: `${indexWidth}%`,
                        width: `${impactWidth}%`,
                    }}
                />
            )}
        </div>
    )
}

export function IndicatorCard({
    info,
    result,
    fieldMeasures,
    measuresHref,
    showIndex,
}: IndicatorCardProps) {
    const [expanded, setExpanded] = useState(false)

    const indexDisplay = scoreToDisplay(result.index)
    const scoreDisplay = scoreToDisplay(result.score)
    const activeDisplay = showIndex ? indexDisplay : scoreDisplay
    const color = getScoreColor(activeDisplay)
    const tier = getScoreTier(activeDisplay)
    const indexColor = getScoreColor(indexDisplay)

    const impactDisplay = scoreToDisplay(result.impact)
    const hasImpact = impactDisplay > 0

    return (
        <div
            className={cn(
                "border rounded-lg overflow-hidden transition-shadow",
                tier === "red" && "border-red-200 dark:border-red-900/40",
                tier === "yellow" && "border-yellow-200 dark:border-yellow-900/40",
                tier === "green" && "border-green-200 dark:border-green-900/40",
            )}
        >
            {/* Card header — always visible, clickable to expand */}
            <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
            >
                <div className="flex items-start gap-3">
                    {/* Score circle + impact pill */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                        <div
                            className="w-11 h-11 rounded-full flex flex-col items-center justify-center text-white font-bold text-sm leading-tight"
                            style={{ backgroundColor: color }}
                        >
                            <span>{activeDisplay}</span>
                        </div>
                        {!showIndex && hasImpact && (
                            <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 leading-none">
                                +{impactDisplay}
                            </span>
                        )}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{info.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">{info.id}</span>
                            <span
                                className={cn(
                                    "text-[10px] font-medium rounded-full px-2 py-0.5",
                                    CATEGORY_COLORS[info.ecosysteemdienst] ??
                                        "bg-muted text-muted-foreground",
                                )}
                            >
                                {info.ecosysteemdienst}
                            </span>
                        </div>

                        {/* Status & target */}
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Status{" "}
                            <span className="font-medium text-foreground">
                                {result.status.toFixed(2)}
                            </span>
                            {"  "}· Doel{" "}
                            <span className="font-medium text-foreground">
                                {result.target.toFixed(2)}
                            </span>
                            {!showIndex && hasImpact && (
                                <>
                                    {"  "}· Impact{" "}
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                        +{impactDisplay}
                                    </span>
                                </>
                            )}
                        </p>

                        {/* Stacked score bar */}
                        <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <StackedScoreBar
                                        indexValue={indexDisplay}
                                        impactValue={showIndex ? 0 : impactDisplay}
                                        indexColor={indexColor}
                                    />
                                </div>
                                <span className="text-[10px] tabular-nums w-6 text-right font-medium">
                                    {activeDisplay}
                                </span>
                            </div>
                            {/* Legend: only shown when measures are visible and there is impact */}
                            {!showIndex && hasImpact && (
                                <div className="flex gap-3 text-[9px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <span
                                            className="inline-block w-2 h-1.5 rounded-sm"
                                            style={{ backgroundColor: indexColor }}
                                        />
                                        Perceel: {indexDisplay}
                                    </span>
                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <span className="inline-block w-2 h-1.5 rounded-sm bg-green-500 opacity-60" />
                                        Maatregelen: +{impactDisplay}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right side: verdict + chevron */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <ScoreBadge score={activeDisplay} />
                        {expanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground mt-1" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />
                        )}
                    </div>
                </div>
            </button>

            {/* Expanded detail panel */}
            {expanded && (
                <div className="border-t bg-muted/20 px-4 py-3 space-y-4 text-sm">
                    {/* Description */}
                    {info.description && (
                        <div>
                            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                Beschrijving
                            </p>
                            <p className="text-sm text-foreground">{info.description}</p>
                        </div>
                    )}

                    {/* Active measures with impact on this indicator */}
                    {hasImpact && fieldMeasures.length > 0 && (
                        <div>
                            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                                Maatregelen met bijdrage aan deze indicator
                            </p>
                            <ul className="space-y-1">
                                {fieldMeasures.map((measure) => (
                                    <li
                                        key={measure.b_id_measure}
                                        className="flex items-start gap-2 text-xs"
                                    >
                                        <span className="shrink-0 font-mono text-muted-foreground">
                                            {measure.m_id.replace("bln_", "")}
                                        </span>
                                        <span className="text-foreground">
                                            {measure.m_name}
                                        </span>
                                        {measure.m_end === null && (
                                            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                                                doorlopend
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Link to measures page */}
                    <Link
                        to={measuresHref}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Maatregelen beheren
                    </Link>
                </div>
            )}
        </div>
    )
}

