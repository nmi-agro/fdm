/**
 * The time zone in which calendar dates in FDM are interpreted, e.g. the last day a field is managed
 * or a measure is applied.
 */
export const FDM_TIME_ZONE = "Europe/Amsterdam"

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: FDM_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
})

/**
 * Returns the calendar date and wall-clock time of a moment in Europe/Amsterdam.
 *
 * @param date - The moment to convert.
 * @returns The year, month (1-12), day, hour, minute and second in Europe/Amsterdam.
 */
function getZonedParts(date: Date) {
  const parts: Record<string, number> = {}
  for (const part of dateTimeFormat.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value)
    }
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/**
 * Returns the offset of Europe/Amsterdam from UTC at a given moment, in milliseconds.
 *
 * @param date - The moment at which to determine the offset.
 * @returns The offset in milliseconds (e.g. 3600000 in winter, 7200000 in summer).
 */
function getZoneOffset(date: Date): number {
  const p = getZonedParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const truncated = date.getTime() - date.getUTCMilliseconds()
  return asUtc - truncated
}

/**
 * Returns the moment at which a calendar day starts (00:00) in Europe/Amsterdam.
 *
 * Out-of-range values roll over, as with `Date.UTC` (e.g. day 32 of January is 1 February).
 *
 * @param year - The calendar year.
 * @param month - The month (1-12).
 * @param day - The day of the month.
 * @returns The start of the day in Europe/Amsterdam.
 */
export function startOfDayInFdmTimeZone(year: number, month: number, day: number): Date {
  const utcMidnight = Date.UTC(year, month - 1, day)
  // Apply the offset twice so the result is correct on days with a DST transition
  let result = utcMidnight - getZoneOffset(new Date(utcMidnight))
  result = utcMidnight - getZoneOffset(new Date(result))
  return new Date(result)
}

/**
 * Normalises an end date to the end of the last day of a period, such as the end date of a field
 * (`b_end`) or of a measure (`m_end`).
 *
 * The end date is the last day of the period, inclusive, as a calendar date in Europe/Amsterdam.
 * The value is stored as the last millisecond of that day (`23:59:59.999` Europe/Amsterdam).
 *
 * If the date is 1 January, it is interpreted as "not active anymore from this date" and stored
 * as the end of 31 December of the previous year instead. Both conventions for ending a period
 * at the turn of the year therefore lead to the same value, and the period is not part of the new
 * calendar year.
 *
 * The function is idempotent: normalising an already normalised value returns the same value.
 *
 * @param end - The end date as entered.
 * @returns The normalised end date.
 * @throws {Error} If `end` is an invalid date.
 *
 * @example
 * ```ts
 * normalizeEndDate(new Date("2025-12-31")) // 2025-12-31T22:59:59.999Z
 * normalizeEndDate(new Date("2026-01-01")) // 2025-12-31T22:59:59.999Z
 * ```
 */
export function normalizeEndDate(end: Date): Date {
  if (Number.isNaN(end.getTime())) {
    throw new Error("Invalid end date")
  }
  const { year, month, day } = getZonedParts(end)
  // 1 January is treated as the end of 31 December of the previous year (day 0 rolls back)
  const lastDay = month === 1 && day === 1 ? 0 : day
  const startOfNextDay = startOfDayInFdmTimeZone(year, month, lastDay + 1)
  return new Date(startOfNextDay.getTime() - 1)
}
