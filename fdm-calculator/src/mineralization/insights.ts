/**
 * @packageDocumentation
 * @module mineralization/insights
 *
 * Interprets a Dyna v2 simulation for farmers: season phase, key figures, signals that need
 * attention and points for improvement.
 */

import { toFdmDateString } from "@nmi-agro/fdm-core"
import type { MineralizationEvent } from "./prepare"
import type { DynaV2DailyPoint, DynaV2Result } from "./types"
import type { WeatherForecast } from "./weather"

/**
 * Moment in the growing season the page focuses on.
 *
 * - `planning`: before the main crop starts, plan the fertilization.
 * - `growing`: between start and harvest, adjust to the weather.
 * - `evaluation`: after the harvest, evaluate the season.
 */
export type SeasonPhase = "planning" | "growing" | "evaluation"

/**
 * Thresholds for the signals.
 *
 * These are provisional values that still need agronomic validation.
 */
export const MINERALIZATION_THRESHOLDS = {
  /** Available nitrogen below which a shortage is expected (kg N/ha). */
  nShortageKgHa: 20,
  /** Number of days ahead that are checked for a shortage during the growing season. */
  shortageLookaheadDays: 14,
  /** Cumulative nitrate leaching from which leaching is considered high (kg N/ha). */
  leachingHighKgHa: 30,
  /** Available nitrogen at harvest from which it is considered a surplus (kg N/ha). */
  residualNAtHarvestKgHa: 50,
  /** Number of days before and after an event that are checked for rain. */
  rainWindowDays: 2,
  /** Precipitation within the window from which rain is considered relevant (mm). */
  rainSumMm: 10,
  /** Uptake within 14 days after an application below which uptake is considered low (kg N/ha). */
  lowUptakeAfterApplicationKgHa: 5,
} as const

/** Signal that a field needs attention. */
export type MineralizationSignal =
  | { type: "n_shortage"; date: string; availableN: number }
  | { type: "high_leaching"; leachingKgHa: number }
  | { type: "residual_n"; date: string; availableN: number }
  | {
      type: "rain_near_event"
      eventDate: string
      eventType: "fertilizer" | "harvest"
      rainMm: number
      p_app_id?: string
      /** Cultivation of a harvest event. */
      b_lu?: string
    }

/** Key figures of a simulation, in kg N/ha unless stated otherwise. */
export interface MineralizationKpis {
  /** Available nitrogen today; `null` when today is not in the selected year. */
  availableNNow: number | null
  /** Nitrogen uptake up to today (or the end of the simulation for past years). */
  uptakeToDate: number
  /** Nitrate leaching up to today (or the end of the simulation for past years). */
  leachingToDate: number
  /** Total nitrogen uptake at the end of the simulation. */
  totalUptake: number
  /** Total nitrate leaching at the end of the simulation. */
  totalLeaching: number
  /** Available nitrogen at the harvest of the main crop. */
  residualNAtHarvest: number | null
  /** Share of the available nitrogen taken up by the crop (0–1); `null` without available nitrogen. */
  nUseEfficiency: number | null
}

/** Interpretation of a simulation. */
export interface MineralizationInsights {
  /** Phase that matches today's date. */
  defaultPhase: SeasonPhase
  kpis: MineralizationKpis
  /** Signals that need attention, most important first. */
  signals: MineralizationSignal[]
  /** Dutch suggestions for improvement. */
  improvementPoints: string[]
}

