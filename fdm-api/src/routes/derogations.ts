import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CreateDerogationBodySchema,
  createDerogation,
  DerogationFarmParamsSchema,
  DerogationParamsSchema,
  DerogationSchema,
  type DerogationServices,
  deleteDerogation,
  listDerogations,
} from "../operations/derogations"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { DerogationServices } from "../operations/derogations"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listDerogationsRoute = createRoute({
  operationId: listDerogations.name,
  method: "get",
  path: "/farms/{b_id_farm}/derogations",
  tags: ["Derogations"],
  summary: "List derogations on a farm",
  description: "Returns all derogations for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: DerogationFarmParamsSchema,
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of derogations.",
      content: {
        "application/json": {
          schema: paginatedSchema(DerogationSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const createDerogationRoute = createRoute({
  operationId: createDerogation.name,
  method: "post",
  path: "/farms/{b_id_farm}/derogations",
  tags: ["Derogations"],
  summary: "Create a derogation",
  description: "Creates a new derogation on the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: DerogationFarmParamsSchema,
    body: {
      content: {
        "application/json": { schema: CreateDerogationBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Derogation created.",
      content: { "application/json": { schema: DerogationSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteDerogationRoute = createRoute({
  operationId: deleteDerogation.name,
  method: "delete",
  path: "/derogations/{b_id_derogation}",
  tags: ["Derogations"],
  summary: "Delete a derogation",
  description: "Permanently deletes a derogation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: DerogationParamsSchema },
  responses: {
    204: { description: "Derogation deleted." },
    ...commonErrorResponses,
  },
})

/**
 * Registers the derogation routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Derogation service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerDerogationRoutes(app, fdm, services)
 * ```
 */
export function registerDerogationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: DerogationServices,
): void {
  // /farms/*/derogations is covered by the /farms/* middleware in farms.ts
  app.use("/derogations", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/derogations/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listDerogationsHandler: RouteHandler<typeof listDerogationsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof DerogationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const derogations = await listDerogations.run(operationContext(c, fdm, services), params)
    return c.json(paginatedResponse(derogations, limit, offset), 200)
  }

  const createDerogationHandler: RouteHandler<typeof createDerogationRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof DerogationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateDerogationBodySchema>
    const derogation = await createDerogation.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    c.header("Location", `${new URL(c.req.url).origin}/derogations/${derogation.b_id_derogation}`)
    return c.json(derogation, 201)
  }

  const deleteDerogationHandler: RouteHandler<typeof deleteDerogationRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof DerogationParamsSchema>
    await deleteDerogation.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listDerogationsRoute, listDerogationsHandler)
  app.openapi(createDerogationRoute, createDerogationHandler)
  app.openapi(deleteDerogationRoute, deleteDerogationHandler)
}
