import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import type { FarmGroup } from "./farm-group.types"
import type { FdmType } from "./fdm.types"
import {
  checkPermission,
  grantRole,
  listPrincipalsForResource,
  revokePrincipal,
} from "./authorization"
import * as schema from "./db/schema"
import * as authNSchema from "./db/schema-authn"
import * as authZSchema from "./db/schema-authz"
import { handleError } from "./error"
import { createId } from "./id"

const PERMISSION_DENIED = "Principal does not have permission to perform this action"

/**
 * Throws when the principal is not a member of the organization.
 */
async function assertOrganizationMember(
  fdm: FdmType,
  principal_id: string,
  b_id_organization: string,
): Promise<void> {
  const member = await fdm
    .select({ id: authNSchema.member.id })
    .from(authNSchema.member)
    .where(
      and(
        eq(authNSchema.member.organizationId, b_id_organization),
        eq(authNSchema.member.userId, principal_id),
      ),
    )
    .limit(1)
  if (member.length === 0) {
    throw new Error(PERMISSION_DENIED)
  }
}

/**
 * Trims a group name and rejects empty names.
 */
function normalizeGroupName(b_name_group: string): string {
  const name = b_name_group.trim()
  if (name.length === 0) {
    throw new Error("Name of the farm group is required")
  }
  return name
}

/**
 * Throws when another group in the organization already uses the name.
 */
async function assertGroupNameAvailable(
  fdm: FdmType,
  b_id_organization: string,
  b_name_group: string,
  b_id_group?: string,
): Promise<void> {
  const groups = await fdm
    .select({
      b_id_group: schema.farmGroups.b_id_group,
      b_name_group: schema.farmGroups.b_name_group,
    })
    .from(schema.farmGroups)
    .where(eq(schema.farmGroups.b_id_organization, b_id_organization))
  const taken = groups.some(
    (g: { b_id_group: string; b_name_group: string }) =>
      g.b_id_group !== b_id_group && g.b_name_group.toLowerCase() === b_name_group.toLowerCase(),
  )
  if (taken) {
    throw new Error("A farm group with this name already exists in the organization")
  }
}

/**
 * Derives the current members of the given groups from the joining and leaving events.
 *
 * A farm is a member of a group when its latest joining is later than its latest leaving
 * (or when it never left).
 *
 * @returns A map of group id to the set of ids of the farms that are currently a member.
 */
async function getActiveMembers(
  fdm: FdmType,
  b_id_groups: string[],
): Promise<Map<string, Set<string>>> {
  const members = new Map<string, Set<string>>()
  for (const id of b_id_groups) {
    members.set(id, new Set())
  }
  if (b_id_groups.length === 0) {
    return members
  }

  const joinings = await fdm
    .select({
      b_id_group: schema.farmGroupJoining.b_id_group,
      b_id_farm: schema.farmGroupJoining.b_id_farm,
      b_start: schema.farmGroupJoining.b_start,
    })
    .from(schema.farmGroupJoining)
    .where(inArray(schema.farmGroupJoining.b_id_group, b_id_groups))
  const leavings = await fdm
    .select({
      b_id_group: schema.farmGroupLeaving.b_id_group,
      b_id_farm: schema.farmGroupLeaving.b_id_farm,
      b_end: schema.farmGroupLeaving.b_end,
    })
    .from(schema.farmGroupLeaving)
    .where(inArray(schema.farmGroupLeaving.b_id_group, b_id_groups))

  const latestStart = new Map<string, number>()
  for (const j of joinings) {
    const key = `${j.b_id_group}|${j.b_id_farm}`
    latestStart.set(key, Math.max(latestStart.get(key) ?? 0, j.b_start.getTime()))
  }
  const latestEnd = new Map<string, number>()
  for (const l of leavings) {
    const key = `${l.b_id_group}|${l.b_id_farm}`
    latestEnd.set(key, Math.max(latestEnd.get(key) ?? 0, l.b_end.getTime()))
  }

  for (const [key, start] of latestStart) {
    const end = latestEnd.get(key)
    if (end === undefined || start > end) {
      const [b_id_group, b_id_farm] = key.split("|")
      members.get(b_id_group)?.add(b_id_farm)
    }
  }
  return members
}

/**
 * Creates a farm group within an organization.
 *
 * A farm group is a named, organization-scoped grouping of farms. A farm can belong to
 * multiple groups. Groups organize the farm overviews and act as a saved selection of
 * farms; they do not grant any access to the farms. The organization is granted the
 * "owner" role on the group, so all its members can use it.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal creating the group. Must be a member of the organization.
 * @param b_id_organization - The identifier of the organization the group belongs to.
 * @param b_name_group - The name of the group. Must be unique within the organization (case-insensitive).
 * @returns The identifier of the new group.
 *
 * @throws {Error} If the principal is not a member of the organization, the name is empty or already in use.
 *
 * @alpha
 */
