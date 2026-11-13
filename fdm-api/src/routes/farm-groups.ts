import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, type z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  AddFarmToGroupBodySchema,
  addFarmToGroup,
  CreateFarmGroupBodySchema,
  createFarmGroup,
  DeleteGroupMembershipParamsSchema,
  deleteFarmGroup,
  deleteFarmGroupMembership,
  FarmGroupFarmParamsSchema,
  FarmGroupParamsSchema,
  FarmGroupSchema,
  type FarmGroupServices,
  getFarmGroup,
  listFarmGroups,
  OrganizationParamsSchema,
  RemoveFarmFromGroupQuerySchema,
  removeFarmFromGroup,
  UpdateFarmGroupBodySchema,
  UpdateGroupMembershipBodySchema,
  UpdateGroupMembershipParamsSchema,
  updateFarmGroup,
  updateFarmGroupMembership,
} from "../operations/farm-groups"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { FarmGroupServices } from "../operations/farm-groups"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listFarmGroupsRoute = createRoute({
  operationId: listFarmGroups.name,
  method: "get",
  path: "/organizations/{organization_id}/farm-groups",
  tags: ["Farm Groups"],
  summary: "List farm groups of an organization",
  description:
    "Returns the farm groups of an organization, ordered by name. The API key's owner must be a member of the organization.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: OrganizationParamsSchema,
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
  operationId: createFarmGroup.name,
  method: "post",
  path: "/organizations/{organization_id}/farm-groups",
  tags: ["Farm Groups"],
  summary: "Create a farm group",
  description:
    "Creates a farm group within an organization. The API key's owner must be a member of the organization.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: OrganizationParamsSchema,
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
  operationId: getFarmGroup.name,
  method: "get",
  path: "/farm-groups/{b_id_group}",
  tags: ["Farm Groups"],
  summary: "Get a farm group",
  description: "Returns a farm group, including the identifiers of its current member farms.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FarmGroupParamsSchema },
  responses: {
    200: {
      description: "The requested farm group.",
      content: { "application/json": { schema: FarmGroupSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateFarmGroupRoute = createRoute({
  operationId: updateFarmGroup.name,
  method: "patch",
  path: "/farm-groups/{b_id_group}",
  tags: ["Farm Groups"],
  summary: "Rename a farm group",
  description: "Renames a farm group.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmGroupParamsSchema,
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
  operationId: deleteFarmGroup.name,
  method: "delete",
  path: "/farm-groups/{b_id_group}",
  tags: ["Farm Groups"],
  summary: "Delete a farm group",
  description:
    "Permanently deletes a farm group and its membership history. The farms themselves are not affected.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FarmGroupParamsSchema },
  responses: {
    204: { description: "Farm group deleted." },
    ...commonErrorResponses,
  },
})

const addFarmToGroupRoute = createRoute({
  operationId: addFarmToGroup.name,
  method: "post",
  path: "/farm-groups/{b_id_group}/farms",
  tags: ["Farm Groups"],
  summary: "Add a farm to a group",
  description:
    "Records that a farm is part of the group from a date, and optionally until a date. The dates are chosen by the caller and can lie in the past or the future. The farm must belong to the organization of the group. The start and end date are stored together, so either the whole period is recorded or nothing is. Adding a farm that already is part of the group on the start date has no effect, unless an end date is given; that is rejected with a conflict.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmGroupParamsSchema,
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
  operationId: removeFarmFromGroup.name,
  method: "delete",
  path: "/farm-groups/{b_id_group}/farms/{b_id_farm}",
  tags: ["Farm Groups"],
  summary: "Remove a farm from a group",
  description:
    "Records the date until which a farm is part of the group (default: today). The membership history is kept. Removing a farm that is not part of the group on that date has no effect. A planned end date later than the given date (default: today) is moved forward to it. Without a date, a membership that starts in the future is rejected with a conflict.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmGroupFarmParamsSchema,
    query: RemoveFarmFromGroupQuerySchema,
  },
  responses: {
    204: { description: "Farm removed from the group." },
    ...commonErrorResponses,
  },
})

const updateGroupMembershipRoute = createRoute({
  operationId: updateFarmGroupMembership.name,
  method: "patch",
  path: "/farm-groups/{b_id_group}/farms/{b_id_farm}/{b_group_joined}",
  tags: ["Farm Groups"],
  summary: "Change the dates of a membership period",
  description:
    "Changes the join date and/or the end date of an existing period in which a farm is part of the group. The period is identified by the b_group_joined in the path, which is its current join date. A b_group_joined in the body updates the join date to that new date; a b_group_leaved in the body updates the end date (null removes it). The dates are chosen by the caller, not the moment of the request. A period may not overlap another period of the same farm in the group.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: UpdateGroupMembershipParamsSchema,
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

const deleteGroupMembershipRoute = createRoute({
  operationId: deleteFarmGroupMembership.name,
  method: "delete",
  path: "/farm-groups/{b_id_group}/farms/{b_id_farm}/{b_group_joined}",
  tags: ["Farm Groups"],
  summary: "Delete a membership period",
  description:
    "Deletes a period in which a farm is part of the group, as if the farm never was part of the group in that period. The period is identified by the b_group_joined in the path, its join date. Unlike removing a farm from a group, which records an end date and keeps the history, this removes the period itself, for example to correct a mistake. Other periods of the farm in the group are kept.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: DeleteGroupMembershipParamsSchema,
  },
  responses: {
    204: { description: "Membership period deleted." },
    ...commonErrorResponses,
  },
})

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
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof OrganizationParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const groups = await listFarmGroups.run(operationContext(c, fdm, services), params)
    return c.json(paginatedResponse(groups, limit, offset), 200)
  }

  const createFarmGroupHandler: RouteHandler<typeof createFarmGroupRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof OrganizationParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateFarmGroupBodySchema>
    const group = await createFarmGroup.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    c.header("Location", `${new URL(c.req.url).origin}/farm-groups/${group.b_id_group}`)
    return c.json(group, 201)
  }

  const getFarmGroupHandler: RouteHandler<typeof getFarmGroupRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmGroupParamsSchema>
    return c.json(await getFarmGroup.run(operationContext(c, fdm, services), params), 200)
  }

  const updateFarmGroupHandler: RouteHandler<typeof updateFarmGroupRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmGroupParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateFarmGroupBodySchema>
    const group = await updateFarmGroup.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(group, 200)
  }

  const deleteFarmGroupHandler: RouteHandler<typeof deleteFarmGroupRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmGroupParamsSchema>
    await deleteFarmGroup.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  const addFarmToGroupHandler: RouteHandler<typeof addFarmToGroupRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmGroupParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof AddFarmToGroupBodySchema>
    const group = await addFarmToGroup.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(group, 201)
  }

  const removeFarmFromGroupHandler: RouteHandler<typeof removeFarmFromGroupRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmGroupFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof RemoveFarmFromGroupQuerySchema>
    await removeFarmFromGroup.run(operationContext(c, fdm, services), { ...params, ...query })
    return c.newResponse(null, 204)
  }

  const updateGroupMembershipHandler: RouteHandler<typeof updateGroupMembershipRoute> = async (
    c,
  ) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof UpdateGroupMembershipParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateGroupMembershipBodySchema>
    // The body has its own b_group_joined (the new join date), so it is passed as `changes`.
    const group = await updateFarmGroupMembership.run(operationContext(c, fdm, services), {
      ...params,
      changes: body,
    })
    return c.json(group, 200)
  }

  const deleteGroupMembershipHandler: RouteHandler<typeof deleteGroupMembershipRoute> = async (
    c,
  ) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof DeleteGroupMembershipParamsSchema>
    await deleteFarmGroupMembership.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listFarmGroupsRoute, listFarmGroupsHandler)
  app.openapi(createFarmGroupRoute, createFarmGroupHandler)
  app.openapi(getFarmGroupRoute, getFarmGroupHandler)
  app.openapi(updateFarmGroupRoute, updateFarmGroupHandler)
  app.openapi(deleteFarmGroupRoute, deleteFarmGroupHandler)
  app.openapi(addFarmToGroupRoute, addFarmToGroupHandler)
  app.openapi(removeFarmFromGroupRoute, removeFarmFromGroupHandler)
  app.openapi(updateGroupMembershipRoute, updateGroupMembershipHandler)
  app.openapi(deleteGroupMembershipRoute, deleteGroupMembershipHandler)
}
