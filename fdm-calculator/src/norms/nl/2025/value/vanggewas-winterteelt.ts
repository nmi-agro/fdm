/**
 * Catch crops (`vanggewassen`) and winter crops (`winterteelten`) on sand and loess soils.
 *
 * This module implements article 28d of the Uitvoeringsregeling Meststoffenwet (Urm),
 * introduced by Stcrt. 2023, 20380 in implementation of the 7th Action Programme
 * Nitraatrichtlijn. It answers two questions:
 *
 * 1. Is a given crop code a catch crop (Annex A, table 6) and/or a winter crop
 *    (Annex A, table 7)?
 * 2. Given a field's cultivation history, what reduction (`korting`) applies to the
 *    nitrogen usage standard of the norm year?
 *
 * ## The rule in brief
 *
 * On sand and loess soils, land must be covered over winter to limit nitrogen leaching.
 * Article 28d lid 1 reduces the *total* nitrogen a farmer may use in the norm year when,
 * in the **preceding** calendar year, no catch crop from table 6 was grown by 1 October
 * at the latest. Lid 2 sets the sliding scale:
 *
 * | Start of catch crop cultivation | Reduction |
 * | ------------------------------- | --------- |
 * | on or before 1 October          | none      |
 * | 2 – 14 October                  | 5 kg N/ha |
 * | 15 – 31 October                 | 10 kg N/ha |
 * | on or after 1 November          | 20 kg N/ha |
 * | none grown after the main crop  | 20 kg N/ha |
 *
 * Lid 3 adds 20 kg N/ha when the catch crop is destroyed before 1 February of the norm year.
 * Lid 4 disapplies the reduction for a winter crop from table 7, for inundation, and where
 * the separate catch crop obligation after maize applies (art. 4.1193 / 4.1211 Bal).
 *
 * ## Two design decisions worth knowing
 *
 * **Anchored to the previous year's main crop.** Lid 2 onderdeel d ties the maximum
 * reduction to the case where "in het voorafgaande kalenderjaar **na de hoofdteelt** geen
 * vanggewas wordt geteeld". The assessment therefore starts from `hoofdteelt(N-1)`, not
 * from a fixed calendar window and not from the main crop of the norm year. A consequence
 * is that undersown catch crops (`onderzaai`, sown in May or June into a standing crop)
 * are valid and attract no reduction, as are catch crops sown early after an
 * early-harvested main crop.
 *
 * **Evaluated per crop code.** Membership of tables 6 and 7 is defined per BRP crop code,
 * whereas the nitrogen norm table (RVO Tabel 2) groups several codes into one row — for
 * example spring-sown and winter onion. A flag on a norm row therefore cannot represent
 * the statutory lists, so this module looks up `b_lu_catalogue` directly against the code
 * sets in `vanggewas-winterteelt-data.ts`.
 *
 * The article speaks of `landbouwgrond` throughout, never `bouwland`. Grassland is
 * therefore not excluded by a separate arable-land test but by the lid 4a winter crop
 * exemption, since grassland codes appear on table 7.
 *
 * @see {@link https://wetten.overheid.nl/BWBR0018989 | Article 28d Uitvoeringsregeling Meststoffenwet}
 * @see {@link https://www.rvo.nl/onderwerpen/mest/vanggewas-op-zand-en-lossgrond | RVO — Vanggewas op zand- en lössgrond}
 * @module
 */

import Decimal from "decimal.js"
import { VANGGEWAS_2025, WINTERTEELT_2025 } from "./vanggewas-winterteelt-data"
import { VANGGEWAS_2026, WINTERTEELT_2026 } from "../../2026/value/vanggewas-winterteelt-data"
import { findHoofdteelt } from "../../../../shared/hoofdteelt"
import type { NL2025NormsInputForCultivation, RegionKey } from "./types"

/**
 * Soil regions where the article 28d reduction applies.
 *
 * The measure is limited to sand and loess because the water quality effect of catch crops
 * on clay and peat is limited, and leaving clay bare over winter is established practice
 * for frost tilth.
 */
const sandyOrLoessRegions: RegionKey[] = ["zand_nwc", "zand_zuid", "loess"]

