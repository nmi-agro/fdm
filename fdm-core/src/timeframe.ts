import { and, gte, isNull, lte, or, type AnyColumn, type SQL } from "drizzle-orm"

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

/**
 * Combines an optional timeframe with a base predicate on a period with a start and an optional
 * end, keeping every period that overlaps the timeframe. A period without an end is open and
 * overlaps every timeframe that ends on or after its start.
 *
 * @param baseWhere - The existing predicate to combine with the timeframe bounds.
 * @param startColumn - The column with the start of the period.
 * @param endColumn - The column with the end of the period; null means the period is open.
 * @param timeframe - Optional start and/or end date bounds.
 * @returns The combined predicate.
 */
export function withPeriodTimeframe(
  baseWhere: SQL | undefined,
  startColumn: AnyColumn,
  endColumn: AnyColumn,
  timeframe?: Timeframe,
): SQL | undefined {
  const conditions: Array<SQL | undefined> = [baseWhere]
  if (timeframe?.end) {
    conditions.push(lte(startColumn, timeframe.end))
  }
  if (timeframe?.start) {
    conditions.push(or(isNull(endColumn), gte(endColumn, timeframe.start)))
  }
  return conditions.length === 1 ? baseWhere : and(...conditions)
}