/** Adds days to a calendar date (`YYYY-MM-DD`). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Formats a calendar date as e.g. "5 maart". */
function formatDayMonth(date: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

/** Returns the last point on or before a date. */
function pointOnOrBefore(series: DynaV2DailyPoint[], date: string): DynaV2DailyPoint | undefined {
  let found: DynaV2DailyPoint | undefined
  for (const point of series) {
    if (point.b_date_calculation > date) break
    found = point
  }
  return found
}

/**
 * Determines the phase of the season that matches today's date.
 *
 * @param args.year - Selected calendar year.
 * @param args.today - Current date.
 * @param args.mainStart - Start of the main cultivation (`YYYY-MM-DD`).
 * @param args.mainHarvest - (Last) harvest of the main cultivation (`YYYY-MM-DD`).
 * @returns `planning` for future years or before the start, `evaluation` for past years or after
 *   the harvest, otherwise `growing`.
 */
export function determineSeasonPhase(args: {
  year: number
  today: Date
  mainStart: string
  mainHarvest: string
}): SeasonPhase {
  const today = toFdmDateString(args.today)
  const currentYear = Number(today.slice(0, 4))
  if (args.year < currentYear) return "evaluation"
  if (args.year > currentYear) return "planning"
  if (today < args.mainStart) return "planning"
  if (today > args.mainHarvest) return "evaluation"
  return "growing"
}

/**
 * Derives the season phase, key figures, signals and improvement points from a simulation.
 *
 * @param args.result - Dyna v2 simulation.
 * @param args.events - Events on the field (see `prepareMineralizationInput`).
 * @param args.forecast - Weather forecast, or `null` when not available.
 * @param args.year - Selected calendar year.
 * @param args.today - Current date.
 * @param args.mainStart - Start of the main cultivation (`YYYY-MM-DD`).
 * @param args.mainHarvest - (Last) harvest of the main cultivation (`YYYY-MM-DD`).
 * @returns The interpretation of the simulation.
 */
export function deriveMineralizationInsights(args: {
  result: DynaV2Result
  events: MineralizationEvent[]
  forecast: WeatherForecast | null
  year: number
  today: Date
  mainStart: string
  mainHarvest: string
}): MineralizationInsights {
  const { series } = args.result
  const t = MINERALIZATION_THRESHOLDS
  const today = toFdmDateString(args.today)
  const currentYear = Number(today.slice(0, 4))
  const defaultPhase = determineSeasonPhase(args)
  const last = series.at(-1)

  // Key figures
  const todayPoint = args.year === currentYear ? pointOnOrBefore(series, today) : undefined
  const toDatePoint =
    args.year < currentYear ? last : args.year === currentYear ? todayPoint : undefined
  const harvestPoint = pointOnOrBefore(series, args.mainHarvest)
  const maxNw = series.reduce((max, p) => Math.max(max, p.b_nw), 0)
  const totalUptake = last?.b_n_uptake ?? 0
  const kpis: MineralizationKpis = {
    availableNNow: todayPoint?.b_n_available ?? null,
    uptakeToDate: toDatePoint?.b_n_uptake ?? 0,
    leachingToDate: toDatePoint?.b_no3_leach ?? 0,
    totalUptake,
    totalLeaching: last?.b_no3_leach ?? 0,
    residualNAtHarvest: harvestPoint?.b_n_available ?? null,
    nUseEfficiency: maxNw > 0 ? Math.round((totalUptake / maxNw) * 100) / 100 : null,
  }

  const signals: MineralizationSignal[] = []
  const improvementPoints: string[] = []

  // Expected shortage while the crop still takes up nitrogen
  let window: [string, string] | null = null
  if (defaultPhase === "growing") {
    const end = addDays(today, t.shortageLookaheadDays)
    window = [today, end < args.mainHarvest ? end : args.mainHarvest]
  } else if (defaultPhase === "planning") {
    window = [args.mainStart, args.mainHarvest]
  }
  if (window) {
    const [from, to] = window
    for (let i = 0; i < series.length; i++) {
      const point = series[i]
      if (point.b_date_calculation < from) continue
      if (point.b_date_calculation > to) break
      const ahead = series[Math.min(i + 7, series.length - 1)]
      const uptakeRising = ahead.b_n_uptake - point.b_n_uptake > 1
      if (point.b_n_available < t.nShortageKgHa && uptakeRising) {
        signals.push({
          type: "n_shortage",
          date: point.b_date_calculation,
          availableN: Math.round(point.b_n_available),
        })
        break
      }
    }
  }

  // Rain around planned events
  if (args.forecast && args.forecast.days.length > 0) {
    const rainByDate = new Map(args.forecast.days.map((d) => [d.date, d.w_prec_sum_day]))
    for (const event of args.events) {
      if (!event.planned || (event.type !== "fertilizer" && event.type !== "harvest")) continue
      if (!rainByDate.has(event.date)) continue
      let rainMm = 0
      for (let d = -t.rainWindowDays; d <= t.rainWindowDays; d++) {
        rainMm += rainByDate.get(addDays(event.date, d)) ?? 0
      }
      rainMm = Math.round(rainMm * 10) / 10
      if (rainMm >= t.rainSumMm) {
        signals.push({
          type: "rain_near_event",
          eventDate: event.date,
          eventType: event.type,
          rainMm,
          ...(event.p_app_id ? { p_app_id: event.p_app_id } : {}),
          ...(event.type === "harvest" && event.b_lu ? { b_lu: event.b_lu } : {}),
        })
      }
    }
  }

  // Leaching
  if (kpis.totalLeaching >= t.leachingHighKgHa) {
    const leachingKgHa = Math.round(kpis.totalLeaching)
    signals.push({ type: "high_leaching", leachingKgHa })
    improvementPoints.push(
      `Er is ${leachingKgHa} kg N/ha nitraat uitgespoeld; overweeg giften later of in delen te geven.`,
    )
  }

  // Residual nitrogen at harvest
  if (kpis.residualNAtHarvest !== null && kpis.residualNAtHarvest >= t.residualNAtHarvestKgHa) {
    const availableN = Math.round(kpis.residualNAtHarvest)
    signals.push({ type: "residual_n", date: args.mainHarvest, availableN })
    improvementPoints.push(
      `Na de oogst bleef ${availableN} kg N/ha beschikbaar; een vanggewas kan uitspoeling beperken.`,
    )
  }

  // Applications in periods with little uptake
  for (const event of args.events) {
    if (event.type !== "fertilizer") continue
    const start = pointOnOrBefore(series, event.date)
    const end = pointOnOrBefore(series, addDays(event.date, 14))
    if (!start || !end) continue
    if (end.b_n_uptake - start.b_n_uptake < t.lowUptakeAfterApplicationKgHa) {
      const point = `De gift van ${formatDayMonth(event.date)} viel in een periode met weinig opname.`
      if (!improvementPoints.includes(point)) improvementPoints.push(point)
    }
  }

  return { defaultPhase, kpis, signals, improvementPoints }
}
