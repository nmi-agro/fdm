import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import type { FarmGroup, FarmGroupMembership } from "./farm-group.types"
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
 * Throws when the date is not a valid date.
 */
function assertValidDate(date: Date, description: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`${description} is not a valid date`)
  }
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

type Period = { b_group_joined: Date; b_group_leaved: Date | null }

/**
 * Derives the periods in which farms are part of the given groups from the joining and leaving events.
 *
 * Every joining starts a period. The period ends at the first leaving that is later than the
 * joining and not later than the next joining of the same farm; without such a leaving the
 * period has no end date. The dates are the dates that users have chosen: from when and until
 * when the farm is part of the group.
 *
 * @returns A map of group id to a map of farm id to the periods of that farm, ordered by start date.
 */
async function getPeriods(
  fdm: FdmType,
  b_id_groups: string[],
): Promise<Map<string, Map<string, Period[]>>> {
  const result = new Map<string, Map<string, Period[]>>()
  for (const id of b_id_groups) {
    result.set(id, new Map())
  }
  if (b_id_groups.length === 0) {
    return result
  }

  const joinings = await fdm
    .select({
      b_id_group: schema.farmGroupJoining.b_id_group,
      b_id_farm: schema.farmGroupJoining.b_id_farm,
      b_group_joined: schema.farmGroupJoining.b_group_joined,
    })
    .from(schema.farmGroupJoining)
    .where(inArray(schema.farmGroupJoining.b_id_group, b_id_groups))
    .orderBy(asc(schema.farmGroupJoining.b_group_joined))
  const leavings = await fdm
    .select({
      b_id_group: schema.farmGroupLeaving.b_id_group,
      b_id_farm: schema.farmGroupLeaving.b_id_farm,
      b_group_leaved: schema.farmGroupLeaving.b_group_leaved,
    })
    .from(schema.farmGroupLeaving)
    .where(inArray(schema.farmGroupLeaving.b_id_group, b_id_groups))
    .orderBy(asc(schema.farmGroupLeaving.b_group_leaved))

  const joinedByKey = new Map<string, Date[]>()
  for (const j of joinings) {
    const key = `${j.b_id_group}|${j.b_id_farm}`
    joinedByKey.set(key, [...(joinedByKey.get(key) ?? []), j.b_group_joined])
  }
  const leavedByKey = new Map<string, Date[]>()
  for (const l of leavings) {
    const key = `${l.b_id_group}|${l.b_id_farm}`
    leavedByKey.set(key, [...(leavedByKey.get(key) ?? []), l.b_group_leaved])
  }

  for (const [key, joined] of joinedByKey) {
    const [b_id_group, b_id_farm] = key.split("|")
    const leaved = leavedByKey.get(key) ?? []
    const periods: Period[] = joined.map((start, index) => {
      const next = joined[index + 1]
      const end = leaved.find(
        (date) => date > start && (next === undefined || date.getTime() <= next.getTime()),
      )
      return { b_group_joined: start, b_group_leaved: end ?? null }
    })
    result.get(b_id_group)?.set(b_id_farm, periods)
  }
  return result
}

/**
 * Checks whether a farm is part of the group at a moment in time.
 */
function isMemberAt(periods: Period[] | undefined, at: Date): boolean {
  return (periods ?? []).some(
    (period) =>
      period.b_group_joined.getTime() <= at.getTime() &&
      (period.b_group_leaved === null || period.b_group_leaved.getTime() > at.getTime()),
  )
}

/**
 * Lists the periods of all farms in a group and the farms that are part of it now.
 */
function summarizeMembers(farms: Map<string, Period[]> | undefined): {
  b_id_farms: string[]
  memberships: FarmGroupMembership[]
} {
  const now = new Date()
  const b_id_farms: string[] = []
  const memberships: FarmGroupMembership[] = []
  for (const [b_id_farm, periods] of farms ?? []) {
    if (isMemberAt(periods, now)) {
      b_id_farms.push(b_id_farm)
    }
    for (const period of periods) {
      memberships.push({ b_id_farm, ...period })
    }
  }
  memberships.sort(
    (a, b) =>
      a.b_group_joined.getTime() - b.b_group_joined.getTime() ||
      a.b_id_farm.localeCompare(b.b_id_farm),
  )
  return { b_id_farms: b_id_farms.sort(), memberships }
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
 * Retrieves a farm group, including the farms that are part of it now and all membership periods.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting the group.
 * @param b_id_group - The identifier of the group.
 * @returns The group with `b_id_farms` (the farms that are part of the group at this moment) and `memberships` (every period in which a farm is or was part of the group).
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
    const periods = await getPeriods(fdm, [b_id_group])
    return { ...groups[0], ...summarizeMembers(periods.get(b_id_group)) }
  } catch (err) {
    throw handleError(err, "Exception for getFarmGroup", { b_id_group })
  }
}

