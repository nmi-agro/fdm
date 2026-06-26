import { getFarms, getFields } from "@nmi-agro/fdm-core"
import { featureCollection } from "@turf/helpers"
import type { FeatureCollection, Geometry } from "geojson"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { data, type MetaFunction, useLoaderData } from "react-router"
import { ScoreSelect } from "~/components/blocks/indicators/atlas"
import { Badge } from "~/components/ui/badge"
import { type Bln3Score, getIndicatorsForFarm } from "~/integrations/bln3.server"
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

const IndicatorsMap = lazy(() => import("@/app/components/blocks/indicators/atlas"))

export const meta: MetaFunction = () => {
  return [{ title: `Indicatoren | Atlas | Organisatie | ${clientConfig.name}` }]
}

type FlattenedScores = Record<string, number | null>
type FieldFlattenedScores =
  | {
      b_id: string
      flattenedScores: FlattenedScores
      error: null
    }
  | {
      b_id: string
      flattenedScores: null
      error: string
    }
type FarmFlattenedScores =
  | {
      b_id_farm: string
      flattenedScores: FieldFlattenedScores[]
      error: null
    }
  | {
      b_id_farm: string
      flattenedScores: null
      error: string
    }

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    const organizations = await auth.api.listOrganizations({
      headers: request.headers,
    })
    const organization = organizations.find((org) => org.slug === params.slug)

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
      const scorePromise: Promise<FarmFlattenedScores> = lastPromise.then(async () => {
        try {
          const fieldScores = await getIndicatorsForFarm({
            principal_id: organization.id,
            b_id_farm,
            timeframe,
          })
          for (const result of fieldScores) {
            if (result.error) {
              reportError(new Error(`BLN3 score failed for field ${result.b_id}: ${result.error}`))
            }
          }

          const fieldFlattenedScores = fieldScores
            .filter((fieldScore) => fieldScore.score !== null)
            .map((fieldScore) => {
              const aggProps: Record<string, number> = {}
              for (const aggId of AGG_IDS) {
                const scoreVal = getFieldAggregationScore(fieldScore.score as Bln3Score, aggId)
                aggProps[aggId] = scoreVal !== null ? Math.round(scoreVal * 100) : -1
              }

              const indicatorProps: Record<string, number> = {}
              for (const indicator of INDICATORS) {
                const rawScore = fieldScore.score?.indicators.find(
                  (item) => item.indicator_id === indicator.id,
                )?.score
                indicatorProps[indicator.id] =
                  rawScore != null && !Number.isNaN(rawScore) ? Math.round(rawScore * 100) : -1
              }

              const avgScore = computeFieldAvgScore(fieldScore)

              return {
                b_id: fieldScore.b_id,
                flattenedScores: {
                  avgScore,
                  ...aggProps,
                  ...indicatorProps,
                },
                error: null,
              } satisfies FieldFlattenedScores
            })

          return {
            b_id_farm: b_id_farm,
            flattenedScores: fieldFlattenedScores,
            error: null,
          }
        } catch (err) {
          handleLoaderError(err)
          return {
            b_id_farm: b_id_farm,
            flattenedScores: null,
            error: err instanceof Error ? err.message : "Iets is fout gegaan.",
          }
        }
      })
      farmScoreStreams.push(scorePromise)
      lastPromise = scorePromise.then(() => undefined)
    }

    const fieldsArray = await Promise.all(
      farms.map(async (farm) => {
        return {
          b_id_farm: farm.b_id_farm,
          b_name_farm: farm.b_name_farm,
          fields: await getFields(fdm, organization.id, farm.b_id_farm),
        }
      }),
    )

    const fieldsGeoJson: FeatureCollection = featureCollection(
      fieldsArray.flatMap(({ b_id_farm, b_name_farm, fields }) => {
        return fields
          .filter((field) => field.b_geometry)
          .map((field) => {
            return {
              type: "Feature",
              geometry: field.b_geometry as Geometry,
              properties: {
                b_id_farm: b_id_farm,
                b_name_farm: b_name_farm,
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: field.b_area,
              },
            }
          })
      }),
    )

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
  const { organization, calendar, fieldsGeoJSON, mapStyle, farmScoreStreams } =
    useLoaderData<typeof loader>()
  const tablePath = `/organization/${organization.slug}/${calendar}/indicators`
  const [selectedProperty, setSelectedProperty] = useState("S_BLN")

  const [fieldScoresMap, setFieldScoresMap] = useState(new Map<string, FlattenedScores>())
  const [completedFarmIds, setCompletedFarmIds] = useState<string[]>([])
  const [erroredFarms, setErroredFarms] = useState<string[]>([])

  useEffect(() => {
    let active = true
    setFieldScoresMap(new Map())
    setCompletedFarmIds([])
    setErroredFarms([])
    for (const stream of farmScoreStreams) {
      stream.then(
        ({ b_id_farm, flattenedScores }) => {
          if (active) {
            if (flattenedScores) {
              setFieldScoresMap((current) => {
                if (active) {
                  setCompletedFarmIds((current) => [...current, b_id_farm])
                  const newMap = new Map<string, FlattenedScores>(current)
                  for (const fieldScore of flattenedScores) {
                    if (fieldScore.flattenedScores) {
                      newMap.set(fieldScore.b_id, fieldScore.flattenedScores)
                    }
                  }
                  return newMap
                }
                return current
              })
            } else {
              setErroredFarms((current) => [...current, b_id_farm])
            }
          }
        },
        () => {},
      )
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
        : (INDICATORS.find((i) => i.id === selectedProperty)?.name ?? selectedProperty)

  const numTotal = farmScoreStreams.length
  const numErrored = erroredFarms.length
  const numDone = completedFarmIds.length + numErrored

  return (
    <div style={{ height: "calc(100vh - 64px)" }} className="relative">
      {/* Floating indicator selector + info banner */}
      <ScoreSelect
        selectedProperty={selectedProperty}
        setSelectedProperty={setSelectedProperty}
        detailPath={tablePath}
      />

      <div className="absolute right-4 bottom-12 z-10 flex flex-col items-end gap-2">
        {numDone < numTotal && (
          <Badge variant="outline" className="bg-orange-200 border-orange-400">
            Even geduld... {numDone}/{numTotal} bedrijven
          </Badge>
        )}
        {numErrored > 0 && (
          <Badge variant="destructive">
            {numErrored} {numErrored === 1 ? "bedrijf" : "bedrijven"} hebben iets fout gegaan met de
            berekening.
          </Badge>
        )}
      </div>

      <Suspense fallback={<div className="absolute inset-0 bg-muted animate-pulse" />}>
        <IndicatorsMap
          fieldsGeoJSON={displayedFieldsGeoJSON}
          mapStyle={mapStyle}
          basePathFormatter={(props) =>
            `/farm/${props?.b_id_farm}/${calendar}/indicators/${props?.b_id}`
          }
          selectedProperty={selectedProperty}
          label={selectedLabel}
          height="100%"
        />
      </Suspense>
    </div>
  )
}
