import type { JSX } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { type ChartConfig, ChartContainer } from "~/components/ui/chart"
import { formatNumberNl, PHOSPHATE_HORIZON_YEARS } from "./phosphate-format"

/** Year classes shown as bands on the time axis (the uncertainty does not allow single years). */
const YEAR_CLASSES = [
  { from: 0, to: 5, label: "< 5 jaar" },
  { from: 5, to: 10, label: "5–10" },
  { from: 10, to: 20, label: "10–20" },
]

/**
 * Illustrative trend of a soil P indicator over the next 20 years if the balance of this year is
 * repeated every year: a straight line from the current value, with the bound(s) as horizontal
 * lines and the year classes as bands. Not a prediction: the change per year is uncertain.
 *
 * @param current - Current value.
 * @param deltaPerYear - Change per year at the current balance.
 * @param bounds - Horizontal reference lines (e.g. the PSD threshold, or P-AL 25 and 45).
 * @param band - Optional shaded range on the y axis (e.g. the P-AL target level 25–45).
 * @param unit - Unit for the tooltip-free labels (e.g. "%").
 * @param min - Lower limit of the indicator (values are clamped).
 * @param max - Upper limit of the indicator (values are clamped).
 */
export function PhosphateTrendChart({
  current,
  deltaPerYear,
  bounds,
  band,
  unit,
  min = 0,
  max = Number.POSITIVE_INFINITY,
}: {
  current: number
  deltaPerYear: number
  bounds: { value: number; label: string }[]
  band?: { from: number; to: number }
  unit: string
  min?: number
  max?: number
}): JSX.Element {
  const data = Array.from({ length: PHOSPHATE_HORIZON_YEARS + 1 }, (_, year) => ({
    year,
    value: Math.min(max, Math.max(min, current + deltaPerYear * year)),
  }))
  const values = [...data.map((d) => d.value), ...bounds.map((b) => b.value)]
  const yMin = Math.max(min, Math.floor(Math.min(...values) * 0.8))
  const yMax = Math.ceil(Math.max(...values) * 1.15)

  const chartConfig = {
    value: { label: "Verloop bij dit saldo", color: "var(--chart-2)" },
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
      <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        {YEAR_CLASSES.map((yc, i) => (
          <ReferenceArea
            key={yc.label}
            x1={yc.from}
            x2={yc.to}
            fill="var(--color-muted-foreground)"
            fillOpacity={i % 2 === 0 ? 0.06 : 0.12}
            label={{ value: yc.label, position: "insideTop", fontSize: 10 }}
          />
        ))}
        {band ? (
          <ReferenceArea
            y1={band.from}
            y2={band.to}
            fill="var(--chart-2)"
            fillOpacity={0.08}
            ifOverflow="extendDomain"
          />
        ) : null}
        <XAxis
          dataKey="year"
          type="number"
          domain={[0, PHOSPHATE_HORIZON_YEARS]}
          ticks={[0, 5, 10, 20]}
          tickFormatter={(year: number) => (year === 0 ? "nu" : `+${year} jr`)}
          tickLine={false}
          axisLine={false}
          fontSize={11}
        />
        <YAxis
          domain={[yMin, yMax]}
          tickFormatter={(v: number) => formatNumberNl(v)}
          tickLine={false}
          axisLine={false}
          width={36}
          fontSize={11}
        />
        {bounds.map((b) => (
          <ReferenceLine
            key={b.label}
            y={b.value}
            stroke="var(--chart-1)"
            strokeDasharray="6 4"
            label={{
              value: `${b.label} ${formatNumberNl(b.value)}${unit}`,
              position: "insideBottomRight",
              fontSize: 10,
            }}
          />
        ))}
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
