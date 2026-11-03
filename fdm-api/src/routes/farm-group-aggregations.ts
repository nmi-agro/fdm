import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  getFarmIndicators,
  getFarmMeasureSummary,
  getNitrogenBalanceForFarms,
  getOrganicMatterBalanceForFarms,
} from "@nmi-agro/fdm-calculator"
import type { FdmType, getFarmGroup } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import { computeMinimumScores, getYearTimeframe } from "@nmi-agro/fdm-calculator"
import { getFarmIdsOfFarmGroupInYear } from "@nmi-agro/fdm-core"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError, getErrorMessages } from "../error"
import { FarmGroupIdSchema, FarmIdSchema, FieldIdSchema } from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import { commonErrorResponses, DateStringSchema, serializeDate } from "../schemas"
import { NitrogenBalanceSchema, OrganicMatterBalanceSchema } from "./calculations"
import {
  AggregationScoreSchema,
  FarmIndicatorsSchema,
  guardIndicators,
  IndicatorScoreSchema,
} from "./indicators"

/** Defines the functions required by the farm group aggregation routes. */
export interface FarmGroupAggregationServices {
  getFarmGroup: typeof getFarmGroup
  getNitrogenBalanceForFarms: typeof getNitrogenBalanceForFarms
  getOrganicMatterBalanceForFarms: typeof getOrganicMatterBalanceForFarms
  getFarmIndicators: typeof getFarmIndicators
  getFarmMeasureSummary: typeof getFarmMeasureSummary
  getNmiApiKey: () => string | undefined
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GroupQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "year must be a four-digit calendar year.")
    .describe(
      "Calendar year (four digits). The farms that are part of the group at some point in this year are included, and the results cover this year.",
    ),
  b_id_farm: z
    .union([FarmIdSchema, z.array(FarmIdSchema)])
    .optional()
    .describe(
      "Limit the results to these farms of the group. Repeat the parameter for several farms. Every farm must be part of the group in the year.",
    ),
})

const FarmErrorSchema = z
  .string()
  .nullable()
  .describe("Why the result of this farm could not be calculated; otherwise `null`.")

const groupBalanceSchema = <T extends z.ZodTypeAny>(balance: T, name: string, what: string) =>
  z
    .object({
      b_id_group: FarmGroupIdSchema.describe("Unique identifier of the farm group."),
      year: z.number().int().describe("Calendar year of the balance."),
      // The component describes itself; a description here would turn the $ref into allOf.
      total: balance,
      farms: z
        .array(
          z.object({
            b_id_farm: FarmIdSchema.describe("Unique identifier of the farm."),
            // Absent when the balance of the farm could not be calculated (see `error`).
            balance: balance.optional(),
            error: FarmErrorSchema,
          }),
        )
        .describe(`${what} per farm.`),
    })
    .openapi(name)

const GroupNitrogenBalanceSchema = groupBalanceSchema(
  NitrogenBalanceSchema,
  "FarmGroupNitrogenBalance",
  "Nitrogen balance",
)
const GroupOrganicMatterBalanceSchema = groupBalanceSchema(
  OrganicMatterBalanceSchema,
  "FarmGroupOrganicMatterBalance",
  "Organic matter balance",
)

const MinimumScoresSchema = z
  .object({
    indicators: z
      .array(IndicatorScoreSchema)
      .describe(
        "Lowest score per indicator across the fields of the farm, with the `index` of that field. `status`, `target` and `impact` are 0.",
      ),
    aggregations: z
      .array(AggregationScoreSchema)
      .describe("Lowest score per soil function across the fields of the farm."),
  })
  .describe(
    "The weakest field per indicator, as shown in the organization overview of the web app.",
  )

const GroupIndicatorsSchema = z
  .object({
    b_id_group: FarmGroupIdSchema.describe("Unique identifier of the farm group."),
    year: z.number().int().describe("Calendar year the results apply to."),
    farms: z
      .array(
        z.object({
          b_id_farm: FarmIdSchema.describe("Unique identifier of the farm."),
          farm: FarmIndicatorsSchema.shape.farm
            .nullable()
            .describe(
              "Area-weighted scores of the farm, the same as `GET /farms/{b_id_farm}/indicators`. `null` when they could not be calculated.",
            ),
          minimum: MinimumScoresSchema.nullable(),
          error: FarmErrorSchema,
        }),
      )
      .describe("Indicator scores per farm."),
  })
  .openapi("FarmGroupIndicators")

