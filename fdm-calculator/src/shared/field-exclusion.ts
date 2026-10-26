/**
 * Reason why a field is left out of field-level nutrient calculations.
 *
 * - `bufferstrip`: the field is registered as a buffer strip.
 * - `landscape_element`: the main cultivation is a landscape element (e.g. ditch, hedge, tree row).
 * - `nature`: the main cultivation is a nature cultivation.
 */
export type FieldExclusionReason = "bufferstrip" | "nature" | "landscape_element"

/**
 * BRP cultivation codes of landscape elements ("landschapselementen").
 *
 * Matches the cultivations of type "Landschapselement" in the Dutch nitrogen usage norms.
 */
export const LANDSCAPE_ELEMENT_BRP_CODES: readonly string[] = [
  "nl_343",
  "nl_794",
  "nl_795",
  "nl_2617",
  "nl_2618",
  "nl_2619",
  "nl_2620",
  "nl_2621",
  "nl_2622",
  "nl_2624",
  "nl_2625",
  "nl_2626",
  "nl_2628",
  "nl_2629",
  "nl_2630",
  "nl_2631",
  "nl_2633",
  "nl_2634",
  "nl_2636",
  "nl_2637",
  "nl_2638",
  "nl_2639",
  "nl_2642",
  "nl_6808",
  "nl_6801",
  "nl_6793",
]

/**
 * Determines whether a field is left out of field-level nutrient calculations and why.
 *
 * Buffer strips take precedence, followed by landscape elements and then nature cultivations.
 *
 * @param field - Field characteristics relevant for the exclusion.
 * @param field.b_bufferstrip - Whether the field is a buffer strip.
 * @param field.b_lu_croprotation - Crop rotation type of the main cultivation.
 * @param field.b_lu_catalogue - Catalogue code of the main cultivation.
 * @returns The exclusion reason, or `null` when the field is included.
 */
export function getFieldExclusionReason(field: {
  b_bufferstrip?: boolean | null
  b_lu_croprotation?: string | null
  b_lu_catalogue?: string | null
}): FieldExclusionReason | null {
  if (field.b_bufferstrip === true) return "bufferstrip"
  if (field.b_lu_catalogue && LANDSCAPE_ELEMENT_BRP_CODES.includes(field.b_lu_catalogue)) {
    return "landscape_element"
  }
  if (field.b_lu_croprotation === "nature") return "nature"
  return null
}