/**
 * Lists the farm groups of an organization with their members, ordered by name.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal requesting the groups. Must be a member of the organization.
 * @param b_id_organization - The identifier of the organization.
 * @returns The groups of the organization; an empty array when there are none. See {@link getFarmGroup} for `b_id_farms` and `memberships`.
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
    const periods = await getPeriods(
      fdm,
      groups.map((g: schema.farmGroupsTypeSelect) => g.b_id_group),
    )
    return groups.map((g: schema.farmGroupsTypeSelect) => ({
      ...g,
      ...summarizeMembers(periods.get(g.b_id_group)),
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
 * Adds a farm to a group from a date, by recording a joining event.
 *
 * The date is the date from which the farm is part of the group, as chosen by the user. It is
 * not the moment this function is called, so it can lie in the past or in the future. Without a
 * date the farm is part of the group from now. Does nothing if the farm already is part of the
 * group on that date.
 *
 * The farm must belong to the organization of the group, meaning the organization holds a role on it.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal adding the farm. Needs write permission on the group and read permission on the farm.
 * @param b_id_group - The identifier of the group.
 * @param b_id_farm - The identifier of the farm.
 * @param b_group_joined - Optional. The date from which the farm is part of the group. Defaults to now.
 *
 * @throws {Error} If the principal lacks permission, the date is invalid, the farm does not belong to the organization of the group, or the farm already is part of the group from a later date.
 *
 * @alpha
 */
export async function addFarmToGroup(
  fdm: FdmType,
  principal_id: string,
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"],
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  b_group_joined?: schema.farmGroupJoiningTypeInsert["b_group_joined"],
): Promise<void> {
  try {
    await fdm.transaction(async (tx: FdmType) => {
      await checkPermission(tx, "farm_group", "write", b_id_group, principal_id, "addFarmToGroup")
      await checkPermission(tx, "farm", "read", b_id_farm, principal_id, "addFarmToGroup")
      if (b_group_joined !== undefined) {
        assertValidDate(b_group_joined, "The date from which the farm is part of the group")
      }

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

      const periods = (await getPeriods(tx, [b_id_group])).get(b_id_group)?.get(b_id_farm) ?? []

      // Without a date the farm is part of the group from now, but never before it last left
      const latestLeaved = Math.max(
        0,
        ...periods.map((period) => period.b_group_leaved?.getTime() ?? 0),
      )
      const joined = b_group_joined ?? new Date(Math.max(Date.now(), latestLeaved))

      if (isMemberAt(periods, joined)) {
        return
      }
      if (periods.some((period) => period.b_group_joined.getTime() > joined.getTime())) {
        throw new Error("Farm already is part of the group from a later date")
      }

      await tx
        .insert(schema.farmGroupJoining)
        .values({ b_id_group, b_id_farm, b_group_joined: joined })
    })
  } catch (err) {
    throw handleError(err, "Exception for addFarmToGroup", {
      b_id_group,
      b_id_farm,
      b_group_joined: b_group_joined?.toString(),
    })
  }
}

/**
 * Ends the membership of a farm in a group on a date, by recording a leaving event.
 *
 * The date is the date until which the farm is part of the group, as chosen by the user. It is
 * not the moment this function is called, so it can lie in the past or in the future. Without a
 * date the farm leaves the group now. No rows are deleted, so the history stays available.
 * Does nothing if the farm is not part of the group on that date, unless the date lies on or before
 * the start of the open period of the farm; that is rejected.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal removing the farm. Needs write permission on the group.
 * @param b_id_group - The identifier of the group.
 * @param b_id_farm - The identifier of the farm.
 * @param b_group_leaved - Optional. The date until which the farm is part of the group. Defaults to now.
 *
 * @throws {Error} If the principal lacks write permission, the date is invalid or not after the date from which the farm is part of the group, or the membership already has an end date.
 *
 * @alpha
 */
export async function removeFarmFromGroup(
  fdm: FdmType,
  principal_id: string,
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"],
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  b_group_leaved?: schema.farmGroupLeavingTypeInsert["b_group_leaved"],
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
      if (b_group_leaved !== undefined) {
        assertValidDate(b_group_leaved, "The date until which the farm is part of the group")
      }

      const periods = (await getPeriods(tx, [b_id_group])).get(b_id_group)?.get(b_id_farm) ?? []

      // Without a date the farm leaves now, but never before it last joined
      const latestJoined = Math.max(0, ...periods.map((p) => p.b_group_joined.getTime()))
      let leaved = b_group_leaved ?? new Date(Math.max(Date.now(), latestJoined))
      const period = periods.find(
        (p) =>
          p.b_group_joined.getTime() <= leaved.getTime() &&
          (p.b_group_leaved === null || p.b_group_leaved.getTime() > leaved.getTime()),
      )
      if (!period) {
        // An end date on or before the start of an open period is a mistake, not a no-op
        if (
          b_group_leaved !== undefined &&
          periods.some(
            (p) =>
              p.b_group_leaved === null && p.b_group_joined.getTime() >= b_group_leaved.getTime(),
          )
        ) {
          throw new Error(
            "The end date must be after the date from which the farm is part of the group",
          )
        }
        return
      }
      if (period.b_group_joined.getTime() === leaved.getTime()) {
        if (b_group_leaved !== undefined) {
          throw new Error(
            "The end date must be after the date from which the farm is part of the group",
          )
        }
        // Without a date, a farm that joined in this very moment leaves a moment later
        leaved = new Date(leaved.getTime() + 1)
      }
      if (period.b_group_leaved !== null) {
        throw new Error("The membership already has an end date")
      }

      await tx
        .insert(schema.farmGroupLeaving)
        .values({ b_id_group, b_id_farm, b_group_leaved: leaved })
    })
  } catch (err) {
    throw handleError(err, "Exception for removeFarmFromGroup", {
      b_id_group,
      b_id_farm,
      b_group_leaved: b_group_leaved?.toString(),
    })
  }
}

