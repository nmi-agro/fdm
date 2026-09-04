/**
 * @file bln3.server.ts
 *
 * Server-side orchestration layer for the BLN3 Indicatoren feature.
 *
 * Acts as a thin bridge between route loaders and fdm-calculator, following
 * the same pattern as mineralization.server.ts and calculator.ts.
 */

import {
  type Bln3IndicatorAdvice,
  type Bln3IndicatorMeasureAdvice,
  type Bln3MeasureAdviceResult,
  type Bln3MeasureApplicabilityItem,
  type Bln3MeasureApplicabilityResult,
  type Bln3MeasureApplicabilityStatus,
  type Bln3Score,
  type Bln3ScoreCollectedInputs,
  collectInputForBln3MeasureApplicability,
  collectInputForBln3Score,
  getBln3MeasureAdvice,
  getBln3MeasureApplicability,
  getBln3Score,
} from "@nmi-agro/fdm-calculator"
import {
  type Field,
  getFields,
  getMeasures,
  type PrincipalId,
  type Timeframe,
} from "@nmi-agro/fdm-core"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { fdm } from "~/lib/fdm.server"
import {
  EXCLUDED_BLN3_BRP_CODES,
  type FieldMeasure,
  getBln3ExclusionMessage,
  getScoreTier,
  isExcludedFromBln3,
  scoreToDisplay,
} from "~/lib/indicators"

export { EXCLUDED_BLN3_BRP_CODES, isExcludedFromBln3, getBln3ExclusionMessage }

export type {
  Bln3IndicatorAdvice,
  Bln3IndicatorMeasureAdvice,
  Bln3MeasureAdviceResult,
  Bln3MeasureApplicabilityItem,
  Bln3MeasureApplicabilityResult,
  Bln3MeasureApplicabilityStatus,
  Bln3Score,
  Bln3ScoreCollectedInputs,
}

export type FieldBln3Score = {
  b_id: string
  score: Bln3Score | null
  error: string | null
  isExcluded?: boolean
  isBufferstrip?: boolean
  isNature?: boolean
}

export type FieldBln3Result = {
  score: Bln3Score | null
  inputs: Bln3ScoreCollectedInputs
  isExcluded?: boolean
}

export type MeasureApplicabilityInfo = {
  applicability: Bln3MeasureApplicabilityStatus
  message: string
}

/**
 * Collects all inputs for a single field and calculates its BLN3 score.
 *
 * Returns null if the NMI API key is not configured or if data collection fails.
 */
export async function getIndicatorsForField({
  principal_id,
  b_id,
  timeframe,
}: {
  principal_id: PrincipalId
  b_id: string
  timeframe?: Timeframe
}): Promise<FieldBln3Result> {
  const inputs = await collectInputForBln3Score(fdm, principal_id, b_id, timeframe)
  if (inputs.isExcluded) {
    return { score: null, inputs, isExcluded: true }
  }

  const nmiApiKey = getNmiApiKey()
  if (!nmiApiKey) {
    return { score: null, inputs, isExcluded: false }
  }

  try {
    const score = await getBln3Score(fdm, {
      ...inputs,
      nmiApiKey,
    })
    return { score, inputs, isExcluded: false }
  } catch (err) {
    console.error(`Failed to fetch BLN3 score for field ${b_id}:`, err)
    return { score: null, inputs, isExcluded: false }
  }
}

/**
 * Calculates BLN3 scores for all fields in a farm.
 *
 * Uses `Promise.allSettled` so individual field failures do not abort the
 * whole farm load. Fields that fail return `null` with an error message.
 */
