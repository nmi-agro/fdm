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
import { getIndicatorsForFarm, type FieldBln3Score } from "~/integrations/bln3.server"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
    OBI_INDICATOR_IDS,
    BBWP_INDICATOR_IDS,
    INDICATORS,
    INDICATOR_CATEGORIES,
    CATEGORY_MAP_PROP,
} from "~/lib/indicators"
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

const IndicatorsMap = lazy(
    () => import("@/app/components/blocks/indicators/atlas"),
)

export const meta: MetaFunction = () => {
    return [{ title: `Kaart | Indicatoren | ${clientConfig.name}` }]
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
                const fs = fieldScores.find((score) => score.b_id === field.b_id)

                const groupAvg = (ids: string[]): number => {
                    const scores = ids
                        .map(
                            (id) =>
                                fs?.score?.indicators.find(
                                    (indicator) => indicator.indicator_id === id,
                                )?.score,
                        )
                        .filter((score): score is number => {
                            return score != null && !Number.isNaN(score)
                        })

                    return scores.length > 0
                        ? Math.round(
                              (scores.reduce((sum, score) => sum + score, 0) /
                                  scores.length) *
                                  100,
                          )
                        : -1
                }

                const catProps: Record<string, number> = {
                    avg_obi: groupAvg(OBI_INDICATOR_IDS),
                    avg_bbwp: groupAvg(BBWP_INDICATOR_IDS),
                }

                for (const category of INDICATOR_CATEGORIES) {
                    const categoryIds = INDICATORS.filter(
                        (indicator) => indicator.category === category,
                    ).map((indicator) => indicator.id)
                    catProps[CATEGORY_MAP_PROP[category]] = groupAvg(categoryIds)
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
                        avgScore: computeFieldAvgScore(fs),
                        ...catProps,
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

export default function IndicatorsFarmMap() {
    const { fieldsGeoJSON, mapStyle } = useLoaderData<typeof loader>()
    const { b_id_farm, calendar } = useParams()
    const basePath = `/farm/${b_id_farm}/${calendar}/indicators`
    const [selectedProperty, setSelectedProperty] = useState("avgScore")

    const selectedLabel =
        selectedProperty === "avgScore"
            ? "Gemiddelde score"
            : (INDICATORS.find((i) => i.id === selectedProperty)?.name ?? selectedProperty)

    return (
        <div style={{ height: "calc(100vh - 64px)" }} className="relative">
            {/* Floating indicator selector panel */}
            <Card className="absolute top-3 left-3 z-10 w-52 shadow-md bg-background/90 backdrop-blur-sm">
                <CardContent className="p-2">
                    <Select
                        value={selectedProperty}
                        onValueChange={setSelectedProperty}
                    >
                        <SelectTrigger className="w-full text-xs h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="avgScore">
                                Gemiddelde score
                            </SelectItem>
                            <SelectSeparator />
                            {INDICATOR_CATEGORIES.map((category) => (
                                <SelectGroup key={category}>
                                    <SelectLabel>{category}</SelectLabel>
                                    {INDICATORS.filter(
                                        (i) => i.category === category,
                                    ).map((i) => (
                                        <SelectItem key={i.id} value={i.id}>
                                            {i.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Suspense
                fallback={<div className="absolute inset-0 bg-muted animate-pulse" />}
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
