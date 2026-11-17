/**
 * Map for drawing and editing a grazing zone within a field, with terra-draw.
 *
 * Import with React.lazy (see `ZoneEditor`) to avoid SSR issues with maplibre-gl and terra-draw,
 * and to keep both out of the initial JS payload.
 */

import type { FeatureCollection, MultiPolygon, Polygon } from "geojson"
import { useEffect, useMemo, useRef } from "react"
import { Layer, type LayerProps, Source, useMap } from "react-map-gl/maplibre"
import {
  type GeoJSONStoreFeatures,
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
} from "terra-draw"
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter"
import type { Area } from "~/lib/grazing-strip"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { COOPERATIVE_GESTURES_PROPS } from "~/components/blocks/atlas/atlas-cooperative-gestures"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"

/** What the user is doing on the map. */
export type ZoneEditorMode = "view" | "draw" | "edit"

const ZONE_COLOR = "#10b981"
const ZONE_OUTLINE_COLOR = "#047857"
const OTHER_ZONE_COLOR = "#64748b"

const otherZonesFill: LayerProps = {
  id: "grazing-other-zones-fill",
  type: "fill",
  paint: { "fill-color": OTHER_ZONE_COLOR, "fill-opacity": 0.18 },
}

const otherZonesOutline: LayerProps = {
  id: "grazing-other-zones-outline",
  type: "line",
  paint: { "line-color": OTHER_ZONE_COLOR, "line-width": 1.5, "line-dasharray": [2, 1] },
}

function toFeatureCollection(geometries: Area[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry) => ({ type: "Feature", geometry, properties: {} })),
  }
}

/** Splits a zone into the polygons terra-draw edits one by one. */
function toPolygons(zone: Area | null): Polygon[] {
  if (!zone) return []
  if (zone.type === "Polygon") return [zone]
  return zone.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }))
}

/** Combines the drawn polygons into one zone. */
function fromPolygons(polygons: Polygon[]): Area | null {
  if (polygons.length === 0) return null
  if (polygons.length === 1) return polygons[0]
  const multi: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: polygons.map((polygon) => polygon.coordinates),
  }
  return multi
}

export interface ZoneEditorMapProps {
  fieldGeometry: Area
  /** The zone being edited; `null` when there is none. */
  zone: Area | null
  onZoneChange: (zone: Area | null) => void
  /** Other zones to show for reference, such as earlier strips. */
  otherZones?: Area[]
  mode: ZoneEditorMode
  /** Called when the user finishes drawing, so the editor can switch to editing. */
  onDrawFinished?: () => void
  height?: string
}

export default function ZoneEditorMap({
  fieldGeometry,
  zone,
  onZoneChange,
  otherZones = [],
  mode,
  onDrawFinished,
  height = "320px",
}: ZoneEditorMapProps) {
  const fieldData = useMemo(() => toFeatureCollection([fieldGeometry]), [fieldGeometry])
  const otherData = useMemo(() => toFeatureCollection(otherZones), [otherZones])
  const initialViewState = useMemo(
    () => ({ ...getViewState(fieldData), fitBoundsOptions: { padding: 24 } }),
    [fieldData],
  )
  const fieldOutline = { ...getFieldsStyle("fieldsSavedOutline"), id: "grazing-zone-field-outline" }

  return (
    <Atlas
      initialViewState={initialViewState}
      interactive={true}
      {...COOPERATIVE_GESTURES_PROPS}
      useStoredViewState={false}
      updateFromInitialViewState={true}
      style={{ height, width: "100%" }}
    >
      <MapTilerAttribution />
      <FieldsSourceNotClickable id="grazing-zone-field" fieldsData={fieldData}>
        <Layer {...fieldOutline} />
      </FieldsSourceNotClickable>
      {otherData.features.length > 0 && (
        <Source id="grazing-other-zones" type="geojson" data={otherData}>
          <Layer {...otherZonesFill} />
          <Layer {...otherZonesOutline} />
        </Source>
      )}
      <ZoneDrawing
        zone={zone}
        onZoneChange={onZoneChange}
        mode={mode}
        onDrawFinished={onDrawFinished}
      />
    </Atlas>
  )
}

