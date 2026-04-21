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
import { useState } from "react"
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
} from "~/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import type {
    DynaDailyPoint,
    DynaFertilizerAdvice,
} from "~/integrations/mineralization.server"

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
        color: "hsl(var(--chart-2))",
    },
    b_nw: {
        label: "N aanbod",
        color: "hsl(var(--chart-2))",
    },
    b_n_uptake: {
        label: "N opname",
        color: "hsl(var(--chart-1))",
    },
    b_nw_difference: {
        label: "N beschikbaar",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig

export interface DynaChartEvent {
    date: string
    type: "sowing" | "harvest" | "fertilizer"
    label: string
}

export const EVENT_COLORS: Record<DynaChartEvent["type"], string> = {
    sowing: "hsl(142, 71%, 45%)",
    harvest: "hsl(38, 92%, 50%)",
    fertilizer: "hsl(217, 91%, 60%)",
}

export function groupEventsByDate(
    events: DynaChartEvent[],
): Map<string, DynaChartEvent[]> {
    const map = new Map<string, DynaChartEvent[]>()
    for (const ev of events) {
        const arr = map.get(ev.date) ?? []
        arr.push(ev)
        map.set(ev.date, arr)
    }
    return map
}

interface EventDotProps {
    viewBox?: { x?: number; y?: number }
    events: DynaChartEvent[]
}

export function EventDot({ viewBox, events }: EventDotProps) {
    if (viewBox?.x === undefined || viewBox.y === undefined) return null
    if (!events || events.length === 0) return null

    const x = viewBox.x
    const y = (viewBox.y ?? 0) + 10
    const color = EVENT_COLORS[events[0].type] ?? "hsl(var(--chart-1))"
    return (
        <circle
            cx={x}
            cy={y}
            r={5}
            fill={color}
            fillOpacity={0.9}
            stroke="white"
            strokeWidth={1.5}
        />
    )
}

type DynaChartPoint = {
    date: string
    b_nw: number
    b_nw_min: number
    b_nw_max: number
    b_nw_recommended: number | null
    b_n_uptake: number | null
    b_nw_difference?: number
    _events?: DynaChartEvent[]
}

const SERIES_TO_SHOW = ["b_nw", "b_n_uptake"] as const

function DynaTooltipContent({
    active,
    payload,
    isBalance = false,
}: {
    active?: boolean
    payload?: Array<{
        dataKey: string
        value: number
        color?: string
        payload: DynaChartPoint
    }>
    isBalance?: boolean
}) {
    if (!active || !payload?.length) return null
    const point = payload[0]?.payload
    if (!point) return null

    // For balance tab, only show difference; for normal tab, show both supply and uptake
    const visibleEntries = isBalance
        ? payload.filter((p) => p.dataKey === "b_nw_difference")
        : payload.filter((p) =>
            SERIES_TO_SHOW.includes(p.dataKey as (typeof SERIES_TO_SHOW)[number]),
        )

    return (
        <div className="grid min-w-40 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
            <div className="font-medium">{formatDateLabel(point.date)}</div>
            <div className="grid gap-1.5">
                {visibleEntries.map((entry) => (
                    <div
                        key={entry.dataKey}
                        className="flex items-center gap-1.5"
                    >
                        <div
                            className="shrink-0 rounded-[2px] h-2.5 w-2.5"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">
                            {dynaChartConfig[
                                entry.dataKey as keyof typeof dynaChartConfig
                            ]?.label ?? entry.dataKey}
                        </span>
                        <span className="ml-auto font-medium tabular-nums">
                            {Math.round(entry.value)}{" "}
                            <span className="text-muted-foreground font-normal">
                                kg N/ha
                            </span>
                        </span>
                    </div>
                ))}
            </div>
            {point._events && point._events.length > 0 && (
                <div className="border-t border-border/50 pt-1.5 grid gap-1">
                    {point._events.map((ev, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
                        <div key={i} className="flex items-center gap-1.5">
                            <div
                                className="shrink-0 rounded-full h-2.5 w-2.5"
                                style={{
                                    backgroundColor: EVENT_COLORS[ev.type],
                                }}
                            />
                            <span className="text-muted-foreground">
                                {ev.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

interface DynaChartProps {
    data: DynaDailyPoint[]
    fertilizingRecommendations?: DynaFertilizerAdvice | null
    events?: DynaChartEvent[]
    year?: number
}

export function DynaChart({
    data,
    fertilizingRecommendations,
    events = [],
    year = new Date().getFullYear(),
}: DynaChartProps) {
    const [activeTab, setActiveTab] = useState("dynamics")
    const monthTicks = getMonthTicks(data)
    const today = new Date().toLocaleDateString("en-CA")
    const isCurrentYear = year === new Date().getFullYear()

    // Group events by date and only include dates present in the data
    const eventsByDate = groupEventsByDate(events)
    const chartDates = new Set(data.map((d) => d.b_date_calculation))
    const uniqueEventDates = Array.from(eventsByDate.entries()).filter(
        ([date]) => chartDates.has(date),
    )

    const chartData: DynaChartPoint[] = data.map((d) => ({
        date: d.b_date_calculation,
        b_nw: d.b_nw,
        b_nw_min: d.b_nw_min,
        b_nw_max: d.b_nw_max,
        b_nw_recommended: d.b_nw_recommended,
        b_n_uptake: d.b_n_uptake,
        b_no3_leach: d.b_no3_leach,
        _events: eventsByDate.get(d.b_date_calculation),
    }))

    // Calculate available N (N aanbod - N opname - N uitspoeling)
    const chartDataWithDifference = chartData.map((d) => ({
        ...d,
        b_nw_difference:
            d.b_n_uptake !== null && d.b_n_uptake !== undefined
                ? d.b_nw - d.b_n_uptake - d.b_no3_leach
                : null,
    }))

    return (
        <div className="space-y-4">
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
            >
                <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="dynamics">N aanbod & opname</TabsTrigger>
                    <TabsTrigger value="balance">N beschikbaar</TabsTrigger>
                </TabsList>

                {/* Tab 1: N aanbod en opname — N aanbod and N opname lines */}
                <TabsContent value="dynamics" className="mt-4">
                    <ChartContainer
                        config={dynaChartConfig}
                        className="h-[400px] w-full"
                    >
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
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
                            <CartesianGrid
                                strokeDasharray="3 3"
                                className="stroke-muted"
                            />
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
                                content={<DynaTooltipContent />}
                            />
                            <ChartLegend
                                content={<ChartLegendContent />}
                            />

                            {/* Min-max band — only for current year */}
                            {isCurrentYear && (
                                <>
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
                                </>
                            )}

                            {/* N aanbod — line only (no area) */}
                            <Line
                                dataKey="b_nw"
                                stroke="var(--color-b_nw)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 3 }}
                                isAnimationActive={false}
                                name="b_nw"
                            />

                            {/* N opname — dashed line for distinction */}
                            <Line
                                dataKey="b_n_uptake"
                                stroke="var(--color-b_n_uptake)"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="5 3"
                                isAnimationActive={false}
                                name="b_n_uptake"
                            />

                            {/* Today reference line — only for current year */}
                            {isCurrentYear && (
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
                            )}

                            {/* Fertilizing Recommendation */}
                            {fertilizingRecommendations?.b_date_recommended && (
                                <ReferenceLine
                                    x={fertilizingRecommendations.b_date_recommended}
                                    stroke="hsl(var(--destructive))"
                                    strokeDasharray="3 3"
                                    label={{
                                        value: "Advies",
                                        position: "insideTopLeft",
                                        fontSize: 11,
                                        fill: "hsl(var(--destructive))",
                                    }}
                                />
                            )}

                            {/* Field events — info dot at top of each vertical line.
                                Events grouped by date; tooltip shows all events for that day. */}
                            {uniqueEventDates.map(([date, evs]) => (
                                <ReferenceLine
                                    key={date}
                                    x={date}
                                    stroke={EVENT_COLORS[evs[0].type]}
                                    strokeDasharray="4 3"
                                    label={(props) => (
                                        <EventDot
                                            viewBox={props.viewBox}
                                            events={evs}
                                        />
                                    )}
                                />
                            ))}
                        </ComposedChart>
                    </ChartContainer>
                </TabsContent>

                {/* Tab 2: N beschikbaar — area chart showing difference */}
                <TabsContent value="balance" className="mt-4">
                    <ChartContainer
                        config={dynaChartConfig}
                        className="h-[400px] w-full"
                    >
                        <ComposedChart
                            data={chartDataWithDifference}
                            margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient
                                    id="differenceGradient"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--color-b_nw_difference)"
                                        stopOpacity={0.3}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--color-b_nw_difference)"
                                        stopOpacity={0.05}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                className="stroke-muted"
                            />
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
                                content={<DynaTooltipContent isBalance />}
                            />
                            <ChartLegend
                                content={<ChartLegendContent />}
                            />

                            {/* Surplus/deficit as area */}
                            <Area
                                dataKey="b_nw_difference"
                                stroke="var(--color-b_nw_difference)"
                                strokeWidth={2}
                                fill="url(#differenceGradient)"
                                dot={false}
                                activeDot={{ r: 3 }}
                                isAnimationActive={false}
                                name="b_nw_difference"
                            />

                            {/* Today reference line */}
                            {isCurrentYear && (
                                <ReferenceLine
                                    x={today}
                                    stroke="hsl(var(--foreground))"
                                    strokeDasharray="4 2"
                                    label={{
                                        value: "Verwachting",
                                        position: "insideTopRight",
                                        fontSize: 11,
                                    }}
                                />
                            )}

                            {/* Zero line for reference */}
                            <ReferenceLine
                                y={0}
                                stroke="hsl(var(--foreground))"
                                strokeOpacity={0.5}
                                strokeDasharray="2 2"
                            />

                            {/* Field events */}
                            {uniqueEventDates.map(([date, evs]) => (
                                <ReferenceLine
                                    key={date}
                                    x={date}
                                    stroke={EVENT_COLORS[evs[0].type]}
                                    strokeDasharray="4 3"
                                    label={(props) => (
                                        <EventDot
                                            viewBox={props.viewBox}
                                            events={evs}
                                        />
                                    )}
                                />
                            ))}
                        </ComposedChart>
                    </ChartContainer>
                </TabsContent>
            </Tabs>
        </div>
    )
}
