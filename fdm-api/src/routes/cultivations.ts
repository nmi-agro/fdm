import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  addCultivation,
  Cultivation,
  FdmType,
  getCultivation,
  getCultivations,
  getCultivationsForFarm,
  removeCultivation,
  updateCultivation,
} from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import {
  CultivationHcat3NameSchema,
  CultivationHcat3Schema,
  CultivationIdSchema,
  FarmIdSchema,
  FieldIdSchema,
} from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  DateStringSchema,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  serializeDate,
  writeErrorResponses,
} from "../schemas"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/**
 * Defines the cultivation data access functions required by the cultivation routes.
 */
export interface CultivationServices {
  /** Returns all cultivations on a field visible to the authenticated principal. */
  getCultivations: typeof getCultivations
  /** Returns all cultivations on a farm visible to the authenticated principal. */
  getCultivationsForFarm: typeof getCultivationsForFarm
  /** Returns a single cultivation visible to the authenticated principal. */
  getCultivation: typeof getCultivation
  /** Creates a new cultivation on an existing field. */
  addCultivation: typeof addCultivation
  /** Updates an existing cultivation. */
  updateCultivation: typeof updateCultivation
  /** Permanently deletes a cultivation. */
  removeCultivation: typeof removeCultivation
}

const CultivationSchema = z
  .object({
    b_lu: CultivationIdSchema,
    b_lu_catalogue: z
      .string()
      .describe(
        "Identifier of the cultivation in its catalogue, prefixed by the catalogue, e.g. 'nl_265'.",
      ),
    b_lu_source: z
      .string()
      .describe("Catalogue the cultivation comes from, e.g. 'brp' for the Dutch crop list."),
    b_lu_name: z.string().describe("Name of the cultivation in the language of its catalogue."),
    b_lu_name_en: z
      .string()
      .nullable()
      .describe("English name of the cultivation. `null` when no translation is available."),
    b_lu_hcat3: CultivationHcat3Schema,
    b_lu_hcat3_name: CultivationHcat3NameSchema,
    b_lu_croprotation: z
      .enum([
        "other",
        "clover",
        "nature",
        "potato",
        "grass",
        "rapeseed",
        "starch",
        "maize",
        "cereal",
        "sugarbeet",
        "alfalfa",
        "catchcrop",
      ])
      .nullable()
      .describe(
        "Crop rotation category of the cultivation, e.g. 'grass', 'maize', 'cereal' or 'potato'. `null` when unknown.",
      ),
    b_lu_eom: z
      .number()
      .nullable()
      .describe(
        "Effective organic matter supplied by the crop: organic matter that remains in the soil one year after input (kg EOM/ha/year). Range 0–7500. `null` when unknown.",
      ),
    b_lu_eom_residue: z
      .number()
      .nullable()
      .describe(
        "Effective organic matter supplied by crop residues such as straw and leaves (kg EOM/ha/year). Range 0–1500. `null` when unknown.",
      ),
    b_lu_harvestcat: z
      .string()
      .nullable()
      .describe(
        "Harvest category that determines which harvest parameters are relevant: 'HC010' standard, 'HC020' grass, 'HC031' maize, 'HC040' root crops, 'HC041' sugar beet, 'HC042' potatoes, 'HC050' cereals. `null` when unknown.",
      ),
    b_lu_harvestable: z
      .enum(["once", "multiple", "none"])
      .describe("How often the cultivation can be harvested: 'none', 'once' or 'multiple'."),
    b_lu_variety: z
      .string()
      .nullable()
      .describe("Variety (cultivar) of the cultivation. `null` when not specified."),
    b_lu_start: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    b_lu_end: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    m_cropresidue: z
      .boolean()
      .nullable()
      .describe(
        "Whether the crop residues are left on the field after harvest. `null` when unknown.",
      ),
    b_id: FieldIdSchema.describe("Unique identifier of the field the cultivation is on."),
  })
  .openapi("Cultivation")

