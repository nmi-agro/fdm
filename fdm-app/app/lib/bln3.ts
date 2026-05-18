import type { FieldBln3Score } from "~/integrations/bln3.server"

/**
 * Computes a farm-level average score for a given set of indicator IDs.
 * Only fields with available scores contribute to the average.
 *
 * This is a pure function (no I/O) so it can run on both server and client.
 *
 * @param fieldScores - Array of per-field BLN3 scores
 * @param indicatorIds - Indicator IDs to include in the aggregation
 * @param mode - "score" (with measures) or "index" (without measures)
 */
export function computeFarmAggregation(
    fieldScores: FieldBln3Score[],
    indicatorIds: string[],
    mode: "score" | "index" = "score",
): number | null {
    const allValues: number[] = []

    for (const { score } of fieldScores) {
        if (!score) continue
        for (const indicator of score.indicators) {
            if (!indicatorIds.includes(indicator.indicator_id)) continue
            const value = mode === "score" ? indicator.score : indicator.index
            if (value == null || Number.isNaN(value)) continue
            allValues.push(value)
        }
    }

    if (allValues.length === 0) return null
    const avg = allValues.reduce((sum, v) => sum + v, 0) / allValues.length
    return avg
}
