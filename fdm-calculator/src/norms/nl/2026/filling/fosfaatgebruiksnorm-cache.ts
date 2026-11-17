import { withCalculationCache } from "@nmi-agro/fdm-core"
import pkg from "../../../../package"
import { calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./fosfaatgebruiksnorm"

/**
 * Memoized version of {@link calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2026NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total norm filling and a breakdown per application.
 */
export const getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm = withCalculationCache(
  calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
  "calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm",
  pkg.calculatorVersion,
)
