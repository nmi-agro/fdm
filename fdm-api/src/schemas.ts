import { toFdmDateString } from "@nmi-agro/fdm-core"
import { z } from "zod"
import { soilParameterShape } from "./fields"

/**
 * Describes the RFC 9457 problem details payload returned by API error responses.
 */
export const ProblemDetailsSchema = z.object({
  type: z.string().url().describe("URI that identifies the problem type."),
  title: z.string().describe("Short, human-readable summary of the problem type."),
  status: z.number().int().describe("HTTP status code of the response."),
  detail: z.string().describe("Human-readable explanation of this occurrence of the problem."),
  instance: z.string().describe("URI of the request that caused the problem."),
  error_id: z
    .string()
    .describe("Unique identifier of this error occurrence, to quote when contacting support."),
})

/**
 * Defines the standard `limit` and `offset` query parameters used by list endpoints.
 */
export const PaginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of items to return (1–200, default 50)."),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of items to skip before returning results."),
})

/**
 * Validates and documents a calendar date string in YYYY-MM-DD format.
 */
export const DateStringSchema = z.string().date().openapi({ example: "2024-01-15" })

/**
 * Serializes a date value to a YYYY-MM-DD string for API responses, as its calendar date in
 * Europe/Amsterdam. Returns null for null/undefined inputs.
 */
export function serializeDate(date: Date | string | null | undefined): string | null {
  if (date instanceof Date) return toFdmDateString(date)
  if (typeof date === "string" && date.length >= 10) return date.slice(0, 10)
  return null
}

/**
 * Defines optional `from` and `to` query parameters for timeframe-aware list endpoints.
 */
export const TimeframeQuerySchema = z.object({
  from: DateStringSchema.optional().describe("Inclusive timeframe start (YYYY-MM-DD)."),
  to: DateStringSchema.optional().describe("Inclusive timeframe end (YYYY-MM-DD)."),
})

/**
 * Extends the standard pagination query with optional timeframe filters.
 */
export const PaginationTimeframeQuerySchema = PaginationQuerySchema.extend({
  from: TimeframeQuerySchema.shape.from,
  to: TimeframeQuerySchema.shape.to,
})

/**
 * Converts optional `from`/`to` query parameters into an fdm-core timeframe object.
 */
export function parseTimeframeQuery(query: z.infer<typeof TimeframeQuerySchema>) {
  return query.from || query.to
    ? {
        start: query.from ? new Date(query.from) : undefined,
        end: query.to ? new Date(query.to) : undefined,
      }
    : undefined
}

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
    data: z.array(itemSchema).describe("Items on this page."),
    limit: z.number().int().describe("Maximum number of items on this page, as requested."),
    offset: z.number().int().describe("Number of items skipped before this page, as requested."),
    total: z.number().int().describe("Total number of items across all pages."),
  })
}

/**
 * Reusable OpenAPI response definitions for common API failure cases.
 */
export const commonErrorResponses = {
  401: {
    description: "Unauthorized — missing or invalid API key.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
  403: {
    description: "Forbidden — API key does not have access to this resource.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
  404: {
    description: "Not found.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
  429: {
    description: "Rate limit exceeded.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
  500: {
    description: "Internal server error.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
}

/**
 * Extends `commonErrorResponses` with the additional failure codes relevant to write operations.
 */
export const writeErrorResponses = {
  ...commonErrorResponses,
  400: {
    description: "Bad request — request body failed validation.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
  413: {
    description: "Payload too large — request body exceeds the 5 MB limit.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
  415: {
    description: "Unsupported media type — Content-Type must be application/json.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
  422: {
    description: "Unprocessable entity — request data failed semantic validation.",
    content: {
      "application/problem+json": { schema: ProblemDetailsSchema },
    },
  },
}

/**
 * Reusable schema for optional soil measurement fields accepted in create and update requests.
 */
export const SoilAnalysisDataSchema = z.object(soilParameterShape("optional"))

const GeoJsonPositionSchema = z
  .tuple([z.number(), z.number()])
  .describe("Position as [longitude, latitude] in WGS84 (EPSG:4326) decimal degrees.")

const GeoJsonPolygonSchema = z.object({
  type: z.literal("Polygon").describe("GeoJSON geometry type."),
  coordinates: z
    .array(z.array(GeoJsonPositionSchema))
    .describe(
      "Linear rings of the polygon: the first ring is the exterior, any further rings are holes. Each ring is closed (first and last position are equal).",
    ),
})

const GeoJsonMultiPolygonSchema = z.object({
  type: z.literal("MultiPolygon").describe("GeoJSON geometry type."),
  coordinates: z
    .array(z.array(z.array(GeoJsonPositionSchema)))
    .describe("Polygons of the geometry, each as a list of linear rings."),
})

/**
 * Validates the GeoJSON geometry shapes accepted by field endpoints.
 */
export const GeoJsonGeometrySchema = z.union([GeoJsonPolygonSchema, GeoJsonMultiPolygonSchema])
