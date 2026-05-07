import { z } from "zod"

/**
 * Describes the RFC 9457 problem details payload returned by API error responses.
 */
export const ProblemDetailsSchema = z.object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    error_id: z.string(),
})

/**
 * Defines the standard `limit` and `offset` query parameters used by list endpoints.
 */
export const PaginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50)
        .describe("Maximum number of items to return (1–200, default 50)."),
    offset: z.coerce.number().int().min(0).default(0)
        .describe("Number of items to skip before returning results."),
})

/**
 * Builds a paginated response envelope from an in-memory collection.
 *
 * @param data - Full result set before pagination is applied.
 * @param limit - Maximum number of items to include in the page.
 * @param offset - Zero-based number of items to skip before slicing.
 * @returns An object containing the paginated `data` slice together with the original total count.
 * @example
 * ```ts
 * return paginatedResponse(items, 50, 0)
 * ```
 */
export function paginatedResponse<T>(data: T[], limit: number, offset: number) {
    return {
        data: data.slice(offset, offset + limit),
        limit,
        offset,
        total: data.length,
    }
}

/**
 * Wraps an item schema in the standard paginated response envelope.
 *
 * @param itemSchema - Zod schema describing a single item in the `data` array.
 * @returns A Zod object schema with `data`, `limit`, `offset`, and `total` fields.
 * @example
 * ```ts
 * const FarmListSchema = paginatedSchema(FarmSchema)
 * ```
 */
export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
    return z.object({
        data: z.array(itemSchema),
        limit: z.number().int(),
        offset: z.number().int(),
        total: z.number().int(),
    })
}

/**
 * Reusable OpenAPI response definitions for common API failure cases.
 */
export const commonErrorResponses = {
    401: {
        description: "Unauthorized — missing or invalid API key.",
        content: { "application/problem+json": { schema: ProblemDetailsSchema } },
    },
    403: {
        description: "Forbidden — API key does not have access to this resource.",
        content: { "application/problem+json": { schema: ProblemDetailsSchema } },
    },
    404: {
        description: "Not found.",
        content: { "application/problem+json": { schema: ProblemDetailsSchema } },
    },
    429: {
        description: "Rate limit exceeded.",
        content: { "application/problem+json": { schema: ProblemDetailsSchema } },
    },
    500: {
        description: "Internal server error.",
        content: { "application/problem+json": { schema: ProblemDetailsSchema } },
    },
}

const GeoJsonPositionSchema = z.tuple([z.number(), z.number()])

const GeoJsonPolygonSchema = z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(GeoJsonPositionSchema)),
})

const GeoJsonMultiPolygonSchema = z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(GeoJsonPositionSchema))),
})

/**
 * Validates the GeoJSON geometry shapes accepted by field endpoints.
 */
export const GeoJsonGeometrySchema = z.union([GeoJsonPolygonSchema, GeoJsonMultiPolygonSchema])
