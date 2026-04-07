import { and, eq, inArray } from "drizzle-orm"
import { checkPermission } from "./authorization"
import type { PrincipalId } from "./authorization.types"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmType } from "./fdm.types"
import { createId } from "./id"

/**
 * Adds a new derogation for a specific farm and year.
 *
 * This function checks if the principal has 'write' permission on the farm,
 * then creates a new derogation and links it to the farm.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal creating the derogation.
 * @param b_id_farm The identifier of the farm receiving the derogation.
 * @param b_derogation_year The year for which the derogation is granted.
 * @returns The unique identifier for the new derogation.
 * @throws {Error} If the principal does not have permission to add a derogation or if the database transaction fails.
 */
export async function addDerogation(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    b_derogation_year: schema.derogationsTypeInsert["b_derogation_year"],
): Promise<schema.derogationsTypeInsert["b_id_derogation"]> {
    if (b_derogation_year < 2006 || b_derogation_year > 2025) {
        throw new Error("Derogation year must be between 2006 and 2025.")
    }
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "write",
                b_id_farm,
                principal_id,
                "addDerogation",
            )

            const existingDerogation = await tx
                .select({ id: schema.derogations.b_id_derogation })
                .from(schema.derogations)
                .leftJoin(
                    schema.derogationApplying,
                    eq(
                        schema.derogations.b_id_derogation,
                        schema.derogationApplying.b_id_derogation,
                    ),
                )
                .where(
                    and(
                        eq(schema.derogationApplying.b_id_farm, b_id_farm),
                        eq(
                            schema.derogations.b_derogation_year,
                            b_derogation_year,
                        ),
                    ),
                )
                .limit(1)

            if (existingDerogation.length > 0) {
                throw new Error(
                    "Derogation already granted for this farm and year.",
                )
            }

            const b_id_derogation = createId()
            await tx.insert(schema.derogations).values({
                b_id_derogation,
                b_derogation_year,
            })

            await tx.insert(schema.derogationApplying).values({
                b_id_farm,
                b_id_derogation,
            })

            return b_id_derogation
        })
    } catch (err) {
        throw handleError(err, "Exception for addDerogation", {
            b_id_farm,
            b_derogation_year,
        })
    }
}

/**
 * Removes a derogation.
 *
 * This function checks if the principal has 'write' permission on the associated farm,
 * then deletes the derogation and its link to the farm.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal removing the derogation.
 * @param b_id_derogation The identifier of the derogation to remove.
 * @throws {Error} If the principal does not have permission, the derogation does not exist, or the database transaction fails.
 */
export async function removeDerogation(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_derogation: schema.derogationsTypeInsert["b_id_derogation"],
): Promise<void> {
    try {
        await fdm.transaction(async (tx: FdmType) => {
            const application = await tx
                .select()
                .from(schema.derogationApplying)
                .where(
                    eq(
                        schema.derogationApplying.b_id_derogation,
                        b_id_derogation,
                    ),
                )

            if (!application[0]) {
                throw new Error("Derogation not found on any farm.")
            }

            await checkPermission(
                tx,
                "farm",
                "write",
                application[0].b_id_farm,
                principal_id,
                "removeDerogation",
            )

            await tx
                .delete(schema.derogationApplying)
                .where(
                    eq(
                        schema.derogationApplying.b_id_derogation,
                        b_id_derogation,
                    ),
                )

            await tx
                .delete(schema.derogations)
                .where(eq(schema.derogations.b_id_derogation, b_id_derogation))
        })
    } catch (err) {
        throw handleError(err, "Exception for removeDerogation", {
            b_id_derogation,
        })
    }
}

/**
 * Lists all derogations for a given farm.
 *
 * This function checks if the principal has 'read' permission on the farm before returning the list.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal requesting the list.
 * @param b_id_farm The identifier of the farm.
 * @returns A Promise that resolves with a list of derogations for the specified farm.
 * @throws {Error} If the principal does not have permission to read the farm's derogations.
 */
export async function listDerogations(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
): Promise<schema.derogationsTypeSelect[]> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "read",
                b_id_farm,
                principal_id,
                "listDerogations",
            )

            const applications = await tx
                .select({
                    b_id_derogation: schema.derogationApplying.b_id_derogation,
                })
                .from(schema.derogationApplying)
                .where(eq(schema.derogationApplying.b_id_farm, b_id_farm))

            if (applications.length === 0) {
                return []
            }

            const derogationIds = applications.map(
                (app: { b_id_derogation: string }) => app.b_id_derogation,
            )

            return await tx
                .select()
                .from(schema.derogations)
                .where(
                    inArray(schema.derogations.b_id_derogation, derogationIds),
                )
        })
    } catch (err) {
        throw handleError(err, "Exception for listDerogations", { b_id_farm })
    }
}

/**
 * Checks if a derogation has been granted for a specific farm and year.
 *
 * This function checks if the principal has 'read' permission on the farm.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The identifier of the principal making the request.
 * @param b_id_farm The identifier of the farm.
 * @param year The year to check for a derogation.
 * @returns A Promise that resolves to true if a derogation is granted for the specified year, false otherwise.
 * @throws {Error} If the principal does not have permission to read the farm's derogations.
 */
export async function isDerogationGrantedForYear(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    year: number,
): Promise<boolean> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "read",
                b_id_farm,
                principal_id,
                "isDerogationGrantedForYear",
            )

            const result = await tx
                .select({ id: schema.derogations.b_id_derogation })
                .from(schema.derogations)
                .leftJoin(
                    schema.derogationApplying,
                    eq(
                        schema.derogations.b_id_derogation,
                        schema.derogationApplying.b_id_derogation,
                    ),
                )
                .where(
                    and(
                        eq(schema.derogationApplying.b_id_farm, b_id_farm),
                        eq(schema.derogations.b_derogation_year, year),
                    ),
                )
                .limit(1)

            return result.length > 0
        })
    } catch (err) {
        throw handleError(err, "Exception for isDerogationGrantedForYear", {
            b_id_farm,
            year,
        })
    }
}
