import { getFarms, getFields } from "@nmi-agro/fdm-core"
import type { FeatureCollection, MultiPolygon } from "geojson"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { data, type MetaFunction, useLoaderData } from "react-router"
import { ScoreSelect } from "~/components/blocks/indicators/atlas"
import { getIndicatorsForFarm } from "~/integrations/bln3.server"
import { getMapStyle } from "~/integrations/map"
import {
    AGG_IDS,
    AGGREGATIONS,
    type AggregationId,
    getAggregationInfo,
    getFieldAggregationScore,
} from "~/lib/aggregations"
import { auth } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { INDICATORS } from "~/lib/indicators"
import type { Route } from "./+types/organization.$slug.$calendar.atlas.indicators"
import { computeFieldAvgScore } from "./farm.$b_id_farm.$calendar.atlas.indicators"
import { computeFarmMinScores } from "./organization.$slug.$calendar.indicators"

const IndicatorsMap = lazy(
    () => import("@/app/components/blocks/indicators/atlas"),
)

function buildFarmMultiPolygon(
    fields: Array<{
        b_geometry:
            | {
                  type: "Polygon"
                  coordinates: MultiPolygon["coordinates"][number]
              }
            | {
                  type: "MultiPolygon"
                  coordinates: MultiPolygon["coordinates"]
              }
            | null
    }>,
): MultiPolygon {
    return {
        type: "MultiPolygon",
        coordinates: fields.flatMap((field) => {
            if (!field.b_geometry) return []
            return field.b_geometry.type === "MultiPolygon"
                ? field.b_geometry.coordinates
                : [field.b_geometry.coordinates]
        }),
    }
}

export const meta: MetaFunction = () => {
    return [
        { title: `Indicatoren | Atlas | Organisatie | ${clientConfig.name}` },
    ]
}

type FlattenedScores = Record<string, number | null>
type FarmFlattenedScores = {
    b_id_farm: string
    flattenedScores: FlattenedScores
    error: unknown
}

