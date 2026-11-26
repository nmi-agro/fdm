import { withCalculationCache } from "@nmi-agro/fdm-core"
import pkg from "../../../../package"
import { calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./fosfaatgebruiksnorm"

/**
 * Memoized version of {@link calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2027NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total norm filling and a breakdown per application.
 */
export const getNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm = withCalculationCache(
  calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm,
  "calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm",
  pkg.calculatorVersion,
)
