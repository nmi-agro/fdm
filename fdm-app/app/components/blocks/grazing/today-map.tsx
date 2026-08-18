import type { FeatureCollection } from "geojson"
import type { StyleSpecification } from "maplibre-gl"
import type { LayerProps } from "react-map-gl/maplibre"
import centroid from "@turf/centroid"
import * as maplibregl from "maplibre-gl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Layer,
  Map as MapGL,
  Marker,
  type MapMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { type AtlasViewState, getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { cn } from "~/lib/utils"

const GRAZING_MAP_FIELDS_LAYER = "grazingMapFields"
const GRAZING_MAP_OUTLINE_LAYER = "grazingMapFieldsOutline"
const GRAZING_MAP_SOURCE = "grazingMapSource"

export interface TodayGrazingMapProps {
  fieldsGeoJSON: FeatureCollection
  mapStyle: string | StyleSpecification
  height?: string
  onFieldClick?: (b_id: string) => void
}

export function TodayGrazingMap({
  fieldsGeoJSON,
  mapStyle,
  height = "calc(100vh - 64px)",
  onFieldClick,
}: TodayGrazingMapProps) {
  const mapRef = useRef<MapRef>(null)
  const initialViewState = useMemo(() => getViewState(fieldsGeoJSON), [fieldsGeoJSON])
  const [viewState, setViewState] = useState<AtlasViewState>(initialViewState)
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null)

  useEffect(() => {
    if (initialViewState.bounds) {
      mapRef.current?.fitBounds(initialViewState.bounds, initialViewState.fitBoundsOptions)
    }
  }, [initialViewState])

  const onViewportChange = useCallback(
    (event: ViewStateChangeEvent) => setViewState(event.viewState),
    [],
  )

  const onMouseMove = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0]
    setHoveredFieldId(feature ? ((feature.properties?.b_id as string) ?? null) : null)
  }, [])

  const onMouseLeave = useCallback(() => setHoveredFieldId(null), [])

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const b_id = e.features?.[0]?.properties?.b_id as string | undefined
      if (!b_id) return
      const feature = fieldsGeoJSON.features.find((f) => f.properties?.b_id === b_id)
      if (feature?.properties?.status === "disabled") return
      if (onFieldClick) {
        onFieldClick(b_id)
      }
    },
    [onFieldClick, fieldsGeoJSON],
  )

  const fillStyle: LayerProps = useMemo(
    () => ({
      id: GRAZING_MAP_FIELDS_LAYER,
      type: "fill",
      paint: {
        "fill-color": [
          "match",
          ["get", "status"],
          "weiden_today",
          "#10b981", // Vibrant emerald for active grazing today
          "maaien_today",
          "#f59e0b", // Vibrant amber for mowing today
          "last_weiden",
          "#34d399", // Soft pastel green for previously grazed
          "last_maaien",
          "#fbbf24", // Soft pastel amber for previously mown
          "unused",
          "#ffffff", // Light white coloring for unused grassland
          "disabled",
          "#cbd5e1", // Grey for bufferstrips / arable
          "#94a3b8",
        ] as any,
        "fill-opacity": [
          "match",
          ["get", "status"],
          "weiden_today",
          0.7,
          "maaien_today",
          0.7,
          "last_weiden",
          0.38,
          "last_maaien",
          0.38,
          "unused",
          0.42,
          "disabled",
          0.12,
          0.2,
        ] as any,
      },
    }),
    [],
  )

  const outlineStyle: LayerProps = useMemo(
    () => ({
      id: GRAZING_MAP_OUTLINE_LAYER,
      type: "line",
      paint: {
        "line-color": [
          "match",
          ["get", "status"],
          "weiden_today",
          "#047857",
          "maaien_today",
          "#b45309",
          "last_weiden",
          "#059669",
          "last_maaien",
          "#d97706",
          "unused",
          "#f8fafc",
          "disabled",
          "#94a3b8",
          "#64748b",
        ] as any,
        "line-width": [
          "match",
          ["get", "status"],
          "weiden_today",
          3.5,
          "maaien_today",
          3.5,
          "last_weiden",
          2,
          "last_maaien",
          2,
          "unused",
          2,
          1,
        ] as any,
      },
    }),
    [],
  )

  const hoveredFeature = useMemo(() => {
    if (!hoveredFieldId) return null
    return fieldsGeoJSON.features.find((f) => f.properties?.b_id === hoveredFieldId) ?? null
  }, [fieldsGeoJSON, hoveredFieldId])

  // Compute centroids for parcel center badges
  const fieldCentroids = useMemo(() => {
    return fieldsGeoJSON.features
      .map((feature) => {
        try {
          const c = centroid(feature)
          return {
            b_id: feature.properties?.b_id,
            b_name: feature.properties?.b_name,
            b_area: feature.properties?.b_area,
            status: feature.properties?.status,
            labelText: feature.properties?.labelText,
            herdName: feature.properties?.herdName,
            coordinates: c.geometry.coordinates as [number, number],
          }
        } catch {
          return null
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
  }, [fieldsGeoJSON])

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ height, isolation: "isolate" }}>
      <MapGL
        {...viewState}
        ref={mapRef}
        style={{ height: "100%", width: "100%" }}
        mapStyle={mapStyle as any}
        mapLib={maplibregl}
        interactiveLayerIds={[GRAZING_MAP_FIELDS_LAYER]}
        onMove={onViewportChange}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        cursor={hoveredFieldId && hoveredFeature?.properties?.status !== "disabled" ? "pointer" : "default"}
      >
        <Controls
          onViewportChange={({ longitude, latitude, zoom }) =>
            setViewState((current) => ({
              ...current,
              longitude,
              latitude,
              zoom,
            }))
          }
          showFlyToFields={fieldsGeoJSON.features.length > 0}
          onFlyToFields={() => {
            setViewState({ ...initialViewState })
            if (initialViewState.bounds) {
              mapRef.current?.fitBounds(initialViewState.bounds, initialViewState.fitBoundsOptions)
            }
          }}
        />

        <MapTilerAttribution />

        <FieldsSourceNotClickable id={GRAZING_MAP_SOURCE} fieldsData={fieldsGeoJSON}>
          <Layer {...fillStyle} id={GRAZING_MAP_FIELDS_LAYER} source={GRAZING_MAP_SOURCE} />
          <Layer {...outlineStyle} id={GRAZING_MAP_OUTLINE_LAYER} source={GRAZING_MAP_SOURCE} />
        </FieldsSourceNotClickable>

        {/* Centroid Badges on Parcels */}
        {fieldCentroids.map((c) => {
          if (!c.labelText || c.status === "disabled") return null
          return (
            <Marker
              key={c.b_id}
              longitude={c.coordinates[0]}
              latitude={c.coordinates[1]}
              anchor="center"
            >
              <div
                className={cn(
                  "pointer-events-none rounded-md px-1.5 py-0.5 text-[11px] font-semibold shadow-xs select-none backdrop-blur-xs transition-all",
                  c.status === "weiden_today" && "bg-emerald-600 text-white ring-1 ring-white/50",
                  c.status === "maaien_today" && "bg-amber-600 text-white ring-1 ring-white/50",
                  (c.status === "last_weiden" || c.status === "last_maaien") &&
                    "bg-background/90 text-foreground border border-border shadow-xs",
                  c.status === "unused" &&
                    "bg-white/95 text-slate-800 dark:bg-slate-900/95 dark:text-slate-100 border border-slate-300/80 dark:border-slate-700 shadow-xs text-[10.5px] font-medium backdrop-blur-sm",
                )}
              >
                {c.labelText}
              </div>
            </Marker>
          )
        })}
      </MapGL>

      {/* Hover Floating Card */}
      {hoveredFeature && (
        <div className="bg-background/95 pointer-events-none absolute bottom-4 left-4 z-20 rounded-xl border p-3.5 text-xs shadow-lg backdrop-blur-md max-w-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-sm text-foreground">
              {hoveredFeature.properties?.b_name ?? "Perceel"}
            </span>
            <span className="text-muted-foreground font-medium">
              {hoveredFeature.properties?.b_area} ha
            </span>
          </div>

          {hoveredFeature.properties?.status === "weiden_today" && (
            <div className="space-y-0.5 text-emerald-950 dark:text-emerald-200">
              <p className="font-semibold text-xs">
                {hoveredFeature.properties?.herdName ?? "Koppel"}{" "}
                {hoveredFeature.properties?.animalCount
                  ? `(${hoveredFeature.properties?.animalCount} ${hoveredFeature.properties?.animalCount === 1 ? "dier" : "dieren"})`
                  : ""}{" "}
                · actief weiden
              </p>
              <p className="text-muted-foreground text-[11px]">
                {hoveredFeature.properties?.hours ? `${hoveredFeature.properties?.hours} uur/dag` : "Uren niet ingevuld"}
              </p>
            </div>
          )}

          {hoveredFeature.properties?.status === "maaien_today" && (
            <p className="text-amber-900 dark:text-amber-200 font-semibold">
              Vandaag gemaaid (maaisnede)
            </p>
          )}

          {hoveredFeature.properties?.status === "last_weiden" && (
            <p className="text-muted-foreground text-[11px]">
              Laatst beweid · <strong className="text-foreground">{hoveredFeature.properties?.restDays} dagen rust</strong>
            </p>
          )}

          {hoveredFeature.properties?.status === "last_maaien" && (
            <p className="text-muted-foreground text-[11px]">
              Laatst gemaaid · <strong className="text-foreground">{hoveredFeature.properties?.restDays} dagen rust</strong>
            </p>
          )}

          {hoveredFeature.properties?.status === "unused" && (
            <p className="text-emerald-800 dark:text-emerald-300 font-medium text-[11px]">
              Graslandperceel · Nog niet gebruikt dit seizoen
            </p>
          )}

          {hoveredFeature.properties?.status === "disabled" && (
            <p className="text-muted-foreground text-[11px]">
              {hoveredFeature.properties?.isBufferstrip ? "Bufferstrook (niet beweid)" : "Geen graslandperceel"}
            </p>
          )}

          {hoveredFeature.properties?.status !== "disabled" && (
            <p className="text-[10px] text-primary pt-1 border-t font-medium">
              Klik op het perceel om beweiding vast te leggen →
            </p>
          )}
        </div>
      )}
    </div>
  )
}