/**
 * Minimal cultivation shape required to evaluate winter crop conditions.
 *
 * Deliberately narrower than {@link NL2025NormsInputForCultivation} so that callers can
 * evaluate a single crop record without assembling a full norms input.
 */
export type CultivationForCondition = {
  b_lu_catalogue: string
  b_lu_start?: Date | null
  b_lu_end?: Date | null
}

/**
 * A statutory condition attached to a specific winter crop code.
 *
 * Several entries on table 7 qualify only under a condition stated in the crop description
 * itself, so winter crop status cannot be a plain boolean per code.
 *
 * - `harvest_date_on_or_after` — the crop counts as a winter crop only when harvested on or
 *   after the given date, because only then is its autumn nitrogen uptake comparable to a
 *   timely sown catch crop.
 * - `requires_undersowing` — the crop counts as a winter crop only when a catch crop was
 *   undersown into it.
 */
export type WinterCropCondition =
  | { type: "harvest_date_on_or_after"; month: number; day: number }
  | { type: "requires_undersowing" }

/**
 * Returns the statutory condition attached to a winter crop code, or `null` when the code
 * qualifies unconditionally.
 *
 * Two groups on table 7 carry a condition:
 *
 * - **Sugar and fodder beet** are listed as "na 1-11 geoogst". Lifted earlier they are not a
 *   winter crop, so the ordinary catch crop rules apply to whatever follows them.
 * - **Maize** is listed as "met onderzaai". This is how RVO gives effect to the separate
 *   catch crop obligation after maize on sand and loess: undersow, and the maize itself
 *   satisfies the cover requirement. Note that silage maize (`nl_259`) is not on table 7 at
 *   all and therefore never qualifies.
 *
 * @param b_lu_catalogue - The BRP crop code to inspect.
 * @returns The condition to evaluate, or `null` if the code has none.
 */
export function getWinterCropCondition(b_lu_catalogue: string): WinterCropCondition | null {
  // Sugar beet (nl_256) & Fodder beet (nl_257): harvested on or after Nov 1
  if (b_lu_catalogue === "nl_256" || b_lu_catalogue === "nl_257") {
    return { type: "harvest_date_on_or_after", month: 11, day: 1 }
  }
  // Grain, Corncob, Energy, Sugar maize variants: require undersowing ("met onderzaai")
  if (
    b_lu_catalogue === "nl_316" ||
    b_lu_catalogue === "nl_317" ||
    b_lu_catalogue === "nl_1935" ||
    b_lu_catalogue === "nl_2032" ||
    b_lu_catalogue === "nl_814"
  ) {
    return { type: "requires_undersowing" }
  }
  return null
}

/**
 * Returns the set of catch crop codes (Annex A, table 6) for a norm year.
 *
 * @param year - The norm year. Years from 2026 onwards use the 2026 set; earlier years use
 *   the 2025 set.
 * @returns The crop codes that count as a catch crop in that year.
 */
export function getCatchCrops(year: number = 2025): ReadonlySet<string> {
  if (year >= 2026) {
    return VANGGEWAS_2026
  }
  return VANGGEWAS_2025
}

/**
 * Returns the set of winter crop codes (Annex A, table 7) for a norm year.
 *
 * Membership alone is not sufficient for codes that carry a condition; see
 * {@link getWinterCropCondition} and {@link isWinterteelt}.
 *
 * @param year - The norm year. Years from 2026 onwards use the 2026 set; earlier years use
 *   the 2025 set.
 * @returns The crop codes that appear on the winter crop list for that year.
 */
export function getWinterCrops(year: number = 2025): ReadonlySet<string> {
  if (year >= 2026) {
    return WINTERTEELT_2026
  }
  return WINTERTEELT_2025
}

/**
 * Checks whether a crop code is a catch crop (`vanggewas`) under Annex A, table 6.
 *
 * Catch crop status is unconditional: a code is on the list or it is not.
 *
 * @param b_lu_catalogue - The BRP crop code to check.
 * @param year - The norm year whose list should be used.
 * @returns `true` when the code is on the catch crop list.
 */
export function isVanggewas(b_lu_catalogue: string, year: number = 2025): boolean {
  return getCatchCrops(year).has(b_lu_catalogue)
}

