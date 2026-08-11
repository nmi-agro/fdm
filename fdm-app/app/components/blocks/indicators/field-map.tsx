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
import type { StyleSpecification } from "maplibre-gl"
import maplibregl from "maplibre-gl"
import { useCallback, useMemo } from "react"
import { Layer } from "react-map-gl/maplibre"
import { useNavigate } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import {
  getFieldsScoreOutlineStyle,
  getFieldsScoreStyle,
} from "~/components/blocks/atlas/atlas-styles"
import { AtlasTooltip } from "~/components/blocks/atlas/atlas-tooltip"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { getScoreColor, getScoreVerdict } from "~/lib/indicators"

type FieldMapProps = {
  /** GeoJSON with all farm fields. Each feature needs b_id, b_name and score properties. */
  fieldsGeoJSON: FeatureCollection
  /** GeoJSON with only the currently-selected field, for the yellow highlight. */
  selectedFieldGeoJSON: FeatureCollection
  mapStyle: string | StyleSpecification
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
    <Atlas
      interactive={true}
      interactiveLayerIds={[FIELDS_LAYER]}
      initialViewState={initialViewState}
      style={{ height }}
    >
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
        render={({ feature, mode }) => {
          if (feature === null) return null
          const hoveredScore =
            typeof feature?.properties?.[scoreKey] === "number" && feature.properties[scoreKey] >= 0
              ? (feature.properties[scoreKey] as number)
              : null

          return (
            <>
              <p className="font-semibold">{feature.properties?.b_name ?? "Onbekend perceel"}</p>
              {scoreLabel && <p className="text-muted-foreground text-[10px]">{scoreLabel}</p>}
              {hoveredScore !== null && (
                <span
                  className="mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{
                    backgroundColor: getScoreColor(hoveredScore),
                  }}
                >
                  {hoveredScore} – {getScoreVerdict(hoveredScore)}
                </span>
              )}
            </>
          )
        }}
      />
    </Atlas>
  )
}
