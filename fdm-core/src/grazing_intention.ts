import { and, eq } from "drizzle-orm"
import { checkPermission } from "./authorization"
import type { PrincipalId } from "./authorization.types"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmType } from "./fdm"

/**
 * Sets a grazing intention for a farm for a specific year.
 * This will create a new record if one does not exist, or update the existing one.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The unique identifier of the principal performing the operation.
 * @param b_id_farm Identifier of the farm.
 * @param b_grazing_intention_year The year of the grazing intention.
 * @param b_grazing_intention The grazing intention (true or false).
 * @returns A promise that resolves when the operation is complete.
 * @alpha
 */
export async function setGrazingIntention(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.intendingGrazingTypeInsert["b_id_farm"],
    b_grazing_intention_year: schema.intendingGrazingTypeInsert["b_grazing_intention_year"],
    b_grazing_intention: schema.intendingGrazingTypeInsert["b_grazing_intention"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "setGrazingIntention",
        )

        await fdm
            .insert(schema.intendingGrazing)
            .values({
                b_id_farm,
                b_grazing_intention_year: b_grazing_intention_year,
                b_grazing_intention: b_grazing_intention,
            })
            .onConflictDoUpdate({
                target: [
                    schema.intendingGrazing.b_id_farm,
                    schema.intendingGrazing.b_grazing_intention_year,
                ],
                set: {
                    b_grazing_intention: b_grazing_intention,
                    updated: new Date(),
                },
            })
    } catch (err) {
        throw handleError(err, "Exception for setGrazingIntention", {
            b_id_farm,
            b_grazing_intention_year,
            b_grazing_intention,
        })
    }
}

/**
 * Removes a grazing intention for a specific farm and year.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The unique identifier of the principal performing the operation.
 * @param b_id_farm The unique identifier of the farm.
 * @param b_grazing_intention_year The year of the grazing intention to remove.
 * @returns A promise that resolves when the grazing intention has been successfully removed.
 * @alpha
 */
export async function removeGrazingIntention(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.intendingGrazingTypeSelect["b_id_farm"],
    b_grazing_intention_year: schema.intendingGrazingTypeSelect["b_grazing_intention_year"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "removeGrazingIntention",
        )

        await fdm
            .delete(schema.intendingGrazing)
            .where(
                and(
                    eq(schema.intendingGrazing.b_id_farm, b_id_farm),
                    eq(
                        schema.intendingGrazing.b_grazing_intention_year,
                        b_grazing_intention_year,
                    ),
                ),
            )
    } catch (err) {
        throw handleError(err, "Exception for removeGrazingIntention", {
            b_id_farm,
            b_grazing_intention_year,
        })
    }
}

/**
 * Retrieves all grazing intentions for a specified farm.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The unique identifier of the farm.
 * @returns A Promise resolving to an array of grazing intention objects.
 * @alpha
 */
export async function getGrazingIntentions(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<schema.intendingGrazingTypeSelect[]> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getGrazingIntentions",
        )

        return await fdm
            .select()
            .from(schema.intendingGrazing)
            .where(eq(schema.intendingGrazing.b_id_farm, b_id_farm))
    } catch (err) {
        throw handleError(err, "Exception for getGrazingIntentions", {
            b_id_farm,
        })
    }
}

/**
 * Retrieves the grazing intention for a specific farm and year.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The unique identifier of the farm.
 * @param b_grazing_intention_year The year to retrieve the grazing intention for.
 * @returns A Promise resolving to a boolean representing the grazing intention. Returns `false` if no intention is found.
 * @alpha
 */
export async function getGrazingIntention(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
    b_grazing_intention_year: schema.intendingGrazingTypeSelect["b_grazing_intention_year"],
): Promise<boolean> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "read",
            b_id_farm,
            principal_id,
            "getGrazingIntention",
        )

        const result = await fdm
            .select({ intention: schema.intendingGrazing.b_grazing_intention })
            .from(schema.intendingGrazing)
            .where(
                and(
                    eq(schema.intendingGrazing.b_id_farm, b_id_farm),
                    eq(
                        schema.intendingGrazing.b_grazing_intention_year,
                        b_grazing_intention_year,
                    ),
                ),
            )
            .limit(1)

        return result[0]?.intention ?? false
    } catch (err) {
        throw handleError(err, "Exception for getGrazingIntention", {
            b_id_farm,
            b_grazing_intention_year,
        })
    }
}
