import { type Field, withCalculationCache } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import pkg from "../../../../package"
import { getGeoTiffValue } from "../../../../shared/geotiff"
import { getFdmPublicDataUrl } from "../../../../shared/public-data-url"
import { nonBouwlandCodes } from "../../constant"
import type { GebruiksnormResult } from "../../types"
import { determineNLHoofdteelt } from "./hoofdteelt"
import { nitrogenStandardsData } from "./stikstofgebruiksnorm-data"
import type {
    NitrogenStandard,
    NL2025NormsInput,
    NL2025NormsInputForCultivation,
    NormsByRegion,
    RegionKey,
} from "./types"

/**
 * Determines if a field is located within a met nutriënten verontreinigde gebied (NV-gebied) in the Netherlands.
 * This is achieved by querying a GeoTIFF file that delineates NV-gebieden.
 * The function checks the value at the field's centroid coordinates.
 *
 * @param b_centroid - An array containing the `longitude` and `latitude` of the field's centroid.
 *   This point is used to query the GeoTIFF data.
 * @returns A promise that resolves to `true` if the GeoTIFF value at the centroid is 1 (indicating it is within an NV-gebied),
 *   and `false` if the value is 0.
 * @throws {Error} If the GeoTIFF returns an unexpected value, or if there are issues fetching or processing the file.
 */
export async function isFieldInNVGebied(
    b_centroid: Field["b_centroid"],
): Promise<boolean> {
    const fdmPublicDataUrl = getFdmPublicDataUrl()
    const url = `${fdmPublicDataUrl}norms/nl/2025/nv.tiff`
    const longitude = b_centroid[0]
    const latitude = b_centroid[1]
    const NVGebiedCode = await getGeoTiffValue(url, longitude, latitude)

    switch (NVGebiedCode) {
        case 1: {
            return true
        }
        case 0: {
            return false
        }
        default: {
            return false
        }
    }
}

/**
 * Determines the soil region for a given field based on its geographical coordinates.
 *
 * This function queries a GeoTIFF file representing the official "grondsoortenkaart"
 * from the Dutch Meststoffenwet (Manure Law). It identifies whether the field's centroid
 * falls within one of the predefined soil regions: "klei", "loess", "veen", "zand_nwc", or "zand_zuid".
 *
 * The soil region is a critical factor in determining the applicable nitrogen usage norms,
 * as these standards vary significantly between different soil types.
 *
 * @param b_centroid - A tuple containing the longitude and latitude of the field's centroid.
 *   This coordinate is used to look up the corresponding value in the GeoTIFF file.
 * @returns A promise that resolves to a `RegionKey`, which is a string literal representing the soil region
 *   (e.g., "zand_nwc", "klei").
 * @throws {Error} If the GeoTIFF file cannot be fetched, if the coordinates fall outside the bounds of the map,
 *   or if the returned region code is unknown.
 *
 */
export async function getRegion(
    b_centroid: Field["b_centroid"],
): Promise<RegionKey> {
    const fdmPublicDataUrl = getFdmPublicDataUrl()
    const url = `${fdmPublicDataUrl}norms/nl/2024/grondsoorten.tiff`
    const longitude = b_centroid[0]
    const latitude = b_centroid[1]
    const grondoortCode = await getGeoTiffValue(url, longitude, latitude)

    switch (grondoortCode) {
        case 1: {
            return "klei"
        }
        case 2: {
            return "loess"
        }
        case 3: {
            return "veen"
        }
        case 4: {
            return "zand_nwc"
        }
        case 5: {
            return "zand_zuid"
        }
        default: {
            throw new Error(
                `Unknown region code: ${grondoortCode} for coordinates ${longitude}, ${latitude}`,
            )
        }
    }
}

