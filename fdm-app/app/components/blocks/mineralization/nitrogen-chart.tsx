import type {
  DynaV2DailyPoint,
  MineralizationEvent,
  SeasonPhase,
  WeatherForecastDay,
} from "@nmi-agro/fdm-calculator"
import { ChevronDown, CloudRain, type LucideIcon, Shovel, Sprout, Wheat } from "lucide-react"
import { useState } from "react"
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { FertilizerIcon } from "~/components/custom/fertilizer-icon"
import { Button } from "~/components/ui/button"
import { type ChartConfig, ChartContainer } from "~/components/ui/chart"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import {
  addDays,
  formatKgN,
  formatLongDate,
  formatNumber,
  formatShortDate,
} from "~/lib/mineralization"
import { cn } from "~/lib/utils"

const DAY_MS = 24 * 60 * 60 * 1000
const Y_AXIS_WIDTH = 56
const MARGIN = { top: 16, right: 16, left: 0, bottom: 0 }
/** Days before and after today shown during the growing season. */
const IN_SEASON_DAYS_BACK = 30
const IN_SEASON_DAYS_AHEAD = 14
/** Dash pattern for days after today (expected values). */
const FUTURE_DASH = "6 4"
/** Dash pattern for the scenario; dotted so it differs from the future dash. */
const SCENARIO_DASH = "1 4"
/** Plot width below which every other axis tick is shown, so labels do not collide. */
const COMPACT_PLOT_PX = 440
/** Width of an event icon on the lane plus a small gap, in pixels. */
const LANE_ICON_SPACING_PX = 28
/** Leaching below this amount over the whole window is shown as text instead of a chart. */
const LEACHING_NEGLIGIBLE_KG = 0.5

/** Height of one row of the event lane: an icon of 24 px and a gap. */
const LANE_ROW_PX = 28
const LANE_ICON_PX = 24

/** Event on the lane; fertilizer events carry the fertilizer type for their icon. */
export type ChartEvent = MineralizationEvent & { p_type?: string | null }

type SeriesKey = "b_nw" | "b_n_uptake" | "b_n_available"
const SERIES_KEYS: SeriesKey[] = ["b_nw", "b_n_uptake", "b_n_available"]

const chartConfig = {
  b_nw: { label: "N-aanbod", color: "var(--chart-3)" },
  b_n_uptake: { label: "N-opname", color: "var(--chart-2)" },
  b_n_available: { label: "Beschikbare N", color: "var(--chart-5)" },
  b_no3_leach: { label: "Nitraatuitspoeling", color: "var(--chart-1)" },
  // Precipitation is context, not a nitrogen flow: neutral, so it never reads as N-aanbod
  w_prec_sum_day: { label: "Neerslag", color: "var(--color-muted-foreground)" },
} satisfies ChartConfig

type ValueKey = SeriesKey | "b_no3_leach"

/** One day of the chart; values are split in a part up to today (`p_`) and after today (`f_`). */
interface ChartRow {
  t: number
  date: string
  values: Partial<Record<ValueKey, number>>
  scenario: Partial<Record<ValueKey, number>>
  [key: string]: unknown
}

function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

/**
 * Builds the rows within the visible period. Each value is written to `p_<key>` up to and
 * including the cut date and to `f_<key>` from the cut date on, so past and future can be drawn
 * as solid and dashed lines that connect at the cut.
 */
function buildRows(
  series: DynaV2DailyPoint[],
  scenario: DynaV2DailyPoint[] | undefined,
  from: string,
  to: string,
  cut: string,
): ChartRow[] {
  const keys: ValueKey[] = [...SERIES_KEYS, "b_no3_leach"]
  const byDate = new Map(series.map((p) => [p.b_date_calculation, p]))
  const scenarioByDate = new Map(scenario?.map((p) => [p.b_date_calculation, p]))
  const dates = [...new Set([...byDate.keys(), ...scenarioByDate.keys()])]
    .filter((d) => d >= from && d <= to)
    .sort()
  return dates.map((date) => {
    const p = byDate.get(date)
    const s = scenarioByDate.get(date)
    const row: ChartRow = { t: toTime(date), date, values: {}, scenario: {} }
    for (const key of keys) {
      if (p) {
        row.values[key] = p[key]
        if (date <= cut) row[`p_${key}`] = p[key]
        if (date >= cut) row[`f_${key}`] = p[key]
      }
      if (s) {
        row.scenario[key] = s[key]
        row[`s_${key}`] = s[key]
      }
    }
    return row
  })
}

