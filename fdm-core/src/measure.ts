import {
    and,
    asc,
    desc,
    eq,
    gte,
    isNotNull,
    isNull,
    lte,
    or,
    type SQL,
} from "drizzle-orm"
import { checkPermission } from "./authorization"
import type { PrincipalId } from "./authorization.types"
import type { Measure, MeasureCatalogue } from "./measure.types"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import { createId } from "./id"
import type { Timeframe } from "./timeframe"

/**
 * Creates a measure instance and applies it to a field in a single transaction.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id The ID of the field to apply the measure to.
 * @param m_id The catalogue ID of the measure (e.g. "bln_BM1").
 * @param m_start The start date of the measure.
 * @param m_end The optional end date. Omit or pass undefined for doorlopend (ongoing).
 * @returns A Promise resolving to the new `b_id_measure`.
 */
export async function addMeasure(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.fieldsTypeSelect["b_id"],
    m_id: schema.measuresCatalogueTypeSelect["m_id"],
    m_start: Date,
    m_end?: Date,
): Promise<string> {
    try {
        await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            principal_id,
            "addMeasure",
        )
        const b_id_measure = createId()
        await fdm.transaction(async (tx) => {
            await tx
                .insert(schema.measures)
                .values({ b_id_measure, m_id })
            await tx.insert(schema.measureAdopting).values({
                b_id,
                b_id_measure,
                m_start,
                m_end: m_end ?? null,
            })
        })
        return b_id_measure
    } catch (err) {
        throw handleError(err, "Exception for addMeasure", {
            b_id,
            m_id,
            m_start,
            m_end,
        })
    }
}

/**
 * Fetches a single measure (joined with catalogue data) by its instance ID.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_measure The instance ID of the measure.
 * @returns A Promise resolving to the {@link Measure}.
 */
export async function getMeasure(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_measure: schema.measuresTypeSelect["b_id_measure"],
): Promise<Measure> {
    try {
        // Resolve b_id for permission check
        const applying = await fdm
            .select({ b_id: schema.measureAdopting.b_id })
            .from(schema.measureAdopting)
            .where(eq(schema.measureAdopting.b_id_measure, b_id_measure))
            .limit(1)

        if (applying.length === 0) {
            throw new Error("Measure does not exist")
        }

        await checkPermission(
            fdm,
            "field",
            "read",
            applying[0].b_id,
            principal_id,
            "getMeasure",
        )

        const rows = await fdm
            .select({
                b_id_measure: schema.measures.b_id_measure,
                m_id: schema.measuresCatalogue.m_id,
                b_id: schema.measureAdopting.b_id,
                m_start: schema.measureAdopting.m_start,
                m_end: schema.measureAdopting.m_end,
                m_name: schema.measuresCatalogue.m_name,
                m_summary: schema.measuresCatalogue.m_summary,
                m_conflicts: schema.measuresCatalogue.m_conflicts,
            })
            .from(schema.measures)
            .innerJoin(
                schema.measureAdopting,
                eq(
                    schema.measureAdopting.b_id_measure,
                    schema.measures.b_id_measure,
                ),
            )
            .innerJoin(
                schema.measuresCatalogue,
                eq(schema.measures.m_id, schema.measuresCatalogue.m_id),
            )
            .where(eq(schema.measures.b_id_measure, b_id_measure))
            .limit(1)

        if (rows.length === 0) {
            throw new Error("Measure does not exist")
        }

        return rows[0] as Measure
    } catch (err) {
        throw handleError(err, "Exception for getMeasure", { b_id_measure })
    }
}

/**
 * Fetches all measures applied to a specific field, optionally filtered by timeframe.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id The field ID.
 * @param timeframe Optional timeframe to filter measures (overlap logic).
 * @returns A Promise resolving to an array of {@link Measure}.
 */
