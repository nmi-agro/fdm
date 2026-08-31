/**
 * Lazy-loaded mini map for the field-level indicator detail page.
 *
 * Shows all farm fields coloured by their average BLN3 score. The current
 * field is highlighted with a yellow outline. Clicking another field navigates
 * to that field's indicator detail page.
 *
 * Import with React.lazy to avoid SSR issues with maplibre-gl.
 */

import type { FeatureCollection } from "geojson"
import * as maplibregl from "maplibre-gl"
import { useCallback, useMemo } from "react"
import { Layer } from "react-map-gl/maplibre"
import { useNavigate } from "react-router"
import { MapStyleVariant } from "@/app/integrations/map"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { ScoreLegend } from "~/components/blocks/atlas/atlas-legend"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import {
  getFieldsScoreOutlineStyle,
  getFieldsScoreStyle,
} from "~/components/blocks/atlas/atlas-styles"
import { AtlasTooltip } from "~/components/blocks/atlas/atlas-tooltip"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { Button } from "~/components/ui/button"
import { ScoreTooltipBody } from "./score-tooltip-body"

type FieldMapProps = {
  /** GeoJSON with all farm fields. Each feature needs b_id, b_name and score properties. */
  fieldsGeoJSON: FeatureCollection
  /** GeoJSON with only the currently-selected field, for the yellow highlight. */
  selectedFieldGeoJSON: FeatureCollection
  mapStyle?: MapStyleVariant
  /** Base path to navigate to — the b_id will be appended: `${basePath}/${b_id}` */
  basePath: string
  /**
   * GeoJSON property key to use for colouring fields.
   * One of "avg" | "obi" | "bbwp" | indicator ID (e.g. "B_DI").
   * Defaults to "avg".
   */
  scoreKey?: string
  /** Human-readable label for the selected score key, used in the hover tooltip. */
  scoreLabel?: string
  height?: string
}

const FIELDS_LAYER = "fieldMapFields"
const FIELDS_OUTLINE_LAYER = "fieldMapFieldsOutline"
const SELECTED_LAYER = "fieldMapSelected"
const SELECTED_OUTLINE_LAYER = "fieldMapSelectedOutline"
const FIELDS_SOURCE = "fieldMapSource"
const SELECTED_SOURCE = "fieldMapSelectedSource"

export default function FieldMap({
  fieldsGeoJSON,
  selectedFieldGeoJSON,
  mapStyle,
  basePath,
  scoreKey = "avg",
  scoreLabel,
  height = "320px",
}: FieldMapProps) {
  const navigate = useNavigate()
  const initialViewState = getViewState(fieldsGeoJSON)

  const onFeatureClicked = useCallback(
    (feature: maplibregl.MapGeoJSONFeature) => {
      const b_id = feature.properties?.b_id as string | undefined
      if (b_id) void navigate(`${basePath}/${b_id}`)
    },
    [navigate, basePath],
  )

  const scoreStyle = useMemo(() => getFieldsScoreStyle(FIELDS_LAYER, scoreKey), [scoreKey])
  const scoreOutlineStyle = useMemo(
    () => getFieldsScoreOutlineStyle(FIELDS_OUTLINE_LAYER, scoreKey),
    [scoreKey],
  )

  return (
    <div className="relative" style={{ height }}>
      <Atlas
        interactive={true}
        interactiveLayerIds={[FIELDS_LAYER]}
        initialViewState={initialViewState}
        useStoredViewState={false}
        style={{ height: "100%" }}
        mapStyle={mapStyle}
      >
        <Controls
          initialViewState={initialViewState}
          showGeocoder={false}
          showStyleSelect={false}
        />
        <MapTilerAttribution />

        {/* All farm fields coloured by score */}
        <FieldsSourceNotClickable id={FIELDS_SOURCE} fieldsData={fieldsGeoJSON}>
          <Layer {...(scoreStyle as any)} id={FIELDS_LAYER} source={FIELDS_SOURCE} />
          <Layer {...(scoreOutlineStyle as any)} id={FIELDS_OUTLINE_LAYER} source={FIELDS_SOURCE} />
        </FieldsSourceNotClickable>

        {/* Selected field: yellow outline highlight */}
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

        {/* Hover tooltip */}
        <AtlasTooltip
          layers={[FIELDS_LAYER]}
          onFeatureClicked={onFeatureClicked}
          render={({ features, mode }) => {
            if (features.length === 0) return null
            const feature = features[0]

            const hoveredScore =
              typeof feature.properties?.[scoreKey] === "number" &&
              feature.properties[scoreKey] >= 0
                ? (feature.properties[scoreKey] as number)
                : null

            return (
              <>
                <p className="font-semibold">{feature.properties?.b_name ?? "Onbekend perceel"}</p>
                <ScoreTooltipBody score={hoveredScore} label={scoreLabel} layout="row" />
                {mode === "popup" && (
                  <Button type="button" onClick={() => onFeatureClicked(feature)}>
                    Meer details
                  </Button>
                )}
              </>
            )
          }}
        />
      </Atlas>

      <div className="absolute bottom-2 left-2 z-10">
        <ScoreLegend label={scoreLabel} showSelectedFieldSwatch />
      </div>
    </div>
  )
}
