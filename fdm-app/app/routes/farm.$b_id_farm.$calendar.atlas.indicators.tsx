import { getFields } from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import type { FeatureCollection, Geometry } from "geojson"
import { lazy, Suspense, useState } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useParams,
} from "react-router"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { Card, CardContent } from "~/components/ui/card"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import {
    type FieldBln3Score,
    getIndicatorsForFarm,
} from "~/integrations/bln3.server"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import {
    getFieldAggregationScore,
    type AggregationId,
    getAggregationInfo,
    AGGREGATIONS,
    AGG_IDS,
} from "~/lib/aggregations"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { INDICATORS } from "~/lib/indicators"

const IndicatorsMap = lazy(
    () => import("@/app/components/blocks/indicators/atlas"),
)

export const meta: MetaFunction = () => {
    return [{ title: `Indicatoren | Atlas | ${clientConfig.name}` }]
}

function computeFieldAvgScore(fs: FieldBln3Score | undefined): number {
    if (!fs?.score) return -1
    const vals = fs.score.indicators
        .map((ind) => ind.score)
        .filter((s) => s != null && !Number.isNaN(s))
    if (vals.length === 0) return -1
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)
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

        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )

        const fieldScores = await getIndicatorsForFarm({
            principal_id: session.principal_id,
            b_id_farm,
            timeframe,
            preloadedFields: fields,
        })

        for (const result of fieldScores) {
            if (result.error) {
                reportError(
                    new Error(
                        `BLN3 score failed for field ${result.b_id}: ${result.error}`,
                    ),
                )
            }
        }

        const fieldsGeoJSON: FeatureCollection = {
            type: "FeatureCollection",
            features: fields.map((field) => {
                const fs = fieldScores.find(
                    (score) => score.b_id === field.b_id,
                )

                const aggProps: Record<string, number> = {}
                for (const aggId of AGG_IDS) {
                    const scoreVal = getFieldAggregationScore(fs?.score, aggId)
                    aggProps[aggId] = scoreVal !== null ? Math.round(scoreVal * 100) : -1
                }

                const indicatorProps: Record<string, number> = {}
                for (const indicator of INDICATORS) {
                    const rawScore = fs?.score?.indicators.find(
                        (item) => item.indicator_id === indicator.id,
                    )?.score
                    indicatorProps[indicator.id] =
                        rawScore != null && !Number.isNaN(rawScore)
                            ? Math.round(rawScore * 100)
                            : -1
                }

                return {
                    type: "Feature" as const,
                    properties: {
                        b_id: field.b_id,
                        b_name: field.b_name ?? null,
                        b_area: field.b_area ?? null,
                        avgScore: computeFieldAvgScore(fs),
                        ...aggProps,
                        ...indicatorProps,
                    },
                    geometry: simplify(field.b_geometry as Geometry, {
                        tolerance: 0.00001,
                        highQuality: true,
                    }),
                }
            }),
        }

        return {
            fieldsGeoJSON,
            mapStyle: getMapStyle("satellite"),
        }
    } catch (error) {
        const normalized = handleLoaderError(error)
        throw normalized ?? error
    }
}

export default function AtlasIndicatorsMap() {
    const { fieldsGeoJSON, mapStyle } = useLoaderData<typeof loader>()
    const { b_id_farm, calendar } = useParams()
    const basePath = `/farm/${b_id_farm}/${calendar}/indicators`
    const [selectedProperty, setSelectedProperty] = useState("S_BLN")

    const selectedLabel =
        selectedProperty === "avgScore"
            ? "Gemiddelde score"
            : (Object.keys(AGGREGATIONS).includes(selectedProperty)
                  ? getAggregationInfo(selectedProperty as AggregationId).name
                  : (INDICATORS.find((i) => i.id === selectedProperty)?.name ??
                    selectedProperty))

    return (
        <div style={{ height: "calc(100vh - 64px)" }} className="relative">
            {/* Floating indicator selector + info banner */}
            <Card className="absolute top-3 left-3 z-10 w-64 shadow-md bg-background/90 backdrop-blur-sm">
                <CardContent className="p-2 space-y-2">
                    <Select
                        value={selectedProperty}
                        onValueChange={setSelectedProperty}
                    >
                        <SelectTrigger className="w-full text-xs h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[380px] overflow-y-auto">
                            <SelectItem value="avgScore">
                                Gemiddelde score
                            </SelectItem>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Hoofdaggregaties
                                </SelectLabel>
                                <SelectItem value="S_BLN">BLN Bodemkwaliteit</SelectItem>
                                <SelectItem value="S_BBWP">BedrijfsBodemWaterPlan (BBWP)</SelectItem>
                                <SelectItem value="S_WAT_BLN">Water</SelectItem>
                                <SelectItem value="S_NUT_BLN">Nutriëntenkringloop</SelectItem>
                                <SelectItem value="S_CLIM_BLN">Klimaat</SelectItem>
                                <SelectItem value="S_PROD_BLN">Productie (OBI)</SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Water Subaggregaties
                                </SelectLabel>
                                <SelectItem value="S_GW_QUANT_BLN">Grondwaterkwantiteit</SelectItem>
                                <SelectItem value="S_GW_QUAL_BLN">Grondwaterkwaliteit</SelectItem>
                                <SelectItem value="S_SW_QUAL_BLN">Oppervlaktewaterkwaliteit</SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Productie Subaggregaties
                                </SelectLabel>
                                <SelectItem value="S_PROD_BIOL_BLN">Biologische Bodemkwaliteit</SelectItem>
                                <SelectItem value="S_PROD_CHEM_BLN">Chemische Bodemkwaliteit</SelectItem>
                                <SelectItem value="S_PROD_PHYS_BLN">Fysische Bodemkwaliteit</SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Water Indicatoren
                                </SelectLabel>
                                {INDICATORS.filter((i) => i.ecosysteemdienst === "Water").map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                        {i.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Nutriënten & Klimaat Indicatoren
                                </SelectLabel>
                                {INDICATORS.filter((i) => ["Nutriëntenkringloop", "Klimaat"].includes(i.ecosysteemdienst)).map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                        {i.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Productie (OBI) Indicatoren
                                </SelectLabel>
                                {INDICATORS.filter((i) => i.ecosysteemdienst === "Productie").map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                        {i.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <Bln3BetaBanner />
                </CardContent>
            </Card>

            <Suspense
                fallback={
                    <div className="absolute inset-0 bg-muted animate-pulse" />
                }
            >
                <IndicatorsMap
                    fieldsGeoJSON={fieldsGeoJSON}
                    mapStyle={mapStyle}
                    basePath={basePath}
                    selectedProperty={selectedProperty}
                    label={selectedLabel}
                    height="100%"
                />
            </Suspense>
        </div>
    )
}
