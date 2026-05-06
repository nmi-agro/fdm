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
import { Card, CardContent } from "~/components/ui/card"
import { ChartContainer } from "~/components/ui/chart"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import {
    GRADIENT_DEFINITIONS,
    GRADIENT_SHADED_SOIL_PARAMETERS,
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
    setSelectedParameter: (parameter: ShadedSoilParameters) => void
    soilParametersDescriptions: SoilParameterDescription
    min?: number
    max?: number
}

export function SoilAnalysisLegend(props: SoilAnalysisLegendProps) {
    const {
        fieldsData,
        selectedParameter,
        setSelectedParameter,
        soilParametersDescriptions,
    } = props

    // Parameter shading config
    const shadingConfig = Object.fromEntries(
        getShadedSoilParameters().map((item) => [item.parameter, item]),
    )

    // Parameter description
    const soilParameterOptions = soilParametersDescriptions.filter(
        (item) => item.parameter in shadingConfig,
    )
    const parameterDescription = soilParametersDescriptions.find(
        (opt) => opt.parameter === selectedParameter,
    )

    const anyDataAvailable = fieldsData?.features.some(
        (feature) =>
            feature.properties && selectedParameter in feature.properties,
    )

    return (
        <Card className="p-4 space-y-4">
            <Select
                value={selectedParameter}
                onValueChange={(val) =>
                    setSelectedParameter(val as ShadedSoilParameters)
                }
            >
                <SelectTrigger className="bg-white hover:bg-gray-100!">
                    {parameterDescription?.name}
                </SelectTrigger>
                <SelectContent>
                    {soilParameterOptions.map((opt) => {
                        return (
                            <SelectItem
                                key={opt.parameter}
                                value={opt.parameter}
                            >
                                <div>
                                    <div className="font-medium">
                                        {opt.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {opt.description}
                                    </div>
                                </div>
                            </SelectItem>
                        )
                    })}
                </SelectContent>
            </Select>
            {shadingConfig[selectedParameter].shading === "enum" ? (
                <EnumSoilAnalysisLegend {...props} />
            ) : (
                <GradientSoilAnalysisLegend
                    {...props}
                    selectedParameter={selectedParameter}
                />
            )}
            {fieldsData && !anyDataAvailable && (
                <p className="flex flex-row items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-orange-500" />
                    Geen data op hele bedrijf
                </p>
            )}
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
                                className="size-3"
                                style={{ backgroundColor: opt.fill }}
                            />
                        </td>
                        <td className="align-middle">{opt.label}</td>
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
    const gradDef =
        GRADIENT_DEFINITIONS[
            GRADIENT_SHADED_SOIL_PARAMETERS[
                props.selectedParameter as keyof typeof GRADIENT_SHADED_SOIL_PARAMETERS
            ]
        ]
    const parameterMapper = getShadingParameterMapper(props.selectedParameter)

    let min = props.min as number
    let max = props.max as number
    if (typeof gradDef.center === "number") {
        const radius = Math.max(max - gradDef.center, gradDef.center - min)
        min = gradDef.center - radius
        max = gradDef.center + radius
    }

    const chartData = [{ name: "Legenda", min: min, max: max }]
    const gradient = gradDef.gradient

    const gradientId = useId()

    const gradientSvg: React.ReactNode[] = []
    for (let i = 0; i < gradient.length; i += 2) {
        gradientSvg.push(
            <stop
                key={i}
                offset={`${100 * (gradient[i] as number)}%`}
                stopColor={gradient[i + 1] as string}
            />,
        )
    }
    return (
        <ChartContainer
            config={{}}
            initialDimension={{ width: 100, height: 55 }}
            className="-mx-3"
        >
            <BarChart
                className="overflow-visible"
                data={chartData}
                layout="vertical"
                margin={{ left: 15, right: 15, top: 0, bottom: 0 }}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                        {gradientSvg}
                    </linearGradient>
                </defs>
                <XAxis
                    type="number"
                    domain={[min, max]}
                    niceTicks="snap125"
                    tickFormatter={(n) =>
                        (
                            Math.round(parameterMapper.inverse(n) * 100) / 100
                        ).toString()
                    }
                />
                <YAxis type="category" tickLine={false} hide />
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
