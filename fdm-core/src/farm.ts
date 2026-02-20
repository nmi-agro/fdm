import { and, asc, eq, gt, inArray, or } from "drizzle-orm"
import isEmail from "validator/lib/isEmail"
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
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
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
    roles: Role[]
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
        roles: Role[]
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
    principal_id: string,
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

            const normalizedTarget = target.toLowerCase().trim()

            // Check if target is a registered principal (user or organization)
            const targetDetails = await identifyPrincipal(tx, normalizedTarget)

            let targetEmail: string | null = null
            let targetPrincipalId: string | null = null

            if (targetDetails) {
                // Registered user or organization
                targetPrincipalId = targetDetails.id

                // Check if target is already a member of this farm
                const existingMembers = await listPrincipalsForResource(
                    tx,
                    "farm",
                    b_id_farm,
                )
                const isAlreadyMember = existingMembers.some(
                    (m) => m.principal_id === targetPrincipalId,
                )
                if (isAlreadyMember) {
                    throw new Error("Target is already a member of this farm")
                }
            } else {
                // Check if target is a valid email (unregistered user)
                if (!isEmail(normalizedTarget)) {
                    throw new Error(
                        "Target not found and not a valid email address",
                    )
                }
                targetEmail = normalizedTarget
            }

            const expires = new Date()
            expires.setDate(expires.getDate() + 7) // 7 days expiry

            if (targetEmail) {
                // Check for existing pending invitation for this email + farm
                const existing = await tx
                    .select()
                    .from(authZSchema.farmInvitation)
                    .where(
                        and(
                            eq(authZSchema.farmInvitation.farm_id, b_id_farm),
                            eq(
                                authZSchema.farmInvitation.target_email,
                                targetEmail,
                            ),
                            eq(authZSchema.farmInvitation.status, "pending"),
                        ),
                    )
                    .limit(1)

                if (existing.length > 0) {
                    await tx
                        .update(authZSchema.farmInvitation)
                        .set({ role, inviter_id: principal_id, expires })
                        .where(
                            eq(
                                authZSchema.farmInvitation.invitation_id,
                                existing[0].invitation_id,
                            ),
                        )
                } else {
                    await tx.insert(authZSchema.farmInvitation).values({
                        invitation_id: createId(),
                        farm_id: b_id_farm,
                        target_email: targetEmail,
                        role,
                        inviter_id: principal_id,
                        expires,
                    })
                }
            } else {
                // Check for existing pending invitation for this principal + farm
                const existing = await tx
                    .select()
                    .from(authZSchema.farmInvitation)
                    .where(
                        and(
                            eq(authZSchema.farmInvitation.farm_id, b_id_farm),
                            eq(
                                authZSchema.farmInvitation.target_principal_id,
                                targetPrincipalId!,
                            ),
                            eq(authZSchema.farmInvitation.status, "pending"),
                        ),
                    )
                    .limit(1)

                if (existing.length > 0) {
                    await tx
                        .update(authZSchema.farmInvitation)
                        .set({ role, inviter_id: principal_id, expires })
                        .where(
                            eq(
                                authZSchema.farmInvitation.invitation_id,
                                existing[0].invitation_id,
                            ),
                        )
                } else {
                    await tx.insert(authZSchema.farmInvitation).values({
                        invitation_id: createId(),
                        farm_id: b_id_farm,
                        target_principal_id: targetPrincipalId,
                        role,
                        inviter_id: principal_id,
                        expires,
                    })
                }
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
 * @returns A Promise that resolves to an array of Principal objects (including pending ones), each representing a principal associated with the farm.
 *
 * @throws {Error} If the acting principal does not have 'read' permission, or if any other error occurs during the operation.
 */
export async function listPrincipalsForFarm(
    fdm: FdmType,
    principal_id: string,
    b_id_farm: string,
): Promise<
    (Principal & {
        role: string
        status: "active" | "pending"
        invitation_id?: string
    })[]
> {
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

            // Collect all principal IDs to fetch (active + pending with principal target)
            const now = new Date()
            const pendingInvitations = await tx
                .select()
                .from(authZSchema.farmInvitation)
                .where(
                    and(
                        eq(authZSchema.farmInvitation.farm_id, b_id_farm),
                        eq(authZSchema.farmInvitation.status, "pending"),
                        gt(authZSchema.farmInvitation.expires, now),
                    ),
                )

            const activeIds = principals.map((p) => p.principal_id)
            const pendingIdsWithPrincipal: string[] = (
                pendingInvitations as authZSchema.farmInvitationTypeSelect[]
            )
                .map((i) => i.target_principal_id)
                .filter((id): id is string => id !== null)

            const allPrincipalIds = [
                ...new Set([...activeIds, ...pendingIdsWithPrincipal]),
            ]

            // Bulk fetch details for all principals
            const principalsMap = new Map<string, Principal>()

            if (allPrincipalIds.length > 0) {
                // Fetch Users
                const users = await tx
                    .select({
                        id: authNSchema.user.id,
                        username: authNSchema.user.username,
                        displayUserName: authNSchema.user.displayUsername,
                        image: authNSchema.user.image,
                        isVerified: authNSchema.user.emailVerified,
                        firstname: authNSchema.user.firstname,
                        surname: authNSchema.user.surname,
                        email: authNSchema.user.email,
                        name: authNSchema.user.name,
                    })
                    .from(authNSchema.user)
                    .where(inArray(authNSchema.user.id, allPrincipalIds))

                for (const u of users) {
                    let initials = u.email
                    if (u.firstname && u.surname) {
                        initials = u.firstname.charAt(0).toUpperCase()
                        const surnameParts = u.surname.split(/\s+/)
                        let firstCap = ""
                        for (const part of surnameParts) {
                            if (part.length > 0) {
                                const char = part.charAt(0)
                                if (
                                    char === char.toUpperCase() &&
                                    char.match(/[a-zA-Z]/)
                                ) {
                                    firstCap = char.toUpperCase()
                                    break
                                }
                            }
                        }
                        initials += firstCap
                    } else if (u.firstname) {
                        initials = u.firstname[0]
                    } else if (u.name) {
                        initials = u.name[0]
                    }

                    principalsMap.set(u.id, {
                        id: u.id,
                        username: u.username,
                        email: u.email,
                        initials: initials.toUpperCase(),
                        displayUserName: u.displayUserName,
                        image: u.image,
                        type: "user",
                        isVerified: u.isVerified,
                    })
                }

                // Fetch Organizations (for IDs not found in users)
                const remainingIds = allPrincipalIds.filter(
                    (id) => !principalsMap.has(id),
                )
                if (remainingIds.length > 0) {
                    const orgs = await tx
                        .select({
                            id: authNSchema.organization.id,
                            name: authNSchema.organization.name,
                            slug: authNSchema.organization.slug,
                            logo: authNSchema.organization.logo,
                            metadata: authNSchema.organization.metadata,
                        })
                        .from(authNSchema.organization)
                        .where(
                            inArray(authNSchema.organization.id, remainingIds),
                        )

                    for (const o of orgs) {
                        const metadata = o.metadata
                            ? JSON.parse(o.metadata)
                            : null
                        principalsMap.set(o.id, {
                            id: o.id,
                            username: o.slug,
                            email: null,
                            initials: o.name.charAt(0).toUpperCase(),
                            displayUserName: o.name,
                            image: o.logo,
                            type: "organization",
                            isVerified: metadata ? metadata.isVerified : false,
                        })
                    }
                }
            }

            // Map active principals
            const principalsDetails = principals.map((p) => {
                const details = principalsMap.get(p.principal_id)
                return {
                    ...details,
                    id: p.principal_id,
                    username: details?.username ?? "unknown",
                    initials: details?.initials ?? "?",
                    displayUserName: details?.displayUserName ?? null,
                    image: details?.image ?? null,
                    type: details?.type ?? "user",
                    isVerified: details?.isVerified ?? false,
                    email: details?.email ?? null,
                    role: p.role,
                    status: "active" as const,
                }
            })

            // Map pending invitations
            const pendingDetails = pendingInvitations.map(
                (invitation: authZSchema.farmInvitationTypeSelect) => {
                    if (invitation.target_principal_id) {
                        const details = principalsMap.get(
                            invitation.target_principal_id,
                        )
                        return {
                            ...details,
                            id: invitation.target_principal_id,
                            username: details?.username ?? "unknown",
                            initials: details?.initials ?? "?",
                            displayUserName: details?.displayUserName ?? null,
                            image: details?.image ?? null,
                            type: details?.type ?? "user",
                            isVerified: details?.isVerified ?? false,
                            email: details?.email ?? null,
                            role: invitation.role,
                            status: "pending" as const,
                            invitation_id: invitation.invitation_id,
                        }
                    }

                    // Email-based invitation (unregistered user)
                    const email = invitation.target_email ?? "unknown"
                    return {
                        id: `pending-${invitation.invitation_id}`,
                        username: email,
                        email: email,
                        initials: email.charAt(0).toUpperCase(),
                        displayUserName: email,
                        image: null,
                        type: "user" as const,
                        isVerified: false,
                        role: invitation.role,
                        status: "pending" as const,
                        invitation_id: invitation.invitation_id,
                    }
                },
            )

            return [...principalsDetails, ...pendingDetails]
        })
    } catch (err) {
        throw handleError(err, "Exception for listPrincipalsForFarm", {
            b_id_farm,
        })
    }
}

