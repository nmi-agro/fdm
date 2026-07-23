import { AlertCircle, ArrowRight, CheckCircle2, CornerDownRight } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { ScrollArea } from "~/components/ui/scroll-area"
import {
  type AggregationId,
  computeAreaWeightedAggregation,
  type FieldAreaInput,
  type FieldScoreInput,
  getAggregationInfo,
  getFieldAggregationScore,
  LEAF_AGGREGATION_IDS,
} from "~/lib/aggregations"
import {
  getScoreBadgeClass,
  getScoreDotClass,
  getScoreTextClass,
  getScoreVerdict,
  INDICATORS,
  scoreToDisplay,
} from "~/lib/indicators"
import { cn } from "~/lib/utils"

type LeftMode = "themes" | "indicators"

type AggregationPainpointsProps = {
  domain?: "organization" | "farm"
  fields: (FieldAreaInput & { b_name: string | null | undefined })[]
  fieldScores: FieldScoreInput[]
} & (
  | {
      basePath: string // e.g. /farm/123/2026/indicators
      basePathFormatter?: undefined
    }
  | {
      basePath?: undefined
      basePathFormatter: (b_id: string) => string
    }
)

export function AggregationPainpoints({
  domain = "farm",
  fields,
  fieldScores,
  basePath,
  basePathFormatter,
}: AggregationPainpointsProps) {
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
        const impact =
          field.b_area != null && field.b_area > 0 ? (100 - display) * field.b_area : null
        return {
          b_id: field.b_id,
          b_name: field.b_name || `Perceel ${field.b_id}`,
          b_area: field.b_area,
          displayScore: display,
          impact,
        }
      })
      .filter(
        (f): f is NonNullable<typeof f> & { impact: number } => f !== null && f.impact !== null,
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
        const impact =
          field.b_area != null && field.b_area > 0 ? (100 - display) * field.b_area : null
        return {
          b_id: field.b_id,
          b_name: field.b_name || `Perceel ${field.b_id}`,
          b_area: field.b_area,
          displayScore: display,
          impact,
        }
      })
      .filter(
        (f): f is NonNullable<typeof f> & { impact: number } => f !== null && f.impact !== null,
      )
      .sort((a, b) => b.impact - a.impact)
  }, [fields, fieldScores, activeIndId])

  const activeAggInfo = activeAggId ? getAggregationInfo(activeAggId) : null
  const activeIndName = rankedIndicators.find((i) => i.id === activeIndId)?.name ?? activeIndId

  const criticalCount = rankedLeaves.filter(
    (l) => l.displayScore !== null && l.displayScore < 40,
  ).length
  const warningCount = rankedLeaves.filter(
    (l) => l.displayScore !== null && l.displayScore >= 40 && l.displayScore < 70,
  ).length

  const worstFields = leftMode === "themes" ? worstFieldsForTheme : worstFieldsForIndicator
  const rightHeading =
    leftMode === "themes"
      ? `Top 5 ${domain === "organization" ? "bedrijven" : "percelen"} met hoogste negatieve impact voor ${activeAggInfo?.name}`
      : `Top 5 ${domain === "organization" ? "bedrijven" : "percelen"} met hoogste negatieve impact voor ${activeIndName}`

  return (
    <Card className="border-border border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-muted-foreground h-5 w-5" />
          <CardTitle className="text-base font-bold">Knelpunten</CardTitle>
        </div>
        <CardDescription className="text-xs">
          In één oogopslag de grootste knelpunten van{" "}
          {domain === "organization"
            ? "de organisatie en de bedrijven"
            : "het bedrijf en de percelen"}{" "}
          die deze veroorzaken.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary banner */}
        <div className="bg-muted/40 flex items-center gap-2 rounded-md border p-2.5 text-xs">
          {criticalCount > 0 ? (
            <>
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              <span className="text-foreground font-semibold">
                {criticalCount} kritieke en {warningCount} matige thema's gedetecteerd.
              </span>
            </>
          ) : warningCount > 0 ? (
            <>
              <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-500" />
              <span className="text-foreground font-semibold">
                {warningCount} matige thema's gedetecteerd. Geen kritieke knelpunten.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <span className="font-semibold text-green-600 dark:text-green-400">
                Alle thema's {domain === "organization" ? "voor uw organisatie" : "op uw bedrijf"}{" "}
                scoren goed (70+).
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Left: ranked list with toggle */}
          <div className="space-y-1.5">
            {/* Toggle */}
            <div className="bg-muted flex w-fit items-center gap-1 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => {
                  setLeftMode("themes")
                  setSelectedIndId(null)
                }}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                  leftMode === "themes"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Thema's
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftMode("indicators")
                  setSelectedAggId(null)
                }}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                  leftMode === "indicators"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Indicatoren
              </button>
            </div>

            {leftMode === "themes" ? (
              <>
                <h4 className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                  Zwakste thema's (
                  {domain === "organization"
                    ? "gemiddelde van de organisatie"
                    : "bedrijfsgemiddelde"}
                  )
                </h4>
                <ScrollArea className="bg-card h-[280px] w-full rounded-md border p-1">
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
                            "h-auto w-full justify-between border border-transparent px-3 py-2 text-left font-normal transition-all",
                            isSelected && "border-border font-semibold shadow-sm",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                "h-6 w-1.5 shrink-0 rounded-full",
                                getScoreDotClass(score),
                              )}
                            />
                            <span className="text-foreground truncate text-xs">{info.name}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 pl-2">
                            <span
                              className={cn(
                                "text-xs font-bold tabular-nums",
                                getScoreTextClass(score),
                              )}
                            >
                              {score}
                            </span>
                            <ArrowRight
                              className={cn(
                                "text-muted-foreground h-3.5 w-3.5 transition-transform",
                                isSelected ? "translate-x-0.5" : "opacity-30",
                              )}
                            />
                          </div>
                        </Button>
                      )
                    })}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <>
                <h4 className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                  Zwakste indicatoren (
                  {domain === "organization"
                    ? "gemiddelde van de organisatie"
                    : "bedrijfsgemiddelde"}
                  )
                </h4>
                <ScrollArea className="bg-card h-[280px] w-full rounded-md border p-1">
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
                            "h-auto w-full justify-between border border-transparent px-3 py-2 text-left font-normal transition-all",
                            isSelected && "border-border font-semibold shadow-sm",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                "h-6 w-1.5 shrink-0 rounded-full",
                                getScoreDotClass(score),
                              )}
                            />
                            <span className="text-foreground truncate text-xs">{ind.name}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 pl-2">
                            <span
                              className={cn(
                                "text-xs font-bold tabular-nums",
                                getScoreTextClass(score),
                              )}
                            >
                              {score}
                            </span>
                            <ArrowRight
                              className={cn(
                                "text-muted-foreground h-3.5 w-3.5 transition-transform",
                                isSelected ? "translate-x-0.5" : "opacity-30",
                              )}
                            />
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
            <h4 className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
              {rightHeading}
            </h4>
            <ScrollArea className="bg-muted/10 h-[280px] w-full rounded-md border p-2">
              <div className="space-y-1.5 pr-3">
                {worstFields.length === 0 ? (
                  <p className="text-muted-foreground p-4 text-center text-xs italic">
                    Geen perceelsdata beschikbaar.
                  </p>
                ) : (
                  worstFields.slice(0, 5).map((field) => {
                    const score = field.displayScore ?? 0
                    return (
                      <div
                        key={field.b_id}
                        className="bg-card border-border flex min-w-0 flex-col justify-between gap-1 rounded-md border p-2 text-xs shadow-sm sm:flex-row sm:items-center sm:gap-2"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <CornerDownRight className="text-muted-foreground hidden h-3.5 w-3.5 shrink-0 sm:block" />
                          <Link
                            to={
                              basePathFormatter
                                ? basePathFormatter(field.b_id)
                                : `${basePath}/${field.b_id}`
                            }
                            className="text-foreground hover:text-primary min-w-0 truncate font-medium transition-colors hover:underline"
                            title={field.b_name || undefined}
                          >
                            {field.b_name}
                          </Link>
                          {field.b_area !== null && (
                            <span className="text-muted-foreground shrink-0 text-[10px]">
                              ({field.b_area.toFixed(1)} ha)
                            </span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center justify-end gap-2 sm:pl-2">
                          <span className={cn("font-bold tabular-nums", getScoreTextClass(score))}>
                            {score}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 shrink-0 px-1.5 py-0 text-[9px] tracking-wider whitespace-nowrap uppercase",
                              getScoreBadgeClass(score),
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
