import { withCalculationCache } from "@nmi-agro/fdm-core"
import pkg from "../../../../package"
import { calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./dierlijke-mest-gebruiksnorm"

/**
 * Memoized version of {@link calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2025NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total nitrogen usage (`normFilling`) and a detailed breakdown per application (`applicationFilling`).
 */
export const getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm =
  withCalculationCache(
    calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    "calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm",
    pkg.calculatorVersion,
  )
