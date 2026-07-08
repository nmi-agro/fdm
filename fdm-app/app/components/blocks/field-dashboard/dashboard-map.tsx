/**
 * Interactive farm-fields map for the field dashboard's map tile.
 *
 * Import with React.lazy to avoid SSR issues with maplibre-gl and to keep the
 * (large) maplibre-gl bundle out of the initial JS payload for every other
 * dashboard tile — it's only fetched once this tile actually renders.
 */

import maplibregl from "maplibre-gl"
import { useEffect, useMemo, useRef } from "react"
import { Layer, Map as MapGL, type MapRef } from "react-map-gl/maplibre"
import { useNavigate } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import {
  FieldSourceClickable,
  FieldsSourceNotClickable,
} from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { FieldsPanelHover } from "~/components/blocks/atlas/atlas-panels"
import type { FieldDashboardTileProps } from "./types"

export default function FieldDashboardMap({
  dashboard,
  fieldCroprotationById,
}: {
  dashboard: FieldDashboardTileProps["dashboard"]
  fieldCroprotationById: Record<string, string | null>
}) {
  const navigate = useNavigate()
  const mapRef = useRef<MapRef>(null)
  // Zoom in on the selected field rather than the full farm extent, so the field itself
  // is legible; neighbouring fields remain visible/clickable at the map's edges.
  const initialViewState = useMemo(
    () => getViewState(dashboard.selectedFieldGeoJson ?? dashboard.farmFieldsGeoJson),
    [dashboard],
  )

  useEffect(() => {
    if (initialViewState.bounds) {
      mapRef.current?.fitBounds(initialViewState.bounds, initialViewState.fitBoundsOptions)
    }
  }, [initialViewState])

  const coloredFieldsGeoJson = useMemo(
    () => ({
      ...dashboard.farmFieldsGeoJson,
      features: dashboard.farmFieldsGeoJson.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          b_lu_croprotation: fieldCroprotationById[feature.properties.b_id] ?? null,
        },
      })),
    }),
    [dashboard.farmFieldsGeoJson, fieldCroprotationById],
  )

  // Reuse the exact same layer styles as the full-screen atlas fields page: a crop-colored
  // fill, a green "saved fields" outline, and an invisible "fieldsSaved" layer used for
  // hover/click detection (its id is special-cased by FieldsPanelHover to show name + area).
  const fieldsColorFill = {
    ...getFieldsStyle("dashboard-fields-fill"),
    id: "dashboard-fields-fill",
  }
  const fieldsSavedOutline = {
    ...getFieldsStyle("fieldsSavedOutline"),
    id: "dashboard-fields-outline",
  }
  const fieldsSaved = { ...getFieldsStyle("fieldsSaved"), id: "fieldsSaved" }
  const selectedOutline = {
    ...getFieldsStyle("fieldsSelectedOutline"),
    id: "dashboard-selected-outline",
  }

  return (
    <MapGL
      {...initialViewState}
      ref={mapRef}
      style={{ height: 360, width: "100%" }}
      mapStyle={dashboard.mapStyle}
      mapLib={maplibregl}
      interactiveLayerIds={["fieldsSaved"]}
    >
      <MapTilerAttribution />
      <FieldSourceClickable
        id="fieldsSaved"
        fieldsData={coloredFieldsGeoJson}
        onFieldClick={(feature) => {
          const b_id = feature.properties?.b_id
          if (!b_id || b_id === dashboard.b_id) return
          void navigate(`/farm/${dashboard.b_id_farm}/${dashboard.calendar}/field/${b_id}`)
        }}
      >
        <Layer {...fieldsColorFill} />
        <Layer {...fieldsSavedOutline} />
        <Layer {...fieldsSaved} />
      </FieldSourceClickable>
      <FieldsSourceNotClickable
        id="dashboard-selected-source"
        fieldsData={dashboard.selectedFieldGeoJson}
      >
        <Layer {...selectedOutline} />
      </FieldsSourceNotClickable>
      <div className="fields-panel">
        <FieldsPanelHover zoomLevelFields={-1} layer="fieldsSaved" />
      </div>
    </MapGL>
  )
}
