/**
 * Map for drawing and editing a grazing zone within a field, with terra-draw.
 *
 * Import with React.lazy (see `ZoneEditor`) to avoid SSR issues with maplibre-gl and terra-draw,
 * and to keep both out of the initial JS payload.
 */

import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson"
import type { Map as MaplibreMap } from "maplibre-gl"
import { Scan } from "lucide-react"
import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
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
import { AtlasControls, SingleAtlasButton } from "~/components/blocks/atlas/atlas-controls"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getDottedFieldOutlineStyle } from "~/components/blocks/atlas/atlas-styles"
import { type AtlasViewState, getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import {
  type Area,
  clipFeedback,
  clipZoneToField,
  hasHoles,
  snapToEdges,
} from "~/lib/grazing-strip"
import {
  HIGHLIGHT_ZONE_COLOR,
  OTHER_ZONE_COLOR,
  OTHER_ZONE_FILL_OPACITY,
  ZONE_CASING_COLOR,
  ZONE_CASING_WIDTH,
  ZONE_FILL_COLOR,
  ZONE_FILL_OPACITY,
  ZONE_OUTLINE_COLOR,
  ZONE_OUTLINE_WIDTH,
  ZONE_POINT_COLOR,
} from "./zone-colors"

/** What the user is doing on the map. */
export type ZoneEditorMode = "view" | "draw" | "edit"

/**
 * Feedback on a zone the user drew or edited: part of it lay outside the field and was cut off
 * (`"clipped"`), or all of it lay outside the field and it was not used (`"outside"`).
 */
export type ZoneNotice = "clipped" | "outside"

/** Actions the editor can run on the map from outside, such as from its toolbar. */
export interface ZoneMapControls {
  /** Removes the last corner of the zone being drawn; `false` when no zone is being drawn. */
  undoCorner: () => boolean
}

type FeatureId = Parameters<TerraDraw["selectFeature"]>[0]

/** The height of the map: taller on a laptop, but leaving room for the dialog on a small screen. */
const DEFAULT_HEIGHT = "min(420px, 55vh)"

/**
 * Distance in screen pixels within which a click on the first or the last corner finishes a
 * drawing. Just above the snap tolerance (12 px), so a corner that snaps to the field near the
 * start of a narrow strip does not finish the strip early, as terra-draw's default of 40 px did.
 */
const FINISH_DISTANCE_PX = 16

/** Property terra-draw sets on the polygon that is being drawn. */
const CURRENTLY_DRAWING = "currentlyDrawing"

const otherZonesFill: LayerProps = {
  id: "grazing-other-zones-fill",
  type: "fill",
  paint: { "fill-color": OTHER_ZONE_COLOR, "fill-opacity": OTHER_ZONE_FILL_OPACITY },
}

const otherZonesOutline: LayerProps = {
  id: "grazing-other-zones-outline",
  type: "line",
  paint: {
    "line-color": "#ffffff",
    "line-opacity": 0.8,
    "line-width": 1.5,
    "line-dasharray": [2, 2],
  },
}

const highlightFill: LayerProps = {
  id: "grazing-zone-highlight-fill",
  type: "fill",
  paint: { "fill-color": HIGHLIGHT_ZONE_COLOR, "fill-opacity": 0.3 },
}

const highlightOutline: LayerProps = {
  id: "grazing-zone-highlight-outline",
  type: "line",
  paint: { "line-color": HIGHLIGHT_ZONE_COLOR, "line-width": 3 },
}

const staticZoneFill: LayerProps = {
  id: "grazing-zone-static-fill",
  type: "fill",
  paint: { "fill-color": ZONE_FILL_COLOR, "fill-opacity": ZONE_FILL_OPACITY },
}

const staticZoneCasing: LayerProps = {
  id: "grazing-zone-static-casing",
  type: "line",
  paint: { "line-color": ZONE_CASING_COLOR, "line-width": ZONE_CASING_WIDTH },
}

const zoneCasing: LayerProps = {
  id: "grazing-zone-casing",
  type: "line",
  paint: { "line-color": ZONE_CASING_COLOR, "line-width": ZONE_CASING_WIDTH },
}

const staticZoneOutline: LayerProps = {
  id: "grazing-zone-static-outline",
  type: "line",
  paint: { "line-color": ZONE_OUTLINE_COLOR, "line-width": ZONE_OUTLINE_WIDTH },
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
  /** A zone to highlight, such as an earlier zone the user points at. */
  highlightedZone?: Area | null
  mode: ZoneEditorMode
  /**
   * Called when the user finishes drawing a new zone, after `onZoneChange` with the same zone, so
   * the editor can switch to editing.
   */
  onDrawFinished?: (zone: Area) => void
  /** Called with feedback on a zone the user drew or edited. */
  onNotice?: (notice: ZoneNotice) => void
  /** Called when the user starts or stops drawing a zone (the first corner is placed, or the drawing is finished or cancelled). */
  onDrawingChange?: (drawing: boolean) => void
  /** Called on Ctrl+Z (or Cmd+Z) on the map while no zone is being drawn. */
  onUndo?: () => void
  /**
   * Called after a zone is loaded into the map, with whether every part could be loaded. A zone
   * with a part the map refuses is shown read-only, so an edit cannot drop that part.
   */
  onZoneLoaded?: (zone: Area | null, complete: boolean) => void
  /** Receives the actions the editor can run on the map. */
  controlsRef?: RefObject<ZoneMapControls | null>
  height?: string
}

export default function ZoneEditorMap({
  fieldGeometry,
  zone,
  onZoneChange,
  otherZones = [],
  highlightedZone = null,
  mode,
  onDrawFinished,
  onNotice,
  onDrawingChange,
  onUndo,
  onZoneLoaded,
  controlsRef,
  height = DEFAULT_HEIGHT,
}: ZoneEditorMapProps) {
  const fieldData = useMemo(() => toFeatureCollection([fieldGeometry]), [fieldGeometry])
  const otherData = useMemo(() => toFeatureCollection(otherZones), [otherZones])
  const highlightData = useMemo(
    () => (highlightedZone ? toFeatureCollection([highlightedZone]) : null),
    [highlightedZone],
  )
  // A zone of which terra-draw refused a part when it was loaded
  const [incompleteZone, setIncompleteZone] = useState<Area | null>(null)
  // terra-draw does not accept a polygon with a hole, so such a zone is shown read-only, as is a
  // zone of which it refused a part
  const zoneReadOnly = zone !== null && (hasHoles(zone) || zone === incompleteZone)
  const staticZoneData = useMemo(
    () => (zone && zoneReadOnly ? toFeatureCollection([zone]) : null),
    [zone, zoneReadOnly],
  )
  // A dark casing under the white outline that terra-draw draws, so the zone also reads on a light
  // background. Not while editing: it would trail behind a dragged corner until the edit ends.
  const casingData = useMemo(
    () =>
      zone && !zoneReadOnly && mode !== "edit"
        ? toFeatureCollection([zone])
        : toFeatureCollection([]),
    [zone, zoneReadOnly, mode],
  )
  const initialViewState = useMemo(
    () => ({ ...getViewState(fieldData), fitBoundsOptions: { padding: 24 } }),
    [fieldData],
  )
  // The white dotted field outline of the Atlas layer Beweiding
  const dotted = getDottedFieldOutlineStyle()
  const fieldOutline = { ...dotted, id: "grazing-zone-field-outline" } as LayerProps

  return (
    // The editor is a drawing tool in a dialog, not a map on a scrolling page, so scrolling zooms
    // the map (also with Ctrl) instead of needing the cooperative gestures of the other small maps.
    // terra-draw sets the cursor (crosshair, pointer over a closing corner), so the map leaves it.
    <Atlas
      initialViewState={initialViewState}
      interactive={true}
      useStoredViewState={false}
      updateFromInitialViewState={true}
      manageCursor={false}
      style={{ height, width: "100%" }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <FitFieldControl viewState={initialViewState} />
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
      {/* Always mounted, so its layer stays below the layers terra-draw adds later */}
      <Source id="grazing-zone-casing" type="geojson" data={casingData}>
        <Layer {...zoneCasing} />
      </Source>
      {staticZoneData && (
        <Source id="grazing-zone-static" type="geojson" data={staticZoneData}>
          <Layer {...staticZoneFill} />
          <Layer {...staticZoneCasing} />
          <Layer {...staticZoneOutline} />
        </Source>
      )}
      {highlightData && (
        <Source id="grazing-zone-highlight" type="geojson" data={highlightData}>
          <Layer {...highlightFill} />
          <Layer {...highlightOutline} />
        </Source>
      )}
      <ZoneDrawing
        fieldGeometry={fieldGeometry}
        otherZones={otherZones}
        zone={zone}
        onZoneChange={onZoneChange}
        mode={mode}
        onDrawFinished={onDrawFinished}
        onNotice={onNotice}
        onDrawingChange={onDrawingChange}
        onUndo={onUndo}
        onZoneLoaded={(loaded, complete) => {
          setIncompleteZone(complete ? null : loaded)
          onZoneLoaded?.(loaded, complete)
        }}
        controlsRef={controlsRef}
      />
    </Atlas>
  )
}

/** Map button that brings the whole field back into view. */
function FitFieldControl({ viewState }: { viewState: AtlasViewState }) {
  const { current: map } = useMap()
  return (
    <AtlasControls position="top-right">
      <SingleAtlasButton
        label="Perceel in beeld"
        Icon={Scan}
        onClick={() => {
          if (viewState.bounds) map?.fitBounds(viewState.bounds, viewState.fitBoundsOptions)
        }}
      />
    </AtlasControls>
  )
}

/**
 * Connects terra-draw to the map. terra-draw is an external system with its own state: the zone
 * is pushed into it when it changes from outside (reuse, strip builder, undo), and read back from
 * it when the user finishes a drawing or an edit.
 *
 * Drawn and dragged points snap to the corners and edges of the field and of the other zones (and,
 * while drawing, of the current zone), unless Alt is held down. A finished zone is clipped to the
 * field, so a zone never extends beyond the field. A newly drawn zone replaces the current one.
 *
 * While a zone is being drawn, Escape cancels the drawing (instead of closing the dialog) and
 * Ctrl+Z removes the last corner; otherwise Ctrl+Z on the map undoes the last zone change.
 */
function ZoneDrawing({
  fieldGeometry,
  otherZones = [],
  zone,
  onZoneChange,
  mode,
  onDrawFinished,
  onNotice,
  onDrawingChange,
  onUndo,
  onZoneLoaded,
  controlsRef,
}: Pick<
  ZoneEditorMapProps,
  | "fieldGeometry"
  | "otherZones"
  | "zone"
  | "onZoneChange"
  | "mode"
  | "onDrawFinished"
  | "onNotice"
  | "onDrawingChange"
  | "onUndo"
  | "onZoneLoaded"
  | "controlsRef"
>) {
  const { current: mapRef } = useMap()
  const drawRef = useRef<TerraDraw | null>(null)
  // Loads a zone from outside into terra-draw without reading the resulting changes back
  const applyZoneRef = useRef<((zone: Area | null) => void) | null>(null)
  // Removes the last corner of the zone being drawn
  const undoCornerRef = useRef<() => boolean>(() => false)
  // The zone terra-draw currently holds, so a zone read from it is not pushed back into it
  const loadedRef = useRef<Area | null>(null)
  // Latest props, read by the terra-draw callbacks and when terra-draw starts
  const latestRef = useRef({
    fieldGeometry,
    otherZones,
    zone,
    mode,
    onZoneChange,
    onDrawFinished,
    onNotice,
    onDrawingChange,
    onUndo,
    onZoneLoaded,
  })
  useEffect(() => {
    latestRef.current = {
      fieldGeometry,
      otherZones,
      zone,
      mode,
      onZoneChange,
      onDrawFinished,
      onNotice,
      onDrawingChange,
      onUndo,
      onZoneLoaded,
    }
  })

  // Start terra-draw once the map is available
  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map) return
    const container = map.getContainer()

    // Holding Alt switches snapping off. terra-draw only sees keys while the map has focus, so the
    // key is also followed on the window.
    let altDown = false
    const onAltKey = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return
      altDown = event.type === "keydown"
      // Keep the browser from moving focus to its menu bar while Alt is used on the map
      if (container.contains(event.target as Node)) event.preventDefault()
    }
    const onWindowBlur = () => {
      altDown = false
    }

    const snapToField: SnapToCustom = (event, context) => {
      if (altDown || event.heldKeys.includes("Alt")) return undefined
      const { fieldGeometry, otherZones, zone, mode } = latestRef.current
      // While a new zone is drawn, the current zone stays visible as a reference to snap to
      const targets =
        mode === "draw" && zone
          ? [fieldGeometry, ...otherZones, zone]
          : [fieldGeometry, ...otherZones]
      const snapped = snapToEdges([event.lng, event.lat], targets, context.project)
      return snapped ? roundPosition(snapped) : undefined
    }

    const polygonMode = new TerraDrawPolygonMode({
      pointerDistance: FINISH_DISTANCE_PX,
      // Escape is handled below, so that it cancels the drawing without closing the dialog
      keyEvents: { cancel: null, finish: "Enter" },
      styles: {
        fillColor: ZONE_FILL_COLOR,
        fillOpacity: ZONE_FILL_OPACITY,
        outlineColor: ZONE_OUTLINE_COLOR,
        outlineWidth: ZONE_OUTLINE_WIDTH,
        // Corners and the closing point: dark with a white ring, visible on green grass
        coordinatePointColor: ZONE_POINT_COLOR,
        coordinatePointWidth: 4,
        coordinatePointOutlineColor: "#ffffff",
        coordinatePointOutlineWidth: 2,
        closingPointColor: ZONE_POINT_COLOR,
        closingPointWidth: 5,
        closingPointOutlineColor: "#ffffff",
        closingPointOutlineWidth: 2,
        // The point a corner snaps to, clearly visible on aerial photos and maps alike
        snappingPointColor: "#ffffff",
        snappingPointWidth: 6,
        snappingPointOutlineColor: ZONE_POINT_COLOR,
        snappingPointOutlineWidth: 3,
      },
      validation: (feature) => ValidateNotSelfIntersecting(feature),
      snapping: { toCustom: snapToField },
    })

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        polygonMode,
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
            selectedPolygonColor: ZONE_FILL_COLOR,
            selectedPolygonFillOpacity: ZONE_FILL_OPACITY,
            selectedPolygonOutlineColor: ZONE_OUTLINE_COLOR,
            selectedPolygonOutlineWidth: ZONE_OUTLINE_WIDTH,
            // Corners to drag: dark with a white ring; midpoints to add a corner: small and white
            selectionPointColor: ZONE_POINT_COLOR,
            selectionPointWidth: 5,
            selectionPointOutlineColor: "#ffffff",
            selectionPointOutlineWidth: 2,
            midPointColor: "#ffffff",
            midPointWidth: 3,
            midPointOutlineColor: ZONE_POINT_COLOR,
            midPointOutlineWidth: 1,
          },
        }),
      ],
    })

    // True while a zone from outside is loaded, so the resulting changes are not read back
    let loading = false
    // Number of polygons of the zone in terra-draw, to recognise a part deleted in the select mode
    let zoneCount = 0
    // The polygon being drawn, if any
    let drawingId: FeatureId | undefined

    const isStarted = () => drawRef.current === draw
    const isDrawing = () => isStarted() && draw.getModeState() === "drawing"

    const setDrawingId = (id: FeatureId | undefined) => {
      const changed = (id === undefined) !== (drawingId === undefined)
      drawingId = id
      if (changed) latestRef.current.onDrawingChange?.(id !== undefined)
    }

    /** The polygons of the zone in terra-draw, without one that is still being drawn. */
    const zonePolygons = () =>
      draw
        .getSnapshot()
        .filter(
          (feature) =>
            feature.geometry.type === "Polygon" && !feature.properties[CURRENTLY_DRAWING],
        )
        .map((feature) => feature.geometry as Polygon)

    const applyZone = (next: Area | null) => {
      let complete = true
      loading = true
      try {
        complete = loadZone(draw, next)
        // Editing only the parts that loaded would save the zone without the refused part, so
        // none of it is editable then; the map shows the zone read-only instead
        if (!complete) draw.clear()
      } finally {
        loading = false
      }
      loadedRef.current = next
      zoneCount = zonePolygons().length
      latestRef.current.onZoneLoaded?.(next, complete)
      // Keep the zone selected, also after it was clipped and reloaded, so it can be edited at once
      if (complete && latestRef.current.mode === "edit") selectZone(draw)
    }

    // Reads the zone back after an edit in the select mode
    const readZone = () => {
      const polygons = zonePolygons()
      zoneCount = polygons.length
      const drawn = fromPolygons(polygons)
      const { fieldGeometry, onZoneChange, onNotice } = latestRef.current
      const clipped = drawn ? clipZoneToField(drawn, fieldGeometry) : null
      if (drawn && !clipped) {
        // Moved entirely outside the field: keep the zone as it was. terra-draw is still handling
        // the edit, so reload the zone once it is done.
        queueMicrotask(() => {
          if (isStarted()) applyZone(latestRef.current.zone)
        })
        onNotice?.("outside")
        return
      }
      // When the zone extends beyond the field, the clipped zone differs from what terra-draw
      // holds, so the zone effect below loads the clipped shape into terra-draw
      loadedRef.current = drawn
      onZoneChange(clipped)
      if (drawn && clipFeedback(drawn, clipped) === "clipped") onNotice?.("clipped")
    }

    // Reads a newly drawn polygon, which replaces the zone
    const readDrawn = (id: FeatureId) => {
      const feature = draw.getSnapshotFeature(id)
      if (feature?.geometry.type !== "Polygon") return
      const drawn = feature.geometry as Polygon
      const { fieldGeometry, onZoneChange, onDrawFinished, onNotice } = latestRef.current
      const clipped = clipZoneToField(drawn, fieldGeometry)
      if (!clipped) {
        // Entirely outside the field: keep the current zone and let the user draw again. terra-draw
        // is still finishing the drawing, so remove it once that is done.
        queueMicrotask(() => {
          if (!isStarted() || !draw.hasFeature(id)) return
          loading = true
          try {
            draw.removeFeatures([id])
          } finally {
            loading = false
          }
        })
        onNotice?.("outside")
        return
      }
      // terra-draw still holds the previous zone next to the new one. `loadedRef` keeps pointing at
      // the previous zone, so the zone effect below loads only the new zone into terra-draw.
      onZoneChange(clipped)
      if (clipFeedback(drawn, clipped) === "clipped") onNotice?.("clipped")
      onDrawFinished?.(clipped)
    }

    draw.on("finish", (id, context) => {
      if (loading) return
      if (context.action === "draw") {
        if (id === drawingId) setDrawingId(undefined)
        readDrawn(id)
      } else {
        readZone()
      }
    })
    draw.on("change", (ids, type) => {
      if (type === "create" && drawingId === undefined) {
        const id = ids.find((id) => draw.getSnapshotFeature(id)?.properties[CURRENTLY_DRAWING])
        if (id !== undefined) setDrawingId(id)
      } else if (type === "delete") {
        if (drawingId !== undefined && ids.includes(drawingId)) {
          // The drawing was cancelled or its last corner undone
          setDrawingId(undefined)
        } else if (!loading && draw.getMode() === "select" && zonePolygons().length !== zoneCount) {
          // A part of the zone was deleted; guidance points come and go all the time
          readZone()
        }
      }
    })

    const onKeyDown = (event: KeyboardEvent) => {
      // Escape in another dialog on top of this one, such as the delete confirmation, or in a
      // popup of a select (both rendered elsewhere in the document), belongs to that dialog
      const owner = container.closest('[role="dialog"]')
      const target = event.target as Node | null
      const inOwnDialog =
        !owner || target === null || target === document.body || owner.contains(target)
      if (event.key === "Escape" && isDrawing() && inOwnDialog) {
        // The dialog closes on Escape at the document; stop the key here, so it only cancels the
        // drawing. Without a drawing, Escape still closes the dialog.
        event.preventDefault()
        event.stopPropagation()
        draw.setMode("polygon")
        return
      }
      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "z"
      if (!isUndo || !isStarted() || !container.contains(event.target as Node)) return
      event.preventDefault()
      if (isDrawing()) polygonMode.undo()
      else latestRef.current.onUndo?.()
    }

    undoCornerRef.current = () => {
      if (!isDrawing()) return false
      polygonMode.undo()
      return true
    }

    const start = () => {
      draw.start()
      drawRef.current = draw
      draw.setMode(toDrawMode(latestRef.current.mode))
      applyZone(latestRef.current.zone)
    }
    applyZoneRef.current = applyZone
    if (map.loaded()) start()
    else map.once("load", start)

    // Capture phase on the document, so Escape is seen before the dialog sees it
    document.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("keydown", onAltKey)
    window.addEventListener("keyup", onAltKey)
    window.addEventListener("blur", onWindowBlur)

    return () => {
      map.off("load", start)
      document.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("keydown", onAltKey)
      window.removeEventListener("keyup", onAltKey)
      window.removeEventListener("blur", onWindowBlur)
      applyZoneRef.current = null
      undoCornerRef.current = () => false
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

  // Let the editor undo the last corner from its toolbar
  useEffect(() => {
    if (!controlsRef) return
    controlsRef.current = { undoCorner: () => undoCornerRef.current() }
    return () => {
      controlsRef.current = null
    }
  }, [controlsRef])

  // Push a zone that changed from outside (reuse, strip builder, undo) into terra-draw
  useEffect(() => {
    if (!drawRef.current || zone === loadedRef.current) return
    applyZoneRef.current?.(zone)
  }, [zone])

  // Follow the mode chosen in the toolbar; in edit mode, select the zone so it can be edited at once
  useEffect(() => {
    const draw = drawRef.current
    if (!draw) return
    draw.setMode(toDrawMode(mode))
    if (mode === "edit") selectZone(draw)
  }, [mode])

  return null
}

