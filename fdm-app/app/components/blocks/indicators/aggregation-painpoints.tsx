import { useState, useMemo } from "react"
import { Link } from "react-router"
import { AlertCircle, ArrowRight, CornerDownRight, CheckCircle2 } from "lucide-react"
import { cn } from "~/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import {
    type AggregationId,
    LEAF_AGGREGATION_IDS,
    getAggregationInfo,
    getFieldAggregationScore,
    computeAreaWeightedAggregation,
    type FieldScoreInput,
    type FieldAreaInput,
} from "~/lib/aggregations"
import { INDICATORS, getScoreTextClass, getScoreDotClass, getScoreVerdict, scoreToDisplay, getScoreBadgeClass } from "~/lib/indicators"

type LeftMode = "themes" | "indicators"

type AggregationPainpointsProps = {
    fields: (FieldAreaInput & { b_name: string | null | undefined })[]
    fieldScores: FieldScoreInput[]
    basePath: string // e.g. /farm/123/2026/indicators
}

export function AggregationPainpoints({ fields, fieldScores, basePath }: AggregationPainpointsProps) {
    const [selectedAggId, setSelectedAggId] = useState<AggregationId | null>(null)
    const [selectedIndId, setSelectedIndId] = useState<string | null>(null)
    const [leftMode, setLeftMode] = useState<LeftMode>("themes")

    // ── Theme ranking ──────────────────────────────────────────────────────────
    const rankedLeaves = useMemo(() => {
        const list = LEAF_AGGREGATION_IDS.map((aggId) => {
            const score01 = computeAreaWeightedAggregation(fieldScores, fields, aggId)
            return {
                id: aggId,
                score: score01,
                displayScore: score01 !== null ? scoreToDisplay(score01) : null,
            }
        })
            .filter((item) => item.score !== null)
            .sort((a, b) => (a.displayScore ?? 101) - (b.displayScore ?? 101))

        return list
    }, [fields, fieldScores])

    // ── Indicator ranking ──────────────────────────────────────────────────────
    const rankedIndicators = useMemo(() => {
        const areaByBid = new Map(fields.map((f) => [f.b_id, f.b_area ?? 0]))

        return INDICATORS.map((ind) => {
            let totalScore = 0
            let totalWeight = 0
            for (const s of fieldScores) {
                const val = s.score?.indicators.find((i) => i.indicator_id === ind.id)?.score
                if (val == null || Number.isNaN(val)) continue
                const area = areaByBid.get(s.b_id) ?? 0
                if (area > 0) {
                    totalScore += val * area
                    totalWeight += area
                }
            }
            const score01 = totalWeight > 0 ? totalScore / totalWeight : null
            return {
                id: ind.id,
                name: ind.name,
                score01,
                displayScore: score01 !== null ? scoreToDisplay(score01) : null,
            }
        })
            .filter((item) => item.score01 !== null)
            .sort((a, b) => (a.displayScore ?? 101) - (b.displayScore ?? 101))
    }, [fields, fieldScores])

    // Automatic default selection per mode
    const activeAggId = selectedAggId ?? (rankedLeaves[0]?.id || null)
    const activeIndId = selectedIndId ?? (rankedIndicators[0]?.id || null)

    // ── Worst fields for active theme ──────────────────────────────────────────
    const worstFieldsForTheme = useMemo(() => {
        if (!activeAggId) return []
        const fsById = new Map(fieldScores.map((fs) => [fs.b_id, fs]))
        return fields
            .map((field) => {
                const fs = fsById.get(field.b_id)
                const score01 = fs ? getFieldAggregationScore(fs.score, activeAggId) : null
                if (score01 === null) return null
                const display = scoreToDisplay(score01)
                const impact = field.b_area != null && field.b_area > 0
                    ? (100 - display) * field.b_area
                    : null
                return {
                    b_id: field.b_id,
                    b_name: field.b_name || `Perceel ${field.b_id}`,
                    b_area: field.b_area,
                    displayScore: display,
                    impact,
                }
            })
            .filter((f): f is NonNullable<typeof f> & { impact: number } =>
                f !== null && f.impact !== null,
            )
            .sort((a, b) => b.impact - a.impact)
    }, [fields, fieldScores, activeAggId])

    // ── Worst fields for active indicator ─────────────────────────────────────
    const worstFieldsForIndicator = useMemo(() => {
        if (!activeIndId) return []
        const fsById = new Map(fieldScores.map((fs) => [fs.b_id, fs]))
        return fields
            .map((field) => {
                const fs = fsById.get(field.b_id)
                const val = fs?.score?.indicators.find((i) => i.indicator_id === activeIndId)?.score
                if (val == null || Number.isNaN(val)) return null
                const display = scoreToDisplay(val)
                const impact = field.b_area != null && field.b_area > 0
                    ? (100 - display) * field.b_area
                    : null
                return {
                    b_id: field.b_id,
                    b_name: field.b_name || `Perceel ${field.b_id}`,
                    b_area: field.b_area,
                    displayScore: display,
                    impact,
                }
            })
            .filter((f): f is NonNullable<typeof f> & { impact: number } =>
                f !== null && f.impact !== null,
            )
            .sort((a, b) => b.impact - a.impact)
    }, [fields, fieldScores, activeIndId])

    const activeAggInfo = activeAggId ? getAggregationInfo(activeAggId) : null
    const activeIndName = rankedIndicators.find((i) => i.id === activeIndId)?.name ?? activeIndId

    const criticalCount = rankedLeaves.filter((l) => l.displayScore !== null && l.displayScore < 40).length
    const warningCount = rankedLeaves.filter((l) => l.displayScore !== null && l.displayScore >= 40 && l.displayScore < 70).length

    const worstFields = leftMode === "themes" ? worstFieldsForTheme : worstFieldsForIndicator
    const rightHeading = leftMode === "themes"
        ? `Top 5 percelen met hoogste negatieve impact voor ${activeAggInfo?.name}`
        : `Top 5 percelen met hoogste negatieve impact voor ${activeIndName}`

    return (
        <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base font-bold">Knelpunten</CardTitle>
                </div>
                <CardDescription className="text-xs">
                    In één oogopslag de grootste knelpunten van het bedrijf en de percelen die deze veroorzaken.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary banner */}
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/40 border text-xs">
                    {criticalCount > 0 ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                            <span className="font-semibold text-foreground">
                                {criticalCount} kritieke en {warningCount} matige thema's gedetecteerd.
                            </span>
                        </>
                    ) : warningCount > 0 ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                            <span className="font-semibold text-foreground">
                                {warningCount} matige thema's gedetecteerd. Geen kritieke knelpunten.
                            </span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <span className="font-semibold text-green-600 dark:text-green-400">
                                Alle thema's op uw bedrijf scoren goed (70+).
                            </span>
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: ranked list with toggle */}
                    <div className="space-y-1.5">
                        {/* Toggle */}
                        <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted w-fit">
                            <button
                                type="button"
                                onClick={() => { setLeftMode("themes"); setSelectedIndId(null) }}
                                className={cn(
                                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                                    leftMode === "themes"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Thema's
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLeftMode("indicators"); setSelectedAggId(null) }}
                                className={cn(
                                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                                    leftMode === "indicators"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Indicatoren
                            </button>
                        </div>

                        {leftMode === "themes" ? (
                            <>
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                    Zwakste thema's (bedrijfsgemiddelde)
                                </h4>
                                <ScrollArea className="h-[280px] w-full rounded-md border p-1 bg-card">
                                    <div className="space-y-1 p-1">
                                        {rankedLeaves.map((leaf) => {
                                            const info = getAggregationInfo(leaf.id)
                                            const isSelected = leaf.id === activeAggId
                                            const score = leaf.displayScore ?? 0

                                            return (
                                                <Button
                                                    key={leaf.id}
                                                    variant={isSelected ? "secondary" : "ghost"}
                                                    onClick={() => setSelectedAggId(leaf.id)}
                                                    className={cn(
                                                        "w-full h-auto py-2 px-3 justify-between text-left font-normal border border-transparent transition-all",
                                                        isSelected && "border-border shadow-sm font-semibold"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className={cn("w-1.5 h-6 rounded-full shrink-0", getScoreDotClass(score))} />
                                                        <span className="truncate text-foreground text-xs">
                                                            {info.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                                        <span className={cn("font-bold tabular-nums text-xs", getScoreTextClass(score))}>
                                                            {score}
                                                        </span>
                                                        <ArrowRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isSelected ? "translate-x-0.5" : "opacity-30")} />
                                                    </div>
                                                </Button>
                                            )
                                        })}
                                    </div>
                                </ScrollArea>
                            </>
                        ) : (
                            <>
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                    Zwakste indicatoren (bedrijfsgemiddelde)
                                </h4>
                                <ScrollArea className="h-[280px] w-full rounded-md border p-1 bg-card">
                                    <div className="space-y-1 p-1">
                                        {rankedIndicators.map((ind) => {
                                            const isSelected = ind.id === activeIndId
                                            const score = ind.displayScore ?? 0

                                            return (
                                                <Button
                                                    key={ind.id}
                                                    variant={isSelected ? "secondary" : "ghost"}
                                                    onClick={() => setSelectedIndId(ind.id)}
                                                    className={cn(
                                                        "w-full h-auto py-2 px-3 justify-between text-left font-normal border border-transparent transition-all",
                                                        isSelected && "border-border shadow-sm font-semibold"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className={cn("w-1.5 h-6 rounded-full shrink-0", getScoreDotClass(score))} />
                                                        <span className="truncate text-foreground text-xs">
                                                            {ind.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                                        <span className={cn("font-bold tabular-nums text-xs", getScoreTextClass(score))}>
                                                            {score}
                                                        </span>
                                                        <ArrowRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isSelected ? "translate-x-0.5" : "opacity-30")} />
                                                    </div>
                                                </Button>
                                            )
                                        })}
                                    </div>
                                </ScrollArea>
                            </>
                        )}
                    </div>

                    {/* Right: Worst fields for the active selection */}
                    <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            {rightHeading}
                        </h4>
                        <ScrollArea className="h-[280px] w-full rounded-md border bg-muted/10 p-2">
                            <div className="space-y-1.5 pr-3">
                                {worstFields.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic p-4 text-center">
                                        Geen perceelsdata beschikbaar.
                                    </p>
                                ) : (
                                    worstFields.slice(0, 5).map((field) => {
                                        const score = field.displayScore ?? 0
                                        return (
                                            <div
                                                key={field.b_id}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 p-2 rounded-md bg-card border border-border shadow-sm text-xs min-w-0"
                                            >
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
                                                    <Link
                                                        to={`${basePath}/${field.b_id}`}
                                                        className="font-medium text-foreground hover:underline hover:text-primary transition-colors truncate min-w-0"
                                                        title={field.b_name || undefined}
                                                    >
                                                        {field.b_name}
                                                    </Link>
                                                    {field.b_area !== null && (
                                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                                            ({field.b_area.toFixed(1)} ha)
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-end gap-2 shrink-0 sm:pl-2">
                                                    <span className={cn("font-bold tabular-nums", getScoreTextClass(score))}>
                                                        {score}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "shrink-0 whitespace-nowrap text-[9px] px-1.5 py-0 h-5 uppercase tracking-wider",
                                                            getScoreBadgeClass(score)
                                                        )}
                                                    >
                                                        {getScoreVerdict(score).split(" ")[0]}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}                              
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
