import Decimal from "decimal.js"
import type {
  Bln3MeasureAdviceResult,
  Bln3MeasureApplicabilityResult,
  Bln3MeasureApplicabilityStatus,
  Bln3Score,
} from "./types"
import { Bln3UnavailableError } from "./errors"
import { getScoreTier, scoreToDisplay } from "./scoring"

/** Maximum number of options that receive a recommendation. */
export const MAX_RECOMMENDED_MEASURES = 5

/**
 * Impact of a measure on one indicator, on the normalized BLN3 scale (higher is better).
 */
export type Bln3IndicatorImpact = {
  indicator_id: string
  measure_impact: number
}

/**
 * Catalogue entry of a measure, as needed to build selectable options.
 */
export type MeasureCatalogueEntry = {
  m_id: string
  m_source: string
  m_name: string
  m_description: string | null
  m_summary: string | null
  m_source_url: string | null
  m_conflicts: string[] | null
  m_stage_applicability?: "field" | "farm" | null
}

/**
 * A measure already adopted on the field in the selected year.
 */
export type ActiveMeasure = {
  b_id_measure: string
  m_id: string
  m_conflicts: string[] | null
}

/**
 * Applicability of a measure for a field. `unknown` means no applicability result was
 * returned; it must never be treated as applicable.
 */
export type MeasureOptionApplicability = {
  status: Bln3MeasureApplicabilityStatus | "unknown"
  message: string
}

/**
 * Ranking of a recommended measure.
 */
export type MeasureRecommendation = {
  /** Position, starting at 1 for the highest summed impact */
  rank: number
  /** Sum of the positive impacts over the weak (non-green) indicators */
  aggregate_impact: number
  /** Positive impacts on the weak indicators used for ranking */
  indicator_impacts: Bln3IndicatorImpact[]
}

/**
 * A field-level catalogue measure with applicability, status and predicted impact.
 */
export type MeasureOption = Omit<MeasureCatalogueEntry, "m_stage_applicability" | "m_source"> & {
  m_source: string
  m_stage_applicability: "field" | "farm" | null
  applicability: MeasureOptionApplicability
  /** Instance IDs of adopted measures with the same catalogue ID in the selected year */
  active_measures: string[]
  /** Catalogue IDs of active measures that conflict with this option */
  conflicts_with_active: string[]
  /** Hint whether the option can be adopted; core validation on create stays authoritative */
  selectable: boolean
  /** Positive predicted impacts over all indicators reported by the advice */
  predicted_impacts: Bln3IndicatorImpact[]
  /** Set for at most the top {@link MAX_RECOMMENDED_MEASURES} recommended options, otherwise `null` */
  recommendation: MeasureRecommendation | null
}

/**
 * Applicability of a measure as returned by the BLN3 applicability check.
 */
export type MeasureApplicabilityInfo = {
  applicability: Bln3MeasureApplicabilityStatus
  message: string
}

/**
 * A measure recommended for a field, aggregated across the field's weak (non-green)
 * indicators. `aggregateImpact` sums `measure_impact` over those indicators; this is valid
 * because the impact uses one unit across indicators.
 */
export type FieldTopOpportunity = {
  m_id: string
  /** Weak indicators this measure would help, with their impact */
  indicatorImpacts: Bln3IndicatorImpact[]
  /** Sum of `measure_impact` over the weak indicators */
  aggregateImpact: number
}

/**
 * Derives a ranked list of recommended measures for a field from raw measure advice,
 * cross-referenced with the current score and a fresh applicability check.
 *
 * Only non-green indicators are used. Measures that are not `applicable` according to
 * `applicability` (an absent entry counts as not applicable) or that are already active are
 * dropped. Remaining entries are grouped per measure and sorted by descending
 * `aggregateImpact`. This is a pure function; it performs no NMI request.
 *
 * @param params - Inputs.
 * @param params.advice - Measure advice for the field.
 * @param params.score - Current BLN3 score of the field.
 * @param params.applicability - Applicability per measure ID.
 * @param params.activeMeasureIds - Catalogue IDs of measures already adopted.
 * @returns Opportunities sorted by descending aggregate impact.
 */
