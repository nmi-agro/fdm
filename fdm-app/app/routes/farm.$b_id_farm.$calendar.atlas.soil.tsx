import { getFields } from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import DOMPurify from "dompurify"
import type { FeatureCollection, Geometry } from "geojson"
import maplibregl from "maplibre-gl"
import proj4 from "proj4"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    Layer,
    Map as MapGL,
    type MapLayerMouseEvent,
    type MapRef,
    Popup,
    Source,
    type ViewState,
    type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import {
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { ZOOM_LEVEL_FIELDS } from "~/components/blocks/atlas/atlas"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { FieldsPanelHover } from "~/components/blocks/atlas/atlas-panels"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { Badge } from "~/components/ui/badge"
import { Spinner } from "~/components/ui/spinner"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

// Ensure EPSG:3857 is available
if (!proj4.defs("EPSG:3857")) {
    proj4.defs(
        "EPSG:3857",
        "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs",
    )
}

// Helper to recursively reproject coordinates
const transformCoords = (coords: any[]): any[] => {
    if (typeof coords[0] === "number") {
        return proj4("EPSG:3857", "EPSG:4326", coords as [number, number])
    }
    return coords.map(transformCoords)
}

export const meta: MetaFunction = () => {
    return [
        { title: `Bodemkaart - Atlas | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk de bodemkaart.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm

        const session = await getSession(request)
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
                        b_area: Math.round((field.b_area ?? 0) * 10) / 10,
                        b_lu_name: (field as any).b_lu_name,
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

        const mapStyle = getMapStyle("satellite")

        return {
            fields: featureCollection,
            mapStyle,
            calendar,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmAtlasSoilBlock() {
    const loaderData = useLoaderData<typeof loader>()
    const fields = loaderData.fields
    const mapStyle = loaderData.mapStyle

    const mapRef = useRef<MapRef>(null)

    // State
    const [selectedSoilFeature, setSelectedSoilFeature] =
        useState<FeatureCollection | null>(null)
    const [popupInfo, setPopupInfo] = useState<{
        longitude: number
        latitude: number
        properties: Record<string, any>
    } | null>(null)
    const [showFields, setShowFields] = useState(true)
    const [showSoil, setShowSoil] = useState(true)

    const fieldsSavedId = "fieldsSaved"
    const fieldsSavedStyle = getFieldsStyle(fieldsSavedId)
    const fieldsSavedOutlineStyle = getFieldsStyle("fieldsSavedOutline")
    const fieldsSelectedStyle = getFieldsStyle("fieldsSelected")
    const layerLayout = { visibility: showFields ? "visible" : "none" } as const

    interface BodemData {
        omschrijving?: string
    }
    interface BodemResponse {
        success: boolean
        data?: Partial<BodemData>
    }
    // Ordered from the least recently used to the most
    const [cachedBodemData, setCachedBodemData] = useState<
        { key: string; value: BodemData }[]
    >([])

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

    const onViewportChange = useCallback((event: ViewStateChangeEvent) => {
        setViewState(event.viewState)
    }, [])

    const fetchBodemData = useCallback(
        async (first_soilcode: string | undefined, signal?: AbortSignal) => {
            const placeholderData = {
                omschrijving: "geen informatie beschikbaar",
            }
            if (!first_soilcode) {
                return placeholderData
            }
            try {
                const found = cachedBodemData.find(
                    (item) => item.key === first_soilcode,
                )
                if (found) {
                    // If found in the cache, move the cached item to the end of the list
                    setCachedBodemData((cachedBodemData) => {
                        const cachedIndex = cachedBodemData.findIndex(
                            (item) => item.key === first_soilcode,
                        )
                        if (cachedIndex > -1) {
                            const update = [...cachedBodemData]
                            const cached = update.splice(cachedIndex, 1)
                            update.push(cached[0])
                            return update
                        }
                        return cachedBodemData
                    })
                    return found.value
                }
                const response: BodemResponse = await fetch(
                    `/farm/undefined/all/atlas/soil/bodemdata/${encodeURIComponent(first_soilcode)}`,
                    { signal },
                ).then((r) => r.json())
                if (response.success && response.data) {
                    // If Bodemdata has data, cache it by adding to the end of the cache list
                    const data = Object.keys(response.data).length
                        ? (response.data as BodemData)
                        : placeholderData
                    if (data.omschrijving)
                        data.omschrijving = DOMPurify(window).sanitize(
                            data.omschrijving,
                            {
                                ALLOWED_TAGS: [],
                            },
                        )
                    setCachedBodemData((cachedBodemData) => {
                        const update = [
                            ...cachedBodemData,
                            {
                                key: first_soilcode,
                                value: data,
                            },
                        ]
                        if (update.length > 20) {
                            // If the list gets too long, drop the least recently used items
                            update.splice(0, update.length - 20)
                        }
                        return update
                    })

                    return data
                }
                return {
                    omschrijving: `Error: ${(response as any).error ?? "onbekende error"}`,
                }
            } catch (e) {
                if ((e as Error).name === "AbortError") throw e
                console.error(e)
                return {
                    omschrijving: `Error: ${(e as any)?.message ?? "onbekende error"}`,
                }
            }
        },
        [cachedBodemData],
    )

    const abortControllerRef = useRef<AbortController | null>(null)

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [])

    const onMapClick = useCallback(
        async (event: MapLayerMouseEvent) => {
            if (!showSoil || !mapRef.current) return

            // Cancel previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            const abortController = new AbortController()
            abortControllerRef.current = abortController
            const signal = abortController.signal

            // Clear previous popup/selection
            setPopupInfo(null)
            setSelectedSoilFeature(null)

            const map = mapRef.current.getMap()
            const { point, lngLat } = event

            // Construct GetFeatureInfo request
            const bounds = map.getBounds()
            const width = map.getCanvas().offsetWidth
            const height = map.getCanvas().offsetHeight

            // Use proj4 to get bounds in EPSG:3857
            const sw = proj4("EPSG:3857").forward([
                bounds.getWest(),
                bounds.getSouth(),
            ])
            const ne = proj4("EPSG:3857").forward([
                bounds.getEast(),
                bounds.getNorth(),
            ])
            const bbox = `${sw[0]},${sw[1]},${ne[0]},${ne[1]}`

            const params = new URLSearchParams({
                service: "WMS",
                version: "1.3.0",
                request: "GetFeatureInfo",
                layers: "soilarea",
                query_layers: "soilarea",
                info_format: "application/json",
                crs: "EPSG:3857",
                bbox: bbox,
                width: width.toString(),
                height: height.toString(),
                I: Math.round(point.x).toString(),
                J: Math.round(point.y).toString(),
            })

            const url = `https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0?${params.toString()}`

            try {
                const response = await fetch(url, { signal })
                if (response.ok) {
                    const data = (await response.json()) as FeatureCollection
                    if (data.features && data.features.length > 0) {
                        const feature = data.features[0]
                        const props = feature.properties || {}

                        // Reproject geometry from EPSG:3857 to EPSG:4326
                        if (
                            feature.geometry &&
                            (feature.geometry as any).coordinates
                        ) {
                            ;(feature.geometry as any).coordinates =
                                transformCoords(
                                    (feature.geometry as any).coordinates,
                                )
                        }

                        setSelectedSoilFeature({
                            type: "FeatureCollection",
                            features: [feature],
                        })
                        setPopupInfo({
                            longitude: lngLat.lng,
                            latitude: lngLat.lat,
                            properties: props,
                        })

                        // Get additional data from BodemData
                        const bodemData = await fetchBodemData(
                            props.first_soilcode,
                            signal,
                        )
                        setPopupInfo((popupInfo) => {
                            if (
                                popupInfo &&
                                popupInfo.properties.first_soilcode ===
                                    props.first_soilcode
                            )
                                return {
                                    ...popupInfo,
                                    properties: {
                                        ...popupInfo.properties,
                                        bodemData: bodemData,
                                    },
                                }
                            return popupInfo
                        })
                    }
                }
            } catch (e) {
                if ((e as Error).name !== "AbortError") {
                    console.error("Failed to fetch soil info", e)
                }
            }
        },
        [fetchBodemData, showSoil],
    )

    const onToggleSoil = useCallback(() => {
        setShowSoil((prev) => {
            if (prev) {
                // Cancel previous request
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort()
                    abortControllerRef.current = null
                }
                // Clearing selection when switching off
                setSelectedSoilFeature(null)
                setPopupInfo(null)
            }
            return !prev
        })
    }, [])

    const onToggleFields = useCallback(() => {
        setShowFields((prev) => !prev)
    }, [])

    const onControlsViewportChange = useCallback(
        ({
            longitude,
            latitude,
            zoom,
        }: {
            longitude: number
            latitude: number
            zoom: number
        }) => {
            setViewState((current) => ({
                ...current,
                longitude,
                latitude,
                zoom,
            }))
        },
        [],
    )

    return (
        <div className="relative h-full w-full">
            <MapGL
                ref={mapRef}
                {...viewState}
                style={{ height: "calc(100vh - 64px)", width: "100%" }}
                interactive={true}
                mapStyle={mapStyle}
                mapLib={maplibregl}
                onMove={onViewportChange}
                onClick={onMapClick}
                cursor={showSoil ? "pointer" : undefined}
            >
                <Controls
                    onViewportChange={onControlsViewportChange}
                    showFields={showFields}
                    onToggleFields={onToggleFields}
                    showSoil={showSoil}
                    onToggleSoil={onToggleSoil}
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

                {/* Soil WMS Layer */}
                {showSoil && (
                    <Source
                        id="soil-wms"
                        type="raster"
                        tiles={[
                            "https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0?service=WMS&request=GetMap&layers=soilarea&styles=&format=image/png&transparent=true&version=1.3.0&width=256&height=256&crs=EPSG:3857&bbox={bbox-epsg-3857}",
                        ]}
                        tileSize={256}
                        attribution="&copy; <a href='https://www.pdok.nl/'>PDOK</a>, <a href='https://www.broloket.nl/'>BRO</a>"
                    >
                        <Layer
                            id="soil-wms-layer"
                            type="raster"
                            paint={{ "raster-opacity": 0.7 }}
                        />
                    </Source>
                )}

                {/* Selected Soil Feature Highlight */}
                {showSoil && selectedSoilFeature && (
                    <Source
                        id="selected-soil-source"
                        type="geojson"
                        data={selectedSoilFeature}
                    >
                        <Layer {...(fieldsSelectedStyle as any)} />
                    </Source>
                )}

                {/* Fields Overlay */}
                {fields && (
                    <Source id={fieldsSavedId} type="geojson" data={fields}>
                        <Layer
                            {...({
                                ...fieldsSavedOutlineStyle,
                                layout: layerLayout,
                            } as any)}
                        />
                        <Layer
                            {...({
                                ...fieldsSavedStyle,
                                layout: layerLayout,
                            } as any)}
                        />
                    </Source>
                )}

                {/* Popup */}
                {showSoil && popupInfo && (
                    <Popup
                        longitude={popupInfo.longitude}
                        latitude={popupInfo.latitude}
                        closeButton={true}
                        closeOnClick={false}
                        onClose={() => {
                            setSelectedSoilFeature(null)
                            setPopupInfo(null)
                        }}
                        anchor="bottom"
                        maxWidth="350px"
                    >
                        <div className="p-3">
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="font-semibold text-sm leading-snug">
                                    {popupInfo.properties.first_soilname ||
                                        popupInfo.properties
                                            .normal_soilprofile_name ||
                                        "Onbekende bodem"}
                                </h3>
                                {popupInfo.properties.first_soilcode && (
                                    <Badge
                                        variant="secondary"
                                        className="shrink-0 font-mono"
                                    >
                                        {popupInfo.properties.first_soilcode}
                                    </Badge>
                                )}
                            </div>
                            {popupInfo.properties.bodemData ? (
                                popupInfo.properties.bodemData.omschrijving && (
                                    <p className="text-muted-foreground">
                                        {
                                            popupInfo.properties.bodemData
                                                .omschrijving
                                        }
                                    </p>
                                )
                            ) : (
                                <Spinner />
                            )}
                        </div>
                    </Popup>
                )}

                <div className="absolute top-4 left-4 z-10 flex flex-col gap-4">
                    <div className="grid gap-4 w-87.5">
                        <FieldsPanelHover
                            zoomLevelFields={ZOOM_LEVEL_FIELDS}
                            layer={fieldsSavedId}
                        />
                    </div>
                </div>
            </MapGL>
        </div>
    )
}
