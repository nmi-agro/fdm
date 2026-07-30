import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { addDerogation, FdmType, listDerogations, removeDerogation } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/** Defines the derogation data access functions required by the derogation routes. */
export interface DerogationServices {
  listDerogations: typeof listDerogations
  addDerogation: typeof addDerogation
  removeDerogation: typeof removeDerogation
}

const DerogationSchema = z
  .object({
    b_id_derogation: z.string(),
    b_id_farm: z.string(),
    b_derogation_year: z.number().int(),
  })
  .openapi("Derogation")

const CreateDerogationBodySchema = z
  .object({
    b_derogation_year: z.number().int().describe("Derogation year."),
  })
  .openapi("CreateDerogation")

const listDerogationsRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/derogations",
  tags: ["Derogations"],
  summary: "List derogations on a farm",
  description: "Returns all derogations for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: z.string() }),
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
  method: "post",
  path: "/farms/{b_id_farm}/derogations",
  tags: ["Derogations"],
  summary: "Create a derogation",
  description: "Creates a new derogation on the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: z.string() }),
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
  method: "delete",
  path: "/derogations/{b_id_derogation}",
  tags: ["Derogations"],
  summary: "Delete a derogation",
  description: "Permanently deletes a derogation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id_derogation: z.string() }) },
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
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const derogations = await services.listDerogations(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
    )
    return c.json(paginatedResponse(derogations, limit, offset), 200)
  }

  const createDerogationHandler: RouteHandler<typeof createDerogationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateDerogationBodySchema>
    const b_id_derogation = await services.addDerogation(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      body.b_derogation_year,
    )
    c.header("Location", `${new URL(c.req.url).origin}/derogations/${b_id_derogation}`)
    return c.json(
      {
        b_id_derogation,
        b_id_farm,
        b_derogation_year: body.b_derogation_year,
      },
      201,
    )
  }

  const deleteDerogationHandler: RouteHandler<typeof deleteDerogationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_derogation } = c.req.valid("param") as {
      b_id_derogation: string
    }
    await services.removeDerogation(fdm, principal.effectivePrincipalId, b_id_derogation)
    return c.newResponse(null, 204)
  }

  app.openapi(listDerogationsRoute, listDerogationsHandler)
  app.openapi(createDerogationRoute, createDerogationHandler)
  app.openapi(deleteDerogationRoute, deleteDerogationHandler)
}
