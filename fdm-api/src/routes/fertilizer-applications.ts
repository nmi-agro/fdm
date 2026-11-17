import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CreateFertilizerApplicationBodySchema,
  createFertilizerApplication,
  deleteFertilizerApplication,
  FarmFertilizerApplicationSchema,
  FertilizerApplicationFarmParamsSchema,
  FertilizerApplicationFieldParamsSchema,
  FertilizerApplicationParamsSchema,
  FertilizerApplicationSchema,
  type FertilizerApplicationServices,
  getFertilizerApplication,
  listFarmFertilizerApplications,
  listFieldFertilizerApplications,
  UpdateFertilizerApplicationBodySchema,
  updateFertilizerApplication,
} from "../operations/fertilizer-applications"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationTimeframeQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { FertilizerApplicationServices } from "../operations/fertilizer-applications"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listFertilizerApplicationsRoute = createRoute({
  operationId: listFieldFertilizerApplications.name,
  method: "get",
  path: "/fields/{b_id}/fertilizer-applications",
  tags: ["Fertilizer Applications"],
  summary: "List fertilizer applications on a field",
  description: "Returns all fertilizer applications for the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FertilizerApplicationFieldParamsSchema,
    query: PaginationTimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of fertilizer applications.",
      content: {
        "application/json": {
          schema: paginatedSchema(FertilizerApplicationSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const createFertilizerApplicationRoute = createRoute({
  operationId: createFertilizerApplication.name,
  method: "post",
  path: "/fields/{b_id}/fertilizer-applications",
  tags: ["Fertilizer Applications"],
  summary: "Create a fertilizer application",
  description: "Creates a new fertilizer application on the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FertilizerApplicationFieldParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: CreateFertilizerApplicationBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Fertilizer application created.",
      content: {
        "application/json": { schema: FertilizerApplicationSchema },
      },
    },
    ...writeErrorResponses,
  },
})

const getFertilizerApplicationRoute = createRoute({
  operationId: getFertilizerApplication.name,
  method: "get",
  path: "/fertilizer-applications/{p_app_id}",
  tags: ["Fertilizer Applications"],
  summary: "Get a fertilizer application",
  description: "Returns a single fertilizer application by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FertilizerApplicationParamsSchema },
  responses: {
    200: {
      description: "The requested fertilizer application.",
      content: {
        "application/json": { schema: FertilizerApplicationSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const updateFertilizerApplicationRoute = createRoute({
  operationId: updateFertilizerApplication.name,
  method: "patch",
  path: "/fertilizer-applications/{p_app_id}",
  tags: ["Fertilizer Applications"],
  summary: "Update a fertilizer application",
  description: "Partially updates an existing fertilizer application.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FertilizerApplicationParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateFertilizerApplicationBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Fertilizer application updated.",
      content: {
        "application/json": { schema: FertilizerApplicationSchema },
      },
    },
    ...writeErrorResponses,
  },
})

const deleteFertilizerApplicationRoute = createRoute({
  operationId: deleteFertilizerApplication.name,
  method: "delete",
  path: "/fertilizer-applications/{p_app_id}",
  tags: ["Fertilizer Applications"],
  summary: "Delete a fertilizer application",
  description: "Permanently deletes a fertilizer application.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FertilizerApplicationParamsSchema },
  responses: {
    204: { description: "Fertilizer application deleted." },
    ...commonErrorResponses,
  },
})

const listFarmFertilizerApplicationsRoute = createRoute({
  operationId: listFarmFertilizerApplications.name,
  method: "get",
  path: "/farms/{b_id_farm}/fertilizer-applications",
  tags: ["Fertilizer Applications"],
  summary: "List fertilizer applications on a farm",
  description:
    "Returns the fertilizer applications on all fields of the farm, sorted by application date. Each item has the `b_id` of its field. Use `from` and `to` to limit the period.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: FertilizerApplicationFarmParamsSchema,
    query: PaginationTimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of fertilizer applications.",
      content: {
        "application/json": {
          schema: paginatedSchema(FarmFertilizerApplicationSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

/**
 * Registers the fertilizer application CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Fertilizer application service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested fertilizer application cannot be found.
 * @example
 * ```ts
 * registerFertilizerApplicationRoutes(app, fdm, services)
 * ```
 */
export function registerFertilizerApplicationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FertilizerApplicationServices,
): void {
  // /fields/*/fertilizer-applications is covered by the /fields/* middleware in fields.ts
  app.use("/fertilizer-applications", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/fertilizer-applications/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listFarmFertilizerApplicationsHandler: RouteHandler<
    typeof listFarmFertilizerApplicationsRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerApplicationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...timeframe } = c.req.valid("query") as z.infer<
      typeof PaginationTimeframeQuerySchema
    >
    const applications = await listFarmFertilizerApplications.run(
      operationContext(c, fdm, services),
      { ...params, ...timeframe },
    )
    return c.json(paginatedResponse(applications, limit, offset), 200)
  }

  const listFertilizerApplicationsHandler: RouteHandler<
    typeof listFertilizerApplicationsRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerApplicationFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...timeframe } = c.req.valid("query") as z.infer<
      typeof PaginationTimeframeQuerySchema
    >
    const applications = await listFieldFertilizerApplications.run(
      operationContext(c, fdm, services),
      { ...params, ...timeframe },
    )
    return c.json(paginatedResponse(applications, limit, offset), 200)
  }

  const createFertilizerApplicationHandler: RouteHandler<
    typeof createFertilizerApplicationRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerApplicationFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateFertilizerApplicationBodySchema>
    const application = await createFertilizerApplication.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    c.header(
      "Location",
      `${new URL(c.req.url).origin}/fertilizer-applications/${application.p_app_id}`,
    )
    return c.json(application, 201)
  }

  const getFertilizerApplicationHandler: RouteHandler<
    typeof getFertilizerApplicationRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerApplicationParamsSchema>
    return c.json(
      await getFertilizerApplication.run(operationContext(c, fdm, services), params),
      200,
    )
  }

  const updateFertilizerApplicationHandler: RouteHandler<
    typeof updateFertilizerApplicationRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerApplicationParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateFertilizerApplicationBodySchema>
    const application = await updateFertilizerApplication.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(application, 200)
  }

  const deleteFertilizerApplicationHandler: RouteHandler<
    typeof deleteFertilizerApplicationRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FertilizerApplicationParamsSchema>
    await deleteFertilizerApplication.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listFertilizerApplicationsRoute, listFertilizerApplicationsHandler)
  app.openapi(listFarmFertilizerApplicationsRoute, listFarmFertilizerApplicationsHandler)
  app.openapi(createFertilizerApplicationRoute, createFertilizerApplicationHandler)
  app.openapi(getFertilizerApplicationRoute, getFertilizerApplicationHandler)
  app.openapi(updateFertilizerApplicationRoute, updateFertilizerApplicationHandler)
  app.openapi(deleteFertilizerApplicationRoute, deleteFertilizerApplicationHandler)
}
