import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  addSoilAnalysis,
  CurrentSoilData,
  FdmType,
  getCurrentSoilData,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
  getSoilAnalysis,
  removeSoilAnalysis,
  SoilAnalysis,
  updateSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  DateStringSchema,
  PaginationQuerySchema,
  PaginationTimeframeQuerySchema,
  paginatedResponse,
  paginatedSchema,
  parseTimeframeQuery,
  SoilAnalysisDataSchema,
  serializeDate,
  writeErrorResponses,
} from "../schemas"

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
  /** Returns a single soil analysis visible to the authenticated principal. */
  getSoilAnalysis: typeof getSoilAnalysis
  /** Creates a new soil analysis on an existing field. */
  addSoilAnalysis: typeof addSoilAnalysis
  /** Updates measurement data on an existing soil analysis. */
  updateSoilAnalysis: typeof updateSoilAnalysis
  /** Permanently deletes a soil analysis. */
  removeSoilAnalysis: typeof removeSoilAnalysis
}

const SoilAnalysisSchema = z
  .object({
    a_id: z.string(),
    a_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    a_source: z.string(),
    b_id_sampling: z.string(),
    a_depth_upper: z.number(),
    a_depth_lower: z.number(),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    a_al_ox: z.number().nullable(),
    a_c_of: z.number().nullable(),
    a_ca_co: z.number().nullable(),
    a_ca_co_po: z.number().nullable(),
    a_caco3_if: z.number().nullable(),
    a_cec_co: z.number().nullable(),
    a_clay_mi: z.number().nullable(),
    a_cn_fr: z.number().nullable(),
    a_com_fr: z.number().nullable(),
    a_cu_cc: z.number().nullable(),
    a_density_sa: z.number().nullable(),
    a_fe_ox: z.number().nullable(),
    a_k_cc: z.number().nullable(),
    a_k_co: z.number().nullable(),
    a_k_co_po: z.number().nullable(),
    a_mg_cc: z.number().nullable(),
    a_mg_co: z.number().nullable(),
    a_mg_co_po: z.number().nullable(),
    a_n_pmn: z.number().nullable(),
    a_n_rt: z.number().nullable(),
    a_nh4_cc: z.number().nullable(),
    a_nmin_cc: z.number().nullable(),
    a_no3_cc: z.number().nullable(),
    a_p_al: z.number().nullable(),
    a_p_cc: z.number().nullable(),
    a_p_ox: z.number().nullable(),
    a_p_rt: z.number().nullable(),
    a_p_sg: z.number().nullable(),
    a_p_wa: z.number().nullable(),
    a_ph_cc: z.number().nullable(),
    a_s_rt: z.number().nullable(),
    a_sand_mi: z.number().nullable(),
    a_silt_mi: z.number().nullable(),
    a_som_loi: z.number().nullable(),
    a_zn_cc: z.number().nullable(),
    b_gwl_class: z.string().nullable(),
    b_soiltype_agr: z.string().nullable(),
  })
  .openapi("SoilAnalysis")

const CurrentSoilDataItemSchema = z
  .object({
    parameter: z.string(),
    value: z.union([z.number(), z.string(), z.null()]),
    a_id: z.string(),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    a_depth_upper: z.number().nullable(),
    a_depth_lower: z.number().nullable(),
    a_source: z.string(),
  })
  .openapi("CurrentSoilDataItem")

const CreateSoilAnalysisBodySchema = z
  .object({
    a_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    a_source: z.string().describe("Identifying source or lab that performed the analysis."),
    a_depth_lower: z.number().describe("Lower sampling depth in cm."),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    a_depth_upper: z.number().optional().describe("Upper sampling depth in cm (default 0)."),
  })
  .merge(SoilAnalysisDataSchema)
  .openapi("CreateSoilAnalysis")

const UpdateSoilAnalysisBodySchema = z
  .object({
    a_date: DateStringSchema.optional().describe("Date in YYYY-MM-DD format."),
    a_source: z.string().optional().describe("Identifying source or lab."),
  })
  .merge(SoilAnalysisDataSchema)
  .openapi("UpdateSoilAnalysis")

const listSoilAnalysesRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/soil-analyses",
  tags: ["Soil Analyses"],
  summary: "List soil analyses on a field",
  description: "Returns all soil analyses for the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: z.string() }),
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
    params: z.object({ b_id_farm: z.string() }),
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

const currentSoilDataRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/current-soil-data",
  tags: ["Soil Analyses"],
  summary: "Get current soil data for a field",
  description:
    "Returns the most recent known value for each soil parameter on the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id: z.string() }) },
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