/**
 * Retrieves the appropriate set of nitrogen norms (`NormsByRegion`) for a given cultivation.
 * This function applies a set of specific rules and conditions to select the most accurate
 * norm from the available `NitrogenStandard` data, considering factors like cultivation
 * sub-types, specific varieties, and farm derogation status.
 *
 * @param selectedStandard - The base `NitrogenStandard` object that broadly matches the cultivation.
 *   This object contains various norm categories (e.g., general, sub-type specific, variety-specific).
 * @param b_lu_variety - Optional. The specific variety of the cultivation (e.g., a potato variety).
 *   This is used to apply variety-specific norms where applicable.
 * @param is_derogatie_bedrijf - Optional. A boolean indicating if the farm operates under
 *   derogation. This is relevant for certain crops like maize, which have different norms
 *   for derogated vs. non-derogated farms.
 * @param b_lu_end - The termination date of the cultivation. This is crucial for determining
 *   applicable sub-type periods, especially for temporary grasslands where norms can vary
 *   based on the period of the year.
 * @returns A `NormsByRegion` object containing standard and NV-gebied norms for all regions
 *   (e.g., "zand_nwc", "zand_zuid", "klei", "veen", "loess") that apply to the specific cultivation and conditions.
 *   Returns `undefined` if no applicable norms can be found based on the provided criteria.
 *
 * @remarks
 * The function prioritizes norm selection based on the following hierarchy:
 * 1.  **Sub-Type Norms (e.g., Temporary Grasslands)**:
 *     If `selectedStandard` has `sub_types` defined (e.g., for temporary grasslands),
 *     it checks if the `b_lu_end` date falls within any of the specified `period_start_month`
 *     and `period_end_month` ranges. If a matching sub-type period is found, its associated
 *     norms are returned. This ensures that time-sensitive norms are correctly applied.
 * 2.  **Variety-Specific Norms (e.g., Potatoes)**:
 *     If the `selectedStandard` is for "aardappel" (potato) and `b_lu_variety` is provided,
 *     the function checks if the variety matches any in `varieties_hoge_norm` (high norms)
 *     or `varieties_lage_norm` (low norms). If a match is found, the corresponding norms
 *     (`norms_hoge_norm` or `norms_lage_norm`) are returned. If the variety doesn't match
 *     these specific lists, it falls back to `norms_overig` (other) potato norms if available.
 * 3.  **Derogation-Specific Norms (e.g., Maize)**:
 *     If the `selectedStandard` is for "akkerbouw" and specifically "Akkerbouwgewassen, mais",
 *     it checks the `is_derogatie_bedrijf` status. If the farm is derogated, `derogatie_norms`
 *     are returned; otherwise, `non_derogatie_norms` are returned. This ensures that norms
 *     are correctly applied based on the farm's legal status.
 * 4.  **Default Norms**:
 *     If none of the above specific conditions are met, the function defaults to returning
 *     the primary `norms` defined directly within the `selectedStandard` object.
 *
 * This structured approach ensures that the most specific and applicable nitrogen norm
 * is always retrieved for the given cultivation context.
 */
function getNormsForCultivation(
    selectedStandard: NitrogenStandard,
    b_lu_end: Date,
    b_lu_start: Date | null | undefined,
    subTypeOmschrijving?: string,
): NormsByRegion | undefined {
    if (selectedStandard.sub_types) {
        type SubType = NonNullable<NitrogenStandard["sub_types"]>[number]
        let matchingSubType: SubType | undefined

        // 1. Check for a direct match on omschrijving
        if (subTypeOmschrijving) {
            matchingSubType = selectedStandard.sub_types.find(
                (sub) => sub.omschrijving === subTypeOmschrijving,
            )
            if (matchingSubType) {
                return matchingSubType.norms
            }
        }

        // 2. Fallback to time-based logic for temporary grasslands if no omschrijving match
        const endDate = new Date(b_lu_end)
        endDate.setHours(12, 0, 0, 0) // Avoid timezone issues at midnight
        const startDate = b_lu_start
            ? new Date(b_lu_start)
            : new Date(endDate.getFullYear(), 0, 1)
        startDate.setHours(12, 0, 0, 0)

        // Find all matching sub-types
        const potentialMatches = selectedStandard.sub_types.filter((sub) => {
            if (sub.period_start_month && sub.period_end_month) {
                const startPeriod = new Date(
                    endDate.getFullYear(),
                    sub.period_start_month - 1,
                    sub.period_start_day ?? 1,
                    12,
                    0,
                    0,
                    0,
                )
                const endPeriod = new Date(
                    endDate.getFullYear(),
                    sub.period_end_month - 1,
                    sub.period_end_day ?? 1,
                    12,
                    0,
                    0,
                    0,
                )

                // Handle periods that might wrap (though none currently do in the data)
                if (sub.period_start_month > sub.period_end_month) {
                    endPeriod.setFullYear(endDate.getFullYear() + 1)
                }

                // Special handling for "vanaf" (Late sowing or summer/autumn teelten)
                // For "vanaf" periods, the crop must start on or after the startPeriod.
                const isVanaf =
                    sub.period_start_month && sub.period_start_month > 1

                if (isVanaf) {
                    // If it's a "tot minstens" period (implied by end month < 12), it must also last until endPeriod.
                    if (sub.period_end_month && sub.period_end_month < 12) {
                        return startDate >= startPeriod && endDate >= endPeriod
                    }
                    // For "vanaf X" (without "tot minstens", e.g. "vanaf 15 oktober"), we only check if it starts on or after X.
                    return startDate >= startPeriod
                }

                // Standard "van 1 januari tot minstens X" logic:
                // Crop must be present from startPeriod (or earlier) to at least endPeriod.
                return startDate <= startPeriod && endDate >= endPeriod
            }
            return false
        })

        // Select the best match
        // Prefer the one with the *earliest* period_start (most specific start requirement)
        // If tied, prefer the one with the *latest* period_end (longest mandated duration = typically higher norm)
        if (potentialMatches.length > 0) {
            potentialMatches.sort((a, b) => {
                const aStart =
                    (a.period_start_month ?? 0) * 100 +
                    (a.period_start_day ?? 0)
                const bStart =
                    (b.period_start_month ?? 0) * 100 +
                    (b.period_start_day ?? 0)
                if (aStart !== bStart) {
                    return aStart - bStart
                }
                const aEnd =
                    (a.period_end_month ?? 0) * 100 + (a.period_end_day ?? 0)
                const bEnd =
                    (b.period_end_month ?? 0) * 100 + (b.period_end_day ?? 0)
                return bEnd - aEnd
            })
            matchingSubType = potentialMatches[0]
        }

        // If no match found using the stricter "minstens" logic, fallback to the original bucket logic
        // to prevent "undefined" regressions for edge cases, but with timezone fix.
        if (!matchingSubType) {
            matchingSubType = selectedStandard.sub_types.find((sub) => {
                if (sub.period_start_month && sub.period_end_month) {
                    const startPeriod = new Date(
                        endDate.getFullYear(),
                        sub.period_start_month - 1,
                        sub.period_start_day || 1,
                        12,
                        0,
                        0,
                        0,
                    )
                    const endPeriod = new Date(
                        endDate.getFullYear(),
                        sub.period_end_month - 1,
                        sub.period_end_day || 1,
                        12,
                        0,
                        0,
                        0,
                    )
                    if (sub.period_start_month > sub.period_end_month) {
                        endPeriod.setFullYear(endDate.getFullYear() + 1)
                    }
                    return endDate >= startPeriod && endDate <= endPeriod
                }
                return false
            })
        }

        return matchingSubType?.norms
    }

    // Default case if no sub_types are defined
    return selectedStandard.norms
}

