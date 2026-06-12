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
    getScoreBarClass,
    getScoreBadgeClass,
    getScoreDotClass,
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
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { Progress } from "~/components/ui/progress"
import { Badge } from "~/components/ui/badge"

type AggregationTreeProps = {
    /** Accessor to get aggregation score (0-1) */
    scoreOf: (id: AggregationId) => number | null
    /** Accessor to get indicator score (0-1) */
    indicatorScoreOf?: (id: string) => number | null
    /** Optional callback when an indicator is clicked */
    onIndicatorClick?: (id: string) => void
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
        S_BBWP: false,
    })

    const toggleNode = (id: string, isOpen: boolean) => {
        setExpanded((prev) => ({ ...prev, [id]: isOpen }))
    }

    const renderScoreBar = (score100: number) => {
        const colorClass = getScoreBarClass(score100)
        // Extract the color name from the bg- class (e.g. bg-emerald-500 -> emerald-500)
        // to pass to our modified Progress component.
        const colorBar = colorClass.replace("bg-", "")
        return (
            <div className="w-24 sm:w-32 shrink-0">
                <Progress value={score100} colorBar={colorBar} />
            </div>
        )
    }

    const renderNode = (id: AggregationId, depth: number = 0) => {
        const info = getAggregationInfo(id)
        const scoreVal = scoreOf(id)
        const displayScore = scoreVal !== null ? scoreToDisplay(scoreVal) : null
        const children = getChildren(id)
        const hasChildren = children.length > 0
        const isExpanded = !!expanded[id]

        // If it's not a top-level or root, it's an end-leaf (or nutrient/climate which act as direct leaves)
        const isLeaf = !hasChildren && id !== "S_BLN"

        // Indicators for this leaf node (only rendered if expanded and accessor provided)
        const indicatorIds = isLeaf ? getIndicatorIdsForAggregation(id) : []
        const hasIndicators = indicatorIds.length > 0 && !!indicatorScoreOf

        const isCollapsible = hasChildren || hasIndicators

        const nodeContent = (
            <div
                className={cn(
                    "flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors",
                    depth === 0 &&
                        "bg-card border-emerald-500/30 shadow-sm font-bold text-base",
                    depth === 1 &&
                        "bg-muted/30 border-border hover:bg-muted/50 font-semibold text-sm",
                    depth === 2 && "bg-card hover:bg-muted/20 text-xs",
                    isCollapsible && depth > 0 && "cursor-pointer"
                )}
                style={{
                    paddingLeft: `${Math.max(10, depth * 16 + 10)}px`,
                }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {isCollapsible ? (
                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                aria-label={isExpanded ? "Inklappen" : "Uitklappen"}
                                className="p-0.5 hover:bg-muted rounded text-muted-foreground shrink-0 focus:outline-hidden focus:ring-2 focus:ring-ring"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </button>
                        </CollapsibleTrigger>
                    ) : (
                        <div className="w-5 shrink-0" />
                    )}

                    <span className="truncate text-foreground" title={info.name}>
                        {info.name}
                    </span>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[280px] p-2 text-xs bg-popover text-popover-foreground border shadow-md">
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

                <div className="flex items-center gap-3 shrink-0 text-xs">
                    {displayScore !== null ? (
                        <>
                            <span className="font-bold tabular-nums w-6 text-right">
                                {displayScore}
                            </span>
                            {renderScoreBar(displayScore)}
                            <Badge
                                variant="outline"
                                className={cn(
                                    "px-2 py-0.5 text-[10px] uppercase tracking-wider",
                                    getScoreBadgeClass(displayScore)
                                )}
                            >
                                {getScoreVerdict(displayScore)}
                            </Badge>
                        </>
                    ) : (
                        <span className="text-muted-foreground italic">
                            geen data
                        </span>
                    )}
                </div>
            </div>
        )

        return (
            <Collapsible
                key={id}
                open={isExpanded}
                onOpenChange={(isOpen) => toggleNode(id, isOpen)}
                className="space-y-1"
            >
                {/* Node row */}
                {depth > 0 && isCollapsible ? (
                    <CollapsibleTrigger asChild>
                        {nodeContent}
                    </CollapsibleTrigger>
                ) : (
                    nodeContent
                )}

                {/* Render children or indicators if expanded */}
                <CollapsibleContent className="space-y-1">
                    {hasChildren &&
                        children.map((childId) =>
                            renderNode(childId, depth + 1),
                        )}

                    {hasIndicators && (
                        <div className="space-y-1 pl-4 mt-1">
                            {indicatorIds.map((indId) => {
                                const indInfo = getIndicatorInfo(indId)
                                if (!indInfo) return null
                                const indScoreVal = indicatorScoreOf(indId)
                                const indDisplay =
                                    indScoreVal !== null
                                        ? scoreToDisplay(indScoreVal)
                                        : null

                                const otherImpacted =
                                    getAggregationIdsForIndicator(indId)
                                        .filter((aId) => aId !== id)
                                        .map(
                                            (aId) =>
                                                getAggregationInfo(aId).name.split(" ")[0],
                                        )

                                return (
                                    <button
                                        type="button"
                                        key={indId}
                                        onClick={() => onIndicatorClick?.(indId)}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-3 p-2 rounded-md border border-dashed bg-card hover:bg-muted/40 transition-colors text-xs text-left",
                                            onIndicatorClick ? "cursor-pointer" : "",
                                        )}
                                        style={{
                                            paddingLeft: `${Math.max(10, (depth + 1) * 16 + 10)}px`,
                                        }}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-5">
                                                {indId}
                                            </Badge>
                                            <span className="font-medium truncate text-foreground/90">
                                                {indInfo.name}
                                            </span>

                                            {otherImpacted.length > 0 && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground cursor-help font-medium">
                                                                + {otherImpacted.length} {otherImpacted.length === 1 ? "ander thema" : "andere thema's"}
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-popover text-popover-foreground border shadow-md">
                                                            <p className="font-semibold text-xs mb-1">Heeft ook invloed op:</p>
                                                            <ul className="list-disc pl-4 text-muted-foreground">
                                                                {otherImpacted.map(oi => <li key={oi}>{oi}</li>)}
                                                            </ul>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            {indDisplay !== null ? (
                                                <>
                                                    <span className="font-semibold tabular-nums w-6 text-right">
                                                        {indDisplay}
                                                    </span>
                                                    {renderScoreBar(indDisplay)}
                                                    <span
                                                        className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            getScoreDotClass(indDisplay)
                                                        )}
                                                    />
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground italic text-[10px]">
                                                    geen data
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </CollapsibleContent>
            </Collapsible>
        )
    }

    return (
        <div className="space-y-4">
            <div>{renderNode("S_BLN")}</div>
            {scoreOf("S_BBWP") !== null && (
                <div className="pt-4 border-t border-dashed space-y-2">
                    {renderNode("S_BBWP")}
                </div>
            )}
        </div>
    )
}
