import type { Timeframe } from "@nmi-agro/fdm-core"
import type { FieldAvailability } from "~/components/blocks/field/not-available-for-year"

/**
 * Determines whether a field is managed during (part of) the timeframe, using the same rule as
 * `getFields` in fdm-core.
 *
 * @param field - The start date and last day the field is managed.
 * @param timeframe - The timeframe, usually the selected calendar year.
 * @returns `null` when the field is managed during the timeframe, `"not_started"` when it starts
 * after the timeframe, or `"ended"` when it ended before the timeframe.
 */
export function getFieldAvailability(
  field: { b_start: Date | string | null; b_end: Date | string | null },
  timeframe: Timeframe,
): FieldAvailability | null {
  const b_start = field.b_start ? new Date(field.b_start) : null
  const b_end = field.b_end ? new Date(field.b_end) : null
  if (timeframe.end && b_start && b_start > timeframe.end) {
    return "not_started"
  }
  if (timeframe.start && b_end && b_end < timeframe.start) {
    return "ended"
  }
  return null
}
