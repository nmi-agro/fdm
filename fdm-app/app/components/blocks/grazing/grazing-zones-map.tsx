/**
 * Map of the grazing zones on one field: the field boundary and the zones that were grazed.
 *
 * Import with React.lazy to avoid SSR issues with maplibre-gl and to keep it out of the initial
 * JS payload.
 */

import type { FeatureCollection } from "geojson"
import { useMemo } from "react"
import { Layer, type LayerProps, Source } from "react-map-gl/maplibre"
import type { Area } from "~/lib/grazing-strip"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { COOPERATIVE_GESTURES_PROPS } from "~/components/blocks/atlas/atlas-cooperative-gestures"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"

const ZONE_COLOR = "#10b981"

const zoneFillStyle: LayerProps = {
  id: "grazing-zones-fill",
  type: "fill",
  paint: { "fill-color": ZONE_COLOR, "fill-opacity": 0.25 },
}

const zoneOutlineStyle: LayerProps = {
  id: "grazing-zones-outline",
  type: "line",
  paint: { "line-color": "#047857", "line-width": 1.5 },
}

function toFeatureCollection(geometries: Area[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry) => ({ type: "Feature", geometry, properties: {} })),
  }
}

export default function GrazingZonesMap({
  fieldGeometry,
  zones,
  height = "280px",
}: {
  fieldGeometry: Area
  zones: Area[]
  height?: string
}) {
  const fieldData = useMemo(() => toFeatureCollection([fieldGeometry]), [fieldGeometry])
  const zoneData = useMemo(() => toFeatureCollection(zones), [zones])
  const initialViewState = useMemo(
    () => ({ ...getViewState(fieldData), fitBoundsOptions: { padding: 24 } }),
    [fieldData],
  )
  const fieldOutline = {
    ...getFieldsStyle("fieldsSavedOutline"),
    id: "grazing-zones-field-outline",
  }

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
      <FieldsSourceNotClickable id="grazing-zones-field" fieldsData={fieldData}>
        <Layer {...fieldOutline} />
      </FieldsSourceNotClickable>
      <Source id="grazing-zones" type="geojson" data={zoneData}>
        <Layer {...zoneFillStyle} />
        <Layer {...zoneOutlineStyle} />
      </Source>
    </Atlas>
  )
}
