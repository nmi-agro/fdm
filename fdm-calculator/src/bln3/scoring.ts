import Decimal from "decimal.js"
import type { Bln3Score } from "./types"

/**
 * Score of one eligible field together with its area, as input for farm-level aggregation.
 */
export type FieldScoreWithArea = {
  /** Field identifier */
  b_id: string
  /** Field area in hectares. Fields without a positive area carry no weight. */
  b_area: number | null
  /** BLN3 score of the field */
  score: Bln3Score
}

/**
 * Area-weighted farm-level scores on the normalized BLN3 scale (0..1).
 */
export type FarmScores = {
  indicators: { indicator_id: string; score: number }[]
  aggregations: { aggregation_id: string; score: number }[]
}

/** Traffic-light tier of a score. */
export type ScoreTier = "green" | "yellow" | "red"

/**
 * Converts a normalized score (0..1) to the 0..100 display scale.
 *
 * @param score01 - Score between 0 and 1.
 * @returns The rounded score between 0 and 100, or 0 for missing or non-finite input.
 */
export function scoreToDisplay(score01: number | null | undefined): number {
  if (typeof score01 !== "number" || !Number.isFinite(score01)) return 0
  return new Decimal(score01).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

/**
 * Classifies a display score (0..100) into a traffic-light tier.
 *
 * @param score100 - Score on the 0..100 display scale.
 * @returns `"green"` from 70, `"yellow"` from 40, otherwise `"red"`.
 */
export function getScoreTier(score100: number): ScoreTier {
  if (score100 >= 70) return "green"
  if (score100 >= 40) return "yellow"
  return "red"
}

function weightedMean(entries: { value: number; area: number }[]): number | null {
  let weighted = new Decimal(0)
  let totalArea = new Decimal(0)
  for (const { value, area } of entries) {
    weighted = weighted.plus(new Decimal(value).times(area))
    totalArea = totalArea.plus(area)
  }
  return totalArea.gt(0) ? weighted.div(totalArea).toNumber() : null
}

/**
 * Extracts one aggregation score (0..1) from a BLN3 score.
 *
 * @param score - BLN3 score of a field.
 * @param aggId - Aggregation identifier, e.g. `S_BLN`.
 * @returns The score, or `null` when the aggregation is absent or not a number.
 */
export function getFieldAggregationScore(
  score: Bln3Score | null | undefined,
  aggId: string,
): number | null {
  if (!score?.aggregations) return null
  const found = score.aggregations.find((a) => a.aggregation_id === aggId)
  return found && typeof found.score === "number" && !Number.isNaN(found.score) ? found.score : null
}

/**
 * Area-weighted average of one aggregation across fields.
 *
 * Fields without a score for the aggregation or without a positive area are skipped.
 *
 * @param fieldScores - Field scores keyed by field ID.
 * @param fields - Field areas in hectares.
 * @param aggId - Aggregation identifier.
 * @returns The average on the 0..1 scale, or `null` when no field contributes.
 */
export function computeAreaWeightedAggregation(
  fieldScores: { b_id: string; score: Bln3Score | null }[],
  fields: { b_id: string; b_area: number | null }[],
  aggId: string,
): number | null {
  const areaByBid = new Map<string, number>()
  for (const f of fields) {
    if (f.b_area !== null && f.b_area > 0) areaByBid.set(f.b_id, f.b_area)
  }
  const entries: { value: number; area: number }[] = []
  for (const fs of fieldScores) {
    const value = getFieldAggregationScore(fs.score, aggId)
    const area = areaByBid.get(fs.b_id)
    if (value === null || area === undefined) continue
    entries.push({ value, area })
  }
  return weightedMean(entries)
}

/**
 * Aggregates field scores to farm-level scores, weighted by field area.
 *
 * Each indicator and aggregation is averaged over only those fields that have a finite
 * score for it and a positive area. A metric without any contributing field is omitted:
 * no score is invented when the denominator is zero.
 *
 * Callers must pass only eligible fields (not buffer strips or nature fields).
 *
 * @param fields - Eligible fields with their BLN3 scores and areas.
 * @returns Area-weighted indicator and aggregation scores, sorted by identifier.
 */
export function aggregateFarmScores(fields: FieldScoreWithArea[]): FarmScores {
  const indicators = new Map<string, { value: number; area: number }[]>()
  const aggregations = new Map<string, { value: number; area: number }[]>()

  for (const field of fields) {
    const area = field.b_area
    if (area === null || !Number.isFinite(area) || area <= 0) continue
    for (const indicator of field.score.indicators) {
      if (!Number.isFinite(indicator.score)) continue
      const list = indicators.get(indicator.indicator_id) ?? []
      list.push({ value: indicator.score, area })
      indicators.set(indicator.indicator_id, list)
    }
    for (const aggregation of field.score.aggregations ?? []) {
      if (!Number.isFinite(aggregation.score)) continue
      const list = aggregations.get(aggregation.aggregation_id) ?? []
      list.push({ value: aggregation.score, area })
      aggregations.set(aggregation.aggregation_id, list)
    }
  }

  const reduce = (source: Map<string, { value: number; area: number }[]>) =>
    [...source.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([id, entries]) => {
        const score = weightedMean(entries)
        return score === null ? [] : [{ id, score }]
      })

  return {
    indicators: reduce(indicators).map(({ id, score }) => ({ indicator_id: id, score })),
    aggregations: reduce(aggregations).map(({ id, score }) => ({ aggregation_id: id, score })),
  }
}
