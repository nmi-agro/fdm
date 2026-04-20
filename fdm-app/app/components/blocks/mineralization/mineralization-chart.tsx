"use client"

import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    XAxis,
    YAxis,
} from "recharts"
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "~/components/ui/chart"
import type {
    NSupplyDataPoint,
    NSupplyMethod,
} from "~/integrations/mineralization.server"

const MONTH_DOYS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mrt",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dec",
]

function doyToMonthLabel(doy: number): string {
    const idx = MONTH_DOYS.findIndex((d, i) => {
        const next = MONTH_DOYS[i + 1] ?? 366
        return doy >= d && doy < next
    })
    return MONTH_LABELS[idx] ?? ""
}

function doyToDate(doy: number, year: number): string {
    const date = new Date(year, 0, 1)
    date.setDate(doy)
    return date.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })
}

function getCurrentDoy(): number {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    return Math.ceil(
        (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1
}

// ─── Single-series chart (farm overview) ─────────────────────────────────────

interface FarmMineralizationChartProps {
    data: NSupplyDataPoint[]
    year?: number
}

const farmChartConfig = {
    d_n_supply_actual: {
        label: "N Levering",
        color: "hsl(142, 71%, 45%)",
    },
} satisfies ChartConfig

export function FarmMineralizationChart({
    data,
    year = new Date().getFullYear(),
}: FarmMineralizationChartProps) {
    const currentDoy = getCurrentDoy()
    const isCurrentYear = year === new Date().getFullYear()

    return (
        <ChartContainer config={farmChartConfig} className="h-[300px] w-full">
            <AreaChart
                data={data}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
                <defs>
                    <linearGradient
                        id="fillNSupply"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="5%"
                            stopColor="var(--color-d_n_supply_actual)"
                            stopOpacity={0.35}
                        />
                        <stop
                            offset="95%"
                            stopColor="var(--color-d_n_supply_actual)"
                            stopOpacity={0.05}
                        />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                    dataKey="doy"
                    type="number"
                    domain={[1, 365]}
                    ticks={MONTH_DOYS}
                    tickFormatter={doyToMonthLabel}
                    tick={{ fontSize: 12 }}
                />
                <YAxis
                    tickFormatter={(v) => `${v}`}
                    tick={{ fontSize: 12 }}
                    width={48}
                    label={{
                        value: "kg N/ha",
                        angle: -90,
                        position: "insideLeft",
                        offset: 12,
                        style: { fontSize: 11 },
                    }}
                />
                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            labelFormatter={(_label, payload) => {
                                const doy = (
                                    payload?.[0]?.payload as {
                                        doy?: number
                                    }
                                )?.doy
                                return doy
                                    ? doyToDate(doy, year)
                                    : _label
                            }}
                            formatter={(value) => [
                                `${Number(value).toFixed(1)} kg N/ha`,
                                "Cumulatief",
                            ]}
                        />
                    }
                />
                {isCurrentYear && (
                    <ReferenceLine
                        x={currentDoy}
                        stroke="hsl(0, 72%, 51%)"
                        strokeWidth={2}
                        isFront
                        label={{
                            value: "Vandaag",
                            position: "insideTopRight",
                            fontSize: 11,
                            fill: "hsl(0, 72%, 51%)",
                        }}
                    />
                )}
                <Area
                    type="monotone"
                    dataKey="d_n_supply_actual"
                    stroke="var(--color-d_n_supply_actual)"
                    strokeWidth={2.5}
                    fill="url(#fillNSupply)"
                    dot={false}
                    activeDot={{ r: 4 }}
                />
            </AreaChart>
        </ChartContainer>
    )
}

// ─── Multi-series chart (field detail, 3 methods overlaid) ───────────────────

interface FieldDataSeries {
    method: NSupplyMethod
    data: NSupplyDataPoint[]
    error?: string
}

interface FieldMineralizationChartProps {
    series: FieldDataSeries[]
    year?: number
}

// Distinct colors + dash patterns so methods are always distinguishable
const METHOD_STYLE: Record<
    NSupplyMethod,
    { color: string; dashArray: string; fillOpacity: number }
> = {
    minip: {
        color: "hsl(142, 71%, 45%)",
        dashArray: "0",
        fillOpacity: 0.15,
    },
    pmn: {
        color: "hsl(221, 83%, 53%)",
        dashArray: "6 3",
        fillOpacity: 0,
    },
    century: {
        color: "hsl(25, 95%, 53%)",
        dashArray: "2 5",
        fillOpacity: 0,
    },
}

const fieldChartConfig = {
    minip: { label: "MINIP", color: METHOD_STYLE.minip.color },
    pmn: { label: "PMN", color: METHOD_STYLE.pmn.color },
    century: { label: "Century", color: METHOD_STYLE.century.color },
} satisfies ChartConfig

// Merge data points from multiple series by DOY
function mergeSeriesData(
    series: FieldDataSeries[],
): Record<string, number | string>[] {
    const map = new Map<number, Record<string, number | string>>()

    for (const s of series) {
        if (s.error) continue
        for (const point of s.data) {
            const existing = map.get(point.doy) ?? { doy: point.doy }
            existing[s.method] = point.d_n_supply_actual
            map.set(point.doy, existing)
        }
    }

    return Array.from(map.values()).sort(
        (a, b) => (a.doy as number) - (b.doy as number),
    )
}

export function FieldMineralizationChart({
    series,
    year = new Date().getFullYear(),
}: FieldMineralizationChartProps) {
    const currentDoy = getCurrentDoy()
    const isCurrentYear = year === new Date().getFullYear()
    const mergedData = mergeSeriesData(series)
    const activeSeries = series.filter((s) => !s.error)

    return (
        <ChartContainer
            config={fieldChartConfig}
            className="h-[350px] w-full"
        >
            <AreaChart
                data={mergedData}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
                <defs>
                    {/* Only MINIP gets a fill gradient */}
                    <linearGradient
                        id="fill-minip"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="5%"
                            stopColor={METHOD_STYLE.minip.color}
                            stopOpacity={0.25}
                        />
                        <stop
                            offset="95%"
                            stopColor={METHOD_STYLE.minip.color}
                            stopOpacity={0}
                        />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                    dataKey="doy"
                    type="number"
                    domain={[1, 365]}
                    ticks={MONTH_DOYS}
                    tickFormatter={doyToMonthLabel}
                    tick={{ fontSize: 12 }}
                />
                <YAxis
                    tickFormatter={(v) => `${v}`}
                    tick={{ fontSize: 12 }}
                    width={48}
                    label={{
                        value: "kg N/ha",
                        angle: -90,
                        position: "insideLeft",
                        offset: 12,
                        style: { fontSize: 11 },
                    }}
                />
                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            labelFormatter={(_label, payload) => {
                                const doy = (
                                    payload?.[0]?.payload as {
                                        doy?: number
                                    }
                                )?.doy
                                return doy
                                    ? doyToDate(doy, year)
                                    : _label
                            }}
                            formatter={(value, name) => [
                                `${Number(value).toFixed(1)} kg N/ha`,
                                fieldChartConfig[name as NSupplyMethod]
                                    ?.label ?? name,
                            ]}
                        />
                    }
                />
                {isCurrentYear && (
                    <ReferenceLine
                        x={currentDoy}
                        stroke="hsl(0, 72%, 51%)"
                        strokeWidth={2}
                        isFront
                        label={{
                            value: "Vandaag",
                            position: "insideTopRight",
                            fontSize: 11,
                            fill: "hsl(0, 72%, 51%)",
                        }}
                    />
                )}
                {activeSeries.map((s) => {
                    const style = METHOD_STYLE[s.method]
                    return (
                        <Area
                            key={s.method}
                            type="monotone"
                            dataKey={s.method}
                            stroke={style.color}
                            strokeWidth={2.5}
                            strokeDasharray={
                                style.dashArray === "0"
                                    ? undefined
                                    : style.dashArray
                            }
                            fill={
                                s.method === "minip"
                                    ? "url(#fill-minip)"
                                    : "transparent"
                            }
                            fillOpacity={style.fillOpacity}
                            dot={false}
                            activeDot={{ r: 4 }}
                            name={s.method}
                        />
                    )
                })}
                <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
        </ChartContainer>
    )
}

// Re-export helper for routes
export { getCurrentDoy }

