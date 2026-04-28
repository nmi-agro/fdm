import type { JSX } from "react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "~/components/ui/chart"

export function OrganicMatterBalanceChart({
    supply,
    degradation,
}: {
    supply: number
    degradation: number
}): JSX.Element {
    const chartData = [
        {
            name: "Balans",
            supply: supply,
            degradation: degradation * -1,
        },
    ]

    const chartConfig = {
        supply: {
            label: "Aanvoer",
            color: "var(--color-chart-2)",
        },
        degradation: {
            label: "Afbraak",
            color: "var(--color-chart-1)",
        },
    } satisfies ChartConfig

    return (
        <ChartContainer config={chartConfig}>
            <BarChart
                accessibilityLayer
                data={chartData}
                layout="vertical"
                margin={{ left: -20 }}
            >
                <XAxis type="number" />
                <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={() => ""}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="supply" fill="var(--color-supply)" radius={5} />
                <Bar
                    dataKey="degradation"
                    fill="var(--color-degradation)"
                    radius={5}
                />
            </BarChart>
        </ChartContainer>
    )
}