/**
 * Checks whether a crop code is a winter crop (`winterteelt`) under Annex A, table 7,
 * including any statutory condition attached to that code.
 *
 * Codes without a condition qualify on membership alone. Codes with one require the
 * cultivation record, and in the case of undersowing the other cultivations on the field,
 * to decide. When the information needed to evaluate a condition is missing, the function
 * returns `false` — the conservative outcome, since an unproven exemption would otherwise
 * silently suppress a reduction that is due.
 *
 * @param b_lu_catalogue - The BRP crop code to check.
 * @param year - The norm year whose list should be used.
 * @param cultivation - The cultivation record for this crop. Required to evaluate a harvest
 *   date condition, and used as the reference for an undersowing condition.
 * @param allCultivations - All cultivations on the field, needed to find an undersown catch
 *   crop.
 * @returns `true` when the code is on the winter crop list and its condition, if any, is met.
 */
export function isWinterteelt(
  b_lu_catalogue: string,
  year: number = 2025,
  cultivation?: CultivationForCondition,
  allCultivations?: CultivationForCondition[],
): boolean {
  if (!getWinterCrops(year).has(b_lu_catalogue)) {
    return false
  }

  const condition = getWinterCropCondition(b_lu_catalogue)
  if (!condition) {
    return true
  }

  if (condition.type === "harvest_date_on_or_after") {
    // Without a harvest date the condition cannot be shown to be met, so the crop does not
    // qualify as a winter crop and the ordinary catch crop rules apply.
    if (!cultivation?.b_lu_end) {
      return false
    }
    const harvestDate = new Date(cultivation.b_lu_end)
    const requiredDate = new Date(harvestDate.getFullYear(), condition.month - 1, condition.day)
    return harvestDate >= requiredDate
  }

  if (condition.type === "requires_undersowing") {
    if (!allCultivations || allCultivations.length === 0) {
      return false
    }
    const mainCropEnd = cultivation?.b_lu_end
    // Look for a catch crop that was sown into the standing crop and was still present when
    // it was harvested — that is what "met onderzaai" describes. Records with unknown dates
    // are treated as compatible rather than disqualifying, because an undersow is often
    // registered without a precise end date.
    return allCultivations.some((c) => {
      if (c.b_lu_catalogue === b_lu_catalogue) return false
      if (!isVanggewas(c.b_lu_catalogue, year)) return false
      if (!c.b_lu_start) return false
      const startsBeforeOrAroundHarvest = !mainCropEnd || c.b_lu_start <= mainCropEnd
      const standsUntilEnd = !c.b_lu_end || !mainCropEnd || c.b_lu_end >= mainCropEnd
      return Boolean(startsBeforeOrAroundHarvest && standsUntilEnd)
    })
  }

  return true
}

/**
 * Checks whether a crop code appears on **both** table 6 and table 7.
 *
 * This group — winter cereals and grasses — is treated separately by lid 4a: such a crop
 * only counts as a winter crop when it is grown as the following year's main crop, which
 * article 28d expresses as being sown directly after the preceding crop and not destroyed
 * before 16 May. Otherwise it is a catch crop and the sliding scale applies.
 *
 * @param b_lu_catalogue - The BRP crop code to check.
 * @param year - The norm year whose lists should be used.
 * @returns `true` when the code is on both lists.
 */
export function isVanggewasEnWinterteelt(b_lu_catalogue: string, year: number = 2025): boolean {
  return isVanggewas(b_lu_catalogue, year) && isWinterteelt(b_lu_catalogue, year)
}