export function getTopOpportunitiesForField({
  advice,
  score,
  applicability,
  activeMeasureIds,
}: {
  advice: Bln3MeasureAdviceResult
  score: Bln3Score | null
  applicability: Record<string, MeasureApplicabilityInfo>
  activeMeasureIds: Set<string>
}): FieldTopOpportunity[] {
  const weakIndicatorIds = new Set(
    (score?.indicators ?? [])
      .filter((ind) => getScoreTier(scoreToDisplay(ind.score)) !== "green")
      .map((ind) => ind.indicator_id),
  )

  const byMeasure = new Map<string, FieldTopOpportunity>()
  for (const indicatorAdvice of advice.indicator_advice) {
    if (!weakIndicatorIds.has(indicatorAdvice.indicator)) continue
    for (const candidate of indicatorAdvice.measures) {
      if (activeMeasureIds.has(candidate.m_id)) continue
      if (applicability[candidate.m_id]?.applicability !== "applicable") continue
      const impact = {
        indicator_id: indicatorAdvice.indicator,
        measure_impact: candidate.measure_impact,
      }
      const existing = byMeasure.get(candidate.m_id)
      if (existing) {
        existing.aggregateImpact = new Decimal(existing.aggregateImpact)
          .plus(candidate.measure_impact)
          .toNumber()
        existing.indicatorImpacts.push(impact)
      } else {
        byMeasure.set(candidate.m_id, {
          m_id: candidate.m_id,
          aggregateImpact: candidate.measure_impact,
          indicatorImpacts: [impact],
        })
      }
    }
  }
  return [...byMeasure.values()].sort((a, b) => b.aggregateImpact - a.aggregateImpact)
}

/**
 * Validates measure advice returned by the (experimental) NMI endpoint.
 *
 * @param advice - Advice to validate.
 * @throws {Bln3UnavailableError} When the structure or any impact value is malformed.
 */
export function assertValidMeasureAdvice(advice: Bln3MeasureAdviceResult): void {
  const valid =
    advice !== null &&
    typeof advice === "object" &&
    Array.isArray(advice.indicator_advice) &&
    advice.indicator_advice.every(
      (entry) =>
        entry !== null &&
        typeof entry.indicator === "string" &&
        Array.isArray(entry.measures) &&
        entry.measures.every(
          (m) =>
            m !== null &&
            typeof m.m_id === "string" &&
            typeof m.measure_impact === "number" &&
            Number.isFinite(m.measure_impact),
        ),
    )
  if (!valid) {
    throw new Bln3UnavailableError("BLN3 measure advice is unavailable")
  }
}

/**
 * Collects the positive predicted impacts per measure over all indicators.
 *
 * Unreported impacts are left out, never interpreted as zero.
 *
 * @param advice - Validated measure advice.
 * @returns Map of measure ID to impacts, sorted by descending impact.
 */
export function buildPredictedImpacts(
  advice: Bln3MeasureAdviceResult,
): Map<string, Bln3IndicatorImpact[]> {
  const result = new Map<string, Bln3IndicatorImpact[]>()
  for (const entry of advice.indicator_advice) {
    for (const m of entry.measures) {
      if (!(m.measure_impact > 0)) continue
      const list = result.get(m.m_id) ?? []
      list.push({ indicator_id: entry.indicator, measure_impact: m.measure_impact })
      result.set(m.m_id, list)
    }
  }
  for (const list of result.values()) {
    list.sort(
      (a, b) => b.measure_impact - a.measure_impact || a.indicator_id.localeCompare(b.indicator_id),
    )
  }
  return result
}

/**
 * Builds the field-level measure options: catalogue metadata, applicability, active and
 * conflicting status, predicted impacts and the recommendation ranking.
 *
 * Farm-only catalogue entries and sources that are not enabled are excluded; all other
 * field-level entries remain visible with their reasons. Recommendations are derived only
 * from applicable, not-yet-adopted, non-conflicting options and only from impacts on
 * non-green indicators.
 *
 * @param params - Inputs for the options.
 * @param params.catalogue - Full measure catalogue.
 * @param params.enabledSources - Catalogue sources enabled for the farm.
 * @param params.activeMeasures - Measures adopted on the field in the selected year.
 * @param params.applicability - Fresh applicability result for the field and year.
 * @param params.advice - Measure advice for the field and year.
 * @param params.score - Current BLN3 score of the field.
 * @returns Options ordered by recommendation rank, then by source and name.
 * @throws {Bln3UnavailableError} When the advice is malformed.
 */
