import type {
    FdmType,
    fdmSchema,
    PrincipalId,
    Timeframe,
} from "@nmi-agro/fdm-core"
import {
    getCultivations,
    getCultivationsFromCatalogues,
    getCultivationsFromCatalogue,
    getEnabledCultivationCataloguesForFarms,
    getEnabledFertilizerCataloguesForFarms,
    getFertilizerApplications,
    getFertilizersFromCatalogues,
    getFertilizersFromCatalogue,
    getField,
    getFields,
    getSoilAnalyses,
} from "@nmi-agro/fdm-core"
import { handleInputCollectionError } from "../shared/errors"
import type { FieldInput, OrganicMatterBalanceInput } from "./types"

/**
 * Collects all necessary input data from an FDM instance to calculate the organic matter balance of a single farm.
 *
 * This function acts as a data-gathering layer, interacting with the FDM core to fetch
 * all records required for the organic matter balance calculation. It retrieves data for a given farm
 * and timeframe, including field details, cultivation history, soil analyses, and fertilizer applications.
 * It also fetches the complete fertilizer and cultivation catalogues for the farm to provide necessary details
 * for the calculations (e.g., EOM values).
 * A complete OrganicMatterBalanceInput object can be built by collecting the cultivationDetails and
 * fertilizerDetails separately, then combining them in a new object along with the array
 * returned from this function, ending up with a `OrganicMatterBalanceInput` object.
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
async function collectInputForOrganicMatterBalanceForFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
    timeframe: Timeframe,
    b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<FieldInput[]> {
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

            // 2. For each field, collect all related data concurrently.
            return await Promise.all(
                farmFields.map(async (field) => {
                    // Fetch cultivation history for the field.
                    const cultivations = await getCultivations(
                        tx,
                        principal_id,
                        field.b_id,
                        timeframe,
                    )

                    // Fetch all soil analysis records for the field.
                    const soilAnalyses = await getSoilAnalyses(
                        tx,
                        principal_id,
                        field.b_id,
                        timeframe,
                    )

                    // Fetch all fertilizer application records for the field.
                    const fertilizerApplications =
                        await getFertilizerApplications(
                            tx,
                            principal_id,
                            field.b_id,
                            timeframe,
                        )

                    // Structure the collected data for this field.
                    return {
                        field,
                        cultivations,
                        fertilizerApplications,
                        soilAnalyses,
                    }
                }),
            )
        })
    } catch (error) {
        throw handleOrganicMatterBalanceInputCollectionError(error, b_id_farm)
    }
}
/**
 * Collects all necessary input data from an FDM instance to calculate the organic matter balance for multiple farms or
 * their specific field while minimizing data fetches.
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
 * @param farmIds - The unique identifiers for the farms.
 * @param timeframe - The time period (start and end dates) for which to collect the data.
 * @param b_id - Optional. If provided, the data collection will be limited to this specific field ID. Otherwise, data for all fields in the farm will be collected.
 * **Do not** provide this if collecting input for multiple farms, it will yield an unusable input.
 * @returns A promise that resolves with a single `OrganicMatterBalanceInput` object containing all the structured data for the calculation.
 * @throws {Error} Throws an error if any of the database queries fail or if a specified field is not found.
 *
 * @alpha
 */
/**
 * Collects all necessary input data from an FDM instance to calculate the organic matter balance for multiple farms.
 *
 * This function acts as a data-gathering layer, interacting with the FDM core to fetch
 * all records required for the organic matter balance calculation. It retrieves data for the given farms
 * and timeframe, including field details, cultivation history, soil analyses, and fertilizer applications.
 * It fetches the complete fertilizer and cultivation catalogues for all farms in batch to minimise
 * database round-trips.
 *
 * @param fdm - The FDM instance, used for all database interactions.
 * @param principal_id - The ID of the user or service principal requesting the data, for authorization purposes.
 * @param farmIds - The unique identifiers for the farms.
 * @param timeframe - The time period (start and end dates) for which to collect the data.
 * @returns A promise that resolves with an array of `OrganicMatterBalanceInput` objects with b_id_farm containing all the structured data.
 * @throws {Error} Throws an error if any of the database queries fail or if a specified field is not found.
 *
 * @alpha
 */
