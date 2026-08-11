import type { FeatureCollection, Geometry } from "geojson"
import type { MetaFunction } from "react-router"
import {
  getCurrentSoilDataForFarm,
  getFields,
  getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { useEffect, useMemo, useState } from "react"
import { Layer, type LayerProps } from "react-map-gl/maplibre"
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
} from "~/components/blocks/atlas/atlas-soil-analysis"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import {
  AtlasTooltip,
  AtlasTooltipContent,
  AtlasTooltipFooter,
  AtlasTooltipHeader,
} from "~/components/blocks/atlas/atlas-tooltip"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
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
    if (b_id_farm && b_id_farm !== "undefined") {
      const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)

      const currentSoilDataForFarm = await getCurrentSoilDataForFarm(
        fdm,
        session.principal_id,
        b_id_farm,
        timeframe,
      )

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

        const feature = {
          type: "Feature" as const,
          properties: {
            ...soilProps,
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
    }

    // Get Map Style
    const mapStyle = getMapStyle("satellite")

    const soilParametersDescriptions = getSoilParametersDescription()

    // Return user information from loader
    return {
      calendar: calendar,
      b_id_farm: b_id_farm,
      fieldsData: fieldsData,
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
  const { calendar, b_id_farm, fieldsData, soilParametersDescriptions } =
    useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const { capture } = useAnalytics()

  const heatmapLayerId = "fieldsSavedHeatmap"
  const heatmapOutlineLayerId = "fieldsSavedHeatmapOutline"
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
    for (const field of fieldsData.features) {
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
  }, [selectedParameter, fieldsData, soilParametersDescriptions])

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
  const heatmapLayerOutlineStyle = getFieldsStyle(heatmapOutlineLayerId)

  const initialViewState = getViewState(fieldsData)

  const [showFields, setShowFields] = useState(true)
  const layerLayout = { visibility: showFields ? "visible" : "none" } as const
  const heatmapOutlineLayer = {
    ...heatmapLayerOutlineStyle,
    layout: layerLayout,
  } as LayerProps

  function onFieldClick(feature: maplibregl.MapGeoJSONFeature) {
    void navigate(
      `/farm/${b_id_farm}/${calendar}/atlas/soil-analysis/${feature.properties.b_id}/soil`,
    )
  }

  return (
    <div className="relative">
      <Atlas interactive={true}>
        <Controls
          showFlyToFields={fieldsData && fieldsData.features.length > 0}
          initialViewState={initialViewState}
          showFields={showFields}
          onToggleFields={() => setShowFields(!showFields)}
        />

        <MapTilerAttribution />

        {fieldsData && (
          <FieldsSourceNotClickable id={heatmapLayerId} fieldsData={fieldsData}>
            <Layer id={heatmapLayerId} {...heatmapLayerStyle} layout={layerLayout} />
            <Layer id={heatmapOutlineLayerId} {...heatmapOutlineLayer} />
          </FieldsSourceNotClickable>
        )}
        <AtlasTooltip
          layers={[heatmapLayerId]}
          onFeatureClicked={onFieldClick}
          render={({ feature, mode }) => {
            if (!feature) return null
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
                <AtlasTooltipContent>
                  <p className="text-muted-foreground">{parameterDescription?.name}</p>
                  {typeof feature.properties[selectedParameter] === "undefined" ? (
                    <p>Geen data</p>
                  ) : parameterDescription?.type === "date" ? (
                    <p>
                      {formatDate(typeof feature.properties[selectedParameter], "PP", {
                        locale: nl,
                      })}
                    </p>
                  ) : selectedParameter === "b_soiltype_agr" ? (
                    <p>
                      <span
                        className="me-0.5 inline-block size-2.5 rounded align-middle"
                        style={{
                          backgroundColor:
                            SHADED_SOIL_TYPES.find(
                              (item) => item.value === feature.properties[selectedParameter],
                            )?.fill ?? "#777777",
                        }}
                      />
                      {SHADED_SOIL_TYPES.find(
                        (item) => item.value === feature.properties[selectedParameter],
                      )?.label ?? feature.properties[selectedParameter]}
                    </p>
                  ) : (
                    <p>
                      {feature.properties[selectedParameter]} {parameterDescription?.unit}
                    </p>
                  )}
                </AtlasTooltipContent>
                {mode === "popup" && (
                  <AtlasTooltipFooter>
                    <Button type="button" onClick={() => onFieldClick(feature)} className="grow">
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
      <Card className="bg-background/90 absolute top-3 left-3 z-10 w-52 shadow-md backdrop-blur-sm">
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
        />
      </div>
    </div>
  )
}
