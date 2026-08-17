import { type Field, withCalculationCache } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import type { GebruiksnormResult } from "../../types"
import type {
  NitrogenStandard,
  NL2025NormsInput,
  NL2025NormsInputForCultivation,
  NormsByRegion,
  RegionKey,
} from "./types"
import { NormNotApplicableError } from "../../../../error"
import pkg from "../../../../package"
import { getGeoTiffValue } from "../../../../shared/geotiff"
import { findHoofdteelt } from "../../../../shared/hoofdteelt"
import { getFdmPublicDataUrl } from "../../../../shared/public-data-url"
import {
  graanCodes,
  graszaadCodes,
  koolzaadCodes,
  maisCodes,
  nonBouwlandCodes,
  tijdelijkGraslandCodes,
} from "../../constant"
import { nitrogenStandardsData } from "./stikstofgebruiksnorm-data"
import { calculateVanggewasWinterteeltKorting } from "./vanggewas-winterteelt"

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
  getGeoTiffValueFn: typeof getGeoTiffValue = getGeoTiffValue,
): Promise<boolean> {
  const fdmPublicDataUrl = getFdmPublicDataUrl()
  const url = `${fdmPublicDataUrl}norms/nl/2025/nv.tiff`
  const longitude = b_centroid[0]
  const latitude = b_centroid[1]
  const NVGebiedCode = await getGeoTiffValueFn(url, longitude, latitude)

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
export async function getRegion(b_centroid: Field["b_centroid"]): Promise<RegionKey> {
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
 */
export function getNormsForCultivation(
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
    const startDate = b_lu_start ? new Date(b_lu_start) : new Date(endDate.getFullYear(), 0, 1)
    startDate.setHours(12, 0, 0, 0)

    // Find all matching sub-types
    const potentialMatches = selectedStandard.sub_types.filter((sub) => {
      if (
        sub.period_start_month !== null &&
        sub.period_start_month !== undefined &&
        sub.period_end_month !== null &&
        sub.period_end_month !== undefined
      ) {
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
          sub.period_start_month !== null &&
          sub.period_start_month !== undefined &&
          sub.period_start_month > 1

        if (isVanaf) {
          // If it's a "tot minstens" period (implied by end month < 12), it must also last until endPeriod,
          // and the crop must have been sown on or before endPeriod (cannot start after the period has ended).
          if (
            sub.period_end_month !== null &&
            sub.period_end_month !== undefined &&
            sub.period_end_month < 12
          ) {
            return startDate >= startPeriod && startDate <= endPeriod && endDate >= endPeriod
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
        const aStart = (a.period_start_month ?? 1) * 100 + (a.period_start_day ?? 1)
        const bStart = (b.period_start_month ?? 1) * 100 + (b.period_start_day ?? 1)
        if (aStart !== bStart) {
          return aStart - bStart
        }
        const aEnd = (a.period_end_month ?? 1) * 100 + (a.period_end_day ?? 1)
        const bEnd = (b.period_end_month ?? 1) * 100 + (b.period_end_day ?? 1)
        return bEnd - aEnd
      })
      matchingSubType = potentialMatches[0]
    }

    // If no match found using the stricter "minstens" logic, fallback to the original bucket logic
    // to prevent "undefined" regressions for edge cases, but with timezone fix.
    if (!matchingSubType) {
      matchingSubType = selectedStandard.sub_types.find((sub) => {
        if (
          sub.period_start_month !== null &&
          sub.period_start_month !== undefined &&
          sub.period_end_month !== null &&
          sub.period_end_month !== undefined
        ) {
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
 *
 * Sub-types in RVO Tabel 2 differentiate nitrogen norms based on crop management, cultivation history,
 * or botanical characteristics:
 * - **Grasland**: Differentiates between grazing (`beweiden`) and pure mowing (`volledig maaien`).
 * - **Aardappel**: Matches specific potato varieties to standard groupings (e.g. early, late, seed, starch).
 * - **Mais**: Differentiates between derogation and non-derogation farm status (2025 only).
 * - **Luzerne**: Differentiates first-year (`eerste jaar`) from subsequent years (`volgende jaren`) based on prior-year presence.
 * - **Koolzaad**: Differentiates winter (`winter`, `nl_1922`) from summer (`zomer`, `nl_1923`) varieties.
 * - **Gras voor industriële verwerking / Graszaad / Roodzwenkgras**: Differentiates establishment / 1st year from multi-year / overjarig stands.
 * - **Zaaiui / Winterui**: Differentiates 1st year (`nl_1932`) from 2nd year (`nl_1933`).
 * - **Bladgewassen (Spinazie, Slasoorten, Andijvie)**: Differentiates 1st cultivation (`1e teelt`) for the main crop from subsequent cultivation (`volgteelt`).
 *
 * @param cultivation - The cultivation object being evaluated.
 * @param standard - The matching `NitrogenStandard` definition from Tabel 2.
 * @param is_derogatie_bedrijf - Indicates if the farm holds a derogation permit (relevant for maize in 2025).
 * @param cultivations - All cultivations on the field (used to inspect cultivation history across years).
 * @param has_grazing_intention - Grazing intention flag for grassland (mowing vs grazing).
 * @param isHoofdteelt - Whether this cultivation is the designated main crop (`hoofdteelt`) of the year.
 * @returns The matching sub-type description key, or `undefined` if no specific sub-type applies.
 */
function determineSubTypeOmschrijving(
  cultivation: NL2025NormsInputForCultivation,
  standard: NitrogenStandard,
  is_derogatie_bedrijf: boolean | undefined,
  cultivations: NL2025NormsInputForCultivation[],
  has_grazing_intention: boolean | undefined,
  isHoofdteelt: boolean = true,
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
    return standard.sub_types?.find((s) => s.omschrijving === "overig")?.omschrijving
  }

  // Maize logic based on derogation status
  if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, mais") {
    return is_derogatie_bedrijf ? "derogatie" : "geen derogatie"
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
    return hasLucernceCultivationInPreviousYear ? "volgende jaren" : "eerste jaar"
  }

  // Koolzaad logic based on specific BRP code
  if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, koolzaad") {
    if (cultivation.b_lu_catalogue === "nl_1922") return "winter"
    if (cultivation.b_lu_catalogue === "nl_1923") return "zomer"
  }

  // Gras voor industriële verwerking logic based on cultivation history
  if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, Gras voor industriële verwerking") {
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
  if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, Graszaad, Engels raaigras") {
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
  if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, Roodzwenkgras") {
    const roodzwenkgrasCultivationCodes = standard.b_lu_catalogue_match
    const hasRoodzwenkgrasCultivationInPreviousYear = cultivations.some(
      (c) =>
        roodzwenkgrasCultivationCodes.includes(c.b_lu_catalogue) &&
        c.b_lu_start &&
        c.b_lu_start.getFullYear() <= 2024,
    )
    return hasRoodzwenkgrasCultivationInPreviousYear ? "overjarig" : "1e jaars"
  }

  // Winterui (Onion) logic based on specific BRP codes
  if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, Ui overig, zaaiui of winterui.") {
    if (cultivation.b_lu_catalogue === "nl_1932") return "1e jaars"
    if (cultivation.b_lu_catalogue === "nl_1933") return "2e jaars"
  }

  // Bladgewassen logic based on hoofdteelt vs volgteelt
  const bladgewasRvoTable2s = [
    "Bladgewassen, Spinazie",
    "Bladgewassen, Slasoorten",
    "Bladgewassen, Andijvie eerste teelt volgteelt",
  ]

  if (bladgewasRvoTable2s.includes(standard.cultivation_rvo_table2)) {
    return isHoofdteelt ? "1e teelt" : "volgteelt"
  }

  return undefined
}

/**
 * Calculates statutory reductions ("kortingen") on the annual nitrogen usage norm for 2025.
 *
 * Implements three statutory reduction mechanisms:
 * 1. **Grassland renewal (Graslandvernieuwing, Footnote 14)**:
 *    - Applies a **50 kg N/ha** reduction when grassland is renewed (gras-na-gras transition) between 1 June and 31 August.
 *    - In 2025: Applies on sand and loess soils for all farms; on clay and peat soils only for derogation permit holders.
 * 2. **Grassland destruction (Graslandvernietiging / Scheuren)**:
 *    - Applies a **65 kg N/ha** reduction when grassland is converted to arable land (gras-naar-bouwland transition)
 *      for maize or eligible potato cultivations (excluding seed potatoes and early harvest varieties).
 *    - Allowed destruction windows:
 *      - Sand & Loess: 1 February – 10 May.
 *      - Clay & Peat (NV-gebied): 1 February – 15 March.
 *      - Clay & Peat (Non-NV): 1 February – 31 May.
 *    - Catch crops (vanggewas) sown in autumn of the previous year are excluded from triggering grassland destruction korting.
 * 3. **Article 28d Meststoffenwet (Catch crops and winter crops after sand/loess main crops)**:
 *    - Evaluated by `calculateVanggewasWinterteeltKorting` anchored to the main crop of year N-1.
 *
 * @param cultivations - Array of cultivations across current and preceding years.
 * @param region - Soil region (`zand_nwc`, `zand_zuid`, `loess`, `klei`, `veen`).
 * @param is_derogatie_bedrijf - Farm derogation permit status in 2025.
 * @param is_nv_area - Flag indicating if the parcel is located in a nutrient-polluted zone (NV-gebied).
 * @returns An object containing the total reduction amount (Decimal) and formatted descriptive text.
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

  let totalAmount = new Decimal(0)
  const descriptions: string[] = []

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

      // Footnote 14 (2025): Renewal between 1 June and 31 August
      // On sand and loess: all farms. On clay and peat: only for derogation farms.
      const isJuneToAugust =
        renewalDate >= new Date(currentYear, 5, 1) && // June 1
        renewalDate <= new Date(currentYear, 7, 31) // Aug 31

      if (sandyOrLoessRegions.includes(region)) {
        if (isJuneToAugust) {
          isValidRenewal = true
        }
      } else if (clayOrPeatRegions.includes(region)) {
        if (is_derogatie_bedrijf && isJuneToAugust) {
          isValidRenewal = true
        }
      }

      if (isValidRenewal) {
        totalAmount = totalAmount.plus(50)
        descriptions.push("Korting: 50kg N/ha: graslandvernieuwing")
      }
    }

    // 2. Grassland Destruction (Gras-naar-Bouwland) -> 65 kg N/ha korting
    // Applies if New Crop is Maize OR Consumption/Factory/Starch Potatoes (NOT Seed Potatoes or early potatoes)
    const prevStandard = nitrogenStandardsData.find((ns) =>
      ns.b_lu_catalogue_match.includes(prevCult.b_lu_catalogue),
    )
    const isMaize = currStandard?.cultivation_rvo_table2.includes("mais")
    const isPotato = currStandard?.type === "aardappel"
    const isExcludedPotato =
      currStandard?.cultivation_rvo_table2.includes("pootaardappelen") ||
      currCult.b_lu_catalogue === "nl_2015" ||
      currCult.b_lu_catalogue === "nl_2016" ||
      currCult.b_lu_catalogue === "nl_1911" ||
      currCult.b_lu_catalogue === "nl_1912" ||
      currStandard?.cultivation_rvo_table2.includes("uitgroeiteelt")

    if (
      nonBouwlandCodes.includes(prevCult.b_lu_catalogue) &&
      (isMaize || (isPotato && !isExcludedPotato))
    ) {
      // Check Exclusion: Was previous grass a Catch Crop?
      const isCatchCrop =
        prevStandard?.is_vanggewas ||
        (prevCult.b_lu_start &&
          prevCult.b_lu_start.getFullYear() === previousYear &&
          prevCult.b_lu_start.getMonth() >= 7) // August or later

      if (isCatchCrop) {
        continue
      }

      const destructionDate = prevCult.b_lu_end
      let isValidDestruction = false

      if (sandyOrLoessRegions.includes(region)) {
        // Sand/Loess: Feb 1 - May 10
        if (
          destructionDate >= new Date(currentYear, 1, 1) && // Feb 1
          destructionDate <= new Date(currentYear, 4, 10) // May 10
        ) {
          isValidDestruction = true
        }
      } else if (clayOrPeatRegions.includes(region) && is_derogatie_bedrijf) {
        if (is_nv_area) {
          // Clay/Peat NV (Derogation): Feb 1 - Mar 15
          if (
            destructionDate >= new Date(currentYear, 1, 1) &&
            destructionDate <= new Date(currentYear, 2, 15)
          ) {
            isValidDestruction = true
          }
        } else {
          // Clay/Peat Non-NV (Derogation): Feb 1 - May 31
          if (
            destructionDate >= new Date(currentYear, 1, 1) &&
            destructionDate <= new Date(currentYear, 4, 31)
          ) {
            isValidDestruction = true
          }
        }
      }

      if (isValidDestruction) {
        totalAmount = totalAmount.plus(65)
        descriptions.push("Korting: 65kg N/ha: graslandvernietiging")
      }
    }
  }

  // Calculate catch crop korting
  const catchCropAmount = calculateVanggewasWinterteeltKorting(
    cultivations,
    region,
    currentYear,
    descriptions,
  )
  totalAmount = totalAmount.plus(catchCropAmount)

  const descriptionStr = descriptions.length > 0 ? `. ${descriptions.join(". ")}` : "."
  return { amount: totalAmount, description: descriptionStr }
}

/**
 * Calculates the nitrogen usage standard for an individual cultivation in 2025 according to RVO Tabel 2.
 *
 * This function performs multi-step agronomic compliance checks:
 * 1. **Standard & Subtype Resolution**: Matches `b_lu_catalogue` to Tabel 2 records. For non-main crops (`!isHoofdteelt`),
 *    it prioritizes explicit `volgteelt` entries where available.
 * 2. **Regional & NV-area Norm Selection**: Fetches the applicable base norm in kg N/ha for the field's soil region
 *    and NV-gebied designation.
 * 3. **Footnote 2 & 6 Compliance (Maïs follow-up suppression)**:
 *    - Suppresses norms (sets 0 kg N/ha) for green manures (`Groenbemesters`), catch crops (`is_vanggewas`),
 *      and temporary grassland (`tijdelijkGraslandCodes`) following maize on the same field in the calendar year.
 * 4. **Footnote 7a Compliance (Green manure conditions)**:
 *    - Green manure norms (`Groenbemesters, niet-vlinderbloemige`) are conditional upon:
 *      - Having an immediate preceding crop in the same calendar year.
 *      - Preceding crop being a cereal (`graanCodes`), grass seed (`graszaadCodes`), or rapeseed (`koolzaadCodes`) for a full 100% norm.
 *      - On sand/loess following temporary grassland (`tijdelijkGraslandCodes`), granting a 50% norm.
 *      - Sowing date strictly before 1 September.
 *      - Standing until at least 1 February of the following year.
 *    - If conditions are unmet, grants 0 kg N/ha with an explanatory status note.
 * 5. **Footnote 7b Compliance (Graszaadstoppel)**:
 *    - Requires cultivation start on or before 16 September; otherwise grants 0 kg N/ha.
 * 6. **Grassland Renewal Sod Continuation**:
 *    - Resown grassland (`isGrass && hasGrassBeforeInYear`) shares the single annual grassland allowance (0 kg N/ha for 2nd sod).
 *
 * @param cultivation - The cultivation being calculated.
 * @param isHoofdteelt - True if this cultivation is the designated main crop of the year.
 * @param prevCultivationsInYear - Prior cultivations in the same calendar year on this parcel.
 * @param cultivations - Complete array of cultivations on the field.
 * @param is_derogatie_bedrijf - Farm derogation status in 2025.
 * @param has_grazing_intention - Grazing intention for grassland parcels.
 * @param region - Soil region classification.
 * @param is_nv_area - Nutrient-polluted area (NV-gebied) indicator.
 * @returns Object containing the calculated norm value, standard name, subtype text, and explanatory footnote note.
 * @throws {NormNotApplicableError} If no matching crop standard exists in Tabel 2.
 */
function calculateSingleCultivationNorm(
  cultivation: NL2025NormsInputForCultivation,
  isHoofdteelt: boolean,
  prevCultivationsInYear: NL2025NormsInputForCultivation[],
  cultivations: NL2025NormsInputForCultivation[],
  is_derogatie_bedrijf: boolean | undefined,
  has_grazing_intention: boolean | undefined,
  region: RegionKey,
  is_nv_area: boolean,
): { normValue: Decimal; sourceName: string; subTypeText: string; noteText: string } {
  const b_lu_catalogue = cultivation.b_lu_catalogue

  // Find matching nitrogen standard data based on b_lu_catalogue_match
  const matchingStandards: NitrogenStandard[] = nitrogenStandardsData.filter(
    (ns: NitrogenStandard) => ns.b_lu_catalogue_match.includes(b_lu_catalogue),
  )

  if (matchingStandards.length === 0) {
    throw new NormNotApplicableError(
      `No matching nitrogen standard found for b_lu_catalogue ${b_lu_catalogue}.`,
    )
  }

  // Prioritize exact matches if multiple exist (e.g., for volgteelt or specific potato types)
  let selectedStandard: NitrogenStandard | undefined

  if (matchingStandards.length === 1) {
    selectedStandard = matchingStandards[0]
  } else if (matchingStandards.length > 1) {
    if (!isHoofdteelt) {
      selectedStandard = matchingStandards.find((ns) =>
        ns.cultivation_rvo_table2.toLowerCase().includes("volgteelt"),
      )
    } else {
      selectedStandard =
        matchingStandards.find(
          (ns) =>
            !ns.cultivation_rvo_table2.toLowerCase().includes("volgteelt") &&
            ns.sub_types?.some((sub) => sub.omschrijving || sub.varieties),
        ) ||
        matchingStandards.find(
          (ns) => !ns.cultivation_rvo_table2.toLowerCase().includes("volgteelt"),
        )
    }
    if (!selectedStandard) {
      selectedStandard =
        matchingStandards.find((ns) =>
          ns.sub_types?.some((sub) => sub.omschrijving || sub.varieties),
        ) || matchingStandards[0]
    }
  }

  if (!selectedStandard) {
    throw new NormNotApplicableError(
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
    isHoofdteelt,
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

  const normsForRegion: { standard: number; nv_area: number } = applicableNorms[region]

  if (!normsForRegion) {
    throw new Error(
      `No norms found for region ${region} for ${selectedStandard.cultivation_rvo_table2}.`,
    )
  }

  let normValue = new Decimal(is_nv_area ? normsForRegion.nv_area : normsForRegion.standard)
  let noteText = ""

  // Footnote 2 & 6: Suppression of groenbemester, tijdelijk grasland and vanggewas norms after maize
  const immediatePrecedingCrop =
    prevCultivationsInYear.length > 0
      ? prevCultivationsInYear[prevCultivationsInYear.length - 1]
      : undefined

  const hasMaizeBefore =
    !isHoofdteelt &&
    Boolean(
      immediatePrecedingCrop &&
      (maisCodes.includes(immediatePrecedingCrop.b_lu_catalogue) ||
        nitrogenStandardsData
          .find((ns) => ns.b_lu_catalogue_match.includes(immediatePrecedingCrop.b_lu_catalogue))
          ?.cultivation_rvo_table2.toLowerCase()
          .includes("mais")),
    )

  const isGroenbemesterOrCatchOrTempGrass =
    selectedStandard.type === "groenbemester" ||
    selectedStandard.is_vanggewas ||
    selectedStandard.type === "grasland_tijdelijk" ||
    tijdelijkGraslandCodes.includes(cultivation.b_lu_catalogue)

  if (hasMaizeBefore && isGroenbemesterOrCatchOrTempGrass) {
    normValue = new Decimal(0)
    noteText = " (geen extra ruimte na maïs, voetnoot 2/6)"
  } else if (selectedStandard.cultivation_rvo_table2 === "Groenbemesters, niet-vlinderbloemige") {
    // Footnote 7a: Groenbemester conditions
    const isPrecedingCerealOrRapeseedOrGrassSeed =
      immediatePrecedingCrop &&
      (graanCodes.includes(immediatePrecedingCrop.b_lu_catalogue) ||
        koolzaadCodes.includes(immediatePrecedingCrop.b_lu_catalogue) ||
        graszaadCodes.includes(immediatePrecedingCrop.b_lu_catalogue))

    const isPrecedingGrasOpBouwland =
      immediatePrecedingCrop &&
      tijdelijkGraslandCodes.includes(immediatePrecedingCrop.b_lu_catalogue)

    const isSandyOrLoess = ["zand_nwc", "zand_zuid", "loess"].includes(region)

    const isSownBeforeSept1 =
      cultivation.b_lu_start &&
      (cultivation.b_lu_start.getFullYear() < 2025 ||
        (cultivation.b_lu_start.getFullYear() === 2025 && cultivation.b_lu_start.getMonth() < 8))

    const isNotDestroyedBeforeFeb1 =
      !cultivation.b_lu_end || cultivation.b_lu_end >= new Date(2026, 1, 1)

    if (!immediatePrecedingCrop) {
      normValue = new Decimal(0)
      noteText = " (geen extra ruimte: geen voorafgaande teelt, voetnoot 7a)"
    } else if (
      !isPrecedingCerealOrRapeseedOrGrassSeed &&
      !(isSandyOrLoess && isPrecedingGrasOpBouwland)
    ) {
      normValue = new Decimal(0)
      noteText = " (geen extra ruimte: niet geteeld na granen, graszaad of koolzaad, voetnoot 7a)"
    } else if (!isSownBeforeSept1) {
      normValue = new Decimal(0)
      noteText = " (geen extra ruimte: gezaaid op of na 1 september, voetnoot 7a)"
    } else if (!isNotDestroyedBeforeFeb1) {
      normValue = new Decimal(0)
      noteText = " (geen extra ruimte: vernietigd vóór 1 februari, voetnoot 7a)"
    } else if (isPrecedingCerealOrRapeseedOrGrassSeed) {
      // 100% of norm
      noteText = " (volgteelt na granen, graszaad of koolzaad, voetnoot 7a)"
    } else if (isSandyOrLoess && isPrecedingGrasOpBouwland) {
      // 50% of norm on sand or loess after grass on arable land
      normValue = normValue.dividedBy(2)
      noteText = " (extra ruimte (50%) na gras op bouwland, voetnoot 7a)"
    }
  }

  // Footnote 7b: Graszaadstoppel
  if (
    selectedStandard.cultivation_rvo_table2 ===
    "Graszaadstoppel ter vernietiging in najaar of vroege voorjaar"
  ) {
    const isBeforeSept16 =
      !cultivation.b_lu_start ||
      cultivation.b_lu_start.getMonth() < 8 ||
      (cultivation.b_lu_start.getMonth() === 8 && cultivation.b_lu_start.getDate() < 16)

    if (isBeforeSept16) {
      noteText = " (graszaadstoppel, voetnoot 7b)"
    } else {
      normValue = new Decimal(0)
      noteText = " (geen extra ruimte: niet voldaan aan voorwaarden graszaadstoppel, voetnoot 7b)"
    }
  }

  // Grassland renewal: multiple grass crops on the same field in the same year share the annual grassland allowance
  const isGrass = nonBouwlandCodes.includes(cultivation.b_lu_catalogue)
  const hasGrassBeforeInYear = prevCultivationsInYear.some((c) =>
    nonBouwlandCodes.includes(c.b_lu_catalogue),
  )
  if (isGrass && hasGrassBeforeInYear) {
    normValue = new Decimal(0)
    noteText = " (heringezaaid)"
  }

  const subTypeText = subTypeOmschrijving ? ` (${subTypeOmschrijving})` : ""
  return {
    normValue,
    sourceName: selectedStandard.cultivation_rvo_table2,
    subTypeText,
    noteText,
  }
}

/**
 * Determines the 'gebruiksnorm' (nitrogen application standard) for a given field and cultivation plan in 2025
 * by accumulating per-teelt norms across all active crops in the calendar year according to
 * Dutch RVO "Tabel 2 Stikstof landbouwgrond 2025".
 *
 * ### Agronomic & Legal Workflow:
 * 1. **Buffer Strip Check**: Parcels marked with `b_bufferstrip` receive 0 kg N/ha.
 * 2. **Geographical Resolution**: Determines soil type (`getRegion`) and NV-gebied status (`isFieldInNVGebied`).
 * 3. **Main Crop Identification**: Identifies the statutory `hoofdteelt` (present between 15 May and 15 July).
 * 4. **Multi-Teelt Accumulation**:
 *    - Iterates over all active cultivations in the calendar year (including overwintering main crops).
 *    - The main crop receives its 1st cultivation standard (`1e teelt`).
 *    - Successive crops receive volgteelt / subtype standards with applicable footnote checks (footnotes 2, 6, 7a, 7b).
 * 5. **Statutory Reductions ("Kortingen")**:
 *    - Grassland renewal reduction (50 kg N/ha, footnote 14).
 *    - Grassland destruction reduction (65 kg N/ha).
 *    - Article 28d catch-crop / winter-crop shortfall reductions.
 * 6. **Floor & Formatting**: Enforces non-negative norm floor (min 0) and generates a detailed audit breakdown string.
 *
 * @param input - Input data containing farm settings, field centroid/bufferstrip, and cultivation schedule.
 * @returns An object containing the aggregated `normValue` (in kg N/ha) and the descriptive `normSource`.
 *
 * @see `fdm-docs/docs/insights/fertilizer-application-norms/nl/2025/stikstofgebruiksnorm.md`
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

  // Determine region and NV gebied
  const is_nv_area = await isFieldInNVGebied(field.b_centroid)
  const region = await getRegion(field.b_centroid)

  // Find hoofdteelt (May 15 - July 15)
  const hoofdteelt = findHoofdteelt(cultivations, 2025, false, true)

  // Filter cultivations active in 2025
  const yearStart = new Date(2025, 0, 1)
  const yearEnd = new Date(2025, 11, 31, 23, 59, 59, 999)

  let yearCultivations = cultivations.filter((c) => {
    // Must overlap with the norm year
    const start = c.b_lu_start ? new Date(c.b_lu_start) : yearStart
    const end = c.b_lu_end ? new Date(c.b_lu_end) : yearEnd
    if (start > yearEnd || end < yearStart) return false

    // If it started before the norm year, it is only included if it is the hoofdteelt of the norm year
    if (c.b_lu_start && new Date(c.b_lu_start).getFullYear() < 2025) {
      return c === hoofdteelt
    }
    // If it started after the norm year, it is not part of this year
    if (c.b_lu_start && new Date(c.b_lu_start).getFullYear() > 2025) {
      return false
    }

    return true
  })

  // If no cultivations active in 2025, use fallback hoofdteelt (groene braak)
  if (yearCultivations.length === 0) {
    yearCultivations = [hoofdteelt as NL2025NormsInputForCultivation]
  }

  // Sort chronologically by start date
  const sortedCultivations = [...yearCultivations].sort((a, b) => {
    const aTime = a.b_lu_start ? new Date(a.b_lu_start).getTime() : 0
    const bTime = b.b_lu_start ? new Date(b.b_lu_start).getTime() : 0
    return aTime - bTime
  })

  // Determine which index in sortedCultivations is the hoofdteelt
  const hoofdteeltIndex = sortedCultivations.findIndex(
    (c) => (c.b_lu && hoofdteelt.b_lu ? c.b_lu === hoofdteelt.b_lu : c === hoofdteelt),
  )

  let totalNormValue = new Decimal(0)
  const normBreakdownItems: Array<{
    sourceName: string
    subTypeText: string
    noteText: string
    normValue: Decimal
  }> = []

  for (let i = 0; i < sortedCultivations.length; i++) {
    const cult = sortedCultivations[i]
    const isHoofd = hoofdteeltIndex !== -1 ? i === hoofdteeltIndex : i === 0
    const prevCults = sortedCultivations.slice(0, i)

    const result = calculateSingleCultivationNorm(
      cult,
      isHoofd,
      prevCults,
      cultivations,
      is_derogatie_bedrijf,
      has_grazing_intention,
      region,
      is_nv_area,
    )

    totalNormValue = totalNormValue.plus(result.normValue)
    normBreakdownItems.push(result)
  }

  // Apply korting
  const { amount: kortingAmount, description: kortingDescription } = calculateKorting(
    cultivations,
    region,
    is_derogatie_bedrijf,
    is_nv_area,
  )
  let finalNormValue = totalNormValue.minus(kortingAmount)

  // If normvalue is negative, e.g. Geen plaatsingsruimte plus korting, set it to 0
  if (finalNormValue.isNegative()) {
    finalNormValue = new Decimal(0)
  }

  let normSourceStr: string
  if (normBreakdownItems.length === 1) {
    const item = normBreakdownItems[0]
    normSourceStr = `${item.sourceName}${item.subTypeText}${item.noteText}${kortingDescription}`
  } else {
    const breakdown = normBreakdownItems
      .map(
        (item) =>
          `${item.sourceName}${item.subTypeText}${item.noteText} (${item.normValue.toNumber()} kg N/ha)`,
      )
      .join(" + ")
    normSourceStr = `${breakdown}${kortingDescription}`
  }

  return {
    normValue: finalNormValue.toNumber(),
    normSource: normSourceStr,
  }
}

/**
 * Memoized version of {@link calculateNL2025StikstofGebruiksNorm}.
 */
export const getNL2025StikstofGebruiksNorm = withCalculationCache(
  calculateNL2025StikstofGebruiksNorm,
  "calculateNL2025StikstofGebruiksNorm",
  pkg.calculatorVersion,
)
