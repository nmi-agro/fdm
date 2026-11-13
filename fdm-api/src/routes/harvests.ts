import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import { CultivationParamsSchema } from "../operations/cultivations"
import { FarmParamsSchema } from "../operations/farms"
import {
  CreateHarvestBodySchema,
  createHarvest,
  deleteHarvest,
  getCultivationHarvestParameters,
  getHarvest,
  HarvestParamsSchema,
  HarvestParametersSchema,
  HarvestSchema,
  type HarvestServices,
  listCultivationHarvests,
  listFarmHarvests,
  UpdateHarvestBodySchema,
  updateHarvest,
} from "../operations/harvests"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationTimeframeQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { HarvestServices } from "../operations/harvests"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listHarvestsRoute = createRoute({
  operationId: listCultivationHarvests.name,
  method: "get",
  path: "/cultivations/{b_lu}/harvests",
  tags: ["Harvests"],
  summary: "List harvests on a cultivation",
  description: "Returns all harvests for the specified cultivation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CultivationParamsSchema,
    query: PaginationTimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of harvests.",
      content: {
        "application/json": { schema: paginatedSchema(HarvestSchema) },
      },
    },
    ...commonErrorResponses,
  },
})

const createHarvestRoute = createRoute({
  operationId: createHarvest.name,
  method: "post",
  path: "/cultivations/{b_lu}/harvests",
  tags: ["Harvests"],
  summary: "Create a harvest",
  description: "Creates a new harvest on the specified cultivation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CultivationParamsSchema,
    body: {
      content: {
        "application/json": { schema: CreateHarvestBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Harvest created.",
      content: { "application/json": { schema: HarvestSchema } },
    },
    ...writeErrorResponses,
  },
})

const getHarvestRoute = createRoute({
  operationId: getHarvest.name,
  method: "get",
  path: "/harvests/{b_id_harvesting}",
  tags: ["Harvests"],
  summary: "Get a harvest",
  description: "Returns a single harvest by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: HarvestParamsSchema },
  responses: {
    200: {
      description: "The requested harvest.",
      content: { "application/json": { schema: HarvestSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateHarvestRoute = createRoute({
  operationId: updateHarvest.name,
  method: "patch",
  path: "/harvests/{b_id_harvesting}",
  tags: ["Harvests"],
  summary: "Update a harvest",
  description: "Updates an existing harvest.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: HarvestParamsSchema,
    body: {
      content: {
        "application/json": { schema: UpdateHarvestBodySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Harvest updated.",
      content: { "application/json": { schema: HarvestSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteHarvestRoute = createRoute({
  operationId: deleteHarvest.name,
  method: "delete",
  path: "/harvests/{b_id_harvesting}",
  tags: ["Harvests"],
  summary: "Delete a harvest",
  description: "Permanently deletes a harvest.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: HarvestParamsSchema },
  responses: {
    204: { description: "Harvest deleted." },
    ...commonErrorResponses,
  },
})

const listFarmHarvestsRoute = createRoute({
  operationId: listFarmHarvests.name,
  method: "get",
  path: "/farms/{b_id_farm}/harvests",
  tags: ["Harvests"],
  summary: "List harvests on a farm",
  description:
    "Returns the harvests of all cultivations on the farm, sorted by harvest date. Each item has the `b_lu` of its cultivation. Use `from` and `to` to limit the period.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: FarmParamsSchema,
    query: PaginationTimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of harvests.",
      content: {
        "application/json": {
          schema: paginatedSchema(HarvestSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const getHarvestParametersRoute = createRoute({
  operationId: getCultivationHarvestParameters.name,
  method: "get",
  path: "/cultivations/{b_lu}/harvest-parameters",
  tags: ["Harvests"],
  summary: "Get the harvest parameters of a cultivation",
  description:
    "Returns which parameters a harvest of this cultivation needs and their default values, the same as the harvest form in the web app. Use it before `POST /cultivations/{b_lu}/harvests`.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: CultivationParamsSchema },
  responses: {
    200: {
      description: "Harvest parameters and their default values.",
      content: { "application/json": { schema: HarvestParametersSchema } },
    },
    ...commonErrorResponses,
  },
})

/**
 * Registers the harvest CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Harvest service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested harvest cannot be found.
 * @example
 * ```ts
 * registerHarvestRoutes(app, fdm, services)
 * ```
 */
export function registerHarvestRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: HarvestServices,
): void {
  // /cultivations/*/harvests is covered by the /cultivations/* middleware in cultivations.ts
  app.use("/harvests", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/harvests/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listFarmHarvestsHandler: RouteHandler<typeof listFarmHarvestsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...timeframe } = c.req.valid("query") as z.infer<
      typeof PaginationTimeframeQuerySchema
    >
    const harvests = await listFarmHarvests.run(operationContext(c, fdm, services), {
      ...params,
      ...timeframe,
    })
    return c.json(paginatedResponse(harvests, limit, offset), 200)
  }

  const getHarvestParametersHandler: RouteHandler<typeof getHarvestParametersRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CultivationParamsSchema>
    const harvestParameters = await getCultivationHarvestParameters.run(
      operationContext(c, fdm, services),
      params,
    )
    return c.json(harvestParameters, 200)
  }

  const listHarvestsHandler: RouteHandler<typeof listHarvestsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CultivationParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...timeframe } = c.req.valid("query") as z.infer<
      typeof PaginationTimeframeQuerySchema
    >
    const harvests = await listCultivationHarvests.run(operationContext(c, fdm, services), {
      ...params,
      ...timeframe,
    })
    return c.json(paginatedResponse(harvests, limit, offset), 200)
  }

  const createHarvestHandler: RouteHandler<typeof createHarvestRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CultivationParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateHarvestBodySchema>
    const harvest = await createHarvest.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    c.header("Location", `${new URL(c.req.url).origin}/harvests/${harvest.b_id_harvesting}`)
    return c.json(harvest, 201)
  }

  const getHarvestHandler: RouteHandler<typeof getHarvestRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof HarvestParamsSchema>
    return c.json(await getHarvest.run(operationContext(c, fdm, services), params), 200)
  }

  const updateHarvestHandler: RouteHandler<typeof updateHarvestRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof HarvestParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateHarvestBodySchema>
    const harvest = await updateHarvest.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(harvest, 200)
  }

  const deleteHarvestHandler: RouteHandler<typeof deleteHarvestRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof HarvestParamsSchema>
    await deleteHarvest.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listHarvestsRoute, listHarvestsHandler)
  app.openapi(getHarvestParametersRoute, getHarvestParametersHandler)
  app.openapi(listFarmHarvestsRoute, listFarmHarvestsHandler)
  app.openapi(createHarvestRoute, createHarvestHandler)
  app.openapi(getHarvestRoute, getHarvestHandler)
  app.openapi(updateHarvestRoute, updateHarvestHandler)
  app.openapi(deleteHarvestRoute, deleteHarvestHandler)
}
