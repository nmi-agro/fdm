import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  addSoilAnalysis,
  CurrentSoilData,
  FdmType,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getCurrentSoilDataPerZone,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
  getSoilAnalysis,
  getSoilImages,
  removeSoilAnalysis,
  SoilAnalysis,
  SoilZone,
  updateSoilAnalysis,
} from "@nmi-agro/fdm-core"
import type { FileStorage } from "@nmi-agro/fdm-storage"
import { createRoute, z } from "@hono/zod-openapi"
import { enrichCurrentSoilDataWithNlv } from "@nmi-agro/fdm-calculator"
import { FileNotFoundError } from "@nmi-agro/fdm-storage"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import {
  FarmIdSchema,
  FieldIdSchema,
  SoilAnalysisIdSchema,
  type SoilParameterCode,
  soilParameterDescriptions,
  soilParameterShape,
} from "../fields"
import { assertGeoJsonCoordinates } from "../guards"
import { rateLimitMiddleware } from "../rate-limit"
import {
  binaryResponse,
  commonErrorResponses,
  DateStringSchema,
  GeoJsonMultiPointSchema,
  GeoJsonMultiPolygonSchema,
  PaginationQuerySchema,
  PaginationTimeframeQuerySchema,
  paginatedResponse,
  paginatedSchema,
  parseTimeframeQuery,
  problemResponseDefinition,
  SamplingZoneGeometrySchema,
  SoilAnalysisDataSchema,
  serializeDate,
  writeErrorResponses,
} from "../schemas"
import { requireStorage } from "../storage"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/**
 * Defines the soil analysis data access functions required by the soil analysis routes.
 */
export interface SoilAnalysisServices {
  /** Returns all soil analyses for a field visible to the authenticated principal. */
  getSoilAnalyses: typeof getSoilAnalyses
  /** Returns all soil analyses on a farm visible to the authenticated principal. */
  getSoilAnalysesForFarm: typeof getSoilAnalysesForFarm
  /** Returns current soil data for a field visible to the authenticated principal. */
  getCurrentSoilData: typeof getCurrentSoilData
  /** Returns current soil data per sampling zone for a field visible to the authenticated principal. */
  getCurrentSoilDataPerZone: typeof getCurrentSoilDataPerZone
  /** Returns current soil data for every field of a farm visible to the authenticated principal. */
  getCurrentSoilDataForFarm: typeof getCurrentSoilDataForFarm
  /** Returns a single soil analysis visible to the authenticated principal. */
  getSoilAnalysis: typeof getSoilAnalysis
  /** Creates a new soil analysis on an existing field. */
  addSoilAnalysis: typeof addSoilAnalysis
  /** Updates measurement data on an existing soil analysis. */
  updateSoilAnalysis: typeof updateSoilAnalysis
  /** Permanently deletes a soil analysis. */
  removeSoilAnalysis: typeof removeSoilAnalysis
  /** Returns the photos of a soil sampling, to delete their files with the analysis. */
  getSoilImages: typeof getSoilImages
  /** Returns the file storage; `undefined` when no storage is configured. */
  getStorage: () => FileStorage | undefined
}

const SoilAnalysisSchema = z
  .object({
    a_id: SoilAnalysisIdSchema,
    a_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    a_source: z.string().describe("Laboratory or dataset that produced the soil analysis."),
    b_id_sampling: z.string().describe("Unique identifier of the soil sampling event."),
    a_depth_upper: z
      .number()
      .describe("Upper boundary of the sampled soil layer, measured from the surface (cm)."),
    a_depth_lower: z
      .number()
      .describe("Lower boundary of the sampled soil layer, measured from the surface (cm)."),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    ...soilParameterShape("nullable"),
    b_sampling_geometry: GeoJsonMultiPointSchema.nullable().describe(
      "Locations of the subsamples (WGS84).",
    ),
    b_sampling_geometry_zone: GeoJsonMultiPolygonSchema.nullable().describe(
      "Area the analysis represents (WGS84); null when it represents the whole field.",
    ),
    has_document: z
      .boolean()
      .describe(
        "True when the lab report (PDF) of this analysis is stored, for analyses imported with `POST /farms/{b_id_farm}/soil-analyses/import/apply`. Download it with `GET /soil-analyses/{a_id}/document`.",
      ),
  })
  .openapi("SoilAnalysis")

