import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import type { FileStorage } from "@nmi-agro/fdm-storage"
import { createRoute, z } from "@hono/zod-openapi"
import { FileNotFoundError } from "@nmi-agro/fdm-storage"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { FarmParamsSchema } from "../operations/farms"
import {
  CreateSoilAnalysisBodySchema,
  CurrentSoilDataItemSchema,
  createSoilAnalysis,
  deleteSoilAnalysis,
  FarmCurrentSoilDataSchema,
  getFarmCurrentSoilData,
  getFieldCurrentSoilData,
  getFieldCurrentSoilDataPerZone,
  getSoilAnalysis,
  listFarmSoilAnalyses,
  listFieldSoilAnalyses,
  SoilAnalysisFieldParamsSchema,
  SoilAnalysisParamsSchema,
  SoilAnalysisSchema,
  type SoilAnalysisServices,
  SoilZoneSchema,
  UpdateSoilAnalysisBodySchema,
  updateSoilAnalysis,
} from "../operations/soil-analyses"
import { rateLimitMiddleware } from "../rate-limit"
import {
  binaryResponse,
  commonErrorResponses,
  PaginationQuerySchema,
  PaginationTimeframeQuerySchema,
  paginatedResponse,
  paginatedSchema,
  problemResponseDefinition,
  writeErrorResponses,
} from "../schemas"
import { requireStorage } from "../storage"
import { operationContext } from "./operation-context"

export type { SoilAnalysisServices } from "../operations/soil-analyses"
export { assertSamplingGeometries, CreateSoilAnalysisBodySchema } from "../operations/soil-analyses"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

const soilAnalysisDocumentRoute = createRoute({
  operationId: "downloadSoilAnalysisDocument",
  method: "get",
  path: "/soil-analyses/{a_id}/document",
  tags: ["Soil Analyses"],
  summary: "Download the lab report of a soil analysis",
  description:
    "Returns the lab report (PDF) stored with the soil analysis. Returns 404 when the analysis has no report (`has_document` is false).",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: { params: SoilAnalysisParamsSchema },
  responses: {
    200: binaryResponse("application/pdf", "The lab report."),
    ...commonErrorResponses,
    503: problemResponseDefinition(
      "Service unavailable — file storage is not configured on this server.",
    ),
  },
})

