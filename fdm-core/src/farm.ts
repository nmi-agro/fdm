import { asc, eq, inArray } from "drizzle-orm"
import {
    checkPermission,
    getRolesOfPrincipalForResource,
    grantRole,
    listPrincipalsForResource,
    listResources,
    revokePrincipal,
    updateRole,
} from "./authorization"
import type { PrincipalId, Role } from "./authorization.d"
import * as schema from "./db/schema"
import { handleError } from "./error"
import type { FdmType } from "./fdm"
import { removeField } from "./field"
import { createId } from "./id"
import { getPrincipal, identifyPrincipal } from "./principal"
import type { Principal } from "./principal.d"

/**
 * Creates a new farm record and assigns the "owner" role to the specified principal.
 *
 * This function starts a database transaction, generates a unique identifier for the new farm,
 * inserts the farm details into the database, and then grants the given principal the owner role.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal creating the farm.
 * @param b_name_farm - The name of the farm.
 * @param b_businessid_farm - The business identifier for the farm.
 * @param b_address_farm - The address of the farm.
 * @param b_postalcode_farm - The postal code associated with the farm.
 *
 * @returns The generated unique identifier for the new farm.
 *
 * @throws {Error} If the transaction fails to create the farm record.
 *
 * @alpha
 */
export async function addFarm(
    fdm: FdmType,
    principal_id: string,
    b_name_farm: schema.farmsTypeInsert["b_name_farm"],
    b_businessid_farm: schema.farmsTypeInsert["b_businessid_farm"],
    b_address_farm: schema.farmsTypeInsert["b_address_farm"],
    b_postalcode_farm: schema.farmsTypeInsert["b_postalcode_farm"],
): Promise<schema.farmsTypeInsert["b_id_farm"]> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            // Generate an ID for the farm
            const b_id_farm = createId()
            // Insert the farm in the db
            const farmData = {
                b_id_farm,
                b_name_farm,
                b_businessid_farm,
                b_address_farm,
                b_postalcode_farm,
            }
            await tx.insert(schema.farms).values(farmData)

            // Grant owner role to farm
            await grantRole(tx, "farm", "owner", b_id_farm, principal_id)

            return b_id_farm
        })
    } catch (err) {
        throw handleError(err, "Exception for addFarm", {
            b_name_farm,
            b_businessid_farm,
            b_address_farm,
            b_postalcode_farm,
        })
    }
}

/**
 * Retrieves a farm's details after verifying that the requesting principal has read access.
 *
 * This function checks the principal's permissions before querying the database for the farm identified by the provided ID.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal making the request.
 * @param b_id_farm - The unique identifier of the farm to retrieve.
 * @returns A Promise that resolves with the farm's details.
 * @throws {Error} If permission checks fail or if an error occurs while retrieving the farm.
 * @alpha
 */
export async function getFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
): Promise<{
    b_id_farm: schema.farmsTypeSelect["b_id_farm"]
    b_name_farm: schema.farmsTypeSelect["b_name_farm"]
    b_businessid_farm: schema.farmsTypeSelect["b_businessid_farm"]
    b_address_farm: schema.farmsTypeSelect["b_address_farm"]
    b_postalcode_farm: schema.farmsTypeSelect["b_postalcode_farm"]
    b_id_principal: PrincipalId
    b_id_principal_owner: PrincipalId
    roles: {
        principal_id: string
        principal_type: "user" | "organization"
        role: Role
    }[]
}> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "read",
                b_id_farm,
                principal_id,
                "getFarm",
            )

            const results = await tx
                .select({
                    b_id_farm: schema.farms.b_id_farm,
                    b_name_farm: schema.farms.b_name_farm,
                    b_businessid_farm: schema.farms.b_businessid_farm,
                    b_address_farm: schema.farms.b_address_farm,
                    b_postalcode_farm: schema.farms.b_postalcode_farm,
                })
                .from(schema.farms)
                .where(eq(schema.farms.b_id_farm, b_id_farm))
                .limit(1)

            // Get roles on farm
            const roles = await getRolesOfPrincipalForResource(
                tx,
                "farm",
                b_id_farm,
                principal_id,
            )

            // Get all principals for the farm to find the owner
            const allPrincipals = await listPrincipalsForResource(
                tx,
                "farm",
                b_id_farm,
            )
            const ownerPrincipal = allPrincipals.find((p) => p.role === "owner")

            const farm = {
                ...results[0],
                b_id_principal: principal_id,
                b_id_principal_owner: ownerPrincipal?.principal_id || "", // Fallback if no owner is found
                roles: roles,
            }

            return farm
        })
    } catch (err) {
        throw handleError(err, "Exception for getFarm", { b_id_farm })
    }
}