/**
 * Accepts a pending farm invitation on behalf of the acting user.
 *
 * For user-targeted invitations: verifies email is verified and matches the invitation target.
 * For organization-targeted invitations: verifies the acting user is an admin or owner of the organization.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param invitation_id - The unique identifier of the invitation to accept.
 * @param user_id - The ID of the user accepting the invitation.
 *
 * @throws {Error} If the invitation is not found, already processed, expired, or the user is not authorized.
 */
export async function acceptFarmInvitation(
    fdm: FdmType,
    invitation_id: string,
    user_id: string,
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            // Atomically claim the invitation: only succeeds if still pending and not expired
            const claimed = await tx
                .update(authZSchema.farmInvitation)
                .set({ status: "accepted", accepted_at: new Date() })
                .where(
                    and(
                        eq(
                            authZSchema.farmInvitation.invitation_id,
                            invitation_id,
                        ),
                        eq(authZSchema.farmInvitation.status, "pending"),
                        gt(authZSchema.farmInvitation.expires, new Date()),
                    ),
                )
                .returning()

            if (claimed.length === 0) {
                // Determine the precise reason for failure
                const existing = await tx
                    .select()
                    .from(authZSchema.farmInvitation)
                    .where(
                        eq(
                            authZSchema.farmInvitation.invitation_id,
                            invitation_id,
                        ),
                    )
                    .limit(1)

                if (existing.length === 0) {
                    throw new Error("Invitation not found")
                }
                const inv = existing[0]
                if (inv.status !== "pending") {
                    throw new Error(`Invitation is already ${inv.status}`)
                }
                // Must be expired
                await tx
                    .update(authZSchema.farmInvitation)
                    .set({ status: "expired" })
                    .where(
                        eq(
                            authZSchema.farmInvitation.invitation_id,
                            invitation_id,
                        ),
                    )
                throw new Error("Invitation has expired")
            }

            const invitation = claimed[0]
            let granteeId: string

            if (invitation.target_principal_id) {
                const targetDetails = await getPrincipal(
                    tx,
                    invitation.target_principal_id,
                )
                if (!targetDetails) {
                    throw new Error("Invitation target not found")
                }

                if (targetDetails.type === "organization") {
                    // Verify user is admin or owner of the organization
                    const membership = await tx
                        .select()
                        .from(authNSchema.member)
                        .where(
                            and(
                                eq(
                                    authNSchema.member.organizationId,
                                    invitation.target_principal_id,
                                ),
                                eq(authNSchema.member.userId, user_id),
                            ),
                        )
                        .limit(1)

                    if (
                        membership.length === 0 ||
                        !["admin", "owner"].includes(membership[0].role)
                    ) {
                        throw new Error(
                            "Only admins or owners can accept farm invitations on behalf of an organization",
                        )
                    }
                } else {
                    // User target: verify it matches the accepting user
                    if (invitation.target_principal_id !== user_id) {
                        throw new Error("This invitation is not for you")
                    }
                    const userRecord = await tx
                        .select({
                            emailVerified: authNSchema.user.emailVerified,
                        })
                        .from(authNSchema.user)
                        .where(eq(authNSchema.user.id, user_id))
                        .limit(1)

                    if (
                        userRecord.length === 0 ||
                        !userRecord[0].emailVerified
                    ) {
                        throw new Error(
                            "Email must be verified before accepting a farm invitation",
                        )
                    }
                }

                granteeId = invitation.target_principal_id
            } else if (invitation.target_email) {
                // Email-based invitation: match accepting user's email
                const userRecord = await tx
                    .select({
                        email: authNSchema.user.email,
                        emailVerified: authNSchema.user.emailVerified,
                    })
                    .from(authNSchema.user)
                    .where(eq(authNSchema.user.id, user_id))
                    .limit(1)

                if (userRecord.length === 0) {
                    throw new Error("User not found")
                }
                if (
                    userRecord[0].email.toLowerCase().trim() !==
                    invitation.target_email
                ) {
                    throw new Error(
                        "This invitation is not for your email address",
                    )
                }
                if (!userRecord[0].emailVerified) {
                    throw new Error(
                        "Email must be verified before accepting a farm invitation",
                    )
                }
                granteeId = user_id
            } else {
                throw new Error("Invalid invitation: no target specified")
            }

            // Grant the role
            await grantRole(
                tx,
                "farm",
                invitation.role as "owner" | "advisor" | "researcher",
                invitation.farm_id,
                granteeId,
            )

            // Update target_principal_id if this was an email-based invitation
            if (!invitation.target_principal_id) {
                await tx
                    .update(authZSchema.farmInvitation)
                    .set({ target_principal_id: granteeId })
                    .where(
                        eq(
                            authZSchema.farmInvitation.invitation_id,
                            invitation_id,
                        ),
                    )
            }
        })
    } catch (err) {
        throw handleError(err, "Exception for acceptFarmInvitation", {
            invitation_id,
            user_id,
        })
    }
}