const GroupMeasuresSchema = z
  .object({
    b_id_group: FarmGroupIdSchema.describe("Unique identifier of the farm group."),
    year: z.number().int().describe("Calendar year the results apply to."),
    farms: z
      .array(
        z.object({
          b_id_farm: FarmIdSchema.describe("Unique identifier of the farm."),
          eligible_fields: z
            .array(FieldIdSchema)
            .describe(
              "Fields that count for the indicators: not buffer strips and not nature or other excluded land use.",
            ),
          measures: z
            .array(
              z.object({
                m_id: z.string().describe("Identifier of the measure in the measure catalogue."),
                m_name: z.string().describe("Name of the measure."),
                m_start: DateStringSchema.nullable().describe(
                  "Earliest start of the measure on the fields, in YYYY-MM-DD format. `null` when a field has no start date.",
                ),
                m_end: DateStringSchema.nullable().describe(
                  "Latest end of the measure on the fields, in YYYY-MM-DD format. `null` when a field has no end date.",
                ),
                field_count: z
                  .number()
                  .int()
                  .describe("Number of eligible fields with this measure."),
              }),
            )
            .describe("Measures taken on the eligible fields, one entry per measure."),
          main_cultivations: z
            .array(
              z.object({
                b_lu_catalogue: z.string().describe("Cultivation catalogue code."),
                b_lu_name: z.string().describe("Name of the cultivation."),
                b_lu_croprotation: z
                  .string()
                  .nullable()
                  .describe("Crop rotation category, for example `grass`."),
                b_area: z
                  .number()
                  .describe("Total area of the eligible fields with this main cultivation (ha)."),
              }),
            )
            .describe("Main cultivations of the eligible fields, largest area first."),
          error: FarmErrorSchema,
        }),
      )
      .describe("Measures per farm."),
  })
  .openapi("FarmGroupMeasures")

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const groupRoute = <T extends z.ZodTypeAny>(
  path: string,
  summary: string,
  description: string,
  schema: T,
) =>
  createRoute({
    method: "get",
    path,
    tags: ["Farm Groups"],
    summary,
    description,
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    "x-badges": [{ name: "New", color: "#16a34a" }],
    request: {
      params: z.object({ b_id_group: FarmGroupIdSchema }),
      query: GroupQuerySchema,
    },
    responses: {
      200: {
        description: "Results for the farms of the group.",
        content: { "application/json": { schema } },
      },
      ...commonErrorResponses,
    },
  })

const nitrogenBalanceRoute = groupRoute(
  "/farm-groups/{b_id_group}/calculations/nitrogen-balance",
  "Nitrogen balance of a farm group",
  "Calculates the nitrogen balance of the farms in the group for a year: for all farms together and per farm. A farm or field that cannot be calculated is reported in the result and does not stop the others. Counts towards the calculation rate limit.",
  GroupNitrogenBalanceSchema,
)

const organicMatterBalanceRoute = groupRoute(
  "/farm-groups/{b_id_group}/calculations/organic-matter-balance",
  "Organic matter balance of a farm group",
  "Calculates the organic matter balance of the farms in the group for a year: for all farms together and per farm. A farm or field that cannot be calculated is reported in the result and does not stop the others. Counts towards the calculation rate limit.",
  GroupOrganicMatterBalanceSchema,
)

const indicatorsRoute = groupRoute(
  "/farm-groups/{b_id_group}/indicators",
  "Indicator scores of a farm group",
  "Returns the soil quality indicator scores of each farm in the group: the area-weighted scores and the lowest score per indicator across the fields. Counts towards the NMI rate limit.",
  GroupIndicatorsSchema,
)

const measuresRoute = groupRoute(
  "/farm-groups/{b_id_group}/measures",
  "Measures of a farm group",
  "Returns, per farm in the group, the measures taken on the fields that count for the indicators, and the main cultivations of those fields.",
  GroupMeasuresSchema,
)

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const FARM_FAILED = "The result of this farm could not be calculated."

/** A fixed message per known failure; the underlying error is not shown to clients. */
function farmError(message: string | undefined): string | null {
  if (message === undefined) return null
  if (message === "No fields in input") return "The farm has no fields in this year."
  return FARM_FAILED
}

/**
 * Registers the aggregation routes of farm groups: balances, indicators and measures of the
 * farms in a group.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerFarmGroupAggregationRoutes(app, fdm, services)
 * ```
 */
