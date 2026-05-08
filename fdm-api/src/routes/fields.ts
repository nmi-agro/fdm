import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { getField, getFields } from "@nmi-agro/fdm-core"
import type { FdmType } from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import {
    commonErrorResponses,
    GeoJsonGeometrySchema,
    paginatedResponse,
    paginatedSchema,
    PaginationQuerySchema,
} from "../schemas"

/**
 * Defines the field data access functions required by the field routes.
 */
export interface FieldServices {
    /** Returns all fields for a farm that are visible to the authenticated principal. */
    getFields: typeof getFields
    /** Returns a single field visible to the authenticated principal. */
    getField: typeof getField
}

const FieldSchema = z.object({
    b_id: z.string(),
    b_name: z.string(),
    b_id_farm: z.string(),
    b_id_source: z.string().nullable(),
    b_geometry: GeoJsonGeometrySchema.nullable(),
    b_centroid: z.tuple([z.number(), z.number()]),
    b_area: z.number().nullable(),
    b_perimeter: z.number().nullable(),
    b_bufferstrip: z.boolean(),
    b_start: z.string().datetime({ offset: true }).nullable(),
    b_end: z.string().datetime({ offset: true }).nullable(),
    b_acquiring_method: z.string(),
}).openapi("Field")

const listFieldsRoute = createRoute({
    method: "get",
    path: "/farms/{b_id_farm}/fields",
    tags: ["Fields"],
    summary: "List fields on a farm",
    description: "Returns all fields belonging to the specified farm.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_farm: z.string() }),
        query: PaginationQuerySchema,
    },
    responses: {
        200: {
            description: "A paginated list of fields.",
            content: { "application/json": { schema: paginatedSchema(FieldSchema) } },
        },
        ...commonErrorResponses,
    },
})

const getFieldRoute = createRoute({
    method: "get",
    path: "/fields/{b_id}",
    tags: ["Fields"],
    summary: "Get a field",
    description: "Returns a single field by ID.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id: z.string() }) },
    responses: {
        200: {
            description: "The requested field.",
            content: { "application/json": { schema: FieldSchema } },
        },
        ...commonErrorResponses,
    },
})

function serialiseField(field: Awaited<ReturnType<typeof getField>>) {
    return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_id_farm: field.b_id_farm,
        b_id_source: field.b_id_source ?? null,
        b_geometry: field.b_geometry as unknown as z.infer<typeof GeoJsonGeometrySchema> | null,
        b_centroid: field.b_centroid,
        b_area: field.b_area ?? null,
        b_perimeter: field.b_perimeter ?? null,
        b_bufferstrip: field.b_bufferstrip,
        b_start: field.b_start ? field.b_start.toISOString() : null,
        b_end: field.b_end ? field.b_end.toISOString() : null,
        b_acquiring_method: field.b_acquiring_method,
    }
}

/**
 * Registers the field listing and detail routes on the API application.
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
    app.use("/farms/*/fields", rateLimitMiddleware(fdm, "general"))
    app.use("/fields/*", rateLimitMiddleware(fdm, "general"))

    const listFieldsHandler: RouteHandler<typeof listFieldsRoute> = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
        const fields = await services.getFields(fdm, principal.effectivePrincipalId, b_id_farm)
        return c.json(paginatedResponse(fields.map(serialiseField), limit, offset), 200)
    }

    const getFieldHandler: RouteHandler<typeof getFieldRoute> = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
        if (!field?.b_id) {
            throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
        }
        return c.json(serialiseField(field), 200)
    }

    app.openapi(listFieldsRoute, listFieldsHandler)
    app.openapi(getFieldRoute, getFieldHandler)
}
