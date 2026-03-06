import {
    and,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    lte,
    or,
    type SQL,
    sql,
} from "drizzle-orm"
import { checkPermission } from "./authorization"
import type { PrincipalId } from "./authorization.d"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmType } from "./fdm"
import type { Field } from "./field.d"
import { createId } from "./id"
import type { Timeframe } from "./timeframe"

/**
 * Adds a new field to a farm.
 *
 * This function verifies that the principal has write permission for the specified farm,
 * generates a unique field ID, records the field details, and creates an association between
 * the field and the farm. If a discarding date is provided, the function ensures that the acquiring
 * date is earlier than the discarding date, throwing an error otherwise.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The unique identifier of the principal performing the operation.
 * @param b_id_farm - Identifier of the farm to which the field belongs.
 * @param b_name - Name of the field.
 * @param b_id_source - Identifier for the field in the source dataset.
 * @param b_geometry - GeoJSON representation of the field geometry.
 * @param b_start - The start date for managing the field.
 * @param b_acquiring_method - Method used for acquiring the field.
 * @param b_end - (Optional) The end date for managing the field.
 * @returns A promise that resolves to the newly generated field ID.
 *
 * @throws {Error} If the acquiring date is not earlier than the discarding date.
 *
 * @alpha
 */
export async function addField(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.fieldAcquiringTypeInsert["b_id_farm"],
    b_name: schema.fieldsTypeInsert["b_name"],
    b_id_source: schema.fieldsTypeInsert["b_id_source"],
    b_geometry: schema.fieldsTypeInsert["b_geometry"],
    b_start: schema.fieldAcquiringTypeInsert["b_start"],
    b_acquiring_method: schema.fieldAcquiringTypeInsert["b_acquiring_method"],
    b_end?: schema.fieldDiscardingTypeInsert["b_end"],
    b_bufferstrip?: schema.fieldsTypeInsert["b_bufferstrip"],
): Promise<schema.fieldsTypeInsert["b_id"]> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "addField",
        )

        return await fdm.transaction(async (tx: FdmType) => {
            // Generate an ID for the field
            const b_id = createId()

            // Insert field
            const fieldData = {
                b_id: b_id,
                b_name: b_name,
                b_id_source: b_id_source,
                b_geometry: b_geometry,
                b_bufferstrip: b_bufferstrip ?? false,
            }
            await tx.insert(schema.fields).values(fieldData)

            // Validate b_acquiring_method is of the possible options, otherwise log an warning and insert 'unknown'
            if (
                b_acquiring_method &&
                !schema.acquiringMethodOptions
                    .map((option) => option.value)
                    .includes(b_acquiring_method)
            ) {
                console.warn(
                    `Invalid b_acquiring_method: ${b_acquiring_method}. Inserting as 'unknown'.`,
                )
                b_acquiring_method = "unknown"
            }

            // Insert relation between farm and field
            const fieldAcquiringData = {
                b_id,
                b_id_farm,
                b_start,
                b_acquiring_method,
            }
            await tx.insert(schema.fieldAcquiring).values(fieldAcquiringData)

            // Check that acquire date is before discarding date
            if (b_end && b_start && b_start.getTime() >= b_end.getTime()) {
                throw new Error("Acquiring date must be before discarding date")
            }

            // Insert relation between field and discarding
            const fieldDiscardingData = {
                b_id,
                b_end,
            }
            await tx.insert(schema.fieldDiscarding).values(fieldDiscardingData)

            // If buffer status is not provided try to determine
            if (b_bufferstrip === undefined) {
                const field = await tx
                    .select({
                        b_id: schema.fields.b_id,
                        b_name: schema.fields.b_name,
                        b_geometry: schema.fields.b_geometry,
                        b_area: sql<number>`ROUND((ST_Area(b_geometry::geography)/10000)::NUMERIC, 2)::FLOAT`,
                        b_perimeter: sql<number>`ROUND((ST_Length(ST_ExteriorRing(b_geometry)::geography))::NUMERIC, 2)::FLOAT`,
                    })
                    .from(schema.fields)
                    .where(eq(schema.fields.b_id, b_id))
                    .limit(1)

                if (field.length > 0) {
                    const isBuffer = determineIfFieldIsBuffer(
                        field[0].b_area,
                        field[0].b_perimeter,
                        field[0].b_name,
                    )

                    await tx
                        .update(schema.fields)
                        .set({ b_bufferstrip: isBuffer })
                        .where(eq(schema.fields.b_id, b_id))
                }
            }

            return b_id
        })
    } catch (err) {
        throw handleError(err, "Exception for addField", {
            b_id_farm,
            b_name,
            b_id_source,
            // b_geometry,
            b_start,
            b_acquiring_method,
            b_end,
            b_bufferstrip,
        })
    }
}

