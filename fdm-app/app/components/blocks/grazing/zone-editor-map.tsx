/**
 * Map for drawing and editing a grazing zone within a field, with terra-draw.
 *
 * Import with React.lazy (see `ZoneEditor`) to avoid SSR issues with maplibre-gl and terra-draw,
 * and to keep both out of the initial JS payload.
 */

import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson"
import type { Map as MaplibreMap } from "maplibre-gl"
import { useEffect, useMemo, useRef } from "react"
import { Layer, type LayerProps, NavigationControl, Source, useMap } from "react-map-gl/maplibre"
import {
  type GeoJSONStoreFeatures,
  type SnapToCustom,
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
} from "terra-draw"
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { type Area, clipZoneToField, snapToEdges } from "~/lib/grazing-strip"

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

/**
 * Decimal places terra-draw accepts for a coordinate (its default `coordinatePrecision`). It rejects
 * a feature with more, which a computed strip has after rotating and clipping.
 */
const TERRA_DRAW_PRECISION = 9

const roundCoordinate = (value: number) => Number(value.toFixed(TERRA_DRAW_PRECISION))

const roundPosition = (position: Position): Position => [
  roundCoordinate(position[0]),
  roundCoordinate(position[1]),
]

/**
 * Splits a zone into the polygons terra-draw edits one by one, with coordinates rounded to the
 * precision terra-draw accepts.
 */
function toPolygons(zone: Area | null): Polygon[] {
  if (!zone) return []
  const polygons = zone.type === "Polygon" ? [zone.coordinates] : zone.coordinates
  return polygons.map((rings) => ({
    type: "Polygon",
    coordinates: rings.map((ring) => ring.map(roundPosition)),
  }))
}

/** Whether the map still has the sources of terra-draw, which it removes when it is torn down. */
function hasTerraDrawSources(map: MaplibreMap): boolean {
  try {
    return ["point", "linestring", "polygon"].every(
      (geometry) => map.getSource(`td-${geometry}`) !== undefined,
    )
  } catch {
    // The style of a removed map throws
    return false
  }
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
    // The editor is a drawing tool in a dialog, not a map on a scrolling page, so scrolling zooms
    // the map (also with Ctrl) instead of needing the cooperative gestures of the other small maps
    <Atlas
      initialViewState={initialViewState}
      interactive={true}
      useStoredViewState={false}
      updateFromInitialViewState={true}
      style={{ height, width: "100%" }}
    >
      <NavigationControl position="top-right" showCompass={false} />
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
        fieldGeometry={fieldGeometry}
        otherZones={otherZones}
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
 *
 * Drawn and dragged points snap to the corners and edges of the field and of the other zones, and
 * a finished zone is clipped to the field, so a zone never extends beyond the field.
 */
function ZoneDrawing({
  fieldGeometry,
  otherZones = [],
  zone,
  onZoneChange,
  mode,
  onDrawFinished,
}: Pick<
  ZoneEditorMapProps,
  "fieldGeometry" | "otherZones" | "zone" | "onZoneChange" | "mode" | "onDrawFinished"
>) {
  const { current: mapRef } = useMap()
  const drawRef = useRef<TerraDraw | null>(null)
  // Runs a programmatic update of terra-draw without reading its changes back
  const loadingRef = useRef<((load: () => void) => void) | null>(null)
  // The zone terra-draw currently holds, so a zone read from it is not pushed back into it
  const loadedRef = useRef<Area | null>(null)
  // Latest props, read by the terra-draw callbacks and when terra-draw starts
  const latestRef = useRef({ fieldGeometry, otherZones, zone, mode, onZoneChange, onDrawFinished })
  useEffect(() => {
    latestRef.current = { fieldGeometry, otherZones, zone, mode, onZoneChange, onDrawFinished }
  })

  // Start terra-draw once the map is available
  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map) return

    const snapToField: SnapToCustom = (event, context) => {
      const { fieldGeometry, otherZones } = latestRef.current
      const snapped = snapToEdges(
        [event.lng, event.lat],
        [fieldGeometry, ...otherZones],
        context.project,
      )
      return snapped ? roundPosition(snapped) : undefined
    }

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
          snapping: { toCustom: snapToField },
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: true,
                coordinates: {
                  midpoints: true,
                  draggable: true,
                  deletable: true,
                  snappable: { toCustom: snapToField },
                },
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
      const drawn = fromPolygons(polygons)
      loadedRef.current = drawn
      // When the zone extends beyond the field, the clipped zone differs from what terra-draw
      // holds, so the zone effect below loads the clipped shape into terra-draw
      const clipped = drawn ? clipZoneToField(drawn, latestRef.current.fieldGeometry) : null
      latestRef.current.onZoneChange(clipped)
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
      loadingRef.current = null
      if (drawRef.current === draw) {
        drawRef.current = null
        // When the dialog closes, the map removes its sources before this cleanup runs; stopping
        // terra-draw then fails while clearing its layers. Nothing is left to clean up in that
        // case, so only stop it while its sources still exist.
        if (hasTerraDrawSources(map)) {
          draw.stop()
        }
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
  if (features.length === 0) return
  // terra-draw silently skips a feature it does not accept; report it, so a zone that does not
  // appear on the map can be traced
  for (const result of draw.addFeatures(features)) {
    if (!result.valid) console.warn("Zone not shown on the map:", result.reason)
  }
}
