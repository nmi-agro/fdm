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
import { getDottedFieldOutlineStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import {
  ZONE_CASING_COLOR,
  ZONE_CASING_WIDTH,
  ZONE_FILL_COLOR,
  ZONE_FILL_OPACITY,
  ZONE_OUTLINE_COLOR,
  ZONE_OUTLINE_WIDTH,
} from "./zone-colors"

// The zones look as in the zone editor and the Atlas layer Beweiding; overlapping zones grow lighter
const zoneFillStyle: LayerProps = {
  id: "grazing-zones-fill",
  type: "fill",
  paint: { "fill-color": ZONE_FILL_COLOR, "fill-opacity": ZONE_FILL_OPACITY },
}

const zoneCasingStyle: LayerProps = {
  id: "grazing-zones-casing",
  type: "line",
  paint: { "line-color": ZONE_CASING_COLOR, "line-width": ZONE_CASING_WIDTH },
}

const zoneOutlineStyle: LayerProps = {
  id: "grazing-zones-outline",
  type: "line",
  paint: { "line-color": ZONE_OUTLINE_COLOR, "line-width": ZONE_OUTLINE_WIDTH },
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
  // The white dotted field outline of the Atlas layer Beweiding
  const fieldOutline = {
    ...getDottedFieldOutlineStyle(),
    id: "grazing-zones-field-outline",
  } as LayerProps

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
        <Layer {...zoneCasingStyle} />
        <Layer {...zoneOutlineStyle} />
      </Source>
    </Atlas>
  )
}