/**
 * Retrieves detailed information for a specific field.
 *
 * This function verifies that the principal identified by `principal_id` has permission to read the field,
 * then fetches and returns the field's properties including its geometry, area, acquisition, and related timestamps.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal making the request.
 * @param b_id - The unique identifier of the field to retrieve.
 *
 * @returns A promise that resolves with the field details.
 *
 * @alpha
 */
export async function getField(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.fieldsTypeSelect["b_id"],
): Promise<Field> {
    try {
        await checkPermission(
            fdm,
            "field",
            "read",
            b_id,
            principal_id,
            "getField",
        )

        // Get properties of the requested field
        const field = await fdm
            .select({
                b_id: schema.fields.b_id,
                b_name: schema.fields.b_name,
                b_id_farm: schema.fieldAcquiring.b_id_farm,
                b_id_source: schema.fields.b_id_source,
                b_geometry: schema.fields.b_geometry,
                b_bufferstrip: schema.fields.b_bufferstrip,
                b_centroid_x: sql<number>`ST_X(ST_Centroid(b_geometry))`,
                b_centroid_y: sql<number>`ST_Y(ST_Centroid(b_geometry))`,
                b_area: sql<number>`ROUND((ST_Area(b_geometry::geography)/10000)::NUMERIC, 2)::FLOAT`,
                b_perimeter: sql<number>`ROUND((ST_Length(ST_ExteriorRing(b_geometry)::geography))::NUMERIC, 2)::FLOAT`,
                b_start: schema.fieldAcquiring.b_start,
                b_end: schema.fieldDiscarding.b_end,
                b_acquiring_method: schema.fieldAcquiring.b_acquiring_method,
            })
            .from(schema.fields)
            .innerJoin(
                schema.fieldAcquiring,
                eq(schema.fields.b_id, schema.fieldAcquiring.b_id),
            )
            .leftJoin(
                schema.fieldDiscarding,
                eq(schema.fields.b_id, schema.fieldDiscarding.b_id),
            )
            .where(eq(schema.fields.b_id, b_id))
            .limit(1)

        // Process the centroid string into a tuple
        field[0].b_centroid = [field[0].b_centroid_x, field[0].b_centroid_y]
        field[0].b_centroid_x = undefined
        field[0].b_centroid_y = undefined

        return field[0]
    } catch (err) {
        throw handleError(err, "Exception for getField", { b_id })
    }
}

/**
 * Retrieves all fields associated with a specified farm.
 *
 * This function first verifies that the requesting principal has read access to the farm, then
 * returns an array of field detail objects. Each object includes the field's identifier, name,
 * source, geometry, area, acquiring and discarding dates, as well as the creation and update timestamps.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The ID of the principal making the request.
 * @param b_id_farm - The unique identifier of the farm.
 * @param timeframe - Optional timeframe to filter fields by start and end dates.
 * @returns A Promise resolving to an array of field detail objects.
 *
 * @alpha
 */