export async function createFarmGroup(
  fdm: FdmType,
  principal_id: string,
  b_id_organization: schema.farmGroupsTypeInsert["b_id_organization"],
  b_name_group: schema.farmGroupsTypeInsert["b_name_group"],
): Promise<schema.farmGroupsTypeSelect["b_id_group"]> {
  try {
    return await fdm.transaction(async (tx: FdmType) => {
      await assertOrganizationMember(tx, principal_id, b_id_organization)
      const name = normalizeGroupName(b_name_group)
      await assertGroupNameAvailable(tx, b_id_organization, name)

      const b_id_group = createId()
      await tx.insert(schema.farmGroups).values({
        b_id_group,
        b_id_organization,
        b_name_group: name,
      })
      await grantRole(tx, "farm_group", "owner", b_id_group, b_id_organization)
      return b_id_group
    })
  } catch (err) {
    throw handleError(err, "Exception for createFarmGroup", {
      b_id_organization,
      b_name_group,
    })
  }
}

/**
 * Retrieves a farm group, including the farms that currently belong to it.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting the group.
 * @param b_id_group - The identifier of the group.
 * @returns The group with its current member farms.
 *
 * @throws {Error} If the principal lacks read permission or the group does not exist.
 *
 * @alpha
 */
export async function getFarmGroup(
  fdm: FdmType,
  principal_id: string,
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"],
): Promise<FarmGroup> {
  try {
    await checkPermission(fdm, "farm_group", "read", b_id_group, principal_id, "getFarmGroup")

    const groups = await fdm
      .select()
      .from(schema.farmGroups)
      .where(eq(schema.farmGroups.b_id_group, b_id_group))
      .limit(1)
    if (groups.length === 0) {
      throw new Error("Farm group not found")
    }
    const members = await getActiveMembers(fdm, [b_id_group])
    return { ...groups[0], b_id_farms: [...(members.get(b_id_group) ?? [])].sort() }
  } catch (err) {
    throw handleError(err, "Exception for getFarmGroup", { b_id_group })
  }
}

/**
 * Lists the farm groups of an organization with their current member farms, ordered by name.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting the groups. Must be a member of the organization.
 * @param b_id_organization - The identifier of the organization.
 * @returns The groups of the organization; an empty array when there are none.
 *
 * @throws {Error} If the principal is not a member of the organization.
 *
 * @alpha
 */
export async function listFarmGroups(
  fdm: FdmType,
  principal_id: string,
  b_id_organization: schema.farmGroupsTypeSelect["b_id_organization"],
): Promise<FarmGroup[]> {
  try {
    await assertOrganizationMember(fdm, principal_id, b_id_organization)

    const groups = await fdm
      .select()
      .from(schema.farmGroups)
      .where(eq(schema.farmGroups.b_id_organization, b_id_organization))
      .orderBy(asc(schema.farmGroups.b_name_group))
    const members = await getActiveMembers(
      fdm,
      groups.map((g: schema.farmGroupsTypeSelect) => g.b_id_group),
    )
    return groups.map((g: schema.farmGroupsTypeSelect) => ({
      ...g,
      b_id_farms: [...(members.get(g.b_id_group) ?? [])].sort(),
    }))
  } catch (err) {
    throw handleError(err, "Exception for listFarmGroups", { b_id_organization })
  }
}

/**
 * Renames a farm group.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal renaming the group.
 * @param b_id_group - The identifier of the group.
 * @param b_name_group - The new name. Must be unique within the organization (case-insensitive).
 *
 * @throws {Error} If the principal lacks write permission, the name is empty or already in use.
 *
 * @alpha
 */
export async function renameFarmGroup(
  fdm: FdmType,
  principal_id: string,
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"],
  b_name_group: schema.farmGroupsTypeSelect["b_name_group"],
): Promise<void> {
  try {
    await fdm.transaction(async (tx: FdmType) => {
      await checkPermission(tx, "farm_group", "write", b_id_group, principal_id, "renameFarmGroup")
      const name = normalizeGroupName(b_name_group)

      const groups = await tx
        .select({ b_id_organization: schema.farmGroups.b_id_organization })
        .from(schema.farmGroups)
        .where(eq(schema.farmGroups.b_id_group, b_id_group))
        .limit(1)
      if (groups.length === 0) {
        throw new Error("Farm group not found")
      }
      await assertGroupNameAvailable(tx, groups[0].b_id_organization, name, b_id_group)

      await tx
        .update(schema.farmGroups)
        .set({ b_name_group: name, updated: new Date() })
        .where(eq(schema.farmGroups.b_id_group, b_id_group))
    })
  } catch (err) {
    throw handleError(err, "Exception for renameFarmGroup", { b_id_group, b_name_group })
  }
}

/**
 * Removes a farm group, including its membership events and the roles granted on it.
 *
 * The farms themselves are not affected. Unlike ending a single membership, which records
 * a leaving event, removing a group removes the group and its history entirely.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal removing the group.
 * @param b_id_group - The identifier of the group.
 *
 * @throws {Error} If the principal lacks write permission.
 *
 * @alpha
 */