export async function getMeasures(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: schema.fieldsTypeSelect["b_id"],
    timeframe?: Timeframe,
): Promise<Measure[]> {
    try {
        await checkPermission(
            fdm,
            "field",
            "read",
            b_id,
            principal_id,
            "getMeasures",
        )

        const timeframeCondition = buildMeasureTimeframeCondition(timeframe)

        const rows = await fdm
            .select({
                b_id_measure: schema.measures.b_id_measure,
                m_id: schema.measuresCatalogue.m_id,
                b_id: schema.measureAdopting.b_id,
                m_start: schema.measureAdopting.m_start,
                m_end: schema.measureAdopting.m_end,
                m_name: schema.measuresCatalogue.m_name,
                m_summary: schema.measuresCatalogue.m_summary,
                m_conflicts: schema.measuresCatalogue.m_conflicts,
            })
            .from(schema.measures)
            .innerJoin(
                schema.measureAdopting,
                eq(
                    schema.measureAdopting.b_id_measure,
                    schema.measures.b_id_measure,
                ),
            )
            .innerJoin(
                schema.measuresCatalogue,
                eq(schema.measures.m_id, schema.measuresCatalogue.m_id),
            )
            .where(
                timeframeCondition
                    ? and(
                          eq(schema.measureAdopting.b_id, b_id),
                          timeframeCondition,
                      )
                    : eq(schema.measureAdopting.b_id, b_id),
            )
            .orderBy(
                desc(schema.measureAdopting.m_start),
                asc(schema.measuresCatalogue.m_name),
            )

        return rows as Measure[]
    } catch (err) {
        throw handleError(err, "Exception for getMeasures", { b_id })
    }
}

/**
 * Fetches measures for all fields in a farm. Returns a Map keyed by `b_id`.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The farm ID.
 * @param timeframe Optional timeframe to filter measures.
 * @returns A Promise resolving to a `Map<b_id, Measure[]>`.
 */
export async function getMeasuresForFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
    timeframe?: Timeframe,
): Promise<Map<string, Measure[]>> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getMeasuresForFarm",
        )

        const timeframeCondition = buildMeasureTimeframeCondition(timeframe)

        const rows = await fdm
            .select({
                b_id_measure: schema.measures.b_id_measure,
                m_id: schema.measuresCatalogue.m_id,
                b_id: schema.measureAdopting.b_id,
                m_start: schema.measureAdopting.m_start,
                m_end: schema.measureAdopting.m_end,
                m_name: schema.measuresCatalogue.m_name,
                m_summary: schema.measuresCatalogue.m_summary,
                m_conflicts: schema.measuresCatalogue.m_conflicts,
            })
            .from(schema.measures)
            .innerJoin(
                schema.measureAdopting,
                eq(
                    schema.measureAdopting.b_id_measure,
                    schema.measures.b_id_measure,
                ),
            )
            .innerJoin(
                schema.measuresCatalogue,
                eq(schema.measures.m_id, schema.measuresCatalogue.m_id),
            )
            .innerJoin(
                schema.fieldAcquiring,
                eq(schema.fieldAcquiring.b_id, schema.measureAdopting.b_id),
            )
            .where(
                timeframeCondition
                    ? and(
                          eq(
                              schema.fieldAcquiring.b_id_farm,
                              b_id_farm,
                          ),
                          timeframeCondition,
                      )
                    : eq(schema.fieldAcquiring.b_id_farm, b_id_farm),
            )
            .orderBy(
                desc(schema.measureAdopting.m_start),
                asc(schema.measuresCatalogue.m_name),
            )

        const result = new Map<string, Measure[]>()
        for (const row of rows) {
            if (!row.b_id) continue
            const existing = result.get(row.b_id)
            if (existing) {
                existing.push(row as Measure)
            } else {
                result.set(row.b_id, [row as Measure])
            }
        }
        return result
    } catch (err) {
        throw handleError(err, "Exception for getMeasuresForFarm", {
            b_id_farm,
        })
    }
}

/**
 * Returns all available entries from the `measures_catalogue` table.
 *
 * No permission check is performed — the catalogue is not per-user data.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @returns A Promise resolving to an array of {@link MeasureCatalogue}.
 */
export async function getMeasuresFromCatalogue(
    fdm: FdmType,
): Promise<MeasureCatalogue[]> {
    try {
        return fdm
            .select({
                m_id: schema.measuresCatalogue.m_id,
                m_source: schema.measuresCatalogue.m_source,
                m_name: schema.measuresCatalogue.m_name,
                m_description: schema.measuresCatalogue.m_description,
                m_summary: schema.measuresCatalogue.m_summary,
                m_source_url: schema.measuresCatalogue.m_source_url,
                m_conflicts: schema.measuresCatalogue.m_conflicts,
            })
            .from(schema.measuresCatalogue)
            .orderBy(
                asc(schema.measuresCatalogue.m_source),
                asc(schema.measuresCatalogue.m_name),
            )
    } catch (err) {
        throw handleError(err, "Exception for getMeasuresFromCatalogue", {})
    }
}

