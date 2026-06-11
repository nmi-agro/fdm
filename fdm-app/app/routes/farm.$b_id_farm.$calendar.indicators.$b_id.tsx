import {
    type CultivationForHoofdteelt,
    findHoofdteelt,
} from "@nmi-agro/fdm-calculator"
import {
    getCultivations,
    getField,
    getFields,
    getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { getCultivationCatalogue } from "@nmi-agro/fdm-data"
import { simplify } from "@turf/simplify"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import type { FeatureCollection, Geometry } from "geojson"
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
import { AggregationCard } from "~/components/blocks/indicators/aggregation-card"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { CategoryFilter } from "~/components/blocks/indicators/category-filter"
import { FieldInputDialog } from "~/components/blocks/indicators/field-input-dialog"
import { IndicatorCard } from "~/components/blocks/indicators/indicator-card"
import { MeasuresToggle } from "~/components/blocks/indicators/measures-toggle"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
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
import { getSession } from "~/lib/auth.server"
import { BCS_INDICATORS } from "~/lib/bcs"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
    ECOSYSTEEMDIENST_FULL_NAME,
    ECOSYSTEEMDIENST_INDICATOR_IDS,
    ECOSYSTEEMDIENSTEN,
    type Ecosysteemdienst,
    INDICATORS,
    scoreToDisplay,
} from "~/lib/indicators"

const FieldMap = lazy(() => import("~/components/blocks/indicators/field-map"))

// ── Map score selector options ─────────────────────────────────────────────

type ScoreOption = { value: string; label: string }
type ScoreOptionGroup = { group: string; options: ScoreOption[] }

const MAP_SCORE_OPTION_GROUPS: ScoreOptionGroup[] = [
    {
        group: "Samenvatting",
        options: [
            { value: "avg", label: "Gemiddelde (alle indicatoren)" },
            ...ECOSYSTEEMDIENSTEN.map((dienst) => ({
                value: `eco_${dienst}`,
                label: dienst,
            })),
        ],
    },
    ...ECOSYSTEEMDIENSTEN.map((dienst) => ({
        group: dienst,
        options: INDICATORS.filter((i) => i.ecosysteemdienst === dienst).map(
            (i) => ({
                value: i.id,
                label: i.name,
            }),
        ),
    })),
]