const CurrentSoilDataSourceSchema = z
  .object({
    a_id: SoilAnalysisIdSchema.describe(
      "Unique identifier of the soil analysis. For a calculated value, the analysis of the newest input.",
    ),
    a_source: z
      .string()
      .describe(
        "Laboratory or dataset that produced the soil analysis, or `calculated` for a value derived from other parameters (see `d_n_supply_base` in CurrentSoilDataItem).",
      ),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    a_depth_upper: z
      .number()
      .nullable()
      .describe(
        "Upper boundary of the sampled soil layer, measured from the surface (cm). `null` when unknown.",
      ),
    a_depth_lower: z
      .number()
      .nullable()
      .describe(
        "Lower boundary of the sampled soil layer, measured from the surface (cm). `null` when unknown.",
      ),
    value: z
      .union([z.number(), z.string(), z.null()])
      .describe(
        "Value of the parameter in this analysis, in the unit of that parameter. `null` when the analysis has no value.",
      ),
    area_fraction: z
      .number()
      .describe("Share of the area with a value that this analysis represents (0-1)."),
  })
  .openapi("CurrentSoilDataSource")

const CurrentSoilDataItemSchema = z
  .object({
    parameter: z
      .string()
      .describe(
        "Code of the soil parameter, e.g. 'a_som_loi'. See the SoilAnalysis schema for the meaning and unit of each parameter. When no analysis has a nitrogen supplying capacity (`d_n_supply_base`, kg N/ha), it is calculated from `a_som_loi`, `a_clay_mi` and `a_cn_fr`, with one source of type `calculated` and `coverage` `null`; the web app shows the same value.",
      ),
    value: z
      .union([z.number(), z.string(), z.null()])
      .describe(
        "Area-weighted mean for numeric parameters; the value with the largest area for categorical parameters.",
      ),
    is_aggregated: z.boolean().describe("True when the value combines several sampling zones."),
    coverage: z
      .number()
      .nullable()
      .describe("Share of the field area that the sources represent (0-1)."),
    has_coverage_warning: z
      .boolean()
      .describe("True when the sampling zones cover less than 95% of the field."),
    sources: z
      .array(CurrentSoilDataSourceSchema)
      .describe("Contributing soil analyses, newest first."),
  })
  .openapi("CurrentSoilDataItem")

const FarmCurrentSoilDataSchema = z
  .object({
    b_id: FieldIdSchema.describe("Unique identifier of the field."),
    items: z
      .array(CurrentSoilDataItemSchema)
      .describe(
        "Current value of each soil parameter of the field. Empty when the field has no soil data.",
      ),
  })
  .openapi("FarmCurrentSoilData")

const SoilZoneSchema = z
  .object({
    b_sampling_geometry_zone: GeoJsonMultiPolygonSchema.nullable().describe(
      "The zone clipped to the field boundary; null when the zone is the whole field.",
    ),
    b_area: z.number().nullable().describe("Area of the zone in ha."),
    a_ids: z.array(z.string()).describe("Soil analyses in this zone, newest first."),
    data: z
      .array(CurrentSoilDataItemSchema)
      .describe("Current soil data of the zone, one item per soil parameter."),
  })
  .openapi("SoilZone")

const SamplingGeometriesBodySchema = z.object({
  b_sampling_geometry: GeoJsonMultiPointSchema.nullable()
    .optional()
    .describe("Locations of the subsamples (GeoJSON MultiPoint, WGS84)."),
  b_sampling_geometry_zone: SamplingZoneGeometrySchema.nullable()
    .optional()
    .describe(
      "Area the analysis represents (GeoJSON Polygon or MultiPolygon, WGS84). Omit or null for the whole field.",
    ),
})

