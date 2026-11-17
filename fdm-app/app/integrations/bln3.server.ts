/**
 * @file bln3.server.ts
 *
 * Server-side orchestration layer for the BLN3 Indicatoren feature.
 *
 * Acts as a thin bridge between route loaders and fdm-calculator, following
 * the same pattern as mineralization.server.ts and calculator.ts.
 */

import {
  type Bln3ExclusionReason,
  type Bln3IndicatorAdvice,
  type Bln3IndicatorMeasureAdvice,
  type Bln3MeasureAdviceResult,
  type Bln3MeasureApplicabilityCollectedInputs,
  type Bln3MeasureApplicabilityInputs,
  type Bln3MeasureApplicabilityItem,
  type Bln3MeasureApplicabilityResult,
  type Bln3MeasureApplicabilityStatus,
  type Bln3Score,
  type Bln3ScoreCollectedInputs,
  collectInputForBln3MeasureApplicability,
  collectInputForBln3MeasureApplicabilityForFarm,
  collectInputForBln3Score,
  collectInputForBln3ScoreForFarm,
  getBln3MeasureAdvice,
  getBln3MeasureApplicability,
  getBln3Score,
  getBln3Scores,
} from "@nmi-agro/fdm-calculator"
import {
  type FieldTopOpportunity,
  getBestVariantIds,
  getFieldOpportunityCandidates,
  getTopOpportunitiesForField,
  type MeasureApplicabilityInfo,
} from "@nmi-agro/fdm-calculator"
import {
  type CachedCalculation,
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
  isExcludedFromBln3,
} from "~/lib/indicators"

export {
  EXCLUDED_BLN3_BRP_CODES,
  isExcludedFromBln3,
  getBln3ExclusionMessage,
  getTopOpportunitiesForField,
}
export type { FieldTopOpportunity, MeasureApplicabilityInfo }

export type {
  Bln3ExclusionReason,
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
  /** Why the field is excluded in the selected year; `null` when it is not excluded */
  exclusionReason?: Bln3ExclusionReason | null
}

