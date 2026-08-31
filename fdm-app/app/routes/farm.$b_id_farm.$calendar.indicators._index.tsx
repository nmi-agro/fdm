import {
  getFields,
  getMeasuresForFarm,
  getMeasuresFromCatalogue,
  type PrincipalId,
  type Timeframe,
} from "@nmi-agro/fdm-core"
import { Map as MapIcon } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useParams,
} from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AggregationPainpoints } from "~/components/blocks/indicators/aggregation-painpoints"
import { AggregationTree } from "~/components/blocks/indicators/aggregation-tree"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { Bln3HelpDialog } from "~/components/blocks/indicators/bln3-help-dialog"
import { CategoryFilter } from "~/components/blocks/indicators/category-filter"
import { MeasuresToggle } from "~/components/blocks/indicators/measures-toggle"
import { HeatmapTable } from "~/components/blocks/indicators/table"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import { useAnalytics } from "~/hooks/use-analytics"
import {
  type FarmMeasureRecommendationsResult,
  type FieldBln3Score,
  getIndicatorsForFarm,
  getFarmMeasureOpportunities,
} from "~/integrations/bln3.server"
import { type AggregationId, computeAreaWeightedAggregation } from "~/lib/aggregations"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { type Ecosysteemdienst, INDICATORS } from "~/lib/indicators"
import { cn } from "~/lib/utils"

