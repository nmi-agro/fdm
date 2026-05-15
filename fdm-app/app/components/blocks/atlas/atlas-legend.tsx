import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson"
import { TriangleAlert } from "lucide-react"
import { useId, useMemo } from "react"
import {
    Bar,
    BarChart,
    type BarShapeProps,
    Rectangle,
    XAxis,
    YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ChartContainer } from "~/components/ui/chart"
import { Spinner } from "~/components/ui/spinner"
import {
    GRADIENT_DEFINITIONS,
    GRADIENT_SHADED_SOIL_PARAMETERS,
    getGradientStops,
    getShadedSoilParameters,
    getShadingParameterMapper,
    SHADED_SOIL_TYPES,
    type ShadedSoilParameters,
} from "./atlas-soil-analysis"

interface ElevationLegendProps {
    min?: number
    max?: number
    loading?: boolean
    hoverValue?: number | null
    showScale?: boolean
    networkStatus?: "idle" | "loading" | "slow" | "error"
    message?: string
}

export function ElevationLegend({
    min,
    max,
    loading,
    hoverValue,
    showScale = true,
    networkStatus,
    message,
}: ElevationLegendProps) {
    return (
        <div className="w-40">
            <Card className="bg-background/90 backdrop-blur-sm shadow-sm">
                <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Hoogte (AHN4)
                        </h4>
                        {loading && <Spinner className="h-3 w-3" />}
                    </div>

                    {networkStatus === "slow" && (
                        <div className="mb-2 text-xs font-medium text-orange-600">
                            Trage verbinding...
                        </div>
                    )}

                    {networkStatus === "error" && (
                        <div className="mb-2 text-xs font-medium text-destructive">
                            Fout bij laden
                        </div>
                    )}

                    {message && (
                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                            {message}
                        </div>
                    )}

                    {showScale && (
                        <div className="flex flex-col gap-1">
                            <div className="flex h-4 w-full rounded border border-border overflow-hidden relative">
                                <div
                                    className="absolute inset-0 w-full h-full"
                                    style={{
                                        // BrewerSpectral11 Reversed (Blue -> Red)
                                        background:
                                            "linear-gradient(to right, #5e4fa2, #3288bd, #66c2a5, #abdda4, #e6f598, #ffffbf, #fee08b, #fdae61, #f46d43, #d53e4f, #9e0142)",
                                    }}
                                />
                            </div>
                            <div className="flex justify-between text-[12px] text-muted-foreground font-medium font-mono">
                                <span>
                                    {min !== undefined
                                        ? `${min.toFixed(1)}m`
                                        : "Laag"}
                                </span>
                                <span>
                                    {max !== undefined
                                        ? `${max.toFixed(1)}m`
                                        : "Hoog"}
                                </span>
                            </div>
                            {hoverValue !== undefined &&
                                hoverValue !== null && (
                                    <div className="mt-2 text-left text-xs font-bold">
                                        Hoogte: {hoverValue.toFixed(2)} m NAP
                                    </div>
                                )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
interface SoilAnalysisLegendProps {
    fieldsData?: FeatureCollection<Geometry, GeoJsonProperties>
    selectedParameter: ShadedSoilParameters
    soilParametersDescriptions: SoilParameterDescription
    min?: number
    max?: number
}

export function SoilAnalysisLegend(props: SoilAnalysisLegendProps) {
    const { fieldsData, selectedParameter } = props

    // Parameter shading config
    const shadingConfig = Object.fromEntries(
        getShadedSoilParameters().map((item) => [item.parameter, item]),
    )

    if (!shadingConfig[selectedParameter]) {
        console.warn(
            `${selectedParameter} not found in shaded soil parameters.`,
        )
    }

    const anyDataAvailable = fieldsData?.features.some(
        (feature) =>
            feature.properties && selectedParameter in feature.properties,
    )

    const parameterDescription = props.soilParametersDescriptions.find(
        (item) => item.parameter === props.selectedParameter,
    )

    const unitDisplay =
        parameterDescription?.unit && parameterDescription.unit !== "-"
            ? ` (${parameterDescription.unit})`
            : ""
    const title = parameterDescription
        ? `${parameterDescription.name}${unitDisplay}`
        : undefined

    return (
        <Card className="p-4 space-y-2 flex-initial min-h-0 overflow-y-auto">
            <CardHeader className="p-0">
                <CardTitle className="text-xs text-center text-muted-foreground">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {!shadingConfig[selectedParameter] ? null : shadingConfig[
                      selectedParameter
                  ].shading === "enum" ? (
                    <EnumSoilAnalysisLegend {...props} />
                ) : (
                    <GradientSoilAnalysisLegend
                        {...props}
                        selectedParameter={selectedParameter}
                    />
                )}
                {fieldsData &&
                    fieldsData.features.length > 0 &&
                    !anyDataAvailable && (
                        <p className="flex flex-row items-center gap-2 text-[10pt]">
                            <TriangleAlert className="h-4 w-4 text-orange-500" />
                            Geen data op hele bedrijf
                        </p>
                    )}
            </CardContent>
        </Card>
    )
}

function EnumSoilAnalysisLegend(props: SoilAnalysisLegendProps) {
    const displayedOptions = useMemo(() => {
        if (props.selectedParameter !== "b_soiltype_agr") return []
        if (!props.fieldsData) return SHADED_SOIL_TYPES

        const found = new Set<string>()

        for (const feature of props.fieldsData.features) {
            const value = feature.properties?.[props.selectedParameter]
            if (typeof value !== "undefined") {
                found.add(value as string)
            }
        }

        return SHADED_SOIL_TYPES.filter((item) => found.has(item.value))
    }, [props.selectedParameter, props.fieldsData])

    return (
        <table className="border-separate border-spacing-1">
            <tbody>
                {displayedOptions.map((opt) => (
                    <tr key={opt.value}>
                        <td className="align-middle">
                            <div
                                className="size-3 rounded"
                                style={{ backgroundColor: opt.fill }}
                            />
                        </td>
                        <td className="align-middle text-sm text-muted-foreground">
                            {opt.label}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function GradientSoilAnalysisLegend(
    props: SoilAnalysisLegendProps & {
        selectedParameter: ShadedSoilParameters
    },
) {
    const gradientId = useId()

    const gradDef =
        GRADIENT_DEFINITIONS[
            GRADIENT_SHADED_SOIL_PARAMETERS[
                props.selectedParameter as keyof typeof GRADIENT_SHADED_SOIL_PARAMETERS
            ]
        ]

    if (!gradDef) {
        console.warn(
            `No gradient definition found for parameter: ${props.selectedParameter}`,
        )
        return null
    }

    const parameterMapper = getShadingParameterMapper(props.selectedParameter)

    const min = props.min ?? 0
    const max = props.max ?? 1

    const chartData = [{ name: "Legenda", min: min, max: max }]
    const gradient = getGradientStops(
        gradDef.gradient,
        min,
        max,
        gradDef.center,
    )

    return (
        <ChartContainer
            config={{}}
            initialDimension={{ width: 200, height: 50 }}
            className="-mx-3 -mbe-3 min-w-60 aspect-24/5"
        >
            <BarChart
                className="overflow-visible"
                barSize={20}
                data={chartData}
                layout="vertical"
                margin={{
                    left: 15,
                    right: 15,
                    top: 0,
                    bottom: 0,
                }}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                        {gradient.map((stop) => (
                            <stop
                                key={stop.normalPosition}
                                offset={`${stop.normalPosition * 100}%`}
                                stopColor={stop.color}
                            />
                        ))}
                    </linearGradient>
                </defs>
                <XAxis
                    type="number"
                    domain={[min, max]}
                    interval={0}
                    niceTicks="snap125"
                    tickFormatter={(n) =>
                        (
                            Math.round(parameterMapper.inverse(n) * 100) / 100
                        ).toString()
                    }
                />
                <YAxis type="category" dataKey="name" tickLine={false} hide />
                <Bar
                    isAnimationActive={false}
                    dataKey={(
                        entry: (typeof chartData)[number],
                    ): [number, number] => [entry.min, entry.max]}
                    shape={(props: BarShapeProps) => (
                        <Rectangle {...props} fill={`url(#${gradientId})`} />
                    )}
                />
            </BarChart>
        </ChartContainer>
    )
}
