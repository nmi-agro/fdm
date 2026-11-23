import type { FdmType, fdmSchema, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import {
  getCultivations,
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getCultivationsFromCatalogues,
  getEnabledCultivationCataloguesForFarms,
  getEnabledFertilizerCataloguesForFarms,
  getFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getFertilizersFromCatalogue,
  getFertilizersFromCatalogues,
  getField,
  getFields,
  getHarvests,
  getHarvestsForFarm,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import { subYears } from "date-fns"
import type {
  PhosphateBalanceHistoryYear,
  PhosphateBalanceInput,
  PhosphateFieldInput,
} from "./types"

/** Default number of earlier years collected for the long-term average balance (so up to 5 years). */
export const PHOSPHATE_HISTORY_YEARS = 4

/** Options for the input collection. */
export type PhosphateInputOptions = {
  /** Number of earlier years to collect for the long-term average (0: none). Default 4. */
  historyYears?: number
}

/** Default timeframe (the current calendar year) when the timeframe has no start or end. */
function toTimeFrame(timeframe: Timeframe): { start: Date; end: Date } {
  return {
    start: timeframe.start ?? new Date(new Date().getFullYear(), 0, 1),
    end: timeframe.end ?? new Date(new Date().getFullYear(), 11, 31),
  }
}

/**
 * Collects the field inputs of a farm, or of one of its fields.
 *
 * One field: the per-field fdm-core functions. All fields: the farm-level functions, so the number
 * of queries does not grow with the number of fields. Soil analyses are collected without the
 * timeframe: the most recent ones describe the soil, and older ones show its history.
 */
async function collectFieldInputs(
  tx: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  timeframe: Timeframe,
  b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<PhosphateFieldInput[]> {
  if (b_id) {
    const field = await getField(tx, principal_id, b_id)
    const cultivations = await getCultivations(tx, principal_id, field.b_id, timeframe)
    const harvests = (
      await Promise.all(cultivations.map((c) => getHarvests(tx, principal_id, c.b_lu, timeframe)))
    ).flat()
    const soilAnalyses = await getSoilAnalyses(tx, principal_id, field.b_id)
    const fertilizerApplications = await getFertilizerApplications(
      tx,
      principal_id,
      field.b_id,
      timeframe,
    )
    return [{ field, cultivations, harvests, soilAnalyses, fertilizerApplications }]
  }

  const fields = await getFields(tx, principal_id, b_id_farm, timeframe)
  const [cultivationsByField, harvestsByCultivation, soilByField, applicationsByField] =
    await Promise.all([
      getCultivationsForFarm(tx, principal_id, b_id_farm, timeframe),
      getHarvestsForFarm(tx, principal_id, b_id_farm, timeframe),
      getSoilAnalysesForFarm(tx, principal_id, b_id_farm),
      getFertilizerApplicationsForFarm(tx, principal_id, b_id_farm, timeframe),
    ])
  return fields.map((field) => {
    const cultivations = cultivationsByField.get(field.b_id) ?? []
    return {
      field,
      cultivations,
      harvests: cultivations.flatMap((c) => harvestsByCultivation.get(c.b_lu) ?? []),
      soilAnalyses: soilByField.get(field.b_id) ?? [],
      fertilizerApplications: applicationsByField.get(field.b_id) ?? [],
    }
  })
}

/** Whether a date lies in the timeframe (inclusive). */
function inFrame(date: Date | null | undefined, frame: { start: Date; end: Date }): boolean {
  if (!date) return false
  const t = new Date(date).getTime()
  return t >= frame.start.getTime() && t <= frame.end.getTime()
}

/**
 * Collects the earlier years in one query set (the whole period before the timeframe) and splits
 * them per year: fertilizer applications and harvests by their date, cultivations that overlap the
 * year. Soil analyses are the same for every year.
 */
async function collectHistory(
  tx: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  timeFrame: { start: Date; end: Date },
  historyYears: number,
  b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<PhosphateBalanceHistoryYear[]> {
  if (historyYears <= 0) return []
  const period = {
    start: subYears(timeFrame.start, historyYears),
    end: new Date(timeFrame.start.getTime() - 1),
  }
  const fields = await collectFieldInputs(tx, principal_id, b_id_farm, period, b_id)
  return Array.from({ length: historyYears }, (_, i) => {
    const frame = { start: subYears(timeFrame.start, i + 1), end: subYears(timeFrame.end, i + 1) }
    return {
      timeFrame: frame,
      fields: fields.map((f) => ({
        ...f,
        cultivations: f.cultivations.filter(
          (c) =>
            (!c.b_lu_start || new Date(c.b_lu_start).getTime() <= frame.end.getTime()) &&
            (!c.b_lu_end || new Date(c.b_lu_end).getTime() >= frame.start.getTime()),
        ),
        harvests: f.harvests.filter((h) => inFrame(h.b_lu_harvest_date, frame)),
        fertilizerApplications: f.fertilizerApplications.filter((a) =>
          inFrame(a.p_app_date, frame),
        ),
      })),
    }
  })
}

/**
 * Collects the input for the phosphate balance of a farm, or of one of its fields.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal requesting the data.
 * @param b_id_farm - The farm.
 * @param timeframe - The period of the balance.
 * @param b_id - Optional field; when given, only this field is collected.
 * @param options - `historyYears`: earlier years for the long-term average (default 4).
 * @returns The input for `calculatePhosphateBalance`.
 * @alpha
 */
export async function collectInputForPhosphateBalance(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  timeframe: Timeframe,
  b_id?: fdmSchema.fieldsTypeSelect["b_id"],
  options: PhosphateInputOptions = {},
): Promise<PhosphateBalanceInput> {
  const timeFrame = toTimeFrame(timeframe)
  const historyYears = options.historyYears ?? PHOSPHATE_HISTORY_YEARS
  return await fdm.transaction(async (tx: FdmType) => {
    const [fields, history, cultivationDetails, fertilizerDetails] = await Promise.all([
      collectFieldInputs(tx, principal_id, b_id_farm, timeFrame, b_id),
      collectHistory(tx, principal_id, b_id_farm, timeFrame, historyYears, b_id),
      getCultivationsFromCatalogue(tx, principal_id, b_id_farm),
      getFertilizersFromCatalogue(tx, principal_id, b_id_farm),
    ])
    return { fields, cultivationDetails, fertilizerDetails, timeFrame, history }
  })
}

/**
 * Collects the input for the phosphate balance of several farms (e.g. of an organisation), with the
 * catalogues fetched once for all farms. A farm whose input cannot be collected is left out and
 * logged, as in the organic matter balance.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal requesting the data.
 * @param farmIds - The farms.
 * @param timeframe - The period of the balance.
 * @param options - `historyYears`: earlier years for the long-term average (default 4).
 * @returns The input per farm, with its `b_id_farm`.
 * @alpha
 */
export async function collectInputForPhosphateBalanceForFarms(
  fdm: FdmType,
  principal_id: PrincipalId,
  farmIds: fdmSchema.farmsTypeSelect["b_id_farm"][],
  timeframe: Timeframe,
  options: PhosphateInputOptions = {},
): Promise<(PhosphateBalanceInput & { b_id_farm: string })[]> {
  const timeFrame = toTimeFrame(timeframe)
  const historyYears = options.historyYears ?? PHOSPHATE_HISTORY_YEARS
  return await fdm.transaction(async (tx: FdmType) => {
    const uniqueFarmIds = [...new Set(farmIds)]
    const [cultivationCatalogues, fertilizerCatalogues] = await Promise.all([
      getEnabledCultivationCataloguesForFarms(tx, principal_id, uniqueFarmIds),
      getEnabledFertilizerCataloguesForFarms(tx, principal_id, uniqueFarmIds),
    ])
    const [allCultivations, allFertilizers] = await Promise.all([
      getCultivationsFromCatalogues(tx, [...new Set(Object.values(cultivationCatalogues).flat())]),
      getFertilizersFromCatalogues(tx, principal_id, [
        ...new Set(Object.values(fertilizerCatalogues).flat()),
      ]),
    ])

    const settled = await Promise.allSettled(
      uniqueFarmIds.map(async (b_id_farm) => {
        const [fields, history] = await Promise.all([
          collectFieldInputs(tx, principal_id, b_id_farm, timeFrame),
          collectHistory(tx, principal_id, b_id_farm, timeFrame, historyYears),
        ])
        const allFields = [...fields, ...history.flatMap((year) => year.fields)]
        const cultivationSources = new Set(cultivationCatalogues[b_id_farm] ?? [])
        const cultivationIds = new Set(
          allFields.flatMap((f) => f.cultivations.map((c) => c.b_lu_catalogue)),
        )
        const fertilizerSources = new Set(fertilizerCatalogues[b_id_farm] ?? [])
        const fertilizerIds = new Set(
          allFields.flatMap((f) => f.fertilizerApplications.map((a) => a.p_id_catalogue)),
        )
        return {
          b_id_farm,
          fields,
          cultivationDetails: allCultivations.filter(
            (c) => cultivationSources.has(c.b_lu_source) && cultivationIds.has(c.b_lu_catalogue),
          ),
          fertilizerDetails: allFertilizers.filter(
            (f) => fertilizerSources.has(f.p_source) && fertilizerIds.has(f.p_id_catalogue),
          ),
          timeFrame,
          history,
        }
      }),
    )
    return settled.flatMap((result, i) => {
      if (result.status === "fulfilled") return [result.value]
      console.error(
        `Failed to collect phosphate balance input for farm ${uniqueFarmIds[i]}:`,
        result.reason,
      )
      return []
    })
  })
}