/**
 * Connects terra-draw to the map. terra-draw is an external system with its own state: the zone
 * is pushed into it when it changes from outside (reuse, strip builder), and read back from it when
 * the user finishes a drawing or an edit.
 */
function ZoneDrawing({
  zone,
  onZoneChange,
  mode,
  onDrawFinished,
}: Pick<ZoneEditorMapProps, "zone" | "onZoneChange" | "mode" | "onDrawFinished">) {
  const { current: mapRef } = useMap()
  const drawRef = useRef<TerraDraw | null>(null)
  // Runs a programmatic update of terra-draw without reading its changes back
  const loadingRef = useRef<((load: () => void) => void) | null>(null)
  // The zone terra-draw currently holds, so a zone read from it is not pushed back into it
  const loadedRef = useRef<Area | null>(null)
  // Latest props, read by the terra-draw callbacks and when terra-draw starts
  const latestRef = useRef({ zone, mode, onZoneChange, onDrawFinished })
  useEffect(() => {
    latestRef.current = { zone, mode, onZoneChange, onDrawFinished }
  })

  // Start terra-draw once the map is available
  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map) return
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({
          styles: {
            fillColor: ZONE_COLOR,
            fillOpacity: 0.3,
            outlineColor: ZONE_OUTLINE_COLOR,
            outlineWidth: 2,
          },
          validation: (feature) => ValidateNotSelfIntersecting(feature),
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: true,
                coordinates: { midpoints: true, draggable: true, deletable: true },
              },
            },
          },
          styles: {
            selectedPolygonColor: ZONE_COLOR,
            selectedPolygonFillOpacity: 0.3,
            selectedPolygonOutlineColor: ZONE_OUTLINE_COLOR,
          },
        }),
      ],
    })

    // True while a zone from outside is loaded, so the resulting changes are not read back
    let loading = false

    const readZone = () => {
      if (loading) return
      const polygons = draw
        .getSnapshot()
        .filter((feature) => feature.geometry.type === "Polygon")
        .map((feature) => feature.geometry as Polygon)
      const next = fromPolygons(polygons)
      loadedRef.current = next
      latestRef.current.onZoneChange(next)
    }

    draw.on("finish", (_id, context) => {
      readZone()
      if (context.action === "draw") latestRef.current.onDrawFinished?.()
    })
    draw.on("change", (_ids, type) => {
      if (type === "delete") readZone()
    })

    const start = () => {
      draw.start()
      drawRef.current = draw
      loading = true
      loadZone(draw, latestRef.current.zone)
      loading = false
      loadedRef.current = latestRef.current.zone
      draw.setMode(toDrawMode(latestRef.current.mode))
    }
    loadingRef.current = (load: () => void) => {
      loading = true
      try {
        load()
      } finally {
        loading = false
      }
    }
    if (map.loaded()) start()
    else map.once("load", start)

    return () => {
      map.off("load", start)
      if (drawRef.current === draw) {
        draw.stop()
        drawRef.current = null
      }
    }
  }, [mapRef])

  // Push a zone that changed from outside (reuse, strip builder) into terra-draw
  useEffect(() => {
    const draw = drawRef.current
    if (!draw || zone === loadedRef.current) return
    loadedRef.current = zone
    loadingRef.current?.(() => loadZone(draw, zone))
  }, [zone])

  // Follow the mode chosen in the toolbar
  useEffect(() => {
    drawRef.current?.setMode(toDrawMode(mode))
  }, [mode])

  return null
}

function toDrawMode(mode: ZoneEditorMode): string {
  return mode === "draw" ? "polygon" : mode === "edit" ? "select" : "static"
}

/** Replaces what terra-draw holds with the polygons of the zone. */
function loadZone(draw: TerraDraw, zone: Area | null): void {
  draw.clear()
  const features = toPolygons(zone).map(
    (geometry) =>
      ({ type: "Feature", geometry, properties: { mode: "polygon" } }) as GeoJSONStoreFeatures,
  )
  if (features.length > 0) draw.addFeatures(features)
}
