import { withCalculationCache } from "@nmi-agro/fdm-core"
import type { NormFilling } from "../../types"
import type { NL2027NormsFillingInput } from "./types"
import pkg from "../../../../package"
import { getRegion } from "../../2025/value/stikstofgebruiksnorm"
import { calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNormWithRegion } from "./stikstofgebruiksnorm"

/**
 * Calculates the nitrogen utilization norm filling for a set of fertilizer applications.
 * This function determines the amount of effective nitrogen applied, taking into account
 * fertilizer type, nitrogen content, working coefficients, soil type, grazing intention,
 * and land use (bouwland/arable land).
 *
 * The soil region is looked up from the field centroid. Use {@link calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNormWithRegion} when the
 * region is already known.
 *
 * @param {NL2027NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {Promise<NormFilling>} An object containing the total norm filling and details for each application.
 */
export async function calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm(
  input: NL2027NormsFillingInput,
): Promise<NormFilling> {
  return calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNormWithRegion(
    input,
    await getRegion(input.b_centroid),
  )
}

/**
 * Memoized version of {@link calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2027NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {Promise<NormFilling>} An object containing the total norm filling and details for each application.
 */
export const getNL2027FertilizerApplicationFillingForStikstofGebruiksNorm = withCalculationCache(
  calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
  "calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm",
  pkg.calculatorVersion,
)