export async function loader({ request, params }: Route.LoaderArgs) {
    try {
        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)

        const organizations = await auth.api.listOrganizations({
            headers: request.headers,
        })
        const organization = organizations.find(
            (org) => org.slug === params.slug,
        )

        if (!organization) {
            throw data("Organisatie niet gevonden.", {
                status: 404,
                statusText: "Organisatie niet gevonden.",
            })
        }

        const farms = await getFarms(fdm, organization.id)

        // Sequential score promises: farm i+1 starts only after farm i finishes
        const farmScoreStreams: Array<Promise<FarmFlattenedScores>> = []
        let lastPromise: Promise<void> = Promise.resolve()
        for (const farm of farms) {
            const { b_id_farm } = farm
            const scorePromise: Promise<FarmFlattenedScores> = lastPromise.then(
                async () => {
                    const fieldScores = await getIndicatorsForFarm({
                        principal_id: organization.id,
                        b_id_farm,
                        timeframe,
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
                    const minScores = computeFarmMinScores(fieldScores)

                    const aggProps: Record<string, number> = {}
                    for (const aggId of AGG_IDS) {
                        const scoreVal = getFieldAggregationScore(
                            minScores,
                            aggId,
                        )
                        aggProps[aggId] =
                            scoreVal !== null ? Math.round(scoreVal * 100) : -1
                    }

                    const indicatorProps: Record<string, number> = {}
                    for (const indicator of INDICATORS) {
                        const rawScore = minScores?.indicators.find(
                            (item) => item.indicator_id === indicator.id,
                        )?.score
                        indicatorProps[indicator.id] =
                            rawScore != null && !Number.isNaN(rawScore)
                                ? Math.round(rawScore * 100)
                                : -1
                    }

                    const avgScore = computeFieldAvgScore({
                        b_id: b_id_farm,
                        score: minScores,
                        error: null,
                    })

                    return {
                        b_id_farm: b_id_farm,
                        flattenedScores: {
                            avgScore,
                            ...aggProps,
                            ...indicatorProps,
                        },
                        error: null,
                    }
                },
            )
            farmScoreStreams.push(scorePromise)
            lastPromise = scorePromise.then(() => undefined)
        }

        // Now do the synchronous fetches
        const fieldsArray = await Promise.all(
            farms.map(async (farm) => {
                return {
                    b_id_farm: farm.b_id_farm,
                    b_name_farm: farm.b_name_farm,
                    fields: await getFields(
                        fdm,
                        organization.id,
                        farm.b_id_farm,
                    ),
                }
            }),
        )

        const fieldsGeoJson: FeatureCollection = {
            type: "FeatureCollection",
            features: fieldsArray.map(({ b_id_farm, b_name_farm, fields }) => ({
                type: "Feature",
                geometry: buildFarmMultiPolygon(fields),
                properties: {
                    b_id: b_id_farm,
                    b_name: b_name_farm,
                    b_area: fields.reduce(
                        (total, field) => total + (field.b_area ?? 0),
                        0,
                    ),
                },
            })),
        }

        const mapStyle = getMapStyle("satellite")

        return {
            organization: organization,
            calendar: calendar,
            fieldsGeoJSON: fieldsGeoJson,
            farmScoreStreams: farmScoreStreams,
            mapStyle: mapStyle,
        }
    } catch (error) {
        const normalized = handleLoaderError(error)
        throw normalized ?? error
    }
}

export default function OrgAtlasIndicatorsMap() {
    const {
        organization,
        calendar,
        fieldsGeoJSON,
        mapStyle,
        farmScoreStreams,
    } = useLoaderData<typeof loader>()
    const tablePath = `/organization/${organization.slug}/${calendar}/indicators`
    const [selectedProperty, setSelectedProperty] = useState("S_BLN")

    const [fieldScoresMap, setFieldScoresMap] = useState(
        new Map<string, FlattenedScores>(),
    )

    useEffect(() => {
        let active = true
        setFieldScoresMap(new Map())
        for (const stream of farmScoreStreams) {
            stream.then(({ b_id_farm, flattenedScores }) => {
                if (active) {
                    setFieldScoresMap((current) => {
                        if (active) {
                            const newMap = new Map<string, FlattenedScores>(
                                current,
                            )
                            newMap.set(b_id_farm, flattenedScores)
                            return newMap
                        }
                        return current
                    })
                }
            })
        }
        return () => {
            active = false
        }
    }, [farmScoreStreams])

    const displayedFieldsGeoJSON: FeatureCollection = useMemo(() => {
        return {
            type: "FeatureCollection",
            features: fieldsGeoJSON.features.map((feature) => {
                const loadedProperties = feature.properties
                    ? fieldScoresMap.get(feature.properties.b_id)
                    : null
                return {
                    ...feature,
                    properties: loadedProperties
                        ? { ...feature.properties, ...loadedProperties }
                        : feature.properties,
                }
            }),
        }
    }, [fieldsGeoJSON, fieldScoresMap])

    const selectedLabel =
        selectedProperty === "avgScore"
            ? "Gemiddelde score"
            : Object.keys(AGGREGATIONS).includes(selectedProperty)
              ? getAggregationInfo(selectedProperty as AggregationId).name
              : (INDICATORS.find((i) => i.id === selectedProperty)?.name ??
                selectedProperty)

    return (
        <div style={{ height: "calc(100vh - 64px)" }} className="relative">
            {/* Floating indicator selector + info banner */}
            <ScoreSelect
                selectedProperty={selectedProperty}
                setSelectedProperty={setSelectedProperty}
                detailPath={tablePath}
            />

            <Suspense
                fallback={
                    <div className="absolute inset-0 bg-muted animate-pulse" />
                }
            >
                <IndicatorsMap
                    fieldsGeoJSON={displayedFieldsGeoJSON}
                    mapStyle={mapStyle}
                    basePathFormatter={(b_id_farm) =>
                        `/farm/${b_id_farm}/${calendar}/atlas/indicators`
                    }
                    selectedProperty={selectedProperty}
                    label={selectedLabel}
                    height="100%"
                />
            </Suspense>
        </div>
    )
}
