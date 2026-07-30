import type { FeatureCollection, Geometry } from "geojson"
import { type CultivationForHoofdteelt, findHoofdteelt } from "@nmi-agro/fdm-calculator"
import {
  checkPermission,
  getCultivations,
  getField,
  getFields,
  getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { getCultivationCatalogue } from "@nmi-agro/fdm-data"
import { simplify } from "@turf/simplify"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import {
  data,
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  useParams,
} from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AggregationTree } from "~/components/blocks/indicators/aggregation-tree"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { CategoryFilter } from "~/components/blocks/indicators/category-filter"
import { FieldInputDialog } from "~/components/blocks/indicators/field-input-dialog"
import { IndicatorCard } from "~/components/blocks/indicators/indicator-card"
import { MeasuresToggle } from "~/components/blocks/indicators/measures-toggle"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import {
  type FieldBln3Score,
  getFieldMeasuresForIndicators,
  getIndicatorsForFarm,
  getIndicatorsForField,
} from "~/integrations/bln3.server"
import { getMapStyle } from "~/integrations/map"
import { AGG_IDS, type AggregationId, getFieldAggregationScore } from "~/lib/aggregations"
import { getSession } from "~/lib/auth.server"
import { BCS_INDICATORS } from "~/lib/bcs"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { type Ecosysteemdienst, INDICATORS, scoreToDisplay } from "~/lib/indicators"

const FieldMap = lazy(() => import("~/components/blocks/indicators/field-map"))

// ── Map score selector options ─────────────────────────────────────────────

type ScoreOption = { value: string; label: string }
type ScoreOptionGroup = { group: string; options: ScoreOption[] }

const MAP_SCORE_OPTION_GROUPS: ScoreOptionGroup[] = [
  {
    group: "Samenvatting",
    options: [
      { value: "avg", label: "Gemiddelde (alle indicatoren)" },
      { value: "S_BLN", label: "BLN Bodemkwaliteit" },
      { value: "S_BBWP", label: "BedrijfsBodemWaterPlan (BBWP)" },
      { value: "S_WAT_BLN", label: "Water" },
      { value: "S_NUT_BLN", label: "Nutriëntenkringloop" },
      { value: "S_CLIM_BLN", label: "Klimaat" },
      { value: "S_PROD_BLN", label: "Productie (OBI)" },
    ],
  },
  {
    group: "Water Subaggregaties",
    options: [
      { value: "S_GW_QUANT_BLN", label: "Grondwaterkwantiteit" },
      { value: "S_GW_QUAL_BLN", label: "Grondwaterkwaliteit" },
      { value: "S_SW_QUAL_BLN", label: "Oppervlaktewaterkwaliteit" },
    ],
  },
  {
    group: "Productie Subaggregaties",
    options: [
      { value: "S_PROD_BIOL_BLN", label: "Biologische Bodemkwaliteit" },
      { value: "S_PROD_CHEM_BLN", label: "Chemische Bodemkwaliteit" },
      { value: "S_PROD_PHYS_BLN", label: "Fysische Bodemkwaliteit" },
    ],
  },
  {
    group: "Water Indicatoren",
    options: INDICATORS.filter((i) => i.ecosysteemdienst === "Water").map((i) => ({
      value: i.id,
      label: i.name,
    })),
  },
  {
    group: "Nutriënten & Klimaat Indicatoren",
    options: INDICATORS.filter((i) =>
      ["Nutriëntenkringloop", "Klimaat"].includes(i.ecosysteemdienst),
    ).map((i) => ({
      value: i.id,
      label: i.name,
    })),
  },
  {
    group: "Productie (OBI) Indicatoren",
    options: INDICATORS.filter((i) => i.ecosysteemdienst === "Productie").map((i) => ({
      value: i.id,
      label: i.name,
    })),
  },
]

