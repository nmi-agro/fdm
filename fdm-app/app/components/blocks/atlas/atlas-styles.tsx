import type { ExpressionSpecification } from "maplibre-gl"
import type { LayerProps } from "react-map-gl/maplibre"
import {
  getCultivationColor,
  getCultivationTypesHavingColors,
} from "~/components/custom/cultivation-colors"

export function getFieldsStyle(layerId: string): LayerProps {
  const style = getFieldsStyleInner(layerId)
  style.id = layerId
  return style
}

function getFieldsStyleInner(layerId: string): LayerProps {
  const baseFillStyles = {}

  const baseLineStyles = {
    "line-width": 4,
  }

  if (layerId === "fieldsSelected") {
    // This layer should not be visible but still clickable
    return {
      type: "fill",
      paint: {
        "fill-color": "#000000",
        "fill-opacity": 0,
      },
    }
  }

  if (layerId === "fieldsSelectedOutline") {
    return {
      type: "line",
      paint: {
        ...baseLineStyles,
        "line-color": "#ffcf0d",
      },
    }
  }

  if (layerId === "fieldsSaved") {
    // This layer should not be visible but still clickable
    return {
      type: "fill",
      paint: {
        "fill-color": "#000000",
        "fill-opacity": 0,
      },
    }
  }

  if (layerId === "fieldsSavedOutline") {
    return {
      type: "line",
      paint: {
        ...baseLineStyles,
        "line-color": "#10b981",
      },
    }
  }

  if (layerId === "fieldsSavedHeatmapOutline") {
    return {
      type: "line",
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.5,
      },
    }
  }

  const baseFieldsFillColorExpr: ExpressionSpecification = [
    "match",
    ["get", "b_lu_croprotation"],
    ...getCultivationTypesHavingColors().flatMap((k) => [k, getCultivationColor(k)]),
    getCultivationColor("other"),
  ] as any

  // default styles
  return {
    type: "fill",
    paint: {
      ...baseFillStyles,
      "fill-color": baseFieldsFillColorExpr,
      "fill-opacity": 0.8,
    },
  }
}

/**
 * Fill layer that colours fields by their average BLN3 score (0–100).
 * Store avgScore = -1 on features that have no data (renders grey).
 * Pass `property` to colour by a different GeoJSON feature property
 * (e.g. a per-category average or a single indicator score).
 *
 * Uses the same discrete red/yellow/green tier boundaries as `getScoreTier`
 * (~/lib/indicators): <40 red, 40–69 yellow, 70+ green. A step expression
 * (rather than a continuous interpolation) keeps the field colour and the
 * score badge in the hover/click tooltip in exact agreement at every score.
 */
export function getFieldsScoreStyle(layerId: string, property = "avgScore"): LayerProps {
  return {
    id: layerId,
    type: "fill",
    paint: {
      "fill-color": [
        "step",
        ["get", property],
        "#9ca3af", // grey   — no data (property < -0.5, i.e. the -1 sentinel)
        -0.5,
        "#ef4444", // red    — score 0–39
        40,
        "#eab308", // yellow — score 40–69
        70,
        "#22c55e", // green  — score 70+
      ] as any,
      "fill-opacity": 0.75,
    },
  }
}

/** Outline layer that matches the score colour of getFieldsScoreStyle. */
export function getFieldsScoreOutlineStyle(layerId: string, property = "avgScore"): LayerProps {
  return {
    id: layerId,
    type: "line",
    paint: {
      "line-color": [
        "step",
        ["get", property],
        "#6b7280",
        -0.5,
        "#dc2626",
        40,
        "#ca8a04",
        70,
        "#16a34a",
      ] as any,
      "line-width": 2,
    },
  }
}