export function registerFarmGroupAggregationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: FarmGroupAggregationServices,
): void {
  // /farm-groups/* counts in the general bucket (farm-groups.ts); these count separately too.
  app.use("/farm-groups/:b_id_group/calculations/*", (c, next) =>
    rateLimitMiddleware(fdm, "calc")(c, next),
  )
  app.use("/farm-groups/:b_id_group/indicators", (c, next) =>
    rateLimitMiddleware(fdm, "nmi")(c, next),
  )

  /** Resolves the farms of the group in the year, narrowed to the requested farms. */
  async function resolveFarms(
    principal_id: string,
    b_id_group: string,
    query: z.infer<typeof GroupQuerySchema>,
  ) {
    const group = await services.getFarmGroup(fdm, principal_id, b_id_group)
    if (!group) {
      throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    }
    const year = Number.parseInt(query.year, 10)
    const members = getFarmIdsOfFarmGroupInYear(group, year)
    const requested =
      query.b_id_farm === undefined
        ? undefined
        : Array.isArray(query.b_id_farm)
          ? query.b_id_farm
          : [query.b_id_farm]
    if (requested) {
      const outside = requested.filter((b_id_farm) => !members.includes(b_id_farm))
      if (outside.length > 0) {
        throw new ApiError(
          422,
          "unprocessable-entity",
          `These farms are not part of the group in ${year}: ${outside.join(", ")}.`,
        )
      }
    }
    return { year, farmIds: requested ? [...new Set(requested)] : members }
  }

  const nitrogenBalanceHandler: RouteHandler<typeof nitrogenBalanceRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group } = c.req.valid("param") as { b_id_group: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof GroupQuerySchema>
    const { year, farmIds } = await resolveFarms(principal.effectivePrincipalId, b_id_group, query)
    const result = await services.getNitrogenBalanceForFarms(
      fdm,
      principal.effectivePrincipalId,
      farmIds,
      getYearTimeframe(year),
    )
    return c.json(
      {
        b_id_group,
        year,
        total: result.total,
        farms: result.farms.map((farm) => ({
          b_id_farm: farm.b_id_farm,
          balance: farm.balance,
          error: farmError(farm.errorMessage),
        })),
      } as z.infer<typeof GroupNitrogenBalanceSchema>,
      200,
    )
  }

  const organicMatterBalanceHandler: RouteHandler<typeof organicMatterBalanceRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group } = c.req.valid("param") as { b_id_group: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof GroupQuerySchema>
    const { year, farmIds } = await resolveFarms(principal.effectivePrincipalId, b_id_group, query)
    const result = await services.getOrganicMatterBalanceForFarms(
      fdm,
      principal.effectivePrincipalId,
      farmIds,
      getYearTimeframe(year),
    )
    return c.json(
      {
        b_id_group,
        year,
        total: result.total,
        farms: result.farms.map((farm) => ({
          b_id_farm: farm.b_id_farm,
          balance: farm.balance,
          error: farmError(farm.errorMessage),
        })),
      } as z.infer<typeof GroupOrganicMatterBalanceSchema>,
      200,
    )
  }

  const indicatorsHandler: RouteHandler<typeof indicatorsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group } = c.req.valid("param") as { b_id_group: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof GroupQuerySchema>
    const { year, farmIds } = await resolveFarms(principal.effectivePrincipalId, b_id_group, query)
    const nmiApiKey = services.getNmiApiKey()

    const farms = []
    // One farm after the other, to limit the load on the indicator service.
    for (const b_id_farm of farmIds) {
      try {
        const result = await guardIndicators(() =>
          services.getFarmIndicators(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
            year,
            nmiApiKey,
          ),
        )
        farms.push({
          b_id_farm,
          farm: result.farm,
          minimum: computeMinimumScores(result.fields.map((field) => field.score)),
          error: null,
        })
      } catch (err) {
        // A missing NMI configuration or permission problem applies to every farm: fail the request.
        if (err instanceof ApiError || getErrorMessages(err).includes("Permission denied"))
          throw err
        farms.push({ b_id_farm, farm: null, minimum: null, error: FARM_FAILED })
      }
    }
    return c.json({ b_id_group, year, farms } as z.infer<typeof GroupIndicatorsSchema>, 200)
  }

  const measuresHandler: RouteHandler<typeof measuresRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_group } = c.req.valid("param") as { b_id_group: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const query = c.req.valid("query") as z.infer<typeof GroupQuerySchema>
    const { year, farmIds } = await resolveFarms(principal.effectivePrincipalId, b_id_group, query)
    const timeframe = getYearTimeframe(year)

    const farms = await Promise.all(
      farmIds.map(async (b_id_farm) => {
        try {
          const summary = await services.getFarmMeasureSummary(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
            timeframe,
            year,
          )
          return {
            b_id_farm,
            eligible_fields: summary.eligibleFields.map((field) => field.b_id),
            measures: summary.measures.map((measure) => ({
              m_id: measure.m_id,
              m_name: measure.m_name,
              m_start: serializeDate(measure.m_start ?? null),
              m_end: serializeDate(measure.m_end ?? null),
              field_count: measure.fieldCount,
            })),
            main_cultivations: summary.mainCultivations,
            error: null,
          }
        } catch (err) {
          if (getErrorMessages(err).includes("Permission denied")) throw err
          return {
            b_id_farm,
            eligible_fields: [],
            measures: [],
            main_cultivations: [],
            error: FARM_FAILED,
          }
        }
      }),
    )
    return c.json({ b_id_group, year, farms } as z.infer<typeof GroupMeasuresSchema>, 200)
  }

  app.openapi(nitrogenBalanceRoute, nitrogenBalanceHandler)
  app.openapi(organicMatterBalanceRoute, organicMatterBalanceHandler)
  app.openapi(indicatorsRoute, indicatorsHandler)
  app.openapi(measuresRoute, measuresHandler)
}
