import { getFields } from "@nmi-agro/fdm-core"
import { simplify } from "@turf/turf"
import type { FeatureCollection, Geometry } from "geojson"
import { fromUrl, Pool } from "geotiff"
import throttle from "lodash.throttle"
import maplibregl from "maplibre-gl"
import proj4 from "proj4"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Map as MapGL,
    type MapLayerMouseEvent,
    Layer as MapLibreLayer,
    type MapRef,
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
import { ElevationLegend } from "~/components/blocks/atlas/atlas-legend"
import { FieldsPanelHover } from "~/components/blocks/atlas/atlas-panels"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { COGElevationLayer } from "~/components/blocks/atlas/cog-elevation-layer"
import { DeckGLOverlay } from "~/components/blocks/atlas/deckgl-overlay"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

// Register the projection for RD New (EPSG:28992)
proj4.defs(
    "EPSG:28992",
    "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +units=m +no_defs",
)

// Helper: Simple Point in Polygon for RD coordinates (Ray Casting)
function isPointInPolygon(point: [number, number], vs: [number, number][]) {
    const x = point[0]
    const y = point[1]
    let inside = false
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0]
        const yi = vs[i][1]
        const xj = vs[j][0]
        const yj = vs[j][1]
        const intersect =
            yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        if (intersect) inside = !inside
    }
    return inside
}

// Helper: Check if polygon intersects polygon (simple AABB check for index speed)
function polygonIntersectsPolygon(
    poly1: [number, number][],
    poly2: [number, number][],
) {
    for (const p of poly1) if (isPointInPolygon(p, poly2)) return true
    for (const p of poly2) if (isPointInPolygon(p, poly1)) return true
    return false
}

// GeoTIFF Pool for workers
const pool = new Pool()

// Helper: Get value from COG at location
async function getLocationValue(
    url: string,
    lng: number,
    lat: number,
): Promise<number | null> {
    try {
        // Convert to RD
        const [x, y] = proj4("EPSG:28992").forward([lng, lat])

        // Read COG
        const tiff = await fromUrl(url, { pool })
        const image = await tiff.getImage()
        const bbox = image.getBoundingBox() // [minX, minY, maxX, maxY]
        const width = image.getWidth()
        const height = image.getHeight()

        // Check bounds (RD)
        if (x < bbox[0] || x > bbox[2] || y < bbox[1] || y > bbox[3])
            return null

        // Calculate pixel coordinates
        // Assuming bbox is [minX, minY, maxX, maxY] and image is top-down (standard)
        // Resolution
        const resX = (bbox[2] - bbox[0]) / width
        const resY = (bbox[3] - bbox[1]) / height

        const px = Math.floor((x - bbox[0]) / resX)
        const py = Math.floor((bbox[3] - y) / resY)

        if (px < 0 || px >= width || py < 0 || py >= height) return null

        // Read single pixel
        const rasters = await image.readRasters({
            window: [px, py, px + 1, py + 1],
        })
        if (!rasters || !rasters[0]) return null

        // Handle different raster types (TypedArray)
        const value = (rasters[0] as any)[0]

        // Filter nodata (usually very small or very large, or -9999)
        if (value < -100 || value > 1000) return null

        return value
    } catch (e) {
        // console.warn("Error reading COG:", e)
        return null
    }
}

interface ActiveTile {
    id: string
    url: string
}

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Hoogte - Atlas | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk hoogtegegevens op de kaart.",
        },
    ]
}

/**
 * Loads farm field data for the elevation feature.
 */
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

