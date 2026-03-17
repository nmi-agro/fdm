import type {
    FdmType,
    fdmSchema,
    PrincipalId,
    Timeframe,
} from "@nmi-agro/fdm-core"
import {
    getCultivations,
    getCultivationsFromCatalogue,
    getCultivationsOfFarmsFromCatalogue,
    getFertilizerApplications,
    getFertilizers,
    getField,
    getFields,
    getHarvests,
    getSoilAnalyses,
} from "@nmi-agro/fdm-core"
import { getFdmPublicDataUrl } from "../../shared/public-data-url"
import { calculateAllFieldsNitrogenSupplyByDeposition } from "./supply/deposition"
import type {
    FieldInput,
    NitrogenBalanceFieldInput,
    NitrogenBalanceInput,
} from "./types"

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
 * @returns A promise that resolves with an array of `FieldInput` objects containing only the field-specific input data.
 * @throws {Error} - Throws an error if data collection or processing fails.
 *
 * @alpha
 */
export async function collectOnlyFieldInputForNitrogenBalance(
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
                        timeframe: timeframe,
                    }
                }),
            )
        })
    } catch (error) {
        throw new Error(
            `Failed to collect field nitrogen balance input for farm ${b_id_farm}: ${
                error instanceof Error ? error.message : String(error)
            }`,
            { cause: error },
        )
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
 * @returns A promise that resolves with a `NitrogenBalanceInput` object containing all the necessary data.
 * @throws {Error} - Throws an error if data collection or processing fails.
 *
 * @alpha
 */
export async function collectInputForNitrogenBalanceForFarms(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
    timeframe: Timeframe,
    b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<NitrogenBalanceInput> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const onlyFieldInput =
                await collectOnlyFieldInputForNitrogenBalance(
                    fdm,
                    principal_id,
                    b_id_farm,
                    timeframe,
                    b_id,
                )
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

            return {
                fields: onlyFieldInput,
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
 * @param farmIds - The IDs of the farms for which to collect the nitrogen balance input.
 * @param timeframe - The timeframe for which to collect the data.
 * @returns A promise that resolves with a `NitrogenBalanceInput` object containing all the necessary data.
 * @throws {Error} - Throws an error if data collection or processing fails.
 *
 * @alpha
 */
export async function collectInputForNitrogenBalance(
    fdm: FdmType,
    principal_id: PrincipalId,
    farmIds: string[],
    timeframe: Timeframe,
): Promise<(NitrogenBalanceFieldInput & { b_id_farm: string })[]> {
    try {
        if (
            timeframe.start === null ||
            typeof timeframe.start === "undefined"
        ) {
            throw new Error("Timeframe start is not defined")
        }
        if (timeframe.end === null || typeof timeframe.end === "undefined") {
            throw new Error("Timeframe end is not defined")
        }
        const myTimeframe = timeframe as { start: Date; end: Date }

        const [cultivationCatalogue, farmInputsFieldInputsOnly] =
            await Promise.all([
                getCultivationsOfFarmsFromCatalogue(fdm, principal_id, farmIds),
                Promise.all(
                    farmIds.map(async (b_id_farm) => ({
                        b_id_farm: b_id_farm,
                        fertilizerDetails: await getFertilizers(
                            fdm,
                            principal_id,
                            b_id_farm,
                        ),
                        fieldInputs:
                            await collectOnlyFieldInputForNitrogenBalance(
                                fdm,
                                principal_id,
                                b_id_farm,
                                timeframe,
                            ),
                    })),
                ),
            ] as const)

        return

        return farmInputsFieldInputsOnly.flatMap(
            ({ b_id_farm, fertilizerDetails, fieldInputs }) => {
                const b_lu_catalogues = new Set(
                    fieldInputs.flatMap((input) =>
                        input.cultivations.map(
                            (cultivation) => cultivation.b_lu_catalogue,
                        ),
                    ),
                )
                const cultivationDetails = cultivationCatalogue.filter(
                    (cultivation) =>
                        b_lu_catalogues.has(cultivation.b_lu_catalogue),
                )
                return fieldInputs.map((input) => ({
                    b_id_farm: b_id_farm,
                    fieldInput: input,
                    fertilizerDetails: fertilizerDetails,
                    cultivationDetails: cultivationDetails,
                    timeFrame: myTimeframe,
                }))
            },
        )
    } catch (error) {
        throw new Error(
            `Failed to collect nitrogen balance input for principal ${principal_id}: ${
                error instanceof Error ? error.message : String(error)
            }`,
            { cause: error },
        )
    }
}
