import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CreateCultivationBodySchema,
  CultivationParamsSchema,
  CultivationSchema,
  type CultivationServices,
  createCultivation,
  deleteCultivation,
  getCultivation,
  listFarmCultivations,
  listFieldCultivations,
  UpdateCultivationBodySchema,
  updateCultivation,
} from "../operations/cultivations"
import { FarmParamsSchema } from "../operations/farms"
import { FieldParamsSchema } from "../operations/fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { CultivationServices } from "../operations/cultivations"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listCultivationsRoute = createRoute({
  operationId: listFieldCultivations.name,
  method: "get",
  path: "/fields/{b_id}/cultivations",
  tags: ["Cultivations"],
  summary: "List cultivations on a field",
  description: "Returns all cultivations on the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FieldParamsSchema,
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of cultivations.",
      content: {
        "application/json": {
          schema: paginatedSchema(CultivationSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const listFarmCultivationsRoute = createRoute({
  operationId: listFarmCultivations.name,
  method: "get",
  path: "/farms/{b_id_farm}/cultivations",
  tags: ["Cultivations"],
  summary: "List cultivations on a farm",
  description: "Returns all cultivations on all fields for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmParamsSchema,
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of cultivations.",
      content: {
        "application/json": {
          schema: paginatedSchema(CultivationSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const createCultivationRoute = createRoute({
  operationId: createCultivation.name,
  method: "post",
  path: "/fields/{b_id}/cultivations",
  tags: ["Cultivations"],
  summary: "Create a cultivation",
  description: "Creates a new cultivation on the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FieldParamsSchema,
    body: {
      content: {
        "application/json": { schema: CreateCultivationBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Cultivation created.",
      content: { "application/json": { schema: CultivationSchema } },
    },
    ...writeErrorResponses,
  },
})

const getCultivationRoute = createRoute({
  operationId: getCultivation.name,
  method: "get",
  path: "/cultivations/{b_lu}",
  tags: ["Cultivations"],
  summary: "Get a cultivation",
  description: "Returns a single cultivation by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: CultivationParamsSchema },
  responses: {
    200: {
      description: "The requested cultivation.",
      content: { "application/json": { schema: CultivationSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateCultivationRoute = createRoute({
  operationId: updateCultivation.name,
  method: "patch",
  path: "/cultivations/{b_lu}",
  tags: ["Cultivations"],
  summary: "Update a cultivation",
  description: "Partially updates an existing cultivation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: CultivationParamsSchema,
    body: {
      content: {
        "application/json": { schema: UpdateCultivationBodySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Cultivation updated.",
      content: { "application/json": { schema: CultivationSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteCultivationRoute = createRoute({
  operationId: deleteCultivation.name,
  method: "delete",
  path: "/cultivations/{b_lu}",
  tags: ["Cultivations"],
  summary: "Delete a cultivation",
  description: "Permanently deletes a cultivation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: CultivationParamsSchema },
  responses: {
    204: { description: "Cultivation deleted." },
    ...commonErrorResponses,
  },
})

/**
 * Registers the cultivation CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Cultivation service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerCultivationRoutes(app, fdm, services)
 * ```
 */
export function registerCultivationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: CultivationServices,
): void {
  // /fields/*/cultivations is covered by the /fields/* middleware in fields.ts
  // /farms/*/cultivations is covered by the /farms/* middleware in farms.ts
  app.use("/cultivations", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/cultivations/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listCultivationsHandler: RouteHandler<typeof listCultivationsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const cultivations = await listFieldCultivations.run(operationContext(c, fdm, services), params)
    return c.json(paginatedResponse(cultivations, limit, offset), 200)
  }

  const listFarmCultivationsHandler: RouteHandler<typeof listFarmCultivationsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const cultivations = await listFarmCultivations.run(operationContext(c, fdm, services), params)
    return c.json(paginatedResponse(cultivations, limit, offset), 200)
  }

  const createCultivationHandler: RouteHandler<typeof createCultivationRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateCultivationBodySchema>
    const cultivation = await createCultivation.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    c.header("Location", `${new URL(c.req.url).origin}/cultivations/${cultivation.b_lu}`)
    return c.json(cultivation, 201)
  }

  const getCultivationHandler: RouteHandler<typeof getCultivationRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CultivationParamsSchema>
    return c.json(await getCultivation.run(operationContext(c, fdm, services), params), 200)
  }

  const updateCultivationHandler: RouteHandler<typeof updateCultivationRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CultivationParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateCultivationBodySchema>
    const cultivation = await updateCultivation.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(cultivation, 200)
  }

  const deleteCultivationHandler: RouteHandler<typeof deleteCultivationRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof CultivationParamsSchema>
    await deleteCultivation.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listCultivationsRoute, listCultivationsHandler)
  app.openapi(listFarmCultivationsRoute, listFarmCultivationsHandler)
  app.openapi(createCultivationRoute, createCultivationHandler)
  app.openapi(getCultivationRoute, getCultivationHandler)
  app.openapi(updateCultivationRoute, updateCultivationHandler)
  app.openapi(deleteCultivationRoute, deleteCultivationHandler)
}
