import Decimal from "decimal.js"
import { VANGGEWAS_2025, WINTERTEELT_2025 } from "./vanggewas-winterteelt-data"
import { VANGGEWAS_2026, WINTERTEELT_2026 } from "../../2026/value/vanggewas-winterteelt-data"
import { determineNLHoofdteelt } from "./hoofdteelt"
import type { NL2025NormsInputForCultivation, RegionKey } from "./types"

const sandyOrLoessRegions: RegionKey[] = ["zand_nwc", "zand_zuid", "loess"]

/**
 * Minimal cultivation shape required to evaluate winter crop conditions.
 */
export type CultivationForCondition = {
  b_lu_catalogue: string
  b_lu_start?: Date | null
  b_lu_end?: Date | null
}

/**
 * Represents statutory conditions attached to specific winter crop codes.
 */
export type WinterCropCondition =
  | { type: "harvest_date_on_or_after"; month: number; day: number }
  | { type: "requires_undersowing" }

/**
 * Gets the statutory condition for a winter crop code, if any.
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
 * Returns the Catch Crop (Vanggewas) Set for a given year (defaults to 2025).
 */
export function getCatchCrops(year: number = 2025): ReadonlySet<string> {
  if (year >= 2026) {
    return VANGGEWAS_2026
  }
  return VANGGEWAS_2025
}

/**
 * Returns the Winter Crop (Winterteelt) Set for a given year (defaults to 2025).
 */
export function getWinterCrops(year: number = 2025): ReadonlySet<string> {
  if (year >= 2026) {
    return WINTERTEELT_2026
  }
  return WINTERTEELT_2025
}

/**
 * Checks whether a given crop catalogue code (`b_lu_catalogue`) is a catch crop (vanggewas).
 */
export function isVanggewas(b_lu_catalogue: string, year: number = 2025): boolean {
  return getCatchCrops(year).has(b_lu_catalogue)
}

/**
 * Checks whether a given crop catalogue code (`b_lu_catalogue`) is a winter crop (winterteelt),
 * evaluating any statutory conditions attached to the crop code (e.g. beet harvest date >= Nov 1, maize undersowing).
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
 * Checks whether a crop code is both a catch crop and a winter crop (e.g. winter cereals and grasses).
 */
export function isVanggewasEnWinterteelt(b_lu_catalogue: string, year: number = 2025): boolean {
  return isVanggewas(b_lu_catalogue, year) && isWinterteelt(b_lu_catalogue, year)
}

/**
 * Calculates the catch crop (vanggewas) and winter crop (winterteelt) reduction (korting)
 * under Article 28d Uitvoeringsregeling Meststoffenwet for a given norm year.
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
  const hoofdteeltPrevYear = determineNLHoofdteelt(cultivations, previousYear)
  const hoofdteeltPrevCultivation = determineNLHoofdteelt(cultivations, previousYear, true)

  // Determine hoofdteelt of current year (N)
  const hoofdteeltCurrYear = determineNLHoofdteelt(cultivations, currentYear)
  const hoofdteeltCurrCultivation = determineNLHoofdteelt(cultivations, currentYear, true)

  let catchCropExempt = false

  // If hoofdteelt(N-1) is itself a winterteelt-only crop (e.g. beet lifted >= Nov 1, chicory, asparagus, top fruit, maize with undersowing)
  if (
    isWinterteelt(hoofdteeltPrevYear, previousYear, hoofdteeltPrevCultivation, cultivations) &&
    !isVanggewas(hoofdteeltPrevYear, previousYear)
  ) {
    catchCropExempt = true
    descriptions.push("Geen korting: winterteelt aanwezig in voorafgaand jaar")
  }

  if (!catchCropExempt) {
    // Check for winter cereals & grasses (both vanggewas & winterteelt) as hoofdteelt(N):
    if (isVanggewasEnWinterteelt(hoofdteeltCurrYear, currentYear) && hoofdteeltCurrCultivation) {
      const end = hoofdteeltCurrCultivation.b_lu_end
      const notDestroyedBeforeMay16 =
        !end || end.getTime() >= new Date(currentYear, 4, 16).getTime()
      if (notDestroyedBeforeMay16) {
        catchCropExempt = true
        descriptions.push("Geen korting: winterteelt aanwezig")
      }
    }
  }

  if (!catchCropExempt) {
    // Find candidate catch crops or winter crops in previous year N-1
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

    // Check if an autumn-sown winterteelt-only crop follows hoofdteelt(N-1)
    const followingWinterCrop = candidateCultivations.find(
      (c) =>
        isWinterteelt(c.b_lu_catalogue, previousYear, c, cultivations) &&
        !isVanggewas(c.b_lu_catalogue, previousYear),
    )
    if (followingWinterCrop) {
      catchCropExempt = true
      descriptions.push("Geen korting: winterteelt aanwezig")
    } else {
      // Filter to valid vanggewassen (catch crops)
      const vanggewassenPrevYear = candidateCultivations.filter((c) =>
        isVanggewas(c.b_lu_catalogue, previousYear),
      )

      if (vanggewassenPrevYear.length === 0) {
        descriptions.push("Korting: 20kg N/ha: geen vanggewas of winterteelt")
        return new Decimal(20)
      } else {
        // Check if a vanggewas is present to February 1st
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

          if (!sowDate) {
            descriptions.push("Korting: 20kg N/ha, geen zaaidatum bekend")
            return new Decimal(20)
          } else {
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