export type FieldBln3Result = {
  score: Bln3Score | null
  inputs: Bln3ScoreCollectedInputs
  isExcluded?: boolean
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
 * Looks up the cached BLN3 scores of the given fields at once and requests the missing ones.
 *
 * @returns The score per field ID. Fields are missing when the NMI API key is not configured
 *   or their request failed (the failure is logged).
 */
async function getScoresForFields(
  fields: { b_id: string; inputs: Bln3ScoreCollectedInputs }[],
): Promise<Map<string, Bln3Score | null>> {
  const scores = new Map<string, Bln3Score | null>()
  const nmiApiKey = getNmiApiKey()
  if (!nmiApiKey || fields.length === 0) return scores

  const results = await getBln3Scores(
    fdm,
    fields.map(({ inputs }) => ({ ...inputs, nmiApiKey })),
  )
  for (const [index, result] of results.entries()) {
    const { b_id } = fields[index]
    if (result.status === "fulfilled") {
      scores.set(b_id, result.value)
    } else {
      console.error(`Failed to fetch BLN3 score for field ${b_id}:`, result.reason)
    }
  }
  return scores
}

/**
 * Calculates BLN3 scores for all fields in a farm.
 *
 * The inputs are collected with farm-level queries and the cached scores of all fields are
 * looked up at once; only fields without a cached score are requested from the NMI API.
 * Individual field failures do not abort the whole farm load: a field whose inputs cannot be
 * collected returns `null` with an error message, and a field whose score request fails
 * returns `null` without one, as {@link getIndicatorsForField} does.
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
  // The collector reuses the fields, so they are read only once
  const farmInputs = await collectInputForBln3ScoreForFarm(
    fdm,
    principal_id,
    b_id_farm,
    timeframe,
    fields,
  ).catch((error: unknown) => ({ error }))

  const inputResults = fields.map((field): PromiseSettledResult<Bln3ScoreCollectedInputs> => {
    if (!(farmInputs instanceof Map)) return { status: "rejected", reason: farmInputs.error }
    const inputs = farmInputs.get(field.b_id)
    return inputs
      ? { status: "fulfilled", value: inputs }
      : { status: "rejected", reason: new Error(`No BLN3 inputs for field ${field.b_id}`) }
  })

  const scoreByField = await getScoresForFields(
    fields.flatMap((field, index) => {
      const result = inputResults[index]
      return result.status === "fulfilled" && !result.value.isExcluded
        ? [{ b_id: field.b_id, inputs: result.value }]
        : []
    }),
  )

  const results = inputResults.map((result, index): PromiseSettledResult<FieldBln3Result> =>
    result.status === "fulfilled"
      ? {
          status: "fulfilled",
          value: {
            score: scoreByField.get(fields[index].b_id) ?? null,
            inputs: result.value,
            isExcluded: result.value.isExcluded ?? false,
          },
        }
      : result,
  )

  return results.map((result, index) => {
    const field = fields[index]
    const b_id = field.b_id
    if (result.status === "fulfilled") {
      const inputs = result.value.inputs
      const isBufferstrip = field.b_bufferstrip === true || inputs.b_bufferstrip === true
      const exclusionReason = isBufferstrip ? "bufferstrip" : (inputs.exclusionReason ?? null)
      const isNature =
        !isBufferstrip &&
        exclusionReason !== "no_main_cultivation" &&
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
        exclusionReason,
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
      exclusionReason: null,
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

/** Maximum number of NMI API requests at the same time for the measures of a farm. */
const FARM_MEASURE_REQUEST_CONCURRENCY = 5

/** The arguments to collect the measure inputs of several fields of a farm. */
type FarmFieldsArgs = {
  principal_id: PrincipalId
  b_id_farm: string
  b_ids: string[]
  b_year: number
  timeframe?: Timeframe
}

/** The measure applicability inputs of a field, or why they could not be collected. */
type ApplicabilityInputsResult =
  | { inputs: Bln3MeasureApplicabilityCollectedInputs }
  | { error: unknown }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Collects the measure applicability inputs of the given fields with farm-level queries. These
 * inputs serve both the applicability and the advice of the measures.
 *
 * A field missing from the farm inputs (for example one outside the timeframe) is collected on
 * its own. When the farm inputs cannot be collected, every field gets the error.
 */
async function collectApplicabilityInputsForFields({
  principal_id,
  b_id_farm,
  b_ids,
  b_year,
  timeframe,
}: FarmFieldsArgs): Promise<Map<string, ApplicabilityInputsResult>> {
  const farmInputs = await collectInputForBln3MeasureApplicabilityForFarm(
    fdm,
    principal_id,
    b_id_farm,
    b_year,
    timeframe,
  ).catch((error: unknown) => ({ error }))

  const results = await Promise.allSettled(
    b_ids.map(async (b_id) => {
      if (!(farmInputs instanceof Map)) throw farmInputs.error
      return (
        farmInputs.get(b_id) ??
        (await collectInputForBln3MeasureApplicability(fdm, principal_id, b_id, b_year, timeframe))
      )
    }),
  )
  return new Map(
    b_ids.map((b_id, index) => {
      const result = results[index]
      return [
        b_id,
        result.status === "fulfilled" ? { inputs: result.value } : { error: result.reason },
      ]
    }),
  )
}

/**
 * Requests a cached BLN3 measure function (applicability or advice) for the fields that are not
 * excluded, with one cache lookup for all fields.
 *
 * @returns Per field ID: the result, `undefined` when the field is excluded or no NMI API key
 *   is configured, or the error of the collection or the request.
 */
async function requestForFields<T>(
  inputsByField: Map<string, ApplicabilityInputsResult>,
  request: Pick<CachedCalculation<Bln3MeasureApplicabilityInputs, T>, "many">,
): Promise<Map<string, { value: T | undefined } | { error: unknown }>> {
  const results = new Map<string, { value: T | undefined } | { error: unknown }>()
  const nmiApiKey = getNmiApiKey()
  const requested: string[] = []
  const inputs: Bln3MeasureApplicabilityInputs[] = []
  for (const [b_id, result] of inputsByField) {
    if ("error" in result) {
      results.set(b_id, result)
    } else if (result.inputs.isExcluded || !nmiApiKey) {
      results.set(b_id, { value: undefined })
    } else {
      requested.push(b_id)
      inputs.push({ ...result.inputs, nmiApiKey })
    }
  }

  const settled = await Promise.allSettled(
    request.many(fdm, inputs, { concurrency: FARM_MEASURE_REQUEST_CONCURRENCY }),
  )
  for (const [index, b_id] of requested.entries()) {
    const result = settled[index]
    results.set(
      b_id,
      result.status === "fulfilled" ? { value: result.value } : { error: result.reason },
    )
  }
  return results
}

/** Turns an applicability result into a record of the applicability per measure ID. */
function toApplicabilityRecord(
  result: Bln3MeasureApplicabilityResult,
): Record<string, MeasureApplicabilityInfo> {
  const map: Record<string, MeasureApplicabilityInfo> = {}
  for (const item of result.applicability) {
    map[item.m_id] = { applicability: item.applicability, message: item.message }
  }
  return map
}

/** Requests the measure applicability of the fields whose inputs were collected. */
async function getApplicabilityFromInputs(
  inputsByField: Map<string, ApplicabilityInputsResult>,
): Promise<Record<string, Record<string, MeasureApplicabilityInfo> | null>> {
  const results = await requestForFields(inputsByField, getBln3MeasureApplicability)
  const fieldApplicabilityMap: Record<string, Record<string, MeasureApplicabilityInfo> | null> = {}
  for (const [b_id, result] of results) {
    const collectionFailed = "error" in (inputsByField.get(b_id) ?? {})
    if (collectionFailed && "error" in result) {
      // As for a single field, a field whose inputs cannot be collected has no result
      console.error(
        `BLN3 applicability check failed for field ${b_id}:`,
        errorMessage(result.error),
      )
      fieldApplicabilityMap[b_id] = null
    } else if ("error" in result) {
      console.error(`Failed to fetch BLN3 measure applicability for field ${b_id}:`, result.error)
      fieldApplicabilityMap[b_id] = {}
    } else {
      fieldApplicabilityMap[b_id] = result.value ? toApplicabilityRecord(result.value) : {}
    }
  }
  return fieldApplicabilityMap
}

/** Requests the measure advice of the fields whose inputs were collected. */
async function getAdviceFromInputs(
  inputsByField: Map<string, ApplicabilityInputsResult>,
): Promise<Record<string, Bln3MeasureAdviceResult | null>> {
  const results = await requestForFields(inputsByField, getBln3MeasureAdvice)
  const fieldAdviceMap: Record<string, Bln3MeasureAdviceResult | null> = {}
  for (const [b_id, result] of results) {
    if ("error" in result) {
      console.error(`BLN3 measure advice failed for field ${b_id}:`, errorMessage(result.error))
      fieldAdviceMap[b_id] = null
    } else {
      fieldAdviceMap[b_id] = result.value ?? null
    }
  }
  return fieldAdviceMap
}

/**
 * Fetches BLN3 measure applicability for multiple fields of a farm.
 *
 * The inputs are collected with farm-level queries and the cached results of all fields are
 * looked up at once; at most 5 missing results are requested from the NMI API at the same
 * time. A field whose request fails returns an empty record, and a field whose inputs cannot
 * be collected returns `null`, rather than failing the entire request.
 *
 * @returns A record mapping `b_id` to a record mapping `m_id` to `MeasureApplicabilityInfo`.
 */
export async function getMeasureApplicabilityForFields(
  args: FarmFieldsArgs,
): Promise<Record<string, Record<string, MeasureApplicabilityInfo> | null>> {
  return getApplicabilityFromInputs(await collectApplicabilityInputsForFields(args))
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
    if (!nmiApiKey) {
      return null
    }

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
 * Fetches BLN3 measure advice for multiple fields of a farm.
 *
 * The inputs are collected with farm-level queries and the cached advice of all fields is
 * looked up at once; at most 5 missing results are requested from the NMI API at the same
 * time, so a farm-level page never fires 50+ concurrent NMI requests. An individual field's
 * failure maps to `null` (advice unavailable) rather than failing the whole request — callers
 * must not treat `null` as "no recommendations".
 *
 * @returns A record mapping `b_id` to a `Bln3MeasureAdviceResult`, or `null` for failed fields.
 */
export async function getMeasureAdviceForFields(
  args: FarmFieldsArgs,
): Promise<Record<string, Bln3MeasureAdviceResult | null>> {
  return getAdviceFromInputs(await collectApplicabilityInputsForFields(args))
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
  /** Each field's best variant per measure family */
  recommendations: FarmMeasureRecommendation[]
  /**
   * Every eligible variant per field, used to choose one variant per family
   * over the whole farm. Not shown as recommendations themselves.
   */
  candidates: FarmMeasureRecommendation[]
  adviceAvailable: boolean
}

export type FarmMeasureOpportunity = FieldTopOpportunity & {
  b_id: string
  m_name: string
}

/**
 * Fetches and filters farm-wide measure opportunities using the same
 * applicability, advice, score, and active-measure rules as field views.
 *
 * `opportunities` holds one variant per measure family per field (the field's
 * best variant). `candidates` holds every eligible variant per field, so
 * callers can choose one variant per family over several fields.
 *
 * Advice failures are represented by missing entries and skipped. A rejection
 * of either batch fetch is intentionally propagated so route loaders can
 * report it and hide the lazy recommendation surface.
 */
export async function getFarmMeasureOpportunities({
  principal_id,
  b_id_farm,
  b_ids,
  b_year,
  timeframe,
  scoreByBid,
  activeMeasureIdsByField,
  measureNameById,
}: FarmFieldsArgs & {
  scoreByBid: Map<string, Bln3Score | null>
  activeMeasureIdsByField: Map<string, Set<string>>
  measureNameById: Map<string, string>
}): Promise<{
  opportunities: FarmMeasureOpportunity[]
  candidates: FarmMeasureOpportunity[]
  adviceAvailable: boolean
}> {
  // Applicability and advice use the same inputs, so collect them once
  const inputsByField = await collectApplicabilityInputsForFields({
    principal_id,
    b_id_farm,
    b_ids,
    b_year,
    timeframe,
  })
  const [applicabilityByField, adviceByField] = await Promise.all([
    getApplicabilityFromInputs(inputsByField),
    getAdviceFromInputs(inputsByField),
  ])

  const opportunities: FarmMeasureOpportunity[] = []
  const candidates: FarmMeasureOpportunity[] = []
  let adviceAvailable = false

  for (const b_id of b_ids) {
    const advice = adviceByField[b_id]
    if (!advice) continue

    const applicability = applicabilityByField[b_id]
    if (applicability === null || applicability === undefined) continue

    adviceAvailable = true
    const fieldCandidates = getFieldOpportunityCandidates({
      advice,
      score: scoreByBid.get(b_id) ?? null,
      applicability,
      activeMeasureIds: activeMeasureIdsByField.get(b_id) ?? new Set(),
    })
    // Same per-field selection as `getTopOpportunitiesForField`.
    const bestVariantIds = getBestVariantIds(
      new Map(fieldCandidates.map((c) => [c.m_id, c.aggregateImpact])),
    )
    for (const candidate of fieldCandidates) {
      const entry = {
        b_id,
        ...candidate,
        m_name: measureNameById.get(candidate.m_id) ?? candidate.m_id.replace("bln_", ""),
      }
      candidates.push(entry)
      if (bestVariantIds.has(candidate.m_id)) opportunities.push(entry)
    }
  }

  return { opportunities, candidates, adviceAvailable }
}
