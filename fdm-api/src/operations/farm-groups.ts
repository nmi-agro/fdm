import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { ApiError } from "../error"
import { FarmGroupIdSchema, FarmIdSchema, OrganizationIdSchema } from "../fields"
import { DateStringSchema, serializeDate } from "../schemas"
import { DELETED, DeletedSchema } from "./common"
import { defineOperation, type OperationContext } from "./types"

/**
 * Defines the farm group data access functions required by the farm group operations.
 */
export interface FarmGroupServices {
  /** Returns the farm groups of an organization, including their current member farms. */
  listFarmGroups: typeof core.listFarmGroups
  /** Returns a single farm group including its current member farms. */
  getFarmGroup: typeof core.getFarmGroup
  /** Creates a farm group within an organization. */
  createFarmGroup: typeof core.createFarmGroup
  /** Renames a farm group. */
  renameFarmGroup: typeof core.renameFarmGroup
  /** Permanently deletes a farm group and its membership events. */
  removeFarmGroup: typeof core.removeFarmGroup
  /** Records a farm joining a group. */
  addFarmToGroup: typeof core.addFarmToGroup
  /** Records a farm leaving a group. */
  removeFarmFromGroup: typeof core.removeFarmFromGroup
  /** Changes the dates of a period in which a farm is part of a group. */
  updateFarmGroupMembership: typeof core.updateFarmGroupMembership
  /** Deletes a period in which a farm is part of a group, without keeping history. */
  removeFarmGroupMembership: typeof core.removeFarmGroupMembership
}

/** A period in which a farm is or was part of a farm group. */
export const FarmGroupMembershipSchema = z
  .object({
    b_id_farm: FarmIdSchema,
    b_group_joined: DateStringSchema.describe("Date from which the farm is part of the group."),
    b_group_leaved: DateStringSchema.nullable().describe(
      "Date until which the farm is part of the group, or null when there is no end date.",
    ),
  })
  .openapi("FarmGroupMembership")

/** A farm group as returned by the API, with its current members and membership history. */
export const FarmGroupSchema = z
  .object({
    b_id_group: FarmGroupIdSchema,
    b_id_organization: OrganizationIdSchema.describe(
      "Unique identifier of the organization that owns the group.",
    ),
    b_name_group: z.string().describe("Name of the group, unique within the organization."),
    b_id_farms: z
      .array(z.string())
      .describe("Identifiers of the farms that are part of the group today."),
    memberships: z
      .array(FarmGroupMembershipSchema)
      .describe("Every period in which a farm is or was part of the group."),
  })
  .openapi("FarmGroup")

/** Request body for creating a farm group. */
export const CreateFarmGroupBodySchema = z
  .object({
    b_name_group: z
      .string()
      .min(1)
      .describe("Name of the group. Must be unique within the organization."),
  })
  .openapi("CreateFarmGroup")

/** Request body for renaming a farm group. */
export const UpdateFarmGroupBodySchema = z
  .object({
    b_name_group: z
      .string()
      .min(1)
      .describe("New name of the group. Must be unique within the organization."),
  })
  .openapi("UpdateFarmGroup")

/** Request body for adding a farm to a farm group. */
export const AddFarmToGroupBodySchema = z
  .object({
    b_id_farm: z.string().min(1).describe("Identifier of the farm to add to the group."),
    b_group_joined: DateStringSchema.optional().describe(
      "Date from which the farm is part of the group (YYYY-MM-DD). This is the date the user chooses, not the date this request is made. Defaults to today.",
    ),
    b_group_leaved: DateStringSchema.optional().describe(
      "Date until which the farm is part of the group (YYYY-MM-DD). Omit when the farm is part of the group without an end date.",
    ),
  })
  .openapi("AddFarmToFarmGroup")

/** Options for removing a farm from a farm group. */
export const RemoveFarmFromGroupQuerySchema = z.object({
  b_group_leaved: DateStringSchema.optional().describe(
    "Date until which the farm is part of the group (YYYY-MM-DD). This is the date the user chooses, not the date this request is made. Defaults to today.",
  ),
})

/** Request body for changing the dates of a membership period. Only supplied dates are changed. */
export const UpdateGroupMembershipBodySchema = z
  .object({
    b_group_joined: DateStringSchema.optional().describe(
      "Updates the date from which the farm is part of the group (YYYY-MM-DD). Omit to keep the current join date.",
    ),
    b_group_leaved: DateStringSchema.nullable()
      .optional()
      .describe(
        "Updates the date until which the farm is part of the group (YYYY-MM-DD). Use null to remove the end date. Omit to keep the current end date.",
      ),
  })
  .openapi("UpdateFarmGroupMembership")

/** Path parameters that identify an organization. */
export const OrganizationParamsSchema = z.object({ organization_id: OrganizationIdSchema })

/** Path parameters that identify a farm group. */
export const FarmGroupParamsSchema = z.object({ b_id_group: FarmGroupIdSchema })

