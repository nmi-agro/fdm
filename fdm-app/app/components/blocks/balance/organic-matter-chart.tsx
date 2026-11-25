import type { JSX } from "react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "~/components/ui/chart"
import { formatBalanceValue } from "~/lib/format"
import {
  BALANCE_AXIS_WIDTH,
  BALANCE_BAR_GAP,
  BalanceChartTooltip,
  BalanceRowTick,
  toBalanceRows,
} from "./balance-chart-parts"

export function OrganicMatterBalanceChart({
  supply,
  degradation,
}: {
  supply: number
  degradation: number
}): JSX.Element {
  // One row for the supply and one for the degradation
  const chartData = toBalanceRows(
    { supply: supply, degradation: degradation * -1 },
    ["supply"],
    ["degradation"],
  )

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
        barCategoryGap={BALANCE_BAR_GAP}
      >
        <XAxis type="number" />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          axisLine={false}
          width={BALANCE_AXIS_WIDTH}
          tick={<BalanceRowTick labels={{ supply: ["Aanvoer"], removal: ["Afbraak"] }} />}
        />
        <ChartTooltip
          cursor={false}
          shared={false}
          content={({ payload }) => {
            const item = payload?.find((p) => p && p.type !== "none")
            const key = item?.dataKey as keyof typeof chartConfig | undefined
            if (!key || !(key in chartConfig) || typeof item?.value !== "number") return null
            return (
              <BalanceChartTooltip
                color={chartConfig[key].color}
                title={chartConfig[key].label}
                value={formatBalanceValue(item.value)}
                unit="kg EOM / ha"
              />
            )
          }}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="supply" stackId="balance" fill="var(--color-supply)" radius={5} />
        <Bar dataKey="degradation" stackId="balance" fill="var(--color-degradation)" radius={5} />
      </BarChart>
    </ChartContainer>
  )
}
