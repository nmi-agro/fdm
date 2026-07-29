/**
 * @file bln3.server.ts
 *
 * Server-side orchestration layer for the BLN3 Indicatoren feature.
 *
 * Acts as a thin bridge between route loaders and fdm-calculator, following
 * the same pattern as mineralization.server.ts and calculator.ts.
 */

import {
  type Bln3MeasureApplicabilityItem,
  type Bln3MeasureApplicabilityResult,
  type Bln3MeasureApplicabilityStatus,
  type Bln3Score,
  type Bln3ScoreCollectedInputs,
  collectInputForBln3MeasureApplicability,
  collectInputForBln3Score,
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
import type { FieldMeasure } from "~/lib/indicators"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { fdm } from "~/lib/fdm.server"

export type {
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
}

export type FieldBln3Result = {
  score: Bln3Score | null
  inputs: Bln3ScoreCollectedInputs
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
  const nmiApiKey = getNmiApiKey()

  const inputs = await collectInputForBln3Score(fdm, principal_id, b_id, timeframe)
  const score = await getBln3Score(fdm, {
    ...inputs,
    nmiApiKey,
  })
  return { score, inputs }
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
    const b_id = fields[index].b_id
    if (result.status === "fulfilled") {
      return { b_id, score: result.value.score, error: null }
    }
    const errorMessage =
      result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.error(`BLN3 score failed for field ${b_id}:`, errorMessage)
    return { b_id, score: null, error: errorMessage }
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
  const nmiApiKey = getNmiApiKey()
  const inputs = await collectInputForBln3MeasureApplicability(
    fdm,
    principal_id,
    b_id,
    b_year,
    timeframe,
    nmiApiKey,
  )
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
}): Promise<Record<string, Record<string, MeasureApplicabilityInfo>>> {
  const BATCH_SIZE = 5
  const results = await mapInBatches(b_ids, BATCH_SIZE, (b_id) =>
    getMeasureApplicabilityForField({
      principal_id,
      b_id,
      b_year,
      timeframe,
    }),
  )

  const fieldApplicabilityMap: Record<
    string,
    Record<string, MeasureApplicabilityInfo>
  > = {}

  results.forEach((result, index) => {
    const b_id = b_ids[index]
    if (result.status === "fulfilled") {
      fieldApplicabilityMap[b_id] = result.value
    } else {
      console.error(
        `BLN3 applicability check failed for field ${b_id}:`,
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      )
      fieldApplicabilityMap[b_id] = {}
    }
  })

  return fieldApplicabilityMap
}
