import { withCalculationCache } from "@nmi-agro/fdm-core"
import pkg from "../../../../package"
import { calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm } from "./renure-gebruiksnorm"

/**
 * Memoized version of {@link calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2027NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total nitrogen usage (`normFilling`) and a detailed breakdown per application (`applicationFilling`).
 */
export const getNL2027FertilizerApplicationFillingForRenureGebruiksNorm = withCalculationCache(
  calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm,
  "calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm",
  pkg.calculatorVersion,
)