/** Body of a new soil analysis; also used for each analysis of a lab report import. */
export const CreateSoilAnalysisBodySchema = z
  .object({
    a_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    a_source: z.string().describe("Identifying source or lab that performed the analysis."),
    a_depth_lower: z.number().describe("Lower sampling depth in cm."),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    a_depth_upper: z.number().optional().describe("Upper sampling depth in cm (default 0)."),
  })
  .merge(SoilAnalysisDataSchema)
  .merge(SamplingGeometriesBodySchema)
  .openapi("CreateSoilAnalysis")

const UpdateSoilAnalysisBodySchema = z
  .object({
    a_date: DateStringSchema.optional().describe("Date in YYYY-MM-DD format."),
    a_source: z.string().optional().describe("Identifying source or lab."),
  })
  .merge(SoilAnalysisDataSchema)
  .merge(SamplingGeometriesBodySchema)
  .openapi("UpdateSoilAnalysis")

const soilAnalysisDocumentRoute = createRoute({
  method: "get",
  path: "/soil-analyses/{a_id}/document",
  tags: ["Soil Analyses"],
  summary: "Download the lab report of a soil analysis",
  description:
    "Returns the lab report (PDF) stored with the soil analysis. Returns 404 when the analysis has no report (`has_document` is false).",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: z.object({ a_id: SoilAnalysisIdSchema }) },
  responses: {
    200: binaryResponse("application/pdf", "The lab report."),
    ...commonErrorResponses,
    503: problemResponseDefinition(
      "Service unavailable — file storage is not configured on this server.",
    ),
  },
})

const listSoilAnalysesRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/soil-analyses",
  tags: ["Soil Analyses"],
  summary: "List soil analyses on a field",
  description: "Returns all soil analyses for the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: FieldIdSchema }),
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of soil analyses.",
      content: {
        "application/json": {
          schema: paginatedSchema(SoilAnalysisSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const listFarmSoilAnalysesRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/soil-analyses",
  tags: ["Soil Analyses"],
  summary: "List soil analyses on a farm",
  description: "Returns all soil analyses across all fields on the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    query: PaginationTimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of soil analyses.",
      content: {
        "application/json": {
          schema: paginatedSchema(SoilAnalysisSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const farmCurrentSoilDataRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/current-soil-data",
  tags: ["Soil Analyses"],
  summary: "Get current soil data for all fields of a farm",
  description:
    "Returns the current value of each soil parameter for every field of the farm, in one request. The values are the same as `GET /fields/{b_id}/current-soil-data` per field. The list is paginated by field. Use `from` and `to` to use only analyses from that period.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    query: PaginationTimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of fields with their current soil data.",
      content: {
        "application/json": {
          schema: paginatedSchema(FarmCurrentSoilDataSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const currentSoilDataRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/current-soil-data",
  tags: ["Soil Analyses"],
  summary: "Get current soil data for a field",
  description:
    "Returns the current value of each soil parameter on the specified field. When the most recent analysis for a parameter covers a sampling zone, the zones sampled within one month are combined by area; `sources` lists the contributing analyses.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id: FieldIdSchema }) },
  responses: {
    200: {
      description: "Current soil data for the field.",
      content: {
        "application/json": {
          schema: z.array(CurrentSoilDataItemSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const NEW_BADGE = { name: "New", color: "#16a34a" }

const currentSoilDataZonesRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/current-soil-data/zones",
  tags: ["Soil Analyses"],
  "x-badges": [NEW_BADGE],
  summary: "Get current soil data per sampling zone",
  description:
    "Returns the current soil data of the specified field per sampling zone, with the zone geometry clipped to the field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id: FieldIdSchema }) },
  responses: {
    200: {
      description: "Current soil data per sampling zone.",
      content: {
        "application/json": {
          schema: z.array(SoilZoneSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const createSoilAnalysisRoute = createRoute({
  method: "post",
  path: "/fields/{b_id}/soil-analyses",
  tags: ["Soil Analyses"],
  summary: "Create a soil analysis",
  description:
    "Creates a new soil analysis on the specified field from the values in the body. To add analyses from lab report PDFs and keep the report with them, use the import in two steps: `POST /farms/{b_id_farm}/soil-analyses/import/compare` and `.../apply`.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: FieldIdSchema }),
    body: {
      content: {
        "application/json": { schema: CreateSoilAnalysisBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Soil analysis created.",
      content: { "application/json": { schema: SoilAnalysisSchema } },
    },
    ...writeErrorResponses,
  },
})

const getSoilAnalysisRoute = createRoute({
  method: "get",
  path: "/soil-analyses/{a_id}",
  tags: ["Soil Analyses"],
  summary: "Get a soil analysis",
  description: "Returns a single soil analysis by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ a_id: SoilAnalysisIdSchema }) },
  responses: {
    200: {
      description: "The requested soil analysis.",
      content: { "application/json": { schema: SoilAnalysisSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateSoilAnalysisRoute = createRoute({
  method: "patch",
  path: "/soil-analyses/{a_id}",
  tags: ["Soil Analyses"],
  summary: "Update a soil analysis",
  description: "Partially updates measurement data on an existing soil analysis.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ a_id: SoilAnalysisIdSchema }),
    body: {
      content: {
        "application/json": { schema: UpdateSoilAnalysisBodySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Soil analysis updated.",
      content: { "application/json": { schema: SoilAnalysisSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteSoilAnalysisRoute = createRoute({
  method: "delete",
  path: "/soil-analyses/{a_id}",
  tags: ["Soil Analyses"],
  summary: "Delete a soil analysis",
  description: "Permanently deletes a soil analysis.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ a_id: SoilAnalysisIdSchema }) },
  responses: {
    204: { description: "Soil analysis deleted." },
    ...commonErrorResponses,
  },
})

/** Returns every soil parameter of an analysis, with `null` for parameters without a value. */
function serialiseSoilParameters(sa: SoilAnalysis) {
  const source = sa as unknown as Partial<Record<SoilParameterCode, number | string | null>>
  const values: Record<string, number | string | null> = {}
  for (const code of Object.keys(soilParameterDescriptions) as SoilParameterCode[]) {
    values[code] = source[code] ?? null
  }
  return values
}

function serialiseSoilAnalysis(sa: SoilAnalysis) {
  return {
    a_id: sa.a_id,
    a_date: serializeDate(sa.a_date),
    a_source: sa.a_source,
    b_id_sampling: sa.b_id_sampling,
    a_depth_upper: sa.a_depth_upper,
    a_depth_lower: sa.a_depth_lower,
    b_sampling_date: serializeDate(sa.b_sampling_date),
    ...serialiseSoilParameters(sa),
    b_sampling_geometry: sa.b_sampling_geometry ?? null,
    b_sampling_geometry_zone: sa.b_sampling_geometry_zone ?? null,
    has_document: Boolean((sa as { a_file_path?: string | null }).a_file_path),
  }
}

function serialiseCurrentSoilData(currentSoilData: CurrentSoilData) {
  // Same NLV fallback as the web app, so both show the same value.
  return enrichCurrentSoilDataWithNlv(currentSoilData).map((item) => ({
    parameter: item.parameter,
    value: item.value ?? null,
    is_aggregated: item.is_aggregated,
    coverage: item.coverage,
    has_coverage_warning: item.has_coverage_warning,
    sources: item.sources.map((source) => ({
      a_id: source.a_id,
      a_source: source.a_source,
      b_sampling_date: serializeDate(source.b_sampling_date),
      a_depth_upper: source.a_depth_upper ?? null,
      a_depth_lower: source.a_depth_lower ?? null,
      value: source.value ?? null,
      area_fraction: source.area_fraction,
    })),
  }))
}

function serialiseSoilZones(zones: SoilZone[]) {
  return zones.map((zone) => ({
    b_sampling_geometry_zone: zone.b_sampling_geometry_zone,
    b_area: zone.b_area,
    a_ids: zone.a_ids,
    data: serialiseCurrentSoilData(zone.data),
  }))
}

/**
 * Checks the sampling geometries in a request body: the coordinate count, and that every position is
 * a WGS84 longitude and latitude and no geometry is empty, and that every ring of the zone is
 * closed and has at least four positions. Invalid geometries are rejected with a 422 instead of
 * failing later in the soil analysis service.
 *
 * @throws {ApiError} 422 when a geometry is empty, has a position outside WGS84, or has an invalid
 * polygon or ring.
 */
/**
 * Checks the sampling geometries of a soil analysis body.
 *
 * @param body - Body with optional `b_sampling_geometry` and `b_sampling_geometry_zone`.
 * @throws {ApiError} 422 when a geometry is invalid.
 */
export function assertSamplingGeometries(body: {
  b_sampling_geometry?: unknown
  b_sampling_geometry_zone?: unknown
}): void {
  for (const [name, geometry] of [
    ["b_sampling_geometry", body.b_sampling_geometry],
    ["b_sampling_geometry_zone", body.b_sampling_geometry_zone],
  ] as const) {
    if (!geometry) continue
    assertGeoJsonCoordinates(geometry)
    const positions = collectPositions((geometry as { coordinates?: unknown }).coordinates)
    if (positions.length === 0) {
      throw new ApiError(422, "unprocessable-entity", `${name} has no coordinates.`)
    }
    const outside = positions.some(([lon, lat]) => !(Math.abs(lon) <= 180 && Math.abs(lat) <= 90))
    if (outside) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        `${name} has a position outside WGS84 (longitude -180 to 180, latitude -90 to 90).`,
      )
    }
  }
  if (body.b_sampling_geometry_zone) assertPolygonRings(body.b_sampling_geometry_zone)
}

/**
 * Checks the rings of a Polygon or MultiPolygon zone: every polygon has at least one ring, and
 * every ring is closed and has at least four positions.
 *
 * @throws {ApiError} 422 when a polygon or ring is invalid.
 */
function assertPolygonRings(geometry: unknown): void {
  const { type, coordinates } = geometry as { type?: string; coordinates?: unknown }
  const polygons = (
    type === "Polygon" ? [coordinates] : Array.isArray(coordinates) ? coordinates : []
  ) as unknown[]
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        "b_sampling_geometry_zone has a polygon without rings.",
      )
    }
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new ApiError(
          422,
          "unprocessable-entity",
          "b_sampling_geometry_zone has a ring with fewer than four positions.",
        )
      }
      const first = ring[0] as unknown[]
      const last = ring[ring.length - 1] as unknown[]
      if (
        !Array.isArray(first) ||
        !Array.isArray(last) ||
        first.length !== last.length ||
        first.some((value, index) => value !== last[index])
      ) {
        throw new ApiError(
          422,
          "unprocessable-entity",
          "b_sampling_geometry_zone has a ring whose first and last positions differ.",
        )
      }
    }
  }
}

/** Collects the positions of a GeoJSON coordinate array of any depth. */
function collectPositions(coordinates: unknown): [number, number][] {
  if (!Array.isArray(coordinates)) return []
  if (typeof coordinates[0] === "number") return [coordinates as [number, number]]
  return coordinates.flatMap((child) => collectPositions(child))
}

/**
 * Registers the soil analysis CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Soil analysis service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested soil analysis cannot be found.
 * @example
 * ```ts
 * registerSoilAnalysisRoutes(app, fdm, services)
 * ```
 */
export function registerSoilAnalysisRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: SoilAnalysisServices,
): void {
  // /fields/*/soil-analyses is covered by the /fields/* middleware in fields.ts
  // /farms/*/soil-analyses is covered by the /farms/* middleware in farms.ts
  // /fields/*/current-soil-data is covered by the /fields/* middleware in fields.ts
  app.use("/soil-analyses", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/soil-analyses/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listSoilAnalysesHandler: RouteHandler<typeof listSoilAnalysesRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const analyses = await services.getSoilAnalyses(fdm, principal.effectivePrincipalId, b_id)
    return c.json(paginatedResponse(analyses.map(serialiseSoilAnalysis), limit, offset), 200)
  }

  const listFarmSoilAnalysesHandler: RouteHandler<typeof listFarmSoilAnalysesRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof PaginationTimeframeQuerySchema>
    const analysesByField = await services.getSoilAnalysesForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      parseTimeframeQuery(query),
    )
    const analyses = Array.from(analysesByField.values()).flat()
    analyses.sort((a, b) => {
      const dateA = a.a_date ? String(a.a_date) : ""
      const dateB = b.a_date ? String(b.a_date) : ""
      return dateA < dateB
        ? -1
        : dateA > dateB
          ? 1
          : String(a.a_id ?? "").localeCompare(String(b.a_id ?? ""))
    })
    return c.json(
      paginatedResponse(analyses.map(serialiseSoilAnalysis), query.limit, query.offset),
      200,
    )
  }

  const getCurrentSoilDataHandler: RouteHandler<typeof currentSoilDataRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    const currentSoilData = await services.getCurrentSoilData(
      fdm,
      principal.effectivePrincipalId,
      b_id,
    )
    if (currentSoilData.length === 0) {
      throw new ApiError(404, "not-found", `Current soil data for field '${b_id}' not found.`)
    }
    return c.json(serialiseCurrentSoilData(currentSoilData), 200)
  }

  const getFarmCurrentSoilDataHandler: RouteHandler<typeof farmCurrentSoilDataRoute> = async (
    c,
  ) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof PaginationTimeframeQuerySchema>
    const soilDataByField = await services.getCurrentSoilDataForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      parseTimeframeQuery(query),
    )
    const items = [...soilDataByField]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([b_id, currentSoilData]) => ({
        b_id,
        items: serialiseCurrentSoilData(currentSoilData),
      }))
    return c.json(paginatedResponse(items, query.limit, query.offset), 200)
  }

  const getCurrentSoilDataZonesHandler: RouteHandler<typeof currentSoilDataZonesRoute> = async (
    c,
  ) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    const zones = await services.getCurrentSoilDataPerZone(
      fdm,
      principal.effectivePrincipalId,
      b_id,
    )
    if (zones.length === 0) {
      throw new ApiError(404, "not-found", `Current soil data for field '${b_id}' not found.`)
    }
    return c.json(serialiseSoilZones(zones), 200)
  }

  const createSoilAnalysisHandler: RouteHandler<typeof createSoilAnalysisRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateSoilAnalysisBodySchema>
    assertSamplingGeometries(body)
    const { a_date, a_source, a_depth_lower, b_sampling_date, a_depth_upper, ...soilAnalysisData } =
      body
    const a_id = await services.addSoilAnalysis(
      fdm,
      principal.effectivePrincipalId,
      new Date(a_date),
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date ? new Date(b_sampling_date) : null,
      soilAnalysisData as Parameters<typeof addSoilAnalysis>[7],
      a_depth_upper,
    )
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    if (!analysis?.a_id) {
      throw new ApiError(500, "internal-error", "Soil analysis created but could not be retrieved.")
    }
    c.header("Location", `${new URL(c.req.url).origin}/soil-analyses/${a_id}`)
    return c.json(serialiseSoilAnalysis(analysis), 201)
  }

  const soilAnalysisDocumentHandler: RouteHandler<typeof soilAnalysisDocumentRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id } = c.req.valid("param") as { a_id: string }
    const storage = requireStorage(services.getStorage)
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    if (!analysis?.a_id) {
      throw new ApiError(404, "not-found", `Soil analysis '${a_id}' not found.`)
    }
    const filePath = (analysis as { a_file_path?: string | null }).a_file_path
    if (!filePath) {
      throw new ApiError(404, "not-found", `Soil analysis '${a_id}' has no lab report.`)
    }
    let file: Awaited<ReturnType<FileStorage["download"]>>
    try {
      file = await storage.download(filePath)
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        throw new ApiError(
          404,
          "not-found",
          `The lab report of soil analysis '${a_id}' is missing.`,
        )
      }
      throw err
    }
    return c.body(new Uint8Array(file.buffer), 200, {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="soil-analysis-${a_id}.pdf"`,
    }) as never
  }

  const getSoilAnalysisHandler: RouteHandler<typeof getSoilAnalysisRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id } = c.req.valid("param") as { a_id: string }
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    if (!analysis?.a_id) {
      throw new ApiError(404, "not-found", `Soil analysis '${a_id}' not found.`)
    }
    return c.json(serialiseSoilAnalysis(analysis), 200)
  }

  const updateSoilAnalysisHandler: RouteHandler<typeof updateSoilAnalysisRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id } = c.req.valid("param") as { a_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateSoilAnalysisBodySchema>
    assertSamplingGeometries(body)
    const definedFields = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    )
    if (Object.keys(definedFields).length === 0) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }
    const { a_date, a_source, ...measurementData } = definedFields
    const soilAnalysisData: Record<string, unknown> = { ...measurementData }
    if (a_date !== undefined) soilAnalysisData.a_date = new Date(a_date as string)
    if (a_source !== undefined) soilAnalysisData.a_source = a_source
    await services.updateSoilAnalysis(
      fdm,
      principal.effectivePrincipalId,
      a_id,
      soilAnalysisData as Parameters<typeof updateSoilAnalysis>[3],
    )
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    if (!analysis?.a_id) {
      throw new ApiError(404, "not-found", `Soil analysis '${a_id}' not found.`)
    }
    return c.json(serialiseSoilAnalysis(analysis), 200)
  }

  const deleteSoilAnalysisHandler: RouteHandler<typeof deleteSoilAnalysisRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { a_id } = c.req.valid("param") as { a_id: string }
    // Collect the files of the analysis (lab report and BCS photos) before it is removed.
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    const files: string[] = []
    const reportPath = (analysis as { a_file_path?: string | null } | undefined)?.a_file_path
    if (reportPath) files.push(reportPath)
    if (analysis?.b_id_sampling) {
      const images = await services.getSoilImages(
        fdm,
        principal.effectivePrincipalId,
        analysis.b_id_sampling,
      )
      files.push(...images.map((image) => image.a_image_path))
    }

    await services.removeSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)

    // The analysis is removed; a file that cannot be deleted is only logged.
    const storage = services.getStorage()
    if (storage) {
      await Promise.all(
        files.map((path) =>
          storage.delete(path).catch((err: unknown) => {
            console.warn(`[fdm-api] could not delete ${path} of soil analysis ${a_id}:`, err)
          }),
        ),
      )
    }
    return c.newResponse(null, 204)
  }

  app.openapi(listSoilAnalysesRoute, listSoilAnalysesHandler)
  app.openapi(soilAnalysisDocumentRoute, soilAnalysisDocumentHandler)
  app.openapi(listFarmSoilAnalysesRoute, listFarmSoilAnalysesHandler)
  app.openapi(farmCurrentSoilDataRoute, getFarmCurrentSoilDataHandler)
  app.openapi(currentSoilDataRoute, getCurrentSoilDataHandler)
  app.openapi(currentSoilDataZonesRoute, getCurrentSoilDataZonesHandler)
  app.openapi(createSoilAnalysisRoute, createSoilAnalysisHandler)
  app.openapi(getSoilAnalysisRoute, getSoilAnalysisHandler)
  app.openapi(updateSoilAnalysisRoute, updateSoilAnalysisHandler)
  app.openapi(deleteSoilAnalysisRoute, deleteSoilAnalysisHandler)
}
