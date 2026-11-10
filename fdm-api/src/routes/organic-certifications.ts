import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CreateOrganicCertificationBodySchema,
  createOrganicCertification,
  deleteOrganicCertification,
  getOrganicCertification,
  listOrganicCertifications,
  OrganicCertificationFarmParamsSchema,
  OrganicCertificationParamsSchema,
  OrganicCertificationSchema,
  type OrganicCertificationServices,
} from "../operations/organic-certifications"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { OrganicCertificationServices } from "../operations/organic-certifications"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listOrganicCertificationsRoute = createRoute({
  operationId: listOrganicCertifications.name,
  method: "get",
  path: "/farms/{b_id_farm}/organic-certifications",
  tags: ["Organic Certifications"],
  summary: "List organic certifications on a farm",
  description: "Returns all organic certifications for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: OrganicCertificationFarmParamsSchema,
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of organic certifications.",
      content: {
        "application/json": {
          schema: paginatedSchema(OrganicCertificationSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const createOrganicCertificationRoute = createRoute({
  operationId: createOrganicCertification.name,
  method: "post",
  path: "/farms/{b_id_farm}/organic-certifications",
  tags: ["Organic Certifications"],
  summary: "Create an organic certification",
  description: "Creates a new organic certification on the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: OrganicCertificationFarmParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: CreateOrganicCertificationBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Organic certification created.",
      content: {
        "application/json": { schema: OrganicCertificationSchema },
      },
    },
    ...writeErrorResponses,
  },
})

const getOrganicCertificationRoute = createRoute({
  operationId: getOrganicCertification.name,
  method: "get",
  path: "/organic-certifications/{b_id_organic}",
  tags: ["Organic Certifications"],
  summary: "Get an organic certification",
  description: "Returns a single organic certification by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: OrganicCertificationParamsSchema },
  responses: {
    200: {
      description: "The requested organic certification.",
      content: {
        "application/json": { schema: OrganicCertificationSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const deleteOrganicCertificationRoute = createRoute({
  operationId: deleteOrganicCertification.name,
  method: "delete",
  path: "/organic-certifications/{b_id_organic}",
  tags: ["Organic Certifications"],
  summary: "Delete an organic certification",
  description: "Permanently deletes an organic certification.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: OrganicCertificationParamsSchema },
  responses: {
    204: { description: "Organic certification deleted." },
    ...commonErrorResponses,
  },
})

/**
 * Registers the organic certification CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Organic certification service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested organic certification cannot be found.
 * @example
 * ```ts
 * registerOrganicCertificationRoutes(app, fdm, services)
 * ```
 */
export function registerOrganicCertificationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: OrganicCertificationServices,
): void {
  // /farms/*/organic-certifications is covered by the /farms/* middleware in farms.ts
  app.use("/organic-certifications", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/organic-certifications/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listOrganicCertificationsHandler: RouteHandler<
    typeof listOrganicCertificationsRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof OrganicCertificationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const certifications = await listOrganicCertifications.run(
      operationContext(c, fdm, services),
      params,
    )
    return c.json(paginatedResponse(certifications, limit, offset), 200)
  }

  const createOrganicCertificationHandler: RouteHandler<
    typeof createOrganicCertificationRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof OrganicCertificationFarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateOrganicCertificationBodySchema>
    const certification = await createOrganicCertification.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    c.header(
      "Location",
      `${new URL(c.req.url).origin}/organic-certifications/${certification.b_id_organic}`,
    )
    return c.json(certification, 201)
  }

  const getOrganicCertificationHandler: RouteHandler<typeof getOrganicCertificationRoute> = async (
    c,
  ) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof OrganicCertificationParamsSchema>
    return c.json(
      await getOrganicCertification.run(operationContext(c, fdm, services), params),
      200,
    )
  }

  const deleteOrganicCertificationHandler: RouteHandler<
    typeof deleteOrganicCertificationRoute
  > = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof OrganicCertificationParamsSchema>
    await deleteOrganicCertification.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listOrganicCertificationsRoute, listOrganicCertificationsHandler)
  app.openapi(createOrganicCertificationRoute, createOrganicCertificationHandler)
  app.openapi(getOrganicCertificationRoute, getOrganicCertificationHandler)
  app.openapi(deleteOrganicCertificationRoute, deleteOrganicCertificationHandler)
}
