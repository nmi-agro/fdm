import { differenceInCalendarDays } from "date-fns"
import Decimal from "decimal.js"
import type { NitrogenEmissionNitrousOxideSoil, SoilAnalysisPicked } from "../../types"
import { YEARLY_N2O_ORGANIC_SOILS } from "./constants"
import { toEmission } from "./conversion"

/**
 * Calculates the direct nitrous oxide (N₂O) emission from the mineralisation of organic soils.
 *
 * Peat (`veen`) and peaty soils (`moerige_klei`) have a yearly emission (NEMA WOT-283, section 3.4).
 * The yearly value is scaled to the length of the time frame, in the same way as the nitrogen
 * deposition: (number of days + 1) / 365. Other soils have no emission from mineralisation.
 *
 * @param soilAnalysis - The soil parameters of the field; `b_soiltype_agr` is used.
 * @param timeFrame - The period of the calculation for this field. When the end is before the start,
 * the field has no overlap with the time frame and gets no emission.
 * @returns The N₂O emission over the time frame (kg N / ha, as N₂O-N, negative or zero).
 *
 * @example
 * ```ts
 * calculateNitrogenEmissionViaNitrousOxideBySoil(
 *   { b_soiltype_agr: "veen" },
 *   { start: new Date("2025-01-01"), end: new Date("2025-12-31") },
 * )
 * // { total: Decimal(-4.67) }
 * ```
 */
export function calculateNitrogenEmissionViaNitrousOxideBySoil(
  soilAnalysis: Pick<SoilAnalysisPicked, "b_soiltype_agr">,
  timeFrame: { start: Date; end: Date },
): NitrogenEmissionNitrousOxideSoil {
  const b_soiltype_agr = soilAnalysis.b_soiltype_agr
  const yearlyEmission = b_soiltype_agr ? YEARLY_N2O_ORGANIC_SOILS[b_soiltype_agr] : undefined
  if (yearlyEmission === undefined) {
    return { total: new Decimal(0) }
  }
  const days = differenceInCalendarDays(timeFrame.end, timeFrame.start)
  if (days < 0) {
    return { total: new Decimal(0) }
  }
  return { total: toEmission(new Decimal(yearlyEmission).times(days + 1).dividedBy(365)) }
}