/**
 * Retrieves a list of farms accessible by the specified principal.
 *
 * This function uses authorization checks to determine which farms the principal is allowed to read, then returns the corresponding farm details ordered by name.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting access.
 * @returns A Promise that resolves with an array of farm detail objects.
 * @alpha
 */
export async function getFarms(
    fdm: FdmType,
    principal_id: PrincipalId,
): Promise<
    {
        b_id_farm: schema.farmsTypeSelect["b_id_farm"]
        b_name_farm: schema.farmsTypeSelect["b_name_farm"]
        b_businessid_farm: schema.farmsTypeSelect["b_businessid_farm"]
        b_address_farm: schema.farmsTypeSelect["b_address_farm"]
        b_postalcode_farm: schema.farmsTypeSelect["b_postalcode_farm"]
        roles: {
            principal_id: string
            principal_type: "user" | "organization"
            role: Role
        }[]
    }[]
> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const resources = await listResources(
                tx,
                "farm",
                "read",
                principal_id,
            )

            if (resources.length === 0) {
                return []
            }

            const results = await tx
                .select({
                    b_id_farm: schema.farms.b_id_farm,
                    b_name_farm: schema.farms.b_name_farm,
                    b_businessid_farm: schema.farms.b_businessid_farm,
                    b_address_farm: schema.farms.b_address_farm,
                    b_postalcode_farm: schema.farms.b_postalcode_farm,
                })
                .from(schema.farms)
                .where(inArray(schema.farms.b_id_farm, resources))
                .orderBy(asc(schema.farms.b_name_farm))

            const farms = await Promise.all(
                results.map(
                    async (farm: {
                        b_id_farm: schema.farmsTypeSelect["b_id_farm"]
                    }) => {
                        // Get roles on farm
                        const roles = await getRolesOfPrincipalForResource(
                            tx,
                            "farm",
                            farm.b_id_farm,
                            principal_id,
                        )

                        return {
                            ...farm,
                            roles: roles,
                        }
                    },
                ),
            )

            return farms
        })
    } catch (err) {
        throw handleError(err, "Exception for getFarms")
    }
}

/**
 * Updates a farm's details after confirming the principal has write access.
 *
 * This function first checks if the specified principal is authorized to update the farm,
 * then updates the farm's name, business ID, address, and postal code along with a new timestamp.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - ID of the principal initiating the update.
 * @param b_id_farm - Unique identifier of the farm to update.
 * @param b_name_farm - New name for the farm.
 * @param b_businessid_farm - New business ID for the farm.
 * @param b_address_farm - New address for the farm.
 * @param b_postalcode_farm - New postal code for the farm.
 * @returns A Promise resolving to the updated farm details.
 *
 * @throws {Error} If the principal lacks the necessary write permission or the update operation fails.
 *
 * @alpha
 */
export async function updateFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    b_name_farm: schema.farmsTypeInsert["b_name_farm"],
    b_businessid_farm: schema.farmsTypeInsert["b_businessid_farm"],
    b_address_farm: schema.farmsTypeInsert["b_address_farm"],
    b_postalcode_farm: schema.farmsTypeInsert["b_postalcode_farm"],
): Promise<schema.farmsTypeSelect> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "updateFarm",
        )
        const updatedFarm = await fdm
            .update(schema.farms)
            .set({
                b_name_farm,
                b_businessid_farm,
                b_address_farm,
                b_postalcode_farm,
                updated: new Date(),
            })
            .where(eq(schema.farms.b_id_farm, b_id_farm))
            .returning({
                b_id_farm: schema.farms.b_id_farm,
                b_name_farm: schema.farms.b_name_farm,
                b_businessid_farm: schema.farms.b_businessid_farm,
                b_address_farm: schema.farms.b_address_farm,
                b_postalcode_farm: schema.farms.b_postalcode_farm,
                created: schema.farms.created,
                updated: schema.farms.updated,
            })

        return updatedFarm[0]
    } catch (err) {
        throw handleError(err, "Exception for updateFarm", {
            b_id_farm,
            b_name_farm,
            b_businessid_farm,
            b_address_farm,
            b_postalcode_farm,
        })
    }
}