/**
 * Updates the start and/or end date of an existing measure.
 * Pass `m_end = null` to clear the end date (doorlopend).
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_measure The instance ID of the measure.
 * @param m_start Optional new start date.
 * @param m_end Optional new end date. Pass `null` to clear it (doorlopend).
 */
export async function updateMeasure(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_measure: schema.measuresTypeSelect["b_id_measure"],
    m_start?: Date,
    m_end?: Date | null,
): Promise<void> {
    try {
        const applying = await fdm
            .select({ b_id: schema.measureAdopting.b_id })
            .from(schema.measureAdopting)
            .where(eq(schema.measureAdopting.b_id_measure, b_id_measure))
            .limit(1)

        if (applying.length === 0) {
            throw new Error("Measure does not exist")
        }

        await checkPermission(
            fdm,
            "field",
            "write",
            applying[0].b_id,
            principal_id,
            "updateMeasure",
        )

        const updates: Partial<schema.measureAdoptingTypeInsert> = {
            updated: new Date(),
        }
        if (m_start !== undefined) updates.m_start = m_start
        if (m_end !== undefined) updates.m_end = m_end

        await fdm
            .update(schema.measureAdopting)
            .set(updates)
            .where(eq(schema.measureAdopting.b_id_measure, b_id_measure))
    } catch (err) {
        throw handleError(err, "Exception for updateMeasure", {
            b_id_measure,
            m_start,
            m_end,
        })
    }
}

/**
 * Deletes a measure instance and its `measure_adopting` row.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_measure The instance ID of the measure to remove.
 */
export async function removeMeasure(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_measure: schema.measuresTypeSelect["b_id_measure"],
): Promise<void> {
    try {
        const applying = await fdm
            .select({ b_id: schema.measureAdopting.b_id })
            .from(schema.measureAdopting)
            .where(eq(schema.measureAdopting.b_id_measure, b_id_measure))
            .limit(1)

        if (applying.length === 0) {
            throw new Error("Measure does not exist")
        }

        await checkPermission(
            fdm,
            "field",
            "write",
            applying[0].b_id,
            principal_id,
            "removeMeasure",
        )

        await fdm.transaction(async (tx) => {
            await tx
                .delete(schema.measureAdopting)
                .where(
                    eq(schema.measureAdopting.b_id_measure, b_id_measure),
                )
            await tx
                .delete(schema.measures)
                .where(eq(schema.measures.b_id_measure, b_id_measure))
        })
    } catch (err) {
        throw handleError(err, "Exception for removeMeasure", { b_id_measure })
    }
}

/**
 * Builds a SQL condition for filtering measures based on a timeframe overlap.
 *
 * A measure overlaps a timeframe if:
 * 1. It has an end date AND (starts within, ends within, or spans the timeframe)
 * 2. It has no end date (doorlopend) AND its start is on or before the timeframe's end
 *
 * @param timeframe An object with optional `start` and `end` Date properties.
 * @returns A Drizzle-ORM SQL condition, or `undefined` if the timeframe is not provided.
 */
export const buildMeasureTimeframeCondition = (
    timeframe: Timeframe | undefined,
): SQL | undefined => {
    if (!timeframe?.start || !timeframe?.end) {
        return undefined
    }

    return or(
        // Case 1: Measure has an end date and overlaps with the timeframe
        and(
            isNotNull(schema.measureAdopting.m_end),
            or(
                // Measure starts within the timeframe
                and(
                    gte(schema.measureAdopting.m_start, timeframe.start),
                    lte(schema.measureAdopting.m_start, timeframe.end),
                ),
                // Measure ends within the timeframe
                and(
                    gte(schema.measureAdopting.m_end, timeframe.start),
                    lte(schema.measureAdopting.m_end, timeframe.end),
                ),
                // Measure spans the entire timeframe
                and(
                    lte(schema.measureAdopting.m_start, timeframe.start),
                    gte(schema.measureAdopting.m_end, timeframe.end),
                ),
            ),
        ),
        // Case 2: Measure has no end date and its start is on or before the timeframe's end
        and(
            isNull(schema.measureAdopting.m_end),
            lte(schema.measureAdopting.m_start, timeframe.end),
        ),
    )
}