export async function getIndicatorsForFarm({
  principal_id,
  b_id_farm,
  timeframe,
  preloadedFields,
}: {
  principal_id: PrincipalId
  b_id_farm: string
  timeframe?: Timeframe
  preloadedFields?: Field[]
}): Promise<FieldBln3Score[]> {
  const fields = preloadedFields ?? (await getFields(fdm, principal_id, b_id_farm, timeframe))

  const results = await Promise.allSettled(
    fields.map((field) =>
      getIndicatorsForField({
        principal_id,
        b_id: field.b_id,
        timeframe,
      }),
    ),
  )

  return results.map((result, index) => {
    const field = fields[index]
    const b_id = field.b_id
    if (result.status === "fulfilled") {
      const inputs = result.value.inputs
      const isBufferstrip = field.b_bufferstrip === true || inputs.b_bufferstrip === true
      const isNature =
        !isBufferstrip &&
        (inputs.b_lu_croprotation === "nature" ||
          (inputs.b_lu_catalogue != null &&
            EXCLUDED_BLN3_BRP_CODES.includes(inputs.b_lu_catalogue)) ||
          inputs.isExcluded === true)
      return {
        b_id,
        score: result.value.score,
        error: null,
        isExcluded: result.value.inputs.isExcluded ?? false,
        isBufferstrip,
        isNature,
      }
    }
    const errorMessage =
      result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.error(`BLN3 score failed for field ${b_id}:`, errorMessage)
    return {
      b_id,
      score: null,
      error: errorMessage,
      isExcluded: false,
      isBufferstrip: field.b_bufferstrip === true,
      isNature: false,
    }
  })
}

/**
 * Returns all measures applied to a single field, enriched with catalogue names.
 * Used by the field-level indicator detail page to display active measures
 * in the expandable indicator card panels.
 */
export async function getFieldMeasuresForIndicators({
  principal_id,
  b_id,
  timeframe,
}: {
  principal_id: PrincipalId
  b_id: string
  timeframe?: Timeframe
}): Promise<FieldMeasure[]> {
  const measures = await getMeasures(fdm, principal_id, b_id, timeframe)
  return measures.map((m) => ({
    b_id_measure: m.b_id_measure,
    m_id: m.m_id,
    m_name: m.m_name,
    m_summary: m.m_summary,
    m_conflicts: m.m_conflicts,
    m_start: m.m_start ? m.m_start.toISOString() : null,
    m_end: m.m_end ? m.m_end.toISOString() : null,
  }))
}

/**
 * Collects inputs and fetches BLN3 measure applicability for a single field.
 *
 * Returns a record mapping measure IDs (`bln_BM86`) to their applicability status and message.
 */
