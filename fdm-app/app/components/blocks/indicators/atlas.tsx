/**
 * Lazy-loaded map component for the farm indicators overview page.
 * Shows farm fields coloured by their average BLN3 score.
 * Clicking a field navigates to its detail page.
 *
 * Import with React.lazy to avoid SSR issues with maplibre-gl.
 */

import type { FeatureCollection } from "geojson"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import { useCallback, useMemo, useRef, useState } from "react"
import {
    Layer,
    Map as MapGL,
    type MapMouseEvent,
    type MapRef,
    type ViewState,
    type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import { useNavigate } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import {
    getFieldsScoreOutlineStyle,
    getFieldsScoreStyle,
} from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { getScoreColor, getScoreVerdict } from "~/lib/indicators"

type IndicatorsMapProps = {
    fieldsGeoJSON: FeatureCollection
    mapStyle: string | StyleSpecification
    basePath: string
    /** GeoJSON property name to colour fields by. Defaults to "avgScore". */
    selectedProperty?: string
    /** Human-readable label shown in the map legend. */
    label?: string
    height?: string
}

type HoverInfo = {
    x: number
    y: number
    fieldName: string
    properties: Record<string, number | string | null>
} | null

const SCORE_LAYER = "indicatorsScore"
const OUTLINE_LAYER = "indicatorsScoreOutline"
const SOURCE_ID = "indicatorsFields"

export default function IndicatorsMap({
    fieldsGeoJSON,
    mapStyle,
    basePath,
    selectedProperty = "avgScore",
    label,
    height = "380px",
}: IndicatorsMapProps) {
    const navigate = useNavigate()
    const mapRef = useRef<MapRef>(null)
    const initialViewState = getViewState(fieldsGeoJSON)
    const [viewState, setViewState] = useState<ViewState>(
        initialViewState as ViewState,
    )
    const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null)

    const onViewportChange = useCallback(
        (event: ViewStateChangeEvent) => setViewState(event.viewState),
        [],
    )

    const onMouseMove = useCallback((e: MapMouseEvent) => {
        const feature = e.features?.[0]
        if (feature) {
            setHoverInfo({
                x: e.point.x,
                y: e.point.y,
                fieldName:
                    (feature.properties?.b_name as string) ??
                    (feature.properties?.b_id as string) ??
                    "Onbekend perceel",
                properties: feature.properties as Record<
                    string,
                    number | string | null
                >,
            })
        } else {
            setHoverInfo(null)
        }
    }, [])

    const onMouseLeave = useCallback(() => setHoverInfo(null), [])

    // Recompute paint expressions only when the active property changes
    const scoreStyle = useMemo(
        () => getFieldsScoreStyle(SCORE_LAYER, selectedProperty),
        [selectedProperty],
    )
    const outlineStyle = useMemo(
        () => getFieldsScoreOutlineStyle(OUTLINE_LAYER, selectedProperty),
        [selectedProperty],
    )

    // Current hover score (reactive to selectedProperty changes)
    const hoverScore =
        hoverInfo != null &&
        typeof hoverInfo.properties[selectedProperty] === "number" &&
        (hoverInfo.properties[selectedProperty] as number) >= 0
            ? (hoverInfo.properties[selectedProperty] as number)
            : null

    return (
        <div className="relative" style={{ height }}>
            <MapGL
                ref={mapRef}
                {...viewState}
                style={{
                    height: "100%",
                    width: "100%",
                    borderRadius: "0.5rem",
                }}
                mapStyle={mapStyle as any}
                mapLib={maplibregl}
                interactiveLayerIds={[SCORE_LAYER]}
                onMove={onViewportChange}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                onClick={(e) => {
                    const b_id = e.features?.[0]?.properties?.b_id as
                        | string
                        | undefined
                    if (b_id) navigate(`${basePath}/${b_id}`)
                }}
            >
                <Controls
                    onViewportChange={({ longitude, latitude, zoom }) =>
                        setViewState((s) => ({
                            ...s,
                            longitude,
                            latitude,
                            zoom,
                        }))
                    }
                    showFlyToFields={
                        fieldsGeoJSON.features.length > 0 ? true : undefined
                    }
                    onFlyToFields={() => {
                        setViewState({ ...(initialViewState as ViewState) })
                        if ((initialViewState as any).bounds) {
                            mapRef.current?.fitBounds(
                                (initialViewState as any).bounds,
                                (initialViewState as any).fitBoundsOptions,
                            )
                        }
                    }}
                />
                <MapTilerAttribution />
                <FieldsSourceNotClickable
                    id={SOURCE_ID}
                    fieldsData={fieldsGeoJSON}
                >
                    <Layer
                        {...(scoreStyle as any)}
                        id={SCORE_LAYER}
                        source={SOURCE_ID}
                    />
                    <Layer
                        {...(outlineStyle as any)}
                        id={OUTLINE_LAYER}
                        source={SOURCE_ID}
                    />
                </FieldsSourceNotClickable>
            </MapGL>

            {/* Hover tooltip */}
            {hoverInfo && (
                <div
                    className="absolute z-20 pointer-events-none bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-md text-xs min-w-[160px]"
                    style={{
                        left: hoverInfo.x + 12,
                        top: hoverInfo.y - 8,
                        transform: "translateY(-100%)",
                    }}
                >
                    <p className="font-semibold text-foreground">
                        {hoverInfo.fieldName}
                    </p>
                    {hoverInfo.properties.b_area != null && (
                        <p className="text-muted-foreground mt-0.5">
                            {Number(hoverInfo.properties.b_area).toFixed(2)} ha
                        </p>
                    )}
                    {label && (
                        <div className="mt-1.5 pt-1.5 border-t flex items-center justify-between gap-3">
                            <span className="text-muted-foreground truncate">
                                {label}
                            </span>
                            {hoverScore != null ? (
                                <span
                                    className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                    style={{
                                        backgroundColor:
                                            getScoreColor(hoverScore),
                                    }}
                                >
                                    {hoverScore} – {getScoreVerdict(hoverScore)}
                                </span>
                            ) : (
                                <span className="text-muted-foreground italic">
                                    Geen data
                                </span>
                            )}
                        </div>
                    )}
                    {!label && (
                        <p className="text-muted-foreground mt-0.5">
                            {hoverScore != null ? (
                                <>
                                    Score:{" "}
                                    <span
                                        className="font-semibold"
                                        style={{
                                            color: getScoreColor(hoverScore),
                                        }}
                                    >
                                        {hoverScore}
                                    </span>
                                    {" – "}
                                    {getScoreVerdict(hoverScore)}
                                </>
                            ) : (
                                "Geen data"
                            )}
                        </p>
                    )}
                </div>
            )}

            {/* Legend overlay — pointer-events-none so it doesn't block field clicks */}
            <div className="absolute bottom-6 left-2 pointer-events-none z-10 bg-background/90 backdrop-blur-sm rounded-md p-2 shadow-sm text-xs max-w-[200px]">
                {label && (
                    <p className="font-medium truncate mb-1.5 text-foreground">
                        {label}
                    </p>
                )}
                <div
                    className="h-2.5 w-full rounded-sm"
                    style={{
                        background:
                            "linear-gradient(to right, #ef4444, #eab308, #22c55e)",
                    }}
                />
                <div className="flex justify-between text-muted-foreground mt-0.5">
                    <span>0</span>
                    <span>40</span>
                    <span>70</span>
                    <span>100</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9ca3af] shrink-0" />
                    <span>Geen data</span>
                </div>
            </div>
        </div>
    )
}
