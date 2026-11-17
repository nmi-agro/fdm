import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CreateCustomFertilizerBodySchema,
  CreateFertilizerBodySchema,
  createCustomFertilizer,
  createFertilizer,
  deleteFertilizer,
  FertilizerFarmParamsSchema,
  FertilizerParamsSchema,
  FertilizerSchema,
  type FertilizerServices,
  getFertilizer,
  listFarmFertilizers,
  UpdateCustomFertilizerBodySchema,
  updateCustomFertilizer,
} from "../operations/fertilizers"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { FertilizerServices } from "../operations/fertilizers"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listFertilizersRoute = createRoute({
  operationId: listFarmFertilizers.name,
  method: "get",
  path: "/farms/{b_id_farm}/fertilizers",
  tags: ["Fertilizers"],
  summary: "List fertilizers on a farm",
  description: "Returns all fertilizers acquired for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FertilizerFarmParamsSchema,
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of fertilizers.",
      content: {
        "application/json": {
          schema: paginatedSchema(FertilizerSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const createFertilizerRoute = createRoute({
  operationId: createFertilizer.name,
  method: "post",
  path: "/farms/{b_id_farm}/fertilizers",
  tags: ["Fertilizers"],
  summary: "Acquire a fertilizer",
  description: "Creates a fertilizer acquisition for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FertilizerFarmParamsSchema,
    body: {
      content: {
        "application/json": { schema: CreateFertilizerBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Fertilizer acquired.",
      content: { "application/json": { schema: FertilizerSchema } },
    },
    ...writeErrorResponses,
  },
})

const createCustomFertilizerRoute = createRoute({
  operationId: createCustomFertilizer.name,
  method: "post",
  path: "/farms/{b_id_farm}/fertilizers/custom",
  tags: ["Fertilizers"],
  summary: "Create a custom fertilizer",
  description:
    "Creates a fertilizer with its own composition, available only to this farm, and acquires it for the farm. Properties that are omitted are stored as unknown (`null`). When `p_type` is omitted, it is derived from the other fertilizers of the farm with the same `p_type_rvo`. When `p_app_amount_unit` is omitted, `kg/ha` is used.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: FertilizerFarmParamsSchema,
    body: {
      content: {
        "application/json": { schema: CreateCustomFertilizerBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Custom fertilizer created and acquired.",
      content: { "application/json": { schema: FertilizerSchema } },
    },
    ...writeErrorResponses,
  },
})

const updateCustomFertilizerRoute = createRoute({
  operationId: updateCustomFertilizer.name,
  method: "patch",
  path: "/fertilizers/{p_id}",
  tags: ["Fertilizers"],
  summary: "Update a custom fertilizer",
  description:
    "Updates the properties of a custom fertilizer, one created with `POST /farms/{b_id_farm}/fertilizers/custom`. Only the properties in the body change. Fertilizers from a standard catalogue cannot be changed and return `422`.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: FertilizerParamsSchema,
    body: {
      content: {
        "application/json": { schema: UpdateCustomFertilizerBodySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The updated fertilizer.",
      content: { "application/json": { schema: FertilizerSchema } },
    },
    ...writeErrorResponses,
  },
})

const getFertilizerRoute = createRoute({
  operationId: getFertilizer.name,
  method: "get",
  path: "/fertilizers/{p_id}",
  tags: ["Fertilizers"],
  summary: "Get a fertilizer",
  description: "Returns a single fertilizer by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FertilizerParamsSchema },
  responses: {
    200: {
      description: "The requested fertilizer.",
      content: { "application/json": { schema: FertilizerSchema } },
    },
    ...commonErrorResponses,
  },
})

const deleteFertilizerRoute = createRoute({
  operationId: deleteFertilizer.name,
  method: "delete",
  path: "/fertilizers/{p_id}",
  tags: ["Fertilizers"],
  summary: "Delete a fertilizer",
  description: "Permanently deletes a fertilizer.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FertilizerParamsSchema },
  responses: {
    204: { description: "Fertilizer deleted." },
    ...commonErrorResponses,
  },
})

/**
 * Registers the fertilizer CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Fertilizer service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested fertilizer cannot be found.
 * @example
 * ```ts
 * registerFertilizerRoutes(app, fdm, services)
 * ```
 */
export function registerFertilizerRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FertilizerServices,
): void {
  // /farms/*/fertilizers and /farms/*/fertilizer-catalogue are covered by the /farms/* middleware in farms.ts
  app.use("/fertilizers", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/fertilizers/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listFertilizersHandler: RouteHandler<typeof listFertilizersRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const fertilizers = await listFarmFertilizers.run(operationContext(c, fdm, services), params)
    return c.json(paginatedResponse(fertilizers, limit, offset), 200)
  }

  const createFertilizerHandler: RouteHandler<typeof createFertilizerRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateFertilizerBodySchema>
    const fertilizer = await createFertilizer.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    const createdUrl = new URL(c.req.url)
    const basePath = createdUrl.pathname.replace(/\/+fertilizers.*$/, "")
    c.header("Location", `${createdUrl.origin}${basePath}/fertilizers/${fertilizer.p_id}`)
    return c.json(fertilizer, 201)
  }

  const createCustomFertilizerHandler: RouteHandler<typeof createCustomFertilizerRoute> = async (
    c,
  ) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateCustomFertilizerBodySchema>
    const fertilizer = await createCustomFertilizer.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    const createdUrl = new URL(c.req.url)
    const basePath = createdUrl.pathname.replace(/\/+farms\/.*$/, "")
    c.header("Location", `${createdUrl.origin}${basePath}/fertilizers/${fertilizer.p_id}`)
    return c.json(fertilizer, 201)
  }

  const updateCustomFertilizerHandler: RouteHandler<typeof updateCustomFertilizerRoute> = async (
    c,
  ) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateCustomFertilizerBodySchema>
    const fertilizer = await updateCustomFertilizer.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(fertilizer, 200)
  }

  const getFertilizerHandler: RouteHandler<typeof getFertilizerRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerParamsSchema>
    return c.json(await getFertilizer.run(operationContext(c, fdm, services), params), 200)
  }

  const deleteFertilizerHandler: RouteHandler<typeof deleteFertilizerRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerParamsSchema>
    await deleteFertilizer.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listFertilizersRoute, listFertilizersHandler)
  app.openapi(createFertilizerRoute, createFertilizerHandler)
  app.openapi(createCustomFertilizerRoute, createCustomFertilizerHandler)
  app.openapi(updateCustomFertilizerRoute, updateCustomFertilizerHandler)
  app.openapi(getFertilizerRoute, getFertilizerHandler)
  app.openapi(deleteFertilizerRoute, deleteFertilizerHandler)
}
