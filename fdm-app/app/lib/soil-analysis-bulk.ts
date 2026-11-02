/**
 * Shared validation for the bulk soil analysis upload.
 *
 * Used by the review table (to skip rows that cannot be saved) and by both bulk save actions
 * (to reject a batch before anything is inserted), so the rules cannot drift apart.
 */

/**
 * Checks that a sampling depth is usable: both values are finite numbers, the upper depth is not
 * negative and the lower depth is deeper than the upper depth.
 *
 * @param depth - Upper and lower sampling depth in cm.
 * @returns `true` when the depth can be stored.
 */
export function isValidDepth(depth: {
  a_depth_lower?: number | null
  a_depth_upper?: number | null
}): depth is { a_depth_lower: number; a_depth_upper: number } {
  const { a_depth_lower: lower, a_depth_upper: upper } = depth
  return (
    typeof lower === "number" &&
    typeof upper === "number" &&
    Number.isFinite(lower) &&
    Number.isFinite(upper) &&
    upper >= 0 &&
    lower > upper
  )
}

/** A matched analysis that passed validation, with its depth and date parsed. */
export type ValidatedBulkAnalysis = {
  match: { analysisId: string; fieldId: string }
  analysis: any
  a_depth_upper: number
  a_depth_lower: number
  b_sampling_date: Date
}

export type BulkAnalysisValidationResult =
  | { valid: true; analyses: ValidatedBulkAnalysis[] }
  | { valid: false; message: string; invalidFiles: string[] }

/**
 * Validates every matched analysis (depth and sampling date) before any of them is inserted.
 *
 * A missing upper depth is treated as `0`. A match without a corresponding analysis is invalid.
 *
 * @param matches - Analysis-to-field matches as submitted by the review step.
 * @param analysesData - The analyses as submitted by the review step.
 * @returns The parsed analyses, or a Dutch message naming each affected file.
 */
export function validateBulkAnalyses(
  matches: { analysisId: string; fieldId: string }[],
  analysesData: any[],
): BulkAnalysisValidationResult {
  const analyses: ValidatedBulkAnalysis[] = []
  const invalidFiles: string[] = []

  for (const match of matches) {
    const analysis = analysesData.find((a) => a?.id === match.analysisId)
    const name = String(analysis?.filename ?? match.analysisId)
    if (!analysis) {
      invalidFiles.push(name)
      continue
    }

    const a_depth_lower = analysis.a_depth_lower
    const a_depth_upper = analysis.a_depth_upper ?? 0
    const samplingDate = analysis.b_sampling_date ? new Date(analysis.b_sampling_date) : undefined

    if (
      !isValidDepth({ a_depth_lower, a_depth_upper }) ||
      !samplingDate ||
      Number.isNaN(samplingDate.getTime())
    ) {
      invalidFiles.push(name)
      continue
    }

    analyses.push({
      match,
      analysis,
      a_depth_lower,
      a_depth_upper,
      b_sampling_date: samplingDate,
    })
  }

  if (invalidFiles.length > 0) {
    return {
      valid: false,
      invalidFiles,
      message: `Niets opgeslagen. Controleer de bemonsteringsdiepte en datum van: ${invalidFiles.join(", ")}`,
    }
  }
  return { valid: true, analyses }
}
