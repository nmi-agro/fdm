import type { CultivationDetail, FieldInput } from "../types"

/**
 * The land use of a field at a given moment, as used by the emission calculations.
 */
export type LandType = "grassland" | "cropland" | "bare soil"

const grasslandRotations = new Set(["grass", "clover"])
const croplandRotations = new Set([
  "potato",
  "rapeseed",
  "starch",
  "maize",
  "cereal",
  "sugarbeet",
  "catchcrop",
  "alfalfa",
  "nature",
  "other",
])
// Crop codes that are considered as bare soil, even if their crop rotation is grassland or cropland
const bareSoilCropCodes = new Set([
  "nl_6794", // Braak, zwart
  "nl_662", // Grasland, blijvend, natuurlijk, hoofdfunctie natuur
  "nl_6798", // Grasland, tijdelijk, hoofdfunctie natuur
  "nl_2300", // Groenbemester
  "nl_3802", // Groenbemester / rustgewas (geen N-bemesting)
  "nl_3801", // Groenbemester / rustgewas (wel N-bemesting)
])

/**
 * Determines the land use of a field on a given date, based on the cultivations that are active on that date.
 *
 * A cultivation is active when it started on or before the date and has not ended before the date.
 * Grassland has priority over cropland; when neither is active, the field is considered bare soil.
 *
 * @param date - The date for which the land use is determined, e.g. the date of a fertilizer application.
 * @param cultivations - The cultivations of the field.
 * @param cultivationDetails - A map of cultivation details, with the cultivation catalogue identifier as key.
 * @returns The land use of the field on the given date.
 *
 * @example
 * ```ts
 * const landType = determineLandTypeAtDate(new Date("2025-04-01"), cultivations, cultivationDetails)
 * // "cropland"
 * ```
 */
export function determineLandTypeAtDate(
  date: Date,
  cultivations: FieldInput["cultivations"],
  cultivationDetails: Map<string, CultivationDetail>,
): LandType {
  const activeCultivations = cultivations.filter((cultivation) => {
    if (!cultivation.b_lu_start) return false
    if (cultivation.b_lu_end) {
      return (
        cultivation.b_lu_start.getTime() <= date.getTime() &&
        cultivation.b_lu_end.getTime() >= date.getTime()
      )
    }
    return cultivation.b_lu_start.getTime() <= date.getTime()
  })

  let hasGrassland = false
  let hasCropland = false
  for (const cultivation of activeCultivations) {
    const rotation = cultivationDetails.get(cultivation.b_lu_catalogue)?.b_lu_croprotation
    if (!rotation || bareSoilCropCodes.has(cultivation.b_lu_catalogue)) continue
    if (grasslandRotations.has(rotation)) hasGrassland = true
    if (croplandRotations.has(rotation)) hasCropland = true
  }

  if (hasGrassland) return "grassland"
  if (hasCropland) return "cropland"
  return "bare soil"
}