/**
 * Grants a specified role to a principal for a given farm.
 *
 * This function checks if the acting principal has 'share' permission on the farm, then grants the specified role to the grantee.
 *
 * @param fdm - The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal performing the grant (must have 'share' permission).
 * @param target - The username, email or slug of the principal whose role is being updated.
 * @param b_id_farm - The identifier of the farm.
 * @param role - The role to be granted ('owner', 'advisor', or 'researcher').
 *
 * @throws {Error} If the acting principal does not have 'share' permission, or if any other error occurs during the operation.
 */
export async function grantRoleToFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    target: string,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    role: "owner" | "advisor" | "researcher",
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "share",
                b_id_farm,
                principal_id,
                "grantRoleToFarm",
            )

            const targetDetails = await identifyPrincipal(tx, target)
            if (!targetDetails) {
                throw new Error("Target not found")
            }

            await grantRole(tx, "farm", role, b_id_farm, targetDetails.id)

            // Check if at least 1 owner is still prestent on this farm
            const owners = await listPrincipalsForResource(
                tx,
                "farm",
                b_id_farm,
            )
            const ownerCount = owners.filter((x) => x.role === "owner").length
            if (ownerCount === 0) {
                throw new Error("Farm should have at least 1 owner")
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for grantRoleToFarm", {
            b_id_farm,
            target,
            role,
        })
    }
}

/**
 * Updates the role of a principal for a given farm.
 *
 * This function checks if the acting principal has 'share' permission on the farm, then updates the specified role of the grantee.
 *
 * @param fdm - The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal performing the update (must have 'share' permission).
 * @param target - The username, email or slug of the principal whose role is being updated.
 * @param b_id_farm - The identifier of the farm.
 * @param role - The new role to assign ('owner', 'advisor', or 'researcher').
 *
 * @throws {Error} If the acting principal does not have 'share' permission, or if any other error occurs during the operation.
 */
export async function updateRoleOfPrincipalAtFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    target: string,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
    role: "owner" | "advisor" | "researcher",
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "share",
                b_id_farm,
                principal_id,
                "updateRoleOfPrincipalAtFarm",
            )

            const targetDetails = await identifyPrincipal(tx, target)
            if (!targetDetails) {
                throw new Error("Target not found")
            }

            await updateRole(tx, "farm", role, b_id_farm, targetDetails.id)

            // Check if at least 1 owner is still prestent on this farm
            const owners = await listPrincipalsForResource(
                tx,
                "farm",
                b_id_farm,
            )
            const ownerCount = owners.filter((x) => x.role === "owner").length
            if (ownerCount === 0) {
                throw new Error("Farm should have at least 1 owner")
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for updateRoleOfPrincipalAtFarm", {
            b_id_farm,
            target,
            role,
        })
    }
}

/**
 * Revokes a specified role from a principal for a given farm.
 *
 * This function checks if the acting principal has 'share' permission on the farm, then revokes the specified role from the revokee.
 *
 * @param fdm - The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal performing the revoke (must have 'share' permission).
 * @param target -The username, email or slug of the principal whose role is being revoked.
 * @param b_id_farm - The identifier of the farm.
 *
 * @throws {Error} If the acting principal does not have 'share' permission, or if any other error occurs during the operation.
 */
export async function revokePrincipalFromFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    target: string,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "share",
                b_id_farm,
                principal_id,
                "revokePrincipalFromFarm",
            )
            const targetDetails = await identifyPrincipal(tx, target)
            if (!targetDetails) {
                throw new Error("Target not found")
            }

            await revokePrincipal(tx, "farm", b_id_farm, targetDetails.id)

            // Check if at least 1 owner is still prestent on this farm
            const owners = await listPrincipalsForResource(
                tx,
                "farm",
                b_id_farm,
            )
            const ownerCount = owners.filter((x) => x.role === "owner").length
            if (ownerCount === 0) {
                throw new Error("Farm should have at least 1 owner")
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for revokePrincipalFromFarm", {
            b_id_farm,
            target,
        })
    }
}

/**
 * Lists all principals (users or organizations) associated with a specific farm.
 *
 * This function checks if the acting principal has 'read' permission on the farm, then retrieves a list of all principals that have any role on the farm.
 *
 * @param fdm - The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting the list (must have 'read' permission).
 * @param b_id_farm - The identifier of the farm.
 *
 * @returns A Promise that resolves to an array of Principal objects, each representing a principal associated with the farm.
 *
 * @throws {Error} If the acting principal does not have 'read' permission, or if any other error occurs during the operation.
 */
