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
    const baseFieldsFillColorExpr: ExpressionSpecification = [
        "match",
        ["get", "b_lu_croprotation"],
        ...getCultivationTypesHavingColors().flatMap((k) => [
            k,
            getCultivationColor(k),
        ]),
        getCultivationColor("other"),
    ] as any

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
 */
export function getFieldsScoreStyle(layerId: string, property = "avgScore"): LayerProps {
    return {
        id: layerId,
        type: "fill",
        paint: {
            "fill-color": [
                "interpolate",
                ["linear"],
                ["get", property],
                -1,  "#9ca3af", // grey  — no data
                0,   "#ef4444", // red   — score 0
                40,  "#eab308", // yellow — score 40
                70,  "#22c55e", // green  — score 70+
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
                "interpolate",
                ["linear"],
                ["get", property],
                -1,  "#6b7280",
                0,   "#dc2626",
                40,  "#ca8a04",
                70,  "#16a34a",
            ] as any,
            "line-width": 2,
        },
    }
}
