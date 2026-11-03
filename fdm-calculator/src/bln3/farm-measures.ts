import type { FdmType, Field, Measure, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import { getCultivationsForFarm, getFields, getMeasuresForFarm } from "@nmi-agro/fdm-core"
import { findMainCultivation } from "../nutrient-advice/farm"
import { isExcludedFromBln3 } from "./postprocessing"

/** A measure taken on one or more fields of a farm. */
export type FarmMeasureSummaryItem = Measure & {
  /** Number of eligible fields of the farm with this measure. */
  fieldCount: number
}

/** A main cultivation of the eligible fields of a farm, with its total area. */
export type FarmMainCultivationArea = {
  b_lu_catalogue: string
  b_lu_name: string
  b_lu_croprotation: string | null
  /** Total area of the fields with this main cultivation, in hectares. */
  b_area: number
}

/** The measures and main cultivations of a farm. */
export type FarmMeasureSummary = {
  b_id_farm: string
  /**
   * Fields that count for the indicators: not buffer strips and not nature or other excluded
   * land use, judged by the main cultivation of the year.
   */
  eligibleFields: Field[]
  /**
   * One entry per measure (`m_id`) on the eligible fields. `m_start` is the earliest start and
   * `m_end` the latest end; either is `null` when any field has no date.
   */
  measures: FarmMeasureSummaryItem[]
  /** Main cultivations of the eligible fields, largest area first. */
  mainCultivations: FarmMainCultivationArea[]
}

/**
 * Summarizes the measures of a farm for an overview of several farms: which measures are taken,
 * on how many fields, and which main cultivations the farm has. Only fields that count for the
 * indicators are included.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal reading the farm. Needs read access.
 * @param b_id_farm - The farm.
 * @param timeframe - The period to read fields, measures and cultivations for.
 * @param year - Calendar year used to select the main cultivation of each field.
 * @returns The summary of the farm.
 */
export async function getFarmMeasureSummary(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  timeframe: Timeframe,
  year: number,
): Promise<FarmMeasureSummary> {
  const [fields, measuresByField, cultivationsByField] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getMeasuresForFarm(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
  ])

  const mainCultivationOf = (b_id: string) =>
    findMainCultivation(cultivationsByField.get(b_id) ?? [], year)

  const eligibleFields = fields.filter((field) => {
    const main = mainCultivationOf(field.b_id)
    return !isExcludedFromBln3({
      b_bufferstrip: field.b_bufferstrip,
      b_lu_croprotation: main?.b_lu_croprotation,
      b_lu_catalogue: main?.b_lu_catalogue,
    })
  })
  const eligibleIds = new Set(eligibleFields.map((field) => field.b_id))

  const measures = new Map<string, FarmMeasureSummaryItem>()
  for (const [b_id, fieldMeasures] of measuresByField) {
    if (!eligibleIds.has(b_id)) continue
    for (const measure of fieldMeasures) {
      const existing = measures.get(measure.m_id)
      if (!existing) {
        measures.set(measure.m_id, { ...measure, fieldCount: 1 })
        continue
      }
      measures.set(measure.m_id, {
        ...existing,
        m_start:
          !existing.m_start || !measure.m_start
            ? null
            : existing.m_start < measure.m_start
              ? existing.m_start
              : measure.m_start,
        m_end:
          !existing.m_end || !measure.m_end
            ? null
            : existing.m_end > measure.m_end
              ? existing.m_end
              : measure.m_end,
        fieldCount: existing.fieldCount + 1,
      })
    }
  }

  const cultivations = new Map<string, FarmMainCultivationArea>()
  for (const field of eligibleFields) {
    const main = mainCultivationOf(field.b_id)
    if (!main?.b_lu_catalogue) continue
    const existing = cultivations.get(main.b_lu_catalogue)
    if (existing) {
      existing.b_area += field.b_area ?? 0
    } else {
      cultivations.set(main.b_lu_catalogue, {
        b_lu_catalogue: main.b_lu_catalogue,
        b_lu_name: main.b_lu_name,
        b_lu_croprotation: main.b_lu_croprotation,
        b_area: field.b_area ?? 0,
      })
    }
  }

  return {
    b_id_farm,
    eligibleFields,
    measures: [...measures.values()],
    mainCultivations: [...cultivations.values()].sort((a, b) => b.b_area - a.b_area),
  }
}
