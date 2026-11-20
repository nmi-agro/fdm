import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CreateMeasureBodySchema,
  createMeasure,
  deleteMeasure,
  getMeasure,
  listFarmMeasures,
  listFieldMeasures,
  MeasureFarmParamsSchema,
  MeasureFieldParamsSchema,
  MeasureParamsSchema,
  MeasureSchema,
  type MeasureServices,
  UpdateMeasureBodySchema,
  updateMeasure,
} from "../operations/measures"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationTimeframeQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { MeasureServices } from "../operations/measures"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listMeasuresRoute = createRoute({
  operationId: listFieldMeasures.name,
  method: "get",
  path: "/fields/{b_id}/measures",
  tags: ["Measures"],
  summary: "List measures on a field",
  description: "Returns all measures for the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: MeasureFieldParamsSchema,
    query: PaginationTimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of measures.",
      content: {
        "application/json": { schema: paginatedSchema(MeasureSchema) },
      },
    },
    ...commonErrorResponses,
  },
})

const createMeasureRoute = createRoute({
  operationId: createMeasure.name,
  method: "post",
  path: "/fields/{b_id}/measures",
  tags: ["Measures"],
  summary: "Create a measure",
  description: "Creates a new measure on the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: MeasureFieldParamsSchema,
    body: {
      content: {
        "application/json": { schema: CreateMeasureBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Measure created.",
      content: { "application/json": { schema: MeasureSchema } },
    },
    ...writeErrorResponses,
  },
})

const getMeasureRoute = createRoute({
  operationId: getMeasure.name,
  method: "get",
  path: "/measures/{b_id_measure}",
  tags: ["Measures"],
  summary: "Get a measure",
  description: "Returns a single measure by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: MeasureParamsSchema },
  responses: {
    200: {
      description: "The requested measure.",
      content: { "application/json": { schema: MeasureSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateMeasureRoute = createRoute({
  operationId: updateMeasure.name,
  method: "patch",
  path: "/measures/{b_id_measure}",
  tags: ["Measures"],
  summary: "Update a measure",
  description: "Partially updates an existing measure.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: MeasureParamsSchema,
    body: {
      content: {
        "application/json": { schema: UpdateMeasureBodySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Measure updated.",
      content: { "application/json": { schema: MeasureSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteMeasureRoute = createRoute({
  operationId: deleteMeasure.name,
  method: "delete",
  path: "/measures/{b_id_measure}",
  tags: ["Measures"],
  summary: "Delete a measure",
  description: "Permanently deletes a measure.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: MeasureParamsSchema },
  responses: {
    204: { description: "Measure deleted." },
    ...commonErrorResponses,
  },
})

const listFarmMeasuresRoute = createRoute({
  operationId: listFarmMeasures.name,
  method: "get",
  path: "/farms/{b_id_farm}/measures",
  tags: ["Measures"],
  summary: "List measures on a farm",
  description:
    "Returns the measures on all fields of the farm, sorted by start date. Each item has the `b_id` of its field. Use `from` and `to` to limit the period.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: MeasureFarmParamsSchema,
    query: PaginationTimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of measures.",
      content: {
        "application/json": {
          schema: paginatedSchema(MeasureSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

/**
 * Registers the measure CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Measure service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested measure cannot be found.
 * @example
 * ```ts
 * registerMeasureRoutes(app, fdm, services)
 * ```
 */
export function registerMeasureRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: MeasureServices,
): void {
  // /fields/*/measures is covered by the /fields/* middleware in fields.ts
  app.use("/measures", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/measures/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listFarmMeasuresHandler: RouteHandler<typeof listFarmMeasuresRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof MeasureFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...timeframe } = c.req.valid("query") as z.infer<
      typeof PaginationTimeframeQuerySchema
    >
    const measures = await listFarmMeasures.run(operationContext(c, fdm, services), {
      ...params,
      ...timeframe,
    })
    return c.json(paginatedResponse(measures, limit, offset), 200)
  }

  const listMeasuresHandler: RouteHandler<typeof listMeasuresRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof MeasureFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...timeframe } = c.req.valid("query") as z.infer<
      typeof PaginationTimeframeQuerySchema
    >
    const measures = await listFieldMeasures.run(operationContext(c, fdm, services), {
      ...params,
      ...timeframe,
    })
    return c.json(paginatedResponse(measures, limit, offset), 200)
  }

  const createMeasureHandler: RouteHandler<typeof createMeasureRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof MeasureFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateMeasureBodySchema>
    const measure = await createMeasure.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    c.header("Location", `${new URL(c.req.url).origin}/measures/${measure.b_id_measure}`)
    return c.json(measure, 201)
  }

  const getMeasureHandler: RouteHandler<typeof getMeasureRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof MeasureParamsSchema>
    return c.json(await getMeasure.run(operationContext(c, fdm, services), params), 200)
  }

  const updateMeasureHandler: RouteHandler<typeof updateMeasureRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof MeasureParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateMeasureBodySchema>
    const measure = await updateMeasure.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(measure, 200)
  }

  const deleteMeasureHandler: RouteHandler<typeof deleteMeasureRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof MeasureParamsSchema>
    await deleteMeasure.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listMeasuresRoute, listMeasuresHandler)
  app.openapi(listFarmMeasuresRoute, listFarmMeasuresHandler)
  app.openapi(createMeasureRoute, createMeasureHandler)
  app.openapi(getMeasureRoute, getMeasureHandler)
  app.openapi(updateMeasureRoute, updateMeasureHandler)
  app.openapi(deleteMeasureRoute, deleteMeasureHandler)
}
