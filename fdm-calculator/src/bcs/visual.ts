/**
 * The visual scores of a soil condition score (BCS) assessment, scored in the field.
 */
export const BCS_VISUAL_KEYS = [
  "a_ss_bcs",
  "a_sc_bcs",
  "a_rd_bcs",
  "a_ew_bcs",
  "a_cc_bcs",
  "a_gs_bcs",
  "a_p_bcs",
  "a_c_bcs",
  "a_rt_bcs",
] as const

/** One of the visual scores of a soil condition score (BCS) assessment. */
export type BcsVisualKey = (typeof BCS_VISUAL_KEYS)[number]

/** A soil analysis, or any object, with optional visual BCS scores. */
export type BcsAnalysisLike = Partial<Record<BcsVisualKey, number | null>>

/**
 * Returns whether a soil analysis is a soil condition score (BCS) assessment: an analysis with
 * at least one visual score. Photos of an assessment belong to such an analysis.
 *
 * @param analysis - The soil analysis.
 * @returns `true` when at least one visual score is set.
 * @example
 * ```ts
 * isBcsAnalysis({ a_ew_bcs: 2 }) // true
 * isBcsAnalysis({ a_ew_bcs: null }) // false
 * ```
 */
export function isBcsAnalysis(analysis: BcsAnalysisLike): boolean {
  return BCS_VISUAL_KEYS.some((key) => analysis[key] !== null && analysis[key] !== undefined)
}
