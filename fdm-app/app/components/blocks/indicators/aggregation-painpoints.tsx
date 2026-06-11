import { useState, useMemo } from "react"
import { Link } from "react-router"
import { AlertCircle, ArrowRight, CornerDownRight, CheckCircle2 } from "lucide-react"
import { cn } from "~/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import {
    type AggregationId,
    LEAF_AGGREGATION_IDS,
    getAggregationInfo,
    getFieldAggregationScore,
    computeAreaWeightedAggregation,
    type FieldScoreInput,
    type FieldAreaInput,
} from "~/lib/aggregations"
import { getScoreColor, getScoreVerdict, scoreToDisplay } from "~/lib/indicators"

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

        const list = fields
            .map((field) => {
                const fs = fieldScores.find((s) => s.b_id === field.b_id)
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
        <Card className="border border-red-500/20 shadow-md">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-base font-bold">Knelpunten Analyse</CardTitle>
                </div>
                <CardDescription className="text-xs">
                    In één oogopslag de grootste verbeterpunten van uw bedrijf en de percelen die deze veroorzaken.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary banner */}
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/40 border text-xs">
                    {criticalCount > 0 ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <span className="font-semibold text-foreground">
                                {criticalCount} kritieke en {warningCount} matige indicatoren gedetecteerd.
                            </span>
                        </>
                    ) : warningCount > 0 ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                            <span className="font-semibold text-foreground">
                                {warningCount} matige indicatoren gedetecteerd. Geen kritieke knelpunten!
                            </span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <span className="font-semibold text-green-600 dark:text-green-400">
                                Uitstekend! Alle aspecten op uw bedrijf scoren goed (70+).
                            </span>
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Ranked Leaf Aggregations */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            Zwakste aspecten (Bedrijfsgemiddelde)
                        </p>
                        <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                            {rankedLeaves.map((leaf) => {
                                const info = getAggregationInfo(leaf.id)
                                const isSelected = leaf.id === activeAggId
                                const score = leaf.displayScore ?? 0

                                return (
                                    <button
                                        key={leaf.id}
                                        type="button"
                                        onClick={() => setSelectedAggId(leaf.id)}
                                        className={cn(
                                            "w-full text-left p-2 rounded-md border flex items-center justify-between text-xs transition-all",
                                            isSelected
                                                ? "bg-muted border-primary/40 font-semibold shadow-sm"
                                                : "bg-card border-border hover:bg-muted/30"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="w-1.5 h-6 rounded-full shrink-0"
                                                style={{ backgroundColor: getScoreColor(score) }}
                                            />
                                            <span className="truncate text-foreground">
                                                {info.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                            <span
                                                className="font-bold tabular-nums"
                                                style={{ color: getScoreColor(score) }}
                                            >
                                                {score}
                                            </span>
                                            <ArrowRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isSelected ? "translate-x-0.5" : "opacity-30")} />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right: Weakest fields for active aggregation */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            Grootste knelpercelen voor {activeAggInfo?.name}
                        </p>
                        <div className="space-y-1 max-h-[280px] overflow-y-auto border rounded-md p-2 bg-muted/10">
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
                                            className="flex items-center justify-between p-1.5 rounded bg-card border border-border text-xs"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <Link
                                                    to={`${basePath}/${field.b_id}`}
                                                    className="font-medium text-foreground hover:underline truncate hover:text-primary transition-colors"
                                                >
                                                    {field.b_name}
                                                </Link>
                                                {field.b_area !== null && (
                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                        ({field.b_area.toFixed(1)} ha)
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span
                                                    className="font-bold tabular-nums"
                                                    style={{ color: getScoreColor(score) }}
                                                >
                                                    {score}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[9px] px-1 py-0 h-4 uppercase tracking-wider scale-90"
                                                    style={{
                                                        borderColor: getScoreColor(score),
                                                        color: getScoreColor(score),
                                                    }}
                                                >
                                                    {getScoreVerdict(score).split(" ")[0]}
                                                </Badge>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            {worstFieldsForActiveAgg.length > 5 && (
                                <p className="text-[10px] text-muted-foreground italic text-center pt-1.5">
                                    En nog {worstFieldsForActiveAgg.length - 5} andere percelen...
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