export async function collectInputForOrganicMatterBalanceForFarms(
    fdm: FdmType,
    principal_id: PrincipalId,
    farmIds: fdmSchema.farmsTypeSelect["b_id_farm"][],
    timeframe: Timeframe,
): Promise<(OrganicMatterBalanceInput & { b_id_farm: string })[]> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const uniqueFarmIds = [...new Set(farmIds)]

            // Step 1: Get enabled catalogue sources for all farms in a single batch query
            const [farmCultivationCatalogues, farmFertilizerCatalogues] =
                await Promise.all([
                    getEnabledCultivationCataloguesForFarms(
                        tx,
                        principal_id,
                        uniqueFarmIds,
                    ),
                    getEnabledFertilizerCataloguesForFarms(
                        tx,
                        principal_id,
                        uniqueFarmIds,
                    ),
                ])

            // Step 2: Deduplicate catalogue sources across farms and fetch items once
            const uniqueCultivationSources = [
                ...new Set(
                    Object.values(farmCultivationCatalogues).flat(),
                ),
            ]
            const uniqueFertilizerSources = [
                ...new Set(
                    Object.values(farmFertilizerCatalogues).flat(),
                ),
            ]
            const [allCultivations, allFertilizers] = await Promise.all([
                getCultivationsFromCatalogues(tx, uniqueCultivationSources),
                getFertilizersFromCatalogues(tx, principal_id, uniqueFertilizerSources),
            ])

            // Step 3: Process each farm using the pre-fetched catalogue data
            const farmSettled = await Promise.allSettled(
                uniqueFarmIds.map(async (b_id_farm) => {
                    const onlyFieldInput =
                        await collectInputForOrganicMatterBalanceForFarm(
                            tx,
                            principal_id,
                            b_id_farm,
                            timeframe,
                        )

                    // Filter catalogue items to only those referenced by this farm's fields
                    const farmCultivationSources = new Set(
                        farmCultivationCatalogues[b_id_farm] ?? [],
                    )
                    const cultivationIds = new Set(
                        onlyFieldInput.flatMap((input) =>
                            input.cultivations.map(
                                (cultivation) => cultivation.b_lu_catalogue,
                            ),
                        ),
                    )
                    const cultivationDetailsForThisFarm =
                        allCultivations.filter(
                            (c) =>
                                farmCultivationSources.has(c.b_lu_source) &&
                                cultivationIds.has(c.b_lu_catalogue),
                        )

                    const farmFertilizerSources = new Set(
                        farmFertilizerCatalogues[b_id_farm] ?? [],
                    )
                    const fertilizerIds = new Set(
                        onlyFieldInput.flatMap((input) =>
                            input.fertilizerApplications.map(
                                (app) => app.p_id_catalogue,
                            ),
                        ),
                    )
                    const fertilizerDetailsForThisFarm =
                        allFertilizers.filter(
                            (f) =>
                                farmFertilizerSources.has(f.p_source) &&
                                fertilizerIds.has(f.p_id_catalogue),
                        )

                    return {
                        b_id_farm: b_id_farm,
                        fields: onlyFieldInput,
                        fertilizerDetails: fertilizerDetailsForThisFarm,
                        cultivationDetails: cultivationDetailsForThisFarm,
                        timeFrame: timeframe,
                    }
                }),
            )
            return farmSettled
                .filter((result) => {
                    if (result.status === "rejected") {
                        console.error(
                            handleOrganicMatterBalanceInputCollectionError(
                                result.reason,
                            ).message,
                        )
                        return false
                    }
                    return true
                })
                .map((result) => (result as PromiseFulfilledResult<OrganicMatterBalanceInput & { b_id_farm: string }>).value)
        })
    } catch (error) {
        throw handleOrganicMatterBalanceInputCollectionError(error)
    }
}

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
) {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const cultivationDetails = await getCultivationsFromCatalogue(
                tx,
                principal_id,
                b_id_farm,
            )
            const fertilizerDetails = await getFertilizersFromCatalogue(
                tx,
                principal_id,
                b_id_farm,
            )
            const fields = await collectInputForOrganicMatterBalanceForFarm(
                tx,
                principal_id,
                b_id_farm,
                timeframe,
                b_id,
            )
            return {
                b_id_farm,
                fields,
                fertilizerDetails,
                cultivationDetails,
                timeFrame: timeframe,
            }
        })
    } catch (error) {
        throw handleOrganicMatterBalanceInputCollectionError(error)
    }
}

export const handleOrganicMatterBalanceInputCollectionError =
    handleInputCollectionError(
        "Failed to collect organic matter balance input for farm",
        "Failed to collect organic matter balance input",
    )