/** Path parameters that identify a farm in a farm group. */
export const FarmGroupFarmParamsSchema = z.object({
  b_id_group: FarmGroupIdSchema,
  b_id_farm: FarmIdSchema,
})

/** Path parameters that identify the membership period to change. */
export const UpdateGroupMembershipParamsSchema = z.object({
  b_id_group: FarmGroupIdSchema,
  b_id_farm: FarmIdSchema,
  b_group_joined: DateStringSchema.describe(
    "Current join date of the period (YYYY-MM-DD). It identifies the period to change.",
  ),
})

/** Path parameters that identify the membership period to delete. */
export const DeleteGroupMembershipParamsSchema = z.object({
  b_id_group: FarmGroupIdSchema,
  b_id_farm: FarmIdSchema,
  b_group_joined: DateStringSchema.describe(
    "Join date of the period (YYYY-MM-DD). It identifies the period to delete.",
  ),
})

function serialiseFarmGroup(group: {
  b_id_group: string
  b_id_organization: string
  b_name_group: string
  b_id_farms: string[]
  memberships: { b_id_farm: string; b_group_joined: Date; b_group_leaved: Date | null }[]
}) {
  return {
    b_id_group: group.b_id_group,
    b_id_organization: group.b_id_organization,
    b_name_group: group.b_name_group,
    b_id_farms: [...group.b_id_farms],
    memberships: group.memberships.map((membership) => ({
      b_id_farm: membership.b_id_farm,
      b_group_joined: serializeDate(membership.b_group_joined) as string,
      b_group_leaved: serializeDate(membership.b_group_leaved),
    })),
  }
}

/**
 * Translates validation and conflict errors raised by the farm group functions into API errors.
 * Other errors, such as permission denials, are rethrown for the central error handler.
 */
function translateFarmGroupError(err: unknown): never {
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : ""
  if (cause.includes("already exists")) {
    throw new ApiError(409, "conflict", "A farm group with this name already exists.")
  }
  if (cause.includes("Name of the farm group is required")) {
    throw new ApiError(400, "validation-failed", "The name of the farm group is required.")
  }
  if (cause.includes("does not belong to the organization")) {
    throw new ApiError(
      422,
      "unprocessable-entity",
      "The farm does not belong to the organization of the group.",
    )
  }
  if (cause.includes("not a valid date") || cause.includes("must be after")) {
    throw new ApiError(400, "validation-failed", cause)
  }
  if (cause.includes("Farm group membership not found")) {
    throw new ApiError(404, "not-found", "No period of this farm starts on that date.")
  }
  if (
    cause.includes("already has an end date") ||
    cause.includes("from a later date") ||
    cause.includes("already is part of the group on that date") ||
    cause.includes("has not started yet") ||
    cause.includes("overlaps")
  ) {
    throw new ApiError(409, "conflict", cause)
  }
  if (cause.includes("Farm group not found")) {
    throw new ApiError(404, "not-found", "Farm group not found.")
  }
  throw err
}

/** Lists the farm groups of an organization, ordered by name. */
export const listFarmGroups = defineOperation({
  name: "listFarmGroups",
  kind: "read",
  bucket: "general",
  input: OrganizationParamsSchema,
  output: z.array(FarmGroupSchema),
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { organization_id },
  ) => {
    const groups = await services.listFarmGroups(
      fdm,
      principal.effectivePrincipalId,
      organization_id,
    )
    return groups.map(serialiseFarmGroup)
  },
})

/** Creates a farm group within an organization. */
export const createFarmGroup = defineOperation({
  name: "createFarmGroup",
  kind: "create",
  bucket: "write",
  input: OrganizationParamsSchema.extend(CreateFarmGroupBodySchema.shape),
  output: FarmGroupSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { organization_id, b_name_group },
  ) => {
    let b_id_group: string
    try {
      b_id_group = await services.createFarmGroup(
        fdm,
        principal.effectivePrincipalId,
        organization_id,
        b_name_group,
      )
    } catch (err) {
      translateFarmGroupError(err)
    }
    const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    if (!group?.b_id_group) {
      throw new ApiError(500, "internal-error", "Farm group created but could not be retrieved.")
    }
    return serialiseFarmGroup(group)
  },
})

/** Returns a farm group, including the identifiers of its current member farms. */
export const getFarmGroup = defineOperation({
  name: "getFarmGroup",
  kind: "read",
  bucket: "general",
  input: FarmGroupParamsSchema,
  output: FarmGroupSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { b_id_group },
  ) => {
    let group: Awaited<ReturnType<typeof services.getFarmGroup>> | undefined
    try {
      group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    } catch (err) {
      translateFarmGroupError(err)
    }
    if (!group?.b_id_group) {
      throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    }
    return serialiseFarmGroup(group)
  },
})

