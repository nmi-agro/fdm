"use client"

import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
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
    DynaDailyPoint,
    DynaFertilizerAdvice,
} from "~/integrations/mineralisatie.server"

const MONTH_LABELS_NL = [
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

function formatDateTick(dateStr: string): string {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return MONTH_LABELS_NL[d.getMonth()] ?? dateStr
}

function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })
}

function getMonthTicks(data: DynaDailyPoint[]): string[] {
    const seen = new Set<string>()
    return data
        .filter((d) => {
            const month = d.b_date_calculation.slice(0, 7)
            if (seen.has(month)) return false
            seen.add(month)
            return true
        })
        .map((d) => d.b_date_calculation)
}

const dynaChartConfig = {
    band: {
        label: "Bandbreedte",
        color: "hsl(var(--chart-1))",
    },
    b_nw: {
        label: "N beschikbaar",
        color: "hsl(var(--chart-1))",
    },
    b_n_uptake: {
        label: "N opname",
        color: "hsl(var(--chart-2))",
    },
    b_nw_recommended: {
        label: "N advies",
        color: "hsl(var(--chart-3))",
    },
} satisfies ChartConfig

export interface DynaChartEvent {
    date: string
    type: "sowing" | "harvest" | "fertilizer"
    label: string
}

const EVENT_COLORS: Record<DynaChartEvent["type"], string> = {
    sowing: "hsl(142, 71%, 45%)",
    harvest: "hsl(38, 92%, 50%)",
    fertilizer: "hsl(217, 91%, 60%)",
}

const EVENT_ABBR: Record<DynaChartEvent["type"], string> = {
    sowing: "Z",
    harvest: "O",
    fertilizer: "M",
}

interface EventLabelProps {
    viewBox?: { x?: number; y?: number; height?: number }
    event: DynaChartEvent
    stackIndex: number
}

function EventLabel({ viewBox, event, stackIndex }: EventLabelProps) {
    if (!viewBox?.x || viewBox.y === undefined) return null
    const x = viewBox.x
    // Stack labels vertically: 4px from top + 14px per stacked slot
    const y = (viewBox.y ?? 0) + 10 + stackIndex * 14
    return (
        <text
            x={x}
            y={y}
            fill={EVENT_COLORS[event.type]}
            fontSize={10}
            fontWeight="bold"
            textAnchor="middle"
        >
            {EVENT_ABBR[event.type]}
        </text>
    )
}

interface DynaChartProps {
    data: DynaDailyPoint[]
    fertilizingRecommendations: DynaFertilizerAdvice | null
    events?: DynaChartEvent[]
}

export function DynaChart({
    data,
    fertilizingRecommendations,
    events = [],
}: DynaChartProps) {
    const monthTicks = getMonthTicks(data)
    const today = new Date().toISOString().split("T")[0] ?? ""

    const recDate = fertilizingRecommendations?.b_date_recommended

    // Count how many events share the same date, for stacking labels
    const dateCounts = new Map<string, number>()
    const eventsWithStack = events.map((ev) => {
        const count = dateCounts.get(ev.date) ?? 0
        dateCounts.set(ev.date, count + 1)
        return { ...ev, stackIndex: count }
    })

    const chartData = data.map((d) => ({
        date: d.b_date_calculation,
        b_nw: d.b_nw,
        b_nw_min: d.b_nw_min,
        b_nw_max: d.b_nw_max,
        b_nw_recommended: d.b_nw_recommended,
        b_n_uptake: d.b_n_uptake,
    }))

    return (
        <ChartContainer config={dynaChartConfig} className="h-[400px] w-full">
            <ComposedChart
                data={chartData}
                margin={{ top: 56, right: 8, left: 0, bottom: 0 }}
            >
                <defs>
                    <linearGradient
                        id="bandGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="5%"
                            stopColor="var(--color-b_nw)"
                            stopOpacity={0.2}
                        />
                        <stop
                            offset="95%"
                            stopColor="var(--color-b_nw)"
                            stopOpacity={0.05}
                        />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                    dataKey="date"
                    ticks={monthTicks}
                    tickFormatter={formatDateTick}
                    tick={{ fontSize: 12 }}
                />
                <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                        value: "kg N/ha",
                        angle: -90,
                        position: "insideLeft",
                        offset: 10,
                        style: { fontSize: 11 },
                    }}
                />
                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            labelFormatter={(label, payload) => {
                                const raw = payload?.[0]?.payload?.date ?? label
                                return formatDateLabel(raw)
                            }}
                        />
                    }
                />
                <ChartLegend content={<ChartLegendContent />} />

                {/* Min-max band */}
                <Area
                    dataKey="b_nw_max"
                    stroke="none"
                    fill="url(#bandGradient)"
                    isAnimationActive={false}
                    legendType="none"
                    name="b_nw_max"
                />
                <Area
                    dataKey="b_nw_min"
                    stroke="none"
                    fill="white"
                    isAnimationActive={false}
                    legendType="none"
                    name="b_nw_min"
                />

                {/* N availability line */}
                <Line
                    dataKey="b_nw"
                    stroke="var(--color-b_nw)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="b_nw"
                />

                {/* N uptake line */}
                <Line
                    dataKey="b_n_uptake"
                    stroke="var(--color-b_n_uptake)"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 3"
                    isAnimationActive={false}
                    name="b_n_uptake"
                />

                {/* Recommended N line */}
                <Line
                    dataKey="b_nw_recommended"
                    stroke="var(--color-b_nw_recommended)"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="3 3"
                    isAnimationActive={false}
                    name="b_nw_recommended"
                />

                {/* Today reference line */}
                <ReferenceLine
                    x={today}
                    stroke="hsl(var(--foreground))"
                    strokeDasharray="4 2"
                    label={{
                        value: "Vandaag",
                        position: "insideTopRight",
                        fontSize: 11,
                    }}
                />

                {/* Fertilizer recommendation date */}
                {recDate && (
                    <ReferenceLine
                        x={recDate}
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        label={{
                            value: `Advies: ${fertilizingRecommendations?.b_n_recommended?.toFixed(0)} kg N`,
                            position: "insideTopLeft",
                            fontSize: 11,
                        }}
                    />
                )}

                {/* Field events: sowing (Z), harvest (O), fertilizer (M)
                    Labels are stacked vertically per date to avoid overlap */}
                {eventsWithStack.map((ev, idx) => (
                    <ReferenceLine
                        // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
                        key={idx}
                        x={ev.date}
                        stroke={EVENT_COLORS[ev.type]}
                        strokeDasharray="4 3"
                        label={(props) => (
                            <EventLabel
                                viewBox={props.viewBox}
                                event={ev}
                                stackIndex={ev.stackIndex}
                            />
                        )}
                    />
                ))}
            </ComposedChart>
        </ChartContainer>
    )
}