/**
 * Calculates the catch crop and winter crop reduction under article 28d Urm.
 *
 * The reduction is expressed per hectare and is returned for a single field; farm totals are
 * obtained by multiplying by field area and summing, which `aggregateNormsToFarmLevel()`
 * does. This matches lid 1, which lowers the farm's total nitrogen space "per hectare
 * landbouwgrond die het betreft".
 *
 * ## Order of evaluation
 *
 * 1. **Region gate.** Outside sand and loess no reduction applies.
 * 2. **Winter crop as `hoofdteelt(N-1)`.** A late-harvested or perennial table 7 crop — beet
 *    lifted on or after 1 November, chicory, asparagus, top fruit, grassland, maize with
 *    undersowing — covers the ground itself, so no catch crop was owed. Excluded here are
 *    codes that are also on table 6, which are handled in the next step.
 * 3. **Winter crop as `hoofdteelt(N)`.** Winter cereals and grasses are sown in the autumn of
 *    year N-1 and harvested in year N, so the same cultivation record is both the cover crop
 *    and the following main crop. Per lid 4a this only exempts when the crop was not
 *    destroyed before 16 May of the norm year.
 * 4. **A crop grown after `hoofdteelt(N-1)`.** Autumn-sown table 7 crops such as spinach sown
 *    after 1 August exempt; otherwise the catch crops found here feed the sliding scale.
 * 5. **Sliding scale.** Sowing date decides the amount, with the full reduction when nothing
 *    was grown, nothing stood until 1 February, or the sowing date is unknown.
 *
 * The reduction is cumulative with the grassland renewal and destruction reductions: the
 * explanatory memorandum states that article 28d applies "naast" articles 28 to 28c, which
 * remain "onverkort van toepassing". Callers therefore add this result to those amounts
 * rather than choosing between them.
 *
 * @param cultivations - All known cultivations for the field, which must include the
 *   previous calendar year. Without them a compliant field cannot be distinguished from a
 *   non-compliant one and the maximum reduction may be returned.
 * @param region - The soil region of the field.
 * @param currentYear - The norm year (N). The catch crop obligation is assessed for N-1.
 * @param descriptions - Mutable list of human-readable explanations, appended to in place so
 *   the caller can compose a single `normSource` covering every reduction applied.
 * @returns The reduction in kg N/ha, as a {@link Decimal}.
 */
