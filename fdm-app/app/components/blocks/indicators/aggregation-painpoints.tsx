import { AlertCircle, ArrowRight, CheckCircle2, CornerDownRight, Sparkles } from "lucide-react"
import { Suspense, useMemo, useState } from "react"
import { Await, Link } from "react-router"
import type {
  FarmMeasureRecommendation,
  FarmMeasureRecommendationsResult,
} from "~/integrations/bln3.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
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
  /**
   * Lazily-resolved, farm-wide BLN3 measure recommendations (per field ×
   * indicator), used to power the "Waar te beginnen" panel when an indicator
   * is selected. Omitted on the organization overview (out of scope).
   * When `adviceAvailable` is false (all advice fetches failed), the panel
   * is hidden entirely rather than showing a false empty state.
   */
  farmMeasureRecommendationsPromise?: Promise<FarmMeasureRecommendationsResult>
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
  farmMeasureRecommendationsPromise,
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

        {/* "Waar te beginnen" — farm-wide measure recommendations for the
            selected indicator, lazily loaded so this potentially-slow batched
            NMI fetch never blocks the rest of the page. */}
        {leftMode === "indicators" && activeIndId && farmMeasureRecommendationsPromise && (
          <Suspense fallback={<RecommendationsLoadingPanel />}>
            <Await resolve={farmMeasureRecommendationsPromise} errorElement={null}>
              {(result) =>
                // Hide the panel entirely when every advice fetch failed —
                // an unavailable recommendation must never look like "no
                // recommendations exist for this indicator".
                result.adviceAvailable ? (
                  <WhereToStartPanel
                    recommendations={result.recommendations}
                    activeIndId={activeIndId}
                    activeIndName={activeIndName ?? activeIndId}
                    fields={fields}
                    basePath={basePath}
                    basePathFormatter={basePathFormatter}
                  />
                ) : null
              }
            </Await>
          </Suspense>
        )}
      </CardContent>
    </Card>
  )
}

/** Fallback shown while the batched, per-field NMI advice fetch for the
 * "Waar te beginnen" panel is in flight — makes clear this is a calculation
 * in progress rather than empty/broken content. */
function RecommendationsLoadingPanel() {
  return (
    <div className="bg-muted/20 flex items-center gap-2 rounded-md border p-3 text-xs">
      <Spinner className="text-muted-foreground h-3.5 w-3.5" />
      <span className="text-muted-foreground">Aanbevolen maatregelen worden berekend…</span>
    </div>
  )
}

type WhereToStartPanelProps = {
  recommendations: FarmMeasureRecommendation[]
  activeIndId: string
  activeIndName: string
  fields: (FieldAreaInput & { b_name: string | null | undefined })[]
  basePath?: string
  basePathFormatter?: (b_id: string) => string
}

function WhereToStartPanel({
  recommendations,
  activeIndId,
  activeIndName,
  fields,
  basePath,
  basePathFormatter,
}: WhereToStartPanelProps) {
  const ranked = useMemo(() => {
    const areaByBid = new Map(fields.map((f) => [f.b_id, f.b_area ?? 0]))
    const grouped = new Map<
      string,
      { m_name: string; fieldIds: string[]; areaSum: number; weightedImpact: number }
    >()

    for (const rec of recommendations) {
      if (rec.indicator_id !== activeIndId) continue
      const area = areaByBid.get(rec.b_id) ?? 0
      const existing = grouped.get(rec.m_id) ?? {
        m_name: rec.m_name,
        fieldIds: [],
        areaSum: 0,
        weightedImpact: 0,
      }
      if (!existing.fieldIds.includes(rec.b_id)) {
        existing.fieldIds.push(rec.b_id)
        existing.areaSum += area
      }
      existing.weightedImpact += rec.measure_impact * (area || 1)
      grouped.set(rec.m_id, existing)
    }

    return [...grouped.entries()]
      .map(([m_id, g]) => ({
        m_id,
        m_name: g.m_name,
        fieldIds: g.fieldIds,
        fieldCount: g.fieldIds.length,
        area: g.areaSum,
        topFieldId: g.fieldIds[0],
        weightedImpact: g.weightedImpact,
      }))
      .sort((a, b) => b.weightedImpact - a.weightedImpact)
      .slice(0, 3)
  }, [recommendations, activeIndId, fields])

  if (ranked.length === 0) {
    return (
      <div className="bg-muted/20 rounded-md border p-3 text-xs">
        <p className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          Waar te beginnen
        </p>
        <p className="text-muted-foreground mt-1">
          Geen aanbevolen maatregelen gevonden voor {activeIndName}.
        </p>
      </div>
    )
  }

  // Links land on the field's indicators page with ?indicator=<id> so the
  // selected indicator's card — including its recommended measures — is
  // expanded and scrolled into view on arrival.
  const fieldHref = (b_id: string) =>
    `${basePathFormatter ? basePathFormatter(b_id) : `${basePath}/${b_id}`}?indicator=${encodeURIComponent(activeIndId)}`

  const nameByBid = new Map(fields.map((f) => [f.b_id, f.b_name ?? "Perceel"]))

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/10">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
        <Sparkles className="h-3.5 w-3.5" />
        Waar te beginnen — {activeIndName}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {ranked.map((item, index) => (
          <li key={item.m_id} className="text-xs">
            <Link
              to={fieldHref(item.topFieldId)}
              className="text-foreground hover:text-primary transition-colors hover:underline"
            >
              <span className="text-muted-foreground mr-1 font-mono">
                {item.m_id.replace("bln_", "")}
              </span>
              <span className="font-medium">{item.m_name}</span>
            </Link>
            <span className="text-muted-foreground">
              {" "}
              — {index === 0 ? "grootste" : "grote"} verwachte verbetering op{" "}
            </span>
            {item.fieldIds.slice(0, 3).map((b_id, i) => (
              <span key={b_id}>
                {i > 0 && <span className="text-muted-foreground"> · </span>}
                <Link to={fieldHref(b_id)} className="hover:text-foreground hover:underline">
                  {nameByBid.get(b_id)}
                </Link>
              </span>
            ))}
            {item.fieldCount > 3 && (
              <span className="text-muted-foreground"> +{item.fieldCount - 3}</span>
            )}
            <span className="text-muted-foreground"> ({item.area.toFixed(1)} ha)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
