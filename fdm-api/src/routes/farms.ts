import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CreateFarmBodySchema,
  createFarm,
  deleteFarm,
  FarmParamsSchema,
  FarmSchema,
  type FarmServices,
  getFarm,
  ListFarmsFilterSchema,
  listFarms,
  UpdateFarmBodySchema,
  updateFarm,
} from "../operations/farms"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { FarmServices } from "../operations/farms"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const ListFarmsQuerySchema = PaginationQuerySchema.extend(ListFarmsFilterSchema.shape)

const listFarmsRoute = createRoute({
  operationId: listFarms.name,
  method: "get",
  path: "/farms",
  tags: ["Farms"],
  summary: "List all farms",
  description: "Returns all farms accessible by the authenticated API key.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { query: ListFarmsQuerySchema },
  responses: {
    200: {
      description: "A paginated list of farms.",
      content: {
        "application/json": { schema: paginatedSchema(FarmSchema) },
      },
    },
    ...commonErrorResponses,
  },
})

const getFarmRoute = createRoute({
  operationId: getFarm.name,
  method: "get",
  path: "/farms/{b_id_farm}",
  tags: ["Farms"],
  summary: "Get a farm",
  description: "Returns a single farm by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FarmParamsSchema },
  responses: {
    200: {
      description: "The requested farm.",
      content: { "application/json": { schema: FarmSchema } },
    },
    ...commonErrorResponses,
  },
})

const createFarmRoute = createRoute({
  operationId: createFarm.name,
  method: "post",
  path: "/farms",
  tags: ["Farms"],
  summary: "Create a farm",
  description:
    "Creates a new farm. The authenticated API key's owner becomes the farm owner. Default fertilizer, cultivation, and field measure catalogues are enabled.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateFarmBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Farm created.",
      content: { "application/json": { schema: FarmSchema } },
    },
    ...writeErrorResponses,
  },
})

const updateFarmRoute = createRoute({
  operationId: updateFarm.name,
  method: "patch",
  path: "/farms/{b_id_farm}",
  tags: ["Farms"],
  summary: "Update a farm",
  description:
    "Partially updates the metadata of an existing farm. Only supplied fields are changed.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmParamsSchema,
    body: {
      content: { "application/json": { schema: UpdateFarmBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Farm updated.",
      content: { "application/json": { schema: FarmSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteFarmRoute = createRoute({
  operationId: deleteFarm.name,
  method: "delete",
  path: "/farms/{b_id_farm}",
  tags: ["Farms"],
  summary: "Delete a farm",
  description:
    "Permanently deletes a farm and all its associated fields, cultivations, and soil analyses.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FarmParamsSchema },
  responses: {
    204: { description: "Farm deleted." },
    ...commonErrorResponses,
  },
})

/**
 * Registers the farm CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Farm service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested farm cannot be found.
 * @example
 * ```ts
 * registerFarmRoutes(app, fdm, services)
 * ```
 */
export function registerFarmRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FarmServices,
): void {
  app.use("/farms", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/farms/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listFarmsHandler: RouteHandler<typeof listFarmsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...filter } = c.req.valid("query") as z.infer<
      typeof ListFarmsQuerySchema
    >
    const farms = await listFarms.run(operationContext(c, fdm, services), filter)
    return c.json(paginatedResponse(farms, limit, offset), 200)
  }

  const getFarmHandler: RouteHandler<typeof getFarmRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    return c.json(await getFarm.run(operationContext(c, fdm, services), params), 200)
  }

  const createFarmHandler: RouteHandler<typeof createFarmRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateFarmBodySchema>
    const farm = await createFarm.run(operationContext(c, fdm, services), body)
    c.header("Location", `${new URL(c.req.url).origin}/farms/${farm.b_id_farm}`)
    return c.json(farm, 201)
  }

  const updateFarmHandler: RouteHandler<typeof updateFarmRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateFarmBodySchema>
    const farm = await updateFarm.run(operationContext(c, fdm, services), { ...params, ...body })
    return c.json(farm, 200)
  }

  const deleteFarmHandler: RouteHandler<typeof deleteFarmRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    await deleteFarm.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listFarmsRoute, listFarmsHandler)
  app.openapi(getFarmRoute, getFarmHandler)
  app.openapi(createFarmRoute, createFarmHandler)
  app.openapi(updateFarmRoute, updateFarmHandler)
  app.openapi(deleteFarmRoute, deleteFarmHandler)
}
