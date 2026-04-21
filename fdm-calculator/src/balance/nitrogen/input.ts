import type {
    FdmType,
    fdmSchema,
    PrincipalId,
    Timeframe,
} from "@nmi-agro/fdm-core"
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
import { getFdmPublicDataUrl } from "../../shared/public-data-url"
import Decimal from "decimal.js"
import { handleInputCollectionError } from "../shared/errors"
import { calculateAllFieldsNitrogenSupplyByDeposition } from "./supply/deposition"
import type { FieldInput, NitrogenBalanceInput } from "./types"

type FieldInputWithoutDeposition = Omit<FieldInput, "depositionSupply">

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
        // Step 1: Fetch all DB data in a single transaction
        const dbResult: {
            farmFields: Awaited<ReturnType<typeof getFields>>
            fieldData: FieldInputWithoutDeposition[]
        } = await fdm.transaction(async (tx: typeof fdm) => {
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

            if (b_id) {
                // Single-field path
                const field = farmFields[0]
                const cultivations = await getCultivations(
                    tx,
                    principal_id,
                    field.b_id,
                    timeframe,
                )

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
                const harvestArrays = await Promise.all(harvestPromises)
                const harvests = harvestArrays.flat()
                const harvestsFiltered = harvests.filter(
                    (harvest) => harvest.b_lu !== undefined,
                )

                const soilAnalyses = await getSoilAnalyses(
                    tx,
                    principal_id,
                    field.b_id,
                    timeframe,
                )

                const fertilizerApplications =
                    await getFertilizerApplications(
                        tx,
                        principal_id,
                        field.b_id,
                        timeframe,
                    )

                return {
                    farmFields,
                    fieldData: [
                        {
                            field,
                            cultivations,
                            harvests: harvestsFiltered,
                            fertilizerApplications,
                            soilAnalyses,
                        },
                    ],
                }
            }

            // Farm-level path: fetch all data per farm in parallel
            const [
                cultivationsByField,
                soilByField,
                fertAppsByField,
                harvestsByField,
            ] = await Promise.all([
                getCultivationsForFarm(tx, principal_id, b_id_farm, timeframe),
                getSoilAnalysesForFarm(tx, principal_id, b_id_farm, timeframe),
                getFertilizerApplicationsForFarm(
                    tx,
                    principal_id,
                    b_id_farm,
                    timeframe,
                ),
                getHarvestsForFarm(tx, principal_id, b_id_farm, timeframe),
            ])

            return {
                farmFields,
                fieldData: farmFields.map((field) => {
                    const cultivations =
                        cultivationsByField.get(field.b_id) ?? []
                    const harvests = cultivations.flatMap(
                        (c) => harvestsByField.get(c.b_lu) ?? [],
                    )
                    return {
                        field,
                        cultivations,
                        harvests,
                        fertilizerApplications:
                            fertAppsByField.get(field.b_id) ?? [],
                        soilAnalyses: soilByField.get(field.b_id) ?? [],
                    }
                }),
            }
        })

        // Step 2: Fetch deposition data OUTSIDE the transaction.
        // This is pure HTTP + in-memory raster reads (no DB needed),
        // so holding a DB connection idle during this phase is wasteful.
        const fdmPublicDataUrl = getFdmPublicDataUrl()
        const depositionByField =
            await calculateAllFieldsNitrogenSupplyByDeposition(
                dbResult.farmFields,
                timeframe,
                fdmPublicDataUrl,
            )

        // Step 3: Merge deposition into field data (pure in-memory)
        return dbResult.fieldData.map(
            (entry): FieldInput => ({
                ...entry,
                depositionSupply: depositionByField.get(
                    entry.field.b_id,
                ) ?? { total: new Decimal(0) },
            }),
        )
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
 * across multiple farms and a timeframe. It fetches data from the FDM database and structures
 * it into an array of `NitrogenBalanceInput` objects.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The ID of the principal (user or service) initiating the data collection.
 * @param farmIds - The IDs of the farms for which to collect the nitrogen balance input.
 * @param timeframe - The timeframe for which to collect the data.
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
): Promise<(NitrogenBalanceInput & { b_id_farm: string })[]> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const uniqueFarmIds = [...new Set(farmIds)]

            // Step 1: Get enabled catalogue sources for all farms
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
                ...new Set(Object.values(farmCultivationCatalogues).flat()),
            ]
            const uniqueFertilizerSources = [
                ...new Set(Object.values(farmFertilizerCatalogues).flat()),
            ]
            const [allCultivations, allFertilizers] = await Promise.all([
                getCultivationsFromCatalogues(tx, uniqueCultivationSources),
                getFertilizersFromCatalogues(
                    tx,
                    principal_id,
                    uniqueFertilizerSources,
                ),
            ])

            // Step 3: Process each farm using the pre-fetched catalogue data
            const farmSettled = await Promise.allSettled(
                uniqueFarmIds.map(async (b_id_farm) => {
                    const onlyFieldInput =
                        await collectInputForNitrogenBalanceForFarm(
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
                    const fertilizerDetailsForThisFarm = allFertilizers.filter(
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
                            handleNitrogenBalanceInputCollectionError(
                                result.reason,
                            ).message,
                        )
                        return false
                    }
                    return true
                })
                .map(
                    (result) =>
                        (
                            result as PromiseFulfilledResult<
                                NitrogenBalanceInput & { b_id_farm: string }
                            >
                        ).value,
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
            const fields = await collectInputForNitrogenBalanceForFarm(
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
        throw handleNitrogenBalanceInputCollectionError(error)
    }
}

export const handleNitrogenBalanceInputCollectionError =
    handleInputCollectionError(
        "Failed to collect nitrogen balance input for farm",
        "Failed to collect nitrogen balance input",
    )