/**
 * Determines the specific sub-type 'omschrijving' for a cultivation that is part of a larger group.
 * This is necessary for standards that use sub_types to differentiate norms, e.g., for winter vs. summer varieties.
 *
 * @param cultivation - The specific cultivation for which to determine the sub-type.
 * @param standard - The matched NitrogenStandard which may contain sub_types.
 * @param is_derogatie_bedrijf - Optional. A boolean indicating if the farm operates under derogation.
 * @param cultivations - An array of cultivation objects for the current and previous year.
 * @returns The 'omschrijving' of the matching sub-type as a string, or undefined if no specific sub-type applies.
 */
function determineSubTypeOmschrijving(
    cultivation: NL2025NormsInputForCultivation,
    standard: NitrogenStandard,
    is_derogatie_bedrijf: boolean | undefined,
    cultivations: NL2025NormsInputForCultivation[],
    has_grazing_intention: boolean | undefined,
): string | undefined {
    // Grasland logic based on grazing intention
    if (standard.type === "grasland") {
        return has_grazing_intention ? "beweiden" : "volledig maaien"
    }

    // Potato logic based on variety
    if (standard.type === "aardappel") {
        if (cultivation.b_lu_variety) {
            const varietyLower = cultivation.b_lu_variety.toLowerCase()
            const subType = standard.sub_types?.find((sub) =>
                sub.varieties?.some((v) => v.toLowerCase() === varietyLower),
            )
            if (subType) {
                return subType.omschrijving
            }
        }

        // Fallback for potatoes is 'overig' if a variety is present but not in a specific list
        return standard.sub_types?.find((s) => s.omschrijving === "overig")
            ?.omschrijving
    }

    // Maize logic based on derogation status
    if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, mais") {
        return is_derogatie_bedrijf ? "derogatie" : "non-derogatie"
    }

    // Luzerne logic based on cultivation history
    if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, Luzerne") {
        const lucerneCultivationCodes = standard.b_lu_catalogue_match
        const hasLucernceCultivationInPreviousYear = cultivations.some(
            (c) =>
                lucerneCultivationCodes.includes(c.b_lu_catalogue) &&
                c.b_lu_start &&
                c.b_lu_start.getFullYear() <= 2024,
        )
        return hasLucernceCultivationInPreviousYear
            ? "volgende jaren"
            : "eerste jaar"
    }

    // Koolzaad logic based on specific BRP code
    if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, koolzaad") {
        if (cultivation.b_lu_catalogue === "nl_1922") return "winter"
        if (cultivation.b_lu_catalogue === "nl_1923") return "zomer"
    }

    // Gras voor industriële verwerking logic based on cultivation history
    if (
        standard.cultivation_rvo_table2 ===
        "Akkerbouwgewassen, Gras voor industriële verwerking"
    ) {
        const grasCultivationCodes = standard.b_lu_catalogue_match
        const hasGrasCultivationInPreviousYear = cultivations.some(
            (c) =>
                grasCultivationCodes.includes(c.b_lu_catalogue) &&
                c.b_lu_start &&
                c.b_lu_start.getFullYear() <= 2024,
        )
        return hasGrasCultivationInPreviousYear
            ? "inzaai voor 15 mei en volgende jaren"
            : "inzaai in september en eerste jaar"
    }

    // Graszaad, Engels raaigras logic based on cultivation history
    if (
        standard.cultivation_rvo_table2 ===
        "Akkerbouwgewassen, Graszaad, Engels raaigras"
    ) {
        const graszaadCultivationCodes = standard.b_lu_catalogue_match
        const hasGraszaadCultivationInPreviousYear = cultivations.some(
            (c) =>
                graszaadCultivationCodes.includes(c.b_lu_catalogue) &&
                c.b_lu_start &&
                c.b_lu_start.getFullYear() <= 2024,
        )
        return hasGraszaadCultivationInPreviousYear ? "overjarig" : "1e jaars"
    }

    // Roodzwenkgras logic based on cultivation history
    if (
        standard.cultivation_rvo_table2 === "Akkerbouwgewassen, Roodzwenkgras"
    ) {
        const roodzwenkgrasCultivationCodes = standard.b_lu_catalogue_match
        const hasRoodzwenkgrasCultivationInPreviousYear = cultivations.some(
            (c) =>
                roodzwenkgrasCultivationCodes.includes(c.b_lu_catalogue) &&
                c.b_lu_start &&
                c.b_lu_start.getFullYear() <= 2024,
        )
        return hasRoodzwenkgrasCultivationInPreviousYear
            ? "overjarig"
            : "1e jaars"
    }

    // Winterui (Onion) logic based on specific BRP codes
    if (
        standard.cultivation_rvo_table2 ===
        "Akkerbouwgewassen, Ui overig, zaaiui of winterui."
    ) {
        if (cultivation.b_lu_catalogue === "nl_1932") return "1e jaars"
        if (cultivation.b_lu_catalogue === "nl_1933") return "2e jaars"
    }

    // Bladgewassen logic based on hoofdteelt
    const bladgewasRvoTable2s = [
        "Bladgewassen, Spinazie",
        "Bladgewassen, Slasoorten",
        "Bladgewassen, Andijvie eerste teelt volgteelt",
    ]

    if (bladgewasRvoTable2s.includes(standard.cultivation_rvo_table2)) {
        const hoofdteeltCatalogue = determineNLHoofdteelt(cultivations, 2025)
        if (cultivation.b_lu_catalogue === hoofdteeltCatalogue) {
            return "1e teelt"
        }
        // TODO: Implement volgteelt logic here later
    }

    /*
     * --- Cultivations with Unclear Differentiation Logic (may require matching on b_lu string or external context): ---
     * - Bladgewassen, Bladgewassen overig (e.g., "eenmalige oogst" vs. "meermalige oogst")
     * - Kruiden (differentiating between bladgewas, wortelgewassen, zaadgewassen)
     * - Bloembollengewassen, Iris (e.g., "grofbollig" vs. "fijnbollig")
     * - Bloembollengewassen, Krokus (e.g., "grote gele" vs. "overig")
     * - Bloembollengewassen, Gladiool (e.g., "pitten" vs. "kralen")
     */

    return undefined
}

