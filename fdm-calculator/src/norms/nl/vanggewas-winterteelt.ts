import { VANGGEWAS_2025, WINTERTEELT_2025 } from "./2025/value/vanggewas-winterteelt-data"
import { VANGGEWAS_2026, WINTERTEELT_2026 } from "./2026/value/vanggewas-winterteelt-data"

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
export function getCatchCrops(year: number = 2025): Set<string> {
  if (year >= 2026) {
    return VANGGEWAS_2026
  }
  return VANGGEWAS_2025
}

/**
 * Returns the Winter Crop (Winterteelt) Set for a given year (defaults to 2025).
 */
export function getWinterCrops(year: number = 2025): Set<string> {
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
      const standsUntilEnd = !c.b_lu_end || (mainCropEnd && c.b_lu_end >= mainCropEnd)
      return startsBeforeOrAroundHarvest && standsUntilEnd
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
