import type { FdmType, fdmSchema, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import {
  getCultivations,
  getCultivationsFromCatalogue,
  getFertilizerApplications,
  getFertilizersFromCatalogue,
  getField,
  getFields,
  getHarvests,
  getSoilAnalyses,
} from "@nmi-agro/fdm-core"
import type { PhosphateBalanceInput, PhosphateFieldInput } from "./types"

/**
 * Collects the input for the phosphate balance of a farm, or of one of its fields.
 *
 * PROTOTYPE for discussion: uses the per-field fdm-core functions, without the batched farm queries
 * of the nitrogen balance.
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
    const fields = b_id
      ? [await getField(tx, principal_id, b_id)]
      : await getFields(tx, principal_id, b_id_farm, timeframe)

    const fieldInputs: PhosphateFieldInput[] = await Promise.all(
      fields.map(async (field) => {
        const cultivations = await getCultivations(tx, principal_id, field.b_id, timeframe)
        const harvests = (
          await Promise.all(
            cultivations.map((c) => getHarvests(tx, principal_id, c.b_lu, timeframe)),
          )
        ).flat()
        // All soil analyses (not only those in the timeframe): the most recent ones describe the soil
        const soilAnalyses = await getSoilAnalyses(tx, principal_id, field.b_id)
        const fertilizerApplications = await getFertilizerApplications(
          tx,
          principal_id,
          field.b_id,
          timeframe,
        )
        return { field, cultivations, harvests, soilAnalyses, fertilizerApplications }
      }),
    )

    return {
      fields: fieldInputs,
      cultivationDetails: await getCultivationsFromCatalogue(tx, principal_id, b_id_farm),
      fertilizerDetails: await getFertilizersFromCatalogue(tx, principal_id, b_id_farm),
      timeFrame: {
        start: timeframe.start ?? new Date(new Date().getFullYear(), 0, 1),
        end: timeframe.end ?? new Date(new Date().getFullYear(), 11, 31),
      },
    }
  })
}
