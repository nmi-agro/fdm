"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "~/components/ui/chart"
import type { DynaDailyPoint } from "~/integrations/mineralization.server"

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

const leachingChartConfig = {
    b_no3_leach: {
        label: "NO₃ uitspoeling",
        color: "hsl(0, 72%, 51%)",
    },
} satisfies ChartConfig

interface LeachingChartProps {
    data: DynaDailyPoint[]
}

export function LeachingChart({ data }: LeachingChartProps) {
    const monthTicks = getMonthTicks(data)

    const chartData = data.map((d) => ({
        date: d.b_date_calculation,
        b_no3_leach: d.b_no3_leach,
    }))

    return (
        <ChartContainer
            config={leachingChartConfig}
            className="h-[220px] w-full"
        >
            <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
                <defs>
                    <linearGradient
                        id="leachGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="5%"
                            stopColor="var(--color-b_no3_leach)"
                            stopOpacity={0.4}
                        />
                        <stop
                            offset="95%"
                            stopColor="var(--color-b_no3_leach)"
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
                        value: "kg NO₃/ha",
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
                            formatter={(value) => [
                                `${Number(value).toFixed(1)} kg NO₃/ha`,
                                "Uitspoeling",
                            ]}
                        />
                    }
                />
                <Area
                    dataKey="b_no3_leach"
                    stroke="var(--color-b_no3_leach)"
                    strokeWidth={2}
                    fill="url(#leachGradient)"
                    isAnimationActive={false}
                />
            </AreaChart>
        </ChartContainer>
    )
}
