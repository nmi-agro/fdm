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

/** Font size of the labels inside the chart (px): readable next to the 11px axis ticks. */
const LABEL_FONT_SIZE = 11

/**
 * Start of the time axis (years before "nu", whole 5-year steps) for a set of measured points, so
 * charts shown side by side can share one time axis.
 *
 * @param measurements - The measured points.
 * @returns The start of the axis: 0 without points, otherwise the oldest point rounded down to 5.
 */
export function getTrendChartStart(measurements: PhosphateMeasurement[]): number {
  if (measurements.length === 0) return 0
  return Math.floor(Math.min(...measurements.map((m) => m.year)) / 5) * 5
}

/** A round upper limit for the y axis and its ticks (steps of 5, 10 or 20). */
function niceAxis(maxValue: number, minValue: number): { max: number; ticks: number[] } {
  const span = Math.max(maxValue - minValue, 1)
  const step = span <= 25 ? 5 : span <= 60 ? 10 : 20
  const top = Math.ceil(maxValue / step) * step
  const ticks: number[] = []
  for (let tick = minValue; tick <= top; tick += step) ticks.push(tick)
  return { max: top, ticks }
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

/**
 * Illustrative trend of a soil P indicator over the next 20 years if the long-term average balance
 * is repeated every year: a straight line from the current value (with an optional fan for the
 * uncertainty), the target zone ("streefzone") shaded, the bound(s) as horizontal lines and, before
 * "nu", the dated soil analyses as points. Not a prediction: the change per year is uncertain.
 *
 * @param current - Current value.
 * @param deltaPerYear - Change per year at the current balance.
 * @param deltaRange - Optional lowest and highest change per year (uncertainty), shown as a shaded fan.
 * @param bounds - Horizontal reference lines (e.g. the PSD threshold, or P-AL 25).
 * @param band - Optional target zone on the y axis; without `to` it runs to the top of the chart.
 * @param boundColor - Colour of the bound lines (default: the colour of the PSD threshold).
 * @param bandColor - Colour of the target zone (default: green).
 * @param unit - Unit of the values in labels (e.g. " %").
 * @param min - Lower limit of the indicator (values are clamped).
 * @param max - Upper limit of the indicator (values are clamped).
 * @param measurements - Optional soil analyses in the past, as years before "nu" (negative) and
 *   value; shown as points with a tooltip (sampling date, laboratory, value) on hover and focus.
 * @param xMin - Start of the time axis (years before "nu"); pass the same value to charts shown side
 *   by side (see `getTrendChartStart`). Defaults to the start for `measurements`.
 * @param className - Height of the chart (default `h-56`, the same for PSD and P-AL).
 */
export function PhosphateTrendChart({
  current,
  deltaPerYear,
  deltaRange,
  bounds,
  band,
  boundColor = "var(--chart-1)",
  bandColor = "var(--color-green-600)",
  unit,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  measurements = [],
  xMin,
  className = "h-56",
}: {
  current: number
  deltaPerYear: number
  deltaRange?: { min: number; max: number }
  bounds: { value: number; label: string }[]
  band?: { from: number; to?: number; label?: string }
  boundColor?: string
  bandColor?: string
  unit: string
  min?: number
  max?: number
  measurements?: PhosphateMeasurement[]
  xMin?: number
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
  const start = Math.min(xMin ?? 0, getTrendChartStart(measurements))
  const xTicks = [
    ...(start < 0 ? Array.from({ length: -start / 5 }, (_, i) => start + i * 5) : []),
    0,
    5,
    10,
    15,
    20,
  ]
  // Start at the lower limit (0): a zoomed axis makes a slow change look steep
  const yMin = Number.isFinite(min) ? min : Math.floor(Math.min(...values))
  const y = niceAxis(Math.min(max, Math.max(...values) * 1.1), yMin)

  const chartConfig = {
    value: { label: "Verloop bij deze balans", color: "var(--chart-2)" },
    range: { label: "Bereik", color: "var(--chart-2)" },
    measured: { label: "Bodemanalyse", color: "var(--foreground)" },
  } satisfies ChartConfig
  const isHovered = (point: PhosphateMeasurement) =>
    hovered?.point.year === point.year && hovered.point.value === point.value

  return (
    <div className="relative">
      <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", className)}>
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          {band ? (
            <ReferenceArea
              y1={band.from}
              y2={band.to ?? y.max}
              fill={bandColor}
              fillOpacity={0.1}
              ifOverflow="extendDomain"
              label={
                band.label
                  ? {
                      value: band.label,
                      position: "insideBottomRight",
                      fontSize: LABEL_FONT_SIZE,
                      fill: "var(--color-green-800)",
                    }
                  : undefined
              }
            />
          ) : null}
          {start < 0 ? (
            <ReferenceLine
              x={0}
              stroke="var(--border)"
              label={{
                value: "verloop vanaf nu",
                position: "insideTopLeft",
                fontSize: LABEL_FONT_SIZE,
                fill: "var(--muted-foreground)",
              }}
            />
          ) : null}
          <XAxis
            dataKey="year"
            type="number"
            domain={[start, PHOSPHATE_HORIZON_YEARS]}
            ticks={xTicks}
            interval="preserveStartEnd"
            minTickGap={8}
            tickFormatter={(year: number) =>
              year === 0 ? "nu" : year > 0 ? `+${year} jr` : `${year} jr`
            }
            tickLine={false}
            axisLine={false}
            fontSize={LABEL_FONT_SIZE}
          />
          <YAxis
            domain={[yMin, y.max]}
            ticks={y.ticks}
            tickFormatter={(v: number) => formatNumberNl(v)}
            tickLine={false}
            axisLine={false}
            width={36}
            fontSize={LABEL_FONT_SIZE}
          />
          {bounds.map((b) => (
            <ReferenceLine
              key={b.label}
              y={b.value}
              stroke={boundColor}
              strokeDasharray="6 4"
              label={{
                value: `${b.label} ${formatNumberNl(b.value)}${unit}`,
                position: "insideTopLeft",
                fontSize: LABEL_FONT_SIZE,
                fill: "var(--foreground)",
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
                const active = isHovered(point)
                return (
                  <g>
                    {active ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={9}
                        fill="none"
                        stroke="var(--ring)"
                        strokeWidth={2}
                      />
                    ) : null}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={active ? 6 : 4.5}
                      fill="var(--color-measured)"
                      stroke="var(--background)"
                      strokeWidth={1.5}
                      className="cursor-pointer outline-none"
                      tabIndex={0}
                      role="img"
                      aria-label={describeMeasurement(point, unit)}
                      onMouseEnter={show}
                      onMouseLeave={hide}
                      onFocus={show}
                      onBlur={hide}
                      onClick={show}
                    />
                  </g>
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
            // Keep the tooltip inside the chart: the points are on the left (the past)
            left: Math.max(hovered.x, 96),
            top: hovered.y,
            transform: "translate(-50%, calc(-100% - 12px))",
          }}
          role="tooltip"
        >
          {hovered.point.date ? (
            <p className="font-medium">{formatSamplingDate(hovered.point.date)}</p>
          ) : null}
          {hovered.point.source ? (
            <p className="text-muted-foreground">{hovered.point.source}</p>
          ) : null}
          <p className="mt-1 font-medium tabular-nums">
            {formatNumberNl(hovered.point.value)}
            {unit}
          </p>
        </div>
      ) : null}
    </div>
  )
}
