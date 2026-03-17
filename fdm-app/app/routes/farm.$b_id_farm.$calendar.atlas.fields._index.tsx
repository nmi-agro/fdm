import { getFields } from "@nmi-agro/fdm-core"
import { simplify } from "@turf/turf"
import type { FeatureCollection, Geometry } from "geojson"
import maplibregl from "maplibre-gl"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    Layer,
    Map as MapGL,
    type MapRef,
    type ViewState,
    type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import type { MetaFunction } from "react-router"
import { type LoaderFunctionArgs, useLoaderData } from "react-router"
import { ZOOM_LEVEL_FIELDS } from "~/components/blocks/atlas/atlas"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { FieldsPanelHover } from "~/components/blocks/atlas/atlas-panels"
import {
    FieldsSourceAvailable,
    FieldsSourceNotClickable,
} from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

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
        let featureCollection: FeatureCollection | undefined
        if (b_id_farm && b_id_farm !== "undefined") {
            const fields = await getFields(
                fdm,
                session.principal_id,
                b_id_farm,
                timeframe,
            )
            const features = fields.map((field) => {
                const feature = {
                    type: "Feature" as const,
                    properties: {
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

            featureCollection = {
                type: "FeatureCollection",
                features: features,
            }
        }

        // Get Map Style
        const mapStyle = getMapStyle("satellite")

        // Return user information from loader
        return {
            calendar: calendar,
            savedFields: featureCollection,
            mapStyle: mapStyle,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders a Maplibre map displaying farm fields with interactive controls.
 *
 * This component consumes preloaded farm field data to compute the map's view state and stylize the field boundaries.
 * It integrates geolocation and navigation controls, wraps the field layer in a non-interactive source, and includes a panel for displaying additional field details on hover.
 */
export default function FarmAtlasFieldsBlock() {
    const loaderData = useLoaderData<typeof loader>()

    const id = "fieldsSaved"
    const fields = loaderData.savedFields
    const fieldsSavedStyle = getFieldsStyle(id)
    const fieldsAvailableId = "fieldsAvailable"
    const fieldsAvailableStyle = getFieldsStyle(fieldsAvailableId)
    const fieldsSavedOutlineStyle = getFieldsStyle("fieldsSavedOutline")
    // ViewState logic
    const initialViewState = getViewState(fields)
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
    return (
        <MapGL
            {...viewState}
            ref={mapRef}
            style={{ height: "calc(100vh - 64px)", width: "100%" }}
            interactive={true}
            mapStyle={loaderData.mapStyle}
            mapLib={maplibregl}
            interactiveLayerIds={[id, fieldsAvailableId]}
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
                    fields && fields.features.length > 0 ? true : undefined
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

            <FieldsSourceAvailable
                id={fieldsAvailableId}
                calendar={loaderData.calendar}
                zoomLevelFields={ZOOM_LEVEL_FIELDS}
                redirectToDetailsPage={true}
            >
                <Layer
                    {...({
                        ...fieldsAvailableStyle,
                        layout: layerLayout,
                    } as any)}
                />
            </FieldsSourceAvailable>

            {fields && (
                <FieldsSourceNotClickable id={id} fieldsData={fields}>
                    <Layer
                        {...fieldsSavedOutlineStyle}
                        source={id}
                        layout={layerLayout}
                    />
                    <Layer
                        {...fieldsSavedStyle}
                        source={id}
                        layout={layerLayout}
                    />
                </FieldsSourceNotClickable>
            )}

            <div className="fields-panel grid gap-4 w-[350px]">
                <FieldsPanelHover
                    zoomLevelFields={ZOOM_LEVEL_FIELDS}
                    layer={fieldsAvailableId}
                    layerExclude={id}
                    clickRedirectsToDetailsPage={true}
                />
                <FieldsPanelHover
                    zoomLevelFields={ZOOM_LEVEL_FIELDS}
                    layer={id}
                />
            </div>
        </MapGL>
    )
}