/**
 * Changes the dates of an existing period in which a farm is part of a group.
 *
 * The period is identified by its current start date. The start date can be moved, the end date
 * can be set, moved or removed (`null`). The dates are the dates that users have chosen, not the
 * moment of the change. The new period may not overlap another period of the same farm in the
 * group.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with {@link createFdmServer}.
 * @param principal_id - The identifier of the principal changing the period. Needs write permission on the group.
 * @param b_id_group - The identifier of the group.
 * @param b_id_farm - The identifier of the farm.
 * @param b_group_joined - The current start date of the period, which identifies it.
 * @param changes - The new dates. Omit a date to keep it. Use `null` for `b_group_leaved` to remove the end date.
 *
 * @throws {Error} If the principal lacks write permission, a date is invalid, the period does not exist, the end date is not after the start date, or the period would overlap another period of the farm.
 *
 * @alpha
 */
export async function updateFarmGroupMembership(
  fdm: FdmType,
  principal_id: string,
  b_id_group: schema.farmGroupsTypeSelect["b_id_group"],
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  b_group_joined: schema.farmGroupJoiningTypeSelect["b_group_joined"],
  changes: {
    b_group_joined?: schema.farmGroupJoiningTypeInsert["b_group_joined"]
    b_group_leaved?: schema.farmGroupLeavingTypeInsert["b_group_leaved"] | null
  },
): Promise<void> {
  try {
    await fdm.transaction(async (tx: FdmType) => {
      await checkPermission(
        tx,
        "farm_group",
        "write",
        b_id_group,
        principal_id,
        "updateFarmGroupMembership",
      )
      assertValidDate(b_group_joined, "The current start date of the period")
      if (changes.b_group_joined !== undefined) {
        assertValidDate(changes.b_group_joined, "The date from which the farm is part of the group")
      }
      if (changes.b_group_leaved) {
        assertValidDate(
          changes.b_group_leaved,
          "The date until which the farm is part of the group",
        )
      }

      const periods = (await getPeriods(tx, [b_id_group])).get(b_id_group)?.get(b_id_farm) ?? []
      const current = periods.find((p) => p.b_group_joined.getTime() === b_group_joined.getTime())
      if (!current) {
        throw new Error("Farm group membership not found")
      }

      const newJoined = changes.b_group_joined ?? current.b_group_joined
      const newLeaved =
        changes.b_group_leaved === undefined ? current.b_group_leaved : changes.b_group_leaved
      if (newLeaved && newLeaved.getTime() <= newJoined.getTime()) {
        throw new Error(
          "The end date must be after the date from which the farm is part of the group",
        )
      }
      const unchanged =
        newJoined.getTime() === current.b_group_joined.getTime() &&
        (newLeaved?.getTime() ?? null) === (current.b_group_leaved?.getTime() ?? null)
      if (unchanged) {
        return
      }

      // A farm is part of a group once at a time, so periods may touch but not overlap
      const overlaps = periods.some(
        (p) =>
          p !== current &&
          newJoined.getTime() < (p.b_group_leaved?.getTime() ?? Number.POSITIVE_INFINITY) &&
          p.b_group_joined.getTime() < (newLeaved?.getTime() ?? Number.POSITIVE_INFINITY),
      )
      if (overlaps) {
        throw new Error("The period overlaps another period of the farm in the group")
      }

      // The period consists of events, so replace them
      await tx
        .delete(schema.farmGroupJoining)
        .where(
          and(
            eq(schema.farmGroupJoining.b_id_group, b_id_group),
            eq(schema.farmGroupJoining.b_id_farm, b_id_farm),
            eq(schema.farmGroupJoining.b_group_joined, current.b_group_joined),
          ),
        )
      if (current.b_group_leaved) {
        await tx
          .delete(schema.farmGroupLeaving)
          .where(
            and(
              eq(schema.farmGroupLeaving.b_id_group, b_id_group),
              eq(schema.farmGroupLeaving.b_id_farm, b_id_farm),
              eq(schema.farmGroupLeaving.b_group_leaved, current.b_group_leaved),
            ),
          )
      }
      await tx
        .insert(schema.farmGroupJoining)
        .values({ b_id_group, b_id_farm, b_group_joined: newJoined })
      if (newLeaved) {
        await tx
          .insert(schema.farmGroupLeaving)
          .values({ b_id_group, b_id_farm, b_group_leaved: newLeaved })
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateFarmGroupMembership", {
      b_id_group,
      b_id_farm,
      b_group_joined: b_group_joined?.toString(),
    })
  }
}
