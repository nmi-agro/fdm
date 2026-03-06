import { withCalculationCache } from "@nmi-agro/fdm-core"
import pkg from "../../../../package"
import type { DierlijkeMestGebruiksnormResult } from "../../types"

import type { NL2026NormsInput } from "./types"

/**
 * Determines the 'gebruiksnorm' (usage standard) for nitrogen from animal manure
 * for a given farm and parcel in the Netherlands for the year 2026.
 *
 * This function implements the rules and norms specified by the RVO for 2026.
 *
 * @param input - An object of type `NL2026NormsInput` containing all necessary data.
 * @returns An object of type `DierlijkeMestGebruiksnormResult` containing the determined
 *   nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 *
 * @remarks
 * The rules for 2026 are as follows:
 * - **Standard Norm**: The norm is 170 kg N/ha from animal manure.
 * - **No Derogation**: Derogation rules do not apply for 2026.
 */
export async function calculateNL2026DierlijkeMestGebruiksNorm(
    input: NL2026NormsInput,
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
 * Memoized version of {@link calculateNL2026DierlijkeMestGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the function name and the current calculator version.
 *
 * @returns {Promise<DierlijkeMestGebruiksnormResult>} An object of type `DierlijkeMestGebruiksnormResult` containing the determined
 *   nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 */
export const getNL2026DierlijkeMestGebruiksNorm = withCalculationCache(
    calculateNL2026DierlijkeMestGebruiksNorm,
    "calculateNL2026DierlijkeMestGebruiksNorm",
    pkg.calculatorVersion,
)
