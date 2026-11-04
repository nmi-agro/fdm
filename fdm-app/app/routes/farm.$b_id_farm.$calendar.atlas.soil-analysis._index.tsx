import type { FeatureCollection, Geometry } from "geojson"
import type { MapGeoJSONFeature } from "maplibre-gl"
import type { MetaFunction } from "react-router"
import {
  getCurrentSoilDataForFarm,
  getFields,
  getSoilAnalysesForFarm,
  getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { useEffect, useMemo, useState } from "react"
import { Layer, type LayerProps, Source } from "react-map-gl/maplibre"
import { type LoaderFunctionArgs, useLoaderData, useNavigate } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { SoilAnalysisLegend } from "~/components/blocks/atlas/atlas-legend"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import {
  getShadedSoilParameters,
  getShadingParameterMapper,
  getSoilAnalysisLayerStyle,
  SHADED_SOIL_TYPES,
  type ShadedSoilParameters,
  SOIL_ANALYSIS_NO_DATA_COLOR,
  SOIL_SAMPLING_COPY,
} from "~/components/blocks/atlas/atlas-soil-analysis"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getDottedFieldOutlineStyle } from "~/components/blocks/atlas/atlas-styles"
import {
  AtlasTooltip,
  AtlasTooltipContent,
  AtlasTooltipFooter,
  AtlasTooltipHeader,
} from "~/components/blocks/atlas/atlas-tooltip"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { SAMPLING_POINT_COLOR } from "~/components/blocks/soil/soil-sampling-colors"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select"
import { useAnalytics } from "~/hooks/use-analytics"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { enrichCurrentSoilDataWithNlv } from "~/lib/soil.server"
import { useSelectedAtlasSoilParameterStore } from "~/store/selected-soil-parameter"

