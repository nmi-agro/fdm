import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
    addField,
    getField,
    getFields,
    removeField,
    updateField,
} from "@nmi-agro/fdm-core"
import type { FdmType } from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { assertGeoJsonCoordinates } from "../guards"
import { rateLimitMiddleware } from "../rate-limit"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import {
    commonErrorResponses,
    DateStringSchema,
    GeoJsonGeometrySchema,
    paginatedResponse,
    paginatedSchema,
    PaginationQuerySchema,
    serializeDate,
    writeErrorResponses,
} from "../schemas"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/**
 * Defines the field data access functions required by the field routes.
 */
export interface FieldServices {
    /** Returns all fields for a farm that are visible to the authenticated principal. */
    getFields: typeof getFields
    /** Returns a single field visible to the authenticated principal. */
    getField: typeof getField
    /** Creates a new field on an existing farm. */
    addField: typeof addField
    /** Updates an existing field. */
    updateField: typeof updateField
    /** Permanently deletes a field and its associated cultivations and soil analyses. */
    removeField: typeof removeField
}

const FieldSchema = z
    .object({
        b_id: z.string(),
        b_name: z.string(),
        b_id_farm: z.string(),
        b_id_source: z.string().nullable(),
        b_geometry: GeoJsonGeometrySchema.nullable(),
        b_centroid: z.tuple([z.number(), z.number()]),
        b_area: z.number().nullable(),
        b_perimeter: z.number().nullable(),
        b_bufferstrip: z.boolean(),
        b_start: DateStringSchema
            .nullable()
            .describe("Date in YYYY-MM-DD format."),
        b_end: DateStringSchema
            .nullable()
            .describe("Date in YYYY-MM-DD format."),
        b_acquiring_method: z.string(),
    })
    .openapi("Field")

const CreateFieldBodySchema = z
    .object({
        b_name: z.string().describe("Field display name."),
        b_id_source: z
            .string()
            .nullable()
            .optional()
            .describe("External source identifier."),
        b_geometry: GeoJsonGeometrySchema.describe(
            "Field boundary as GeoJSON Polygon or MultiPolygon. Maximum 10,000 coordinates.",
        ),
        b_start: DateStringSchema
            .describe("Date in YYYY-MM-DD format."),
        b_acquiring_method: z
            .string()
            .describe("Method by which the field was acquired."),
        b_end: DateStringSchema
            .nullable()
            .optional()
            .describe("Date in YYYY-MM-DD format."),
        b_bufferstrip: z
            .boolean()
            .optional()
            .describe("Whether the field is a buffer strip."),
    })
    .openapi("CreateField")

const UpdateFieldBodySchema = z
    .object({
        b_name: z.string().optional().describe("Field display name."),
        b_id_source: z
            .string()
            .nullable()
            .optional()
            .describe("External source identifier."),
        b_geometry: GeoJsonGeometrySchema.nullable()
            .optional()
            .describe("Field boundary as GeoJSON Polygon or MultiPolygon."),
        b_start: DateStringSchema
            .optional()
            .describe("Date in YYYY-MM-DD format."),
        b_acquiring_method: z
            .string()
            .optional()
            .describe("Method by which the field was acquired."),
        b_end: DateStringSchema
            .nullable()
            .optional()
            .describe("Date in YYYY-MM-DD format."),
        b_bufferstrip: z
            .boolean()
            .optional()
            .describe("Whether the field is a buffer strip."),
    })
    .openapi("UpdateField")

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
            content: {
                "application/json": { schema: paginatedSchema(FieldSchema) },
            },
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

const createFieldRoute = createRoute({
    method: "post",
    path: "/farms/{b_id_farm}/fields",
    tags: ["Fields"],
    summary: "Create a field",
    description:
        "Creates a new field on the specified farm. The geometry must be a valid GeoJSON Polygon or MultiPolygon with at most 10,000 coordinates.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_farm: z.string() }),
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
    method: "patch",
    path: "/fields/{b_id}",
    tags: ["Fields"],
    summary: "Update a field",
    description: "Partially updates an existing field.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id: z.string() }),
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
    method: "delete",
    path: "/fields/{b_id}",
    tags: ["Fields"],
    summary: "Delete a field",
    description:
        "Permanently deletes a field and all its associated cultivations and soil analyses.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id: z.string() }) },
    responses: {
        204: { description: "Field deleted." },
        ...commonErrorResponses,
    },
})

