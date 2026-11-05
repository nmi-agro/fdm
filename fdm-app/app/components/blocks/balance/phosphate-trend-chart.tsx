import { type JSX, useState } from "react"
import {
  Area,
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
import { cn } from "~/lib/utils"
import { formatNumberNl, PHOSPHATE_HORIZON_YEARS } from "./phosphate-format"

/** A dated soil analysis shown as a point in the chart. */
export type PhosphateMeasurement = {
  /** Years before "nu" (negative) */
  year: number
  value: number
  /** Sampling date */
  date?: Date
  /** Laboratory (or source) of the analysis */
  source?: string
}

/** Year classes shown as bands on the time axis (the uncertainty does not allow single years). */
const YEAR_CLASSES = [
  { from: 0, to: 5, label: "< 5 jaar" },
  { from: 5, to: 10, label: "5–10" },
  { from: 10, to: 20, label: "10–20" },
]

/**
 * Illustrative trend of a soil P indicator over the next 20 years if the long-term average balance
 * is repeated every year: a straight line from the current value (with an optional fan for the
 * uncertainty), the target zone shaded, the bound(s) as horizontal lines and the year classes as
 * bands. Not a prediction: the change per year is uncertain.
 *
 * @param current - Current value.
 * @param deltaPerYear - Change per year at the current balance.
 * @param deltaRange - Optional lowest and highest change per year (uncertainty), shown as a shaded fan.
 * @param bounds - Horizontal reference lines (e.g. the PSD threshold, or P-AL 25 and 45).
 * @param band - Optional shaded range on the y axis: the target zone (e.g. P-AL 25–45, or PSD below
 *   the threshold).
 * @param boundColor - Colour of the bound lines (default: the colour of the PSD threshold).
 * @param bandColor - Colour of the band (default: `boundColor`), e.g. green for the safe side of a
 *   threshold.
 * @param unit - Unit for the tooltip-free labels (e.g. "%").
 * @param min - Lower limit of the indicator (values are clamped).
 * @param max - Upper limit of the indicator (values are clamped).
 * @param measurements - Optional soil analyses in the past, as years before "nu" (negative) and
 *   value; shown as points (with a tooltip of sampling date and laboratory), with the time axis
 *   extended backwards.
 * @param className - Height of the chart (default `h-56`, the same for PSD and P-AL so they can be compared).
 */
export function PhosphateTrendChart({
  current,
  deltaPerYear,
  deltaRange,
  bounds,
  band,
  boundColor = "var(--chart-1)",
  bandColor,
  unit,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  measurements = [],
  className = "h-56",
}: {
  current: number
  deltaPerYear: number
  deltaRange?: { min: number; max: number }
  bounds: { value: number; label: string }[]
  band?: { from: number; to: number; label?: string }
  boundColor?: string
  bandColor?: string
  unit: string
  min?: number
  max?: number
  measurements?: PhosphateMeasurement[]
  className?: string
}): JSX.Element {
  // Recharts' ComposedChart only has axis tooltips (they snap to the trend line), so the measured
  // points get their own tooltip on hover and keyboard focus
  const [hovered, setHovered] = useState<{
    x: number
    y: number
    point: PhosphateMeasurement
  } | null>(null)
  const clamp = (value: number) => Math.min(max, Math.max(min, value))
  const data = Array.from({ length: PHOSPHATE_HORIZON_YEARS + 1 }, (_, year) => ({
    year,
    value: clamp(current + deltaPerYear * year),
    range: deltaRange
      ? [clamp(current + deltaRange.min * year), clamp(current + deltaRange.max * year)].sort(
          (a, b) => a - b,
        )
      : undefined,
  }))
  const values = [
    ...data.flatMap((d) => [d.value, ...(d.range ?? [])]),
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
  // Start at the lower limit (0): a zoomed axis makes a slow change look steep
  const yMin = Number.isFinite(min) ? min : Math.floor(Math.min(...values) * 0.8)
  const yMax = Math.ceil(Math.max(...values) * 1.15)

  const chartConfig = {
    value: { label: "Verloop bij dit saldo", color: "var(--chart-2)" },
    range: { label: "Bereik", color: "var(--chart-2)" },
    measured: { label: "Gemeten", color: "var(--foreground)" },
  } satisfies ChartConfig

  return (
    <div className="relative">
      <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", className)}>
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
              fill={bandColor ?? boundColor}
              fillOpacity={bandColor ? 0.12 : 0.08}
              ifOverflow="extendDomain"
              label={
                band.label
                  ? { value: band.label, position: "insideBottomLeft", fontSize: 10 }
                  : undefined
              }
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
          {deltaRange ? (
            <Area
              dataKey="range"
              type="linear"
              stroke="none"
              fill="var(--color-range)"
              fillOpacity={0.15}
              activeDot={false}
              isAnimationActive={false}
            />
          ) : null}
          <Line
            dataKey="value"
            type="linear"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          {measurements.length > 0 ? (
            <Scatter
              data={measurements.map((m) => ({ ...m }))}
              dataKey="value"
              fill="var(--color-measured)"
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number; payload?: PhosphateMeasurement }) => {
                const { cx, cy, payload: point } = props
                if (cx === undefined || cy === undefined || !point) return <g />
                const show = () => setHovered({ x: cx, y: cy, point })
                const hide = () => setHovered(null)
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={
                      hovered?.point.year === point.year && hovered.point.value === point.value
                        ? 6
                        : 4.5
                    }
                    fill="var(--color-measured)"
                    stroke="var(--background)"
                    strokeWidth={1.5}
                    className="cursor-pointer outline-none"
                    tabIndex={0}
                    aria-label={describeMeasurement(point, unit)}
                    onMouseEnter={show}
                    onMouseLeave={hide}
                    onFocus={show}
                    onBlur={hide}
                  />
                )
              }}
            />
          ) : null}
        </ComposedChart>
      </ChartContainer>
      {hovered ? (
        <div
          className="bg-background pointer-events-none absolute z-10 rounded-md border px-3 py-2 text-xs whitespace-nowrap shadow-md"
          style={{
            left: hovered.x,
            top: hovered.y,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
          role="tooltip"
        >
          {hovered.point.date ? (
            <p className="font-medium">{formatSamplingDate(hovered.point.date)}</p>
          ) : null}
          {hovered.point.source ? (
            <p className="text-muted-foreground">{hovered.point.source}</p>
          ) : null}
          <p className="mt-1 font-medium">
            {formatNumberNl(hovered.point.value)}
            {unit}
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** Sampling date as "12 maart 2023". */
function formatSamplingDate(date: Date): string {
  return new Date(date).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** Accessible description of a measured point, e.g. "Bodemanalyse 12 maart 2023, Eurofins: 37". */
function describeMeasurement(point: PhosphateMeasurement, unit: string): string {
  const date = point.date ? ` ${formatSamplingDate(point.date)}` : ""
  const source = point.source ? `, ${point.source}` : ""
  return `Bodemanalyse${date}${source}: ${formatNumberNl(point.value)}${unit}`
}
