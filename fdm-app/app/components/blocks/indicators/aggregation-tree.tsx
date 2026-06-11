import { useState } from "react"
import { ChevronDown, ChevronRight, Info } from "lucide-react"
import { cn } from "~/lib/utils"
import {
    type AggregationId,
    getAggregationInfo,
    getChildren,
    getIndicatorIdsForAggregation,
    getAggregationIdsForIndicator,
} from "~/lib/aggregations"
import {
    getScoreColor,
    getScoreTier,
    getScoreVerdict,
    scoreToDisplay,
    getIndicatorInfo,
} from "~/lib/indicators"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"

type AggregationTreeProps = {
    /** Accessor to get aggregation score (0-1) */
    scoreOf: (id: AggregationId) => number | null
    /** Accessor to get indicator score (0-1) */
    indicatorScoreOf?: (id: string) => number | null
    /** Optional callback when an indicator is clicked */
    onIndicatorClick?: (id: string) => void
    /** Currently active category filters to highlight nodes */
    activeCategories?: string[]
}

export function AggregationTree({
    scoreOf,
    indicatorScoreOf,
    onIndicatorClick,
}: AggregationTreeProps) {
    // Keep track of expanded state for branches and leaves
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        S_BLN: true,
        S_WAT_BLN: true,
        S_PROD_BLN: true,
    })

    const toggleNode = (id: string) => {
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    const renderScoreBar = (score100: number, color: string) => {
        return (
            <div className="relative h-2 w-24 sm:w-32 overflow-hidden rounded-full bg-muted shrink-0">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${score100}%`,
                        backgroundColor: color,
                    }}
                />
            </div>
        )
    }

    const renderNode = (id: AggregationId, depth: number = 0) => {
        const info = getAggregationInfo(id)
        const scoreVal = scoreOf(id)
        const displayScore = scoreVal !== null ? scoreToDisplay(scoreVal) : null
        const color =
            displayScore !== null ? getScoreColor(displayScore) : "#d1d5db"
        const tier = displayScore !== null ? getScoreTier(displayScore) : null
        const children = getChildren(id)
        const hasChildren = children.length > 0
        const isExpanded = !!expanded[id]

        // If it's not a top-level or root, it's an end-leaf (or nutrient/climate which act as direct leaves)
        const isLeaf = !hasChildren && id !== "S_BLN"

        // Indicators for this leaf node (only rendered if expanded and accessor provided)
        const indicatorIds = isLeaf ? getIndicatorIdsForAggregation(id) : []
        const hasIndicators = indicatorIds.length > 0 && !!indicatorScoreOf

        return (
            <div key={id} className="space-y-1">
                {/* Node row */}
                <div
                    className={cn(
                        "flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors",
                        depth === 0 &&
                            "bg-card border-emerald-500/30 shadow-sm font-bold text-base",
                        depth === 1 &&
                            "bg-muted/30 border-border hover:bg-muted/50 font-semibold text-sm",
                        depth === 2 && "bg-card hover:bg-muted/20 text-xs",
                    )}
                    style={{
                        paddingLeft: `${Math.max(10, depth * 16 + 10)}px`,
                    }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Expand/Collapse Chevron for branches and leaves with indicators */}
                        {hasChildren || hasIndicators ? (
                            <button
                                onClick={() => toggleNode(id)}
                                className="p-0.5 hover:bg-muted rounded text-muted-foreground shrink-0"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </button>
                        ) : (
                            <div className="w-5 shrink-0" />
                        )}

                        <span
                            className="truncate text-foreground"
                            title={info.name}
                        >
                            {info.name}
                        </span>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent
                                    side="top"
                                    className="max-w-[280px] p-2 text-xs"
                                >
                                    <p className="font-semibold text-foreground mb-1">
                                        {info.name}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {info.description}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {/* Score and status info */}
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                        {displayScore !== null ? (
                            <>
                                <span className="font-bold tabular-nums w-6 text-right">
                                    {displayScore}
                                </span>
                                {renderScoreBar(displayScore, color)}
                                <span
                                    className={cn(
                                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none text-white",
                                        tier === "green" && "bg-green-600",
                                        tier === "yellow" && "bg-yellow-500",
                                        tier === "red" && "bg-red-600",
                                    )}
                                >
                                    {getScoreVerdict(displayScore)}
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground italic">
                                geen data
                            </span>
                        )}
                    </div>
                </div>

                {/* Render children or indicators if expanded */}
                {isExpanded && (
                    <div className="space-y-1">
                        {/* Render child aggregations */}
                        {hasChildren &&
                            children.map((childId) =>
                                renderNode(childId, depth + 1),
                            )}

                        {/* Render impacting indicators */}
                        {hasIndicators && isExpanded && (
                            <div className="space-y-1 pl-4">
                                {indicatorIds.map((indId) => {
                                    const indInfo = getIndicatorInfo(indId)
                                    if (!indInfo) return null
                                    const indScoreVal = indicatorScoreOf(indId)
                                    const indDisplay =
                                        indScoreVal !== null
                                            ? scoreToDisplay(indScoreVal)
                                            : null
                                    const indColor =
                                        indDisplay !== null
                                            ? getScoreColor(indDisplay)
                                            : "#d1d5db"
                                    const indTier =
                                        indDisplay !== null
                                            ? getScoreTier(indDisplay)
                                            : null

                                    // Find other leaf aggregations impacted by this indicator
                                    const otherImpacted =
                                        getAggregationIdsForIndicator(indId)
                                            .filter((aId) => aId !== id)
                                            .map(
                                                (aId) =>
                                                    getAggregationInfo(
                                                        aId,
                                                    ).name.split(" ")[0],
                                            ) // Shorten to first word

                                    return (
                                        <div
                                            key={indId}
                                            onClick={() =>
                                                onIndicatorClick?.(indId)
                                            }
                                            className={cn(
                                                "flex items-center justify-between gap-3 p-2 rounded-md border border-dashed hover:bg-muted/10 transition-colors text-xs",
                                                onIndicatorClick
                                                    ? "cursor-pointer"
                                                    : "",
                                            )}
                                            style={{
                                                paddingLeft: `${Math.max(10, (depth + 1) * 16 + 10)}px`,
                                            }}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded border">
                                                    {indId}
                                                </span>
                                                <span className="font-medium truncate text-foreground/90">
                                                    {indInfo.name}
                                                </span>

                                                {otherImpacted.length > 0 && (
                                                    <span
                                                        className="text-[9px] text-muted-foreground truncate italic"
                                                        title={`Impacteert ook: ${otherImpacted.join(", ")}`}
                                                    >
                                                        (ook:{" "}
                                                        {otherImpacted.join(
                                                            ", ",
                                                        )}
                                                        )
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0">
                                                {indDisplay !== null ? (
                                                    <>
                                                        <span className="font-semibold tabular-nums w-6 text-right">
                                                            {indDisplay}
                                                        </span>
                                                        {renderScoreBar(
                                                            indDisplay,
                                                            indColor,
                                                        )}
                                                        <span
                                                            className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                indTier ===
                                                                    "green" &&
                                                                    "bg-green-500",
                                                                indTier ===
                                                                    "yellow" &&
                                                                    "bg-yellow-500",
                                                                indTier ===
                                                                    "red" &&
                                                                    "bg-red-500",
                                                            )}
                                                        />
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground italic text-[10px]">
                                                        geen data
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div>{renderNode("S_BLN")}</div>
            {scoreOf("S_BBWP") !== null && (
                <div className="pt-4 border-t border-dashed space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide pl-1">
                        Water- en Bodembeleid (BBWP)
                    </p>
                    {renderNode("S_BBWP")}
                </div>
            )}
        </div>
    )
}
