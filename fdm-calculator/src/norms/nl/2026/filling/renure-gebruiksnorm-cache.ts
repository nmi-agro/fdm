import { withCalculationCache } from "@nmi-agro/fdm-core"
import pkg from "../../../../package"
import { calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm } from "./renure-gebruiksnorm"

/**
 * Memoized version of {@link calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2026NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total nitrogen usage (`normFilling`) and a detailed breakdown per application (`applicationFilling`).
 */
export const getNL2026FertilizerApplicationFillingForRenureGebruiksNorm = withCalculationCache(
  calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
  "calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm",
  pkg.calculatorVersion,
)
