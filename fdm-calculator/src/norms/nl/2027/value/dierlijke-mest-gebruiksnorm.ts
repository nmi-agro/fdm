import { withCalculationCache } from "@nmi-agro/fdm-core"
import type { DierlijkeMestGebruiksnormResult } from "../../types"
import type { NL2027NormsInput } from "./types"
import pkg from "../../../../package"

/**
 * Determines the 'gebruiksnorm' (usage standard) for nitrogen from animal manure
 * for a given farm and parcel in the Netherlands for the year 2027.
 *
 * This function implements the rules and norms specified by the RVO for 2027.
 *
 * @param input - An object of type `NL2027NormsInput` containing all necessary data.
 * @returns An object of type `DierlijkeMestGebruiksnormResult` containing the determined
 *   nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 *
 * @remarks
 * The rules for 2027 are as follows:
 * - **Standard Norm**: The norm is 170 kg N/ha from animal manure.
 * - **No Derogation**: Derogation rules do not apply for 2027.
 * - **Provisional**: the 2027 rules are a copy of 2026 until the official 2027 RVO tables are published.
 */
export async function calculateNL2027DierlijkeMestGebruiksNorm(
  input: NL2027NormsInput,
): Promise<DierlijkeMestGebruiksnormResult> {
  const field = input.field

  // Check for buffer strip
  if (field.b_bufferstrip) {
    return {
      normValue: 0,
      normSource: "Bufferstrook: geen plaatsingsruimte",
    }
  }

  const normValue = 170
  const normSource = "Standaard - geen derogatie"

  return { normValue, normSource }
}

/**
 * Memoized version of {@link calculateNL2027DierlijkeMestGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the function name and the current calculator version.
 *
 * @returns {Promise<DierlijkeMestGebruiksnormResult>} An object of type `DierlijkeMestGebruiksnormResult` containing the determined
 *   nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 */
export const getNL2027DierlijkeMestGebruiksNorm = withCalculationCache(
  calculateNL2027DierlijkeMestGebruiksNorm,
  "calculateNL2027DierlijkeMestGebruiksNorm",
  pkg.calculatorVersion,
)
