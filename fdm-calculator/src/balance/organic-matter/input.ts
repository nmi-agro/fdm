import {
    type FdmType,
    type fdmSchema,
    getCultivations,
    getCultivationsForFarm,
    getCultivationsFromCatalogue,
    getFertilizerApplications,
    getFertilizerApplicationsForFarm,
    getFertilizers,
    getField,
    getFields,
    getSoilAnalyses,
    getSoilAnalysesForFarm,
    type PrincipalId,
    type Timeframe,
} from "@nmi-agro/fdm-core"
import type { OrganicMatterBalanceInput } from "./types"

/**
 * Collects all necessary input data from an FDM instance to calculate the organic matter balance for a farm or a specific field.
 *
 * This function acts as a data-gathering layer, interacting with the FDM core to fetch
 * all records required for the organic matter balance calculation. It retrieves data for a given farm
 * and timeframe, including field details, cultivation history, soil analyses, and fertilizer applications.
 * It also fetches the complete fertilizer and cultivation catalogues for the farm to provide necessary details
 * for the calculations (e.g., EOM values).
 *
 * The collected data is then structured into an `OrganicMatterBalanceInput` object, which can be directly
 * passed to the main `calculateOrganicMatterBalance` function.
 *
 * @param fdm - The FDM instance, used for all database interactions.
 * @param principal_id - The ID of the user or service principal requesting the data, for authorization purposes.
 * @param b_id_farm - The unique identifier for the farm.
 * @param timeframe - The time period (start and end dates) for which to collect the data.
 * @param b_id - Optional. If provided, the data collection will be limited to this specific field ID. Otherwise, data for all fields in the farm will be collected.
 * @returns A promise that resolves with a single `OrganicMatterBalanceInput` object containing all the structured data for the calculation.
 * @throws {Error} Throws an error if any of the database queries fail or if a specified field is not found.
 *
 * @alpha
 */
export async function collectInputForOrganicMatterBalance(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
    timeframe: Timeframe,
    b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<OrganicMatterBalanceInput> {
    try {
        // All data fetching is wrapped in a single database transaction to ensure consistency.
        return await fdm.transaction(async (tx: FdmType) => {
            // 1. Determine which fields to process: a single field or all fields for the farm.
            let farmFields: Awaited<ReturnType<typeof getFields>>
            if (b_id) {
                // Fetch a single specified field.
                const field = await getField(tx, principal_id, b_id)
                if (!field) {
                    throw new Error(`Field not found: ${String(b_id)}`)
                }
                farmFields = [field]
            } else {
                // Fetch all fields associated with the farm within the given timeframe.
                farmFields = await getFields(
                    tx,
                    principal_id,
                    b_id_farm,
                    timeframe,
                )
            }

            // 2. Fetch farm-level catalogue data.
            // These details are fetched once for the entire farm and reused for each field.
            const fertilizerDetails = await getFertilizers(
                tx,
                principal_id,
                b_id_farm,
            )
            const cultivationDetails = await getCultivationsFromCatalogue(
                tx,
                principal_id,
                b_id_farm,
            )

            // Shortcut in case no fields are found
            if (farmFields.length === 0) {
                return {
                    fields: [],
                    fertilizerDetails: fertilizerDetails,
                    cultivationDetails: cultivationDetails,
                    timeFrame: timeframe,
                }
            }

            const allCultivations = b_id
                ? {
                      [b_id]: await getCultivations(
                          fdm,
                          principal_id,
                          farmFields[0].b_id,
                          timeframe,
                      ),
                  }
                : await getCultivationsForFarm(
                      fdm,
                      principal_id,
                      b_id_farm,
                      timeframe,
                  )

            const allFertilizerApplications = b_id
                ? {
                      [b_id]: await getFertilizerApplications(
                          fdm,
                          principal_id,
                          farmFields[0].b_id,
                          timeframe,
                      ),
                  }
                : await getFertilizerApplicationsForFarm(
                      fdm,
                      principal_id,
                      b_id_farm,
                      timeframe,
                  )

            const allSoilAnalyses = b_id
                ? {
                      [b_id]: await getSoilAnalyses(
                          fdm,
                          principal_id,
                          farmFields[0].b_id,
                          timeframe,
                      ),
                  }
                : await getSoilAnalysesForFarm(
                      fdm,
                      principal_id,
                      b_id_farm,
                      timeframe,
                  )

            // 3. For each field, collect all related data concurrently.
            const fields = await Promise.all(
                farmFields.map((field) => {
                    const cultivations = allCultivations[field.b_id] ?? []

                    // Get the soil analyses of the field
                    const soilAnalyses = allSoilAnalyses[field.b_id] ?? []

                    // Get the fertilizer applications of the field
                    const fertilizerApplications =
                        allFertilizerApplications[field.b_id] ?? []

                    // Structure the collected data for this field.
                    return {
                        field,
                        cultivations,
                        fertilizerApplications,
                        soilAnalyses,
                    }
                }),
            )

            // 4. Assemble the final input object.
            return {
                fields,
                fertilizerDetails,
                cultivationDetails,
                timeFrame: timeframe,
            }
        })
    } catch (error) {
        // Wrap any errors in a more descriptive error message.
        throw new Error(
            `Failed to collect organic matter balance input for farm ${b_id_farm}: ${
                error instanceof Error ? error.message : String(error)
            }`,
            { cause: error },
        )
    }
}
