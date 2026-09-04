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
