import { ChevronDown, ChevronRight, CornerDownRight, Info } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { Progress } from "~/components/ui/progress"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import {
    type AggregationId,
    getAggregationIdsForIndicator,
    getAggregationInfo,
    getChildren,
    getIndicatorIdsForAggregation,
} from "~/lib/aggregations"
import {
    getIndicatorInfo,
    getScoreBadgeClass,
    getScoreBarClass,
    getScoreDotClass,
    getScoreTextClass,
    getScoreVerdict,
    scoreToDisplay,
} from "~/lib/indicators"
import { cn } from "~/lib/utils"

type FieldEntry = {
    b_id: string
    b_name: string | null | undefined
    b_area: number | null
}

type AggregationTreeProps = {
    /** Whether to say farms-in-organization or fields-in-farm in the user-facing messages */
    domain?: "organization" | "farm"
    /** Accessor to get aggregation score (0-1) */
    scoreOf: (id: AggregationId) => number | null
    /** Accessor to get indicator score (0-1) */
    indicatorScoreOf?: (id: string) => number | null
    /** Optional callback when an indicator is clicked */
    onIndicatorClick?: (id: string) => void
    /** List of fields for drill-down (top-5 worst fields per indicator) */
    fields?: FieldEntry[]
    /** Raw field scores for per-field indicator lookup */
    fieldScores?: Array<{
        b_id: string
        score: {
            indicators: Array<{ indicator_id: string; score: number | null }>
        } | null
    }>
} & (
        {
            /** Base path for field links, e.g. /farm/123/2026/indicators */
            basePath: string
            /** Base path formatter for field links, e.g. (b_id: string) => "/farm/123/2026/indicators/" + b_id */
            basePathFormatter?: undefined
        } | {
            /** Base path for field links, e.g. /farm/123/2026/indicators */
            basePath?: undefined
            /** Base path formatter for field links, e.g. (b_id: string) => "/farm/123/2026/indicators/" + b_id */
            basePathFormatter: (b_id: string) => string
        }
    )

export function AggregationTree({
    domain = "farm",
    scoreOf,
    indicatorScoreOf,
    onIndicatorClick,
    fields,
    fieldScores,
    basePath,
    basePathFormatter,
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

    const renderNode = (id: AggregationId, depth = 0) => {
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
                                const indScoreVal = indicatorScoreOf!(indId)
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

                                // Top-5 worst-impact fields for this indicator
                                const hasFieldData = !!(
                                    fields &&
                                    fieldScores &&
                                    (basePath || basePathFormatter)
                                )
                                const indKey = `ind:${indId}`
                                const isIndExpanded = !!expanded[indKey]

                                const worstFields = hasFieldData
                                    ? fields!
                                        .map((field) => {
                                            const fs = fieldScores!.find((s) => s.b_id === field.b_id)
                                            const rawScore = fs?.score?.indicators.find(
                                                (i) => i.indicator_id === indId,
                                            )?.score
                                            if (rawScore == null || Number.isNaN(rawScore)) return null
                                            const display = scoreToDisplay(rawScore)
                                            const impact =
                                                field.b_area != null && field.b_area > 0
                                                    ? (100 - display) * field.b_area
                                                    : null
                                            return { ...field, display, impact }
                                        })
                                        .filter((f): f is NonNullable<typeof f> & { impact: number } =>
                                            f !== null && f.impact !== null,
                                        )
                                        .sort((a, b) => b.impact - a.impact)
                                        .slice(0, 5)
                                    : []

                                const indHeaderPl = `${Math.max(10, (depth + 1) * 16 + 10)}px`

                                return (
                                    <Collapsible
                                        key={indId}
                                        open={isIndExpanded}
                                        onOpenChange={(open) => toggleNode(indKey, open)}
                                        className="space-y-0.5"
                                    >
                                        <CollapsibleTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => onIndicatorClick?.(indId)}
                                                className={cn(
                                                    "w-full flex items-center justify-between gap-3 p-2 rounded-md border border-dashed bg-card hover:bg-muted/40 transition-colors text-xs text-left",
                                                    hasFieldData ? "cursor-pointer" : "",
                                                )}
                                                style={{ paddingLeft: indHeaderPl }}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {hasFieldData ? (
                                                        isIndExpanded
                                                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    ) : (
                                                        <div className="w-3.5 shrink-0" />
                                                    )}
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
                                                            {renderScoreBar(
                                                                indDisplay,
                                                            )}
                                                            <span
                                                                className={cn(
                                                                    "w-2 h-2 rounded-full",
                                                                    getScoreDotClass(
                                                                        indDisplay,
                                                                    ),
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
                                        </CollapsibleTrigger>

                                        {hasFieldData && (
                                            <CollapsibleContent>
                                                <div
                                                    className="space-y-0.5 pt-0.5 pb-1"
                                                    style={{ paddingLeft: `${Math.max(10, (depth + 2) * 16 + 10)}px` }}
                                                >
                                                    {worstFields.length === 0 ? (
                                                        <p className="text-[10px] text-muted-foreground italic py-1 px-2">
                                                            { domain === "organization" ? "Geen bedrijfsdata beschikbaar." : "Geen perceelsdata beschikbaar." }
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide pb-0.5">
                                                                Top{" "}
                                                                {
                                                                    worstFields.length
                                                                }{" "}
                                                                {domain ===
                                                                "organization"
                                                                    ? "bedrijven"
                                                                    : "percelen"}{" "}
                                                                met hoogste
                                                                negatieve impact
                                                            </p>
                                                            {worstFields.map(
                                                                (field) => (
                                                                    <Link
                                                                        key={
                                                                            field.b_id
                                                                        }
                                                                        to={
                                                                            basePathFormatter
                                                                                ? basePathFormatter(
                                                                                      field.b_id,
                                                                                  )
                                                                                : `${basePath}/${field.b_id}`
                                                                        }
                                                                        className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-dashed border-border/60 bg-muted/20 hover:bg-muted/50 transition-colors text-xs group"
                                                                    >
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                            <span className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                                                                                {field.b_name ||
                                                                                    `${domain === "organization" ? "Bedrijf" : "Perceel"} ${field.b_id}`}
                                                                            </span>
                                                                            {field.b_area !=
                                                                                null && (
                                                                                <span className="text-[10px] text-muted-foreground shrink-0">
                                                                                    (
                                                                                    {field.b_area.toFixed(
                                                                                        1,
                                                                                    )}{" "}
                                                                                    ha)
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span
                                                                            className={cn(
                                                                                "font-bold tabular-nums shrink-0",
                                                                                getScoreTextClass(
                                                                                    field.display,
                                                                                ),
                                                                            )}
                                                                        >
                                                                            {
                                                                                field.display
                                                                            }
                                                                        </span>
                                                                    </Link>
                                                                ),
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        )}
                                    </Collapsible>
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