export async function getFields(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
    timeframe?: Timeframe,
): Promise<Field[]> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getFields",
        )

        let whereClause: SQL | undefined

        if (timeframe?.start && timeframe.end) {
            whereClause = and(
                eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
                and(
                    // Check if the acquiring date is within the timeframe
                    lte(schema.fieldAcquiring.b_start, timeframe.end),
                ),
                // Check if there is a discarding date and if it is within the timeframe
                or(
                    isNull(schema.fieldDiscarding.b_end),
                    and(
                        isNotNull(schema.fieldDiscarding.b_end),
                        gte(schema.fieldDiscarding.b_end, timeframe.start),
                    ),
                ),
            )
        } else if (timeframe?.start) {
            whereClause = and(
                eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
                or(
                    isNull(schema.fieldDiscarding.b_end),
                    and(
                        isNotNull(schema.fieldDiscarding.b_end),
                        gte(schema.fieldDiscarding.b_end, timeframe.start),
                    ),
                ),
            )
        } else if (timeframe?.end) {
            whereClause = and(
                eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
                lte(schema.fieldAcquiring.b_start, timeframe.end),
            )
        } else {
            whereClause = eq(schema.fieldAcquiring.b_id_farm, b_id_farm)
        }

        // Get properties of the requested field
        const fields = await fdm
            .select({
                b_id: schema.fields.b_id,
                b_name: schema.fields.b_name,
                b_id_farm: schema.fieldAcquiring.b_id_farm,
                b_id_source: schema.fields.b_id_source,
                b_geometry: schema.fields.b_geometry,
                b_bufferstrip: schema.fields.b_bufferstrip,
                b_centroid_x: sql<number>`ST_X(ST_Centroid(b_geometry))`,
                b_centroid_y: sql<number>`ST_Y(ST_Centroid(b_geometry))`,
                b_area: sql<number>`ROUND((ST_Area(b_geometry::geography)/10000)::NUMERIC, 2)::FLOAT`,
                b_perimeter: sql<number>`ROUND((ST_Length(ST_ExteriorRing(b_geometry)::geography))::NUMERIC, 2)::FLOAT`,
                b_start: schema.fieldAcquiring.b_start,
                b_acquiring_method: schema.fieldAcquiring.b_acquiring_method,
                b_end: schema.fieldDiscarding.b_end,
            })
            .from(schema.fields)
            .innerJoin(
                schema.fieldAcquiring,
                eq(schema.fields.b_id, schema.fieldAcquiring.b_id),
            )
            .leftJoin(
                schema.fieldDiscarding,
                eq(schema.fields.b_id, schema.fieldDiscarding.b_id),
            )
            .where(whereClause)
            .orderBy(desc(sql<number>`ST_Area(b_geometry::geography)`))

        // Process the centroids into a tuple
        for (const field of fields) {
            field.b_centroid = [field.b_centroid_x, field.b_centroid_y]
            field.b_centroid_x = undefined
            field.b_centroid_y = undefined
        }

        return fields
    } catch (err) {
        throw handleError(err, "Exception for getFields", { b_id_farm })
    }
}

/**
 * Updates the details of an existing field.
 *
 * This function applies updates to the field's basic information and its associated acquiring and discarding records.
 * It performs a permission check to ensure the principal has write access and validates that the acquiring date is earlier than the discarding date, when applicable.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal performing the update.
 * @param b_id - The unique identifier of the field to update.
 * @param b_name - (Optional) New name for the field.
 * @param b_id_source - (Optional) New source identifier for the field.
 * @param b_geometry - (Optional) Updated field geometry in GeoJSON format.
 * @param b_start - (Optional) Updated start date for managing the field.
 * @param b_acquiring_method - (Optional) Updated method for field management.
 * @param b_end - (Optional) Updated end date for managing the field.
 * @returns A Promise that resolves to the updated field details.
 *
 * @throws {Error} If the acquiring date is not before the discarding date.
 * @alpha
 */