export function calculateVanggewasWinterteeltKorting(
  cultivations: NL2025NormsInputForCultivation[],
  region: RegionKey,
  currentYear: number,
  descriptions: string[],
): Decimal {
  if (!sandyOrLoessRegions.includes(region)) {
    return new Decimal(0)
  }

  const previousYear = currentYear - 1

  // Determine hoofdteelt of previous year (N-1) using year-aware lookup
  const hoofdteeltPrevCultivation = findHoofdteelt(cultivations, previousYear, false, true)
  const hoofdteeltPrevYear = hoofdteeltPrevCultivation.b_lu_catalogue

  // Determine hoofdteelt of current year (N)
  const hoofdteeltCurrCultivation = findHoofdteelt(cultivations, currentYear, false, true)
  const hoofdteeltCurrYear = hoofdteeltCurrCultivation.b_lu_catalogue

  let catchCropExempt = false

  // Step 2: hoofdteelt(N-1) is itself a winterteelt-only crop (e.g. beet lifted >= Nov 1,
  // chicory, asparagus, top fruit, maize with undersowing). Codes that are also a vanggewas
  // are excluded here because lid 4a subjects them to extra conditions; see step 3.
  if (
    isWinterteelt(hoofdteeltPrevYear, previousYear, hoofdteeltPrevCultivation, cultivations) &&
    !isVanggewas(hoofdteeltPrevYear, previousYear)
  ) {
    catchCropExempt = true
    descriptions.push("Geen korting: winterteelt aanwezig in voorafgaand jaar")
  }

  if (!catchCropExempt) {
    // Step 3: winter cereals & grasses (on both table 6 and table 7) as hoofdteelt(N).
    // Sown in autumn N-1 and harvested in year N, so one record serves as both the winter
    // cover and the following main crop.
    if (isVanggewasEnWinterteelt(hoofdteeltCurrYear, currentYear) && hoofdteeltCurrCultivation) {
      const end = hoofdteeltCurrCultivation.b_lu_end
      // Lid 4a onder 2: destroyed before 16 May means it was not truly the main crop of
      // year N, so it falls back to being a catch crop and the scale applies.
      const notDestroyedBeforeMay16 =
        !end || end.getTime() >= new Date(currentYear, 4, 16).getTime()
      if (notDestroyedBeforeMay16) {
        catchCropExempt = true
        descriptions.push("Geen korting: winterteelt aanwezig")
      }
    }
  }

  if (!catchCropExempt) {
    // Step 4: candidates are crops grown after hoofdteelt(N-1). The window runs to the end of
    // January of the norm year because a catch crop may still be established late; the main
    // crop itself is excluded, since the obligation concerns what follows it.
    const candidateCultivations = cultivations.filter((c) => {
      if (!c.b_lu_start) return false
      const sownInWindow =
        c.b_lu_start.getFullYear() === previousYear ||
        (c.b_lu_start.getFullYear() === currentYear && c.b_lu_start.getMonth() === 0)
      if (!sownInWindow) return false

      const isCatchOrWinter =
        isVanggewas(c.b_lu_catalogue, previousYear) ||
        isWinterteelt(c.b_lu_catalogue, previousYear, c, cultivations)
      return isCatchOrWinter && c.b_lu_catalogue !== hoofdteeltPrevYear
    })

    // An autumn-sown table 7 crop (e.g. spinach sown after 1 August) exempts on its own.
    const followingWinterCrop = candidateCultivations.find(
      (c) =>
        isWinterteelt(c.b_lu_catalogue, previousYear, c, cultivations) &&
        !isVanggewas(c.b_lu_catalogue, previousYear),
    )
    if (followingWinterCrop) {
      descriptions.push("Geen korting: winterteelt aanwezig")
    } else {
      // Filter to valid vanggewassen (catch crops)
      const vanggewassenPrevYear = candidateCultivations.filter((c) =>
        isVanggewas(c.b_lu_catalogue, previousYear),
      )

      // Lid 2 onderdeel d: nothing grown after the main crop.
      if (vanggewassenPrevYear.length === 0) {
        descriptions.push("Korting: 20kg N/ha: geen vanggewas of winterteelt")
        return new Decimal(20)
      } else {
        // Lid 3: the catch crop must still stand on 1 February of the norm year. A missing
        // end date is read as "still standing".
        const vanggewassenCompleted = vanggewassenPrevYear.filter((prevCultivation) => {
          return (
            prevCultivation.b_lu_end === null ||
            (prevCultivation.b_lu_end &&
              prevCultivation.b_lu_end.getTime() >= new Date(currentYear, 1).getTime())
          )
        })
        if (vanggewassenCompleted.length === 0) {
          descriptions.push("Korting: 20kg N/ha: vanggewas staat niet tot 1 februari")
          return new Decimal(20)
        } else {
          // When multiple qualifying catch crops stand until February 1st,
          // the statutory rule uses the qualifying catch crop with the earliest
          // sowing date, resulting in the smallest reduction.
          const sortedVanggewassen = vanggewassenCompleted
            .filter((v) => v.b_lu_start !== undefined)
            .sort((a, b) => {
              if (!a.b_lu_start || !b.b_lu_start) return 0
              return a.b_lu_start.getTime() - b.b_lu_start.getTime()
            })
          const vanggewas = sortedVanggewassen[0]
          const sowDate = vanggewas.b_lu_start

          // RVO applies the maximum reduction when no sowing date was reported. Within FDM
          // this is a data quality gap rather than a breach, but the outcome is the same.
          if (!sowDate) {
            descriptions.push("Korting: 20kg N/ha, geen zaaidatum bekend")
            return new Decimal(20)
          } else {
            // Lid 2 onderdelen a-c. Note that sowing *on* 1 October is still reduction-free;
            // the 5 kg band starts on 2 October.
            const october1 = new Date(previousYear, 9, 1)
            const october15 = new Date(previousYear, 9, 15)
            const november1 = new Date(previousYear, 10, 1)

            if (sowDate <= october1) {
              descriptions.push("Geen korting: vanggewas gezaaid uiterlijk 1 oktober")
              return new Decimal(0)
            } else if (sowDate > october1 && sowDate < october15) {
              descriptions.push("Korting: 5kg N/ha, vanggewas gezaaid tussen 2 t/m 14 oktober")
              return new Decimal(5)
            } else if (sowDate >= october15 && sowDate < november1) {
              descriptions.push("Korting: 10kg N/ha, vanggewas gezaaid tussen 15 t/m 31 oktober")
              return new Decimal(10)
            } else {
              descriptions.push("Korting: 20kg N/ha, vanggewas gezaaid op of na 1 november")
              return new Decimal(20)
            }
          }
        }
      }
    }
  }

  return new Decimal(0)
}
