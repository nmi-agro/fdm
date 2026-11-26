import { withCalculationCache } from "@nmi-agro/fdm-core"
import type { GebruiksnormResult } from "../../types"
import type { NL2027NormsInput } from "./types"
import pkg from "../../../../package"

/**
 * Determines the 'gebruiksnorm' (usage standard) for nitrogen from Renure
 * ("REcovered Nitrogen from manURE") products for a given field in the
 * Netherlands for the year 2027.
 *
 * Renure (RVO mestcodes 130-134) is exempt from the 170 kg N/ha
 * dierlijke-mest norm and instead has its own ceiling, on top of that
 * norm, while still counting fully toward the total-N and phosphate norms.
 *
 * @param input - An object of type `NL2027NormsInput` containing all necessary data.
 * @returns An object of type `GebruiksnormResult` containing the determined
 *   Renure nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 *
 * @remarks
 * The rules for 2027 are as follows:
 * - **Standard Norm**: The norm is 80 kg N/ha from Renure, on top of the 170 kg dierlijke-mest norm.
 * - Applies to the whole calendar year (Renure has been legally recognized since 12 June 2026).
 * - **Provisional**: the 2027 rules are a copy of 2026 until the official 2027 RVO tables are published.
 */
export async function calculateNL2027RenureGebruiksNorm(
  input: NL2027NormsInput,
): Promise<GebruiksnormResult> {
  const field = input.field

  // Check for buffer strip
  if (field.b_bufferstrip) {
    return {
      normValue: 0,
      normSource: "Bufferstrook: geen plaatsingsruimte",
    }
  }

  const normValue = 80
  const normSource = ""

  return { normValue, normSource }
}

/**
 * Memoized version of {@link calculateNL2027RenureGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the function name and the current calculator version.
 *
 * @returns {Promise<GebruiksnormResult>} An object of type `GebruiksnormResult` containing the determined
 *   Renure nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 */
export const getNL2027RenureGebruiksNorm = withCalculationCache(
  calculateNL2027RenureGebruiksNorm,
  "calculateNL2027RenureGebruiksNorm",
  pkg.calculatorVersion,
)
