/**
 * BRP cultivation codes that are not scored by BLN3 (nature areas).
 */
export const EXCLUDED_BLN3_BRP_CODES = ["nl_343", "nl_6801"]

/**
 * Reason why a field gets no BLN3 score, measure applicability or measure advice in a year.
 *
 * - `bufferstrip`: the field is registered as a buffer strip.
 * - `nature`: the main cultivation of the year is a nature cultivation.
 * - `no_main_cultivation`: the field has no main cultivation in the year.
 */
export type Bln3ExclusionReason = "bufferstrip" | "nature" | "no_main_cultivation"

/**
 * Determines whether a field is left out of BLN3 in a year and why.
 *
 * Buffer strips take precedence, followed by a missing main cultivation and then nature
 * cultivations.
 *
 * @param field - Field characteristics relevant for the exclusion.
 * @param field.b_bufferstrip - Whether the field is a buffer strip.
 * @param field.hasMainCultivation - Whether the field has a main cultivation in the year.
 * @param field.b_lu_croprotation - Crop rotation type of the main cultivation.
 * @param field.b_lu_catalogue - Catalogue code of the main cultivation.
 * @returns The exclusion reason, or `null` when the field is included.
 */
export function getBln3ExclusionReason(field: {
  b_bufferstrip?: boolean | null
  hasMainCultivation: boolean
  b_lu_croprotation?: string | null
  b_lu_catalogue?: string | null
}): Bln3ExclusionReason | null {
  if (field.b_bufferstrip === true) return "bufferstrip"
  if (!field.hasMainCultivation) return "no_main_cultivation"
  if (isExcludedFromBln3({ ...field, b_bufferstrip: false })) return "nature"
  return null
}

/**
 * Determines whether a field is left out of BLN3 scoring.
 *
 * Buffer strips and nature fields get no BLN3 score and do not contribute to farm-level
 * weighting.
 *
 * @param field - Field characteristics relevant for the exclusion.
 * @param field.b_bufferstrip - Whether the field is a buffer strip.
 * @param field.b_lu_croprotation - Crop rotation type of the main cultivation.
 * @param field.b_lu_catalogue - Catalogue code of the main cultivation.
 * @returns `true` when the field is excluded from BLN3 scores.
 */
export function isExcludedFromBln3(field: {
  b_bufferstrip?: boolean | null
  b_lu_croprotation?: string | null
  b_lu_catalogue?: string | null
}): boolean {
  if (field.b_bufferstrip === true) return true
  if (field.b_lu_croprotation === "nature") return true
  if (field.b_lu_catalogue && EXCLUDED_BLN3_BRP_CODES.includes(field.b_lu_catalogue)) return true
  return false
}