export async function getMeasureApplicabilityForField({
  principal_id,
  b_id,
  b_year,
  timeframe,
}: {
  principal_id: PrincipalId
  b_id: string
  b_year: number
  timeframe?: Timeframe
}): Promise<Record<string, MeasureApplicabilityInfo>> {
  const inputs = await collectInputForBln3MeasureApplicability(
    fdm,
    principal_id,
    b_id,
    b_year,
    timeframe,
  )
  if (inputs.isExcluded) {
    return {}
  }

  const nmiApiKey = getNmiApiKey()
  if (!nmiApiKey) {
    return {}
  }

  try {
    const result = await getBln3MeasureApplicability(fdm, {
      ...inputs,
      nmiApiKey,
    })

    const map: Record<string, MeasureApplicabilityInfo> = {}
    for (const item of result.applicability) {
      map[item.m_id] = {
        applicability: item.applicability,
        message: item.message,
      }
    }
    return map
  } catch (err) {
    console.error(`Failed to fetch BLN3 measure applicability for field ${b_id}:`, err)
    return {}
  }
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

/**
 * Fetches BLN3 measure applicability for multiple fields in parallel using bounded batches.
 *
 * Uses `Promise.allSettled` in batches of 5 so individual field failures return an empty record
 * for that field rather than failing the entire request or overwhelming external services.
 *
 * @returns A record mapping `b_id` to a record mapping `m_id` to `MeasureApplicabilityInfo`.
 */
export async function getMeasureApplicabilityForFields({
  principal_id,
  b_ids,
  b_year,
  timeframe,
}: {
  principal_id: PrincipalId
  b_ids: string[]
  b_year: number
  timeframe?: Timeframe
}): Promise<Record<string, Record<string, MeasureApplicabilityInfo> | null>> {
  const BATCH_SIZE = 5
  const results = await mapInBatches(b_ids, BATCH_SIZE, (b_id) =>
    getMeasureApplicabilityForField({
      principal_id,
      b_id,
      b_year,
      timeframe,
    }),
  )

  const fieldApplicabilityMap: Record<string, Record<string, MeasureApplicabilityInfo> | null> = {}

  results.forEach((result, index) => {
    const b_id = b_ids[index]
    if (result.status === "fulfilled") {
      fieldApplicabilityMap[b_id] = result.value
    } else {
      console.error(
        `BLN3 applicability check failed for field ${b_id}:`,
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      )
      fieldApplicabilityMap[b_id] = null
    }
  })

  return fieldApplicabilityMap
}

/**
 * Collects inputs and fetches BLN3 measure advice for a single field.
 *
 * This is a best-effort enhancement, never a blocker: if the NMI request
 * fails, `null` is returned and the failure is logged. `null` signals
 * "advice unavailable" — callers must treat it differently from a
 * successful-but-empty result and never render empty-state copy (e.g.
 * "no measures with noteworthy effect") for it, since that would present
 * a failed fetch as an agronomic fact. The usual response is to hide the
 * recommendations section entirely.
 *
 * Note: the NMI `measure/advice` endpoint is marked **experimental** — its
 * interface may change without the usual advance notice NMI gives for
 * stable endpoints.
 */
export async function getMeasureAdviceForField({
  principal_id,
  b_id,
  b_year,
  timeframe,
}: {
  principal_id: PrincipalId
  b_id: string
  b_year: number
  timeframe?: Timeframe
}): Promise<Bln3MeasureAdviceResult | null> {
  try {
    const inputs = await collectInputForBln3MeasureApplicability(
      fdm,
      principal_id,
      b_id,
      b_year,
      timeframe,
    )
    if (inputs.isExcluded) {
      return null
    }

    const nmiApiKey = getNmiApiKey()
    return await getBln3MeasureAdvice(fdm, {
      ...inputs,
      nmiApiKey,
    })
  } catch (err) {
    console.error(
      `BLN3 measure advice failed for field ${b_id}:`,
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

/**
 * Fetches BLN3 measure advice for multiple fields in parallel using bounded batches.
 *
 * Uses `Promise.allSettled` in batches of 5 (matching `getMeasureApplicabilityForFields`)
 * so a farm-level page never fires 50+ concurrent NMI requests. An individual
 * field's failure maps to `null` (advice unavailable) rather than failing
 * the whole request — callers must not treat `null` as "no recommendations".
 *
 * @returns A record mapping `b_id` to a `Bln3MeasureAdviceResult`, or `null` for failed fields.
 */
export async function getMeasureAdviceForFields({
  principal_id,
  b_ids,
  b_year,
  timeframe,
}: {
  principal_id: PrincipalId
  b_ids: string[]
  b_year: number
  timeframe?: Timeframe
}): Promise<Record<string, Bln3MeasureAdviceResult | null>> {
  const BATCH_SIZE = 5
  const results = await mapInBatches(b_ids, BATCH_SIZE, (b_id) =>
    getMeasureAdviceForField({
      principal_id,
      b_id,
      b_year,
      timeframe,
    }),
  )

  const fieldAdviceMap: Record<string, Bln3MeasureAdviceResult | null> = {}

  results.forEach((result, index) => {
    const b_id = b_ids[index]
    if (result.status === "fulfilled") {
      fieldAdviceMap[b_id] = result.value
    } else {
      console.error(
        `BLN3 measure advice failed for field ${b_id}:`,
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      )
      fieldAdviceMap[b_id] = null
    }
  })

  return fieldAdviceMap
}

/**
 * A measure recommended for a specific field/indicator combination, already
 * cross-referenced against a fresh applicability check and the field's
 * active measures. Used to build farm-level "where to start" panels
 * (`indicators._index`'s "Waar te beginnen", `measures._index`'s
 * "Aanbevolen volgende stappen").
 */
export type FarmMeasureRecommendation = {
  b_id: string
  indicator_id: string
  m_id: string
  m_name: string
  measure_impact: number
}

/**
 * Farm-wide measure recommendations plus an availability flag. When every
 * field's advice fetch failed, `adviceAvailable` is false and consumers
 * should hide the recommendations UI entirely rather than render an
 * empty state that would present a fetch failure as "no recommendations".
 */
export type FarmMeasureRecommendationsResult = {
  recommendations: FarmMeasureRecommendation[]
  adviceAvailable: boolean
}

/**
 * A measure recommended for a field, aggregated across the field's currently
 * weak (non-green) indicators. `aggregateImpact` sums `measure_impact` across
 * those indicators — valid because `measure_impact` uses a consistent unit
 * across indicators (confirmed with NMI), so no normalization is required.
 */
export type FieldTopOpportunity = {
  m_id: string
  /** Indicators this measure would help on this field, with their impact */
  indicatorImpacts: { indicator_id: string; measure_impact: number }[]
  /** Sum of measure_impact across the field's currently weak (non-green) indicators */
  aggregateImpact: number
}

export type FarmMeasureOpportunity = FieldTopOpportunity & {
  b_id: string
  m_name: string
}

/**
 * Derives a ranked list of recommended measures for a field from raw BLN3
 * measure advice, cross-referenced against the field's current score and a
 * fresh applicability check.
 *
 * Steps:
 * 1. Keep only indicators that are not green (`getScoreTier` !== "green").
 * 2. Drop any `m_id` that is not `"applicable"` per `applicability` — the
 *    advice endpoint's own list must never be trusted as pre-filtered for
 *    applicability — and drop measures already in `activeMeasureIds`.
 * 3. Group remaining entries by `m_id`, summing `measure_impact` across the
 *    field's weak indicators.
 * 4. Sort descending by `aggregateImpact`.
 *
 * This is a pure function (no NMI call) so it can be reused both for a
 * single field's "best next measure" view and, area-weighted across fields,
 * for farm-level aggregations.
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

      const existing = byMeasure.get(candidate.m_id)
      if (existing) {
        existing.aggregateImpact += candidate.measure_impact
        existing.indicatorImpacts.push({
          indicator_id: indicatorAdvice.indicator,
          measure_impact: candidate.measure_impact,
        })
      } else {
        byMeasure.set(candidate.m_id, {
          m_id: candidate.m_id,
          aggregateImpact: candidate.measure_impact,
          indicatorImpacts: [
            {
              indicator_id: indicatorAdvice.indicator,
              measure_impact: candidate.measure_impact,
            },
          ],
        })
      }
    }
  }

  return [...byMeasure.values()].sort((a, b) => b.aggregateImpact - a.aggregateImpact)
}

/**
 * Fetches and filters farm-wide measure opportunities using the same
 * applicability, advice, score, and active-measure rules as field views.
 *
 * Advice failures are represented by missing entries and skipped. A rejection
 * of either batch fetch is intentionally propagated so route loaders can
 * report it and hide the lazy recommendation surface.
 */
export async function getFarmMeasureOpportunities({
  principal_id,
  b_ids,
  b_year,
  timeframe,
  scoreByBid,
  activeMeasureIdsByField,
  measureNameById,
}: {
  principal_id: PrincipalId
  b_ids: string[]
  b_year: number
  timeframe?: Timeframe
  scoreByBid: Map<string, Bln3Score | null>
  activeMeasureIdsByField: Map<string, Set<string>>
  measureNameById: Map<string, string>
}): Promise<{ opportunities: FarmMeasureOpportunity[]; adviceAvailable: boolean }> {
  const [applicabilityByField, adviceByField] = await Promise.all([
    getMeasureApplicabilityForFields({ principal_id, b_ids, b_year, timeframe }),
    getMeasureAdviceForFields({ principal_id, b_ids, b_year, timeframe }),
  ])

  const opportunities: FarmMeasureOpportunity[] = []
  let adviceAvailable = false

  for (const b_id of b_ids) {
    const advice = adviceByField[b_id]
    if (!advice) continue

    const applicability = applicabilityByField[b_id]
    if (applicability === null || applicability === undefined) continue

    adviceAvailable = true
    for (const opportunity of getTopOpportunitiesForField({
      advice,
      score: scoreByBid.get(b_id) ?? null,
      applicability,
      activeMeasureIds: activeMeasureIdsByField.get(b_id) ?? new Set(),
    })) {
      opportunities.push({
        b_id,
        ...opportunity,
        m_name: measureNameById.get(opportunity.m_id) ?? opportunity.m_id.replace("bln_", ""),
      })
    }
  }

  return { opportunities, adviceAvailable }
}
