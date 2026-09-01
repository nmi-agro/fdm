import { withCalculationCache } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import type { GebruiksnormResult } from "../../types"
import type {
  NitrogenStandard,
  NL2026NormsInput,
  NL2026NormsInputForCultivation,
  RegionKey,
} from "./types"
import { NormNotApplicableError } from "../../../../error"
import pkg from "../../../../package"
import { findHoofdteelt } from "../../../../shared/hoofdteelt"
import {
  getNormsForCultivation,
  getRegion,
  isFieldInNVGebied,
} from "../../2025/value/stikstofgebruiksnorm"
import { calculateVanggewasWinterteeltKorting } from "../../2025/value/vanggewas-winterteelt"
import {
  graanCodes,
  graszaadCodes,
  koolzaadCodes,
  maisCodes,
  nonBouwlandCodes,
  tijdelijkGraslandCodes,
} from "../../constant"
import { nitrogenStandardsData } from "./stikstofgebruiksnorm-data"

/**
 * Determines the specific sub-type 'omschrijving' for a cultivation in 2026.
 *
 * Sub-types in RVO Tabel 2 differentiate nitrogen norms based on crop management, cultivation history,
 * or botanical characteristics:
 * - **Grasland**: Differentiates between grazing (`beweiden`) and pure mowing (`volledig maaien`).
 * - **Aardappel**: Matches specific potato varieties to standard groupings (e.g. early, late, seed, starch).
 * - **Mais**: No subtype applies in 2026 (derogation expired at the end of 2025).
 * - **Luzerne**: Differentiates first-year (`eerste jaar`) from subsequent years (`volgende jaren`) based on prior-year presence.
 * - **Koolzaad**: Differentiates winter (`winter`, `nl_1922`) from summer (`zomer`, `nl_1923`) varieties.
 * - **Gras voor industriële verwerking / Graszaad / Roodzwenkgras**: Differentiates establishment / 1st year from multi-year / overjarig stands.
 * - **Zaaiui / Winterui**: Differentiates 1st year (`nl_1932`) from 2nd year (`nl_1933`).
 * - **Bladgewassen (Spinazie, Slasoorten, Andijvie)**: Differentiates 1st cultivation (`1e teelt`) for the main crop from subsequent cultivation (`volgteelt`).
 *
 * @param cultivation - The cultivation object being evaluated.
 * @param standard - The matching `NitrogenStandard` definition from Tabel 2 (2026).
 * @param cultivations - All cultivations on the field (used to inspect cultivation history across years).
 * @param has_grazing_intention - Grazing intention for grassland parcels.
 * @param isHoofdteelt - Whether this cultivation is the designated main crop (`hoofdteelt`) of the year.
 * @returns The matching sub-type description key, or `undefined` if no specific sub-type applies.
 */