export async function updateField(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.fieldsTypeInsert["b_id"],
    b_name?: schema.fieldsTypeInsert["b_name"],
    b_id_source?: schema.fieldsTypeInsert["b_id_source"],
    b_geometry?: schema.fieldsTypeInsert["b_geometry"],
    b_start?: schema.fieldAcquiringTypeInsert["b_start"],
    b_acquiring_method?: schema.fieldAcquiringTypeInsert["b_acquiring_method"],
    b_end?: schema.fieldDiscardingTypeInsert["b_end"],
    b_bufferstrip?: schema.fieldsTypeInsert["b_bufferstrip"],
): Promise<Field> {
    return await fdm.transaction(async (tx: FdmType) => {
        try {
            await checkPermission(
                fdm,
                "field",
                "write",
                b_id,
                principal_id,
                "updateField",
            )

            const updated = new Date()

            const setFields: Partial<schema.fieldsTypeInsert> = {}
            if (b_name !== undefined) {
                setFields.b_name = b_name
            }
            if (b_id_source !== undefined) {
                setFields.b_id_source = b_id_source
            }
            if (b_geometry !== undefined) {
                setFields.b_geometry = b_geometry
            }
            if (b_bufferstrip !== undefined) {
                setFields.b_bufferstrip = b_bufferstrip
            }
            setFields.updated = updated

            await tx
                .update(schema.fields)
                .set(setFields)
                .where(eq(schema.fields.b_id, b_id))

            const setfieldAcquiring: Partial<schema.fieldAcquiringTypeInsert> =
                {}
            if (b_start !== undefined) {
                setfieldAcquiring.b_start = b_start
            }
            if (b_acquiring_method !== undefined) {
                setfieldAcquiring.b_acquiring_method = b_acquiring_method
            }
            setfieldAcquiring.updated = updated

            const setfieldDiscarding: Partial<schema.fieldDiscardingTypeInsert> =
                {}
            if (b_end !== undefined) {
                setfieldDiscarding.b_end = b_end
            }
            setfieldDiscarding.updated = updated

            await tx
                .update(schema.fieldAcquiring)
                .set(setfieldAcquiring)
                .where(eq(schema.fieldAcquiring.b_id, b_id))

            await tx
                .update(schema.fieldDiscarding)
                .set(setfieldDiscarding)
                .where(eq(schema.fieldDiscarding.b_id, b_id))

            const result = await tx
                .select({
                    b_id: schema.fields.b_id,
                    b_name: schema.fields.b_name,
                    b_id_farm: schema.fieldAcquiring.b_id_farm,
                    b_id_source: schema.fields.b_id_source,
                    b_geometry: schema.fields.b_geometry,
                    b_bufferstrip: schema.fields.b_bufferstrip,
                    b_start: schema.fieldAcquiring.b_start,
                    b_acquiring_method:
                        schema.fieldAcquiring.b_acquiring_method,
                    b_end: schema.fieldDiscarding.b_end,
                    created: schema.fields.created,
                    updated: schema.fields.updated,
                })
                .from(schema.fields)
                .innerJoin(
                    schema.fieldAcquiring,
                    eq(schema.fields.b_id, schema.fieldAcquiring.b_id),
                )
                .leftJoin(
                    schema.fieldDiscarding,
                    eq(schema.fields.b_id, schema.fieldDiscarding.b_id),
                )
                .where(eq(schema.fields.b_id, b_id))
                .limit(1)
            const field = result[0] as unknown as Field

            // Check if acquiring date is before discarding date
            if (
                field.b_end &&
                field.b_start &&
                field.b_start.getTime() >= field.b_end.getTime()
            ) {
                throw new Error("Acquiring date must be before discarding date")
            }

            return field
        } catch (err) {
            throw handleError(err, "Exception for updateField", {
                b_id,
                b_name,
                b_id_source,
                // b_geometry,
                b_start,
                b_acquiring_method,
                b_end,
            })
        }
    })
}

