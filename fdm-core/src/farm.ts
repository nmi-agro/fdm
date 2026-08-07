import { and, asc, eq, gt, inArray } from "drizzle-orm"
import type { PrincipalId, PrincipalWithRoles, Role } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { Principal } from "./principal.types"
import {
  checkPermission,
  getRolesOfPrincipalForResource,
  grantRole,
  listPrincipalsForResource,
  listResources,
  revokePrincipal,
  updateRole,
  writeAuditEntry,
} from "./authorization"
import * as schema from "./db/schema"
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
import { handleError } from "./error"
import { removeField } from "./field"
import { createId } from "./id"
import { createInvitation, listPendingInvitationsForPrincipal } from "./invitation"
import { identifyPrincipal } from "./principal"

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
    return await fdm.transaction(async (tx) => {
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
      await tx.insert(schema.animalCategoryCatalogueSelecting).values({
        b_id_farm,
        l_category_source: "rvo",
      })

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
  b_farm_livestock: boolean
  b_farm_dairy: boolean
  roles: PrincipalWithRoles[]
}> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "read", b_id_farm, principal_id, "getFarm")

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
      const roles = await getRolesOfPrincipalForResource(tx, "farm", b_id_farm, principal_id)

      // Get all principals for the farm to find the owner
      const allPrincipals = await listPrincipalsForResource(tx, "farm", b_id_farm)
      const ownerPrincipal = allPrincipals.find((p) => p.role === "owner")
      const farmFlags = await deriveFarmFlags(tx, b_id_farm)

      const farm = {
        ...results[0],
        b_id_principal: principal_id,
        b_id_principal_owner: ownerPrincipal?.principal_id || "", // Fallback if no owner is found
        ...farmFlags,
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
    const start = performance.now()
    const resolvedPrincipalId = Array.isArray(principal_id)
      ? principal_id[0] || "unknown"
      : principal_id || "unknown"
    return await fdm.transaction(async (tx) => {
      const resources = await listResources(tx, "farm", "read", principal_id)

      if (resources.length === 0) {
        await writeAuditEntry(
          tx,
          "getFarms",
          "farm",
          "list",
          principal_id,
          "user",
          resolvedPrincipalId,
          Math.round(performance.now() - start),
        )
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
        results.map(async (farm) => {
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
        }),
      )

      await writeAuditEntry(
        tx,
        "getFarms",
        "farm",
        "list",
        principal_id,
        "user",
        resolvedPrincipalId,
        Math.round(performance.now() - start),
      )
      return farms
    })
  } catch (err) {
    throw handleError(err, "Exception for getFarms")
  }
}

