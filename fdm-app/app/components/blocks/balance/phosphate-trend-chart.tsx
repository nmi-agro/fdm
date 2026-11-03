import type { JSX } from "react"
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Scatter,
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
 * @param boundColor - Colour of the bound lines and the band (default: the colour of the PSD threshold).
 * @param unit - Unit for the tooltip-free labels (e.g. "%").
 * @param min - Lower limit of the indicator (values are clamped).
 * @param max - Upper limit of the indicator (values are clamped).
 * @param measurements - Optional measured values in the past, as years before "nu" (negative) and
 *   value; shown as points, with the time axis extended backwards.
 */
export function PhosphateTrendChart({
  current,
  deltaPerYear,
  bounds,
  band,
  boundColor = "var(--chart-1)",
  unit,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  measurements = [],
}: {
  current: number
  deltaPerYear: number
  bounds: { value: number; label: string }[]
  band?: { from: number; to: number }
  boundColor?: string
  unit: string
  min?: number
  max?: number
  measurements?: { year: number; value: number }[]
}): JSX.Element {
  const data = Array.from({ length: PHOSPHATE_HORIZON_YEARS + 1 }, (_, year) => ({
    year,
    value: Math.min(max, Math.max(min, current + deltaPerYear * year)),
  }))
  const values = [
    ...data.map((d) => d.value),
    ...bounds.map((b) => b.value),
    ...measurements.map((m) => m.value),
  ]
  // Extend the time axis backwards to the oldest measurement (whole 5-year steps)
  const xMin =
    measurements.length > 0 ? Math.floor(Math.min(...measurements.map((m) => m.year)) / 5) * 5 : 0
  const ticks = [
    ...(xMin < 0 ? Array.from({ length: -xMin / 5 }, (_, i) => xMin + i * 5) : []),
    0,
    5,
    10,
    20,
  ]
  const yMin = Math.max(min, Math.floor(Math.min(...values) * 0.8))
  const yMax = Math.ceil(Math.max(...values) * 1.15)

  const chartConfig = {
    value: { label: "Verloop bij dit saldo", color: "var(--chart-2)" },
    measured: { label: "Gemeten", color: "var(--foreground)" },
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
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
            fill={boundColor}
            fillOpacity={0.08}
            ifOverflow="extendDomain"
          />
        ) : null}
        <XAxis
          dataKey="year"
          type="number"
          domain={[xMin, PHOSPHATE_HORIZON_YEARS]}
          ticks={ticks}
          tickFormatter={(year: number) =>
            year === 0 ? "nu" : year > 0 ? `+${year} jr` : `${year} jr`
          }
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
            stroke={boundColor}
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
        {measurements.length > 0 ? (
          <Scatter
            data={measurements.map((m) => ({ year: m.year, value: m.value }))}
            dataKey="value"
            fill="var(--color-measured)"
            isAnimationActive={false}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  )
}