const listSoilAnalysesRoute = createRoute({
  operationId: listFieldSoilAnalyses.name,
  method: "get",
  path: "/fields/{b_id}/soil-analyses",
  tags: ["Soil Analyses"],
  summary: "List soil analyses on a field",
  description: "Returns all soil analyses for the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: SoilAnalysisFieldParamsSchema,
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
  operationId: listFarmSoilAnalyses.name,
  method: "get",
  path: "/farms/{b_id_farm}/soil-analyses",
  tags: ["Soil Analyses"],
  summary: "List soil analyses on a farm",
  description: "Returns all soil analyses across all fields on the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmParamsSchema,
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
  operationId: getFarmCurrentSoilData.name,
  method: "get",
  path: "/farms/{b_id_farm}/current-soil-data",
  tags: ["Soil Analyses"],
  summary: "Get current soil data for all fields of a farm",
  description:
    "Returns the current value of each soil parameter for every field of the farm, in one request. The values are the same as `GET /fields/{b_id}/current-soil-data` per field. The list is paginated by field. Use `from` and `to` to use only analyses from that period.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: FarmParamsSchema,
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
  operationId: getFieldCurrentSoilData.name,
  method: "get",
  path: "/fields/{b_id}/current-soil-data",
  tags: ["Soil Analyses"],
  summary: "Get current soil data for a field",
  description:
    "Returns the current value of each soil parameter on the specified field. When the most recent analysis for a parameter covers a sampling zone, the zones sampled within one month are combined by area; `sources` lists the contributing analyses.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: SoilAnalysisFieldParamsSchema },
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
  operationId: getFieldCurrentSoilDataPerZone.name,
  method: "get",
  path: "/fields/{b_id}/current-soil-data/zones",
  tags: ["Soil Analyses"],
  "x-badges": [NEW_BADGE],
  summary: "Get current soil data per sampling zone",
  description:
    "Returns the current soil data of the specified field per sampling zone, with the zone geometry clipped to the field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: SoilAnalysisFieldParamsSchema },
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
  operationId: createSoilAnalysis.name,
  method: "post",
  path: "/fields/{b_id}/soil-analyses",
  tags: ["Soil Analyses"],
  summary: "Create a soil analysis",
  description:
    "Creates a new soil analysis on the specified field from the values in the body. To add analyses from lab report PDFs and keep the report with them, use the import in two steps: `POST /farms/{b_id_farm}/soil-analyses/import/compare` and `.../apply`.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: SoilAnalysisFieldParamsSchema,
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
  operationId: getSoilAnalysis.name,
  method: "get",
  path: "/soil-analyses/{a_id}",
  tags: ["Soil Analyses"],
  summary: "Get a soil analysis",
  description: "Returns a single soil analysis by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: SoilAnalysisParamsSchema },
  responses: {
    200: {
      description: "The requested soil analysis.",
      content: { "application/json": { schema: SoilAnalysisSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateSoilAnalysisRoute = createRoute({
  operationId: updateSoilAnalysis.name,
  method: "patch",
  path: "/soil-analyses/{a_id}",
  tags: ["Soil Analyses"],
  summary: "Update a soil analysis",
  description: "Partially updates measurement data on an existing soil analysis.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: SoilAnalysisParamsSchema,
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
  operationId: deleteSoilAnalysis.name,
  method: "delete",
  path: "/soil-analyses/{a_id}",
  tags: ["Soil Analyses"],
  summary: "Delete a soil analysis",
  description: "Permanently deletes a soil analysis.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: SoilAnalysisParamsSchema },
  responses: {
    204: { description: "Soil analysis deleted." },
    ...commonErrorResponses,
  },
})

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
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof SoilAnalysisFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const analyses = await listFieldSoilAnalyses.run(operationContext(c, fdm, services), params)
    return c.json(paginatedResponse(analyses, limit, offset), 200)
  }

  const listFarmSoilAnalysesHandler: RouteHandler<typeof listFarmSoilAnalysesRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...timeframe } = c.req.valid("query") as z.infer<
      typeof PaginationTimeframeQuerySchema
    >
    const analyses = await listFarmSoilAnalyses.run(operationContext(c, fdm, services), {
      ...params,
      ...timeframe,
    })
    return c.json(paginatedResponse(analyses, limit, offset), 200)
  }

  const getCurrentSoilDataHandler: RouteHandler<typeof currentSoilDataRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof SoilAnalysisFieldParamsSchema>
    return c.json(
      await getFieldCurrentSoilData.run(operationContext(c, fdm, services), params),
      200,
    )
  }

  const getFarmCurrentSoilDataHandler: RouteHandler<typeof farmCurrentSoilDataRoute> = async (
    c,
  ) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset, ...timeframe } = c.req.valid("query") as z.infer<
      typeof PaginationTimeframeQuerySchema
    >
    const items = await getFarmCurrentSoilData.run(operationContext(c, fdm, services), {
      ...params,
      ...timeframe,
    })
    return c.json(paginatedResponse(items, limit, offset), 200)
  }

  const getCurrentSoilDataZonesHandler: RouteHandler<typeof currentSoilDataZonesRoute> = async (
    c,
  ) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof SoilAnalysisFieldParamsSchema>
    const zones = await getFieldCurrentSoilDataPerZone.run(
      operationContext(c, fdm, services),
      params,
    )
    return c.json(zones, 200)
  }

  const createSoilAnalysisHandler: RouteHandler<typeof createSoilAnalysisRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof SoilAnalysisFieldParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateSoilAnalysisBodySchema>
    const analysis = await createSoilAnalysis.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    c.header("Location", `${new URL(c.req.url).origin}/soil-analyses/${analysis.a_id}`)
    return c.json(analysis, 201)
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
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof SoilAnalysisParamsSchema>
    return c.json(await getSoilAnalysis.run(operationContext(c, fdm, services), params), 200)
  }

  const updateSoilAnalysisHandler: RouteHandler<typeof updateSoilAnalysisRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof SoilAnalysisParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateSoilAnalysisBodySchema>
    const analysis = await updateSoilAnalysis.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(analysis, 200)
  }

  const deleteSoilAnalysisHandler: RouteHandler<typeof deleteSoilAnalysisRoute> = async (c) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof SoilAnalysisParamsSchema>
    await deleteSoilAnalysis.run(operationContext(c, fdm, services), params)
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