function buildTicks(from: number, to: number): number[] {
  const ticks: number[] = []
  if (to - from <= 70 * DAY_MS) {
    for (let t = from; t <= to; t += 7 * DAY_MS) ticks.push(t)
    return ticks
  }
  const d = new Date(from)
  d.setUTCDate(1)
  if (d.getTime() < from) d.setUTCMonth(d.getUTCMonth() + 1)
  while (d.getTime() <= to) {
    ticks.push(d.getTime())
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return ticks
}

const monthFormatter = new Intl.DateTimeFormat("nl-NL", { month: "short", timeZone: "UTC" })

const CROP_EVENT_ICONS: Record<Exclude<MineralizationEvent["type"], "fertilizer">, LucideIcon> = {
  sowing: Sprout,
  harvest: Wheat,
  cultivation_end: Shovel,
}

/** Icon of an event; fertilizers use the same shapes and colors as the fertilizer lists. */
function EventIcon({ event }: { event: ChartEvent }) {
  if (event.type === "fertilizer") {
    return (
      <FertilizerIcon
        p_type={event.p_type ?? (event.fertilizerKind === "mineral" ? "mineral" : null)}
        className="size-3 shrink-0"
      />
    )
  }
  const Icon = CROP_EVENT_ICONS[event.type]
  return <Icon className="size-3.5" aria-hidden />
}

function describeEvent(event: MineralizationEvent): string {
  const amount =
    event.amount !== undefined ? ` · ${formatNumber(event.amount, 1)} ${event.unit ?? ""}` : ""
  switch (event.type) {
    case "sowing":
      return `Zaaien / start teelt: ${event.label}`
    case "harvest":
      return `${event.planned ? "Geplande oogst" : "Oogst"}: ${event.label}${amount}`
    case "cultivation_end":
      return `Einde teelt: ${event.label}`
    case "fertilizer":
      return `${event.planned ? "Geplande bemesting" : "Bemesting"}: ${event.label}${amount} (${
        event.fertilizerKind === "mineral" ? "kunstmest" : "organisch"
      })`
  }
}

function TooltipContentBox({
  active,
  payload,
  hasScenario,
  cut,
}: {
  active?: boolean
  payload?: { payload: ChartRow }[]
  hasScenario: boolean
  cut: string
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const lines: { key: ValueKey; label: string }[] = [
    { key: "b_nw", label: "N-aanbod" },
    { key: "b_n_uptake", label: "N-opname" },
    { key: "b_n_available", label: "Beschikbare N" },
    { key: "b_no3_leach", label: "Uitspoeling" },
  ]
  return (
    <div className="bg-background grid min-w-48 gap-1.5 rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="font-medium">
        {formatLongDate(row.date)}
        {row.date > cut ? (
          <span className="text-muted-foreground font-normal"> · verwacht</span>
        ) : null}
      </p>
      {lines.map((line) => (
        <div key={line.key} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: `var(--color-${line.key})` }}
              aria-hidden
            />
            {line.label}
          </span>
          <span className="text-foreground tabular-nums">
            {formatKgN(row.values[line.key])}
            {hasScenario && row.scenario[line.key] !== undefined ? (
              <span className="text-muted-foreground"> → {formatKgN(row.scenario[line.key])}</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Props of {@link NitrogenChart}. */
export interface NitrogenChartProps {
  /** Full simulation (may start before the selected year). */
  series: DynaV2DailyPoint[]
  /** Simulation of a scenario, drawn dotted. */
  scenarioSeries?: DynaV2DailyPoint[]
  events: ChartEvent[]
  /** Applications that only exist in the scenario (new or moved), drawn with a dotted border. */
  scenarioEvents?: ChartEvent[]
  /** Selected calendar year. */
  year: number
  /** Today (`YYYY-MM-DD`). */
  today: string
  /** Selected phase: the growing season shows the last 30 and next 14 days, others the full year. */
  phase: SeasonPhase
  /** Weather forecast per day, when available. */
  forecastDays?: WeatherForecastDay[]
  /** Dates of planned events with rain in the forecast. */
  rainEventDates?: string[]
}

/**
 * Interactive season chart: nitrogen supply, uptake and available nitrogen, with nitrate leaching
 * (and, in the short window, precipitation) in synchronised panels below and the field events on
 * a lane above. Days after today are dashed; a scenario is dotted.
 */
export function NitrogenChart({
  series,
  scenarioSeries,
  events,
  scenarioEvents = [],
  year,
  today,
  phase,
  forecastDays = [],
  rainEventDates = [],
}: NitrogenChartProps) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())
  const [laneWidth, setLaneWidth] = useState(0)
  // Measures the lane, so overlapping icons can be detected in pixels at every screen width
  const laneRef = (node: HTMLUListElement | null) => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setLaneWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }
  const hasScenario = !!scenarioSeries

  const todayInYear = today.startsWith(`${year}-`)
  const inSeason = phase === "growing" && todayInYear
  const fromDate = inSeason ? addDays(today, -IN_SEASON_DAYS_BACK) : `${year}-01-01`
  const toDate = inSeason ? addDays(today, IN_SEASON_DAYS_AHEAD) : `${year}-12-31`
  // Everything up to the cut is measured weather; past years are fully measured, future years fully expected
  const cut = todayInYear ? today : today > `${year}-12-31` ? "9999-12-31" : "0000-01-01"

  const rows = buildRows(series, scenarioSeries, fromDate, toDate, cut)
  const lastRowT = rows.at(-1)?.t
  const from = toTime(fromDate)
  // In the short window, stop the axis where the simulation stops instead of showing empty days
  const to =
    inSeason && lastRowT !== undefined ? Math.min(toTime(toDate), lastRowT) : toTime(toDate)
  const seriesEndT = lastRowT ?? to
  const span = Math.max(to - from, DAY_MS)
  const compact = laneWidth > 0 && laneWidth < COMPACT_PLOT_PX
  const ticks = buildTicks(from, to).filter((_, i) => !compact || i % 2 === 0)
  const shortWindow = to - from <= 70 * DAY_MS
  const todayT = todayInYear ? toTime(today) : null
  const forecastEnd = forecastDays.at(-1)?.date
  const forecastEndT = forecastEnd ? toTime(forecastEnd) : null
  // Daily rain bars are only readable in the short window; the full year shows them in the strip
  const rainRows = shortWindow
    ? forecastDays
        .filter((d) => d.date >= fromDate && d.date <= toDate)
        .map((d) => ({ t: toTime(d.date), date: d.date, w_prec_sum_day: d.w_prec_sum_day }))
    : []
  // The legend only explains line styles that are actually drawn in this window
  const hasMeasured = rows.some((r) => r.date <= cut)
  const hasExpected = rows.some((r) => r.date > cut)
  const maxLeaching = Math.max(
    0,
    ...rows.map((r) => Math.max(r.values.b_no3_leach ?? 0, r.scenario.b_no3_leach ?? 0)),
  )

  // Stack events that would overlap on the lane, in date order so stacks read left to right
  const laneEvents = [
    ...events.map((event) => ({ event, scenario: false })),
    ...scenarioEvents.map((event) => ({ event, scenario: true })),
  ]
    .map((item) => ({ ...item, t: toTime(item.event.date) }))
    .filter(({ t }) => t >= from && t <= to)
    .sort((a, b) => a.t - b.t)
    .map(({ t, ...item }) => ({ ...item, left: ((t - from) / span) * 100 }))
  const minGap = laneWidth > 0 ? (LANE_ICON_SPACING_PX / laneWidth) * 100 : 2.5
  const placed: {
    event: ChartEvent
    scenario: boolean
    left: number
    row: number
  }[] = []
  for (const item of laneEvents) {
    let row = 0
    while (placed.some((p) => p.row === row && Math.abs(p.left - item.left) < minGap)) row++
    placed.push({ ...item, row })
  }
  const laneRows = Math.max(1, ...placed.map((p) => p.row + 1))

  const toggle = (key: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const xAxis = (
    <XAxis
      dataKey="t"
      type="number"
      domain={[from, to]}
      ticks={ticks}
      tickFormatter={(t: number) =>
        shortWindow
          ? formatShortDate(new Date(t).toISOString().slice(0, 10))
          : monthFormatter.format(new Date(t))
      }
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      allowDataOverflow
    />
  )
  // Zones stop where the simulation stops, so no shaded block is drawn over empty days
  const zoneEnd = Math.min(to, seriesEndT)
  const forecastZoneEnd = forecastEndT !== null ? Math.min(forecastEndT, zoneEnd) : null
  const climateZoneStart = forecastZoneEnd ?? todayT
  const zoneLabel = (value: string) => ({
    value,
    position: "insideTopLeft" as const,
    fontSize: 11,
    fill: "var(--color-muted-foreground)",
  })
  const zones = (labelled: boolean) => (
    <>
      {todayT !== null && forecastZoneEnd !== null && forecastZoneEnd > todayT ? (
        <ReferenceArea
          x1={todayT}
          x2={forecastZoneEnd}
          fill="var(--color-muted-foreground)"
          fillOpacity={0.1}
          ifOverflow="hidden"
          label={labelled && shortWindow ? zoneLabel("Weersverwachting") : undefined}
        />
      ) : null}
      {todayT !== null && climateZoneStart !== null && climateZoneStart < zoneEnd ? (
        <ReferenceArea
          x1={climateZoneStart}
          x2={zoneEnd}
          fill="var(--color-muted-foreground)"
          fillOpacity={0.04}
          ifOverflow="hidden"
          label={
            labelled && zoneEnd - climateZoneStart > span * 0.08
              ? zoneLabel("Klimaatgemiddelde")
              : undefined
          }
        />
      ) : null}
      {todayT !== null ? (
        <ReferenceLine
          x={todayT}
          stroke="var(--color-foreground)"
          strokeDasharray="4 4"
          ifOverflow="hidden"
          label={{
            value: "Vandaag",
            position: "insideTopRight",
            fontSize: 11,
            fill: "var(--color-muted-foreground)",
          }}
        />
      ) : null}
    </>
  )

  const solidAndDashed = (key: ValueKey, kind: "line" | "area") => {
    const color = `var(--color-${key})`
    if (kind === "area") {
      return [
        <Area
          key={`p_${key}`}
          dataKey={`p_${key}`}
          type="monotone"
          fill={color}
          fillOpacity={0.18}
          stroke={color}
          strokeWidth={2}
          connectNulls={false}
          isAnimationActive={false}
        />,
        <Area
          key={`f_${key}`}
          dataKey={`f_${key}`}
          type="monotone"
          fill={color}
          fillOpacity={0.08}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={FUTURE_DASH}
          connectNulls={false}
          isAnimationActive={false}
        />,
      ]
    }
    return [
      <Line
        key={`p_${key}`}
        dataKey={`p_${key}`}
        type="monotone"
        stroke={color}
        strokeWidth={2}
        dot={false}
        connectNulls={false}
        isAnimationActive={false}
      />,
      <Line
        key={`f_${key}`}
        dataKey={`f_${key}`}
        type="monotone"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={FUTURE_DASH}
        dot={false}
        connectNulls={false}
        isAnimationActive={false}
      />,
    ]
  }

  const scenarioLine = (key: ValueKey) => (
    <Line
      key={`s_${key}`}
      dataKey={`s_${key}`}
      type="monotone"
      stroke={`var(--color-${key})`}
      strokeWidth={2.5}
      strokeDasharray={SCENARIO_DASH}
      strokeLinecap="round"
      dot={false}
      isAnimationActive={false}
    />
  )

  if (rows.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        {inSeason
          ? "Er zijn geen berekende dagen rond vandaag. Kies Planning of Evaluatie voor het hele jaar."
          : "Er zijn geen berekende dagen in dit jaar om te tonen."}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lijnen tonen of verbergen">
          {SERIES_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={!hidden.has(key)}
              onClick={() => toggle(key)}
              className={cn(
                "h-7 gap-1.5 px-2.5 text-xs pointer-coarse:h-10",
                hidden.has(key) && "text-muted-foreground",
              )}
            >
              <span
                className={cn("size-2.5 rounded-[2px]", hidden.has(key) && "opacity-30")}
                style={{ background: chartConfig[key].color }}
                aria-hidden
              />
              {chartConfig[key].label}
            </Button>
          ))}
        </div>
        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {hasMeasured ? (
            <li className="inline-flex items-center gap-1.5">
              <svg width="18" height="4" aria-hidden>
                <line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2" />
              </svg>
              Berekend met gemeten weer
            </li>
          ) : null}
          {hasExpected ? (
            <li className="inline-flex items-center gap-1.5">
              <svg width="18" height="10" aria-hidden>
                {todayT !== null ? (
                  <rect width="18" height="10" rx="2" fill="currentColor" fillOpacity={0.12} />
                ) : null}
                <line
                  x1="0"
                  y1="5"
                  x2="18"
                  y2="5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={FUTURE_DASH}
                />
              </svg>
              {todayT !== null ? "Verwachting (grijs vlak)" : "Verwachting"}
            </li>
          ) : null}
          {hasScenario ? (
            <li className="inline-flex items-center gap-1.5">
              <svg width="18" height="4" aria-hidden>
                <line
                  x1="1"
                  y1="2"
                  x2="18"
                  y2="2"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray={SCENARIO_DASH}
                  strokeLinecap="round"
                />
              </svg>
              Scenario
            </li>
          ) : null}
        </ul>
      </div>

      <div>
        {/* Event lane, aligned with the plot area; each icon has a stem down to its date */}
        <ul
          ref={laneRef}
          className="relative"
          style={{
            height: `${laneRows * LANE_ROW_PX}px`,
            marginLeft: `${Y_AXIS_WIDTH + MARGIN.left}px`,
            marginRight: `${MARGIN.right}px`,
          }}
          aria-label="Gebeurtenissen op het perceel"
        >
          {placed.map(({ event, scenario, left, row }) => {
            const rain = !scenario && event.planned && rainEventDates.includes(event.date)
            const description = `${scenario ? "Scenario: " : ""}${describeEvent(event)}`
            return (
              <li
                key={`${scenario ? "s" : "e"}-${event.type}-${event.date}-${event.p_app_id ?? event.b_lu ?? ""}`}
                className="absolute -translate-x-1/2"
                style={{ left: `${left}%`, top: `${row * LANE_ROW_PX}px` }}
              >
                {/* Stem from the icon to the top of the plot, where the date line continues */}
                <span
                  className={cn(
                    "border-muted-foreground/50 absolute left-1/2 border-l",
                    event.planned && "border-dashed",
                    scenario && "border-foreground/70 border-dotted",
                  )}
                  style={{
                    top: `${LANE_ICON_PX}px`,
                    height: `${(laneRows - row) * LANE_ROW_PX - LANE_ICON_PX + MARGIN.top}px`,
                  }}
                  aria-hidden
                />
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "bg-background text-foreground focus-visible:ring-ring relative flex size-6 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none",
                        // Invisible 40 px hit area, so the small icon can be tapped
                        "after:absolute after:-inset-2 after:content-['']",
                        event.planned && "border-dashed",
                        scenario && "border-foreground border-2 border-dotted",
                      )}
                      aria-label={`${formatShortDate(event.date)}: ${description}${
                        rain ? ", regen verwacht" : ""
                      }`}
                    >
                      <EventIcon event={event} />
                      {rain ? (
                        <span
                          className="bg-background absolute -top-1.5 -right-1.5 flex size-3.5 items-center justify-center rounded-full border"
                          aria-hidden
                        >
                          <CloudRain className="size-2.5" />
                        </span>
                      ) : null}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{formatLongDate(event.date)}</p>
                    <p>{description}</p>
                    {rain ? (
                      <p className="mt-1 inline-flex items-center gap-1">
                        <CloudRain className="size-3.5" aria-hidden /> Regen verwacht rond deze
                        datum
                      </p>
                    ) : null}
                  </TooltipContent>
                </UiTooltip>
              </li>
            )
          })}
        </ul>

        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <ComposedChart data={rows} margin={MARGIN} syncId="mineralization" syncMethod="value">
            <CartesianGrid vertical={false} strokeOpacity={0.5} />
            {xAxis}
            <YAxis
              width={Y_AXIS_WIDTH}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatNumber(v)}
              label={{
                value: "kg N/ha",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "var(--color-muted-foreground)" },
              }}
            />
            {zones(true)}
            {placed.map(({ event, scenario }) => (
              <ReferenceLine
                key={`line-${scenario ? "s" : "e"}-${event.type}-${event.date}-${event.p_app_id ?? event.b_lu ?? ""}`}
                x={toTime(event.date)}
                stroke={scenario ? "var(--color-foreground)" : "var(--color-muted-foreground)"}
                strokeOpacity={scenario ? 0.7 : 0.5}
                strokeDasharray={scenario ? "1 3" : event.planned ? "4 3" : undefined}
                ifOverflow="hidden"
              />
            ))}
            <Tooltip
              content={<TooltipContentBox hasScenario={hasScenario} cut={cut} />}
              cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
            />
            {!hidden.has("b_n_available") ? solidAndDashed("b_n_available", "area") : null}
            {!hidden.has("b_nw") ? solidAndDashed("b_nw", "line") : null}
            {!hidden.has("b_n_uptake") ? solidAndDashed("b_n_uptake", "line") : null}
            {hasScenario ? SERIES_KEYS.filter((key) => !hidden.has(key)).map(scenarioLine) : null}
          </ComposedChart>
        </ChartContainer>
      </div>

      {maxLeaching < LEACHING_NEGLIGIBLE_KG ? (
        <p className="text-muted-foreground text-xs">
          Nitraatuitspoeling: 0 kg N/ha in deze periode.
        </p>
      ) : (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            Nitraatuitspoeling (kg N/ha)
          </p>
          <ChartContainer config={chartConfig} className="aspect-auto h-28 w-full">
            <ComposedChart
              data={rows}
              margin={{ ...MARGIN, top: 4 }}
              syncId="mineralization"
              syncMethod="value"
            >
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              {xAxis}
              <YAxis
                width={Y_AXIS_WIDTH}
                tickLine={false}
                axisLine={false}
                tickCount={3}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              {zones(false)}
              <Tooltip content={() => null} cursor={{ stroke: "var(--color-muted-foreground)" }} />
              {solidAndDashed("b_no3_leach", "area")}
              {hasScenario ? scenarioLine("b_no3_leach") : null}
            </ComposedChart>
          </ChartContainer>
        </div>
      )}

      {rainRows.length > 0 ? (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            Neerslag volgens de weersverwachting (mm per dag)
          </p>
          <ChartContainer config={chartConfig} className="aspect-auto h-24 w-full">
            <ComposedChart data={rainRows} margin={{ ...MARGIN, top: 4 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              {xAxis}
              <YAxis
                width={Y_AXIS_WIDTH}
                tickLine={false}
                axisLine={false}
                tickCount={3}
                allowDecimals={false}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              {zones(false)}
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                content={({ active, payload }) => {
                  const day = payload?.[0]?.payload as { date: string; w_prec_sum_day: number }
                  if (!active || !day) return null
                  return (
                    <div className="bg-background rounded-lg border px-3 py-2 text-xs shadow-md">
                      <p className="font-medium">{formatLongDate(day.date)}</p>
                      <p className="tabular-nums">{formatNumber(day.w_prec_sum_day, 1)} mm</p>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="w_prec_sum_day"
                fill="var(--color-w_prec_sum_day)"
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      ) : null}

      <p className="text-muted-foreground text-xs sm:hidden">
        De grafiek is het best te lezen op een groter scherm, of open hieronder de tabel.
      </p>
      <SeriesTable rows={rows} />
    </div>
  )
}

/** Weekly values as a table, for screen readers and exact reading. */
function SeriesTable({ rows }: { rows: ChartRow[] }) {
  const step = rows.length > 70 ? 7 : 1
  const shown = rows.filter((_, i) => i % step === 0 || i === rows.length - 1)
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group text-muted-foreground -ml-2">
          <ChevronDown
            className="transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
          Toon als tabel
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-80 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">N-aanbod</TableHead>
                <TableHead className="text-right">N-opname</TableHead>
                <TableHead className="text-right">Beschikbare N</TableHead>
                <TableHead className="text-right">Uitspoeling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => (
                <TableRow key={row.date}>
                  <TableCell>{formatShortDate(row.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKgN(row.values.b_nw)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKgN(row.values.b_n_uptake)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKgN(row.values.b_n_available)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKgN(row.values.b_no3_leach)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
