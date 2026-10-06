import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  addFarmToGroup,
  createFarmGroup,
  FdmType,
  getFarmGroup,
  listFarmGroups,
  removeFarmFromGroup,
  updateFarmGroupMembership,
  removeFarmGroup,
  renameFarmGroup,
} from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  DateStringSchema,
  serializeDate,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/**
 * Defines the farm group data access functions required by the farm group routes.
 */
export interface FarmGroupServices {
  /** Returns the farm groups of an organization, including their current member farms. */
  listFarmGroups: typeof listFarmGroups
  /** Returns a single farm group including its current member farms. */
  getFarmGroup: typeof getFarmGroup
  /** Creates a farm group within an organization. */
  createFarmGroup: typeof createFarmGroup
  /** Renames a farm group. */
  renameFarmGroup: typeof renameFarmGroup
  /** Permanently deletes a farm group and its membership events. */
  removeFarmGroup: typeof removeFarmGroup
  /** Records a farm joining a group. */
  addFarmToGroup: typeof addFarmToGroup
  /** Records a farm leaving a group. */
  removeFarmFromGroup: typeof removeFarmFromGroup
  updateFarmGroupMembership: typeof updateFarmGroupMembership
}

const FarmGroupMembershipSchema = z
  .object({
    b_id_farm: z.string(),
    b_group_joined: DateStringSchema.describe("Date from which the farm is part of the group."),
    b_group_leaved: DateStringSchema.nullable().describe(
      "Date until which the farm is part of the group, or null when there is no end date.",
    ),
  })
  .openapi("FarmGroupMembership")

const FarmGroupSchema = z
  .object({
    b_id_group: z.string(),
    b_id_organization: z.string(),
    b_name_group: z.string(),
    b_id_farms: z
      .array(z.string())
      .describe("Identifiers of the farms that are part of the group today."),
    memberships: z
      .array(FarmGroupMembershipSchema)
      .describe("Every period in which a farm is or was part of the group."),
  })
  .openapi("FarmGroup")

const CreateFarmGroupBodySchema = z
  .object({
    b_name_group: z
      .string()
      .min(1)
      .describe("Name of the group. Must be unique within the organization."),
  })
  .openapi("CreateFarmGroup")

const UpdateFarmGroupBodySchema = z
  .object({
    b_name_group: z
      .string()
      .min(1)
      .describe("New name of the group. Must be unique within the organization."),
  })
  .openapi("UpdateFarmGroup")

const AddFarmToGroupBodySchema = z
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

const RemoveFarmFromGroupQuerySchema = z.object({
  b_group_leaved: DateStringSchema.optional().describe(
    "Date until which the farm is part of the group (YYYY-MM-DD). This is the date the user chooses, not the date this request is made. Defaults to today.",
  ),
})

const UpdateGroupMembershipBodySchema = z
  .object({
    b_group_joined: DateStringSchema.describe(
      "Current start date of the period (YYYY-MM-DD). It identifies the period to change.",
    ),
    new_b_group_joined: DateStringSchema.optional().describe(
      "New date from which the farm is part of the group. Omit to keep the start date.",
    ),
    new_b_group_leaved: DateStringSchema.nullable()
      .optional()
      .describe(
        "New date until which the farm is part of the group. Use null to remove the end date. Omit to keep the end date.",
      ),
  })
  .openapi("UpdateFarmGroupMembership")

const listFarmGroupsRoute = createRoute({
  method: "get",
  path: "/organizations/{organization_id}/farm-groups",
  tags: ["Farm Groups"],
  summary: "List farm groups of an organization",
  description:
    "Returns the farm groups of an organization, ordered by name. The API key's owner must be a member of the organization.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ organization_id: z.string() }),
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of farm groups.",
      content: { "application/json": { schema: paginatedSchema(FarmGroupSchema) } },
    },
    ...commonErrorResponses,
  },
})