/**
 * Declines a pending farm invitation on behalf of the acting user.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param invitation_id - The unique identifier of the invitation to decline.
 * @param user_id - The ID of the user declining the invitation.
 *
 * @throws {Error} If the invitation is not found, already processed, or the user is not authorized.
 */
export async function declineFarmInvitation(
    fdm: FdmType,
    invitation_id: string,
    user_id: string,
): Promise<void> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            const invitations = await tx
                .select()
                .from(authZSchema.farmInvitation)
                .where(
                    eq(authZSchema.farmInvitation.invitation_id, invitation_id),
                )
                .limit(1)

            if (invitations.length === 0) {
                throw new Error("Invitation not found")
            }
            const invitation = invitations[0]

            if (invitation.status !== "pending") {
                throw new Error(`Invitation is already ${invitation.status}`)
            }

            if (invitation.expires < new Date()) {
                await tx
                    .update(authZSchema.farmInvitation)
                    .set({ status: "expired" })
                    .where(
                        eq(
                            authZSchema.farmInvitation.invitation_id,
                            invitation_id,
                        ),
                    )
                throw new Error("Invitation has expired")
            }

            // Verify the user has the right to decline this invitation
            if (invitation.target_principal_id) {
                const targetDetails = await getPrincipal(
                    tx,
                    invitation.target_principal_id,
                )
                if (targetDetails?.type === "organization") {
                    const membership = await tx
                        .select()
                        .from(authNSchema.member)
                        .where(
                            and(
                                eq(
                                    authNSchema.member.organizationId,
                                    invitation.target_principal_id,
                                ),
                                eq(authNSchema.member.userId, user_id),
                            ),
                        )
                        .limit(1)

                    if (
                        membership.length === 0 ||
                        !["admin", "owner"].includes(membership[0].role)
                    ) {
                        throw new Error(
                            "Only admins or owners can decline farm invitations on behalf of an organization",
                        )
                    }
                } else {
                    if (invitation.target_principal_id !== user_id) {
                        throw new Error("This invitation is not for you")
                    }
                }
            } else if (invitation.target_email) {
                const userRecord = await tx
                    .select({ email: authNSchema.user.email })
                    .from(authNSchema.user)
                    .where(eq(authNSchema.user.id, user_id))
                    .limit(1)

                if (
                    userRecord.length === 0 ||
                    userRecord[0].email.toLowerCase().trim() !==
                        invitation.target_email
                ) {
                    throw new Error(
                        "This invitation is not for your email address",
                    )
                }
            }

            await tx
                .update(authZSchema.farmInvitation)
                .set({ status: "declined" })
                .where(
                    eq(authZSchema.farmInvitation.invitation_id, invitation_id),
                )
        })
    } catch (err) {
        throw handleError(err, "Exception for declineFarmInvitation", {
            invitation_id,
            user_id,
        })
    }
}

