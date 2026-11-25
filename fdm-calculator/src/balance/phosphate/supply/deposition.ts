import { addDays, differenceInDays } from "date-fns"
import Decimal from "decimal.js"
import type { PhosphateSupplyDeposition } from "../types"

/** Atmospheric P deposition (kg P2O5 / ha / year). Small but included for completeness. */
const PHOSPHATE_DEPOSITION_PER_YEAR = 0.7

/** Number of years in the timeframe (days / 365), as in the organic matter balance. */
export function yearsInTimeframe(timeFrame: { start: Date; end: Date }): Decimal {
  return new Decimal(differenceInDays(addDays(timeFrame.end, 1), timeFrame.start)).dividedBy(365)
}

/**
 * Atmospheric phosphate deposition (kg P2O5 / ha for the timeframe): 0.7 kg P2O5 / ha / year.
 *
 * @param timeFrame - The timeframe of the balance.
 * @returns The deposition.
 */
export function calculatePhosphateDeposition(timeFrame: {
  start: Date
  end: Date
}): PhosphateSupplyDeposition {
  return {
    total: new Decimal(PHOSPHATE_DEPOSITION_PER_YEAR).times(yearsInTimeframe(timeFrame)).toNumber(),
  }
}
