import type { MineralizationSignal, WeatherForecast } from "@nmi-agro/fdm-calculator"
import type { CSSProperties } from "react"
import { CloudRain } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { addDays, formatLongDate, formatNumber } from "~/lib/mineralization"

type RainSignal = Extract<MineralizationSignal, { type: "rain_near_event" }>

/** A proposed shift of a planned event to a drier day. */
export interface ShiftSuggestion {
  eventType: "fertilizer" | "harvest"
  p_app_id?: string
  eventDate: string
  newDate: string
}

const weekdayFormatter = new Intl.DateTimeFormat("nl-NL", { weekday: "short", timeZone: "UTC" })
const dayFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
})

/**
 * Finds the first day after the rainy window around an event with (almost) no rain on that day
 * and the next one.
 */
function findDrierDay(forecast: WeatherForecast, eventDate: string): string {
  const rain = new Map(forecast.days.map((d) => [d.date, d.w_prec_sum_day]))
  for (let offset = 3; offset <= 14; offset++) {
    const date = addDays(eventDate, offset)
    if (!rain.has(date)) break
    const nextRain = rain.get(addDays(date, 1)) ?? 0
    if ((rain.get(date) ?? 0) + nextRain < 2) return date
  }
  return addDays(eventDate, 3)
}

/**
 * Weather forecast of the coming days with warnings for planned events in rainy periods.
 */
export function WeatherStrip({
  forecast,
  signals,
  onSuggestShift,
  canSuggestShift,
}: {
  forecast: WeatherForecast
  signals: MineralizationSignal[]
  onSuggestShift?: (suggestion: ShiftSuggestion) => void
  /** Whether the event of a signal can be shifted in the scenario. */
  canSuggestShift?: (signal: RainSignal) => boolean
}) {
  const rainSignals = signals.filter((s): s is RainSignal => s.type === "rain_near_event")
  const maxRain = Math.max(10, ...forecast.days.map((d) => d.w_prec_sum_day))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weersverwachting</CardTitle>
        <CardDescription>
          De berekening gebruikt deze verwachting voor de komende {forecast.days.length} dagen en
          daarna het langjarig klimaatgemiddelde.
        </CardDescription>
      </CardHeader>
      <CardContent className="@container space-y-4">
        {/* Two rows of a week in a narrow card, one row once every day has room for its labels */}
        <ol
          className="grid grid-cols-7 gap-x-1 gap-y-4 @2xl:grid-cols-[repeat(var(--days),minmax(0,1fr))]"
          style={{ "--days": forecast.days.length } as CSSProperties}
          aria-label="Weersverwachting per dag"
        >
          {forecast.days.map((day) => {
            const date = new Date(`${day.date}T00:00:00Z`)
            const height = Math.round((day.w_prec_sum_day / maxRain) * 48)
            return (
              <li key={day.date} className="text-center text-xs">
                <span className="sr-only">
                  {`${formatLongDate(day.date)}: ${formatNumber(day.w_prec_sum_day, 1)} mm neerslag, ${formatNumber(day.w_temp_min_day)} tot ${formatNumber(day.w_temp_max_day)} °C`}
                </span>
                <div className="flex flex-col items-center gap-1" aria-hidden>
                  <span className="font-medium capitalize">{weekdayFormatter.format(date)}</span>
                  <span className="text-muted-foreground">{dayFormatter.format(date)}</span>
                  <div className="flex h-12 w-full items-end justify-center">
                    <div
                      className="bg-foreground/45 w-3 rounded-t-[3px]"
                      style={{ height: `${Math.max(height, day.w_prec_sum_day > 0 ? 2 : 0)}px` }}
                    />
                  </div>
                  <span className="tabular-nums">{formatNumber(day.w_prec_sum_day, 1)} mm</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(day.w_temp_min_day)}–{formatNumber(day.w_temp_max_day)}°
                  </span>
                </div>
              </li>
            )
          })}
        </ol>

        {rainSignals.length > 0 ? (
          <ul className="space-y-2">
            {rainSignals.map((signal) => (
              <li
                key={`${signal.eventType}-${signal.eventDate}-${signal.p_app_id ?? ""}`}
                className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex items-start gap-2">
                  <CloudRain className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Rond je {signal.eventType === "harvest" ? "geplande oogst" : "geplande gift"} op{" "}
                    {formatLongDate(signal.eventDate)} valt naar verwachting{" "}
                    {formatNumber(signal.rainMm, 1)} mm regen. Overweeg te verschuiven naar een
                    drogere dag.
                  </span>
                </span>
                {onSuggestShift && (canSuggestShift?.(signal) ?? true) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto sm:self-center pointer-coarse:h-10"
                    onClick={() =>
                      onSuggestShift({
                        eventType: signal.eventType,
                        p_app_id: signal.p_app_id,
                        eventDate: signal.eventDate,
                        newDate: findDrierDay(forecast, signal.eventDate),
                      })
                    }
                  >
                    Probeer in scenario
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {forecast.notifications.length > 0 ? (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {forecast.notifications.map((notification) => (
              <li key={notification}>{notification}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
