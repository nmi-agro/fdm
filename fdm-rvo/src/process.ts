import {
    acquiringMethodOptions,
    addCultivation,
    addField,
    type FdmType,
    getDefaultDatesOfCultivation,
    removeCultivation,
    removeField,
    updateField,
} from "@nmi-agro/fdm-core"
import type { RvoImportReviewItem, UserChoiceMap } from "./types"
import { getItemId } from "./utils"

type AcquiringMethod = (typeof acquiringMethodOptions)[number]["value"]

function parseBufferstrip(value: string | undefined): boolean | undefined {
    if (value === "J") return true
    if (value === "N") return false
    return undefined
}

function parseAcquiringMethod(
    useTitleCode: string | undefined,
): AcquiringMethod {
    const candidate = `nl_${useTitleCode}`
    if (acquiringMethodOptions.some((opt) => opt.value === candidate)) {
        return candidate as AcquiringMethod
    }
    return "unknown"
}

/**
 * Processes the RVO import review results by applying user-selected actions.
 *
 * Iterates through the provided review items and executes the corresponding action
 * (add, update, remove) based on the `userChoices` map.
 *
 * @param fdm - The FDM client instance for database operations.
 * @param principal_id - The ID of the principal (user) performing the import.
 * @param b_id_farm - The ID of the farm the fields belong to.
 * @param rvoImportReviewData - The list of review items resulting from the comparison.
 * @param userChoices - A map where keys are item IDs and values are the chosen `ImportReviewAction`.
 * @param year - The calendar year for the import context.
 * @returns A promise that resolves when all actions have been processed.
 */
export async function processRvoImport(
    fdm: FdmType,
    principal_id: string,
    b_id_farm: string,
    rvoImportReviewData: RvoImportReviewItem<any>[],
    userChoices: UserChoiceMap,
    year: number,
    onFieldAdded?: (tx: FdmType, b_id: string, geometry: any) => Promise<void>,
) {
    for (const item of rvoImportReviewData) {
        const id = getItemId(item)
        const action = userChoices[id]

        if (!action || action === "IGNORE" || action === "NO_ACTION") {
            continue
        }

        await fdm.transaction(async (tx: FdmType) => {
            switch (action) {
                case "ADD_REMOTE":
                    if (item.rvoField) {
                        const b_bufferstrip = parseBufferstrip(
                            item.rvoField.properties.mestData?.IndBufferstrook,
                        )

                        const b_id = await addField(
                            tx,
                            principal_id,
                            b_id_farm,
                            item.rvoField.properties.CropFieldDesignator ||
                                `RVO Perceel ${item.rvoField.properties.CropFieldID}`,
                            item.rvoField.properties.CropFieldID,
                            item.rvoField.geometry,
                            new Date(item.rvoField.properties.BeginDate),
                            parseAcquiringMethod(
                                item.rvoField.properties.UseTitleCode,
                            ),
                            item.rvoField.properties.EndDate
                                ? new Date(item.rvoField.properties.EndDate)
                                : undefined,
                            b_bufferstrip,
                        )

                        // Add cultivation from RVO
                        const b_lu_catalogue = `nl_${item.rvoField.properties.CropTypeCode}`
                        const defaultDates = await getDefaultDatesOfCultivation(
                            tx,
                            principal_id,
                            b_id_farm,
                            b_lu_catalogue,
                            year,
                        )

                        await addCultivation(
                            tx,
                            principal_id,
                            b_lu_catalogue,
                            b_id,
                            defaultDates.b_lu_start,
                            defaultDates.b_lu_end,
                        )

                        if (onFieldAdded) {
                            await onFieldAdded(tx, b_id, item.rvoField.geometry)
                        }
                    }
                    break
                case "UPDATE_FROM_REMOTE":
                    if (item.localField && item.rvoField) {
                        const b_bufferstrip = parseBufferstrip(
                            item.rvoField.properties.mestData?.IndBufferstrook,
                        )

                        await updateField(
                            tx,
                            principal_id,
                            item.localField.b_id,
                            item.rvoField.properties.CropFieldDesignator ||
                                item.localField.b_name,
                            item.rvoField.properties.CropFieldID,
                            item.rvoField.geometry,
                            new Date(item.rvoField.properties.BeginDate),
                            parseAcquiringMethod(
                                item.rvoField.properties.UseTitleCode,
                            ),
                            item.rvoField.properties.EndDate
                                ? new Date(item.rvoField.properties.EndDate)
                                : undefined,
                            b_bufferstrip,
                        )

                        // Update cultivation if different or add if missing
                        if (item.localCultivation) {
                            if (
                                item.localCultivation.b_lu_catalogue !==
                                `nl_${item.rvoField.properties.CropTypeCode}`
                            ) {
                                // Remove old cultivation
                                await removeCultivation(
                                    tx,
                                    principal_id,
                                    item.localCultivation.b_lu,
                                )

                                // Add new RVO cultivation
                                const b_lu_catalogue = `nl_${item.rvoField.properties.CropTypeCode}`
                                const defaultDates =
                                    await getDefaultDatesOfCultivation(
                                        tx,
                                        principal_id,
                                        b_id_farm,
                                        b_lu_catalogue,
                                        year,
                                    )

                                await addCultivation(
                                    tx,
                                    principal_id,
                                    b_lu_catalogue,
                                    item.localField.b_id,
                                    defaultDates.b_lu_start,
                                    defaultDates.b_lu_end,
                                )
                            }
                        } else {
                            // Add new RVO cultivation as it was missing locally
                            const b_lu_catalogue = `nl_${item.rvoField.properties.CropTypeCode}`
                            const defaultDates =
                                await getDefaultDatesOfCultivation(
                                    tx,
                                    principal_id,
                                    b_id_farm,
                                    b_lu_catalogue,
                                    year,
                                )

                            await addCultivation(
                                tx,
                                principal_id,
                                b_lu_catalogue,
                                item.localField.b_id,
                                defaultDates.b_lu_start,
                                defaultDates.b_lu_end,
                            )
                        }
                    }
                    break
                case "KEEP_LOCAL": // Keep Local for Conflict
                    break
                case "REMOVE_LOCAL":
                    if (item.localField) {
                        await removeField(
                            tx,
                            principal_id,
                            item.localField.b_id,
                        )
                    }
                    break
                case "CLOSE_LOCAL":
                    if (item.localField) {
                        // Close the field on Dec 31st of the previous year
                        const closeDate = new Date(year - 1, 11, 31)
                        await updateField(
                            tx,
                            principal_id,
                            item.localField.b_id,
                            item.localField.b_name,
                            item.localField.b_id_source,
                            item.localField.b_geometry,
                            item.localField.b_start instanceof Date
                                ? item.localField.b_start
                                : new Date(item.localField.b_start),
                            item.localField.b_acquiring_method,
                            closeDate,
                        )
                    }
                    break
            }
        })
    }
}
