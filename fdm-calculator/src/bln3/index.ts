import type { FdmType, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import {
  getEnabledMeasureCatalogues,
  getField,
  getFields,
  getMeasures,
  getMeasuresFromCatalogue,
} from "@nmi-agro/fdm-core"
import type { Bln3Score } from "./types"
import { getBln3MeasureAdvice, getBln3MeasureApplicability, getBln3Score } from "./api"
import { Bln3UnavailableError } from "./errors"
import { collectInputForBln3MeasureApplicability, collectInputForBln3Score } from "./input"
import { buildMeasureOptions, type MeasureOption } from "./recommendations"
import { aggregateFarmScores, type FarmScores } from "./scoring"

export { collectInputForBln3MeasureApplicability, collectInputForBln3Score } from "./input"
export {
  getBln3MeasureAdvice,
  getBln3MeasureApplicability,
  getBln3Score,
  requestBln3MeasureAdvice,
  requestBln3MeasureApplicability,
  requestBln3Score,
} from "./api"

/** Number of fields scored concurrently when scoring a whole farm. */
const FARM_BATCH_SIZE = 5

/**
 * Builds the inclusive 1 January to 31 December timeframe of a calendar year.
 *
 * @param year - Four-digit calendar year.
 * @returns The timeframe covering the full year.
 */
export function getYearTimeframe(year: number): Timeframe {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  }
}

function requireKey(nmiApiKey: string | undefined): string {
  if (!nmiApiKey) {
    throw new Bln3UnavailableError("BLN3 calculations are not available on this server")
  }
  return nmiApiKey
}

/**
 * Result of a BLN3 score request for one field.
 */
export type FieldIndicators = {
  b_id: string
  year: number
  /** `true` for buffer strips and nature fields, which have no BLN3 score */
  is_excluded: boolean
  /** Score of the field; `null` only when the field is excluded */
  score: Bln3Score | null
}

/**
 * Retrieves the BLN3 indicator and aggregation scores of a field for a calendar year.
 *
 * Soil analyses and adopted measures are limited to the year; the cultivation history
 * required by BLN3 is not.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal on whose behalf access is checked.
 * @param b_id - Field identifier.
 * @param year - Four-digit calendar year.
 * @param nmiApiKey - NMI API key resolved server-side.
 * @returns The score, or `is_excluded: true` without score for excluded fields.
 * @throws {Bln3UnavailableError} When the score cannot be produced.
 */
export async function getFieldIndicators(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  year: number,
  nmiApiKey: string | undefined,
): Promise<FieldIndicators> {
  const inputs = await collectInputForBln3Score(fdm, principal_id, b_id, getYearTimeframe(year))
  if (inputs.isExcluded) {
    return { b_id, year, is_excluded: true, score: null }
  }
  const key = requireKey(nmiApiKey)
  let score: Bln3Score | null
  try {
    score = await getBln3Score(fdm, { ...inputs, nmiApiKey: key })
  } catch (cause) {
    throw new Bln3UnavailableError("BLN3 score is unavailable", { cause })
  }
  if (!score) {
    throw new Bln3UnavailableError("BLN3 score is unavailable")
  }
  return { b_id, year, is_excluded: false, score }
}

/**
 * Result of BLN3 scoring for all eligible fields of a farm.
 */
export type FarmIndicators = {
  b_id_farm: string
  year: number
  fields: { b_id: string; b_area: number | null; score: Bln3Score }[]
  farm: FarmScores
}

/**
 * Retrieves BLN3 scores for all eligible fields of a farm and the area-weighted farm scores.
 *
 * Buffer strips and nature fields are left out of the fields and the weighting. If any
 * eligible field cannot be scored, the whole request fails instead of returning partial
 * aggregates.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal on whose behalf access is checked.
 * @param b_id_farm - Farm identifier.
 * @param year - Four-digit calendar year.
 * @param nmiApiKey - NMI API key resolved server-side.
 * @returns Per-field scores and farm-level aggregates; empty when no field is eligible.
 * @throws {Bln3UnavailableError} When an eligible field cannot be scored.
 */
export async function getFarmIndicators(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  year: number,
  nmiApiKey: string | undefined,
): Promise<FarmIndicators> {
  const fields = await getFields(fdm, principal_id, b_id_farm, getYearTimeframe(year))

  const scored: FarmIndicators["fields"] = []
  for (let i = 0; i < fields.length; i += FARM_BATCH_SIZE) {
    const batch = fields.slice(i, i + FARM_BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (field) => ({
        field,
        result: await getFieldIndicators(fdm, principal_id, field.b_id, year, nmiApiKey),
      })),
    )
    for (const { field, result } of results) {
      if (result.is_excluded || !result.score) continue
      scored.push({ b_id: field.b_id, b_area: field.b_area, score: result.score })
    }
  }

  return {
    b_id_farm,
    year,
    fields: scored,
    farm: aggregateFarmScores(scored),
  }
}

/**
 * Result of the measure options of a field.
 */
export type FieldMeasureOptions = {
  b_id: string
  year: number
  is_excluded: boolean
  data: MeasureOption[]
}

/**
 * Retrieves the field-level measure catalogue with applicability, active and conflicting
 * status, predicted impacts and recommendations for a calendar year.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal on whose behalf access is checked.
 * @param b_id - Field identifier.
 * @param year - Four-digit calendar year.
 * @param nmiApiKey - NMI API key resolved server-side.
 * @returns The options, or an empty list with `is_excluded: true` for excluded fields.
 * @throws {Bln3UnavailableError} When score, applicability or advice is unavailable.
 */
export async function getFieldMeasureOptions(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  year: number,
  nmiApiKey: string | undefined,
): Promise<FieldMeasureOptions> {
  const timeframe = getYearTimeframe(year)
  const field = await getField(fdm, principal_id, b_id)

  const inputs = await collectInputForBln3MeasureApplicability(
    fdm,
    principal_id,
    b_id,
    year,
    timeframe,
  )
  if (inputs.isExcluded) {
    return { b_id, year, is_excluded: true, data: [] }
  }
  const key = requireKey(nmiApiKey)

  const [catalogue, enabledSources, measures] = await Promise.all([
    getMeasuresFromCatalogue(fdm),
    getEnabledMeasureCatalogues(fdm, principal_id, field.b_id_farm),
    getMeasures(fdm, principal_id, b_id, timeframe),
  ])

  const { score } = await getFieldIndicators(fdm, principal_id, b_id, year, key)
  if (!score) {
    throw new Bln3UnavailableError("BLN3 score is unavailable")
  }

  let applicability: Awaited<ReturnType<typeof getBln3MeasureApplicability>>
  let advice: Awaited<ReturnType<typeof getBln3MeasureAdvice>>
  try {
    ;[applicability, advice] = await Promise.all([
      getBln3MeasureApplicability(fdm, { ...inputs, nmiApiKey: key }),
      getBln3MeasureAdvice(fdm, { ...inputs, nmiApiKey: key }),
    ])
  } catch (cause) {
    throw new Bln3UnavailableError("BLN3 measure applicability or advice is unavailable", {
      cause,
    })
  }
  if (!advice) {
    throw new Bln3UnavailableError("BLN3 measure advice is unavailable")
  }

  const data = buildMeasureOptions({
    catalogue,
    enabledSources,
    activeMeasures: measures.map((m) => ({
      b_id_measure: m.b_id_measure,
      m_id: m.m_id,
      m_conflicts: m.m_conflicts,
    })),
    applicability,
    advice,
    score,
  })
  return { b_id, year, is_excluded: false, data }
}
