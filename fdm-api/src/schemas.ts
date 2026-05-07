import { z } from "zod"

export const ProblemDetailsSchema = z.object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    error_id: z.string(),
})

export const PaginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50)
        .describe("Maximum number of items to return (1–200, default 50)."),
    offset: z.coerce.number().int().min(0).default(0)
        .describe("Number of items to skip before returning results."),
})

export function paginatedResponse<T>(data: T[], limit: number, offset: number) {
    return {
        data: data.slice(offset, offset + limit),
        limit,
        offset,
        total: data.length,
    }
}

export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
    return z.object({
        data: z.array(itemSchema),
        limit: z.number().int(),
        offset: z.number().int(),
        total: z.number().int(),
    })
}

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
} as const

const GeoJsonPositionSchema = z.tuple([z.number(), z.number()])

const GeoJsonPolygonSchema = z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(GeoJsonPositionSchema)),
})

const GeoJsonMultiPolygonSchema = z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(GeoJsonPositionSchema))),
})

export const GeoJsonGeometrySchema = z.union([GeoJsonPolygonSchema, GeoJsonMultiPolygonSchema])