/**
 * Lists all pending (non-expired) invitations for a specific farm.
 *
 * Requires `share` permission on the farm.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param principal_id - The identifier of the principal requesting the list (must have 'share' permission).
 * @param b_id_farm - The identifier of the farm.
 *
 * @returns A Promise that resolves to an array of pending farm invitation records.
 */
export async function listPendingInvitationsForFarm(
    fdm: FdmType,
    principal_id: string,
    b_id_farm: string,
): Promise<authZSchema.farmInvitationTypeSelect[]> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            await checkPermission(
                tx,
                "farm",
                "share",
                b_id_farm,
                principal_id,
                "listPendingInvitationsForFarm",
            )

            const now = new Date()
            return await tx
                .select()
                .from(authZSchema.farmInvitation)
                .where(
                    and(
                        eq(authZSchema.farmInvitation.farm_id, b_id_farm),
                        eq(authZSchema.farmInvitation.status, "pending"),
                        gt(authZSchema.farmInvitation.expires, now),
                    ),
                )
        })
    } catch (err) {
        throw handleError(err, "Exception for listPendingInvitationsForFarm", {
            b_id_farm,
        })
    }
}

/**
 * Lists all pending (non-expired) farm invitations for a given user.
 *
 * Returns invitations where the target matches the user's principal ID, email address,
 * or an organization for which the user is an admin or owner.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param user_id - The ID of the user to retrieve invitations for.
 *
 * @returns A Promise that resolves to an array of pending farm invitation records.
 */
