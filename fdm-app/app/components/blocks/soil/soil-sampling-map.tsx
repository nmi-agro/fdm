/**
 * Map of the sampling of one soil analysis: the field boundary, the sampling zone and the
 * locations of the subsamples.
 *
 * Import with React.lazy (see `SoilSamplingMapCard`) to avoid SSR issues with maplibre-gl and to
 * keep the maplibre-gl bundle out of the initial JS payload.
 */

import type { FeatureCollection, MultiPoint, MultiPolygon, Polygon } from "geojson"
import { useMemo } from "react"
import { Layer, type LayerProps, Source } from "react-map-gl/maplibre"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { COOPERATIVE_GESTURES_PROPS } from "~/components/blocks/atlas/atlas-cooperative-gestures"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { SAMPLING_POINT_COLOR, SAMPLING_ZONE_COLOR } from "./soil-sampling-colors"

const zoneFillStyle: LayerProps = {
  id: "soil-sampling-zone-fill",
  type: "fill",
  paint: { "fill-color": SAMPLING_ZONE_COLOR, "fill-opacity": 0.25 },
}

const zoneOutlineStyle: LayerProps = {
  id: "soil-sampling-zone-outline",
  type: "line",
  paint: { "line-color": SAMPLING_ZONE_COLOR, "line-width": 2, "line-dasharray": [2, 1] },
}

const pointStyle: LayerProps = {
  id: "soil-sampling-points",
  type: "circle",
  paint: {
    "circle-radius": 5,
    "circle-color": SAMPLING_POINT_COLOR,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
  },
}

function toFeatureCollection(
  geometry: Polygon | MultiPolygon | MultiPoint | null | undefined,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: geometry ? [{ type: "Feature", geometry, properties: {} }] : [],
  }
}

export default function SoilSamplingMap({
  fieldGeometry,
  samplingZone,
  samplingPoints,
  height = "320px",
}: {
  fieldGeometry: Polygon | MultiPolygon | null
  /** The sampling zone; omit or pass `null` to hide it (for example, when it equals the field). */
  samplingZone: Polygon | MultiPolygon | null
  samplingPoints: MultiPoint | null
  height?: string
}) {
  const fieldData = useMemo(() => toFeatureCollection(fieldGeometry), [fieldGeometry])
  const zoneData = useMemo(() => toFeatureCollection(samplingZone), [samplingZone])
  const pointData = useMemo(() => toFeatureCollection(samplingPoints), [samplingPoints])

  // Fit the view on everything that is shown, so points outside the field remain visible
  const initialViewState = useMemo(
    () => ({
      ...getViewState({
        type: "FeatureCollection",
        features: [...fieldData.features, ...zoneData.features, ...pointData.features],
      }),
      // The map is small, so fit tightly; the default padding would shrink the field
      fitBoundsOptions: { padding: 24 },
    }),
    [fieldData, zoneData, pointData],
  )

  const fieldOutline = {
    ...getFieldsStyle("fieldsSavedOutline"),
    id: "soil-sampling-field-outline",
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
      <FieldsSourceNotClickable id="soil-sampling-field" fieldsData={fieldData}>
        <Layer {...fieldOutline} />
      </FieldsSourceNotClickable>
      {zoneData.features.length > 0 && (
        <Source id="soil-sampling-zone" type="geojson" data={zoneData}>
          <Layer {...zoneFillStyle} />
          <Layer {...zoneOutlineStyle} />
        </Source>
      )}
      {pointData.features.length > 0 && (
        <Source id="soil-sampling-points" type="geojson" data={pointData}>
          <Layer {...pointStyle} />
        </Source>
      )}
    </Atlas>
  )
}