/**
 * Calculates the "korting" (reduction) on the nitrogen usage norm based on the presence
 * of winter crops or catch crops in the previous year.
 *
 * @param cultivations - An array of cultivation objects for the current and previous year.
 * @param region - The soil region of the field (e.g., "zand_nwc", "zand_zuid", "loess").
 * @returns An object containing the reduction amount in kilograms of nitrogen per hectare (kg N/ha) and a description.
 */
function calculateKorting(
    cultivations: NL2025NormsInputForCultivation[],
    region: RegionKey,
    is_derogatie_bedrijf: boolean | undefined,
    is_nv_area: boolean,
): { amount: Decimal; description: string } {
    const currentYear = 2025
    const previousYear = currentYear - 1

    const sandyOrLoessRegions: RegionKey[] = ["zand_nwc", "zand_zuid", "loess"]
    const clayOrPeatRegions: RegionKey[] = ["klei", "veen"]

    // Sort cultivations by start date
    const sortedCultivations = [...cultivations].sort((a, b) => {
        if (!a.b_lu_start || !b.b_lu_start) return 0
        return a.b_lu_start.getTime() - b.b_lu_start.getTime()
    })

    // Find the transition from Grassland to Next Crop in 2025
    for (let i = 0; i < sortedCultivations.length - 1; i++) {
        const prevCult = sortedCultivations[i]
        const currCult = sortedCultivations[i + 1]

        if (!prevCult.b_lu_end || !currCult.b_lu_start) continue

        // Check if transition happens in 2025
        if (prevCult.b_lu_end.getFullYear() !== currentYear) continue

        const currStandard = nitrogenStandardsData.find((ns) =>
            ns.b_lu_catalogue_match.includes(currCult.b_lu_catalogue),
        )

        // 1. Grassland Renewal (Gras-na-Gras) -> 50 kg N/ha korting
        if (
            nonBouwlandCodes.includes(prevCult.b_lu_catalogue) &&
            nonBouwlandCodes.includes(currCult.b_lu_catalogue)
        ) {
            const renewalDate = prevCult.b_lu_end
            let isValidRenewal = false

            if (sandyOrLoessRegions.includes(region)) {
                // Sand/Loess: June 1 - August 31
                if (
                    renewalDate >= new Date(currentYear, 5, 1) && // June 1
                    renewalDate <= new Date(currentYear, 7, 31) // Aug 31
                ) {
                    isValidRenewal = true
                } else {
                    throw new Error(
                        "Graslandvernieuwing op zand- en lössgrond is alleen toegestaan tussen 1 juni en 31 augustus.",
                    )
                }
            } else if (clayOrPeatRegions.includes(region)) {
                if (is_derogatie_bedrijf) {
                    if (is_nv_area) {
                        // Derogation + NV: June 1 - August 31
                        if (
                            renewalDate >= new Date(currentYear, 5, 1) &&
                            renewalDate <= new Date(currentYear, 7, 31)
                        ) {
                            isValidRenewal = true
                        } else {
                            throw new Error(
                                "Graslandvernieuwing op klei- en veengrond (derogatie + NV-gebied) is alleen toegestaan tussen 1 juni en 31 augustus.",
                            )
                        }
                    } else {
                        // Derogation + Non-NV: June 1 - September 15
                        if (
                            renewalDate >= new Date(currentYear, 5, 1) &&
                            renewalDate <= new Date(currentYear, 8, 15)
                        ) {
                            isValidRenewal = true
                        } else {
                            throw new Error(
                                "Graslandvernieuwing op klei- en veengrond (derogatie + niet NV-gebied) is alleen toegestaan tussen 1 juni en 15 september.",
                            )
                        }
                    }
                } else {
                    // Non-Derogation: February 1 - September 15
                    if (
                        renewalDate >= new Date(currentYear, 1, 1) &&
                        renewalDate <= new Date(currentYear, 8, 15)
                    ) {
                        isValidRenewal = true
                    } else {
                        throw new Error(
                            "Graslandvernieuwing op klei- en veengrond (geen derogatie) is alleen toegestaan tussen 1 februari en 15 september.",
                        )
                    }
                }
            }

            if (isValidRenewal) {
                return {
                    amount: new Decimal(50),
                    description: ". Korting: 50kg N/ha: graslandvernieuwing",
                }
            }
        }

        // 2. Grassland Destruction (Gras-naar-Bouwland) -> 65 kg N/ha korting
        // Applies if New Crop is Maize OR Consumption/Factory/Starch Potatoes (NOT Seed Potatoes)
        const isMaize = currStandard?.cultivation_rvo_table2.includes("mais")
        const isPotato = currStandard?.type === "aardappel"
        const isSeedPotato =
            currStandard?.cultivation_rvo_table2.includes("pootaardappelen") ||
            currCult.b_lu_catalogue === "nl_2015" ||
            currCult.b_lu_catalogue === "nl_2016" ||
            currStandard?.cultivation_rvo_table2.includes("uitgroeiteelt")

        if (
            nonBouwlandCodes.includes(prevCult.b_lu_catalogue) &&
            (isMaize || (isPotato && !isSeedPotato))
        ) {
            const destructionDate = prevCult.b_lu_end
            let isValidDestruction = false

            if (sandyOrLoessRegions.includes(region)) {
                // Sand/Loess: Feb 1 - May 10
                if (
                    destructionDate >= new Date(currentYear, 1, 1) && // Feb 1
                    destructionDate <= new Date(currentYear, 4, 10) // May 10
                ) {
                    isValidDestruction = true
                } else {
                    throw new Error(
                        "Graslandvernietiging op zand- en lössgrond is alleen toegestaan tussen 1 februari en 10 mei.",
                    )
                }
            } else if (clayOrPeatRegions.includes(region)) {
                if (is_nv_area) {
                    // Clay/Peat NV: Feb 1 - Mar 15
                    if (
                        destructionDate >= new Date(currentYear, 1, 1) &&
                        destructionDate <= new Date(currentYear, 2, 15)
                    ) {
                        isValidDestruction = true
                    } else {
                        throw new Error(
                            "Graslandvernietiging op klei- en veengrond (NV-gebied) is alleen toegestaan tussen 1 februari en 15 maart.",
                        )
                    }
                } else {
                    // Clay/Peat Non-NV: Feb 1 - May 31
                    if (
                        destructionDate >= new Date(currentYear, 1, 1) &&
                        destructionDate <= new Date(currentYear, 4, 31)
                    ) {
                        isValidDestruction = true
                    } else {
                        throw new Error(
                            "Graslandvernietiging op klei- en veengrond (niet NV-gebied) is alleen toegestaan tussen 1 februari en 31 mei.",
                        )
                    }
                }
            }

            if (isValidDestruction) {
                return {
                    amount: new Decimal(65),
                    description: ". Korting: 65kg N/ha: graslandvernietiging",
                }
            }
        }
    }

    // Check if field is outside regions with korting
    if (!sandyOrLoessRegions.includes(region)) {
        return {
            amount: new Decimal(0),
            description: ".",
        }
    }

    // Determine hoofdteelt for the current year (2025)
    const hoofdteelt2025 = determineNLHoofdteelt(cultivations, 2025)
    const hoofdteelt2025Standard = nitrogenStandardsData.find((ns) =>
        ns.b_lu_catalogue_match.includes(hoofdteelt2025),
    )

    // Grasland is exlcuded from korting
    if (nonBouwlandCodes.includes(hoofdteelt2025)) {
        return {
            amount: new Decimal(0),
            description: ".",
        }
    }

    // Check for winterteelt exception (hoofdteelt of 2025 is winterteelt, sown in late 2024)
    if (hoofdteelt2025Standard?.is_winterteelt) {
        return {
            amount: new Decimal(0),
            description: ". Geen korting: winterteelt aanwezig",
        }
    }

    // Filter cultivations for the previous year (2024)
    const cultivations2024 = cultivations.filter(
        (c) => c.b_lu_start && c.b_lu_start.getFullYear() === previousYear,
    )

    // Check for vanggewas exception in 2024
    const vanggewassen2024 = cultivations2024.filter((prevCultivation) => {
        const matchingStandard = nitrogenStandardsData.find((ns) =>
            ns.b_lu_catalogue_match.includes(prevCultivation.b_lu_catalogue),
        )
        const matchingYear =
            prevCultivation.b_lu_start &&
            prevCultivation.b_lu_start.getTime() <
                new Date(currentYear, 1, 1).getTime() &&
            prevCultivation.b_lu_start.getTime() >
                new Date(previousYear, 6, 15).getTime() // Vanggewas should be sown between July 15th, 2024 and February 1st 2025 (exclusive)
        return matchingStandard?.is_vanggewas === true && matchingYear === true
    })
    if (vanggewassen2024.length === 0) {
        return {
            amount: new Decimal(20),
            description: ". Korting: 20kg N/ha: geen vanggewas of winterteelt",
        }
    }

    // Check if a vanggewas is present to February 1st
    const vanggewassenCompleted2024 = vanggewassen2024.filter(
        (prevCultivation) => {
            return (
                prevCultivation.b_lu_end === null ||
                (prevCultivation.b_lu_end &&
                    prevCultivation.b_lu_end.getTime() >=
                        new Date(currentYear, 1).getTime()) // Month 1 is February
            )
        },
    )
    if (vanggewassenCompleted2024.length === 0) {
        return {
            amount: new Decimal(20),
            description:
                ". Korting: 20kg N/ha: vanggewas staat niet tot 1 februari",
        }
    }
    // If multiple vanggewassen are completed to February 1st select the vangewas that was first sown
    const sortedVanggewassen = vanggewassenCompleted2024
        .filter((v) => v.b_lu_start !== undefined)
        .sort((a, b) => {
            if (!a.b_lu_start || !b.b_lu_start) {
                return 0
            }
            return a.b_lu_start.getTime() - b.b_lu_start.getTime()
        })
    const vanggewas2024 = sortedVanggewassen[0]

    const sowDate = vanggewas2024.b_lu_start
    if (!sowDate) {
        return {
            amount: new Decimal(20),
            description: ". Korting: 20kg N/ha, geen zaaidatum bekend",
        }
    }

    const october1 = new Date(previousYear, 9, 1) // October 1st
    const october15 = new Date(previousYear, 9, 15) // October 15th
    const november1 = new Date(previousYear, 10, 1) // November 1st

    let kortingAmount = new Decimal(20) // Default korting
    let kortingDescription =
        ". Korting: 20kg N/ha, geen vanggewas of te laat gezaaid"

    if (sowDate <= october1) {
        kortingAmount = new Decimal(0)
        kortingDescription =
            ". Geen korting: vanggewas gezaaid uiterlijk 1 oktober"
    } else if (sowDate > october1 && sowDate < october15) {
        kortingAmount = new Decimal(5)
        kortingDescription =
            ". Korting: 5kg N/ha, vanggewas gezaaid tussen 2 t/m 14 oktober"
    } else if (sowDate >= october15 && sowDate < november1) {
        kortingAmount = new Decimal(10)
        kortingDescription =
            ". Korting: 10kg N/ha, vanggewas gezaaid tussen 15 t/m 31 oktober"
    } else {
        kortingAmount = new Decimal(20)
        kortingDescription =
            ". Korting: 20kg N/ha, vanggewas gezaaid op of na 1 november"
    }

    return { amount: kortingAmount, description: kortingDescription }
}