function serialiseField(field: Awaited<ReturnType<typeof getField>>) {
    return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_id_farm: field.b_id_farm,
        b_id_source: field.b_id_source ?? null,
        b_geometry: field.b_geometry as unknown as z.infer<
            typeof GeoJsonGeometrySchema
        > | null,
        b_centroid: field.b_centroid,
        b_area: field.b_area ?? null,
        b_perimeter: field.b_perimeter ?? null,
        b_bufferstrip: field.b_bufferstrip,
        b_start: serializeDate(field.b_start),
        b_end: serializeDate(field.b_end),
        b_acquiring_method: field.b_acquiring_method,
    }
}

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
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )

    const listFieldsHandler: RouteHandler<typeof listFieldsRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { limit, offset } = c.req.valid("query") as z.infer<
            typeof PaginationQuerySchema
        >
        const fields = await services.getFields(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
        )
        return c.json(
            paginatedResponse(fields.map(serialiseField), limit, offset),
            200,
        )
    }

    const getFieldHandler: RouteHandler<typeof getFieldRoute> = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        const field = await services.getField(
            fdm,
            principal.effectivePrincipalId,
            b_id,
        )
        if (!field?.b_id) {
            throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
        }
        return c.json(serialiseField(field), 200)
    }

    const createFieldHandler: RouteHandler<typeof createFieldRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof CreateFieldBodySchema
        >
        assertGeoJsonCoordinates(body.b_geometry)
        const b_id = await services.addField(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
            body.b_name,
            body.b_id_source ?? null,
            body.b_geometry as unknown as Parameters<typeof addField>[5],
            new Date(body.b_start),
            body.b_acquiring_method,
            body.b_end ? new Date(body.b_end) : undefined,
            body.b_bufferstrip,
        )
        const field = await services.getField(
            fdm,
            principal.effectivePrincipalId,
            b_id,
        )
        if (!field?.b_id) {
            throw new ApiError(
                500,
                "internal-error",
                "Field created but could not be retrieved.",
            )
        }
        c.header("Location", `${new URL(c.req.url).origin}/fields/${b_id}`)
        return c.json(serialiseField(field), 201)
    }

    const updateFieldHandler: RouteHandler<typeof updateFieldRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof UpdateFieldBodySchema
        >
        if (Object.values(body).every((value) => value === undefined)) {
            throw new ApiError(
                400,
                "validation-failed",
                "At least one field must be provided.",
            )
        }
        const existing = await services.getField(
            fdm,
            principal.effectivePrincipalId,
            b_id,
        )
        if (!existing?.b_id) {
            throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
        }
        if (body.b_geometry !== undefined && body.b_geometry !== null) {
            assertGeoJsonCoordinates(body.b_geometry)
        }
        const updated = await services.updateField(
            fdm,
            principal.effectivePrincipalId,
            b_id,
            body.b_name !== undefined ? body.b_name : existing.b_name,
            body.b_id_source !== undefined
                ? body.b_id_source
                : existing.b_id_source,
            body.b_geometry !== undefined
                ? (body.b_geometry as unknown as Parameters<
                      typeof updateField
                  >[5])
                : existing.b_geometry,
            body.b_start !== undefined
                ? new Date(body.b_start)
                : (existing.b_start ?? undefined),
            body.b_acquiring_method !== undefined
                ? body.b_acquiring_method
                : existing.b_acquiring_method,
            body.b_end !== undefined
                ? (body.b_end !== null ? new Date(body.b_end) : null)
                : (existing.b_end ?? undefined),
            body.b_bufferstrip !== undefined
                ? body.b_bufferstrip
                : existing.b_bufferstrip,
        )
        if (!updated?.b_id) {
            throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
        }
        return c.json(serialiseField(updated), 200)
    }

    const deleteFieldHandler: RouteHandler<typeof deleteFieldRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        await services.removeField(fdm, principal.effectivePrincipalId, b_id)
        return c.newResponse(null, 204)
    }

    app.openapi(listFieldsRoute, listFieldsHandler)
    app.openapi(getFieldRoute, getFieldHandler)
    app.openapi(createFieldRoute, createFieldHandler)
    app.openapi(updateFieldRoute, updateFieldHandler)
    app.openapi(deleteFieldRoute, deleteFieldHandler)
}
