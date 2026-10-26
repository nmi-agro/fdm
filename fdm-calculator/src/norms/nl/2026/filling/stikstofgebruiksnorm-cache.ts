import { withCalculationCache } from "@nmi-agro/fdm-core"
import type { NormFilling } from "../../types"
import type { NL2026NormsFillingInput } from "./types"
import pkg from "../../../../package"
import { getRegion } from "../../2025/value/stikstofgebruiksnorm"
import { calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNormWithRegion } from "./stikstofgebruiksnorm"

/**
 * Calculates the nitrogen utilization norm filling for a set of fertilizer applications.
 * This function determines the amount of effective nitrogen applied, taking into account
 * fertilizer type, nitrogen content, working coefficients, soil type, grazing intention,
 * and land use (bouwland/arable land).
 *
 * The soil region is looked up from the field centroid. Use {@link calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNormWithRegion} when the
 * region is already known.
 *
 * @param {NL2026NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {Promise<NormFilling>} An object containing the total norm filling and details for each application.
 */
export async function calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm(
  input: NL2026NormsFillingInput,
): Promise<NormFilling> {
  return calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNormWithRegion(
    input,
    await getRegion(input.b_centroid),
  )
}

/**
 * Memoized version of {@link calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2026NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {Promise<NormFilling>} An object containing the total norm filling and details for each application.
 */
export const getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm = withCalculationCache(
  calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
  "calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm",
  pkg.calculatorVersion,
)