function findScoreLabel(value: string): string {
  for (const group of MAP_SCORE_OPTION_GROUPS) {
    const opt = group.options.find((o) => o.value === value)
    if (opt) return opt.label
  }
  return value
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const fieldName = loaderData?.field?.b_name ?? "Perceel"
  return [
    {
      title: `${fieldName} | Indicatoren | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: `BLN3 bodemkwaliteitsindicatoren voor ${fieldName}.`,
    },
  ]
}

function computeFieldScores(fs: FieldBln3Score | undefined): Record<string, number> {
  const result: Record<string, number> = { avg: -1 }
  for (const aggId of AGG_IDS) {
    result[aggId] = -1
  }
  if (!fs?.score) return result

  const indicators = fs.score.indicators

  for (const ind of indicators) {
    result[ind.indicator_id] = scoreToDisplay(ind.score)
  }

  const allVals = indicators.map((i) => i.score).filter((s) => s != null && !Number.isNaN(s))
  result.avg =
    allVals.length > 0
      ? Math.round((allVals.reduce((a, b) => a + b, 0) / allVals.length) * 100)
      : -1

  for (const aggId of AGG_IDS) {
    const scoreVal = getFieldAggregationScore(fs.score, aggId)
    result[aggId] = scoreVal !== null ? scoreToDisplay(scoreVal) : -1
  }

  return result
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const b_id = params.b_id
    const calendar = params.calendar
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", {
        status: 400,
        statusText: "invalid: b_id_farm",
      })
    }
    if (!b_id) {
      throw data("invalid: b_id", {
        status: 400,
        statusText: "invalid: b_id",
      })
    }
    const calendarYear = Number(calendar)
    if (!Number.isFinite(calendarYear)) {
      throw data("invalid: calendar", {
        status: 400,
        statusText: "invalid: calendar",
      })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)

    // Load in parallel: current field, all fields, BLN3 score + inputs, active measures, cultivations, BRP catalogue
    // Cultivations are fetched without timeframe to cover multi-year history (for display)
    const [
      field,
      fields,
      bln3Result,
      fieldMeasures,
      cultivations,
      brpCatalogue,
      fieldWritePermission,
    ] = await Promise.all([
      getField(fdm, session.principal_id, b_id),
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getIndicatorsForField({
        principal_id: session.principal_id,
        b_id,
        timeframe,
      }),
      getFieldMeasuresForIndicators({
        principal_id: session.principal_id,
        b_id,
        timeframe,
      }),
      getCultivations(fdm, session.principal_id, b_id),
      getCultivationCatalogue("brp"),
      checkPermission(
        fdm,
        "field",
        "write",
        b_id,
        session.principal_id,
        "routes/farm.$b_id_farm.$calendar.indicators.$b_id",
        false,
      ),
    ])
    const fieldScore = bln3Result.score
    const bln3Inputs = bln3Result.inputs

    if (!field) {
      throw data("not found: b_id", {
        status: 404,
        statusText: "not found: b_id",
      })
    }

    // Also fetch all farm scores (for map colouring)
    const farmScores = await getIndicatorsForFarm({
      principal_id: session.principal_id,
      b_id_farm,
      timeframe,
      preloadedFields: fields,
    })

    for (const result of farmScores) {
      if (result.error) {
        reportError(new Error(`BLN3 score failed for field ${result.b_id}: ${result.error}`))
      }
    }

    // Build GeoJSON for mini map (all farm fields, coloured by avg score by default)
    const fieldsGeoJSON: FeatureCollection = {
      type: "FeatureCollection",
      features: fields.map((f) => {
        const fs = farmScores.find((s) => s.b_id === f.b_id)
        const scores = computeFieldScores(fs)
        return {
          type: "Feature" as const,
          properties: {
            b_id: f.b_id,
            b_name: f.b_name ?? null,
            b_area: f.b_area ?? null,
            avgScore: scores.avg, // kept for backward compat
            ...scores,
          },
          geometry: simplify(f.b_geometry as Geometry, {
            tolerance: 0.00001,
            highQuality: true,
          }),
        }
      }),
    }

    // GeoJSON for the highlighted (selected) field
    const selectedFeature = fieldsGeoJSON.features.find((f) => f.properties?.b_id === b_id)
    const selectedFieldGeoJSON: FeatureCollection = {
      type: "FeatureCollection",
      features: selectedFeature ? [selectedFeature] : [],
    }

    // Extract soil inputs already collected by collectInputForBln3Score.
    // Use getSoilParametersDescription for proper Dutch names and units.
    const soilParamLabel = new Map(
      getSoilParametersDescription().map((p) => [
        p.parameter as string,
        { name: p.name, unit: p.unit ?? null },
      ]),
    )
    const bcsKeySet = new Set(BCS_INDICATORS.map((i) => i.key as string))
    const soilMeasurements = Object.entries(bln3Inputs)
      .filter(
        ([key, value]) =>
          key.startsWith("a_") &&
          key !== "a_lat" &&
          key !== "a_lon" &&
          !bcsKeySet.has(key) &&
          typeof value === "number",
      )
      .map(([key, value]) => {
        const meta = soilParamLabel.get(key)
        return {
          key,
          label: meta?.name ?? key.replace(/^a_/, "").replace(/_/g, " "),
          unit: meta?.unit ?? null,
          value: value as number,
        }
      })

    // Collect BCS indicator scores separately for the dialog.
    const bcsScores = BCS_INDICATORS.flatMap((ind) => {
      const value = (bln3Inputs as Record<string, unknown>)[ind.key]
      if (typeof value !== "number") return []
      return [
        {
          key: ind.key as string,
          name: ind.name,
          value,
          direction: ind.direction,
        },
      ]
    })

    // Derive the current cultivation (FarmTitle badge) using the hoofdteelt rule.
    const currentCultivation = getMainCultivation(cultivations, calendar ?? "")

    // Build cultivation display list using findHoofdteelt (May 15–July 15 duration
    // window) — exactly consistent with what is submitted to the BLN3 API.
    // Only show years within the range of known cultivation data; gaps get groene braak.
    const maxCalendarYear = calendarYear
    const cultivationsForHoofdteelt: CultivationForHoofdteelt[] = cultivations.map((c) => ({
      b_lu_catalogue: c.b_lu_catalogue,
      b_lu_start: c.b_lu_start ?? null,
      b_lu_end: c.b_lu_end ?? null,
    }))
    const minCalendarYear = cultivations.reduce((min, c) => {
      const y = c.b_lu_start?.getFullYear()
      return y !== undefined && y < min ? y : min
    }, maxCalendarYear)

    // Build a lookup map from the BRP catalogue for fallback name resolution
    // (e.g. nl_6794 = "groene braak, spontane opkomst" when no field record exists).
    const brpNameByCode = new Map(brpCatalogue.map((item) => [item.b_lu_catalogue, item.b_lu_name]))

    const cultivationSummaries: Array<{
      name: string
      year: number
      croprotation: string | null
    }> = []
    for (let year = maxCalendarYear; year >= minCalendarYear; year--) {
      const catalogue = findHoofdteelt(cultivationsForHoofdteelt, year)
      const match = cultivations.find((c) => c.b_lu_catalogue === catalogue)
      cultivationSummaries.push({
        name: match?.b_lu_name ?? brpNameByCode.get(catalogue) ?? catalogue,
        year,
        croprotation: match?.b_lu_croprotation ?? null,
      })
    }

    return {
      field,
      fieldScore,
      fieldMeasures,
      fieldsGeoJSON,
      selectedFieldGeoJSON,
      mapStyle: getMapStyle("satellite"),
      currentCultivationName: currentCultivation?.b_lu_name ?? null,
      currentCultivationCropRotation: currentCultivation?.b_lu_croprotation ?? null,
      cultivationSummaries,
      soilData: {
        soilType: bln3Inputs.b_soiltype_agr ?? null,
        gwlClass: bln3Inputs.b_gwl_class ?? null,
        measurements: soilMeasurements,
        bcsScores,
      },
      fieldList: fields.map((f) => ({
        b_id: f.b_id,
        b_name: f.b_name ?? null,
      })),
      fieldWritePermission,
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

const SESSION_KEY_CATEGORY = "bln3_field_categories"
const SESSION_KEY_MEASURES = "bln3_field_measures_toggle"
const SESSION_KEY_MAP_SCORE = "bln3_map_score"

function readSessionCategories(): Ecosysteemdienst[] {
  if (typeof window === "undefined") return []
  try {
    const stored = sessionStorage.getItem(SESSION_KEY_CATEGORY)
    return stored ? (JSON.parse(stored) as Ecosysteemdienst[]) : []
  } catch {
    return []
  }
}

function readSessionMeasures(): boolean {
  if (typeof window === "undefined") return true
  try {
    const stored = sessionStorage.getItem(SESSION_KEY_MEASURES)
    return stored === null ? true : stored === "true"
  } catch {
    return true
  }
}

function readSessionMapScore(): string {
  if (typeof window === "undefined") return "S_BLN"
  try {
    return sessionStorage.getItem(SESSION_KEY_MAP_SCORE) ?? "S_BLN"
  } catch {
    return "S_BLN"
  }
}

export default function IndicatorsFieldDetail() {
  const {
    field,
    fieldScore,
    fieldMeasures,
    fieldsGeoJSON,
    selectedFieldGeoJSON,
    mapStyle,
    currentCultivationName,
    currentCultivationCropRotation,
    cultivationSummaries,
    soilData,
  } = useLoaderData<typeof loader>()
  const { b_id_farm, calendar, b_id } = useParams()

  // Restore filter state from sessionStorage
  const [activeCategories, setActiveCategories] = useState<Ecosysteemdienst[]>(() =>
    readSessionCategories(),
  )
  const [withMeasures, setWithMeasures] = useState<boolean>(() => readSessionMeasures())
  const [mapScoreKey, setMapScoreKey] = useState<string>(() => readSessionMapScore())

  // Persist to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_CATEGORY, JSON.stringify(activeCategories))
    } catch {}
  }, [activeCategories])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_MEASURES, String(withMeasures))
    } catch {}
  }, [withMeasures])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_MAP_SCORE, mapScoreKey)
    } catch {}
  }, [mapScoreKey])

  const handleCategoryToggle = (dienst: Ecosysteemdienst) => {
    setActiveCategories((prev) =>
      prev.includes(dienst) ? prev.filter((c) => c !== dienst) : [...prev, dienst],
    )
  }

  const handleCategoryAll = () => setActiveCategories([])
  const handleMeasuresToggle = (value: boolean) => setWithMeasures(value)

  // Filter indicators by active ecosystem service
  const visibleIndicatorInfos = useMemo(
    () =>
      activeCategories.length === 0
        ? INDICATORS
        : INDICATORS.filter((i) => activeCategories.includes(i.ecosysteemdienst)),
    [activeCategories],
  )

  // Sort indicator results: red (< 40) → yellow (40–69) → green (≥ 70), then alphabetical
  const sortedIndicatorResults = useMemo(() => {
    if (!fieldScore) return []

    const results = visibleIndicatorInfos.flatMap((info) => {
      const result = fieldScore.indicators.find((r) => r.indicator_id === info.id)
      if (!result) return []
      return [{ info, result }]
    })

    return results.sort((a, b) => {
      const scoreA = scoreToDisplay(withMeasures ? a.result.score : a.result.index)
      const scoreB = scoreToDisplay(withMeasures ? b.result.score : b.result.index)
      const tierOrder = (s: number) => (s < 40 ? 0 : s < 70 ? 1 : 2)
      const tierDiff = tierOrder(scoreA) - tierOrder(scoreB)
      if (tierDiff !== 0) return tierDiff
      return a.info.id.localeCompare(b.info.id)
    })
  }, [fieldScore, visibleIndicatorInfos, withMeasures])

  const scoreOf = (aggId: AggregationId) => {
    return getFieldAggregationScore(fieldScore, aggId)
  }

  const indicatorScoreOf = (indId: string) => {
    if (!fieldScore) return null
    const ind = fieldScore.indicators.find((i) => i.indicator_id === indId)
    if (!ind) return null
    return withMeasures ? ind.score : ind.index
  }

  const measuresHref = `/farm/${b_id_farm}/${calendar}/measures/${b_id}`
  const basePath = `/farm/${b_id_farm}/${calendar}/indicators`

  return (
    <>
      <FarmTitle
        title={field.b_name ?? `Perceel ${b_id}`}
        description={currentCultivationName ?? "Geen teelt geregistreerd"}
        descriptionNode={
          currentCultivationName ? (
            <span className="mt-0.5 flex items-center gap-1.5">
              <Badge
                style={{
                  backgroundColor: getCultivationColor(currentCultivationCropRotation ?? undefined),
                }}
                className="gap-1 text-white"
                variant="default"
              >
                {currentCultivationName}
              </Badge>
            </span>
          ) : (
            <p className="text-muted-foreground text-sm">Geen teelt geregistreerd</p>
          )
        }
        rightNode={<Bln3BetaBanner />}
      />

      <div className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* ── Main content column ──────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-4">
            {/* Aggregations tree + input dialog */}
            <div className="flex flex-col gap-4">
              {fieldScore && (
                <Card className="border-border shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base font-bold">Perceelsscore</CardTitle>
                        <CardDescription className="mt-1.5 text-xs">
                          Hieronder ziet u de officiële BLN-bodemkwaliteitshiërarchie voor dit
                          perceel. Klik op de knoppen om in te zoomen.
                        </CardDescription>
                      </div>
                      <div className="shrink-0">
                        <FieldInputDialog
                          cultivations={cultivationSummaries}
                          fieldMeasures={fieldMeasures}
                          soilData={soilData}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <AggregationTree scoreOf={scoreOf} indicatorScoreOf={indicatorScoreOf} />
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CategoryFilter
                activeCategories={activeCategories}
                onToggle={handleCategoryToggle}
                onClearAll={handleCategoryAll}
              />
              <MeasuresToggle withMeasures={withMeasures} onToggle={handleMeasuresToggle} />
            </div>

            {/* No score state */}
            {!fieldScore && (
              <div className="bg-muted/30 text-muted-foreground rounded-lg border p-8 text-center text-sm">
                <p className="font-medium">Geen indicatoren beschikbaar</p>
                <p className="mt-1">
                  Er is geen bodemanalyse beschikbaar voor dit perceel, of de berekening is mislukt.
                </p>
              </div>
            )}

            {/* Indicator cards */}
            {sortedIndicatorResults.length > 0 && (
              <div className="space-y-2">
                {sortedIndicatorResults.map(({ info, result }) => (
                  <IndicatorCard
                    key={info.id}
                    info={info}
                    result={result}
                    fieldMeasures={fieldMeasures}
                    measuresHref={measuresHref}
                    showIndex={!withMeasures}
                  />
                ))}
              </div>
            )}

            {/* Adopted measures for this field */}
            {fieldMeasures.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Maatregelen</p>
                    <Link
                      to={measuresHref}
                      className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                    >
                      Beheren
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {fieldMeasures.map((m) => (
                      <div
                        key={m.b_id_measure}
                        className="bg-card flex items-center gap-3 rounded-md border px-3 py-2"
                      >
                        <span className="text-muted-foreground w-16 shrink-0 truncate font-mono text-xs">
                          {m.m_id.replace("bln_", "")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {m.m_name}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {m.m_end === null
                            ? "Doorlopend"
                            : `t/m ${format(new Date(m.m_end), "d MMM yyyy", { locale: nl })}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Map — right on desktop, below on mobile ──────── */}
          <aside className="w-full shrink-0 lg:w-72 xl:w-80">
            <div className="relative h-64 overflow-hidden rounded-lg border sm:h-80 lg:sticky lg:top-4 lg:h-[560px]">
              {/* Score selector overlaid on top of the map */}
              <div className="absolute top-2 right-2 z-10">
                <Select value={mapScoreKey} onValueChange={setMapScoreKey}>
                  <SelectTrigger className="bg-background/90 h-7 w-48 text-xs shadow-sm backdrop-blur-sm">
                    <SelectValue placeholder="Kies score" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {MAP_SCORE_OPTION_GROUPS.map((group) => (
                      <SelectGroup key={group.group}>
                        <SelectLabel className="text-xs">{group.group}</SelectLabel>
                        {group.options.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Suspense fallback={<div className="bg-muted h-full animate-pulse" />}>
                <FieldMap
                  fieldsGeoJSON={fieldsGeoJSON as FeatureCollection}
                  selectedFieldGeoJSON={selectedFieldGeoJSON as FeatureCollection}
                  mapStyle={mapStyle}
                  basePath={basePath}
                  scoreKey={mapScoreKey}
                  scoreLabel={findScoreLabel(mapScoreKey)}
                  height="100%"
                />
              </Suspense>
            </div>
            <p className="text-muted-foreground mt-2 px-1 text-[11px]">
              Percelen gekleurd op gekozen score. Klik om te wisselen van perceel.
            </p>
          </aside>
        </div>
      </div>
    </>
  )
}
