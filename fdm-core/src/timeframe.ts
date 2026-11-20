import { and, gte, lte, type AnyColumn, type SQL } from "drizzle-orm"

type Start = Date | null | undefined
type End = Date | null | undefined

export type Timeframe = {
  start: Start
  end: End
}

/**
 * Combines an optional timeframe's start/end bounds with a base predicate on a date column.
 * Handles the four cases (no bounds, start only, end only, both) so call sites don't need
 * to repeat the same conditional ladder.
 *
 * @param baseWhere - The existing predicate to combine with the timeframe bounds.
 * @param dateColumn - The date column the timeframe bounds are applied to.
 * @param timeframe - Optional start and/or end date bounds.
 * @returns The combined predicate.
 */
export function withTimeframe(
  baseWhere: SQL | undefined,
  dateColumn: AnyColumn,
  timeframe?: Timeframe,
): SQL | undefined {
  if (timeframe?.start && timeframe?.end) {
    return and(baseWhere, gte(dateColumn, timeframe.start), lte(dateColumn, timeframe.end))
  }
  if (timeframe?.start) {
    return and(baseWhere, gte(dateColumn, timeframe.start))
  }
  if (timeframe?.end) {
    return and(baseWhere, lte(dateColumn, timeframe.end))
  }
  return baseWhere
}
