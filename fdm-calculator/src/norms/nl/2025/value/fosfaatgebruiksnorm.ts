import { withCalculationCache } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import pkg from "../../../../package"
import type { FosfaatGebruiksnormResult } from "../../types"
import { fosfaatNormsData } from "./fosfaatgebruiksnorm-data"
import { determineNLHoofdteelt } from "./hoofdteelt"
import type { FosfaatKlasse, NL2025NormsInput } from "./types.d"

/**
 * Determines if a cultivation is a type of grassland based on its catalogue entry.
 * @param b_lu_catalogue - The cultivation catalogue code.
 * @returns `true` if the catalogue code represents a grassland cultivation, otherwise `false`.
 */
export function isCultivationGrasland(b_lu_catalogue: string): boolean {
    const graslandCodes = ["nl_265", "nl_266", "nl_331", "nl_332", "nl_335"]
    return graslandCodes.includes(b_lu_catalogue)
}

/**
 * Helper function to determine the phosphate class ('Arm', 'Laag', 'Neutraal', 'Ruim', 'Hoog')
 * based on P-CaCl2 and P-Al soil analysis values and land type (grasland/bouwland).
 *
 * This logic is derived directly from "Tabel 1: Grasland (P-CaCl2/P-Al getal)" and
 * "Tabel 2: Bouwland (P-CaCl2/P-Al getal)" in the RVO documentation for 2025.
 *
 * @param a_p_cc - The P-CaCl2 (P-PAE) value from soil analysis.
 * @param a_p_al - The P-Al value from soil analysis.
 * @param is_grasland - True if the land is grassland, false if arable land.
 * @returns The determined `FosfaatKlasse`.
 * @see {@link https://www.rvo.nl/onderwerpen/mest/gebruiken-en-uitrijden/fosfaat-landbouwgrond/differentiatie | RVO Fosfaatdifferentiatie (official page)}
 */
function getFosfaatKlasse(
    a_p_cc: number,
    a_p_al: number,
    is_grasland: boolean,
): FosfaatKlasse {
    // Round P-AL to whole number and convert to Decimal for precise comparisons
    const pAl = new Decimal(a_p_al).toDecimalPlaces(0)

    // Round P-CaCl2 to 1 digit and convert to Decimal for precise comparisons
    const pCc = new Decimal(a_p_cc).toDecimalPlaces(1)

    if (is_grasland) {
        // Logic for Grasland (Table 1)
        if (pCc.lessThan(0.8)) {
            if (pAl.lessThan(21)) return "Arm"
            if (pAl.lessThanOrEqualTo(45)) return "Laag"
            if (pAl.lessThanOrEqualTo(55)) return "Neutraal"
            return "Ruim" // pAl.greaterThan(new Decimal(55))
        }
        if (pCc.lessThanOrEqualTo(1.4)) {
            if (pAl.lessThan(21)) return "Arm"
            if (pAl.lessThanOrEqualTo(30)) return "Laag"
            if (pAl.lessThanOrEqualTo(45)) return "Neutraal"
            return "Ruim" // pAl.greaterThan(new Decimal(45))
        }
        if (pCc.lessThanOrEqualTo(2.4)) {
            if (pAl.lessThan(21)) return "Laag"
            if (pAl.lessThanOrEqualTo(30)) return "Neutraal"
            if (pAl.lessThanOrEqualTo(55)) return "Ruim"
            return "Hoog" // pAl.greaterThan(new Decimal(55))
        }
        if (pCc.lessThanOrEqualTo(3.4)) {
            if (pAl.lessThan(21)) return "Neutraal"
            if (pAl.lessThanOrEqualTo(45)) return "Ruim"
            return "Hoog" // pAl.greaterThan(new Decimal(45))
        }
        // pCc.greaterThan(new Decimal(3.4))
        if (pAl.lessThan(31)) return "Ruim"
        return "Hoog" // pAl.greaterThanOrEqualTo(new Decimal(31))
    }

    // Logic for Bouwland (Table 2)
    if (pCc.lessThan(0.8)) {
        if (pAl.lessThan(46)) return "Arm"
        return "Laag" // pAl.greaterThanOrEqualTo(new Decimal(46))
    }
    if (pCc.lessThanOrEqualTo(1.4)) {
        if (pAl.lessThan(46)) return "Arm"
        if (pAl.lessThanOrEqualTo(55)) return "Laag"
        return "Neutraal" // pAl.greaterThan(new Decimal(55))
    }
    if (pCc.lessThanOrEqualTo(2.4)) {
        if (pAl.lessThan(31)) return "Arm"
        if (pAl.lessThanOrEqualTo(45)) return "Laag"
        if (pAl.lessThanOrEqualTo(55)) return "Neutraal"
        return "Ruim" // pAl.greaterThan(new Decimal(55))
    }
    if (pCc.lessThanOrEqualTo(3.4)) {
        if (pAl.lessThan(21)) return "Arm"
        if (pAl.lessThanOrEqualTo(30)) return "Laag"
        if (pAl.lessThanOrEqualTo(45)) return "Neutraal"
        if (pAl.lessThanOrEqualTo(55)) return "Ruim"
        return "Hoog" // pAl.greaterThan(new Decimal(55))
    }
    // pCc.greaterThan(new Decimal(3.4))
    if (pAl.lessThan(31)) return "Laag"
    if (pAl.lessThanOrEqualTo(45)) return "Neutraal"
    if (pAl.lessThanOrEqualTo(55)) return "Ruim"
    return "Hoog" // pAl.greaterThan(new Decimal(55))
}

