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
    getHarvests,
    getHarvestsForCultivations,
    getSoilAnalyses,
    getSoilAnalysesForFarm,
    type PrincipalId,
    type Timeframe,
} from "@nmi-agro/fdm-core"
import { getFdmPublicDataUrl } from "../../shared/public-data-url"
import { calculateAllFieldsNitrogenSupplyByDeposition } from "./supply/deposition"
import type { NitrogenBalanceInput } from "./types"

/**
 * Collects necessary input data from a FDM instance for calculating the nitrogen balance.
 *
 * This function orchestrates the retrieval of data related to fields, cultivations,
 * harvests, soil analyses, fertilizer applications, fertilizer details, and cultivation details
 * within a specified farm and timeframe. It fetches data from the FDM database and structures
 * it into a `NitrogenBalanceInput` object.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The ID of the principal (user or service) initiating the data collection.
 * @param b_id_farm - The ID of the farm for which to collect the nitrogen balance input.
 * @param timeframe - The timeframe for which to collect the data.
 * @param b_id - Optional. If provided, the data collection will be limited to this specific field ID. Otherwise, data for all fields in the farm will be collected.
 * @returns A promise that resolves with a `NitrogenBalanceInput` object containing all the necessary data.
 * @throws {Error} - Throws an error if data collection or processing fails.
 *
 * @alpha
 */
export async function collectInputForNitrogenBalance(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
    timeframe: Timeframe,
    b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<NitrogenBalanceInput> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            // Collect the fields for the farm
            let farmFields: Awaited<ReturnType<typeof getFields>>
            if (b_id) {
                const field = await getField(tx, principal_id, b_id)
                if (!field) {
                    throw new Error(`Field not found: ${String(b_id)}`)
                }
                farmFields = [field]
            } else {
                farmFields = await getFields(
                    tx,
                    principal_id,
                    b_id_farm,
                    timeframe,
                )
            }

            // Collect the details of the fertilizers
            const fertilizerDetails = await getFertilizers(
                tx,
                principal_id,
                b_id_farm,
            )

            // Collect the details of the cultivations
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

            // Set the link to location of FDM public data
            const fdmPublicDataUrl = getFdmPublicDataUrl()

            // Fetch all deposition data in a single, batched request to avoid requesting the GeoTIIF for every field
            const depositionByField =
                await calculateAllFieldsNitrogenSupplyByDeposition(
                    farmFields,
                    timeframe,
                    fdmPublicDataUrl,
                )

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

            let harvestingChunks: Awaited<
                ReturnType<typeof getHarvestsForCultivations>
            >[]

            const allCultivationIds = [
                ...new Set(
                    farmFields.flatMap((field) =>
                        (allCultivations[field.b_id] ?? []).map(
                            (cultivation) => cultivation.b_lu,
                        ),
                    ),
                ),
            ]

            if (b_id) {
                harvestingChunks = [
                    Object.fromEntries(
                        await Promise.all(
                            allCultivationIds.map(async (b_lu) => [
                                b_lu,
                                await getHarvests(
                                    fdm,
                                    principal_id,
                                    b_lu,
                                    timeframe,
                                ),
                            ]),
                        ),
                    ),
                ]
            } else {
                // SQL implementations usually have a limit for how many parameters a query can have, so don't request all at the same time
                const CULTIVATION_BATCH_SIZE = 1024
                const harvestingChunkFetches: ReturnType<
                    typeof getHarvestsForCultivations
                >[] = []
                for (
                    let i = 0;
                    i < allCultivationIds.length;
                    i += CULTIVATION_BATCH_SIZE
                ) {
                    harvestingChunkFetches.push(
                        getHarvestsForCultivations(
                            fdm,
                            principal_id,
                            allCultivationIds.slice(
                                i,
                                i + CULTIVATION_BATCH_SIZE,
                            ),
                            timeframe,
                        ),
                    )
                }
                // Also keep them as separate objects so there isn't a huge object
                harvestingChunks = await Promise.all(harvestingChunkFetches)
            }

            // Collect the details per field
            const fields = await Promise.all(
                farmFields.map((field) => {
                    const cultivations = allCultivations[field.b_id] ?? []

                    const harvests = cultivations.flatMap(
                        (cultivation) =>
                            harvestingChunks.find(
                                (chunk) => chunk[cultivation.b_lu],
                            )?.[cultivation.b_lu] ?? [],
                    )

                    const harvestsFiltered = harvests.filter(
                        (harvest) => harvest.b_lu !== undefined,
                    )

                    // Get the soil analyses of the field
                    const soilAnalyses = allSoilAnalyses[field.b_id] ?? []

                    // Get the fertilizer applications of the field
                    const fertilizerApplications =
                        allFertilizerApplications[field.b_id] ?? []

                    return {
                        field: field,
                        cultivations: cultivations,
                        harvests: harvestsFiltered,
                        fertilizerApplications: fertilizerApplications,
                        soilAnalyses: soilAnalyses,
                        depositionSupply: depositionByField.get(field.b_id),
                    }
                }),
            )

            return {
                fields,
                fertilizerDetails: fertilizerDetails,
                cultivationDetails: cultivationDetails,
                timeFrame: timeframe,
            }
        })
    } catch (error) {
        throw new Error(
            `Failed to collect nitrogen balance input for farm ${b_id_farm}: ${
                error instanceof Error ? error.message : String(error)
            }`,
            { cause: error },
        )
    }
}
