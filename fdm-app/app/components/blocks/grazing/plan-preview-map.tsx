/**
 * Map preview of a grazing plan: the chosen fields with the planned strips or plots. The strip of
 * the hovered plan row is highlighted, and hovering a strip on the map reports it back, so the row
 * can be highlighted too.
 *
 * Import with React.lazy to avoid SSR issues with maplibre-gl and to keep it out of the initial
 * JS payload.
 */

import type { FeatureCollection } from "geojson"
import type { ExpressionSpecification } from "maplibre-gl"
import { useMemo } from "react"
import { Layer, type LayerProps, Source } from "react-map-gl/maplibre"
import type { Area } from "~/lib/grazing-strip"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"

/** A planned strip or plot, drawn once even when the plan uses it several times. */
export interface PlanPreviewZone {
  /** Identifies the zone; plan rows on the same zone share it. */
  id: string
  geometry: Area
}

const ZONES_FILL_LAYER = "plan-preview-zones-fill"

export default function PlanPreviewMap({
  fields,
  zones,
  highlightedZoneId,
  onZoneHover,
  height = "320px",
}: {
  fields: Area[]
  zones: PlanPreviewZone[]
  /** The zone of the hovered plan row. */
  highlightedZoneId?: string | null
  /** Called with the zone under the pointer, or `null` when the pointer leaves the zones. */
  onZoneHover?: (zoneId: string | null) => void
  height?: string
}) {
  const fieldData: FeatureCollection = useMemo(
    () => ({
      type: "FeatureCollection",
      features: fields.map((geometry) => ({ type: "Feature", geometry, properties: {} })),
    }),
    [fields],
  )
  const zoneData: FeatureCollection = useMemo(
    () => ({
      type: "FeatureCollection",
      features: zones.map((zone) => ({
        type: "Feature",
        geometry: zone.geometry,
        properties: { zone_id: zone.id },
      })),
    }),
    [zones],
  )
  const initialViewState = useMemo(
    () => ({ ...getViewState(fieldData), fitBoundsOptions: { padding: 24 } }),
    [fieldData],
  )

  const isHighlighted: ExpressionSpecification = ["==", ["get", "zone_id"], highlightedZoneId ?? ""]
  const zoneFill: LayerProps = {
    id: ZONES_FILL_LAYER,
    type: "fill",
    paint: {
      "fill-color": ["case", isHighlighted, "#047857", "#86efac"],
      "fill-opacity": ["case", isHighlighted, 0.85, 0.45],
    },
  }
  const zoneOutline: LayerProps = {
    id: "plan-preview-zones-outline",
    type: "line",
    paint: {
      "line-color": ["case", isHighlighted, "#064e3b", "#15803d"],
      "line-width": ["case", isHighlighted, 3, 1],
    },
  }
  const fieldOutline = { ...getFieldsStyle("fieldsSavedOutline"), id: "plan-preview-fields" }

  return (
    <Atlas
      initialViewState={initialViewState}
      // A preview next to the plan: scrolling zooms the map directly, without Ctrl
      interactive={true}
      useStoredViewState={false}
      updateFromInitialViewState={true}
      interactiveLayerIds={[ZONES_FILL_LAYER]}
      onMouseMove={(event) => {
        const zoneId = event.features?.[0]?.properties?.zone_id as string | undefined
        onZoneHover?.(zoneId ?? null)
      }}
      onMouseLeave={() => onZoneHover?.(null)}
      style={{ height, width: "100%" }}
    >
      <MapTilerAttribution />
      <FieldsSourceNotClickable id="plan-preview-fields-source" fieldsData={fieldData}>
        <Layer {...fieldOutline} />
      </FieldsSourceNotClickable>
      <Source id="plan-preview-zones" type="geojson" data={zoneData}>
        <Layer {...zoneFill} />
        <Layer {...zoneOutline} />
      </Source>
    </Atlas>
  )
}
