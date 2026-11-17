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
 * Adjusts an end date on 1 January to the end of 31 December of the previous year, such as the end
 * date of a field (`b_end`) or of a measure (`m_end`).
 *
 * An end date on 1 January (as a calendar date in Europe/Amsterdam) is interpreted as "not active
 * anymore from this date", so the period is not part of the new calendar year. It is returned as
 * the last millisecond of 31 December of the previous year (`23:59:59.999` Europe/Amsterdam).
 * Any other date, including an invalid date, is returned unchanged.
 *
 * The end dates are stored as entered; this adjustment is applied when they are read.
 *
 * @param end - The end date as stored.
 * @returns The adjusted end date.
 *
 * @example
 * ```ts
 * adjustEndDateAtYearStart(new Date("2026-01-01")) // 2025-12-31T22:59:59.999Z
 * adjustEndDateAtYearStart(new Date("2025-12-31")) // 2025-12-31T00:00:00.000Z (unchanged)
 * ```
 */
export function adjustEndDateAtYearStart(end: Date): Date {
  if (Number.isNaN(end.getTime())) {
    return end
  }
  const { year, month, day } = getZonedParts(end)
  if (month !== 1 || day !== 1) {
    return end
  }
  return new Date(startOfDayInFdmTimeZone(year, 1, 1).getTime() - 1)
}

/**
 * Formats a moment as its calendar date in Europe/Amsterdam.
 *
 * @param date - The moment to format.
 * @returns The calendar date as `YYYY-MM-DD`.
 *
 * @example
 * ```ts
 * toFdmDateString(new Date("2025-12-30T23:00:00Z")) // "2025-12-31"
 * ```
 */
export function toFdmDateString(date: Date): string {
  const { year, month, day } = getZonedParts(date)
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