export const meta: MetaFunction = () => {
  return [
    { title: `Bodemanalyses - Atlas | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk alle percelen van uw bedrijf op één interactieve kaart en vergelijk bodemanalyses ruimtelijk per perceel.",
    },
  ]
}

/**
 * Loads and processes farm field data along with Maplibre configuration for rendering the farm atlas.
 *
 * This loader function extracts the farm ID from the route parameters and validates its presence,
 * retrieves the current user session, and fetches fields associated with the specified farm.
 * It converts these fields into a GeoJSON FeatureCollection—rounding the field area values for precision—
 * and obtains the Maplibre access token and style configuration for map rendering.
 *
 * @returns An object containing:
 *  - savedFields: A GeoJSON FeatureCollection of the farm fields.
 *  - MapStyle: The Maplibre style configuration.
 *
 * @throws {Response} If the farm ID is missing or if an error occurs during data retrieval and processing.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // Get the farm id
    const b_id_farm = params.b_id_farm

    // Get the session
    const session = await getSession(request)

    // Get timeframe from calendar store
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    // Get the fields of the farm
    let fieldsData: FeatureCollection | undefined
    let samplingData: FeatureCollection | undefined
    if (b_id_farm && b_id_farm !== "undefined") {
      const [fields, currentSoilDataForFarm, soilAnalysesForFarm] = await Promise.all([
        getFields(fdm, session.principal_id, b_id_farm, timeframe),
        getCurrentSoilDataForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getSoilAnalysesForFarm(fdm, session.principal_id, b_id_farm, {
          start: null,
          end: timeframe.end,
        }),
      ])

      // Sampling zones and points of the analyses that determine the current values. Each feature
      // carries, per parameter it contributes to, its own value (under the parameter name) and its
      // area share (`share_<parameter>`), so that the map can colour the zones by their own value.
      // The properties are flat, because MapLibre turns nested objects into strings.
      const samplingFeatures: FeatureCollection["features"] = []
      const sourceOptions =
        getSoilParametersDescription().find((item) => item.parameter === "a_source")?.options ?? []

      const features = fields.map((field) => {
        const fieldCurrentSoilData = currentSoilDataForFarm.get(field.b_id) ?? []
        const fieldEnrichedSoilData = enrichCurrentSoilDataWithNlv(fieldCurrentSoilData)
        const soilProps = fieldEnrichedSoilData.reduce(
          (acc, data) => {
            if (data.value !== null) acc[data.parameter] = data.value
            return acc
          },
          {} as Record<string, string | number>,
        )

        // Number of zones behind each aggregated value, for the field tooltip
        const zoneCounts: Record<string, number> = {}
        const valuesById = new Map<string, Record<string, string | number>>()
        for (const item of fieldEnrichedSoilData) {
          if (item.sources.length > 1) zoneCounts[`zones_${item.parameter}`] = item.sources.length
          for (const source of item.sources) {
            // A calculated value (NLV) belongs to the whole field, not to a sampling zone
            if (source.value === null || source.a_source === "calculated") continue
            const values = valuesById.get(source.a_id) ?? {}
            values[item.parameter] = source.value
            values[`share_${item.parameter}`] = source.area_fraction
            valuesById.set(source.a_id, values)
          }
        }
        for (const analysis of soilAnalysesForFarm.get(field.b_id) ?? []) {
          const values = valuesById.get(analysis.a_id)
          if (!values) continue
          const properties = {
            ...values,
            a_id: analysis.a_id,
            b_id: field.b_id,
            b_name: field.b_name,
            b_sampling_date: analysis.b_sampling_date?.toISOString() ?? null,
            a_source:
              sourceOptions.find((option) => option.value === analysis.a_source)?.label ??
              analysis.a_source,
          }
          if (analysis.b_sampling_geometry_zone) {
            samplingFeatures.push({
              type: "Feature",
              geometry: analysis.b_sampling_geometry_zone,
              properties: { ...properties, kind: "zone" },
            })
          }
          if (analysis.b_sampling_geometry) {
            samplingFeatures.push({
              type: "Feature",
              geometry: analysis.b_sampling_geometry,
              properties: { ...properties, kind: "points" },
            })
          }
        }

        const feature = {
          type: "Feature" as const,
          properties: {
            ...soilProps,
            ...zoneCounts,
            b_id: field.b_id,
            b_name: field.b_name,
            b_area: Math.round((field.b_area ?? 0) * 10) / 10,
            b_lu_name: (field as { b_lu_name?: string }).b_lu_name ?? "",
            b_id_source: field.b_id_source,
          },
          geometry: simplify(field.b_geometry as Geometry, {
            tolerance: 0.00001,
            highQuality: true,
          }),
        }
        return feature
      })

      fieldsData = {
        type: "FeatureCollection",
        features: features,
      }
      samplingData = {
        type: "FeatureCollection",
        features: samplingFeatures,
      }
    }

    // Get Map Style
    const mapStyle = getMapStyle("satellite")

    const soilParametersDescriptions = getSoilParametersDescription()

    // Return user information from loader
    return {
      calendar: calendar,
      b_id_farm: b_id_farm,
      fieldsData: fieldsData,
      samplingData: samplingData,
      mapStyle: mapStyle,
      soilParametersDescriptions: soilParametersDescriptions,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renders a Maplibre map displaying farm fields soil analysis data with interactive controls.
 *
 * This component consumes preloaded farm field data to compute the map's view state and stylize the field boundaries.
 * It integrates geolocation and navigation controls, wraps the field layer in a non-interactive source, and includes a panel for displaying additional field details on hover.
 */
export default function FarmAtlasFieldSoilAnalysisBlock() {
  const { calendar, b_id_farm, fieldsData, samplingData, soilParametersDescriptions } =
    useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const { capture } = useAnalytics()

  const heatmapLayerId = "fieldsSavedHeatmap"
  const heatmapOutlineLayerId = "fieldsSavedHeatmapOutline"
  const samplingZoneLayerId = "soil-sampling-zone-fill"
  const samplingPointLayerId = "soil-sampling-points"
  const selectedParameter = useSelectedAtlasSoilParameterStore((store) => store.selectedParameter)
  const setSelectedParameter = useSelectedAtlasSoilParameterStore(
    (store) => store.setSelectedParameter,
  )

  useEffect(() => {
    capture("atlas_viewed", {
      b_id_farm,
      calendar,
      layer: "soil_analysis",
      parameter: selectedParameter,
    })
  }, [b_id_farm, calendar, selectedParameter, capture])

  const [showSampling, setShowSampling] = useState(false)

  // Zones and points of the analyses that determine the value of the selected parameter
  const selectedSamplingData = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: (samplingData?.features ?? []).filter(
        (feature) => feature.properties && selectedParameter in feature.properties,
      ),
    }),
    [samplingData, selectedParameter],
  )
  const hasSamplingData = (samplingData?.features.length ?? 0) > 0

  const [min, max] = useMemo(() => {
    if (!fieldsData || fieldsData?.features.length === 0) {
      return [0, 1]
    }
    const parameterDescription = soilParametersDescriptions.find(
      (item) => item.parameter === selectedParameter,
    )
    if (parameterDescription?.type !== "numeric") return [0, 1]
    const parameterMapper = getShadingParameterMapper(selectedParameter)
    let min: number | null = null
    let max: number | null = null
    // While the zones are shown, their own values are part of the scale, so that they do not saturate
    const zoneFeatures = showSampling
      ? selectedSamplingData.features.filter((feature) => feature.properties?.kind === "zone")
      : []
    for (const field of [...fieldsData.features, ...zoneFeatures]) {
      if (!field.properties) continue
      const parameterValue = field.properties[selectedParameter]
      if (typeof parameterValue !== "undefined") {
        const mappedValue = parameterMapper.forward(parameterValue as number)
        min = min === null ? mappedValue : Math.min(min, mappedValue)
        max = max === null ? mappedValue : Math.max(max, mappedValue)
      }
    }
    const defaultedMin = min ?? 0
    const defaultedMax = max ?? 1
    return defaultedMin === defaultedMax
      ? [defaultedMin - 0.01, defaultedMin + 0.01]
      : [defaultedMin, defaultedMax]
  }, [
    selectedParameter,
    fieldsData,
    soilParametersDescriptions,
    showSampling,
    selectedSamplingData,
  ])

  // Parameter shading config
  const shadingConfig = Object.fromEntries(
    getShadedSoilParameters().map((item) => [item.parameter, item]),
  )

  // Parameter description
  const soilParameterOptions = soilParametersDescriptions.filter(
    (item) => item.parameter in shadingConfig,
  )

  const parameterDescription = soilParametersDescriptions.find(
    (item) => item.parameter === selectedParameter,
  )

  const heatmapLayerStyle = getSoilAnalysisLayerStyle(selectedParameter, min, max)
  // Zones use the same colour scale with their own value, a little more opaque than the fields
  const samplingZoneStyle = {
    ...heatmapLayerStyle,
    paint: { ...heatmapLayerStyle.paint, "fill-opacity": 0.85 },
  }
  const heatmapLayerOutlineStyle = getDottedFieldOutlineStyle()

  const initialViewState = getViewState(fieldsData)

  const [showFields, setShowFields] = useState(true)
  const layerLayout = { visibility: showFields ? "visible" : "none" } as const
  // White dotted outline around every field; keep its round caps and add the visibility toggle
  const heatmapOutlineLayer = {
    ...heatmapLayerOutlineStyle,
    layout: { ...heatmapLayerOutlineStyle.layout, ...layerLayout },
  } as LayerProps

  /** Opens the soil page of the clicked field, or the analysis of the clicked zone or point. */
  function onFeatureClick(feature: MapGeoJSONFeature) {
    const b_id = feature.properties.b_id as string | undefined
    if (!b_id) return
    const a_id = feature.properties.a_id as string | undefined
    const isSampling = feature.layer.id !== heatmapLayerId
    void navigate(
      isSampling && a_id
        ? `/farm/${b_id_farm}/${calendar}/atlas/soil-analysis/${b_id}/soil/analysis/${a_id}`
        : `/farm/${b_id_farm}/${calendar}/atlas/soil-analysis/${b_id}/soil`,
    )
  }

  /** Formats a value of the selected parameter for the tooltip. */
  function renderValue(property: unknown) {
    const value = property as string | number | null | undefined
    if (value === undefined || value === null) return <p key="no-data">Geen data</p>
    if (parameterDescription?.type === "date") {
      return <p key="date">{formatDate(value as string, "PP", { locale: nl })}</p>
    }
    if (selectedParameter === "b_soiltype_agr") {
      const soilType = SHADED_SOIL_TYPES.find((item) => item.value === value)
      return (
        <p key={`soiltype-${String(value)}`}>
          <span
            className="me-0.5 inline-block size-2.5 rounded align-middle"
            style={{ backgroundColor: soilType?.fill ?? SOIL_ANALYSIS_NO_DATA_COLOR }}
          />
          {soilType?.label ?? String(value)}
        </p>
      )
    }
    return (
      <p key="value">
        {typeof value === "number"
          ? value.toLocaleString("nl-NL", { maximumFractionDigits: 2 })
          : String(value)}{" "}
        {parameterDescription?.unit}
      </p>
    )
  }

  return (
    <div className="relative">
      <Atlas
        initialViewState={initialViewState}
        interactive={true}
        interactiveLayerIds={[heatmapLayerId, samplingZoneLayerId, samplingPointLayerId]}
      >
        <Controls
          showFlyToFields={fieldsData && fieldsData.features.length > 0}
          initialViewState={initialViewState}
          showFields={showFields}
          onToggleFields={() => setShowFields(!showFields)}
          showSampling={hasSamplingData ? showSampling : undefined}
          onToggleSampling={() => setShowSampling(!showSampling)}
        />

        <MapTilerAttribution />

        {fieldsData && (
          <FieldsSourceNotClickable id={heatmapLayerId} fieldsData={fieldsData}>
            <Layer id={heatmapLayerId} {...heatmapLayerStyle} layout={layerLayout} />
            <Layer id={heatmapOutlineLayerId} {...heatmapOutlineLayer} />
          </FieldsSourceNotClickable>
        )}
        {showSampling && (
          <Source id="soil-sampling" type="geojson" data={selectedSamplingData}>
            <Layer
              id={samplingZoneLayerId}
              {...samplingZoneStyle}
              filter={["==", ["get", "kind"], "zone"]}
            />
            <Layer
              id="soil-sampling-zone-outline"
              type="line"
              filter={["==", ["get", "kind"], "zone"]}
              paint={{ "line-color": "#ffffff", "line-width": 1.5, "line-dasharray": [2, 1] }}
            />
            <Layer
              id={samplingPointLayerId}
              type="circle"
              filter={["==", ["get", "kind"], "points"]}
              paint={{
                "circle-radius": 4,
                "circle-color": SAMPLING_POINT_COLOR,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
              }}
            />
          </Source>
        )}
        <AtlasTooltip
          layers={[samplingPointLayerId, samplingZoneLayerId, heatmapLayerId]}
          onFeatureClicked={onFeatureClick}
          render={({ features, mode }) => {
            if (features.length === 0) return null
            const feature = features[0]

            // A sampling zone or point: show the analysis it belongs to
            if (feature.layer.id !== heatmapLayerId) {
              const isPoint = feature.layer.id === samplingPointLayerId
              const samplingDate = feature.properties.b_sampling_date as string | null
              const share = feature.properties[`share_${selectedParameter}`] as number | undefined
              return (
                <>
                  <AtlasTooltipHeader>
                    <p className="text-foreground font-semibold">
                      {SOIL_SAMPLING_COPY.analysis}{" "}
                      {samplingDate
                        ? formatDate(samplingDate, "PP", { locale: nl })
                        : SOIL_SAMPLING_COPY.unknownDate}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {feature.properties.b_name}
                      {` · ${isPoint ? SOIL_SAMPLING_COPY.point : SOIL_SAMPLING_COPY.zone}`}
                    </p>
                  </AtlasTooltipHeader>
                  <AtlasTooltipContent className="block space-y-1">
                    <p className="text-muted-foreground">
                      {SOIL_SAMPLING_COPY.source}: {feature.properties.a_source}
                    </p>
                    <div>
                      <p className="text-muted-foreground">{parameterDescription?.name}</p>
                      {renderValue(feature.properties[selectedParameter])}
                    </div>
                    {share !== undefined && share < 1 && (
                      <p className="text-muted-foreground">
                        {SOIL_SAMPLING_COPY.share(Math.round(share * 100))}
                      </p>
                    )}
                  </AtlasTooltipContent>
                  <AtlasTooltipFooter className="border-t pt-1.5">
                    {mode === "popup" ? (
                      <Button
                        type="button"
                        onClick={() => onFeatureClick(feature)}
                        className="grow"
                      >
                        {SOIL_SAMPLING_COPY.openAnalysis}
                      </Button>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {SOIL_SAMPLING_COPY.clickHint}
                      </p>
                    )}
                  </AtlasTooltipFooter>
                </>
              )
            }

            const zoneCount = feature.properties[`zones_${selectedParameter}`] as number | undefined

            return (
              <>
                <AtlasTooltipHeader>
                  <p className="text-foreground font-semibold">{feature.properties.b_name}</p>
                  {feature.properties.b_area != null && (
                    <p className="text-muted-foreground mt-0.5">
                      {Number(feature.properties.b_area).toFixed(2)} ha
                    </p>
                  )}
                </AtlasTooltipHeader>
                <AtlasTooltipContent className="block space-y-1">
                  <div>
                    <p className="text-muted-foreground">{parameterDescription?.name}</p>
                    {renderValue(feature.properties[selectedParameter])}
                  </div>
                  {zoneCount !== undefined && (
                    <p className="text-muted-foreground">
                      {SOIL_SAMPLING_COPY.aggregated(zoneCount)}
                    </p>
                  )}
                </AtlasTooltipContent>
                {mode === "popup" && (
                  <AtlasTooltipFooter>
                    <Button type="button" onClick={() => onFeatureClick(feature)} className="grow">
                      Bekijk analyse
                    </Button>
                  </AtlasTooltipFooter>
                )}
              </>
            )
          }}
        />
      </Atlas>
      {/* Soil Parameter Dropdown */}
      <Card className="absolute top-3 left-3 z-10 w-52 shadow-md">
        <CardContent className="p-2">
          <Select
            value={selectedParameter}
            onValueChange={(val) => setSelectedParameter(val as ShadedSoilParameters)}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              {parameterDescription?.name}
            </SelectTrigger>
            {/* var(--radix-select-content-available-height) is the recommended max-height here, however we have fallbacks in case that variable is missing. */}
            <SelectContent className="max-h-[min(var(--radix-select-content-available-height,100vh),calc(var(--radix-select-trigger-height,0)+100*var(--spacing)))]">
              {soilParameterOptions.map((opt) => {
                return (
                  <SelectItem key={opt.parameter} value={opt.parameter}>
                    <div>
                      <div className="font-medium">{opt.name}</div>
                      <div className="text-muted-foreground text-xs">{opt.description}</div>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {/* Soil Analysis Color Legend */}
      <div className="pointer-none absolute bottom-9 left-4">
        <SoilAnalysisLegend
          fieldsData={fieldsData}
          selectedParameter={selectedParameter}
          soilParametersDescriptions={soilParametersDescriptions}
          min={min}
          max={max}
          showSampling={showSampling}
        />
      </div>
    </div>
  )
}
