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
 * Serializes a date value to a YYYY-MM-DD string for API responses.
 * Returns null for null/undefined inputs.
 */
export function serializeDate(date: Date | string | null | undefined): string | null {
  if (date instanceof Date) return date.toISOString().slice(0, 10)
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
export const SoilAnalysisDataSchema = z.object({
  a_al_ox: z.number().nullable().optional(),
  a_c_of: z.number().nullable().optional(),
  a_ca_co: z.number().nullable().optional(),
  a_ca_co_po: z.number().nullable().optional(),
  a_caco3_if: z.number().nullable().optional(),
  a_cec_co: z.number().nullable().optional(),
  a_clay_mi: z.number().nullable().optional(),
  a_cn_fr: z.number().nullable().optional(),
  a_com_fr: z.number().nullable().optional(),
  a_cu_cc: z.number().nullable().optional(),
  a_density_sa: z.number().nullable().optional(),
  a_fe_ox: z.number().nullable().optional(),
  a_k_cc: z.number().nullable().optional(),
  a_k_co: z.number().nullable().optional(),
  a_k_co_po: z.number().nullable().optional(),
  a_mg_cc: z.number().nullable().optional(),
  a_mg_co: z.number().nullable().optional(),
  a_mg_co_po: z.number().nullable().optional(),
  a_n_pmn: z.number().nullable().optional(),
  a_n_rt: z.number().nullable().optional(),
  a_nh4_cc: z.number().nullable().optional(),
  a_nmin_cc: z.number().nullable().optional(),
  a_no3_cc: z.number().nullable().optional(),
  a_p_al: z.number().nullable().optional(),
  a_p_cc: z.number().nullable().optional(),
  a_p_ox: z.number().nullable().optional(),
  a_p_rt: z.number().nullable().optional(),
  a_p_sg: z.number().nullable().optional(),
  a_p_wa: z.number().nullable().optional(),
  a_ph_cc: z.number().nullable().optional(),
  a_s_rt: z.number().nullable().optional(),
  a_sand_mi: z.number().nullable().optional(),
  a_silt_mi: z.number().nullable().optional(),
  a_som_loi: z.number().nullable().optional(),
  a_zn_cc: z.number().nullable().optional(),
  b_gwl_class: z.string().nullable().optional(),
  b_soiltype_agr: z.string().nullable().optional(),
})

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