export async function listPrincipalsForFarm(
    fdm: FdmType,
    principal_id: string,
    b_id_farm: string,
): Promise<Principal[]> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "read",
                b_id_farm,
                principal_id,
                "listPrincipalsForFarm",
            )
            const principals = await listPrincipalsForResource(
                tx,
                "farm",
                b_id_farm,
            )

            // Collect details of principals
            const principalsDetails = await Promise.all(
                principals.map(async (principal) => {
                    const details = await getPrincipal(
                        tx,
                        principal.principal_id,
                    )
                    return {
                        ...details,
                        role: principal.role,
                    }
                }),
            )

            return principalsDetails
        })
    } catch (err) {
        throw handleError(err, "Exception for listPrincipalsForFarm", {
            b_id_farm,
        })
    }
}

/**
 * Checks if the specified principal is allowed to share a given farm.
 *
 * This function verifies if the acting principal has 'share' permission on the farm.
 *
 * @param fdm - The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal whose permissions are being checked.
 * @param b_id_farm - The identifier of the farm.
 *
 * @returns A Promise that resolves to true if the principal has 'share' permission, false otherwise.
 */
export async function isAllowedToShareFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
): Promise<boolean> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "share",
            b_id_farm,
            principal_id,
            "isAllowedToShareFarm",
        )
        return true
    } catch (_err) {
        return false
    }
}

/**
 * Checks if the specified principal is allowed to delete a given farm.
 *
 * This function verifies if the acting principal has 'write' permission on the farm.
 *
 * @param fdm - The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal whose permissions are being checked.
 * @param b_id_farm - The identifier of the farm.
 *
 * @returns A Promise that resolves to true if the principal has 'write' permission, false otherwise.
 */
export async function isAllowedToDeleteFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeInsert["b_id_farm"],
): Promise<boolean> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "isAllowedToDeleteFarm",
        )
        return true
    } catch (_err) {
        return false
    }
}

/**
 * Removes a farm and all its associated data.
 *
 * This function checks if the principal has permission to delete the farm, then proceeds to delete
 * the farm and all cascading data, including fields, associated events and assets (like fertilizer
 * application, soil analysis), farm-related data (like fertilizers, catalogue enabling), and
 * principal permissions.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The unique identifier of the principal performing the operation.
 * @param b_id_farm - The unique identifier of the farm to be removed.
 * @returns A promise that resolves when the farm has been successfully removed.
 *
 * @throws {Error} If the principal does not have permission to delete the farm.
 *
 * @alpha
 */
