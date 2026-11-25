/** End of a period; `null` or `undefined` means the period has not ended. */
export type IntervalEnd = Date | null | undefined

/**
 * Validates a half-open interval [start, end).
 * `end = null/undefined` means an open-ended interval.
 */
export function assertIntervalEndNotBeforeStart(
  start: Date,
  end: IntervalEnd,
  intervalName: string,
): void {
  if (end != null && end.getTime() < start.getTime()) {
    throw new Error(`${intervalName}: end cannot be earlier than start`)
  }
}

/**
 * Returns true when two half-open intervals overlap:
 * [aStart, aEnd) and [bStart, bEnd), where null/undefined end means +∞.
 */
export function overlapsHalfOpen(
  aStart: Date,
  aEnd: IntervalEnd,
  bStart: Date,
  bEnd: IntervalEnd,
): boolean {
  const aEndMs = aEnd?.getTime() ?? Number.POSITIVE_INFINITY
  const bEndMs = bEnd?.getTime() ?? Number.POSITIVE_INFINITY
  return aStart.getTime() < bEndMs && bStart.getTime() < aEndMs
}

const MS_PER_DAY = 86_400_000

/** Number of the (UTC) calendar day of a timestamp. */
export function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY)
}

/**
 * Returns true when two periods share a calendar day. Both the start day and the end day belong
 * to a period, so a period of one day (start and end on the same day) shares that day with every
 * other period that includes it. Days are UTC calendar days, as dates such as `2025-06-15` are
 * stored at UTC midnight. A null/undefined end means the period has not ended.
 */
export function sharesCalendarDay(
  aStart: Date,
  aEnd: IntervalEnd,
  bStart: Date,
  bEnd: IntervalEnd,
): boolean {
  const aEndDay = aEnd ? dayNumber(aEnd) : Number.POSITIVE_INFINITY
  const bEndDay = bEnd ? dayNumber(bEnd) : Number.POSITIVE_INFINITY
  return dayNumber(aStart) <= bEndDay && dayNumber(bStart) <= aEndDay
}
