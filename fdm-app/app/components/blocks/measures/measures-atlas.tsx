/**
 * Lazy-loaded map for the Maatregelen pages.
 *
 * Farm overview: all fields coloured by measure count (grey → light green → dark green).
 * Field detail: all farm fields visible, current field highlighted in yellow.
 * Clicking a field navigates to its measures detail page.
 */

import type { FeatureCollection } from "geojson"
import type { StyleSpecification } from "maplibre-gl"
import maplibregl from "maplibre-gl"
import { useCallback, useMemo, useState } from "react"
import type { LayerProps } from "react-map-gl/maplibre"
import {
  Layer,
  Map as MapGL,
  type MapMouseEvent,
  type ViewState,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"

const FIELDS_LAYER = "measuresMapFields"
const FIELDS_OUTLINE_LAYER = "measuresMapFieldsOutline"
const SELECTED_LAYER = "measuresMapSelected"
const SELECTED_OUTLINE_LAYER = "measuresMapSelectedOutline"
const FIELDS_SOURCE = "measuresMapSource"
const SELECTED_SOURCE = "measuresMapSelectedSource"

/** Fill layer coloured by `measureCount` property (0 = grey, 1+ = green gradient). */
function getMeasureCountFillStyle(layerId: string): LayerProps {
  return {
    id: layerId,
    type: "fill",
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "measureCount"],
        0,
        "#d1d5db", // grey  — no measures
        1,
        "#86efac", // light green — 1 measure
        5,
        "#16a34a", // dark green  — 5+ measures
      ] as any,
      "fill-opacity": 0.75,
    },
  }
}

function getMeasureCountOutlineStyle(layerId: string): LayerProps {
  return {
    id: layerId,
    type: "line",
    paint: {
      "line-color": [
        "interpolate",
        ["linear"],
        ["get", "measureCount"],
        0,
        "#9ca3af",
        1,
        "#4ade80",
        5,
        "#15803d",
      ] as any,
      "line-width": 2,
    },
  }
}

type MeasuresMapProps = {
  /** GeoJSON with all farm fields. Each feature needs b_id, b_name, measureCount properties. */
  fieldsGeoJSON: FeatureCollection
  /** GeoJSON with the currently-selected field (for yellow highlight). Empty for farm overview. */
  selectedFieldGeoJSON: FeatureCollection
  mapStyle: string | StyleSpecification
  height?: string
  /**
   * When provided, the initial view is fitted to this GeoJSON instead of `fieldsGeoJSON`.
   * Use this on field detail pages to zoom to the selected field rather than the whole farm.
   */
  initialFitGeoJSON?: FeatureCollection
  /**
   * When provided, called with the clicked field's b_id instead of navigating
   * to the field detail page. Used on the farm overview to open the add-dialog.
   */
  onFieldClick?: (b_id: string) => void
}

export default function MeasuresMap({
  fieldsGeoJSON,
  selectedFieldGeoJSON,
  mapStyle,
  height = "320px",
  initialFitGeoJSON,
  onFieldClick,
}: MeasuresMapProps) {
  const fitTarget =
    initialFitGeoJSON && initialFitGeoJSON.features.length > 0 ? initialFitGeoJSON : fieldsGeoJSON
  const initialViewState = getViewState(fitTarget)
  const [viewState, setViewState] = useState<ViewState>(initialViewState as ViewState)
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null)

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
      if (onFieldClick) {
        onFieldClick(b_id)
      }
    },
    [onFieldClick],
  )

  const fillStyle = useMemo(() => getMeasureCountFillStyle(FIELDS_LAYER), [])
  const outlineStyle = useMemo(() => getMeasureCountOutlineStyle(FIELDS_OUTLINE_LAYER), [])

  const hoveredFeature = useMemo(() => {
    if (!hoveredFieldId) return null
    return fieldsGeoJSON.features.find((f) => f.properties?.b_id === hoveredFieldId) ?? null
  }, [fieldsGeoJSON, hoveredFieldId])

  return (
    <div className="relative" style={{ height, isolation: "isolate" }}>
      <MapGL
        {...viewState}
        style={{
          height: "100%",
          width: "100%",
          borderRadius: "0.5rem",
        }}
        mapStyle={mapStyle as any}
        mapLib={maplibregl}
        interactiveLayerIds={[FIELDS_LAYER]}
        onMove={onViewportChange}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        cursor={hoveredFieldId ? "pointer" : "default"}
      >
        <MapTilerAttribution />

        {/* All farm fields coloured by measure count */}
        <FieldsSourceNotClickable id={FIELDS_SOURCE} fieldsData={fieldsGeoJSON}>
          <Layer {...(fillStyle as any)} id={FIELDS_LAYER} source={FIELDS_SOURCE} />
          <Layer {...(outlineStyle as any)} id={FIELDS_OUTLINE_LAYER} source={FIELDS_SOURCE} />
        </FieldsSourceNotClickable>

        {/* Selected field: yellow highlight */}
        <FieldsSourceNotClickable id={SELECTED_SOURCE} fieldsData={selectedFieldGeoJSON}>
          <Layer
            id={SELECTED_LAYER}
            source={SELECTED_SOURCE}
            type="fill"
            paint={{
              "fill-color": "#ffcf0d",
              "fill-opacity": 0.25,
            }}
          />
          <Layer
            id={SELECTED_OUTLINE_LAYER}
            source={SELECTED_SOURCE}
            type="line"
            paint={{ "line-color": "#ffcf0d", "line-width": 3 }}
          />
        </FieldsSourceNotClickable>
      </MapGL>

      {/* Hover tooltip */}
      {hoveredFeature && (
        <div className="absolute bottom-3 left-3 z-10 bg-background/95 backdrop-blur-sm border rounded-lg px-2.5 py-1.5 shadow-md text-xs pointer-events-none">
          <p className="font-semibold">{hoveredFeature.properties?.b_name ?? "Onbekend perceel"}</p>
          <p className="text-muted-foreground text-[10px]">
            {(hoveredFeature.properties?.measureCount as number) === 0
              ? "Geen maatregelen"
              : `${hoveredFeature.properties?.measureCount as number} maatregel${(hoveredFeature.properties?.measureCount as number) === 1 ? "" : "en"}`}
          </p>
        </div>
      )}
    </div>
  )
}