/**
 * Removes a field and all its associated data.
 *
 * This function checks if the principal has permission to delete the field, then proceeds to delete
 * the field and all cascading data, including acquiring and discarding information, cultivations,
 * fertilizer applications, soil analyses, and harvests.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The unique identifier of the principal performing the operation.
 * @param b_id - The unique identifier of the field to be removed.
 * @returns A promise that resolves when the field has been successfully removed.
 *
 * @throws {Error} If the principal does not have permission to delete the field.
 *
 * @alpha
 */
export async function removeField(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.fieldsTypeSelect["b_id"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            principal_id,
            "removeField",
        )

        await fdm.transaction(async (tx: FdmType) => {
            // Step 1: Get all cultivation IDs for the given field
            const cultivations = await tx
                .select({ b_lu: schema.cultivationStarting.b_lu })
                .from(schema.cultivationStarting)
                .where(eq(schema.cultivationStarting.b_id, b_id))

            if (cultivations.length > 0) {
                const cultivationIds = cultivations.map(
                    (c: { b_lu: schema.cultivationsTypeSelect["b_lu"] }) =>
                        c.b_lu,
                )

                // Step 2: Get all harvestable IDs from these cultivations
                const harvestings = await tx
                    .select({
                        b_id_harvestable:
                            schema.cultivationHarvesting.b_id_harvestable,
                    })
                    .from(schema.cultivationHarvesting)
                    .where(
                        inArray(
                            schema.cultivationHarvesting.b_lu,
                            cultivationIds,
                        ),
                    )

                if (harvestings.length > 0) {
                    const harvestableIds = harvestings.map(
                        (h: {
                            b_id_harvestable: schema.cultivationHarvestingTypeSelect["b_id_harvestable"]
                        }) => h.b_id_harvestable,
                    )

                    // Step 3: Get all harvestable analysis IDs from these harvestables
                    const harvestableSamplings = await tx
                        .select({
                            b_id_harvestable_analysis:
                                schema.harvestableSampling
                                    .b_id_harvestable_analysis,
                        })
                        .from(schema.harvestableSampling)
                        .where(
                            inArray(
                                schema.harvestableSampling.b_id_harvestable,
                                harvestableIds,
                            ),
                        )

                    if (harvestableSamplings.length > 0) {
                        const harvestableAnalysisIds = harvestableSamplings.map(
                            (hs: {
                                b_id_harvestable_analysis: schema.harvestableSamplingTypeSelect["b_id_harvestable_analysis"]
                            }) => hs.b_id_harvestable_analysis,
                        )

                        // Step 4: Delete from harvestable_sampling first
                        await tx
                            .delete(schema.harvestableSampling)
                            .where(
                                inArray(
                                    schema.harvestableSampling
                                        .b_id_harvestable_analysis,
                                    harvestableAnalysisIds,
                                ),
                            )

                        // Step 5: Delete from harvestable_analyses
                        await tx
                            .delete(schema.harvestableAnalyses)
                            .where(
                                inArray(
                                    schema.harvestableAnalyses
                                        .b_id_harvestable_analysis,
                                    harvestableAnalysisIds,
                                ),
                            )
                    }

                    // Step 6: Delete from cultivation_harvesting
                    await tx
                        .delete(schema.cultivationHarvesting)
                        .where(
                            inArray(
                                schema.cultivationHarvesting.b_lu,
                                cultivationIds,
                            ),
                        )

                    // Step 7: Delete from harvestables
                    await tx
                        .delete(schema.harvestables)
                        .where(
                            inArray(
                                schema.harvestables.b_id_harvestable,
                                harvestableIds,
                            ),
                        )
                }

                // Step 8: Delete from cultivation_starting, cultivation_ending and cultivations
                await tx
                    .delete(schema.cultivationStarting)
                    .where(
                        inArray(
                            schema.cultivationStarting.b_lu,
                            cultivationIds,
                        ),
                    )
                await tx
                    .delete(schema.cultivationEnding)
                    .where(
                        inArray(schema.cultivationEnding.b_lu, cultivationIds),
                    )
                await tx
                    .delete(schema.cultivations)
                    .where(inArray(schema.cultivations.b_lu, cultivationIds))
            }

            // Step 9: Get all soil analysis IDs for the field
            const soilSamplings = await tx
                .select({ a_id: schema.soilSampling.a_id })
                .from(schema.soilSampling)
                .where(eq(schema.soilSampling.b_id, b_id))

            if (soilSamplings.length > 0) {
                const soilAnalysisIds = soilSamplings.map(
                    (ss: { a_id: schema.soilAnalysisTypeSelect["a_id"] }) =>
                        ss.a_id,
                )

                // Step 10: Delete from soil_sampling first
                await tx
                    .delete(schema.soilSampling)
                    .where(inArray(schema.soilSampling.a_id, soilAnalysisIds))

                // Step 11: Delete from soil_analysis
                await tx
                    .delete(schema.soilAnalysis)
                    .where(inArray(schema.soilAnalysis.a_id, soilAnalysisIds))
            }

            // Step 12: Delete from fertilizer_applying, field_discarding, and field_acquiring
            await tx
                .delete(schema.fertilizerApplication)
                .where(eq(schema.fertilizerApplication.b_id, b_id))
            await tx
                .delete(schema.fieldDiscarding)
                .where(eq(schema.fieldDiscarding.b_id, b_id))
            await tx
                .delete(schema.fieldAcquiring)
                .where(eq(schema.fieldAcquiring.b_id, b_id))

            // Step 13: Finally, delete the field itself
            await tx.delete(schema.fields).where(eq(schema.fields.b_id, b_id))
        })
    } catch (err) {
        throw handleError(err, "Exception for removeField", { b_id })
    }
}