export async function removeFarm(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<void> {
    try {
        await checkPermission(
            fdm,
            "farm",
            "write",
            b_id_farm,
            principal_id,
            "removeFarm",
        )

        await fdm.transaction(async (tx: FdmType) => {
            // Step 1: Get all fields for the given farm
            const fields = await tx
                .select({ b_id: schema.fieldAcquiring.b_id })
                .from(schema.fieldAcquiring)
                .where(eq(schema.fieldAcquiring.b_id_farm, b_id_farm))

            // Step 2: Remove each field and its associated data
            if (fields.length > 0) {
                const fieldIds = fields.map(
                    (f: { b_id: schema.fieldsTypeSelect["b_id"] }) => f.b_id,
                )
                for (const fieldId of fieldIds) {
                    await removeField(tx, principal_id, fieldId)
                }
            }

            // Step 3: Delete farm-specific data
            // Get all fertilizer IDs associated with this farm
            const fertilizerIdsToDelete = await tx
                .select({ p_id: schema.fertilizerAcquiring.p_id })
                .from(schema.fertilizerAcquiring)
                .where(eq(schema.fertilizerAcquiring.b_id_farm, b_id_farm))

            // Delete fertilizer acquiring records
            await tx
                .delete(schema.fertilizerAcquiring)
                .where(eq(schema.fertilizerAcquiring.b_id_farm, b_id_farm))

            // Delete fertilizer picking records associated with this farm's custom fertilizers
            await tx
                .delete(schema.fertilizerPicking)
                .where(eq(schema.fertilizerPicking.p_id_catalogue, b_id_farm))

            // Delete fertilizer picking records associated with acquired fertilizers of this farm
            if (fertilizerIdsToDelete.length > 0) {
                const pIds = fertilizerIdsToDelete.map(
                    (f: { p_id: schema.fertilizersTypeSelect["p_id"] }) =>
                        f.p_id,
                )
                await tx
                    .delete(schema.fertilizerPicking)
                    .where(inArray(schema.fertilizerPicking.p_id, pIds))
            }

            // Get all derogation IDs associated with this farm
            const derogationIdsToDelete = await tx
                .select({
                    b_id_derogation: schema.derogationApplying.b_id_derogation,
                })
                .from(schema.derogationApplying)
                .where(eq(schema.derogationApplying.b_id_farm, b_id_farm))

            // Delete derogation applying records
            await tx
                .delete(schema.derogationApplying)
                .where(eq(schema.derogationApplying.b_id_farm, b_id_farm))

            // Delete derogations that were associated with this farm
            if (derogationIdsToDelete.length > 0) {
                const bIdsDerogation = derogationIdsToDelete.map(
                    (d: {
                        b_id_derogation: schema.derogationsTypeSelect["b_id_derogation"]
                    }) => d.b_id_derogation,
                )
                await tx
                    .delete(schema.derogations)
                    .where(
                        inArray(
                            schema.derogations.b_id_derogation,
                            bIdsDerogation,
                        ),
                    )
            }

            // Get all organic certification IDs associated with this farm
            const organicCertificationIdsToDelete = await tx
                .select({
                    b_id_organic:
                        schema.organicCertificationsHolding.b_id_organic,
                })
                .from(schema.organicCertificationsHolding)
                .where(
                    eq(
                        schema.organicCertificationsHolding.b_id_farm,
                        b_id_farm,
                    ),
                )

            // Delete organic certifications holding records
            await tx
                .delete(schema.organicCertificationsHolding)
                .where(
                    eq(
                        schema.organicCertificationsHolding.b_id_farm,
                        b_id_farm,
                    ),
                )

            // Delete organic certifications that were associated with this farm
            if (organicCertificationIdsToDelete.length > 0) {
                const bIdsOrganic = organicCertificationIdsToDelete.map(
                    (o: {
                        b_id_organic: schema.organicCertificationsTypeSelect["b_id_organic"]
                    }) => o.b_id_organic,
                )
                await tx
                    .delete(schema.organicCertifications)
                    .where(
                        inArray(
                            schema.organicCertifications.b_id_organic,
                            bIdsOrganic,
                        ),
                    )
            }

            await tx
                .delete(schema.intendingGrazing)
                .where(eq(schema.intendingGrazing.b_id_farm, b_id_farm))
            await tx
                .delete(schema.fertilizerCatalogueEnabling)
                .where(
                    eq(schema.fertilizerCatalogueEnabling.b_id_farm, b_id_farm),
                )
            await tx
                .delete(schema.cultivationCatalogueSelecting)
                .where(
                    eq(
                        schema.cultivationCatalogueSelecting.b_id_farm,
                        b_id_farm,
                    ),
                )

            // Delete custom fertilizers from the catalogue that belong to this farm
            await tx
                .delete(schema.fertilizersCatalogue)
                .where(eq(schema.fertilizersCatalogue.p_source, b_id_farm))

            // Delete fertilizers if they are no longer associated with any farm
            if (fertilizerIdsToDelete.length > 0) {
                const pIds = fertilizerIdsToDelete.map(
                    (f: { p_id: schema.fertilizersTypeSelect["p_id"] }) =>
                        f.p_id,
                )
                const stillReferencedFertilizers = await tx
                    .select({ p_id: schema.fertilizerAcquiring.p_id })
                    .from(schema.fertilizerAcquiring)
                    .where(inArray(schema.fertilizerAcquiring.p_id, pIds))

                const referencedPIds = new Set(
                    stillReferencedFertilizers.map(
                        (f: { p_id: schema.fertilizersTypeSelect["p_id"] }) =>
                            f.p_id,
                    ),
                )
                const fertilizersToRemove = pIds.filter(
                    (p_id: schema.fertilizersTypeSelect["p_id"]) =>
                        !referencedPIds.has(p_id),
                )

                if (fertilizersToRemove.length > 0) {
                    await tx
                        .delete(schema.fertilizers)
                        .where(
                            inArray(
                                schema.fertilizers.p_id,
                                fertilizersToRemove,
                            ),
                        )
                }
            }

            // Step 4: Revoke all principals from the farm
            const principals = await listPrincipalsForResource(
                tx,
                "farm",
                b_id_farm,
            )
            for (const principal of principals) {
                await revokePrincipal(
                    tx,
                    "farm",
                    b_id_farm,
                    principal.principal_id,
                )
            }

            // Step 5: Finally, delete the farm itself
            await tx
                .delete(schema.farms)
                .where(eq(schema.farms.b_id_farm, b_id_farm))
        })
    } catch (err) {
        throw handleError(err, "Exception for removeFarm", { b_id_farm })
    }
}