const createFarmGroupRoute = createRoute({
  method: "post",
  path: "/organizations/{organization_id}/farm-groups",
  tags: ["Farm Groups"],
  summary: "Create a farm group",
  description:
    "Creates a farm group within an organization. The API key's owner must be a member of the organization.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ organization_id: z.string() }),
    body: {
      content: { "application/json": { schema: CreateFarmGroupBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Farm group created.",
      content: { "application/json": { schema: FarmGroupSchema } },
    },
    ...writeErrorResponses,
  },
})

const getFarmGroupRoute = createRoute({
  method: "get",
  path: "/farm-groups/{b_id_group}",
  tags: ["Farm Groups"],
  summary: "Get a farm group",
  description: "Returns a farm group, including the identifiers of its current member farms.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id_group: z.string() }) },
  responses: {
    200: {
      description: "The requested farm group.",
      content: { "application/json": { schema: FarmGroupSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateFarmGroupRoute = createRoute({
  method: "patch",
  path: "/farm-groups/{b_id_group}",
  tags: ["Farm Groups"],
  summary: "Rename a farm group",
  description: "Renames a farm group.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_group: z.string() }),
    body: {
      content: { "application/json": { schema: UpdateFarmGroupBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Farm group renamed.",
      content: { "application/json": { schema: FarmGroupSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteFarmGroupRoute = createRoute({
  method: "delete",
  path: "/farm-groups/{b_id_group}",
  tags: ["Farm Groups"],
  summary: "Delete a farm group",
  description:
    "Permanently deletes a farm group and its membership history. The farms themselves are not affected.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id_group: z.string() }) },
  responses: {
    204: { description: "Farm group deleted." },
    ...commonErrorResponses,
  },
})

const addFarmToGroupRoute = createRoute({
  method: "post",
  path: "/farm-groups/{b_id_group}/farms",
  tags: ["Farm Groups"],
  summary: "Add a farm to a group",
  description:
    "Records that a farm is part of the group from a date, and optionally until a date. The dates are chosen by the caller and can lie in the past or the future. The farm must belong to the organization of the group. Adding a farm that already is part of the group on that date has no effect.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_group: z.string() }),
    body: {
      content: { "application/json": { schema: AddFarmToGroupBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Farm added to the group.",
      content: { "application/json": { schema: FarmGroupSchema } },
    },
    ...writeErrorResponses,
  },
})

const removeFarmFromGroupRoute = createRoute({
  method: "delete",
  path: "/farm-groups/{b_id_group}/farms/{b_id_farm}",
  tags: ["Farm Groups"],
  summary: "Remove a farm from a group",
  description:
    "Records the date until which a farm is part of the group (default: today). The membership history is kept. Removing a farm that is not part of the group on that date has no effect.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_group: z.string(), b_id_farm: z.string() }),
    query: RemoveFarmFromGroupQuerySchema,
  },
  responses: {
    204: { description: "Farm removed from the group." },
    ...commonErrorResponses,
  },
})

const updateGroupMembershipRoute = createRoute({
  method: "patch",
  path: "/farm-groups/{b_id_group}/farms/{b_id_farm}",
  tags: ["Farm Groups"],
  summary: "Change the dates of a membership period",
  description:
    "Changes the start and/or end date of an existing period in which a farm is part of the group. The period is identified by its current start date. The dates are chosen by the caller, not the moment of the request. A period may not overlap another period of the same farm in the group.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_group: z.string(), b_id_farm: z.string() }),
    body: {
      content: { "application/json": { schema: UpdateGroupMembershipBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The farm group with its updated periods.",
      content: { "application/json": { schema: FarmGroupSchema } },
    },
    ...writeErrorResponses,
  },
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
    cause.includes("overlaps")
  ) {
    throw new ApiError(409, "conflict", cause)
  }
  if (cause.includes("Farm group not found")) {
    throw new ApiError(404, "not-found", "Farm group not found.")
  }
  throw err
}

/**
 * Registers the farm group routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Farm group service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested farm group cannot be found, or on name conflicts.
 * @example
 * ```ts
 * registerFarmGroupRoutes(app, fdm, services)
 * ```
 */
export function registerFarmGroupRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FarmGroupServices,
): void {
  for (const path of ["/organizations/*", "/farm-groups", "/farm-groups/*"]) {
    app.use(path, (c, next) =>
      rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
    )
  }

  const listFarmGroupsHandler: RouteHandler<typeof listFarmGroupsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { organization_id } = c.req.valid("param") as { organization_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const groups = await services.listFarmGroups(
      fdm,
      principal.effectivePrincipalId,
      organization_id,
    )
    return c.json(paginatedResponse(groups.map(serialiseFarmGroup), limit, offset), 200)
  }

  const createFarmGroupHandler: RouteHandler<typeof createFarmGroupRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { organization_id } = c.req.valid("param") as { organization_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateFarmGroupBodySchema>
    let b_id_group: string
    try {
      b_id_group = await services.createFarmGroup(
        fdm,
        principal.effectivePrincipalId,
        organization_id,
        body.b_name_group,
      )
    } catch (err) {
      translateFarmGroupError(err)
    }
    const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    if (!group?.b_id_group) {
      throw new ApiError(500, "internal-error", "Farm group created but could not be retrieved.")
    }
    c.header("Location", `${new URL(c.req.url).origin}/farm-groups/${b_id_group}`)
    return c.json(serialiseFarmGroup(group), 201)
  }

  const getFarmGroupHandler: RouteHandler<typeof getFarmGroupRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group } = c.req.valid("param") as { b_id_group: string }
    let group: Awaited<ReturnType<typeof services.getFarmGroup>> | undefined
    try {
      group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    } catch (err) {
      translateFarmGroupError(err)
    }
    if (!group?.b_id_group) {
      throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    }
    return c.json(serialiseFarmGroup(group), 200)
  }

  const updateFarmGroupHandler: RouteHandler<typeof updateFarmGroupRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group } = c.req.valid("param") as { b_id_group: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateFarmGroupBodySchema>
    try {
      await services.renameFarmGroup(
        fdm,
        principal.effectivePrincipalId,
        b_id_group,
        body.b_name_group,
      )
    } catch (err) {
      translateFarmGroupError(err)
    }
    const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    if (!group?.b_id_group) {
      throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    }
    return c.json(serialiseFarmGroup(group), 200)
  }

  const deleteFarmGroupHandler: RouteHandler<typeof deleteFarmGroupRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group } = c.req.valid("param") as { b_id_group: string }
    await services.removeFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    return c.newResponse(null, 204)
  }

  const addFarmToGroupHandler: RouteHandler<typeof addFarmToGroupRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group } = c.req.valid("param") as { b_id_group: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof AddFarmToGroupBodySchema>
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
      )
      if (body.b_group_leaved) {
        await services.removeFarmFromGroup(
          fdm,
          principal.effectivePrincipalId,
          b_id_group,
          body.b_id_farm,
          new Date(body.b_group_leaved),
        )
      }
    } catch (err) {
      translateFarmGroupError(err)
    }
    const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    if (!group?.b_id_group) {
      throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    }
    return c.json(serialiseFarmGroup(group), 201)
  }

  const removeFarmFromGroupHandler: RouteHandler<typeof removeFarmFromGroupRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group, b_id_farm } = c.req.valid("param") as {
      b_id_group: string
      b_id_farm: string
    }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof RemoveFarmFromGroupQuerySchema>
    try {
      await services.removeFarmFromGroup(
        fdm,
        principal.effectivePrincipalId,
        b_id_group,
        b_id_farm,
        query.b_group_leaved ? new Date(query.b_group_leaved) : undefined,
      )
    } catch (err) {
      translateFarmGroupError(err)
    }
    return c.newResponse(null, 204)
  }

  const updateGroupMembershipHandler: RouteHandler<typeof updateGroupMembershipRoute> = async (
    c,
  ) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group, b_id_farm } = c.req.valid("param") as {
      b_id_group: string
      b_id_farm: string
    }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateGroupMembershipBodySchema>
    try {
      await services.updateFarmGroupMembership(
        fdm,
        principal.effectivePrincipalId,
        b_id_group,
        b_id_farm,
        new Date(body.b_group_joined),
        {
          b_group_joined: body.new_b_group_joined ? new Date(body.new_b_group_joined) : undefined,
          b_group_leaved:
            body.new_b_group_leaved === null
              ? null
              : body.new_b_group_leaved
                ? new Date(body.new_b_group_leaved)
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
    return c.json(serialiseFarmGroup(group), 200)
  }

  app.openapi(listFarmGroupsRoute, listFarmGroupsHandler)
  app.openapi(createFarmGroupRoute, createFarmGroupHandler)
  app.openapi(getFarmGroupRoute, getFarmGroupHandler)
  app.openapi(updateFarmGroupRoute, updateFarmGroupHandler)
  app.openapi(deleteFarmGroupRoute, deleteFarmGroupHandler)
  app.openapi(addFarmToGroupRoute, addFarmToGroupHandler)
  app.openapi(removeFarmFromGroupRoute, removeFarmFromGroupHandler)
  app.openapi(updateGroupMembershipRoute, updateGroupMembershipHandler)
}