const CreateCultivationBodySchema = z
  .object({
    b_lu_catalogue: z.string().describe("Cultivation catalogue identifier."),
    b_lu_start: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    b_lu_end: DateStringSchema.nullable().optional().describe("Date in YYYY-MM-DD format."),
    m_cropresidue: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether crop residues remain in the field after harvest."),
    b_lu_variety: z.string().nullable().optional().describe("Cultivation variety identifier."),
  })
  .refine(
    (data) => {
      if (data.b_lu_end == null) return true
      return data.b_lu_end >= data.b_lu_start
    },
    {
      message: "b_lu_end must not be before b_lu_start.",
      path: ["b_lu_end"],
    },
  )
  .openapi("CreateCultivation")

const UpdateCultivationBodySchema = z
  .object({
    b_lu_catalogue: z.string().optional().describe("Cultivation catalogue identifier."),
    b_lu_start: DateStringSchema.optional().describe("Date in YYYY-MM-DD format."),
    b_lu_end: DateStringSchema.nullable().optional().describe("Date in YYYY-MM-DD format."),
    m_cropresidue: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether crop residues remain in the field after harvest."),
    b_lu_variety: z.string().nullable().optional().describe("Cultivation variety identifier."),
  })
  .refine(
    (data) => {
      if (data.b_lu_start === undefined || data.b_lu_end == null) return true
      return data.b_lu_end >= data.b_lu_start
    },
    {
      message: "b_lu_end must not be before b_lu_start.",
      path: ["b_lu_end"],
    },
  )
  .openapi("UpdateCultivation")

const listCultivationsRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/cultivations",
  tags: ["Cultivations"],
  summary: "List cultivations on a field",
  description: "Returns all cultivations on the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: FieldIdSchema }),
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of cultivations.",
      content: {
        "application/json": {
          schema: paginatedSchema(CultivationSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const listFarmCultivationsRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/cultivations",
  tags: ["Cultivations"],
  summary: "List cultivations on a farm",
  description: "Returns all cultivations on all fields for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: "A paginated list of cultivations.",
      content: {
        "application/json": {
          schema: paginatedSchema(CultivationSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
})

const createCultivationRoute = createRoute({
  method: "post",
  path: "/fields/{b_id}/cultivations",
  tags: ["Cultivations"],
  summary: "Create a cultivation",
  description: "Creates a new cultivation on the specified field.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: FieldIdSchema }),
    body: {
      content: {
        "application/json": { schema: CreateCultivationBodySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Cultivation created.",
      content: { "application/json": { schema: CultivationSchema } },
    },
    ...writeErrorResponses,
  },
})

const getCultivationRoute = createRoute({
  method: "get",
  path: "/cultivations/{b_lu}",
  tags: ["Cultivations"],
  summary: "Get a cultivation",
  description: "Returns a single cultivation by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_lu: CultivationIdSchema }) },
  responses: {
    200: {
      description: "The requested cultivation.",
      content: { "application/json": { schema: CultivationSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateCultivationRoute = createRoute({
  method: "patch",
  path: "/cultivations/{b_lu}",
  tags: ["Cultivations"],
  summary: "Update a cultivation",
  description: "Partially updates an existing cultivation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_lu: CultivationIdSchema }),
    body: {
      content: {
        "application/json": { schema: UpdateCultivationBodySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Cultivation updated.",
      content: { "application/json": { schema: CultivationSchema } },
    },
    ...writeErrorResponses,
  },
})

const deleteCultivationRoute = createRoute({
  method: "delete",
  path: "/cultivations/{b_lu}",
  tags: ["Cultivations"],
  summary: "Delete a cultivation",
  description: "Permanently deletes a cultivation.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_lu: CultivationIdSchema }) },
  responses: {
    204: { description: "Cultivation deleted." },
    ...commonErrorResponses,
  },
})

function serialiseCultivation(cultivation: Cultivation) {
  return {
    b_lu: cultivation.b_lu,
    b_lu_catalogue: cultivation.b_lu_catalogue,
    b_lu_source: cultivation.b_lu_source,
    b_lu_name: cultivation.b_lu_name,
    b_lu_name_en: cultivation.b_lu_name_en ?? null,
    b_lu_hcat3: cultivation.b_lu_hcat3 ?? null,
    b_lu_hcat3_name: cultivation.b_lu_hcat3_name ?? null,
    b_lu_croprotation: cultivation.b_lu_croprotation ?? null,
    b_lu_eom: cultivation.b_lu_eom ?? null,
    b_lu_eom_residue: cultivation.b_lu_eom_residue ?? null,
    b_lu_harvestcat: cultivation.b_lu_harvestcat ?? null,
    b_lu_harvestable: cultivation.b_lu_harvestable,
    b_lu_variety: cultivation.b_lu_variety ?? null,
    b_lu_start: serializeDate(cultivation.b_lu_start),
    b_lu_end: serializeDate(cultivation.b_lu_end),
    m_cropresidue: cultivation.m_cropresidue ?? null,
    b_id: cultivation.b_id,
  }
}

/**
 * Registers the cultivation CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Cultivation service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerCultivationRoutes(app, fdm, services)
 * ```
 */
export function registerCultivationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: CultivationServices,
): void {
  // /fields/*/cultivations is covered by the /fields/* middleware in fields.ts
  // /farms/*/cultivations is covered by the /farms/* middleware in farms.ts
  app.use("/cultivations", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )
  app.use("/cultivations/*", (c, next) =>
    rateLimitMiddleware(fdm, WRITE_METHODS.has(c.req.method) ? "write" : "general")(c, next),
  )

  const listCultivationsHandler: RouteHandler<typeof listCultivationsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const cultivations = await services.getCultivations(fdm, principal.effectivePrincipalId, b_id)
    return c.json(paginatedResponse(cultivations.map(serialiseCultivation), limit, offset), 200)
  }

  const listFarmCultivationsHandler: RouteHandler<typeof listFarmCultivationsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const cultivationsByField = await services.getCultivationsForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
    )
    const cultivations = Array.from(cultivationsByField.values()).flat()
    cultivations.sort((a, b) => {
      const dateDiff = (a.b_lu_start?.getTime() ?? 0) - (b.b_lu_start?.getTime() ?? 0)
      return dateDiff !== 0 ? dateDiff : a.b_lu.localeCompare(b.b_lu)
    })
    return c.json(paginatedResponse(cultivations.map(serialiseCultivation), limit, offset), 200)
  }

  const createCultivationHandler: RouteHandler<typeof createCultivationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof CreateCultivationBodySchema>
    let b_lu: string
    try {
      b_lu = await services.addCultivation(
        fdm,
        principal.effectivePrincipalId,
        body.b_lu_catalogue,
        b_id,
        new Date(body.b_lu_start),
        body.b_lu_end ? new Date(body.b_lu_end) : undefined,
        body.m_cropresidue ?? undefined,
        body.b_lu_variety ?? undefined,
      )
    } catch (e) {
      if (
        e instanceof Error &&
        e.cause instanceof Error &&
        e.cause.message === "Cultivation code is not available for this time period"
      ) {
        throw new ApiError(
          400,
          "validation-failed",
          `Cultivation ${body.b_lu_catalogue} is not available for this time period.`,
          {
            errors: [
              {
                code: "custom",
                path: ["b_lu_end"],
                message: `Cultivation ${body.b_lu_catalogue} is not available for this time period.`,
              },
            ],
          },
        )
      }
      throw e
    }
    const cultivation = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
    if (!cultivation?.b_lu) {
      throw new ApiError(500, "internal-error", "Cultivation created but could not be retrieved.")
    }
    c.header("Location", `${new URL(c.req.url).origin}/cultivations/${b_lu}`)
    return c.json(serialiseCultivation(cultivation), 201)
  }

  const getCultivationHandler: RouteHandler<typeof getCultivationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_lu } = c.req.valid("param") as { b_lu: string }
    const cultivation = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
    if (!cultivation?.b_lu) {
      throw new ApiError(404, "not-found", `Cultivation '${b_lu}' not found.`)
    }
    return c.json(serialiseCultivation(cultivation), 200)
  }

  const updateCultivationHandler: RouteHandler<typeof updateCultivationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_lu } = c.req.valid("param") as { b_lu: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof UpdateCultivationBodySchema>
    if (Object.values(body).every((value) => value === undefined)) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }

    // Validate that b_lu_end is not before b_lu_start.
    // If both are in the body, compare inline; if only b_lu_end is provided,
    // fetch the persisted start date and compare against it.
    // Symmetrically, if only b_lu_start is provided (and b_lu_end is not being
    // changed), fetch the persisted end date and ensure the new start is not after it.
    if (body.b_lu_end != null) {
      const newEnd = new Date(body.b_lu_end)
      let startDate: Date | null | undefined
      if (body.b_lu_start) {
        startDate = new Date(body.b_lu_start)
      } else {
        const existing = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
        startDate = existing?.b_lu_start ?? null
      }
      if (startDate && newEnd < startDate) {
        throw new ApiError(400, "validation-failed", "b_lu_end must not be before b_lu_start.")
      }
    } else if (body.b_lu_start && body.b_lu_end === undefined) {
      // Only b_lu_start is changing; check the new start against the persisted end.
      const newStart = new Date(body.b_lu_start)
      const existing = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
      const persistedEnd = existing?.b_lu_end ?? null
      if (persistedEnd && newStart > new Date(persistedEnd)) {
        throw new ApiError(400, "validation-failed", "b_lu_start must not be after b_lu_end.")
      }
    }

    try {
      await services.updateCultivation(
        fdm,
        principal.effectivePrincipalId,
        b_lu,
        body.b_lu_catalogue,
        body.b_lu_start ? new Date(body.b_lu_start) : undefined,
        body.b_lu_end === undefined ? undefined : body.b_lu_end ? new Date(body.b_lu_end) : null,
        body.m_cropresidue,
        body.b_lu_variety,
      )
    } catch (e) {
      if (
        e instanceof Error &&
        e.cause instanceof Error &&
        e.cause.message === "Cultivation code is not available for this time period"
      ) {
        const firstPart =
          typeof body.b_lu_catalogue === "string"
            ? `Cultivation ${body.b_lu_catalogue}`
            : "Cultivation's current cultivation code"
        const secondPart =
          body.b_lu_start !== undefined || body.b_lu_end !== undefined
            ? "the updated time period"
            : "the cultivation's current time period"
        const errorMessage = `${firstPart} is not available for ${secondPart}.`
        throw new ApiError(400, "validation-failed", errorMessage, {
          errors: [
            {
              code: "custom",
              path: ["b_lu_end"],
              message: errorMessage,
            },
          ],
        })
      }
      throw e
    }
    const cultivation = await services.getCultivation(fdm, principal.effectivePrincipalId, b_lu)
    if (!cultivation?.b_lu) {
      throw new ApiError(404, "not-found", `Cultivation '${b_lu}' not found.`)
    }
    return c.json(serialiseCultivation(cultivation), 200)
  }

  const deleteCultivationHandler: RouteHandler<typeof deleteCultivationRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_lu } = c.req.valid("param") as { b_lu: string }
    await services.removeCultivation(fdm, principal.effectivePrincipalId, b_lu)
    return c.newResponse(null, 204)
  }

  app.openapi(listCultivationsRoute, listCultivationsHandler)
  app.openapi(listFarmCultivationsRoute, listFarmCultivationsHandler)
  app.openapi(createCultivationRoute, createCultivationHandler)
  app.openapi(getCultivationRoute, getCultivationHandler)
  app.openapi(updateCultivationRoute, updateCultivationHandler)
  app.openapi(deleteCultivationRoute, deleteCultivationHandler)
}
