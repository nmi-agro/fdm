/**
 * Map of all soil analyses of a field: the zone and the sample points of each analysis, each in its
 * own colour. Hovering an analysis highlights it; clicking opens it. Several analyses can be
 * highlighted at once, for example the zones behind an aggregated soil value.
 *
 * Import with React.lazy (see `SoilAnalysesOverview`) to avoid SSR issues with maplibre-gl and to
 * keep the maplibre-gl bundle out of the initial JS payload.
 */

import type { FeatureCollection, MultiPoint, MultiPolygon, Polygon } from "geojson"
import type { ExpressionSpecification } from "maplibre-gl"
import { useMemo } from "react"
import { Layer, type LayerProps, type MapLayerMouseEvent, Source } from "react-map-gl/maplibre"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { COOPERATIVE_GESTURES_PROPS } from "~/components/blocks/atlas/atlas-cooperative-gestures"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"

/** A soil analysis with its sampling geometries and map colour. */
export interface MappedSoilAnalysis {
  a_id: string
  color: string
  zone: Polygon | MultiPolygon | null
  points: MultiPoint | null
}

const ZONE_FILL_LAYER = "soil-analyses-zone-fill"
const POINT_LAYER = "soil-analyses-points"

export default function SoilAnalysesMap({
  fieldGeometry,
  analyses,
  highlightedIds,
  onHighlight,
  onSelect,
  height = "280px",
}: {
  fieldGeometry: Polygon | MultiPolygon | null
  /** The analyses with geometry, newest first. */
  analyses: MappedSoilAnalysis[]
  /** The analyses to highlight; the others are dimmed while any analysis is highlighted. */
  highlightedIds: string[]
  onHighlight: (a_ids: string[]) => void
  onSelect: (a_id: string) => void
  height?: string
}) {
  const fieldData = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: fieldGeometry ? [{ type: "Feature", geometry: fieldGeometry, properties: {} }] : [],
    }),
    [fieldGeometry],
  )

  // Oldest first, so that newer zones are drawn on top and are hit first by the pointer
  const zoneData = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: [...analyses]
        .reverse()
        .filter((analysis) => analysis.zone)
        .map((analysis) => ({
          type: "Feature",
          geometry: analysis.zone as Polygon | MultiPolygon,
          properties: { a_id: analysis.a_id, color: analysis.color },
        })),
    }),
    [analyses],
  )
  const pointData = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: [...analyses]
        .reverse()
        .filter((analysis) => analysis.points)
        .map((analysis) => ({
          type: "Feature",
          geometry: analysis.points as MultiPoint,
          properties: { a_id: analysis.a_id, color: analysis.color },
        })),
    }),
    [analyses],
  )

  // Fit tightly around the field: the map is small, so the default padding would leave the field
  // as a small shape in the middle
  const initialViewState = useMemo(
    () => ({
      ...getViewState({
        type: "FeatureCollection",
        features: [...fieldData.features, ...zoneData.features, ...pointData.features],
      }),
      fitBoundsOptions: { padding: 24 },
    }),
    [fieldData, zoneData, pointData],
  )

  const hasHighlight = highlightedIds.length > 0
  const isHighlighted: ExpressionSpecification = [
    "in",
    ["get", "a_id"],
    ["literal", highlightedIds],
  ]
  const zoneFill: LayerProps = {
    id: ZONE_FILL_LAYER,
    type: "fill",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": ["case", isHighlighted, 0.55, hasHighlight ? 0.08 : 0.3],
    },
  }
  const zoneOutline: LayerProps = {
    id: "soil-analyses-zone-outline",
    type: "line",
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["case", isHighlighted, 3, 2],
      "line-opacity": ["case", isHighlighted, 1, hasHighlight ? 0.3 : 1],
    },
  }
  const pointStyle: LayerProps = {
    id: POINT_LAYER,
    type: "circle",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["case", isHighlighted, 5, 3.5],
      "circle-opacity": ["case", isHighlighted, 1, hasHighlight ? 0.25 : 0.9],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
      "circle-stroke-opacity": ["case", isHighlighted, 1, hasHighlight ? 0.25 : 0.9],
    },
  }
  const fieldOutline = {
    ...getFieldsStyle("fieldsSavedOutline"),
    id: "soil-analyses-field-outline",
  }
  // A white casing keeps the green field boundary visible on aerial imagery
  const fieldOutlineCasing: LayerProps = {
    id: "soil-analyses-field-outline-casing",
    type: "line",
    paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 },
  }

  function getAnalysisId(event: MapLayerMouseEvent): string | null {
    const a_id = event.features?.[0]?.properties?.a_id
    return typeof a_id === "string" ? a_id : null
  }

  return (
    <Atlas
      initialViewState={initialViewState}
      interactive={true}
      interactiveLayerIds={[POINT_LAYER, ZONE_FILL_LAYER]}
      {...COOPERATIVE_GESTURES_PROPS}
      useStoredViewState={false}
      updateFromInitialViewState={true}
      style={{ height, width: "100%" }}
      cursor={hasHighlight ? "pointer" : undefined}
      onMouseMove={(event: MapLayerMouseEvent) => {
        const a_id = getAnalysisId(event)
        const next = a_id ? [a_id] : []
        // Only report changes, so that moving within one zone does not re-render the page
        if (next.join() !== highlightedIds.join()) onHighlight(next)
      }}
      onMouseLeave={() => {
        if (hasHighlight) onHighlight([])
      }}
      onClick={(event: MapLayerMouseEvent) => {
        const a_id = getAnalysisId(event)
        if (a_id) onSelect(a_id)
      }}
    >
      <MapTilerAttribution />
      <FieldsSourceNotClickable id="soil-analyses-field" fieldsData={fieldData}>
        <Layer {...fieldOutlineCasing} />
        <Layer {...fieldOutline} />
      </FieldsSourceNotClickable>
      <Source id="soil-analyses-zones" type="geojson" data={zoneData}>
        <Layer {...zoneFill} />
        <Layer {...zoneOutline} />
      </Source>
      <Source id="soil-analyses-points" type="geojson" data={pointData}>
        <Layer {...pointStyle} />
      </Source>
    </Atlas>
  )
}
