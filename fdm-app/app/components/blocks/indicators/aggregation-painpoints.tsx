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
import { getScoreTextClass, getScoreDotClass, getScoreVerdict, scoreToDisplay, getScoreBadgeClass } from "~/lib/indicators"

type AggregationPainpointsProps = {
    fields: (FieldAreaInput & { b_name: string | null | undefined })[]
    fieldScores: FieldScoreInput[]
    basePath: string // e.g. /farm/123/2026/indicators
}

export function AggregationPainpoints({ fields, fieldScores, basePath }: AggregationPainpointsProps) {
    const [selectedAggId, setSelectedAggId] = useState<AggregationId | null>(null)

    // Compute farm-level averages for all leaf aggregations and sort by score ascending
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
            // Sort by score ascending (worst performing first)
            .sort((a, b) => (a.displayScore ?? 101) - (b.displayScore ?? 101))

        return list
    }, [fields, fieldScores])

    // Automatically select the worst-performing aggregation if none is selected
    const activeAggId = selectedAggId ?? (rankedLeaves[0]?.id || null)

    // Get fields with lowest scores for the selected leaf aggregation
    const worstFieldsForActiveAgg = useMemo(() => {
        if (!activeAggId) return []

        const fieldScoresById = new Map(fieldScores.map(fs => [fs.b_id, fs]))

        const list = fields
            .map((field) => {
                const fs = fieldScoresById.get(field.b_id)
                const score01 = fs ? getFieldAggregationScore(fs.score, activeAggId) : null
                return {
                    b_id: field.b_id,
                    b_name: field.b_name || `Perceel ${field.b_id}`,
                    b_area: field.b_area,
                    score01,
                    displayScore: score01 !== null ? scoreToDisplay(score01) : null,
                }
            })
            .filter((item) => item.score01 !== null)
            // Sort by score ascending (lowest field scores first)
            .sort((a, b) => (a.displayScore ?? 101) - (b.displayScore ?? 101))

        return list
    }, [fields, fieldScores, activeAggId])

    const activeAggInfo = activeAggId ? getAggregationInfo(activeAggId) : null

    // Count how many leaf aggregations are critical (<40) or warning (<70)
    const criticalCount = rankedLeaves.filter((l) => l.displayScore !== null && l.displayScore < 40).length
    const warningCount = rankedLeaves.filter((l) => l.displayScore !== null && l.displayScore >= 40 && l.displayScore < 70).length

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
                    {/* Left: Ranked Leaf Aggregations */}
                    <div className="space-y-1.5">
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
                                                <span
                                                    className={cn("w-1.5 h-6 rounded-full shrink-0", getScoreDotClass(score))}
                                                />
                                                <span className="truncate text-foreground text-xs">
                                                    {info.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                                <span
                                                    className={cn("font-bold tabular-nums text-xs", getScoreTextClass(score))}
                                                >
                                                    {score}
                                                </span>
                                                <ArrowRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isSelected ? "translate-x-0.5" : "opacity-30")} />
                                            </div>
                                        </Button>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right: Weakest fields for active aggregation */}
                    <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            Knelpercelen voor {activeAggInfo?.name}
                        </h4>
                        <ScrollArea className="h-[280px] w-full rounded-md border bg-muted/10 p-2">
                            <div className="space-y-1.5 pr-3">
                                {worstFieldsForActiveAgg.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic p-4 text-center">
                                        Geen perceelsdata beschikbaar.
                                    </p>
                                ) : (
                                    worstFieldsForActiveAgg.slice(0, 5).map((field) => {
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
                                                    <span
                                                        className={cn("font-bold tabular-nums", getScoreTextClass(score))}
                                                    >
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
                                {worstFieldsForActiveAgg.length > 5 && (
                                    <p className="text-[10px] text-muted-foreground italic text-center pt-2">
                                        En nog {worstFieldsForActiveAgg.length - 5} andere percelen...
                                    </p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
