/**
 * Lazy-loaded map component for the farm indicators overview page.
 * Shows farm fields coloured by their average BLN3 score.
 * Clicking a field navigates to its detail page.
 *
 * Import with React.lazy to avoid SSR issues with maplibre-gl.
 */

import type { FeatureCollection } from "geojson"
import { LayoutList } from "lucide-react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import {
    type Dispatch,
    type SetStateAction,
    useCallback,
    useMemo,
    useRef,
    useState,
} from "react"
import {
    Layer,
    Map as MapGL,
    type MapMouseEvent,
    type MapRef,
    type ViewState,
    type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import { Link, useNavigate } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import {
    getFieldsScoreOutlineStyle,
    getFieldsScoreStyle,
} from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { getScoreColor, getScoreVerdict, INDICATORS } from "~/lib/indicators"

type ChildScoreEntry = {
    id: string
    label: string
    score: number | null
}

type IndicatorsMapProps = {
    fieldsGeoJSON: FeatureCollection
    mapStyle: string | StyleSpecification
    /** GeoJSON property name to colour fields by. Defaults to "avgScore". */
    selectedProperty?: string
    /** Human-readable label shown in the map legend. */
    label?: string
    height?: string
    /** Child aggregation/indicator entries to show in hover tooltip (one level below selected). */
    childEntries?: ChildScoreEntry[]
} & (
    | { basePath: string; basePathFormatter?: undefined }
    | { basePath?: undefined; basePathFormatter: (b_id: string) => string }
)

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
    basePathFormatter,
    selectedProperty = "avgScore",
    label,
    height = "380px",
    childEntries,
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
                    if (b_id)
                        navigate(
                            basePathFormatter
                                ? basePathFormatter(b_id)
                                : `${basePath}/${b_id}`,
                        )
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
                    className="absolute z-20 pointer-events-none bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-md text-xs min-w-[180px] max-w-[260px]"
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
                                    className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shrink-0"
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
                    {/* Child sub-scores (one level below the selected layer) */}
                    {childEntries && childEntries.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t space-y-1">
                            {childEntries.map((child) => {
                                const childScore =
                                    typeof hoverInfo.properties[child.id] === "number" &&
                                    (hoverInfo.properties[child.id] as number) >= 0
                                        ? (hoverInfo.properties[child.id] as number)
                                        : null
                                return (
                                    <div key={child.id} className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground truncate text-[10px]">
                                            {child.label}
                                        </span>
                                        {childScore != null ? (
                                            <span
                                                className="text-[10px] font-semibold tabular-nums shrink-0"
                                                style={{ color: getScoreColor(childScore) }}
                                            >
                                                {childScore}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground italic shrink-0">–</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
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

export function ScoreSelect({
    selectedProperty,
    setSelectedProperty,
    detailPath,
}: {
    selectedProperty: string
    setSelectedProperty: Dispatch<SetStateAction<string>>
    detailPath: string
}) {
    {
        /* Floating indicator selector + info banner */
    }
    return (
        <Card className="absolute top-3 left-3 z-10 w-64 shadow-md bg-background/90 backdrop-blur-sm">
            <CardContent className="p-2 space-y-2">
                <div className="flex items-center gap-2">
                    <Select
                        value={selectedProperty}
                        onValueChange={setSelectedProperty}
                    >
                        <SelectTrigger className="flex-1 text-xs h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[380px] overflow-y-auto">
                            <SelectItem value="avgScore">
                                Gemiddelde score
                            </SelectItem>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Hoofdthema's
                                </SelectLabel>
                                <SelectItem value="S_BLN">BLN</SelectItem>
                                <SelectItem value="S_BBWP">
                                    BedrijfsBodemWaterPlan (BBWP)
                                </SelectItem>
                                <SelectItem value="S_WAT_BLN">Water</SelectItem>
                                <SelectItem value="S_NUT_BLN">
                                    Nutriëntenkringloop
                                </SelectItem>
                                <SelectItem value="S_CLIM_BLN">
                                    Klimaat
                                </SelectItem>
                                <SelectItem value="S_PROD_BLN">
                                    Productie (OBI)
                                </SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Waterthema's
                                </SelectLabel>
                                <SelectItem value="S_GW_QUANT_BLN">
                                    Grondwaterkwantiteit
                                </SelectItem>
                                <SelectItem value="S_GW_QUAL_BLN">
                                    Grondwaterkwaliteit
                                </SelectItem>
                                <SelectItem value="S_SW_QUAL_BLN">
                                    Oppervlaktewaterkwaliteit
                                </SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Productiethema's
                                </SelectLabel>
                                <SelectItem value="S_PROD_BIOL_BLN">
                                    Biologische bodemkwaliteit
                                </SelectItem>
                                <SelectItem value="S_PROD_CHEM_BLN">
                                    Chemische bodemkwaliteit
                                </SelectItem>
                                <SelectItem value="S_PROD_PHYS_BLN">
                                    Fysische bodemkwaliteit
                                </SelectItem>
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Water indicatoren
                                </SelectLabel>
                                {INDICATORS.filter(
                                    (i) => i.ecosysteemdienst === "Water",
                                ).map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                        {i.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Nutriënten & klimaat indicatoren
                                </SelectLabel>
                                {INDICATORS.filter((i) =>
                                    ["Nutriëntenkringloop", "Klimaat"].includes(
                                        i.ecosysteemdienst,
                                    ),
                                ).map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                        {i.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel className="text-xs text-muted-foreground">
                                    Productie (OBI) indicatoren
                                </SelectLabel>
                                {INDICATORS.filter(
                                    (i) => i.ecosysteemdienst === "Productie",
                                ).map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                        {i.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <Button
                        asChild
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title="Tabelweergave"
                    >
                        <Link to={detailPath}>
                            <LayoutList className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
                <Bln3BetaBanner />
            </CardContent>
        </Card>
    )
}
