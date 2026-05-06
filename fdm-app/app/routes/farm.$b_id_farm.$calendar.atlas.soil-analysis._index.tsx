import {
    type CurrentSoilData,
    getCurrentSoilDataForFarm,
    getFields,
    getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import type { FeatureCollection, Geometry } from "geojson"
import maplibregl, { type GeoJSONFeature } from "maplibre-gl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Layer,
    Map as MapGL,
    type MapRef,
    type ViewState,
    type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import type { MetaFunction } from "react-router"
import {
    type LoaderFunctionArgs,
    useLoaderData,
    useNavigate,
} from "react-router"
import { ZOOM_LEVEL_FIELDS } from "~/components/blocks/atlas/atlas"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { SoilAnalysisLegend } from "~/components/blocks/atlas/atlas-legend"
import { FieldsPanelHover } from "~/components/blocks/atlas/atlas-panels"
import {
    getShadingParameterMapper,
    getSoilAnalysisLayerStyle,
    SHADED_SOIL_TYPES,
} from "~/components/blocks/atlas/atlas-soil-analysis"
import { FieldSourceClickable } from "~/components/blocks/atlas/atlas-sources"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { useSelectedAtlasSoilParameterStore } from "~/store/selected-soil-parameter"

export const meta: MetaFunction = () => {
    return [
        { title: `Percelen - Atlas | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Bekijk alle percelen van uw bedrijf op één interactieve kaart. Visualiseer de geografische spreiding en onderlinge relaties tussen uw percelen.",
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
            const fields = await getFields(
                fdm,
                session.principal_id,
                b_id_farm,
                timeframe,
            )

            const currentSoilDataForFarm = await getCurrentSoilDataForFarm(
                fdm,
                session.principal_id,
                b_id_farm,
                timeframe,
            )

            const features = fields.map((field) => {
                const fieldCurrentSoilData =
                    currentSoilDataForFarm.get(field.b_id) ?? []
                const feature = {
                    type: "Feature" as const,
                    properties: {
                        ...fieldCurrentSoilData.reduce(
                            (acc, data) => {
                                if (data.value !== null)
                                    acc[data.parameter] = data.value
                                return acc
                            },
                            {} as Record<
                                CurrentSoilData[number]["parameter"],
                                string | number
                            >,
                        ),
                        b_id: field.b_id,
                        b_name: field.b_name,
                        b_area: Math.round(field.b_area * 10) / 10,
                        b_lu_name: field.b_lu_name,
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
export default function FarmAtlasFieldSoilBlock() {
    const {
        calendar,
        b_id_farm,
        mapStyle,
        fieldsData,
        soilParametersDescriptions,
    } = useLoaderData<typeof loader>()
    const navigate = useNavigate()

    const heatmapLayerId = "fieldsSaved"
    const heatmapStrokeLayerId = "fieldsSavedStroke"
    const selectedParameter = useSelectedAtlasSoilParameterStore(
        (store) => store.selectedParameter,
    )
    const setSelectedParameter = useSelectedAtlasSoilParameterStore(
        (store) => store.setSelectedParameter,
    )

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
                const mappedValue = parameterMapper.forward(
                    parameterValue as number,
                )
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

    const parameterDescription = soilParametersDescriptions.find(
        (item) => item.parameter === selectedParameter,
    )

    const heatmapLayerStyle = getSoilAnalysisLayerStyle(
        selectedParameter,
        min,
        max,
    )
    // ViewState logic
    const initialViewState = getViewState(fieldsData)
    const [viewState, setViewState] = useState<ViewState>(() => {
        if (typeof window !== "undefined") {
            try {
                const savedViewState = sessionStorage.getItem("mapViewState")
                if (savedViewState) {
                    return JSON.parse(savedViewState)
                }
            } catch {
                // ignore storage errors (e.g., private mode)
            }
        }
        return initialViewState as ViewState
    })

    const [showFields, setShowFields] = useState(true)

    const onViewportChange = useCallback((event: ViewStateChangeEvent) => {
        setViewState(event.viewState)
    }, [])

    const mapRef = useRef<MapRef>(null)

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                sessionStorage.setItem(
                    "mapViewState",
                    JSON.stringify(viewState),
                )
            } catch {
                // ignore storage errors (e.g., private mode)
            }
        }
    }, [viewState])

    const layerLayout = { visibility: showFields ? "visible" : "none" } as const

    const renderHoverPanel = useCallback(
        (feature: GeoJSONFeature) => {
            const value = feature.properties[selectedParameter]
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {feature.properties.b_name}
                            <span className="float-end text-muted-foreground font-normal">
                                {feature.properties.b_area} ha
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            {parameterDescription?.name}
                        </p>
                        {typeof value === "undefined" ? (
                            <p>Geen data</p>
                        ) : parameterDescription?.type === "date" ? (
                            <p>
                                {formatDate(value, "PP", {
                                    locale: nl,
                                })}
                            </p>
                        ) : selectedParameter === "b_soiltype_agr" ? (
                            <p>
                                {SHADED_SOIL_TYPES.find(
                                    (item) => item.value === value,
                                )?.label ?? value}
                            </p>
                        ) : (
                            <p>
                                {value} {parameterDescription?.unit}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )
        },
        [selectedParameter, parameterDescription],
    )

    return (
        <MapGL
            {...viewState}
            ref={mapRef}
            style={{ height: "calc(100vh - 64px)", width: "100%" }}
            interactive={true}
            mapStyle={mapStyle}
            mapLib={maplibregl}
            interactiveLayerIds={[heatmapLayerId]}
            onMove={onViewportChange}
        >
            <Controls
                onViewportChange={({ longitude, latitude, zoom }) =>
                    setViewState((currentViewState) => ({
                        ...currentViewState,
                        longitude,
                        latitude,
                        zoom,
                        pitch: currentViewState.pitch, // Ensure pitch is carried over
                        bearing: currentViewState.bearing, // Ensure bearing is carried over
                    }))
                }
                showFields={showFields}
                onToggleFields={() => setShowFields(!showFields)}
                showFlyToFields={
                    fieldsData && fieldsData.features.length > 0
                        ? true
                        : undefined
                }
                onFlyToFields={() => {
                    setViewState({ ...initialViewState })
                    if (initialViewState.bounds) {
                        mapRef.current?.fitBounds(
                            initialViewState.bounds,
                            initialViewState.fitBoundsOptions,
                        )
                    }
                }}
            />

            <MapTilerAttribution />

            {fieldsData && (
                <FieldSourceClickable
                    id={heatmapLayerId}
                    fieldsData={fieldsData}
                    onFieldClick={(feature) => {
                        navigate(
                            `/farm/${b_id_farm}/${calendar}/atlas/soil-analysis/${feature.properties.b_id}/soil`,
                        )
                    }}
                >
                    <Layer
                        id={heatmapLayerId}
                        {...heatmapLayerStyle}
                        source={heatmapLayerId}
                        layout={layerLayout}
                    />
                    <Layer
                        id={heatmapStrokeLayerId}
                        type="line"
                        paint={{ "line-color": "#ffffff", "line-width": 1.5 }}
                    />
                </FieldSourceClickable>
            )}

            <div className="fields-panel" style={{ maxWidth: "200px" }}>
                <SoilAnalysisLegend
                    fieldsData={fieldsData}
                    selectedParameter={selectedParameter}
                    setSelectedParameter={setSelectedParameter}
                    soilParametersDescriptions={soilParametersDescriptions}
                    min={min}
                    max={max}
                />
                <FieldsPanelHover
                    zoomLevelFields={ZOOM_LEVEL_FIELDS}
                    layer={[heatmapLayerId]}
                    clickRedirectsToDetailsPage={true}
                    render={renderHoverPanel}
                />
            </div>
        </MapGL>
    )
}
