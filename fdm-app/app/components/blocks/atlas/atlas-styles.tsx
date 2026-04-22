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