export function listAvailableAcquiringMethods(): {
    value: schema.fieldAcquiringTypeSelect["b_acquiring_method"]
    label: string
}[] {
    return schema.acquiringMethodOptions
}

/**
 * Determines if a field is considered a buffer based on its area, perimeter, and name.
 *
 * This function uses two heuristics to differentiate between productive fields and buffer strips:
 * 1. Shape-based: A field is classified as buffer if its area is less than 2.5 hectares and the ratio of its perimeter
 *    to the square root of its area (in square meters) is greater than or equal to a predefined constant (20).
 * 2. Name-based: A field is classified as buffer if its name contains "buffer" (case-insensitive).
 *
 * A field is considered buffer only if one of the checks pass.
 *
 * @param b_area The area of the field in hectares.
 * @param b_perimeter The perimeter of the field in meters.
 * @param b_name The name of the field.
 * @returns `true` if the field is determined to be buffer, `false` otherwise.
 * @alpha
 */
export function determineIfFieldIsBuffer(
    b_area: number,
    b_perimeter: number,
    b_name: schema.fieldsTypeSelect["b_name"],
) {
    if (!b_area || b_area <= 0 || !b_perimeter || b_perimeter <= 0) {
        return (b_name ?? "").toLowerCase().includes("buffer")
    }

    // Sven found that a ratio for a field with Perimeter (m) / SQRT(Area (m^2)) usually differentiates buffferstrips from "normal"  fields when the ratio is larger than 20 and area smaller than 2.5 ha
    const BUFFERSTROKEN_CONSTANT = 20
    const bufferAssumedByShape =
        b_perimeter / Math.sqrt(b_area * 10000) >= BUFFERSTROKEN_CONSTANT &&
        b_area < 2.5

    // Check if name contains 'buffer'
    const bufferAssumedByName = (b_name ?? "").toLowerCase().includes("buffer")

    return bufferAssumedByShape || bufferAssumedByName
}
