import type { FeatureCollection, Geometry } from "geojson"
import type { Map as MaplibreMap } from "maplibre-gl"
import { getFields } from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import throttle from "lodash.throttle"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  Layer,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
  Source,
} from "react-map-gl/maplibre"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useParams } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import {
  buildAhnItems,
  createElevationLayer,
  createFieldOutlineLayer,
  DeckGlCanvas,
  ElevationTiles,
} from "~/components/blocks/atlas/atlas-elevation.client"
import { ElevationLegend } from "~/components/blocks/atlas/atlas-legend"
import { FieldTooltip } from "~/components/blocks/atlas/atlas-panels"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { SATELLITE_BACKGROUND_REQUIRED_MESSAGE } from "~/components/blocks/atlas/atlas-style-select"
import { getDottedFieldOutlineStyle, getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { ZOOM_LEVEL_FIELDS } from "~/components/blocks/atlas/atlas-util"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { useAnalytics } from "~/hooks/use-analytics"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/** From this zoom level on the map draws the AHN kaartbladen; below it the PDOK WMS overview. */
const ZOOM_LEVEL_ELEVATION = 13
/** Legend range (m NAP) until the first tiles in view have loaded; covers most of the country. */
const DEFAULT_RANGE = { min: -5, max: 50 }
/** Smallest legend range in m, so a nearly flat view isn't stretched into noise. */
const MIN_RANGE_SPAN = 1
/** Margin added on both ends of the legend range, as a share of the range. */
const RANGE_PADDING = 0.05

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
      const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)
      const features = fields.map((field) => {
        const feature = {
          type: "Feature" as const,
          properties: {
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
  const params = useParams()
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("atlas_viewed", {
      b_id_farm: params.b_id_farm,
      calendar: params.calendar,
      layer: "elevation",
    })
  }, [capture, params.b_id_farm, params.calendar])

  const mapRef = useRef<MapRef>(null)

  // State
  const [indexData, setIndexData] = useState<FeatureCollection | null>(null)
  const [indexStatus, setIndexStatus] = useState<"idle" | "loading" | "error">("idle")
  const [range, setRange] = useState(DEFAULT_RANGE)
  const [hoverElevation, setHoverElevation] = useState<number | null>(null)
  const [showFields, setShowFields] = useState(true)
  const [showElevation, setShowElevation] = useState(true)
  const [currentZoom, setCurrentZoom] = useState<number>(0)

  const fieldsSavedId = "fieldsSaved"
  const fieldsSavedStyle = getFieldsStyle(fieldsSavedId)
  const layerLayout = { visibility: showFields ? "visible" : "none" } as const
  // White dotted outline around every field; keep its round caps and add the visibility toggle
  const dottedOutlineStyle = getDottedFieldOutlineStyle()
  const fieldsOutlineLayer = {
    ...dottedOutlineStyle,
    layout: { ...dottedOutlineStyle.layout, ...layerLayout },
  } as LayerProps

  const initialViewState = getViewState(fields)

  // The decoded AHN tiles on the map, shared by the layer, the legend range and the hover value.
  const [tiles] = useState(() => new ElevationTiles())
  const tilesStatus = useSyncExternalStore(tiles.subscribe, tiles.getStatus, () => "idle" as const)
  const items = useMemo(() => (indexData ? buildAhnItems(indexData) : []), [indexData])

  // Fetch COG Index once
  useEffect(() => {
    async function fetchIndex() {
      const cacheKey = "ahn_kaartbladindex_v1"
      setIndexStatus("loading")

      // Try cache first
      try {
        if (typeof localStorage !== "undefined") {
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            const { timestamp, data } = JSON.parse(cached)
            // Cache for 24 hours and ensure data is valid
            if (data?.features?.length > 0 && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
              setIndexData(data)
              setIndexStatus("idle")
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
        setIndexStatus("idle")

        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }))
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
                console.warn("Network failed, using expired cache as fallback")
                setIndexData(data)
                setIndexStatus("idle")
                return
              }
            }
          } catch {}
        }

        setIndexStatus("error")
      }
    }
    void fetchIndex()
  }, [])

  // Legend range: lowest and highest elevation of the loaded pixels in view, recomputed when the
  // view changes and when tiles arrive. The layer is coloured with the same range.
  const updateRange = useMemo(
    () =>
      throttle(
        (map: Pick<MaplibreMap, "getZoom" | "getBounds">) => {
          if (map.getZoom() < ZOOM_LEVEL_ELEVATION) return
          const bounds = map.getBounds()
          const found = tiles.rangeIn(
            [
              bounds.getNorthWest(),
              bounds.getNorthEast(),
              bounds.getSouthEast(),
              bounds.getSouthWest(),
            ].map((corner): [number, number] => [corner.lng, corner.lat]),
          )
          if (!found) return

          let { min, max } = found
          if (max - min < MIN_RANGE_SPAN) {
            const widen = (MIN_RANGE_SPAN - (max - min)) / 2
            min -= widen
            max += widen
          }
          const padding = (max - min) * RANGE_PADDING
          setRange({ min: min - padding, max: max + padding })
        },
        300,
        { leading: true, trailing: true },
      ),
    [tiles],
  )

  // Recompute the legend range whenever the tile store changes (tiles arrive or leave), not only
  // when the map stops moving: the tiles in view often finish loading after `moveend`. The store
  // returns the unsubscribe function, which React calls on unmount.
  useEffect(
    () =>
      tiles.subscribe(() => {
        const map = mapRef.current
        if (map) updateRange(map)
      }),
    [tiles, updateRange],
  )
  useEffect(() => () => updateRange.cancel(), [updateRange])

  // Hover: read the elevation from the loaded tiles, without a request.
  const handleMouseMove = (event: MapLayerMouseEvent) => {
    if (event.target.getZoom() < ZOOM_LEVEL_ELEVATION) {
      setHoverElevation(null)
      return
    }
    setHoverElevation(tiles.valueAt(event.lngLat.lng, event.lngLat.lat))
  }

  const showTiles = showElevation && currentZoom >= ZOOM_LEVEL_ELEVATION && items.length > 0
  // The deck.gl canvas lies on top of the map, so it draws the field outlines over the elevation.
  const deckLayers = showTiles
    ? [
        createElevationLayer({ items, tiles, min: range.min, max: range.max }),
        fields ? createFieldOutlineLayer(fields, showFields) : null,
      ]
    : []

  const networkStatus =
    indexStatus === "error" ? "error" : indexStatus === "loading" ? "loading" : tilesStatus

  return (
    <div className="relative h-full w-full">
      <Atlas
        ref={mapRef}
        initialViewState={initialViewState}
        interactive={true}
        mapStyle="satellite"
        onMoveEnd={(e) => updateRange(e.target)}
        onMouseMove={showElevation ? handleMouseMove : undefined}
        onZoom={(e) => setCurrentZoom(e.viewState.zoom)}
        onLoad={(e) => setCurrentZoom(e.target.getZoom())}
      >
        <Controls
          showFlyToFields={fields && fields.features.length > 0}
          showStyleSelect={true}
          styleSelectWarning={SATELLITE_BACKGROUND_REQUIRED_MESSAGE}
          initialViewState={initialViewState}
          showFields={showFields}
          onToggleFields={() => setShowFields(!showFields)}
          showElevation={showElevation}
          onToggleElevation={() => setShowElevation(!showElevation)}
        />

        <MapTilerAttribution />

        {/* WMS Overview Layer (Zoom < 13) */}
        {showElevation && currentZoom < ZOOM_LEVEL_ELEVATION && (
          <Source
            id="ahn-wms"
            type="raster"
            tiles={[
              "https://service.pdok.nl/rws/ahn/wms/v1_0?service=WMS&request=GetMap&layers=dtm_05m&styles=&format=image/png&transparent=true&version=1.3.0&width=256&height=256&crs=EPSG:3857&bbox={bbox-epsg-3857}",
            ]}
            tileSize={256}
            maxzoom={ZOOM_LEVEL_ELEVATION}
            attribution="&copy; <a href='https://www.pdok.nl/'>PDOK</a>, <a href='https://www.ahn.nl/'>AHN</a>"
          >
            <Layer
              id="ahn-wms-layer"
              type="raster"
              paint={{ "raster-opacity": 0.8 }}
              beforeId={fields ? "fieldsSavedOutline" : undefined}
            />
          </Source>
        )}

        {/* AHN kaartbladen (Zoom >= 13) and field outlines, drawn by deck.gl above the map */}
        <DeckGlCanvas layers={deckLayers} />

        {/* Fields Overlay (Saved Fields) */}
        {fields && (
          <Source id={fieldsSavedId} type="geojson" data={fields}>
            {/* Outline Layer - white dotted, as in the other thematic atlas layers */}
            <Layer id="fieldsSavedOutline" {...fieldsOutlineLayer} />
            {/* Fill Layer - Invisible but Clickable/Hoverable */}
            <Layer
              {...({
                ...fieldsSavedStyle,
                layout: layerLayout,
              } as any)}
            />
          </Source>
        )}

        <div className="absolute top-4 left-4 z-10 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <ElevationLegend
              min={range.min}
              max={range.max}
              loading={networkStatus === "loading" || networkStatus === "slow"}
              hoverValue={hoverElevation}
              showScale={currentZoom >= ZOOM_LEVEL_ELEVATION && showElevation}
              networkStatus={networkStatus}
              message={
                showElevation && currentZoom < ZOOM_LEVEL_ELEVATION
                  ? "Zoom in voor meer detail"
                  : undefined
              }
            />
          </div>
          <FieldTooltip zoomLevelFields={ZOOM_LEVEL_FIELDS} layer={fieldsSavedId} />
        </div>
      </Atlas>
    </div>
  )
}