function toDrawMode(mode: ZoneEditorMode): string {
  return mode === "draw" ? "polygon" : mode === "edit" ? "select" : "static"
}

/**
 * Replaces what terra-draw holds with the polygons of the zone. terra-draw does not accept a
 * polygon with a hole, so such a zone is not loaded; the map shows it read-only instead.
 *
 * @returns Whether every part of the zone was accepted; `false` when terra-draw refused a part.
 */
function loadZone(draw: TerraDraw, zone: Area | null): boolean {
  draw.clear()
  if (!zone || hasHoles(zone)) return true
  const features = toPolygons(zone).map(
    (geometry) =>
      ({ type: "Feature", geometry, properties: { mode: "polygon" } }) as GeoJSONStoreFeatures,
  )
  // terra-draw skips a feature it does not accept; report it, so it can be traced
  let complete = true
  for (const result of draw.addFeatures(features)) {
    if (!result.valid) {
      complete = false
      console.warn("Zone part not editable on the map:", result.reason)
    }
  }
  return complete
}

/** Selects the (first part of the) zone, so its corners can be dragged without clicking it first. */
function selectZone(draw: TerraDraw): void {
  const first = draw
    .getSnapshot()
    .find((feature) => feature.geometry.type === "Polygon" && feature.properties.mode === "polygon")
  if (first?.id !== undefined) draw.selectFeature(first.id)
}