export default function FarmAtlasElevationBlock() {
    const loaderData = useLoaderData<typeof loader>()
    const fields = loaderData.fields
    const mapStyle = loaderData.mapStyle

    const mapRef = useRef<MapRef>(null)

    // State
    const [indexData, setIndexData] = useState<FeatureCollection | null>(null)
    const [activeTiles, setActiveTiles] = useState<ActiveTile[]>([])
    const [isUpdating, setIsUpdating] = useState(false)
    const [legendMin, setLegendMin] = useState<number>(-5)
    const [legendMax, setLegendMax] = useState<number>(50)
    const [hoverElevation, setHoverElevation] = useState<number | null>(null)
    const [showFields, setShowFields] = useState(true)
    const [showElevation, setShowElevation] = useState(true)
    const [networkStatus, setNetworkStatus] = useState<
        "idle" | "loading" | "slow" | "error"
    >("idle")

    const fieldsSavedId = "fieldsSaved"
    const fieldsSavedStyle = getFieldsStyle(fieldsSavedId)
    const fieldsSavedOutlineStyle = getFieldsStyle("fieldsSavedOutline")
    const layerLayout = { visibility: showFields ? "visible" : "none" } as const

    const onToggleElevation = useCallback(() => {
        setShowElevation((prev) => !prev)
    }, [])

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

    const onViewportChange = useCallback((event: ViewStateChangeEvent) => {
        setViewState(event.viewState)
    }, [])

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

    // Fetch COG Index once
    useEffect(() => {
        async function fetchIndex() {
            const cacheKey = "ahn_kaartbladindex_v1"
            setNetworkStatus("loading")

            // Try cache first
            try {
                if (typeof localStorage !== "undefined") {
                    const cached = localStorage.getItem(cacheKey)
                    if (cached) {
                        const { timestamp, data } = JSON.parse(cached)
                        // Cache for 24 hours and ensure data is valid
                        if (
                            data?.features?.length > 0 &&
                            Date.now() - timestamp < 24 * 60 * 60 * 1000
                        ) {
                            setIndexData(data)
                            setNetworkStatus("idle")
                            return
                        }
                    }
                }
            } catch (e) {
                console.warn("Cache lookup failed, proceeding to fetch:", e)
                try {
                    if (typeof localStorage !== "undefined") {
                        localStorage.removeItem(cacheKey)
                    }
                } catch {}
            }

            // Fetch from our server-side cache
            try {
                const response = await fetch("/atlas/ahn-index")

                if (!response.ok) throw new Error("Failed to fetch COG index")
                const data = (await response.json()) as FeatureCollection
                if (!data.features || data.features.length === 0) {
                    throw new Error("Empty AHN index received")
                }

                setIndexData(data)
                setNetworkStatus("idle")

                if (typeof localStorage !== "undefined") {
                    try {
                        localStorage.setItem(
                            cacheKey,
                            JSON.stringify({ timestamp: Date.now(), data }),
                        )
                    } catch (e) {
                        console.warn("Cache storage failed", e)
                    }
                }
            } catch (e) {
                console.error("Error fetching COG index:", e)

                // Final fallback: Use expired cache if network failed but we have something
                if (typeof localStorage !== "undefined") {
                    try {
                        const cached = localStorage.getItem(cacheKey)
                        if (cached) {
                            const { data } = JSON.parse(cached)
                            if (data?.features?.length > 0) {
                                console.warn(
                                    "Network failed, using expired cache as fallback",
                                )
                                setIndexData(data)
                                setNetworkStatus("idle")
                                return
                            }
                        }
                    } catch {}
                }

                setNetworkStatus("error")
            }
        }
        fetchIndex()
    }, [])

    const updateId = useRef(0)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Function to update visible tiles
    const activeTilesLengthRef = useRef(activeTiles.length)
    useEffect(() => {
        activeTilesLengthRef.current = activeTiles.length
    }, [activeTiles])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [])

    const updateVisibleTiles = useCallback(async () => {
        if (!mapRef.current || !indexData) {
            setIsUpdating(false)
            return
        }

        const bounds = mapRef.current.getBounds()
        const zoom = mapRef.current.getZoom()

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        // If zoomed out, clear active tiles to save resources (WMS will take over)
        if (zoom < 13) {
            if (activeTilesLengthRef.current > 0) {
                setActiveTiles([])
            }
            setIsUpdating(false)
            setNetworkStatus("idle")
            return
        }

        const abortController = new AbortController()
        abortControllerRef.current = abortController
        const signal = abortController.signal

        const currentId = ++updateId.current

        setIsUpdating(true)
        setNetworkStatus("loading")

        // Detect slow network
        const slowTimer = setTimeout(() => {
            if (updateId.current === currentId && !signal.aborted) {
                setNetworkStatus("slow")
            }
        }, 2000)

        const sw = bounds.getSouthWest()
        const ne = bounds.getNorthEast()
        const nw = bounds.getNorthWest()
        const se = bounds.getSouthEast()

        // Convert viewport corners to RD (EPSG:28992)
        try {
            if (signal.aborted) return

            const rdCoords = [
                proj4("EPSG:28992").forward([nw.lng, nw.lat]),
                proj4("EPSG:28992").forward([ne.lng, ne.lat]),
                proj4("EPSG:28992").forward([se.lng, se.lat]),
                proj4("EPSG:28992").forward([sw.lng, sw.lat]),
            ] as [number, number][]

            // Find intersecting tiles
            // Optimization: limit to 12 tiles to avoid overload
            const visibleFeatures = indexData.features
                .filter((f) => {
                    if (!f.geometry || f.geometry.type !== "Polygon")
                        return false
                    const ring = (f.geometry as any).coordinates[0]
                    return polygonIntersectsPolygon(rdCoords, ring)
                })
                .slice(0, 12)

            // Calculate global min/max for the viewport by sampling
            const samplePoints: { lng: number; lat: number }[] = []
            const gridSize = 2 // Reduced from 3 (9 points instead of 16)
            for (let i = 0; i <= gridSize; i++) {
                for (let j = 0; j <= gridSize; j++) {
                    const lng = sw.lng + (ne.lng - sw.lng) * (i / gridSize)
                    const lat = sw.lat + (ne.lat - sw.lat) * (j / gridSize)
                    samplePoints.push({ lng, lat })
                }
            }

            let min = 1000
            let max = -1000

            // Gather values for samples with concurrency limit
            const results: (number | null)[] = []
            const chunkSize = 2 // Reduced from 4
            for (let i = 0; i < samplePoints.length; i += chunkSize) {
                if (signal.aborted || updateId.current !== currentId) break

                const chunk = samplePoints.slice(i, i + chunkSize)
                const chunkResults = await Promise.all(
                    chunk.map(async (p) => {
                        try {
                            const rdP = proj4("EPSG:28992").forward([
                                p.lng,
                                p.lat,
                            ]) as [number, number]
                            // Find which tile contains this point
                            const feature = visibleFeatures.find((f) => {
                                if (
                                    !f.geometry ||
                                    f.geometry.type !== "Polygon"
                                )
                                    return false
                                const ring = (f.geometry as any).coordinates[0]
                                return isPointInPolygon(rdP, ring)
                            })
                            if (feature?.properties) {
                                const url =
                                    feature.properties.url ||
                                    feature.properties.href ||
                                    feature.properties.download_url
                                if (url) {
                                    return await getLocationValue(
                                        url,
                                        p.lng,
                                        p.lat,
                                    )
                                }
                            }
                        } catch {
                            // Ignore errors for individual points
                        }
                        return null
                    }),
                )
                results.push(...chunkResults)
            }

            const values = results

            if (signal.aborted || updateId.current !== currentId) return

            const validValues = values.filter((v) => v !== null) as number[]
            if (validValues.length > 0) {
                min = Math.min(...validValues)
                max = Math.max(...validValues)
            } else {
                min = -5
                max = 50
            }

            // Ensure minimum contrast
            if (max - min < 1) {
                min -= 0.5
                max += 0.5
            }

            // Pad range slightly
            const range = max - min
            min -= range * 0.05
            max += range * 0.05

            setLegendMin(min)
            setLegendMax(max)

            const newTiles: ActiveTile[] = []
            for (const feature of visibleFeatures) {
                if (!feature.properties) continue
                const url =
                    feature.properties.url ||
                    feature.properties.href ||
                    feature.properties.download_url

                if (!url) continue
                const id = feature.properties.kaartbladNr || url

                newTiles.push({
                    id,
                    url,
                })
            }

            setActiveTiles(newTiles)
            setNetworkStatus("idle")
        } catch (e) {
            if (!signal.aborted) {
                console.error("Error updating visible tiles:", e)
                if (updateId.current === currentId) {
                    setNetworkStatus("error")
                }
            }
        } finally {
            if (updateId.current === currentId) {
                setIsUpdating(false)
            }
            clearTimeout(slowTimer)
        }
    }, [indexData])

    // Throttle updates
    const updateRef = useRef(updateVisibleTiles)
    useEffect(() => {
        updateRef.current = updateVisibleTiles
    }, [updateVisibleTiles])

    const throttledUpdate = useMemo(
        () =>
            throttle(() => updateRef.current(), 500, {
                leading: true,
                trailing: true,
            }),
        [],
    )

    // Initial update when map loads or index loads
    useEffect(() => {
        const timer = setTimeout(() => {
            throttledUpdate()
        }, 1000)
        return () => clearTimeout(timer)
    }, [throttledUpdate])

    // Refs for state accessible in throttled functions
    const stateRef = useRef({ indexData, activeTiles })
    useEffect(() => {
        stateRef.current = { indexData, activeTiles }
    }, [indexData, activeTiles])

    // Handle hover to show elevation value
    const handleMouseMove = useMemo(
        () =>
            throttle(async (event: MapLayerMouseEvent) => {
                const { indexData, activeTiles } = stateRef.current

                if (!mapRef.current || mapRef.current.getZoom() < 13) {
                    setHoverElevation(null)
                    return
                }

                if (!indexData || activeTiles.length === 0) return

                const { lng, lat } = event.lngLat

                try {
                    const rdP = proj4("EPSG:28992").forward([lng, lat]) as [
                        number,
                        number,
                    ]

                    const feature = indexData.features.find((f) => {
                        if (!f.geometry || f.geometry.type !== "Polygon")
                            return false
                        const ring = (f.geometry as any).coordinates[0]
                        return isPointInPolygon(rdP, ring)
                    })

                    if (feature?.properties) {
                        const url =
                            feature.properties.url ||
                            feature.properties.href ||
                            feature.properties.download_url
                        if (url) {
                            const value = await getLocationValue(url, lng, lat)
                            if (value !== null && !Number.isNaN(value)) {
                                setHoverElevation(value)
                                return
                            }
                        }
                    }
                    setHoverElevation(null)
                } catch (_e) {
                    setHoverElevation(null)
                }
            }, 200),
        [],
    )

    // Create DeckGL Layers
    const layers = useMemo(() => {
        if (!showElevation || viewState.zoom < 13) return []

        return activeTiles.map(
            (tile) =>
                new COGElevationLayer({
                    id: `ahn-cog-${tile.id}`,
                    geotiff: tile.url,
                    min: legendMin,
                    max: legendMax,
                    // Proj4 projection is handled by Deck.gl if needed or assuming Web Mercator/Auto
                    // For EPSG:28992 COGs, we might need to specify coordinate system if deck.gl doesn't auto-detect
                    // However, COGLayer usually handles it via geotiff.js
                    opacity: 1,
                    // Color map support varies.
                    // If deck.gl-geotiff supports 'colormap' or similar prop in the future, add it here.
                    // Currently rendering as is (likely grayscale or black/white depending on value range)
                }),
        )
    }, [activeTiles, showElevation, viewState.zoom, legendMin, legendMax])

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
                onMoveEnd={throttledUpdate}
                onLoad={throttledUpdate}
                onMouseMove={showElevation ? handleMouseMove : undefined}
            >
                <DeckGLOverlay layers={layers} interleaved={true} />

                <Controls
                    onViewportChange={({ longitude, latitude, zoom }) =>
                        setViewState((currentViewState) => ({
                            ...currentViewState,
                            longitude,
                            latitude,
                            zoom,
                        }))
                    }
                    showFields={showFields}
                    onToggleFields={() => setShowFields(!showFields)}
                    showElevation={showElevation}
                    onToggleElevation={onToggleElevation}
                />

                <MapTilerAttribution />

                {/* WMS Overview Layer (Zoom < 13) */}
                {showElevation && viewState.zoom < 13 && (
                    <Source
                        id="ahn-wms"
                        type="raster"
                        tiles={[
                            "https://service.pdok.nl/rws/ahn/wms/v1_0?service=WMS&request=GetMap&layers=dtm_05m&styles=&format=image/png&transparent=true&version=1.3.0&width=256&height=256&crs=EPSG:3857&bbox={bbox-epsg-3857}",
                        ]}
                        tileSize={256}
                        maxzoom={13}
                        attribution="&copy; <a href='https://www.pdok.nl/'>PDOK</a>, <a href='https://www.ahn.nl/'>AHN</a>"
                    >
                        <MapLibreLayer
                            id="ahn-wms-layer"
                            type="raster"
                            paint={{ "raster-opacity": 0.8 }}
                            beforeId={fields ? "fieldsSavedOutline" : undefined}
                        />
                    </Source>
                )}

                {/* Fields Overlay (Saved Fields) */}
                {fields && (
                    <Source id={fieldsSavedId} type="geojson" data={fields}>
                        {/* Outline Layer - Visual */}
                        <MapLibreLayer
                            {...({
                                ...fieldsSavedOutlineStyle,
                                layout: layerLayout,
                            } as any)}
                        />
                        {/* Fill Layer - Invisible but Clickable/Hoverable */}
                        <MapLibreLayer
                            {...({
                                ...fieldsSavedStyle,
                                layout: layerLayout,
                            } as any)}
                        />
                    </Source>
                )}

                <div className="absolute top-4 left-4 z-10 flex flex-col gap-4">
                    <ElevationLegend
                        min={legendMin}
                        max={legendMax}
                        loading={isUpdating}
                        hoverValue={hoverElevation}
                        showScale={viewState.zoom >= 13 && showElevation}
                        networkStatus={networkStatus}
                        message={
                            showElevation && viewState.zoom < 13
                                ? "Zoom in voor meer detail"
                                : undefined
                        }
                    />
                    <div className="grid gap-4 w-[350px]">
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
