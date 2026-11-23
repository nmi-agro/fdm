/**
 * Dates for the grazing pages. Grazing dates are stored as date-only values (midnight UTC of the
 * calendar day), while "today" follows the calendar day in the Netherlands.
 */

/** Time zone of the farms; the calendar day of "today" follows it. */
export const FARM_TIME_ZONE = "Europe/Amsterdam"

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: FARM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * Today's calendar day in the Netherlands, as `YYYY-MM-DD`. Between midnight and 1:00 or 2:00 in
 * the Netherlands the UTC date is still the day before.
 *
 * @param now - The current moment.
 * @returns The day key, for example `2026-05-13`.
 */
export function farmTodayKey(now: Date = new Date()): string {
  return dayKeyFormat.format(now)
}

/**
 * Today as a date-only value, comparable with the stored grazing dates: the last moment (UTC) of
 * today's calendar day in the Netherlands. A grazing that starts today has then started, and its
 * UTC date is today's day.
 *
 * @param now - The current moment.
 * @returns The end of today's calendar day, in UTC.
 */
export function farmToday(now: Date = new Date()): Date {
  return new Date(`${farmTodayKey(now)}T23:59:59.999Z`)
}

/**
 * The calendar day in the Netherlands of a moment, as a date-only value (midnight UTC of that
 * day), comparable with the stored grazing dates. Mowing and fertilizer dates are stored as
 * moments; a mowing at 00:30 on 15 June in the Netherlands is still 14 June in UTC.
 *
 * @param date - The moment.
 * @returns Midnight UTC of the Dutch calendar day.
 */
export function farmDayDate(date: Date | string): Date {
  return new Date(`${farmTodayKey(new Date(date))}T00:00:00.000Z`)
}

/**
 * The last moment of a calendar day in the Netherlands: 23:59:59.999 in Amsterdam, which is
 * 21:59:59.999 UTC in summer time and 22:59:59.999 UTC in winter time.
 *
 * @param dayKey - The day as `YYYY-MM-DD`.
 * @returns The last moment of that day.
 */
export function endOfFarmDay(dayKey: string): Date {
  const summerEnd = new Date(`${dayKey}T21:59:59.999Z`)
  // In summer time the next millisecond is already the next day in the Netherlands
  if (farmTodayKey(new Date(summerEnd.getTime() + 1)) !== dayKey) return summerEnd
  return new Date(`${dayKey}T22:59:59.999Z`)
}

/**
 * The moment to count the herds on for a calendar year: now in the current or a future year, and
 * the last day of a past year, so a past year shows the herds of that year.
 *
 * @param year - The calendar year.
 * @param now - The current moment.
 * @returns The census date.
 */
export function censusDateForYear(year: number, now: Date = new Date()): Date {
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
  return now < yearEnd ? now : yearEnd
}

/**
 * The day on which the animals of a new herd arrive, unless the user picks another day: 1 January
 * of the chosen calendar year, as the real day is often unknown. Today when that day is still to
 * come, and 1 January of this year for the calendar "all".
 *
 * @param calendar - The calendar of the route: a year, or `all`.
 * @param now - The current moment.
 * @returns The day as `YYYY-MM-DD`.
 */
export function herdArrivalDefaultKey(calendar: string, now: Date = new Date()): string {
  const todayKey = farmTodayKey(now)
  const year = Number.parseInt(calendar, 10)
  const yearStartKey = `${Number.isNaN(year) ? todayKey.slice(0, 4) : year}-01-01`
  return yearStartKey < todayKey ? yearStartKey : todayKey
}

/**
 * The days of a grazing within a calendar year that have already happened, as `YYYY-MM-DD` keys.
 * Days after today are planned and not included. A record without an end counts its first day.
 *
 * @param grazing - The start and the end of the grazing.
 * @param year - The calendar year, or `null` for every year.
 * @param today - Today as a date-only value, see {@link farmToday}.
 * @returns The day keys, in order.
 */
export function realisedGrazingDays(
  grazing: { l_grazing_start: Date | string; l_grazing_end?: Date | string | null },
  year: number | null,
  today: Date,
): string[] {
  const start = new Date(grazing.l_grazing_start)
  const end = grazing.l_grazing_end ? new Date(grazing.l_grazing_end) : start
  const last = end < today ? end : today
  const days: string[] = []
  const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  while (day <= last) {
    if (year === null || day.getUTCFullYear() === year) days.push(day.toISOString().slice(0, 10))
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return days
}

/**
 * The grazing days and hours of one field that have already happened, as the grazing calendar
 * and `calculateGrazingMetrics` count them: a day counts once. The hours of a herd on a day are
 * those of all its grazings on the field added up (two zones, or the same zone twice), up to 24;
 * when several herds grazed that day, the herd with the most hours counts. A grazing without
 * recorded hours adds no hours. Planned days (after today) are left out.
 *
 * @param grazings - The grazings on the field.
 * @param year - The calendar year, or `null` for every year.
 * @param today - Today as a date-only value, see {@link farmToday}.
 * @returns The number of grazing days and the total grazing hours.
 */
export function fieldGrazingTotals(
  grazings: Array<{
    l_id_herd?: string
    l_grazing_start: Date | string
    l_grazing_end?: Date | string | null
    l_grazing_hours?: number | null
  }>,
  year: number | null,
  today: Date,
): { days: number; hours: number } {
  // Hours per herd and day, added up over the herd's grazings
  const herdHours = new Map<string, number>()
  for (const grazing of grazings) {
    for (const day of realisedGrazingDays(grazing, year, today)) {
      const key = `${grazing.l_id_herd ?? ""}|${day}`
      herdHours.set(key, Math.min(24, (herdHours.get(key) ?? 0) + (grazing.l_grazing_hours ?? 0)))
    }
  }
  const hoursPerDay = new Map<string, number>()
  for (const [key, hours] of herdHours) {
    const day = key.slice(key.indexOf("|") + 1)
    hoursPerDay.set(day, Math.max(hoursPerDay.get(day) ?? 0, hours))
  }
  let hours = 0
  for (const dayHours of hoursPerDay.values()) hours += dayHours
  return { days: hoursPerDay.size, hours }
}