function determineSubTypeOmschrijving(
  cultivation: NL2026NormsInputForCultivation,
  standard: NitrogenStandard,
  cultivations: NL2026NormsInputForCultivation[],
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
    // Derogation ended after 2025; no subtype applies for maize in 2026.
    return undefined
  }

  // Luzerne logic based on cultivation history
  if (standard.cultivation_rvo_table2 === "Akkerbouwgewassen, Luzerne") {
    const lucerneCultivationCodes = standard.b_lu_catalogue_match
    const hasLucernceCultivationInPreviousYear = cultivations.some(
      (c) =>
        lucerneCultivationCodes.includes(c.b_lu_catalogue) &&
        c.b_lu_start &&
        c.b_lu_start.getFullYear() <= 2025,
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
        c.b_lu_start.getFullYear() <= 2025,
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
        c.b_lu_start.getFullYear() <= 2025,
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
        c.b_lu_start.getFullYear() <= 2025,
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
 * Calculates statutory reductions ("kortingen") on the annual nitrogen usage norm for 2026.
 *
 * Implements three statutory reduction mechanisms:
 * 1. **Grassland renewal (Graslandvernieuwing, Footnote 14)**:
 *    - Applies a **50 kg N/ha** reduction when grassland is renewed (gras-na-gras transition) between 1 June and 31 August.
 *    - In 2026: Applies on all soil types (sand, loess, clay, peat) for all farms (as derogation no longer exists in 2026).
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
 * @param is_nv_area - Flag indicating if the parcel is located in a nutrient-polluted zone (NV-gebied).
 * @returns An object containing the total reduction amount (Decimal) and formatted descriptive text.
 */
function calculateKorting(
  cultivations: NL2026NormsInputForCultivation[],
  region: RegionKey,
  is_nv_area: boolean,
): { amount: Decimal; description: string } {
  const currentYear = 2026
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

  // Find the transition from Grassland to Next Crop in 2026
  for (let i = 0; i < sortedCultivations.length - 1; i++) {
    const prevCult = sortedCultivations[i]
    const currCult = sortedCultivations[i + 1]

    if (!prevCult.b_lu_end || !currCult.b_lu_start) continue

    // Check if transition happens in 2026
    if (prevCult.b_lu_end.getFullYear() !== currentYear) continue

    const prevStandard = nitrogenStandardsData.find((ns) =>
      ns.b_lu_catalogue_match.includes(prevCult.b_lu_catalogue),
    )
    const currStandard = nitrogenStandardsData.find((ns) =>
      ns.b_lu_catalogue_match.includes(currCult.b_lu_catalogue),
    )

    const isPrevGrass = nonBouwlandCodes.includes(prevCult.b_lu_catalogue)
    const isCurrGrass = nonBouwlandCodes.includes(currCult.b_lu_catalogue)

    // 1. Grassland Renewal (Gras-na-Gras) -> 50 kg N/ha korting
    if (isPrevGrass && isCurrGrass) {
      const renewalDate = prevCult.b_lu_end
      let isValidRenewal = false

      // Footnote 14 (2026): Renewal between 1 June and 31 August for all soil types
      const isJuneToAugust =
        renewalDate >= new Date(currentYear, 5, 1) && // June 1
        renewalDate <= new Date(currentYear, 7, 31) // Aug 31

      if (isJuneToAugust) {
        isValidRenewal = true
      }

      if (isValidRenewal) {
        totalAmount = totalAmount.plus(50)
        descriptions.push("Korting: 50kg N/ha: graslandvernieuwing")
      }
    }

    // 2. Grassland Destruction (Gras-naar-Bouwland) -> 65 kg N/ha korting
    const isMaize = currStandard?.cultivation_rvo_table2.includes("mais")
    const isPotato = currStandard?.type === "aardappel"
    const isExcludedPotato =
      currStandard?.cultivation_rvo_table2.includes("pootaardappelen") ||
      currCult.b_lu_catalogue === "nl_2015" ||
      currCult.b_lu_catalogue === "nl_2016" ||
      currCult.b_lu_catalogue === "nl_1911" ||
      currCult.b_lu_catalogue === "nl_1912" ||
      currStandard?.cultivation_rvo_table2.includes("uitgroeiteelt")

    if (isPrevGrass && (isMaize || (isPotato && !isExcludedPotato))) {
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
      } else if (clayOrPeatRegions.includes(region)) {
        if (is_nv_area) {
          // Clay/Peat NV: Feb 1 - Mar 15
          if (
            destructionDate >= new Date(currentYear, 1, 1) &&
            destructionDate <= new Date(currentYear, 2, 15)
          ) {
            isValidDestruction = true
          }
        } else {
          // Clay/Peat Non-NV: Feb 1 - May 31
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
 * Calculates the nitrogen usage standard for an individual cultivation in 2026 according to RVO Tabel 2.
 *
 * This function performs multi-step agronomic compliance checks:
 * 1. **Standard & Subtype Resolution**: Matches `b_lu_catalogue` to Tabel 2 (2026) records. For non-main crops (`!isHoofdteelt`),
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
 * @param has_grazing_intention - Grazing intention for grassland parcels.
 * @param region - Soil region classification.
 * @param is_nv_area - Nutrient-polluted area (NV-gebied) indicator.
 * @returns Object containing the calculated norm value, standard name, subtype text, and explanatory footnote note.
 * @throws {NormNotApplicableError} If no matching crop standard exists in Tabel 2.
 */
function calculateSingleCultivationNorm(
  cultivation: NL2026NormsInputForCultivation,
  isHoofdteelt: boolean,
  prevCultivationsInYear: NL2026NormsInputForCultivation[],
  cultivations: NL2026NormsInputForCultivation[],
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
    cultivations,
    has_grazing_intention,
    isHoofdteelt,
  )

  const applicableNorms = getNormsForCultivation(
    selectedStandard,
    cultivation.b_lu_end ?? new Date("2026-12-31"),
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
      (cultivation.b_lu_start.getFullYear() < 2026 ||
        (cultivation.b_lu_start.getFullYear() === 2026 && cultivation.b_lu_start.getMonth() < 8))

    const isNotDestroyedBeforeFeb1 =
      !cultivation.b_lu_end || cultivation.b_lu_end >= new Date(2027, 1, 1)

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
 * Determines the 'gebruiksnorm' (nitrogen application standard) for a given field and cultivation plan in 2026
 * by accumulating per-teelt norms across all active crops in the calendar year according to
 * Dutch RVO "Tabel 2 Stikstof landbouwgrond 2026".
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
 *    - Grassland renewal reduction (50 kg N/ha on all soils, footnote 14).
 *    - Grassland destruction reduction (65 kg N/ha).
 *    - Article 28d catch-crop / winter-crop shortfall reductions.
 * 6. **Floor & Formatting**: Enforces non-negative norm floor (min 0) and generates a detailed audit breakdown string.
 *
 * @param input - Input data containing farm settings, field centroid/bufferstrip, and cultivation schedule.
 * @returns An object containing the aggregated `normValue` (in kg N/ha) and the descriptive `normSource`.
 *
 * @see `fdm-docs/docs/insights/fertilizer-application-norms/nl/2026/stikstofgebruiksnorm.md`
 */
export async function calculateNL2026StikstofGebruiksNorm(
  input: NL2026NormsInput,
): Promise<GebruiksnormResult> {
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
  const hoofdteelt = findHoofdteelt(cultivations, 2026, false, true)

  // Filter cultivations active in 2026
  const yearStart = new Date(2026, 0, 1)
  const yearEnd = new Date(2026, 11, 31, 23, 59, 59, 999)

  let yearCultivations = cultivations.filter((c) => {
    // Must overlap with the norm year
    const start = c.b_lu_start ? new Date(c.b_lu_start) : yearStart
    const end = c.b_lu_end ? new Date(c.b_lu_end) : yearEnd
    if (start > yearEnd || end < yearStart) return false

    // If it started before the norm year, it is only included if it is the hoofdteelt of the norm year
    if (c.b_lu_start && new Date(c.b_lu_start).getFullYear() < 2026) {
      return c === hoofdteelt
    }
    // If it started after the norm year, it is not part of this year
    if (c.b_lu_start && new Date(c.b_lu_start).getFullYear() > 2026) {
      return false
    }

    return true
  })

  // If no cultivations active in 2026, use fallback hoofdteelt (groene braak)
  if (yearCultivations.length === 0) {
    yearCultivations = [hoofdteelt as NL2026NormsInputForCultivation]
  }

  // Sort chronologically by start date
  const sortedCultivations = [...yearCultivations].sort((a, b) => {
    const aTime = a.b_lu_start ? new Date(a.b_lu_start).getTime() : 0
    const bTime = b.b_lu_start ? new Date(b.b_lu_start).getTime() : 0
    return aTime - bTime
  })

  // Determine which index in sortedCultivations is the hoofdteelt
  const hoofdteeltIndex = sortedCultivations.findIndex((c) =>
    c.b_lu && hoofdteelt.b_lu ? c.b_lu === hoofdteelt.b_lu : c === hoofdteelt,
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
 * Memoized version of {@link calculateNL2026StikstofGebruiksNorm}.
 */
export const getNL2026StikstofGebruiksNorm = withCalculationCache(
  calculateNL2026StikstofGebruiksNorm,
  "calculateNL2026StikstofGebruiksNorm",
  pkg.calculatorVersion,
  [],
  {
    entityType: "field",
    getEntityId: (input) => input.field.b_id,
  },
)