export async function removeFarmGroup(
  fdm: FdmType,
  principal_id: string,
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"],
): Promise<void> {
  try {
    await checkPermission(fdm, "farm_group", "write", b_id_group, principal_id, "removeFarmGroup")

    await fdm.transaction(async (tx: FdmType) => {
      await tx
        .delete(schema.farmGroupJoining)
        .where(eq(schema.farmGroupJoining.b_id_group, b_id_group))
      await tx
        .delete(schema.farmGroupLeaving)
        .where(eq(schema.farmGroupLeaving.b_id_group, b_id_group))

      const principals = await listPrincipalsForResource(tx, "farm_group", b_id_group)
      for (const principal of principals) {
        await revokePrincipal(tx, "farm_group", b_id_group, principal.principal_id)
      }

      await tx.delete(schema.farmGroups).where(eq(schema.farmGroups.b_id_group, b_id_group))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeFarmGroup", { b_id_group })
  }
}

/**
 * Adds a farm to a group by recording a joining event. Does nothing if the farm already is a member.
 *
 * The farm must belong to the organization of the group, meaning the organization holds a role on it.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal adding the farm. Needs write permission on the group and read permission on the farm.
 * @param b_id_group - The identifier of the group.
 * @param b_id_farm - The identifier of the farm.
 *
 * @throws {Error} If the principal lacks permission or the farm does not belong to the organization of the group.
 *
 * @alpha
 */
export async function addFarmToGroup(
  fdm: FdmType,
  principal_id: string,
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"],
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<void> {
  try {
    await fdm.transaction(async (tx: FdmType) => {
      await checkPermission(tx, "farm_group", "write", b_id_group, principal_id, "addFarmToGroup")
      await checkPermission(tx, "farm", "read", b_id_farm, principal_id, "addFarmToGroup")

      const groups = await tx
        .select({ b_id_organization: schema.farmGroups.b_id_organization })
        .from(schema.farmGroups)
        .where(eq(schema.farmGroups.b_id_group, b_id_group))
        .limit(1)
      if (groups.length === 0) {
        throw new Error("Farm group not found")
      }
      const organizationRole = await tx
        .select({ role_id: authZSchema.role.role_id })
        .from(authZSchema.role)
        .where(
          and(
            eq(authZSchema.role.resource, "farm"),
            eq(authZSchema.role.resource_id, b_id_farm),
            eq(authZSchema.role.principal_id, groups[0].b_id_organization),
            isNull(authZSchema.role.deleted),
          ),
        )
        .limit(1)
      if (organizationRole.length === 0) {
        throw new Error("Farm does not belong to the organization of the group")
      }

      const members = await getActiveMembers(tx, [b_id_group])
      if (members.get(b_id_group)?.has(b_id_farm)) {
        return
      }

      // The start must be later than a previous leaving, otherwise the membership would not be active again
      const previousLeaving = await tx
        .select({ b_end: schema.farmGroupLeaving.b_end })
        .from(schema.farmGroupLeaving)
        .where(
          and(
            eq(schema.farmGroupLeaving.b_id_group, b_id_group),
            eq(schema.farmGroupLeaving.b_id_farm, b_id_farm),
          ),
        )
      const latestEnd = Math.max(
        0,
        ...previousLeaving.map((l: { b_end: Date }) => l.b_end.getTime()),
      )
      const b_start = new Date(Math.max(Date.now(), latestEnd + 1))

      await tx.insert(schema.farmGroupJoining).values({ b_id_group, b_id_farm, b_start })
    })
  } catch (err) {
    throw handleError(err, "Exception for addFarmToGroup", { b_id_group, b_id_farm })
  }
}

/**
 * Removes a farm from a group by recording a leaving event. Does nothing if the farm is not a member.
 *
 * No rows are deleted, so the history of the membership stays available.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal removing the farm. Needs write permission on the group.
 * @param b_id_group - The identifier of the group.
 * @param b_id_farm - The identifier of the farm.
 *
 * @throws {Error} If the principal lacks write permission on the group.
 *
 * @alpha
 */
export async function removeFarmFromGroup(
  fdm: FdmType,
  principal_id: string,
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"],
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<void> {
  try {
    await fdm.transaction(async (tx: FdmType) => {
      await checkPermission(
        tx,
        "farm_group",
        "write",
        b_id_group,
        principal_id,
        "removeFarmFromGroup",
      )

      const members = await getActiveMembers(tx, [b_id_group])
      if (!members.get(b_id_group)?.has(b_id_farm)) {
        return
      }

      // The end must not be before the latest joining, otherwise the membership would stay active
      const previousJoining = await tx
        .select({ b_start: schema.farmGroupJoining.b_start })
        .from(schema.farmGroupJoining)
        .where(
          and(
            eq(schema.farmGroupJoining.b_id_group, b_id_group),
            eq(schema.farmGroupJoining.b_id_farm, b_id_farm),
          ),
        )
      const latestStart = Math.max(
        0,
        ...previousJoining.map((j: { b_start: Date }) => j.b_start.getTime()),
      )
      const b_end = new Date(Math.max(Date.now(), latestStart))

      await tx.insert(schema.farmGroupLeaving).values({ b_id_group, b_id_farm, b_end })
    })
  } catch (err) {
    throw handleError(err, "Exception for removeFarmFromGroup", { b_id_group, b_id_farm })
  }
}
