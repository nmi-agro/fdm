import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import { FarmParamsSchema } from "../operations/farms"
import {
  CreateFieldBodySchema,
  createField,
  deleteField,
  FieldParamsSchema,
  FieldSchema,
  type FieldServices,
  getField,
  listFields,
  UpdateFieldBodySchema,
  updateField,
} from "../operations/fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { FieldServices } from "../operations/fields"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const listFieldsRoute = createRoute({
  operationId: listFields.name,
  method: "get",
  path: "/farms/{b_id_farm}/fields",
  tags: ["Fields"],
  summary: "List fields on a farm",
  description: "Returns all fields belonging to the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmParamsSchema,
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of fields.",
      content: {
        "application/json": { schema: paginatedSchema(FieldSchema) },
      },
    },
    ...commonErrorResponses,
  },
})

const getFieldRoute = createRoute({
  operationId: getField.name,
  method: "get",
  path: "/fields/{b_id}",
  tags: ["Fields"],
  summary: "Get a field",
  description: "Returns a single field by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FieldParamsSchema },
  responses: {
    200: {
      description: "The requested field.",
      content: { "application/json": { schema: FieldSchema } },
    },
    ...commonErrorResponses,
  },
})

const createFieldRoute = createRoute({
  operationId: createField.name,
  method: "post",
  path: "/farms/{b_id_farm}/fields",
  tags: ["Fields"],
  summary: "Create a field",
  description:
    "Creates a new field on the specified farm. The geometry must be a valid GeoJSON Polygon or MultiPolygon with at most 10,000 coordinates.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmParamsSchema,
    body: {
      content: { "application/json": { schema: CreateFieldBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Field created.",
      content: { "application/json": { schema: FieldSchema } },
    },
    ...writeErrorResponses,
  },
})

const updateFieldRoute = createRoute({
  operationId: updateField.name,
  method: "patch",
  path: "/fields/{b_id}",
  tags: ["Fields"],
  summary: "Update a field",
  description: "Partially updates an existing field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FieldParamsSchema,
    body: {
      content: { "application/json": { schema: UpdateFieldBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Field updated.",
      content: { "application/json": { schema: FieldSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteFieldRoute = createRoute({
  operationId: deleteField.name,
  method: "delete",
  path: "/fields/{b_id}",
  tags: ["Fields"],
  summary: "Delete a field",
  description: "Permanently deletes a field and all its associated cultivations and soil analyses.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: FieldParamsSchema },
  responses: {
    204: { description: "Field deleted." },
    ...commonErrorResponses,
  },
})

/**
 * Registers the field CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Field service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested field cannot be found.
 * @example
 * ```ts
 * registerFieldRoutes(app, fdm, services)
 * ```
 */
export function registerFieldRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FieldServices,
): void {
  // /farms/*/fields is covered by the /farms/* middleware in farms.ts
  app.use("/fields/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listFieldsHandler: RouteHandler<typeof listFieldsRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const fields = await listFields.run(operationContext(c, fdm, services), params)
    return c.json(paginatedResponse(fields, limit, offset), 200)
  }

  const getFieldHandler: RouteHandler<typeof getFieldRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FieldParamsSchema>
    return c.json(await getField.run(operationContext(c, fdm, services), params), 200)
  }

  const createFieldHandler: RouteHandler<typeof createFieldRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateFieldBodySchema>
    const field = await createField.run(operationContext(c, fdm, services), { ...params, ...body })
    c.header("Location", `${new URL(c.req.url).origin}/fields/${field.b_id}`)
    return c.json(field, 201)
  }

  const updateFieldHandler: RouteHandler<typeof updateFieldRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateFieldBodySchema>
    const field = await updateField.run(operationContext(c, fdm, services), { ...params, ...body })
    return c.json(field, 200)
  }

  const deleteFieldHandler: RouteHandler<typeof deleteFieldRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FieldParamsSchema>
    await deleteField.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listFieldsRoute, listFieldsHandler)
  app.openapi(getFieldRoute, getFieldHandler)
  app.openapi(createFieldRoute, createFieldHandler)
  app.openapi(updateFieldRoute, updateFieldHandler)
  app.openapi(deleteFieldRoute, deleteFieldHandler)
}