export async function listPendingInvitationsForUser(
    fdm: FdmType,
    user_id: string,
): Promise<
    (authZSchema.farmInvitationTypeSelect & {
        farm_name: string | null
        org_name: string | null
    })[]
> {
    try {
        return await fdm.transaction(async (tx: FdmType) => {
            // Get user's email
            const userRecord = await tx
                .select({ email: authNSchema.user.email })
                .from(authNSchema.user)
                .where(eq(authNSchema.user.id, user_id))
                .limit(1)

            if (userRecord.length === 0) {
                return []
            }
            const userEmail = userRecord[0].email.toLowerCase().trim()

            // Get organization IDs where user is admin or owner
            const orgMemberships = await tx
                .select({ organizationId: authNSchema.member.organizationId })
                .from(authNSchema.member)
                .where(
                    and(
                        eq(authNSchema.member.userId, user_id),
                        inArray(authNSchema.member.role, ["admin", "owner"]),
                    ),
                )
            const orgIds = orgMemberships.map(
                (m: { organizationId: string }) => m.organizationId,
            )

            const now = new Date()

            // Build conditions: by email, by principal_id, or by managed org
            const conditions = [
                and(
                    eq(authZSchema.farmInvitation.target_email, userEmail),
                    eq(authZSchema.farmInvitation.status, "pending"),
                    gt(authZSchema.farmInvitation.expires, now),
                ),
                and(
                    eq(authZSchema.farmInvitation.target_principal_id, user_id),
                    eq(authZSchema.farmInvitation.status, "pending"),
                    gt(authZSchema.farmInvitation.expires, now),
                ),
            ]

            if (orgIds.length > 0) {
                conditions.push(
                    and(
                        inArray(
                            authZSchema.farmInvitation.target_principal_id,
                            orgIds,
                        ),
                        eq(authZSchema.farmInvitation.status, "pending"),
                        gt(authZSchema.farmInvitation.expires, now),
                    ),
                )
            }

            return await tx
                .select({
                    invitation_id: authZSchema.farmInvitation.invitation_id,
                    farm_id: authZSchema.farmInvitation.farm_id,
                    farm_name: schema.farms.b_name_farm,
                    org_name: authNSchema.organization.name,
                    target_email: authZSchema.farmInvitation.target_email,
                    target_principal_id:
                        authZSchema.farmInvitation.target_principal_id,
                    role: authZSchema.farmInvitation.role,
                    inviter_id: authZSchema.farmInvitation.inviter_id,
                    status: authZSchema.farmInvitation.status,
                    expires: authZSchema.farmInvitation.expires,
                    created: authZSchema.farmInvitation.created,
                    accepted_at: authZSchema.farmInvitation.accepted_at,
                })
                .from(authZSchema.farmInvitation)
                .leftJoin(
                    schema.farms,
                    eq(
                        authZSchema.farmInvitation.farm_id,
                        schema.farms.b_id_farm,
                    ),
                )
                .leftJoin(
                    authNSchema.organization,
                    eq(
                        authZSchema.farmInvitation.target_principal_id,
                        authNSchema.organization.id,
                    ),
                )
                .where(or(...conditions))
        })
    } catch (err) {
        throw handleError(err, "Exception for listPendingInvitationsForUser", {
            user_id,
        })
    }
}

/**
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

            // Step 4b: Delete all invitations for this farm
            await tx
                .delete(authZSchema.farmInvitation)
                .where(eq(authZSchema.farmInvitation.farm_id, b_id_farm))

            // Step 5: Finally, delete the farm itself
            await tx
                .delete(schema.farms)
                .where(eq(schema.farms.b_id_farm, b_id_farm))
        })
    } catch (err) {
        throw handleError(err, "Exception for removeFarm", { b_id_farm })
    }
}