const createSoilAnalysisRoute = createRoute({
  method: "post",
  path: "/fields/{b_id}/soil-analyses",
  tags: ["Soil Analyses"],
  summary: "Create a soil analysis",
  description: "Creates a new soil analysis on the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: z.string() }),
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
  request: { params: z.object({ a_id: z.string() }) },
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
    params: z.object({ a_id: z.string() }),
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
  request: { params: z.object({ a_id: z.string() }) },
  responses: {
    204: { description: "Soil analysis deleted." },
    ...commonErrorResponses,
  },
})

function serialiseSoilAnalysis(sa: SoilAnalysis) {
  return {
    a_id: sa.a_id,
    a_date: serializeDate(sa.a_date),
    a_source: sa.a_source,
    b_id_sampling: sa.b_id_sampling,
    a_depth_upper: sa.a_depth_upper,
    a_depth_lower: sa.a_depth_lower,
    b_sampling_date: serializeDate(sa.b_sampling_date),
    a_al_ox: sa.a_al_ox ?? null,
    a_c_of: sa.a_c_of ?? null,
    a_ca_co: sa.a_ca_co ?? null,
    a_ca_co_po: sa.a_ca_co_po ?? null,
    a_caco3_if: sa.a_caco3_if ?? null,
    a_cec_co: sa.a_cec_co ?? null,
    a_clay_mi: sa.a_clay_mi ?? null,
    a_cn_fr: sa.a_cn_fr ?? null,
    a_com_fr: sa.a_com_fr ?? null,
    a_cu_cc: sa.a_cu_cc ?? null,
    a_density_sa: sa.a_density_sa ?? null,
    a_fe_ox: sa.a_fe_ox ?? null,
    a_k_cc: sa.a_k_cc ?? null,
    a_k_co: sa.a_k_co ?? null,
    a_k_co_po: sa.a_k_co_po ?? null,
    a_mg_cc: sa.a_mg_cc ?? null,
    a_mg_co: sa.a_mg_co ?? null,
    a_mg_co_po: sa.a_mg_co_po ?? null,
    a_n_pmn: sa.a_n_pmn ?? null,
    a_n_rt: sa.a_n_rt ?? null,
    a_nh4_cc: sa.a_nh4_cc ?? null,
    a_nmin_cc: sa.a_nmin_cc ?? null,
    a_no3_cc: sa.a_no3_cc ?? null,
    a_p_al: sa.a_p_al ?? null,
    a_p_cc: sa.a_p_cc ?? null,
    a_p_ox: sa.a_p_ox ?? null,
    a_p_rt: sa.a_p_rt ?? null,
    a_p_sg: sa.a_p_sg ?? null,
    a_p_wa: sa.a_p_wa ?? null,
    a_ph_cc: sa.a_ph_cc ?? null,
    a_s_rt: sa.a_s_rt ?? null,
    a_sand_mi: sa.a_sand_mi ?? null,
    a_silt_mi: sa.a_silt_mi ?? null,
    a_som_loi: sa.a_som_loi ?? null,
    a_zn_cc: sa.a_zn_cc ?? null,
    b_gwl_class: sa.b_gwl_class ?? null,
    b_soiltype_agr: sa.b_soiltype_agr ?? null,
  }
}

function serialiseCurrentSoilData(currentSoilData: CurrentSoilData) {
  return currentSoilData.map((item) => ({
    parameter: item.parameter,
    value: item.value ?? null,
    a_id: item.a_id,
    b_sampling_date: serializeDate(item.b_sampling_date),
    a_depth_upper: item.a_depth_upper ?? null,
    a_depth_lower: item.a_depth_lower ?? null,
    a_source: item.a_source,
  }))
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

  const createSoilAnalysisHandler: RouteHandler<typeof createSoilAnalysisRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateSoilAnalysisBodySchema>
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
      soilAnalysisData,
      a_depth_upper,
    )
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    if (!analysis?.a_id) {
      throw new ApiError(500, "internal-error", "Soil analysis created but could not be retrieved.")
    }
    c.header("Location", `${new URL(c.req.url).origin}/soil-analyses/${a_id}`)
    return c.json(serialiseSoilAnalysis(analysis), 201)
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
    await services.removeSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    return c.newResponse(null, 204)
  }

  app.openapi(listSoilAnalysesRoute, listSoilAnalysesHandler)
  app.openapi(listFarmSoilAnalysesRoute, listFarmSoilAnalysesHandler)
  app.openapi(currentSoilDataRoute, getCurrentSoilDataHandler)
  app.openapi(createSoilAnalysisRoute, createSoilAnalysisHandler)
  app.openapi(getSoilAnalysisRoute, getSoilAnalysisHandler)
  app.openapi(updateSoilAnalysisRoute, updateSoilAnalysisHandler)
  app.openapi(deleteSoilAnalysisRoute, deleteSoilAnalysisHandler)
}
