import type {
    FdmType,
    fdmSchema,
    PrincipalId,
    Timeframe,
} from "@nmi-agro/fdm-core"
import {
    getCultivations,
    getCultivationsFromCatalogueForFarms,
    getFertilizerApplications,
    getFertilizersFromCatalogueForFarms,
    getField,
    getFields,
    getHarvests,
    getSoilAnalyses,
} from "@nmi-agro/fdm-core"
import { getFdmPublicDataUrl } from "../../shared/public-data-url"
import { handleInputCollectionError } from "../shared/errors"
import { calculateAllFieldsNitrogenSupplyByDeposition } from "./supply/deposition"
import type { FieldInput, NitrogenBalanceInput } from "./types"

/**
 * Collects field-specific input data from a FDM instance for calculating the nitrogen balance.
 *
 * This function orchestrates the retrieval of data related to fields, cultivations,
 * harvests, soil analyses, fertilizer applications within a specified farm and timeframe. It
 * fetches data from the FDM database and structures it into an array of `FieldInput` objects.
 * A complete NitrogenBalanceInput object can be built by collecting the cultivationDetails and
 * fertilizerDetails separately, then combining them in a new object along with the array
 * returned from this function, ending up with a `NitrogenBalanceInput` object.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The ID of the principal (user or service) initiating the data collection.
 * @param b_id_farm - The ID of the farm for which to collect the nitrogen balance input.
 * @param timeframe - The timeframe for which to collect the data.
 * @param b_id - Optional. If provided, the data collection will be limited to this specific field ID. Otherwise, data for all fields in the farm will be collected.
 * @returns A promise that resolves with an array of `FieldInput` objects containing only the field-specific input data.
 * @throws {Error} - Throws an error if data collection or processing fails.
 *
 * @alpha
 */
async function collectInputForNitrogenBalanceForFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
    timeframe: Timeframe,
    b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<FieldInput[]> {
    try {
        // Collect the fields for the farm
        return await fdm.transaction(async (tx: typeof fdm) => {
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

            // Set the link to location of FDM public data
            const fdmPublicDataUrl = getFdmPublicDataUrl()

            // Fetch all deposition data in a single, batched request to avoid requesting the GeoTIIF for every field
            const depositionByField =
                await calculateAllFieldsNitrogenSupplyByDeposition(
                    farmFields,
                    timeframe,
                    fdmPublicDataUrl,
                )

            // Collect the details per field
            return await Promise.all(
                farmFields.map(async (field) => {
                    // Collect the cultivations of the field
                    const cultivations = await getCultivations(
                        tx,
                        principal_id,
                        field.b_id,
                        timeframe,
                    )

                    // Collect the harvests of the cultivations
                    // Collect a promise per cultivation
                    const harvestPromises = cultivations.map(
                        async (cultivation) => {
                            return await getHarvests(
                                tx,
                                principal_id,
                                cultivation.b_lu,
                                timeframe,
                            )
                        },
                    )

                    // Wait for all, then flatten the resulting arrays into one list
                    const harvestArrays = await Promise.all(harvestPromises)
                    const harvests = harvestArrays.flat()
                    const harvestsFiltered = harvests.filter(
                        (harvest) => harvest.b_lu !== undefined,
                    )

                    // Get the soil analyses of the field
                    const soilAnalyses = await getSoilAnalyses(
                        tx,
                        principal_id,
                        field.b_id,
                        timeframe,
                    )

                    // Get the fertilizer applications of the field
                    const fertilizerApplications =
                        await getFertilizerApplications(
                            tx,
                            principal_id,
                            field.b_id,
                            timeframe,
                        )

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
        })
    } catch (error) {
        throw handleNitrogenBalanceInputCollectionError(error, b_id_farm)
    }
}

/**
 * Collects necessary input data from a FDM instance for calculating the nitrogen balance while minimizing
 * the data lookups.
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
 * **Do not** provide this if collecting input for multiple farms, it will yield an unusable input.
 * @returns A promise that resolves with an array of `NitrogenBalanceInput` objects with b_id_farm containing all the necessary data.
 * @throws {Error} - Throws an error if data collection or processing fails.
 *
 * @alpha
 */
export async function collectInputForNitrogenBalanceForFarms(
    fdm: FdmType,
    principal_id: PrincipalId,
    farmIds: fdmSchema.farmsTypeSelect["b_id_farm"][],
    timeframe: Timeframe,
    b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<(NitrogenBalanceInput & { b_id_farm: string })[]> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            // Collect the details of the cultivations
            const cultivationDetails =
                await getCultivationsFromCatalogueForFarms(
                    tx,
                    principal_id,
                    farmIds,
                )
            const fertilizerDetails = await getFertilizersFromCatalogueForFarms(
                tx,
                principal_id,
                farmIds,
            )

            return await Promise.all(
                farmIds.map(async (b_id_farm) => {
                    try {
                        const onlyFieldInput =
                            await collectInputForNitrogenBalanceForFarm(
                                tx,
                                principal_id,
                                b_id_farm,
                                timeframe,
                                b_id,
                            )

                        // Required cultivation and fertilizer details for this farm should be extracted to not break the cache
                        const cultivationIds = new Set(
                            onlyFieldInput.flatMap((input) =>
                                input.cultivations.map(
                                    (cultivation) => cultivation.b_lu_catalogue,
                                ),
                            ),
                        )
                        const cultivationDetailsForThisFarm =
                            cultivationDetails[b_id_farm]?.filter(
                                (cultivation) =>
                                    cultivationIds.has(
                                        cultivation.b_lu_catalogue,
                                    ),
                            ) ?? []

                        const fertilizerIds = new Set(
                            onlyFieldInput.flatMap((input) =>
                                input.fertilizerApplications.map(
                                    (app) => app.p_id_catalogue,
                                ),
                            ),
                        )

                        const fertilizerDetailsForThisFarm =
                            fertilizerDetails[b_id_farm]?.filter((fert) =>
                                fertilizerIds.has(fert.p_id_catalogue),
                            ) ?? []

                        return {
                            b_id_farm: b_id_farm,
                            fields: onlyFieldInput,
                            fertilizerDetails: fertilizerDetailsForThisFarm,
                            cultivationDetails: cultivationDetailsForThisFarm,
                            timeFrame: timeframe,
                        }
                    } catch (error) {
                        throw handleNitrogenBalanceInputCollectionError(
                            error,
                            b_id_farm,
                        )
                    }
                }),
            )
        })
    } catch (error) {
        throw handleNitrogenBalanceInputCollectionError(error)
    }
}

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
    return (
        await collectInputForNitrogenBalanceForFarms(
            fdm,
            principal_id,
            [b_id_farm],
            timeframe,
            b_id,
        )
    )[0]
}

export const handleNitrogenBalanceInputCollectionError =
    handleInputCollectionError(
        "Failed to collect nitrogen balance input for farm",
        "Failed to collect nitrogen balance input",
    )