/** Renames a farm group. */
export const updateFarmGroup = defineOperation({
  name: "updateFarmGroup",
  kind: "update",
  bucket: "write",
  input: FarmGroupParamsSchema.extend(UpdateFarmGroupBodySchema.shape),
  output: FarmGroupSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { b_id_group, b_name_group },
  ) => {
    try {
      await services.renameFarmGroup(fdm, principal.effectivePrincipalId, b_id_group, b_name_group)
    } catch (err) {
      translateFarmGroupError(err)
    }
    const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    if (!group?.b_id_group) {
      throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    }
    return serialiseFarmGroup(group)
  },
})

/** Permanently deletes a farm group and its membership history. The farms are not affected. */
export const deleteFarmGroup = defineOperation({
  name: "deleteFarmGroup",
  kind: "delete",
  bucket: "write",
  input: FarmGroupParamsSchema,
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { b_id_group },
  ) => {
    await services.removeFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    return DELETED
  },
})

/**
 * Records that a farm is part of a farm group from a date (default: today), and optionally until
 * a date. Returns the farm group with its updated memberships.
 */
export const addFarmToGroup = defineOperation({
  name: "addFarmToGroup",
  kind: "create",
  bucket: "write",
  input: FarmGroupParamsSchema.extend(AddFarmToGroupBodySchema.shape),
  output: FarmGroupSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { b_id_group, ...body },
  ) => {
    if (body.b_group_joined && body.b_group_leaved && body.b_group_leaved <= body.b_group_joined) {
      throw new ApiError(400, "validation-failed", "b_group_leaved must be after b_group_joined.")
    }
    try {
      await services.addFarmToGroup(
        fdm,
        principal.effectivePrincipalId,
        b_id_group,
        body.b_id_farm,
        body.b_group_joined ? new Date(body.b_group_joined) : undefined,
        body.b_group_leaved ? new Date(body.b_group_leaved) : undefined,
      )
    } catch (err) {
      translateFarmGroupError(err)
    }
    const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    if (!group?.b_id_group) {
      throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    }
    return serialiseFarmGroup(group)
  },
})

/**
 * Records the date until which a farm is part of a farm group (default: today). The membership
 * history is kept.
 */
export const removeFarmFromGroup = defineOperation({
  name: "removeFarmFromGroup",
  kind: "delete",
  bucket: "write",
  input: FarmGroupFarmParamsSchema.extend(RemoveFarmFromGroupQuerySchema.shape),
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { b_id_group, b_id_farm, b_group_leaved },
  ) => {
    try {
      await services.removeFarmFromGroup(
        fdm,
        principal.effectivePrincipalId,
        b_id_group,
        b_id_farm,
        b_group_leaved ? new Date(b_group_leaved) : undefined,
      )
    } catch (err) {
      translateFarmGroupError(err)
    }
    return DELETED
  },
})

/**
 * Input for changing the dates of a membership period. The period is identified by its current
 * join date `b_group_joined`; the new dates are nested under `changes`, because the new join date
 * has the same field name as the current one.
 */
export const UpdateGroupMembershipInputSchema = UpdateGroupMembershipParamsSchema.extend({
  changes: UpdateGroupMembershipBodySchema.describe("The dates to change. Omitted dates are kept."),
})

/**
 * Changes the join date and/or the end date of an existing period in which a farm is part of a
 * farm group. Returns the farm group with its updated memberships.
 */
export const updateFarmGroupMembership = defineOperation({
  name: "updateFarmGroupMembership",
  kind: "update",
  bucket: "write",
  input: UpdateGroupMembershipInputSchema,
  output: FarmGroupSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { b_id_group, b_id_farm, b_group_joined, changes },
  ) => {
    try {
      await services.updateFarmGroupMembership(
        fdm,
        principal.effectivePrincipalId,
        b_id_group,
        b_id_farm,
        new Date(b_group_joined),
        {
          b_group_joined: changes.b_group_joined ? new Date(changes.b_group_joined) : undefined,
          b_group_leaved:
            changes.b_group_leaved === null
              ? null
              : changes.b_group_leaved
                ? new Date(changes.b_group_leaved)
                : undefined,
        },
      )
    } catch (err) {
      translateFarmGroupError(err)
    }
    const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    if (!group?.b_id_group) {
      throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    }
    return serialiseFarmGroup(group)
  },
})

/**
 * Deletes a period in which a farm is part of a farm group, as if the farm never was part of the
 * group in that period. Other periods of the farm in the group are kept.
 */
export const deleteFarmGroupMembership = defineOperation({
  name: "deleteFarmGroupMembership",
  kind: "delete",
  bucket: "write",
  input: DeleteGroupMembershipParamsSchema,
  output: DeletedSchema,
  run: async (
    { fdm, services, principal }: OperationContext<FarmGroupServices>,
    { b_id_group, b_id_farm, b_group_joined },
  ) => {
    try {
      await services.removeFarmGroupMembership(
        fdm,
        principal.effectivePrincipalId,
        b_id_group,
        b_id_farm,
        new Date(b_group_joined),
      )
    } catch (err) {
      translateFarmGroupError(err)
    }
    return DELETED
  },
})
