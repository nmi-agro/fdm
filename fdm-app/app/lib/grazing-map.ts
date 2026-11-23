/**
 * Status of a field on the grazing map on one day: grazed, mown, resting or not yet used in the
 * selected year. Pure functions on calendar dates as `YYYY-MM-DD` strings, so they can run on the
 * server and the client and be tested without a map.
 */

import type { MultiPolygon } from "geojson"

/** Status of a field on the grazing map. */
export type GrazingMapStatus = "weiden" | "maaien" | "rust" | "unused" | "disabled"

/** The statuses in legend order. */
export const GRAZING_MAP_STATUSES: readonly GrazingMapStatus[] = [
  "weiden",
  "maaien",
  "rust",
  "unused",
  "disabled",
]

/** A grazing as the map needs it. */
export interface GrazingMapGrazing {
  l_id_herd: string
  l_herd_name: string
  b_id: string | null
  /** First day (YYYY-MM-DD). */
  l_grazing_start: string
  /** Last day (YYYY-MM-DD); `null` while the cows are still out. */
  l_grazing_end: string | null
  l_grazing_hours: number | null
  l_grazing_geometry_zone: MultiPolygon | null
}

/** A harvest (mowing) as the map needs it. */
export interface GrazingMapHarvest {
  /** Day of the harvest (YYYY-MM-DD). */
  harvestDate: string
  /** Yield (kg DM/ha), when known. */
  yield?: number | null
}

/** What the map shows for one field on one day. */
export interface FieldGrazingState {
  status: GrazingMapStatus
  /** The grazing on the field that day (status `weiden`). */
  grazing?: GrazingMapGrazing
  /** The harvest on the field that day (status `maaien`). */
  harvest?: GrazingMapHarvest
  /** The last use before that day in the selected year (status `rust`). */
  lastUse?: { type: "weiden" | "maaien"; date: string }
  /** Days since the last use (status `rust`). */
  restDays?: number
}

const MS_PER_DAY = 86_400_000

/** Number of days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY)
}

/** The day `days` days after `day` (YYYY-MM-DD); negative to go back. */
export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(day) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Keeps a day (YYYY-MM-DD) within the calendar year. */
export function clampToYear(day: string, calendarYear: number): string {
  const first = `${calendarYear}-01-01`
  const last = `${calendarYear}-12-31`
  return day < first ? first : day > last ? last : day
}

/**
 * The day the map opens on: today in the current year, and the same day and month in another
 * year. 29 February becomes 28 February in a year that is not a leap year.
 *
 * @param today - Today (YYYY-MM-DD).
 * @param calendarYear - The selected calendar year.
 * @returns The day to show (YYYY-MM-DD).
 */
export function defaultMapDay(today: string, calendarYear: number): string {
  const monthDay = today.slice(5)
  const isLeapYear =
    (calendarYear % 4 === 0 && calendarYear % 100 !== 0) || calendarYear % 400 === 0
  return `${calendarYear}-${monthDay === "02-29" && !isLeapYear ? "02-28" : monthDay}`
}

/**
 * The last day of a grazing (YYYY-MM-DD). Every grazing has an end; a record without one lasts
 * its first day only.
 */
export function grazingEndDay(grazing: GrazingMapGrazing): string {
  return grazing.l_grazing_end ?? grazing.l_grazing_start
}

/**
 * The status of one field on one day.
 *
 * - Not grassland or a buffer strip: `disabled`.
 * - A grazing that covers the day: `weiden`; a harvest on the day: `maaien`.
 * - Otherwise `rust`, counted from the last use before the day in the selected year. A use in
 *   another year does not count, so a field starts the year as `unused`.
 *
 * @param input - The grazings and harvests of the field, the day and the selected year.
 * @returns The status and the details the map and its popup show.
 */
export function getFieldGrazingState(input: {
  grazings: GrazingMapGrazing[]
  harvests: GrazingMapHarvest[]
  /** The day shown (YYYY-MM-DD). */
  day: string
  calendarYear: number
  isGrassland: boolean
  isBufferstrip: boolean
}): FieldGrazingState {
  const { grazings, harvests, day, calendarYear } = input
  if (input.isBufferstrip || !input.isGrassland) return { status: "disabled" }

  const grazing = grazings.find((g) => day >= g.l_grazing_start && day <= grazingEndDay(g))
  if (grazing) return { status: "weiden", grazing }

  const harvest = harvests.find((h) => h.harvestDate === day)
  if (harvest) return { status: "maaien", harvest }

  const yearStart = `${calendarYear}-01-01`
  const uses = [
    ...grazings
      .filter((g) => g.l_grazing_start < day)
      .map((g) => ({ type: "weiden" as const, date: grazingEndDay(g) })),
    ...harvests
      .filter((h) => h.harvestDate < day)
      .map((h) => ({ type: "maaien" as const, date: h.harvestDate })),
  ].filter((use) => use.date >= yearStart && use.date < day)

  const lastUse = uses.reduce<(typeof uses)[number] | undefined>(
    (latest, use) => (!latest || use.date > latest.date ? use : latest),
    undefined,
  )
  if (!lastUse) return { status: "unused" }
  return { status: "rust", lastUse, restDays: daysBetween(lastUse.date, day) }
}