export function buildMeasureOptions(params: {
  catalogue: MeasureCatalogueEntry[]
  enabledSources: string[]
  activeMeasures: ActiveMeasure[]
  applicability: Bln3MeasureApplicabilityResult
  advice: Bln3MeasureAdviceResult
  score: Bln3Score
}): MeasureOption[] {
  assertValidMeasureAdvice(params.advice)

  const enabled = new Set(params.enabledSources)
  const applicabilityById = new Map(
    params.applicability.applicability.map((item) => [item.m_id, item]),
  )
  const impacts = buildPredictedImpacts(params.advice)
  const options: MeasureOption[] = params.catalogue
    .filter((c) => c.m_stage_applicability !== "farm" && enabled.has(c.m_source))
    .map((c) => {
      const found = applicabilityById.get(c.m_id)
      const applicability: MeasureOptionApplicability = found
        ? { status: found.applicability, message: found.message ?? "" }
        : { status: "unknown", message: "" }

      const active_measures = params.activeMeasures
        .filter((a) => a.m_id === c.m_id)
        .map((a) => a.b_id_measure)
      const conflicts_with_active = [
        ...new Set(
          params.activeMeasures
            .filter(
              (a) =>
                (c.m_conflicts ?? []).includes(a.m_id) || (a.m_conflicts ?? []).includes(c.m_id),
            )
            .map((a) => a.m_id),
        ),
      ].sort()

      return {
        m_id: c.m_id,
        m_source: c.m_source,
        m_name: c.m_name,
        m_description: c.m_description,
        m_summary: c.m_summary,
        m_source_url: c.m_source_url,
        m_conflicts: c.m_conflicts,
        m_stage_applicability: c.m_stage_applicability ?? null,
        applicability,
        active_measures,
        conflicts_with_active,
        selectable:
          applicability.status === "applicable" &&
          active_measures.length === 0 &&
          conflicts_with_active.length === 0,
        predicted_impacts: impacts.get(c.m_id) ?? [],
        recommendation: null,
      }
    })

  // Ranking uses the same rules as the web application (weak indicators, applicable and
  // not yet adopted); conflicting options are removed via `selectable`.
  const applicabilityInfo: Record<string, MeasureApplicabilityInfo> = {}
  for (const item of params.applicability.applicability) {
    applicabilityInfo[item.m_id] = { applicability: item.applicability, message: item.message }
  }
  const optionById = new Map(options.map((o) => [o.m_id, o]))
  const candidates = getTopOpportunitiesForField({
    advice: params.advice,
    score: params.score,
    applicability: applicabilityInfo,
    activeMeasureIds: new Set(params.activeMeasures.map((a) => a.m_id)),
  })
    .filter((c) => c.aggregateImpact > 0 && optionById.get(c.m_id)?.selectable)
    .sort((a, b) => b.aggregateImpact - a.aggregateImpact || a.m_id.localeCompare(b.m_id))
    .slice(0, MAX_RECOMMENDED_MEASURES)

  candidates.forEach((c, index) => {
    const option = optionById.get(c.m_id)
    if (!option) return
    option.recommendation = {
      rank: index + 1,
      aggregate_impact: c.aggregateImpact,
      indicator_impacts: [...c.indicatorImpacts].sort(
        (a, b) =>
          b.measure_impact - a.measure_impact || a.indicator_id.localeCompare(b.indicator_id),
      ),
    }
  })

  const rankOf = (o: MeasureOption) => o.recommendation?.rank ?? MAX_RECOMMENDED_MEASURES + 1
  return options.sort(
    (a, b) =>
      rankOf(a) - rankOf(b) ||
      a.m_source.localeCompare(b.m_source) ||
      a.m_name.localeCompare(b.m_name),
  )
}
