import { withCalculationCache } from "@nmi-agro/fdm-core"
import type { GebruiksnormResult } from "../../types"
import type { NL2026NormsInput } from "./types"
import pkg from "../../../../package"

/**
 * Determines the 'gebruiksnorm' (usage standard) for nitrogen from Renure
 * ("REcovered Nitrogen from manURE") products for a given field in the
 * Netherlands for the year 2026.
 *
 * Renure (RVO mestcodes 130-134) is exempt from the 170 kg N/ha
 * dierlijke-mest norm and instead has its own ceiling, on top of that
 * norm, while still counting fully toward the total-N and phosphate norms.
 *
 * @param input - An object of type `NL2026NormsInput` containing all necessary data.
 * @returns An object of type `GebruiksnormResult` containing the determined
 *   Renure nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 *
 * @remarks
 * The rules for 2026 are as follows:
 * - **Standard Norm**: The norm is 80 kg N/ha from Renure, on top of the 170 kg dierlijke-mest norm.
 * - Effective from 12 June 2026 (Renure was not legally recognized before 2026).
 */
export async function calculateNL2026RenureGebruiksNorm(
  input: NL2026NormsInput,
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
 * Memoized version of {@link calculateNL2026RenureGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the function name and the current calculator version.
 *
 * @returns {Promise<GebruiksnormResult>} An object of type `GebruiksnormResult` containing the determined
 *   Renure nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 */
export const getNL2026RenureGebruiksNorm = withCalculationCache(
  calculateNL2026RenureGebruiksNorm,
  "calculateNL2026RenureGebruiksNorm",
  pkg.calculatorVersion,
)