/**
 * Determines the 'gebruiksnorm' (usage standard) for phosphate for a given field
 * based on its land type (grasland/bouwland) and soil phosphate condition,
 * derived from P-CaCl2 and P-Al soil analysis values.
 *
 * This function implements the "Tabel Fosfaatgebruiksnormen 2025" and the
 * "Differentiatie fosfaatgebruiksnorm 2025" rules from RVO.
 *
 * @param input - An object containing all necessary parameters for the calculation.
 *   See {@link FosfaatGebruiksnormInput} for details.
 * @returns An object of type `FosfaatGebruiksnormResult` containing the determined
 *   phosphate usage standard (`normValue`) and the `fosfaatKlasse` (the phosphate
 *   class determined from the soil analysis).
 * @throws {Error} If soil analysis data is missing or no phosphate norms are found for the determined class.
 *
 * @remarks
 * The function operates as follows:
 * 1.  **Determine Phosphate Class**: The `getFosfaatKlasse` helper function is used
 *     to classify the soil's phosphate condition ('Arm', 'Laag', 'Neutraal', 'Ruim', 'Hoog')
 *     based on the provided `a_p_cc` and `a_p_al` values and whether it's grassland or arable land.
 *     This classification directly uses the lookup tables provided by RVO for 2025.
 * 2.  **Retrieve Base Norm**: The determined `fosfaatKlasse` is then used to look up the
 *     corresponding base phosphate norm from the `fosfaatgebruiksnorm-data.ts` file.
 * 3.  **Apply Land Type**: The specific norm for either `grasland` or `bouwland` is selected
 *     from the base norm based on the `is_grasland` input parameter.
 * 4.  **Return Result**: The function returns the final `normValue` and the `fosfaatKlasse`.
 *
 * @see {@link https://www.rvo.nl/onderwerpen/mest/gebruiken-en-uitrijden/fosfaat-landbouwgrond | RVO Fosfaat landbouwgrond (official page)}
 * @see {@link https://www.rvo.nl/onderwerpen/mest/gebruiken-en-uitrijden/fosfaat-landbouwgrond/differentiatie | RVO Fosfaatdifferentiatie (official page, including tables for 2025)}
 */
export async function calculateNL2025FosfaatGebruiksNorm(
    input: NL2025NormsInput,
): Promise<FosfaatGebruiksnormResult> {
    const field = input.field
    // Check for buffer strip
    if (field.b_bufferstrip) {
        return {
            normValue: 0,
            normSource: "Bufferstrook: geen plaatsingsruimte",
        }
    }

    const cultivations = input.cultivations
    const a_p_cc = input.soilAnalysis.a_p_cc
    const a_p_al = input.soilAnalysis.a_p_al

    if (
        a_p_al === null ||
        a_p_al === undefined ||
        a_p_cc === null ||
        a_p_cc === undefined
    ) {
        throw new Error(
            "Missing soil analysis data for NL 2025 Fosfaatgebruiksnorm",
        )
    }

    const b_lu_catalogue = determineNLHoofdteelt(cultivations, 2025)
    const is_grasland = isCultivationGrasland(b_lu_catalogue)

    // Determine the phosphate class based on soil analysis values and land type.
    const fosfaatKlasse = getFosfaatKlasse(a_p_cc, a_p_al, is_grasland)

    // Retrieve the base norms for the determined phosphate class.
    const normsForKlasse = fosfaatNormsData[fosfaatKlasse]

    if (!normsForKlasse) {
        throw new Error(`No phosphate norms found for class ${fosfaatKlasse}.`)
    }

    // Select the specific norm based on whether it's grassland or arable land.
    const normValue = is_grasland
        ? normsForKlasse.grasland
        : normsForKlasse.bouwland
    const normSource = is_grasland
        ? `Grasland: ${fosfaatKlasse}`
        : `Bouwland: ${fosfaatKlasse}`

    return { normValue, normSource }
}

/**
 * Memoized version of {@link calculateNL2025FosfaatGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2025NormsInput} input - An object containing all necessary parameters for the calculation.
 * @returns {Promise<FosfaatGebruiksnormResult>} An object of type `FosfaatGebruiksnormResult` containing the determined
 *   phosphate usage standard (`normValue`) and the `fosfaatKlasse` (the phosphate
 *   class determined from the soil analysis). Returns `null` if a norm cannot be determined.
 */
export const getNL2025FosfaatGebruiksNorm = withCalculationCache(
    calculateNL2025FosfaatGebruiksNorm,
    "calculateNL2025FosfaatGebruiksNorm",
    pkg.calculatorVersion,
)
