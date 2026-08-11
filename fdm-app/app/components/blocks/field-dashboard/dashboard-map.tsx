/**
 * Interactive farm-fields map for the field dashboard's map tile.
 *
 * Import with React.lazy to avoid SSR issues with maplibre-gl and to keep the
 * (large) maplibre-gl bundle out of the initial JS payload for every other
 * dashboard tile — it's only fetched once this tile actually renders.
 */

import { useMemo, useState } from "react"
import { Layer } from "react-map-gl/maplibre"
import { useNavigate } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { FieldTooltip } from "~/components/blocks/atlas/atlas-panels"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import {
  FieldSourceClickable,
  FieldsSourceNotClickable,
} from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import type { FieldDashboardTileProps } from "./types"

export default function FieldDashboardMap({
  dashboard,
  fieldCroprotationById,
}: {
  dashboard: FieldDashboardTileProps["dashboard"]
  fieldCroprotationById: Record<string, string | null>
}) {
  const navigate = useNavigate()
  // Zoom in on the selected field rather than the full farm extent, so the field itself
  // is legible; neighbouring fields remain visible/clickable at the map's edges.
  const initialViewState = useMemo(
    () => getViewState(dashboard.selectedFieldGeoJson ?? dashboard.farmFieldsGeoJson),
    [dashboard],
  )

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

  const [showFields, setShowFields] = useState(true)

  return (
    <Atlas initialViewState={initialViewState} interactive={true}>
      <Controls
        initialViewState={initialViewState}
        showFlyToFields={dashboard.farmFieldsGeoJson.features.length > 0}
        showFields={showFields}
        onToggleFields={() => setShowFields(!showFields)}
      />
      <MapTilerAttribution />
      {showFields && (
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
      )}
      {showFields && (
        <FieldsSourceNotClickable
          id="dashboard-selected-source"
          fieldsData={dashboard.selectedFieldGeoJson}
        >
          <Layer {...selectedOutline} />
        </FieldsSourceNotClickable>
      )}
      <FieldTooltip zoomLevelFields={-1} layer="fieldsSaved" />
    </Atlas>
  )
}