export const meta: MetaFunction = () => {
  return [
    {
      title: `Indicatoren | Bedrijfsoverzicht | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bedrijfsoverzicht BLN3 bodemkwaliteitsindicatoren per perceel.",
    },
  ]
}

async function getFarmMeasureRecommendations({
  principal_id,
  b_id_farm,
  b_ids,
  b_year,
  timeframe,
  fieldScores,
}: {
  principal_id: PrincipalId
  b_id_farm: string
  b_ids: string[]
  b_year: number
  timeframe?: Timeframe
  fieldScores: FieldBln3Score[]
}): Promise<FarmMeasureRecommendationsResult> {
  const [measuresByField, catalogue] = await Promise.all([
    getMeasuresForFarm(fdm, principal_id, b_id_farm, timeframe),
    getMeasuresFromCatalogue(fdm),
  ])
  const scoreByBid = new Map(fieldScores.map((s) => [s.b_id, s.score]))
  const activeMeasureIdsByField = new Map(
    b_ids.map((b_id) => [b_id, new Set((measuresByField.get(b_id) ?? []).map((m) => m.m_id))]),
  )

  const { opportunities, adviceAvailable } = await getFarmMeasureOpportunities({
    principal_id,
    b_ids,
    b_year,
    timeframe,
    scoreByBid,
    activeMeasureIdsByField,
    measureNameById: new Map(catalogue.map((m) => [m.m_id, m.m_name])),
  })

  return {
    adviceAvailable,
    recommendations: opportunities.flatMap((opportunity) =>
      opportunity.indicatorImpacts.map((impact) => ({
        b_id: opportunity.b_id,
        indicator_id: impact.indicator_id,
        m_id: opportunity.m_id,
        m_name: opportunity.m_name,
        measure_impact: impact.measure_impact,
      })),
    ),
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", {
        status: 400,
        statusText: "invalid: b_id_farm",
      })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const calendarYear = Number(params.calendar)
    const b_year =
      params.calendar === "all"
        ? new Date().getFullYear()
        : Number.isFinite(calendarYear)
          ? calendarYear
          : new Date().getFullYear()

    const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)

    const fieldScores = await getIndicatorsForFarm({
      principal_id: session.principal_id,
      b_id_farm,
      timeframe,
      preloadedFields: fields,
    })

    for (const result of fieldScores) {
      if (result.error) {
        reportError(new Error(`BLN3 score failed for field ${result.b_id}: ${result.error}`))
      }
    }

    // Lazy, batched farm-wide advice fetch — not awaited so it never blocks
    // the rest of the page; resolved client-side via <Await>/<Suspense>.
    // Note: the fetch starts in the loader even when the user never opens the
    // "Indicatoren" pivot that displays it. Accepted trade-off: gating it
    // behind the pivot would require a client-driven resource route; the
    // results are cached by withCalculationCache, so repeat visits are cheap.
    const farmMeasureRecommendationsPromise = getFarmMeasureRecommendations({
      principal_id: session.principal_id,
      b_id_farm,
      b_ids: fields.map((f) => f.b_id),
      b_year,
      timeframe,
      fieldScores,
    }).catch((error) => {
      reportError(error, { page: "farm indicators recommendations" })
      return { recommendations: [], adviceAvailable: false }
    })

    return {
      fields: fields.map((f) => ({
        b_id: f.b_id,
        b_name: f.b_name,
        b_bufferstrip: f.b_bufferstrip ?? false,
        b_area: f.b_area ?? null,
      })),
      fieldScores,
      asyncInsights: {
        farmMeasureRecommendations: farmMeasureRecommendationsPromise,
      },
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

export default function IndicatorsFarmIndex() {
  const { fields, fieldScores, asyncInsights } = useLoaderData<typeof loader>()
  const { b_id_farm, calendar } = useParams()
  const basePath = `/farm/${b_id_farm}/${calendar}/indicators`
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("indicators_viewed", { b_id_farm, calendar })
  }, [])

  const [activeCategories, setActiveCategories] = useState<Ecosysteemdienst[]>([])
  const [withMeasures, setWithMeasures] = useState(true)
  const [hideBufferstrips, setHideBufferstrips] = useState(true)
  const [fieldSearch, setFieldSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  // Debounce the pending indicator to avoid flickering on fast transitions
  const [showPending, setShowPending] = useState(false)
  useEffect(() => {
    if (!isPending) {
      setShowPending(false)
      return
    }
    const id = setTimeout(() => setShowPending(true), 150)
    return () => clearTimeout(id)
  }, [isPending])

  const showIndex = !withMeasures

  const handleToggleCategory = (dienst: Ecosysteemdienst) => {
    startTransition(() => {
      setActiveCategories((prev) =>
        prev.includes(dienst) ? prev.filter((c) => c !== dienst) : [...prev, dienst],
      )
    })
  }

  const handleClearCategories = () => {
    startTransition(() => setActiveCategories([]))
  }

  const handleToggleMeasures = (checked: boolean) => {
    startTransition(() => setWithMeasures(checked))
  }

  const handleToggleBufferstrips = (checked: boolean) => {
    startTransition(() => setHideBufferstrips(!checked))
  }

  // Filter fields based on bufferstrip toggle and search text
  const filteredFields = useMemo(() => {
    let result = hideBufferstrips ? fields.filter((f) => !f.b_bufferstrip) : fields
    if (fieldSearch) {
      const q = fieldSearch.toLowerCase()
      result = result.filter((f) => (f.b_name ?? f.b_id).toLowerCase().includes(q))
    }
    return result
  }, [fields, hideBufferstrips, fieldSearch])
  const filteredFieldIds = useMemo(
    () => new Set(filteredFields.map((f) => f.b_id)),
    [filteredFields],
  )
  const filteredScores = useMemo(
    () => fieldScores.filter((s) => filteredFieldIds.has(s.b_id)),
    [fieldScores, filteredFieldIds],
  )

  const scoreOf = (aggId: AggregationId) => {
    return computeAreaWeightedAggregation(filteredScores, filteredFields, aggId)
  }

  const indicatorScoreOf = (indId: string) => {
    let totalScore = 0
    let totalWeight = 0
    for (const s of filteredScores) {
      const scoreVal = s.score?.indicators.find((i) => i.indicator_id === indId)?.score
      if (scoreVal !== undefined && scoreVal !== null && !Number.isNaN(scoreVal)) {
        const field = filteredFields.find((f) => f.b_id === s.b_id)
        const weight = field?.b_area ?? 0
        if (weight > 0) {
          totalScore += scoreVal * weight
          totalWeight += weight
        }
      }
    }
    return totalWeight > 0 ? totalScore / totalWeight : null
  }

  return (
    <>
      <FarmTitle
        title="Indicatoren"
        description="BLN3 bodemkwaliteitsindicatoren voor alle percelen op dit bedrijf."
        rightNode={
          <div className="flex items-center gap-2">
            <Bln3BetaBanner />
            <Bln3HelpDialog />
          </div>
        }
      />

      <FarmContent>
        <div className="space-y-6 pb-10">
          {/* Aggregations hierarchy tree */}
          <section className="space-y-3">
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">Bedrijfsgemiddelde score</CardTitle>
                    <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                      <NavLink to={`/farm/${b_id_farm}/${calendar}/atlas/indicators`}>
                        <MapIcon className="h-3.5 w-3.5" />
                        Kaartweergave
                      </NavLink>
                    </Button>
                  </div>
                  {/* <CardDescription className="text-xs">
                                    Hieronder ziet u de officiële BLN-bodemkwaliteitshiërarchie. De scores zijn berekend als 
                                    <strong> gewogen gemiddelden op basis van perceeloppervlakte</strong>. Klik op de knoppen om verder in te zoomen op branches en onderliggende indicatoren.
                                </CardDescription> */}
                </CardHeader>
                <CardContent>
                  <AggregationTree
                    scoreOf={scoreOf}
                    indicatorScoreOf={indicatorScoreOf}
                    fields={filteredFields}
                    fieldScores={filteredScores}
                    basePath={basePath}
                  />
                </CardContent>
              </Card>
              <div>
                <AggregationPainpoints
                  fields={filteredFields}
                  fieldScores={filteredScores}
                  basePath={basePath}
                  farmMeasureRecommendationsPromise={asyncInsights.farmMeasureRecommendations}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Indicator table section */}
          <Card
            className={cn(
              "bg-muted/10 transition-opacity duration-150",
              showPending && "pointer-events-none opacity-50",
            )}
          >
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-base font-bold">Detailweergave per perceel</CardTitle>
              <CardDescription className="text-xs">
                Alle {INDICATORS.length} indicatoren voor alle percelen, met filters en
                zoekmogelijkheden.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CategoryFilter
                  activeCategories={activeCategories}
                  onToggle={handleToggleCategory}
                  onClearAll={handleClearCategories}
                />
                <div className="flex flex-wrap items-center gap-4">
                  <Input
                    placeholder="Zoek perceel…"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="h-8 w-44 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      id="bufferstrip-toggle"
                      checked={!hideBufferstrips}
                      onCheckedChange={handleToggleBufferstrips}
                    />
                    <Label
                      htmlFor="bufferstrip-toggle"
                      className="cursor-pointer text-sm select-none"
                    >
                      {hideBufferstrips ? "Zonder bufferstroken" : "Met bufferstroken"}
                    </Label>
                  </div>
                  <MeasuresToggle withMeasures={withMeasures} onToggle={handleToggleMeasures} />
                </div>
              </div>
              <HeatmapTable
                fields={filteredFields.map((field) => ({
                  b_id: field.b_id,
                  b_name: field.b_name,
                }))}
                fieldScores={filteredScores}
                activeCategories={activeCategories}
                showIndex={showIndex}
                basePath={basePath}
              />
            </CardContent>
          </Card>
        </div>
      </FarmContent>
    </>
  )
}