/**
 * Determines the 'gebruiksnorm' (usage standard) for nitrogen for a given cultivation
 * based on its BRP code, geographical location, and other specific characteristics.
 * This function is the primary entry point for calculating the nitrogen usage norm
 * according to the Dutch RVO's "Tabel 2 Stikstof landbouwgrond 2025" and related annexes.
 *
 * @param input - An object of type `NL2025NormsInput` containing all necessary data:
 *   - `farm.is_derogatie_bedrijf`: A boolean indicating if the farm operates under derogation.
 *   - `field.b_centroid`: An object with the latitude and longitude of the field's centroid.
 *   - `cultivations`: An array of cultivation objects, from which the `hoofdteelt` (main crop)
 *     will be determined.
 * @returns A promise that resolves to an object of type `GebruiksnormResult` containing:
 *   - `normValue`: The determined nitrogen usage standard in kilograms per hectare (kg/ha).
 *   - `normSource`: The descriptive name from RVO Table 2 used for the calculation.
 *   - `kortingDescription`: A description of any korting (reduction) applied to the norm.
 * Returns `null` if no matching standard or applicable norm can be found for the given input.
 * @throws {Error} If the `hoofdteelt` cultivation cannot be found or if geographical data
 *   queries fail.
 *
 * @remarks
 * The function follows a comprehensive, multi-step process to accurately determine the
 * correct nitrogen norm:
 *
 * 1.  **Identify Main Crop (`hoofdteelt`)**:
 *     The `determineNLHoofdteelt` function is called to identify the primary cultivation
 *     (`b_lu_catalogue`) for the field based on the provided `cultivations` array. This is
 *     the first step to narrow down the applicable nitrogen standards.
 *
 * 2.  **Determine Geographical Context**:
 *     -   `isFieldInNVGebied`: This asynchronous helper function is called to check if the
 *         field's centroid falls within a Nitraatkwetsbaar Gebied (NV-gebied). Fields in NV-gebieds
 *         often have stricter (lower) nitrogen norms.
 *     -   `getRegion`: This asynchronous helper function determines the specific soil region
 *         (e.g., "zand" for sandy soil, "klei" for clay soil) based on the field's coordinates.
 *         Nitrogen norms can vary significantly by soil type.
 *     Both functions use efficient spatial queries to retrieve this information.
 *
 * 3.  **Match Nitrogen Standard Data**:
 *     The `nitrogenStandardsData` (loaded from a JSON file) is filtered to find all entries
 *     (`NitrogenStandard` objects) whose `b_lu_catalogue_match` array includes the identified
 *     `b_lu_catalogue` of the `hoofdteelt`.
 *
 * 4.  **Refine by Variety (for Potatoes)**:
 *     If the `hoofdteelt` has a specific `b_lu_variety` (e.g., for potatoes), the matching
 *     standards are further filtered. Potatoes can have "high" (`varieties_hoge_norm`) or
 *     "low" (`varieties_lage_norm`) nitrogen norms based on their variety. If a specific
 *     variety match is not found, it falls back to "overig" (other) potato norms if available.
 *
 * 5.  **Select the Most Specific Standard**:
 *     If multiple `NitrogenStandard` entries still match after initial filtering and
 *     variety-specific refinement, the function attempts to select the most specific one.
 *     This prioritization ensures that detailed rules (e.g., those without `variety_type`
 *     or `sub_types` if a direct match is found) are applied correctly.
 *
 * 6.  **Retrieve Applicable Norms**:
 *     The `getNormsForCultivation` helper function is called with the `selectedStandard`
 *     and other relevant parameters (variety, derogation status, cultivation end date).
 *     This function applies a hierarchy of rules (sub-type periods, variety-specific,
 *     derogation-specific) to return the precise `NormsByRegion` object for the cultivation.
 *
 * 7.  **Calculate Final Norm Value**:
 *     From the `applicableNorms` object, the function retrieves the specific norms for the
 *     determined `region`. The final `normValue` is then selected: if the field is in an
 *     `is_nv_area`, the `nv_area` norm is used; otherwise, the `standard` norm is applied.
 *
 * 8.  **Apply "Korting" (Reduction)**:
 *     The `calculateKorting` function is called to determine if a reduction should be applied
 *     based on the previous year's cultivations and the field's region. The calculated
 *     `kortingAmount` is then subtracted from the `normValue`.
 *
 * This detailed process ensures that the calculated nitrogen usage norm is accurate and
 * compliant with RVO regulations, taking into account all relevant agricultural and
 * geographical factors.
 *
 * @see {@link https://www.rvo.nl/sites/default/files/2024-12/Tabel-2-Stikstof-landbouwgrond-2025_0.pdf | RVO Tabel 2 Stikstof landbouwgrond 2025} - Official document for nitrogen norms.
 * @see {@link https://www.rvo.nl/onderwerpen/mest/gebruiken-en-uitrijden/stikstof-en-fosfaat/gebruiksnormen-stikstof | RVO Gebruiksnormen stikstof (official page)} - General information on nitrogen and phosphate norms.
 */
