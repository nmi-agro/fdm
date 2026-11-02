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
import type { PhosphateBalanceInput, PhosphateFieldInput } from "./types"

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

/**
 * Collects the input for the phosphate balance of a farm, or of one of its fields.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal requesting the data.
 * @param b_id_farm - The farm.
 * @param timeframe - The period of the balance.
 * @param b_id - Optional field; when given, only this field is collected.
 * @returns The input for `calculatePhosphateBalance`.
 * @alpha
 */
export async function collectInputForPhosphateBalance(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  timeframe: Timeframe,
  b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<PhosphateBalanceInput> {
  return await fdm.transaction(async (tx: FdmType) => {
    const [fields, cultivationDetails, fertilizerDetails] = await Promise.all([
      collectFieldInputs(tx, principal_id, b_id_farm, timeframe, b_id),
      getCultivationsFromCatalogue(tx, principal_id, b_id_farm),
      getFertilizersFromCatalogue(tx, principal_id, b_id_farm),
    ])
    return { fields, cultivationDetails, fertilizerDetails, timeFrame: toTimeFrame(timeframe) }
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
 * @returns The input per farm, with its `b_id_farm`.
 * @alpha
 */
export async function collectInputForPhosphateBalanceForFarms(
  fdm: FdmType,
  principal_id: PrincipalId,
  farmIds: fdmSchema.farmsTypeSelect["b_id_farm"][],
  timeframe: Timeframe,
): Promise<(PhosphateBalanceInput & { b_id_farm: string })[]> {
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
        const fields = await collectFieldInputs(tx, principal_id, b_id_farm, timeframe)
        const cultivationSources = new Set(cultivationCatalogues[b_id_farm] ?? [])
        const cultivationIds = new Set(
          fields.flatMap((f) => f.cultivations.map((c) => c.b_lu_catalogue)),
        )
        const fertilizerSources = new Set(fertilizerCatalogues[b_id_farm] ?? [])
        const fertilizerIds = new Set(
          fields.flatMap((f) => f.fertilizerApplications.map((a) => a.p_id_catalogue)),
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
          timeFrame: toTimeFrame(timeframe),
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