function findScoreLabel(value: string): string {
    for (const group of MAP_SCORE_OPTION_GROUPS) {
        const opt = group.options.find((o) => o.value === value)
        if (opt) return opt.label
    }
    return value
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const fieldName = data?.field?.b_name ?? "Perceel"
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

function computeFieldScores(
    fs: FieldBln3Score | undefined,
): Record<string, number> {
    const result: Record<string, number> = { avg: -1 }
    for (const dienst of ECOSYSTEEMDIENSTEN) {
        result[`eco_${dienst}`] = -1
    }
    if (!fs?.score) return result

    const indicators = fs.score.indicators

    for (const ind of indicators) {
        result[ind.indicator_id] = scoreToDisplay(ind.score)
    }

    const allVals = indicators
        .map((i) => i.score)
        .filter((s) => s != null && !Number.isNaN(s))
    result.avg =
        allVals.length > 0
            ? Math.round(
                  (allVals.reduce((a, b) => a + b, 0) / allVals.length) * 100,
              )
            : -1

    for (const dienst of ECOSYSTEEMDIENSTEN) {
        const ids = ECOSYSTEEMDIENST_INDICATOR_IDS[dienst]
        const vals = ids.flatMap((id) => {
            const r = indicators.find((i) => i.indicator_id === id)
            return r != null && Number.isFinite(r.score) ? [r.score] : []
        })
        result[`eco_${dienst}`] =
            vals.length > 0
                ? Math.round(
                      (vals.reduce((a, b) => a + b, 0) / vals.length) * 100,
                  )
                : -1
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
                reportError(
                    new Error(
                        `BLN3 score failed for field ${result.b_id}: ${result.error}`,
                    ),
                )
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
        const selectedFeature = fieldsGeoJSON.features.find(
            (f) => f.properties?.b_id === b_id,
        )
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
                    label:
                        meta?.name ?? key.replace(/^a_/, "").replace(/_/g, " "),
                    unit: meta?.unit ?? null,
                    value: value as number,
                }
            })

        // Collect BCS indicator scores separately for the dialog.
        const bcsScores = BCS_INDICATORS.flatMap((ind) => {
            const value = (bln3Inputs as Record<string, unknown>)[ind.key]
            if (typeof value !== "number") return []
            return [{ key: ind.key as string, name: ind.name, value, direction: ind.direction }]
        })

        // Derive the current cultivation (FarmTitle badge) using the May 15th point check.
        const currentCultivation = getDefaultCultivation(
            cultivations,
            calendar ?? "",
        )

        // Build cultivation display list using findHoofdteelt (May 15–July 15 duration
        // window) — exactly consistent with what is submitted to the BLN3 API.
        // Only show years within the range of known cultivation data; gaps get groene braak.
        const maxCalendarYear = calendarYear
        const cultivationsForHoofdteelt: CultivationForHoofdteelt[] =
            cultivations.map((c) => ({
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
        const brpNameByCode = new Map(
            brpCatalogue.map((item) => [item.b_lu_catalogue, item.b_lu_name]),
        )

        const cultivationSummaries: Array<{
            name: string
            year: number
            croprotation: string | null
        }> = []
        for (let year = maxCalendarYear; year >= minCalendarYear; year--) {
            const catalogue = findHoofdteelt(cultivationsForHoofdteelt, year)
            const match = cultivations.find(
                (c) => c.b_lu_catalogue === catalogue,
            )
            cultivationSummaries.push({
                name:
                    match?.b_lu_name ??
                    brpNameByCode.get(catalogue) ??
                    catalogue,
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
            currentCultivationCropRotation:
                currentCultivation?.b_lu_croprotation ?? null,
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
    if (typeof window === "undefined") return "avg"
    try {
        return sessionStorage.getItem(SESSION_KEY_MAP_SCORE) ?? "avg"
    } catch {
        return "avg"
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
    const [activeCategories, setActiveCategories] = useState<
        Ecosysteemdienst[]
    >(() => readSessionCategories())
    const [withMeasures, setWithMeasures] = useState<boolean>(() =>
        readSessionMeasures(),
    )
    const [mapScoreKey, setMapScoreKey] = useState<string>(() =>
        readSessionMapScore(),
    )

    // Persist to sessionStorage on change
    useEffect(() => {
        try {
            sessionStorage.setItem(
                SESSION_KEY_CATEGORY,
                JSON.stringify(activeCategories),
            )
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
            prev.includes(dienst)
                ? prev.filter((c) => c !== dienst)
                : [...prev, dienst],
        )
    }

    const handleCategoryAll = () => setActiveCategories([])
    const handleMeasuresToggle = (value: boolean) => setWithMeasures(value)

    // Filter indicators by active ecosystem service
    const visibleIndicatorInfos = useMemo(
        () =>
            activeCategories.length === 0
                ? INDICATORS
                : INDICATORS.filter((i) =>
                      activeCategories.includes(i.ecosysteemdienst),
                  ),
        [activeCategories],
    )

    // Sort indicator results: red (< 40) → yellow (40–69) → green (≥ 70), then alphabetical
    const sortedIndicatorResults = useMemo(() => {
        if (!fieldScore) return []

        const results = visibleIndicatorInfos.flatMap((info) => {
            const result = fieldScore.indicators.find(
                (r) => r.indicator_id === info.id,
            )
            if (!result) return []
            return [{ info, result }]
        })

        return results.sort((a, b) => {
            const scoreA = scoreToDisplay(
                withMeasures ? a.result.score : a.result.index,
            )
            const scoreB = scoreToDisplay(
                withMeasures ? b.result.score : b.result.index,
            )
            const tierOrder = (s: number) => (s < 40 ? 0 : s < 70 ? 1 : 2)
            const tierDiff = tierOrder(scoreA) - tierOrder(scoreB)
            if (tierDiff !== 0) return tierDiff
            return a.info.id.localeCompare(b.info.id)
        })
    }, [fieldScore, visibleIndicatorInfos, withMeasures])

    // Per-ecosystem-service aggregation scores for this field
    const ecosysteemdienst_scores = useMemo(
        () =>
            ECOSYSTEEMDIENSTEN.map((dienst) => {
                if (!fieldScore) return { dienst, score: null, index: null }
                const ids = ECOSYSTEEMDIENST_INDICATOR_IDS[dienst]
                const scoreVals = ids.flatMap((id) => {
                    const r = fieldScore.indicators.find(
                        (i) => i.indicator_id === id,
                    )
                    return r ? [r.score] : []
                })
                const indexVals = ids.flatMap((id) => {
                    const r = fieldScore.indicators.find(
                        (i) => i.indicator_id === id,
                    )
                    return r ? [r.index] : []
                })
                return {
                    dienst,
                    score:
                        scoreVals.length > 0
                            ? scoreVals.reduce((a, b) => a + b, 0) /
                              scoreVals.length
                            : null,
                    index:
                        indexVals.length > 0
                            ? indexVals.reduce((a, b) => a + b, 0) /
                              indexVals.length
                            : null,
                }
            }),
        [fieldScore],
    )

    const measuresHref = `/farm/${b_id_farm}/${calendar}/measures/${b_id}`
    const basePath = `/farm/${b_id_farm}/${calendar}/indicators`

    return (
        <>
            <FarmTitle
                title={field.b_name ?? `Perceel ${b_id}`}
                description={
                    currentCultivationName ?? "Geen teelt geregistreerd"
                }
                descriptionNode={
                    currentCultivationName ? (
                        <span className="flex items-center gap-1.5 mt-0.5">
                            <Badge
                                style={{
                                    backgroundColor: getCultivationColor(
                                        currentCultivationCropRotation ??
                                            undefined,
                                    ),
                                }}
                                className="text-white gap-1"
                                variant="default"
                            >
                                {currentCultivationName}
                            </Badge>
                        </span>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Geen teelt geregistreerd
                        </p>
                    )
                }
            />

            <div className="px-4 sm:px-6 lg:px-8 pb-16">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* ── Main content column ──────────────────────────── */}
                    <div className="flex-1 min-w-0 space-y-4">
                        <Bln3BetaBanner />

                        {/* Aggregation cards + input dialog */}
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            {ecosysteemdienst_scores.some(
                                (e) => e.score !== null,
                            ) && (
                                <div className="space-y-2 flex-1">
                                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        Ecosysteemdiensten
                                    </p>
                                    <div className="flex gap-3">
                                        {ecosysteemdienst_scores.map(
                                            ({ dienst, score, index }) =>
                                                score !== null ? (
                                                    <AggregationCard
                                                        key={dienst}
                                                        label={dienst}
                                                        name={
                                                            ECOSYSTEEMDIENST_FULL_NAME[
                                                                dienst
                                                            ]
                                                        }
                                                        score01={score}
                                                        index01={index}
                                                        showIndex={
                                                            !withMeasures
                                                        }
                                                    />
                                                ) : null,
                                        )}
                                    </div>
                                </div>
                            )}
                            <FieldInputDialog
                                cultivations={cultivationSummaries}
                                fieldMeasures={fieldMeasures}
                                soilData={soilData}
                            />
                        </div>

                        <Separator />

                        {/* Filters */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <CategoryFilter
                                activeCategories={activeCategories}
                                onToggle={handleCategoryToggle}
                                onClearAll={handleCategoryAll}
                            />
                            <MeasuresToggle
                                withMeasures={withMeasures}
                                onToggle={handleMeasuresToggle}
                            />
                        </div>

                        {/* No score state */}
                        {!fieldScore && (
                            <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                                <p className="font-medium">
                                    Geen indicatoren beschikbaar
                                </p>
                                <p className="mt-1">
                                    Er is geen bodemanalyse beschikbaar voor dit
                                    perceel, of de berekening is mislukt.
                                </p>
                            </div>
                        )}

                        {/* Indicator cards */}
                        {sortedIndicatorResults.length > 0 && (
                            <div className="space-y-2">
                                {sortedIndicatorResults.map(
                                    ({ info, result }) => (
                                        <IndicatorCard
                                            key={info.id}
                                            info={info}
                                            result={result}
                                            fieldMeasures={fieldMeasures}
                                            measuresHref={measuresHref}
                                            showIndex={!withMeasures}
                                        />
                                    ),
                                )}
                            </div>
                        )}

                        {/* Adopted measures for this field */}
                        {fieldMeasures.length > 0 && (
                            <>
                                <Separator />
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-semibold">
                                            Maatregelen
                                        </p>
                                        <Link
                                            to={measuresHref}
                                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            Beheren
                                        </Link>
                                    </div>
                                    <div className="space-y-2">
                                        {fieldMeasures.map((m) => (
                                            <div
                                                key={m.b_id_measure}
                                                className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                                            >
                                                <span className="shrink-0 font-mono text-xs text-muted-foreground w-16 truncate">
                                                    {m.m_id.replace("bln_", "")}
                                                </span>
                                                <span className="flex-1 min-w-0 text-sm font-medium truncate">
                                                    {m.m_name}
                                                </span>
                                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
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
                    <aside className="w-full lg:w-72 xl:w-80 shrink-0">
                        <div className="relative h-64 sm:h-80 lg:h-[560px] lg:sticky lg:top-4 rounded-lg overflow-hidden border">
                            {/* Score selector overlaid on top of the map */}
                            <div className="absolute top-2 right-2 z-10">
                                <Select
                                    value={mapScoreKey}
                                    onValueChange={setMapScoreKey}
                                >
                                    <SelectTrigger className="w-48 text-xs h-7 bg-background/90 backdrop-blur-sm shadow-sm">
                                        <SelectValue placeholder="Kies score" />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        {MAP_SCORE_OPTION_GROUPS.map(
                                            (group) => (
                                                <SelectGroup key={group.group}>
                                                    <SelectLabel className="text-xs">
                                                        {group.group}
                                                    </SelectLabel>
                                                    {group.options.map(
                                                        (opt) => (
                                                            <SelectItem
                                                                key={opt.value}
                                                                value={
                                                                    opt.value
                                                                }
                                                                className="text-xs"
                                                            >
                                                                {opt.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectGroup>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Suspense
                                fallback={
                                    <div className="h-full bg-muted animate-pulse" />
                                }
                            >
                                <FieldMap
                                    fieldsGeoJSON={
                                        fieldsGeoJSON as FeatureCollection
                                    }
                                    selectedFieldGeoJSON={
                                        selectedFieldGeoJSON as FeatureCollection
                                    }
                                    mapStyle={mapStyle}
                                    basePath={basePath}
                                    scoreKey={mapScoreKey}
                                    scoreLabel={findScoreLabel(mapScoreKey)}
                                    height="100%"
                                />
                            </Suspense>
                        </div>
                        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                            Percelen gekleurd op gekozen score. Klik om te
                            wisselen van perceel.
                        </p>
                    </aside>
                </div>
            </div>
        </>
    )
}