export async function calculateNL2025StikstofGebruiksNorm(
    input: NL2025NormsInput,
): Promise<GebruiksnormResult> {
    const is_derogatie_bedrijf = input.farm.is_derogatie_bedrijf
    const has_grazing_intention = input.farm.has_grazing_intention
    const field = input.field
    const cultivations = input.cultivations

    // Check for buffer strip
    if (field.b_bufferstrip) {
        return {
            normValue: 0,
            normSource: "Bufferstrook: geen plaatsingsruimte",
        }
    }

    // Determine hoofdteelt
    const b_lu_catalogue = determineNLHoofdteelt(cultivations, 2025)
    let cultivation = cultivations.find(
        (c) => c.b_lu_catalogue === b_lu_catalogue,
    )

    //Create cultivation in case of braak
    if (b_lu_catalogue === "nl_6794") {
        cultivation = {
            b_lu: "Groene braak, spontane opkomst",
            b_lu_catalogue: "nl_6794",
            b_lu_start: new Date("2025-01-01"),
            b_lu_end: new Date("2025-12-31"),
            b_lu_variety: null,
        }
    }
    if (!cultivation) {
        throw new Error(
            `Cultivation with b_lu_catalogue ${b_lu_catalogue} not found`,
        )
    }

    // Determine region and NV gebied
    const is_nv_area = await isFieldInNVGebied(field.b_centroid)
    const region = await getRegion(field.b_centroid)

    // Find matching nitrogen standard data based on b_lu_catalogue_match
    const matchingStandards: NitrogenStandard[] = nitrogenStandardsData.filter(
        (ns: NitrogenStandard) =>
            ns.b_lu_catalogue_match.includes(b_lu_catalogue),
    )

    if (matchingStandards.length === 0) {
        throw new Error(
            `No matching nitrogen standard found for b_lu_catalogue ${b_lu_catalogue}.`,
        )
    }

    // Prioritize exact matches if multiple exist (e.g., for specific potato types)
    let selectedStandard: NitrogenStandard | undefined

    if (matchingStandards.length === 1) {
        selectedStandard = matchingStandards[0]
    } else if (matchingStandards.length > 1) {
        // If multiple standards match b_lu_catalogue, try to find a more specific one
        // This could be based on sub_types with specific omschrijving or varieties
        selectedStandard =
            matchingStandards.find((ns) =>
                ns.sub_types?.some((sub) => sub.omschrijving || sub.varieties),
            ) || matchingStandards[0] // Fallback to the first if no specific sub_type is found
    }

    if (!selectedStandard) {
        throw new Error(
            `No specific matching nitrogen standard found for b_lu_catalogue ${b_lu_catalogue} with variety ${
                cultivation.b_lu_variety || "N/A"
            } in region ${region}.`,
        )
    }

    // Determine the sub-type omschrijving
    const subTypeOmschrijving = determineSubTypeOmschrijving(
        cultivation,
        selectedStandard,
        is_derogatie_bedrijf,
        cultivations,
        has_grazing_intention,
    )

    const applicableNorms = getNormsForCultivation(
        selectedStandard,
        cultivation.b_lu_end ?? new Date("2025-12-31"),
        cultivation.b_lu_start,
        subTypeOmschrijving,
    )

    if (!applicableNorms) {
        throw new Error(
            `Applicable norms object is undefined for ${selectedStandard.cultivation_rvo_table2} in region ${region}.`,
        )
    }

    const normsForRegion: { standard: number; nv_area: number } =
        applicableNorms[region]

    if (!normsForRegion) {
        throw new Error(
            `No norms found for region ${region} for ${selectedStandard.cultivation_rvo_table2}.`,
        )
    }

    let normValue = new Decimal(
        is_nv_area ? normsForRegion.nv_area : normsForRegion.standard,
    )

    // Apply korting
    const { amount: kortingAmount, description: kortingDescription } =
        calculateKorting(cultivations, region, is_derogatie_bedrijf, is_nv_area)
    normValue = new Decimal(normValue).minus(kortingAmount)

    // If normvalue is negative, e.g. Geen plaatsingsruimte plus korting, set it to 0
    if (normValue.isNegative()) {
        normValue = new Decimal(0)
    }

    const subTypeText = subTypeOmschrijving ? ` (${subTypeOmschrijving})` : ""
    return {
        normValue: normValue.toNumber(),
        normSource: `${selectedStandard.cultivation_rvo_table2}${subTypeText}${kortingDescription}`,
    }
}

/**
 * Memoized version of {@link calculateNL2025StikstofGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2025NormsInput} input - An object of type `NL2025NormsInput` containing all necessary data.
 * @returns {Promise<GebruiksnormResult>} A promise that resolves to an object of type `GebruiksnormResult` containing:
 *   - `normValue`: The determined nitrogen usage standard in kilograms per hectare (kg/ha).
 *   - `normSource`: The descriptive name from RVO Table 2 used for the calculation.
 *   - `kortingDescription`: A description of any korting (reduction) applied to the norm.
 */
export const getNL2025StikstofGebruiksNorm = withCalculationCache(
    calculateNL2025StikstofGebruiksNorm,
    "calculateNL2025StikstofGebruiksNorm",
    pkg.calculatorVersion,
)
