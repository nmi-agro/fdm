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

/**
 * Bar chart of the phosphate supply and removal (kg P₂O₅ / ha), following the organic matter chart.
 *
 * @param supply - Total supply (positive).
 * @param removal - Total removal (negative, shown as a positive bar).
 */
export function PhosphateBalanceChart({
  supply,
  removal,
}: {
  supply: number
  removal: number
}): JSX.Element {
  const chartData = [
    {
      name: "Balans",
      supply: Math.round(supply),
      removal: Math.round(removal * -1),
    },
  ]

  const chartConfig = {
    supply: {
      label: "Aanvoer",
      color: "var(--color-chart-2)",
    },
    removal: {
      label: "Afvoer",
      color: "var(--color-chart-1)",
    },
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig}>
      <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: -20 }}>
        <XAxis type="number" />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={() => ""}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="supply" fill="var(--color-supply)" radius={5} />
        <Bar dataKey="removal" fill="var(--color-removal)" radius={5} />
      </BarChart>
    </ChartContainer>
  )
}