async function deriveFarmFlags(
  tx: FdmType,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<{
  b_farm_livestock: boolean
  b_farm_dairy: boolean
}> {
  const [
    herdsForFarm,
    animalsForFarm,
    milkTanksForFarm,
    milkingHerdForFarm,
    milkingAnimalForFarm,
    milkDeliveringForFarm,
  ] = await Promise.all([
    tx
      .select({ l_id_herd: schema.herdStarting.l_id_herd })
      .from(schema.herdStarting)
      .where(eq(schema.herdStarting.b_id_farm, b_id_farm))
      .limit(1),
    tx
      .select({ l_id_animal: schema.animalArriving.l_id_animal })
      .from(schema.animalArriving)
      .where(eq(schema.animalArriving.b_id_farm, b_id_farm))
      .limit(1),
    tx
      .select({ l_id_milktank: schema.milkTanks.l_id_milktank })
      .from(schema.milkTanks)
      .where(eq(schema.milkTanks.b_id_farm, b_id_farm))
      .limit(1),
    tx
      .select({ l_id_herd: schema.milkingHerd.l_id_herd })
      .from(schema.milkingHerd)
      .innerJoin(
        schema.herdStarting,
        eq(schema.milkingHerd.l_id_herd, schema.herdStarting.l_id_herd),
      )
      .where(eq(schema.herdStarting.b_id_farm, b_id_farm))
      .limit(1),
    tx
      .select({ l_id_animal: schema.milkingAnimal.l_id_animal })
      .from(schema.milkingAnimal)
      .innerJoin(
        schema.animalArriving,
        eq(schema.milkingAnimal.l_id_animal, schema.animalArriving.l_id_animal),
      )
      .where(eq(schema.animalArriving.b_id_farm, b_id_farm))
      .limit(1),
    tx
      .select({ l_id_milkdelivery: schema.milkDelivering.l_id_milkdelivery })
      .from(schema.milkDelivering)
      .innerJoin(
        schema.milkTanks,
        eq(schema.milkDelivering.l_id_milktank, schema.milkTanks.l_id_milktank),
      )
      .where(eq(schema.milkTanks.b_id_farm, b_id_farm))
      .limit(1),
  ])

  return {
    b_farm_livestock: herdsForFarm.length > 0 || animalsForFarm.length > 0,
    b_farm_dairy:
      milkTanksForFarm.length > 0 ||
      milkingHerdForFarm.length > 0 ||
      milkingAnimalForFarm.length > 0 ||
      milkDeliveringForFarm.length > 0,
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
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "write", b_id_farm, principal_id, "updateFarm")
      const updated = new Date()
      const farmUpdate: {
        b_name_farm: schema.farmsTypeInsert["b_name_farm"]
        b_businessid_farm: schema.farmsTypeInsert["b_businessid_farm"]
        b_address_farm: schema.farmsTypeInsert["b_address_farm"]
        b_postalcode_farm: schema.farmsTypeInsert["b_postalcode_farm"]
        updated: Date
      } = {
        b_name_farm,
        b_businessid_farm,
        b_address_farm,
        b_postalcode_farm,
        updated,
      }

      const updatedFarm = await tx
        .update(schema.farms)
        .set(farmUpdate)
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
    })
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
 * Grants a specified role to a principal for a given farm via an invitation.
 *
 * Checks if the acting principal has 'share' permission on the farm, then creates
 * an invitation for the target. Delegates to {@link createInvitation}.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param principal_id - The identifier of the principal performing the grant (must have 'share' permission).
 * @param target - The username, email, or slug of the invitee.
 * @param b_id_farm - The identifier of the farm.
 * @param role - The role to be granted ('owner', 'advisor', or 'researcher').
 *
 * @throws {Error} If the acting principal does not have 'share' permission, or if any other error occurs.
 */
export async function grantRoleToFarm(
  fdm: FdmType,
  principal_id: string,
  target: string,
  b_id_farm: schema.farmsTypeInsert["b_id_farm"],
  role: "owner" | "advisor" | "researcher",
): Promise<void> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "share", b_id_farm, principal_id, "grantRoleToFarm")
      return await createInvitation(tx, "farm", b_id_farm, principal_id, target, role)
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
    return await fdm.transaction(async (tx) => {
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
      const owners = await listPrincipalsForResource(tx, "farm", b_id_farm)
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
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "share", b_id_farm, principal_id, "revokePrincipalFromFarm")
      const targetDetails = await identifyPrincipal(tx, target)
      if (!targetDetails) {
        throw new Error("Target not found")
      }

      await revokePrincipal(tx, "farm", b_id_farm, targetDetails.id)

      // Check if at least 1 owner is still prestent on this farm
      const owners = await listPrincipalsForResource(tx, "farm", b_id_farm)
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
    invitation_expires_at?: Date
  })[]
> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "farm", "read", b_id_farm, principal_id, "listPrincipalsForFarm")
      const principals = await listPrincipalsForResource(tx, "farm", b_id_farm)

      // Collect all principal IDs to fetch (active + pending with principal target)
      const now = new Date()
      const pendingInvitations = await tx
        .select()
        .from(authZSchema.invitation)
        .where(
          and(
            eq(authZSchema.invitation.resource, "farm"),
            eq(authZSchema.invitation.resource_id, b_id_farm),
            eq(authZSchema.invitation.status, "pending"),
            gt(authZSchema.invitation.expires, now),
          ),
        )

      const activeIds = principals.map((p) => p.principal_id)
      const pendingIdsWithPrincipal: string[] = (
        pendingInvitations as authZSchema.invitationTypeSelect[]
      )
        .map((i) => i.target_principal_id)
        .filter((id): id is string => id !== null)

      const allPrincipalIds = [...new Set([...activeIds, ...pendingIdsWithPrincipal])]

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
          let initials = u.email?.charAt(0) ?? "U"
          if (u.firstname && u.surname) {
            initials = u.firstname.charAt(0).toUpperCase()
            const surnameParts = u.surname.split(/\s+/)
            let firstCap = ""
            for (const part of surnameParts) {
              if (part.length > 0) {
                const char = part.charAt(0)
                if (char === char.toUpperCase() && char.match(/[a-zA-Z]/)) {
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
            username: u.username ?? "unknown",
            email: u.email,
            initials: initials.toUpperCase(),
            displayUserName: u.displayUserName,
            image: u.image,
            type: "user",
            isVerified: u.isVerified,
          })
        }

        // Fetch Organizations (for IDs not found in users)
        const remainingIds = allPrincipalIds.filter((id) => !principalsMap.has(id))
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
            .where(inArray(authNSchema.organization.id, remainingIds))

          for (const o of orgs) {
            const metadata = o.metadata ? JSON.parse(o.metadata) : null
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
        (invitation: authZSchema.invitationTypeSelect) => {
          if (invitation.target_principal_id) {
            const details = principalsMap.get(invitation.target_principal_id)
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
              invitation_expires_at: invitation.expires,
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
            invitation_expires_at: invitation.expires,
          }
        },
      )

      // Deduplicate by principal_id, preferring "active" over "pending"
      const deduped = new Map<
        string,
        (typeof principalsDetails)[number] | (typeof pendingDetails)[number]
      >()
      for (const entry of principalsDetails) {
        deduped.set(entry.id, entry)
      }
      for (const entry of pendingDetails) {
        if (!deduped.has(entry.id)) {
          deduped.set(entry.id, entry)
        }
      }
      return Array.from(deduped.values())
    })
  } catch (err) {
    throw handleError(err, "Exception for listPrincipalsForFarm", {
      b_id_farm,
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
 * @returns A Promise that resolves to an array of pending invitation records for this farm.
 */
export async function listPendingInvitationsForFarm(
  fdm: FdmType,
  principal_id: string,
  b_id_farm: string,
): Promise<authZSchema.invitationTypeSelect[]> {
  try {
    return await fdm.transaction(async (tx) => {
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
        .from(authZSchema.invitation)
        .where(
          and(
            eq(authZSchema.invitation.resource, "farm"),
            eq(authZSchema.invitation.resource_id, b_id_farm),
            eq(authZSchema.invitation.status, "pending"),
            gt(authZSchema.invitation.expires, now),
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
 * Lists all pending (non-expired) farm invitations for a given user, enriched with farm and organization names.
 *
 * Delegates to {@link listPendingInvitationsForPrincipal} and enriches farm-resource rows with names.
 *
 * @param fdm - The FDM instance providing the connection to the database.
 * @param user_id - The ID of the user to retrieve invitations for.
 * @param include_readonly - Whether to include the invitations that the user's organization has
 * received but the user themselves can't accept.
 *
 * @returns A Promise that resolves to an array of pending invitation records enriched with farm_name and org_name.
 */
export async function listPendingInvitationsForUser(
  fdm: FdmType,
  user_id: string,
  include_readonly?: boolean,
): Promise<
  (Awaited<ReturnType<typeof listPendingInvitationsForPrincipal>>[number] & {
    farm_name: string | null
    org_name: string | null
  })[]
> {
  try {
    return await fdm.transaction(async (tx) => {
      const pending = await listPendingInvitationsForPrincipal(tx, user_id, include_readonly)

      if (pending.length === 0) {
        return []
      }

      // Enrich with farm names for farm-resource invitations
      const farmIds = [
        ...new Set(pending.filter((i) => i.resource === "farm").map((i) => i.resource_id)),
      ]

      const farmNames = new Map<string, string | null>()
      if (farmIds.length > 0) {
        const farms = await tx
          .select({
            b_id_farm: schema.farms.b_id_farm,
            b_name_farm: schema.farms.b_name_farm,
          })
          .from(schema.farms)
          .where(inArray(schema.farms.b_id_farm, farmIds))

        for (const f of farms) {
          farmNames.set(f.b_id_farm, f.b_name_farm)
        }
      }

      // Collect org IDs from principal-targeted invitations
      const orgTargetIds = [
        ...new Set(
          pending
            .filter((i) => i.target_principal_id !== null)
            .map((i) => i.target_principal_id as string),
        ),
      ]

      const orgNames = new Map<string, string | null>()
      if (orgTargetIds.length > 0) {
        const orgs = await tx
          .select({
            id: authNSchema.organization.id,
            name: authNSchema.organization.name,
          })
          .from(authNSchema.organization)
          .where(inArray(authNSchema.organization.id, orgTargetIds))

        for (const o of orgs) {
          orgNames.set(o.id, o.name)
        }
      }

      return pending.map((i) => ({
        ...i,
        farm_name: i.resource === "farm" ? (farmNames.get(i.resource_id) ?? null) : null,
        org_name: i.target_principal_id ? (orgNames.get(i.target_principal_id) ?? null) : null,
      }))
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
    await checkPermission(fdm, "farm", "share", b_id_farm, principal_id, "isAllowedToShareFarm")
    return true
  } catch {
    return false
  }
}

/**
 * Internal helper to validate a pending farm invitation and check caller permissions.
 *
 * @param tx - The transaction context.
 * @param invitation_id - The invitation ID to look up.
 * @param principal_id - The principal attempting the action.
 * @returns The validated invitation record.
 * @throws Error if invitation not found, not pending, expired, or permission denied.
 */
async function getAndValidatePendingFarmInvitation(
  tx: FdmType,
  invitation_id: string,
  principal_id: PrincipalId,
): Promise<authZSchema.invitationTypeSelect> {
  const invitations = await tx
    .select()
    .from(authZSchema.invitation)
    .where(
      and(
        eq(authZSchema.invitation.invitation_id, invitation_id),
        eq(authZSchema.invitation.resource, "farm"),
      ),
    )
    .limit(1)

  if (invitations.length === 0) {
    throw new Error("Invitation not found")
  }

  const invitation = invitations[0]

  if (invitation.status !== "pending") {
    throw new Error(`Invitation is already ${invitation.status}`)
  }

  if (invitation.expires <= new Date()) {
    throw new Error("Invitation has expired")
  }

  const b_id_farm = invitation.resource_id

  await checkPermission(
    tx,
    "farm",
    "share",
    b_id_farm,
    principal_id,
    "getAndValidatePendingFarmInvitation",
  )

  return invitation
}

/**
 * Cancels a pending invitation for a farm.
 *
 * This function checks if the acting principal has 'share' permission on the farm,
 * then sets the invitation status to "declined", effectively cancelling it.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The identifier of the principal cancelling the invitation (must have 'share' permission).
 * @param invitation_id - The identifier of the invitation to cancel.
 */
export async function cancelInvitationForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  invitation_id: string,
): Promise<void> {
  try {
    return await fdm.transaction(async (tx) => {
      await getAndValidatePendingFarmInvitation(tx, invitation_id, principal_id)

      const result = await tx
        .update(authZSchema.invitation)
        .set({ status: "declined" })
        .where(
          and(
            eq(authZSchema.invitation.invitation_id, invitation_id),
            eq(authZSchema.invitation.status, "pending"),
          ),
        )
        .returning({
          invitation_id: authZSchema.invitation.invitation_id,
        })

      if (result.length === 0) {
        throw new Error("Invitation is no longer pending")
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for cancelInvitationForFarm", {
      invitation_id,
    })
  }
}

/**
 * Updates the role on a pending invitation for a farm.
 *
 * This function looks up the invitation by invitation_id, checks if the acting
 * principal has 'share' permission on the farm, then updates the role field.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The identifier of the principal updating the role (must have 'share' permission).
 * @param invitation_id - The identifier of the invitation to update.
 * @param role - The new role to assign.
 */
export async function updateRoleOfInvitationForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  invitation_id: string,
  role: "owner" | "advisor" | "researcher",
): Promise<void> {
  try {
    return await fdm.transaction(async (tx) => {
      await getAndValidatePendingFarmInvitation(tx, invitation_id, principal_id)

      const result = await tx
        .update(authZSchema.invitation)
        .set({ role })
        .where(
          and(
            eq(authZSchema.invitation.invitation_id, invitation_id),
            eq(authZSchema.invitation.status, "pending"),
          ),
        )
        .returning({
          invitation_id: authZSchema.invitation.invitation_id,
        })

      if (result.length === 0) {
        throw new Error("Invitation is no longer pending")
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateRoleOfInvitationForFarm", {
      invitation_id,
      role,
    })
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
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "isAllowedToDeleteFarm")
    return true
  } catch {
    return false
  }
}

/**
 * Removes all livestock and dairy domain data associated with a farm: herds,
 * animals, barns, housing, milk tanks and milking/delivery records, manure
 * pits and excreting/disposing records, feed batches and feeding records, and
 * grazing records. Called by {@link removeFarm} before fields are removed
 * (grazing records can reference a field's `b_id`).
 *
 * Herds, animals, barns, milk tanks, manure pits, and feed batches are
 * treated as scoped to this single farm (there is no herd/animal/barn
 * "transfer between farms" flow in fdm-core), so they are deleted in full
 * along with their own history, not merely unlinked from the farm.
 *
 * @param tx - The FDM instance or transaction to operate within.
 * @param b_id_farm - The unique identifier of the farm whose livestock data is being removed.
 */
async function removeLivestockDataForFarm(
  tx: FdmType,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<void> {
  const herdRows = await tx
    .select({ l_id_herd: schema.herdStarting.l_id_herd })
    .from(schema.herdStarting)
    .where(eq(schema.herdStarting.b_id_farm, b_id_farm))
  const herdIds = herdRows.map(
    (h: { l_id_herd: schema.herdsTypeSelect["l_id_herd"] }) => h.l_id_herd,
  )

  const animalRows = await tx
    .select({ l_id_animal: schema.animalArriving.l_id_animal })
    .from(schema.animalArriving)
    .where(eq(schema.animalArriving.b_id_farm, b_id_farm))
  const animalIds = animalRows.map(
    (a: { l_id_animal: schema.animalsTypeSelect["l_id_animal"] }) => a.l_id_animal,
  )

  const barnRows = await tx
    .select({ b_id_barn: schema.barnConstructing.b_id_barn })
    .from(schema.barnConstructing)
    .where(eq(schema.barnConstructing.b_id_farm, b_id_farm))
  const barnIds = barnRows.map(
    (b: { b_id_barn: schema.barnsTypeSelect["b_id_barn"] }) => b.b_id_barn,
  )

  const milkTankRows = await tx
    .select({ l_id_milktank: schema.milkTanks.l_id_milktank })
    .from(schema.milkTanks)
    .where(eq(schema.milkTanks.b_id_farm, b_id_farm))
  const milkTankIds = milkTankRows.map(
    (m: { l_id_milktank: schema.milkTanksTypeSelect["l_id_milktank"] }) => m.l_id_milktank,
  )

  const manurePitRows = await tx
    .select({ b_id_manurepit: schema.manurePits.b_id_manurepit })
    .from(schema.manurePits)
    .where(eq(schema.manurePits.b_id_farm, b_id_farm))
  const manurePitIds = manurePitRows.map(
    (m: { b_id_manurepit: schema.manurePitsTypeSelect["b_id_manurepit"] }) => m.b_id_manurepit,
  )

  const feedBatchRows = await tx
    .select({ f_id_batch: schema.feedBatches.f_id_batch })
    .from(schema.feedBatches)
    .where(eq(schema.feedBatches.b_id_farm, b_id_farm))
  const feedBatchIds = feedBatchRows.map(
    (f: { f_id_batch: schema.feedBatchesTypeSelect["f_id_batch"] }) => f.f_id_batch,
  )

  // Milk: milking records, deliveries (+ sampling/analyses), tanks
  if (animalIds.length > 0) {
    await tx
      .delete(schema.milkingAnimal)
      .where(inArray(schema.milkingAnimal.l_id_animal, animalIds))
  }
  if (herdIds.length > 0) {
    await tx.delete(schema.milkingHerd).where(inArray(schema.milkingHerd.l_id_herd, herdIds))
  }
  if (milkTankIds.length > 0) {
    await tx
      .delete(schema.milkingAnimal)
      .where(inArray(schema.milkingAnimal.l_id_milktank, milkTankIds))
    await tx
      .delete(schema.milkingHerd)
      .where(inArray(schema.milkingHerd.l_id_milktank, milkTankIds))

    const deliveringRows = await tx
      .select({ l_id_milkdelivery: schema.milkDelivering.l_id_milkdelivery })
      .from(schema.milkDelivering)
      .where(inArray(schema.milkDelivering.l_id_milktank, milkTankIds))
    const milkDeliveryIds = deliveringRows.map(
      (d: { l_id_milkdelivery: schema.milkDeliveriesTypeSelect["l_id_milkdelivery"] }) =>
        d.l_id_milkdelivery,
    )

    if (milkDeliveryIds.length > 0) {
      const samplingRows = await tx
        .select({ l_id_milkanalysis: schema.milkSampling.l_id_milkanalysis })
        .from(schema.milkSampling)
        .where(inArray(schema.milkSampling.l_id_milkdelivery, milkDeliveryIds))
      const milkAnalysisIds = samplingRows.map(
        (s: { l_id_milkanalysis: schema.milkAnalysesTypeSelect["l_id_milkanalysis"] }) =>
          s.l_id_milkanalysis,
      )

      await tx
        .delete(schema.milkSampling)
        .where(inArray(schema.milkSampling.l_id_milkdelivery, milkDeliveryIds))
      if (milkAnalysisIds.length > 0) {
        await tx
          .delete(schema.milkAnalyses)
          .where(inArray(schema.milkAnalyses.l_id_milkanalysis, milkAnalysisIds))
      }
    }

    await tx
      .delete(schema.milkDelivering)
      .where(inArray(schema.milkDelivering.l_id_milktank, milkTankIds))
    if (milkDeliveryIds.length > 0) {
      await tx
        .delete(schema.milkDeliveries)
        .where(inArray(schema.milkDeliveries.l_id_milkdelivery, milkDeliveryIds))
    }

    await tx.delete(schema.milkTanks).where(inArray(schema.milkTanks.l_id_milktank, milkTankIds))
  }

  // Manure: excreting, disposing (+ deliveries/sampling/analyses), pits
  if (herdIds.length > 0) {
    await tx.delete(schema.excreting).where(inArray(schema.excreting.l_id_herd, herdIds))
  }
  if (manurePitIds.length > 0) {
    await tx.delete(schema.excreting).where(inArray(schema.excreting.b_id_manurepit, manurePitIds))

    const disposingRows = await tx
      .select({ p_id_delivery: schema.manureDisposing.p_id_delivery })
      .from(schema.manureDisposing)
      .where(inArray(schema.manureDisposing.b_id_manurepit, manurePitIds))
    const manureDeliveryIds = disposingRows.map(
      (d: { p_id_delivery: schema.manureDeliveriesTypeSelect["p_id_delivery"] }) => d.p_id_delivery,
    )

    if (manureDeliveryIds.length > 0) {
      const samplingRows = await tx
        .select({ p_id_analysis: schema.manureSampling.p_id_analysis })
        .from(schema.manureSampling)
        .where(inArray(schema.manureSampling.p_id_delivery, manureDeliveryIds))
      const manureAnalysisIds = samplingRows.map(
        (s: { p_id_analysis: schema.manureAnalysesTypeSelect["p_id_analysis"] }) => s.p_id_analysis,
      )

      await tx
        .delete(schema.manureSampling)
        .where(inArray(schema.manureSampling.p_id_delivery, manureDeliveryIds))
      if (manureAnalysisIds.length > 0) {
        await tx
          .delete(schema.manureAnalyses)
          .where(inArray(schema.manureAnalyses.p_id_analysis, manureAnalysisIds))
      }
    }

    await tx
      .delete(schema.manureDisposing)
      .where(inArray(schema.manureDisposing.b_id_manurepit, manurePitIds))
    if (manureDeliveryIds.length > 0) {
      await tx
        .delete(schema.manureDeliveries)
        .where(inArray(schema.manureDeliveries.p_id_delivery, manureDeliveryIds))
    }

    await tx
      .delete(schema.manurePits)
      .where(inArray(schema.manurePits.b_id_manurepit, manurePitIds))
  }

  // Feed: feeding records (+ sampling/analyses), batches
  if (animalIds.length > 0) {
    await tx
      .delete(schema.feedingAnimal)
      .where(inArray(schema.feedingAnimal.l_id_animal, animalIds))
  }
  if (herdIds.length > 0) {
    await tx.delete(schema.feedingHerd).where(inArray(schema.feedingHerd.l_id_herd, herdIds))
  }
  if (feedBatchIds.length > 0) {
    await tx
      .delete(schema.feedingAnimal)
      .where(inArray(schema.feedingAnimal.f_id_batch, feedBatchIds))
    await tx.delete(schema.feedingHerd).where(inArray(schema.feedingHerd.f_id_batch, feedBatchIds))

    const feedSamplingRows = await tx
      .select({ f_id_feed_analysis: schema.feedSampling.f_id_feed_analysis })
      .from(schema.feedSampling)
      .where(inArray(schema.feedSampling.f_id_batch, feedBatchIds))
    const feedAnalysisIds = feedSamplingRows.map(
      (f: { f_id_feed_analysis: schema.feedAnalysesTypeSelect["f_id_feed_analysis"] }) =>
        f.f_id_feed_analysis,
    )

    await tx
      .delete(schema.feedSampling)
      .where(inArray(schema.feedSampling.f_id_batch, feedBatchIds))
    if (feedAnalysisIds.length > 0) {
      await tx
        .delete(schema.feedAnalyses)
        .where(inArray(schema.feedAnalyses.f_id_feed_analysis, feedAnalysisIds))
    }

    await tx.delete(schema.feedBatches).where(inArray(schema.feedBatches.f_id_batch, feedBatchIds))
  }

  // Grazing (must happen before fields are removed by the caller)
  if (herdIds.length > 0) {
    await tx.delete(schema.grazing).where(inArray(schema.grazing.l_id_herd, herdIds))
  }

  // Housing and barns
  if (herdIds.length > 0) {
    await tx.delete(schema.housing).where(inArray(schema.housing.l_id_herd, herdIds))
  }
  if (barnIds.length > 0) {
    await tx.delete(schema.housing).where(inArray(schema.housing.b_id_barn, barnIds))
    await tx
      .delete(schema.barnDecommissioning)
      .where(inArray(schema.barnDecommissioning.b_id_barn, barnIds))
    await tx
      .delete(schema.barnConstructing)
      .where(inArray(schema.barnConstructing.b_id_barn, barnIds))
    await tx.delete(schema.barns).where(inArray(schema.barns.b_id_barn, barnIds))
  }

  // Animals (own history + the asset itself)
  if (animalIds.length > 0) {
    await tx
      .delete(schema.milkingAnimal)
      .where(inArray(schema.milkingAnimal.l_id_animal, animalIds))
    await tx
      .delete(schema.animalLeaving)
      .where(inArray(schema.animalLeaving.l_id_animal, animalIds))
    await tx
      .delete(schema.animalAssigning)
      .where(inArray(schema.animalAssigning.l_id_animal, animalIds))
    await tx
      .delete(schema.animalArriving)
      .where(inArray(schema.animalArriving.l_id_animal, animalIds))
    await tx.delete(schema.animals).where(inArray(schema.animals.l_id_animal, animalIds))
  }

  // Herds (own lifecycle + the asset itself)
  if (herdIds.length > 0) {
    await tx.delete(schema.herdEnding).where(inArray(schema.herdEnding.l_id_herd, herdIds))
    await tx.delete(schema.herdStarting).where(inArray(schema.herdStarting.l_id_herd, herdIds))
    await tx.delete(schema.herds).where(inArray(schema.herds.l_id_herd, herdIds))
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
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "removeFarm")

    await fdm.transaction(async (tx) => {
      // Step 0: Remove all livestock (herds, animals, barns, milk, manure,
      // feed, grazing) data for this farm. This must run before fields are
      // removed, since grazing records can reference a field's b_id.
      await removeLivestockDataForFarm(tx, b_id_farm)

      // Step 1: Get all fields for the given farm
      const fields = await tx
        .select({ b_id: schema.fieldAcquiring.b_id })
        .from(schema.fieldAcquiring)
        .where(eq(schema.fieldAcquiring.b_id_farm, b_id_farm))

      // Step 2: Remove each field and its associated data
      if (fields.length > 0) {
        const fieldIds = fields.map((f: { b_id: schema.fieldsTypeSelect["b_id"] }) => f.b_id)
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
          (f: { p_id: schema.fertilizersTypeSelect["p_id"] }) => f.p_id,
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
          (d: { b_id_derogation: schema.derogationsTypeSelect["b_id_derogation"] }) =>
            d.b_id_derogation,
        )
        await tx
          .delete(schema.derogations)
          .where(inArray(schema.derogations.b_id_derogation, bIdsDerogation))
      }

      // Get all organic certification IDs associated with this farm
      const organicCertificationIdsToDelete = await tx
        .select({
          b_id_organic: schema.organicCertificationsHolding.b_id_organic,
        })
        .from(schema.organicCertificationsHolding)
        .where(eq(schema.organicCertificationsHolding.b_id_farm, b_id_farm))

      // Delete organic certifications holding records
      await tx
        .delete(schema.organicCertificationsHolding)
        .where(eq(schema.organicCertificationsHolding.b_id_farm, b_id_farm))

      // Delete organic certifications that were associated with this farm
      if (organicCertificationIdsToDelete.length > 0) {
        const bIdsOrganic = organicCertificationIdsToDelete.map(
          (o: { b_id_organic: schema.organicCertificationsTypeSelect["b_id_organic"] }) =>
            o.b_id_organic,
        )
        await tx
          .delete(schema.organicCertifications)
          .where(inArray(schema.organicCertifications.b_id_organic, bIdsOrganic))
      }

      await tx
        .delete(schema.intendingGrazing)
        .where(eq(schema.intendingGrazing.b_id_farm, b_id_farm))
      await tx
        .delete(schema.fertilizerCatalogueEnabling)
        .where(eq(schema.fertilizerCatalogueEnabling.b_id_farm, b_id_farm))
      await tx
        .delete(schema.cultivationCatalogueSelecting)
        .where(eq(schema.cultivationCatalogueSelecting.b_id_farm, b_id_farm))
      await tx
        .delete(schema.animalCategoryCatalogueSelecting)
        .where(eq(schema.animalCategoryCatalogueSelecting.b_id_farm, b_id_farm))
      await tx
        .delete(schema.measureCatalogueEnabling)
        .where(eq(schema.measureCatalogueEnabling.b_id_farm, b_id_farm))

      // Delete custom fertilizers from the catalogue that belong to this farm
      await tx
        .delete(schema.fertilizersCatalogue)
        .where(eq(schema.fertilizersCatalogue.p_source, b_id_farm))

      // Delete fertilizers if they are no longer associated with any farm
      if (fertilizerIdsToDelete.length > 0) {
        const pIds = fertilizerIdsToDelete.map(
          (f: { p_id: schema.fertilizersTypeSelect["p_id"] }) => f.p_id,
        )
        const stillReferencedFertilizers = await tx
          .select({ p_id: schema.fertilizerAcquiring.p_id })
          .from(schema.fertilizerAcquiring)
          .where(inArray(schema.fertilizerAcquiring.p_id, pIds))

        const referencedPIds = new Set(
          stillReferencedFertilizers.map(
            (f: { p_id: schema.fertilizersTypeSelect["p_id"] }) => f.p_id,
          ),
        )
        const fertilizersToRemove = pIds.filter(
          (p_id: schema.fertilizersTypeSelect["p_id"]) => !referencedPIds.has(p_id),
        )

        if (fertilizersToRemove.length > 0) {
          await tx
            .delete(schema.fertilizers)
            .where(inArray(schema.fertilizers.p_id, fertilizersToRemove))
        }
      }

      // Step 4: Revoke all principals from the farm
      const principals = await listPrincipalsForResource(tx, "farm", b_id_farm)
      for (const principal of principals) {
        await revokePrincipal(tx, "farm", b_id_farm, principal.principal_id)
      }

      // Step 4b: Delete all invitations for this farm
      await tx
        .delete(authZSchema.invitation)
        .where(
          and(
            eq(authZSchema.invitation.resource, "farm"),
            eq(authZSchema.invitation.resource_id, b_id_farm),
          ),
        )

      // Step 5: Finally, delete the farm itself
      await tx.delete(schema.farms).where(eq(schema.farms.b_id_farm, b_id_farm))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeFarm", { b_id_farm })
  }
}
