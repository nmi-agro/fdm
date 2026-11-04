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

/** A measure taken on the farms of a group or organization. */
export type CombinedMeasureSummaryItem = {
  m_id: string
  m_name: string
  /** Farms that have the measure. */
  b_id_farms: string[]
  /** Number of eligible fields with the measure, on all farms together. */
  fieldCount: number
  /** Earliest start on any field, or `null` when a field has no start date. */
  m_start: Date | null
  /** Latest end on any field, or `null` when a field has no end date. */
  m_end: Date | null
}

/** The measures and main cultivations of several farms together. */
export type CombinedMeasureSummary = {
  /** Number of eligible fields on all farms together. */
  eligibleFieldCount: number
  /** One entry per measure, sorted by name. */
  measures: CombinedMeasureSummaryItem[]
  /** Main cultivations of the eligible fields of all farms, largest area first. */
  mainCultivations: FarmMainCultivationArea[]
}

/**
 * Combines the measure summaries of several farms, for the total of a farm group or an
 * organization.
 *
 * @param summaries - The summaries per farm, from {@link getFarmMeasureSummary}.
 * @returns The measures and main cultivations of all farms together.
 */
export function combineFarmMeasureSummaries(
  summaries: FarmMeasureSummary[],
): CombinedMeasureSummary {
  const measures = new Map<string, CombinedMeasureSummaryItem>()
  const cultivations = new Map<string, FarmMainCultivationArea>()
  let eligibleFieldCount = 0

  for (const summary of summaries) {
    eligibleFieldCount += summary.eligibleFields.length
    for (const measure of summary.measures) {
      const existing = measures.get(measure.m_id)
      if (!existing) {
        measures.set(measure.m_id, {
          m_id: measure.m_id,
          m_name: measure.m_name,
          b_id_farms: [summary.b_id_farm],
          fieldCount: measure.fieldCount,
          m_start: measure.m_start ?? null,
          m_end: measure.m_end ?? null,
        })
        continue
      }
      if (!existing.b_id_farms.includes(summary.b_id_farm))
        existing.b_id_farms.push(summary.b_id_farm)
      existing.fieldCount += measure.fieldCount
      existing.m_start =
        !existing.m_start || !measure.m_start
          ? null
          : existing.m_start < measure.m_start
            ? existing.m_start
            : measure.m_start
      existing.m_end =
        !existing.m_end || !measure.m_end
          ? null
          : existing.m_end > measure.m_end
            ? existing.m_end
            : measure.m_end
    }
    for (const cultivation of summary.mainCultivations) {
      const existing = cultivations.get(cultivation.b_lu_catalogue)
      if (existing) existing.b_area += cultivation.b_area
      else cultivations.set(cultivation.b_lu_catalogue, { ...cultivation })
    }
  }

  return {
    eligibleFieldCount,
    measures: [...measures.values()].sort((a, b) => a.m_name.localeCompare(b.m_name, "nl")),
    mainCultivations: [...cultivations.values()].sort((a, b) => b.b_area - a.b_area),
  }
}
