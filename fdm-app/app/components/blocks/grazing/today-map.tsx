import type { FeatureCollection, MultiPolygon, Polygon } from "geojson"
import type { LayerProps } from "react-map-gl/maplibre"
import centroid from "@turf/centroid"
import { cn } from "cn"
import { useCallback, useMemo, useRef, useState } from "react"
import { Layer, Marker, type MapMouseEvent, type MapRef, Source } from "react-map-gl/maplibre"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"

const GRAZING_MAP_FIELDS_LAYER = "grazingMapFields"
const GRAZING_MAP_OUTLINE_LAYER = "grazingMapFieldsOutline"
const GRAZING_MAP_SOURCE = "grazingMapSource"

const GRAZING_MAP_ZONES_SOURCE = "grazingMapZones"

const zoneFillStyle: LayerProps = {
  id: "grazingMapZonesFill",
  type: "fill",
  paint: { "fill-color": "#10b981", "fill-opacity": 0.55 },
}

const zoneOutlineStyle: LayerProps = {
  id: "grazingMapZonesOutline",
  type: "line",
  paint: { "line-color": "#047857", "line-width": 2.5 },
}

export interface TodayGrazingMapProps {
  fieldsGeoJSON: FeatureCollection
  /** Zones grazed on the selected day, drawn on top of the field colour. */
  zones?: Array<Polygon | MultiPolygon>
  height?: string
  onFieldClick?: (b_id: string) => void
}

/**
 * Atlas map of the farm's fields coloured by today's grazing or mowing status, with a label per
 * field and a hover card. Zones grazed today are drawn on top of their field. Clicking a field that
 * can be grazed calls `onFieldClick`.
 */
export function TodayGrazingMap({
  fieldsGeoJSON,
  zones = [],
  height = "calc(100vh - var(--app-header-height))",
  onFieldClick,
}: TodayGrazingMapProps) {
  const mapRef = useRef<MapRef>(null)
  const zonesData: FeatureCollection = useMemo(
    () => ({
      type: "FeatureCollection",
      features: zones.map((geometry) => ({ type: "Feature", geometry, properties: {} })),
    }),
    [zones],
  )
  const initialViewState = useMemo(() => getViewState(fieldsGeoJSON), [fieldsGeoJSON])
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null)

  const onMouseMove = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0]
    setHoveredFieldId(feature ? ((feature.properties?.b_id as string) ?? null) : null)
    // Atlas shows a pointer over every field; fields that can't be grazed are not clickable.
    if (feature?.properties?.status === "disabled" && mapRef.current) {
      mapRef.current.getCanvas().style.cursor = "grab"
    }
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
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ height, isolation: "isolate" }}
    >
      <Atlas
        ref={mapRef}
        initialViewState={initialViewState}
        updateFromInitialViewState={true}
        interactive={true}
        interactiveLayerIds={[GRAZING_MAP_FIELDS_LAYER]}
        style={{ height: "100%" }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        <Controls
          initialViewState={initialViewState}
          showFlyToFields={fieldsGeoJSON.features.length > 0}
        />

        <MapTilerAttribution />

        <FieldsSourceNotClickable id={GRAZING_MAP_SOURCE} fieldsData={fieldsGeoJSON}>
          <Layer {...fillStyle} id={GRAZING_MAP_FIELDS_LAYER} source={GRAZING_MAP_SOURCE} />
          <Layer {...outlineStyle} id={GRAZING_MAP_OUTLINE_LAYER} source={GRAZING_MAP_SOURCE} />
        </FieldsSourceNotClickable>

        {zonesData.features.length > 0 && (
          <Source id={GRAZING_MAP_ZONES_SOURCE} type="geojson" data={zonesData}>
            <Layer {...zoneFillStyle} />
            <Layer {...zoneOutlineStyle} />
          </Source>
        )}

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
                  "pointer-events-none rounded-md px-1.5 py-0.5 text-[11px] font-semibold shadow-xs backdrop-blur-xs transition-all select-none",
                  c.status === "weiden_today" && "bg-emerald-600 text-white ring-1 ring-white/50",
                  c.status === "maaien_today" && "bg-amber-600 text-white ring-1 ring-white/50",
                  (c.status === "last_weiden" || c.status === "last_maaien") &&
                    "bg-background/90 text-foreground border-border border shadow-xs",
                  c.status === "unused" &&
                    "border border-slate-300/80 bg-white/95 text-[10.5px] font-medium text-slate-800 shadow-xs backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100",
                )}
              >
                {c.labelText}
              </div>
            </Marker>
          )
        })}
      </Atlas>

      {/* Hover Floating Card */}
      {hoveredFeature && (
        <div className="bg-background/95 animate-in fade-in zoom-in-95 pointer-events-none absolute bottom-4 left-4 z-20 max-w-xs space-y-1.5 rounded-xl border p-3.5 text-xs shadow-lg backdrop-blur-md duration-150">
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground text-sm font-bold">
              {hoveredFeature.properties?.b_name ?? "Perceel"}
            </span>
            <span className="text-muted-foreground font-medium">
              {hoveredFeature.properties?.b_area} ha
            </span>
          </div>

          {hoveredFeature.properties?.status === "weiden_today" && (
            <div className="space-y-0.5 text-emerald-950 dark:text-emerald-200">
              <p className="text-xs font-semibold">
                {hoveredFeature.properties?.herdName ?? "Koppel"}{" "}
                {hoveredFeature.properties?.animalCount
                  ? `(${hoveredFeature.properties?.animalCount} ${hoveredFeature.properties?.animalCount === 1 ? "dier" : "dieren"})`
                  : ""}{" "}
                · actief weiden
              </p>
              <p className="text-muted-foreground text-[11px]">
                {hoveredFeature.properties?.hours
                  ? `${hoveredFeature.properties?.hours} uur/dag`
                  : "Uren niet ingevuld"}
              </p>
            </div>
          )}

          {hoveredFeature.properties?.status === "maaien_today" && (
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Vandaag gemaaid (maaisnede)
            </p>
          )}

          {hoveredFeature.properties?.status === "last_weiden" && (
            <p className="text-muted-foreground text-[11px]">
              Laatst beweid ·{" "}
              <strong className="text-foreground">
                {hoveredFeature.properties?.restDays} dagen rust
              </strong>
            </p>
          )}

          {hoveredFeature.properties?.status === "last_maaien" && (
            <p className="text-muted-foreground text-[11px]">
              Laatst gemaaid ·{" "}
              <strong className="text-foreground">
                {hoveredFeature.properties?.restDays} dagen rust
              </strong>
            </p>
          )}

          {hoveredFeature.properties?.status === "unused" && (
            <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
              Graslandperceel · Nog niet gebruikt dit seizoen
            </p>
          )}

          {hoveredFeature.properties?.status === "disabled" && (
            <p className="text-muted-foreground text-[11px]">
              {hoveredFeature.properties?.isBufferstrip
                ? "Bufferstrook (niet beweid)"
                : "Geen graslandperceel"}
            </p>
          )}

          {hoveredFeature.properties?.status !== "disabled" && (
            <p className="text-primary border-t pt-1 text-[10px] font-medium">
              Klik op het perceel om beweiding vast te leggen →
            </p>
          )}
        </div>
      )}
    </div>
  )
}
