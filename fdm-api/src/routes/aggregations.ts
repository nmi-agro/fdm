import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  FarmIndicators,
  FarmMeasureSummary,
  getFarmIndicators,
  getFarmMeasureSummary,
  getNitrogenBalanceForFarms,
  getOrganicMatterBalanceForFarms,
} from "@nmi-agro/fdm-calculator"
import type { FdmType, getFarmGroup, getFarmIdsOfOrganization } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import {
  aggregateFarmScores,
  combineFarmMeasureSummaries,
  computeMinimumScores,
  getYearTimeframe,
} from "@nmi-agro/fdm-calculator"
import { getFarmIdsOfFarmGroupInYear } from "@nmi-agro/fdm-core"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError, getErrorMessages } from "../error"
import { FarmGroupIdSchema, FarmIdSchema, FieldIdSchema, OrganizationIdSchema } from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  commonErrorResponses,
  DateStringSchema,
  problemResponseDefinition,
  serializeDate,
} from "../schemas"
import { NitrogenBalanceSchema, OrganicMatterBalanceSchema } from "./calculations"
import {
  AggregationScoreSchema,
  FarmIndicatorsSchema,
  guardIndicators,
  IndicatorScoreSchema,
} from "./indicators"

/** Defines the functions required by the aggregation routes. */
export interface AggregationServices {
  getFarmGroup: typeof getFarmGroup
  getFarmIdsOfOrganization: typeof getFarmIdsOfOrganization
  getNitrogenBalanceForFarms: typeof getNitrogenBalanceForFarms
  getOrganicMatterBalanceForFarms: typeof getOrganicMatterBalanceForFarms
  getFarmIndicators: typeof getFarmIndicators
  getFarmMeasureSummary: typeof getFarmMeasureSummary
  getNmiApiKey: () => string | undefined
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const groupQuerySchema = (scope: "group" | "organization") =>
  z.object({
    year: z
      .string()
      .regex(/^\d{4}$/, "year must be a four-digit calendar year.")
      .describe(
        scope === "group"
          ? "Calendar year (four digits). The farms that are part of the group at some point in this year are included, and the results cover this year."
          : "Calendar year (four digits). The results cover this year.",
      ),
    b_id_farm: z
      .union([FarmIdSchema, z.array(FarmIdSchema)])
      .optional()
      .describe(
        scope === "group"
          ? "Limit the results to these farms of the group. Repeat the parameter for several farms. Every farm must be part of the group in the year."
          : "Limit the results to these farms of the organization. Repeat the parameter for several farms.",
      ),
  })

const FarmErrorSchema = z
  .string()
  .nullable()
  .describe("Why the result of this farm could not be calculated; otherwise `null`.")

const balanceSchema = <T extends z.ZodTypeAny>(balance: T, name: string, what: string) =>
  z
    .object({
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
        .describe(`${what} per farm. The total covers all fields of the selected farms together.`),
    })
    .openapi(name)

const MultiFarmNitrogenBalanceSchema = balanceSchema(
  NitrogenBalanceSchema,
  "MultiFarmNitrogenBalance",
  "Nitrogen balance",
)
const MultiFarmOrganicMatterBalanceSchema = balanceSchema(
  OrganicMatterBalanceSchema,
  "MultiFarmOrganicMatterBalance",
  "Organic matter balance",
)

const MinimumScoresSchema = z
  .object({
    indicators: z
      .array(IndicatorScoreSchema)
      .describe(
        "Lowest score per indicator across the fields, with the `index` of that field. `status`, `target` and `impact` are 0.",
      ),
    aggregations: z
      .array(AggregationScoreSchema)
      .describe("Lowest score per soil function across the fields."),
  })
  .describe(
    "The weakest field per indicator, as shown in the organization overview of the web app.",
  )

const AreaWeightedScoresSchema = FarmIndicatorsSchema.shape.farm

const MultiFarmIndicatorsSchema = z
  .object({
    year: z.number().int().describe("Calendar year the results apply to."),
    total: z
      .object({
        area_weighted: AreaWeightedScoresSchema.describe(
          "Area-weighted scores over the eligible fields of all selected farms together.",
        ),
        minimum: MinimumScoresSchema,
      })
      .describe(
        "Scores of all selected farms together. Farms that could not be calculated are left out.",
      ),
    farms: z
      .array(
        z.object({
          b_id_farm: FarmIdSchema.describe("Unique identifier of the farm."),
          area_weighted: AreaWeightedScoresSchema.nullable().describe(
            "Area-weighted scores of the farm, the same as `farm` in `GET /farms/{b_id_farm}/indicators`. `null` when they could not be calculated.",
          ),
          minimum: MinimumScoresSchema.nullable(),
          error: FarmErrorSchema,
        }),
      )
      .describe("Indicator scores per farm."),
  })
  .openapi("MultiFarmIndicators")

const MeasureSchema = z.object({
  m_id: z.string().describe("Identifier of the measure in the measure catalogue."),
  m_name: z.string().describe("Name of the measure."),
  m_start: DateStringSchema.nullable().describe(
    "Earliest start of the measure on the fields, in YYYY-MM-DD format. `null` when a field has no start date.",
  ),
  m_end: DateStringSchema.nullable().describe(
    "Latest end of the measure on the fields, in YYYY-MM-DD format. `null` when a field has no end date.",
  ),
  field_count: z.number().int().describe("Number of eligible fields with this measure."),
})

const MainCultivationSchema = z.object({
  b_lu_catalogue: z.string().describe("Cultivation catalogue code."),
  b_lu_name: z.string().describe("Name of the cultivation."),
  b_lu_croprotation: z.string().nullable().describe("Crop rotation category, for example `grass`."),
  b_area: z.number().describe("Total area of the eligible fields with this main cultivation (ha)."),
})

const MultiFarmMeasuresSchema = z
  .object({
    year: z.number().int().describe("Calendar year the results apply to."),
    total: z
      .object({
        eligible_field_count: z
          .number()
          .int()
          .describe("Number of eligible fields on all selected farms together."),
        measures: z
          .array(
            MeasureSchema.extend({
              b_id_farms: z.array(FarmIdSchema).describe("Farms that have the measure."),
            }),
          )
          .describe(
            "Measures on all selected farms together, one entry per measure, sorted by name.",
          ),
        main_cultivations: z
          .array(MainCultivationSchema)
          .describe("Main cultivations of all selected farms together, largest area first."),
      })
      .describe(
        "Measures of all selected farms together. Farms that could not be read are left out.",
      ),
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
            .array(MeasureSchema)
            .describe("Measures taken on the eligible fields, one entry per measure."),
          main_cultivations: z
            .array(MainCultivationSchema)
            .describe("Main cultivations of the eligible fields, largest area first."),
          error: FarmErrorSchema,
        }),
      )
      .describe("Measures per farm."),
  })
  .openapi("MultiFarmMeasures")

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

type Scope = "group" | "organization"

const SCOPES = {
  group: {
    base: "/farm-groups/{b_id_group}",
    params: z.object({ b_id_group: FarmGroupIdSchema }),
    tag: "Farm Groups",
    of: "the farms of the group",
  },
  organization: {
    base: "/organizations/{organization_id}",
    params: z.object({ organization_id: OrganizationIdSchema }),
    tag: "Organizations",
    of: "the farms of the organization",
  },
} as const

function aggregationRoute<T extends z.ZodTypeAny>(
  scope: Scope,
  path: string,
  summary: string,
  description: string,
  schema: T,
) {
  const config = SCOPES[scope]
  return createRoute({
    method: "get",
    path: `${config.base}${path}`,
    tags: [config.tag],
    summary,
    description: `${description} Covers ${config.of}${scope === "organization" ? "; the owner of the API key must be a member of the organization" : ""}.`,
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    "x-badges": [{ name: "New", color: "#16a34a" }],
    request: { params: config.params, query: groupQuerySchema(scope) },
    responses: {
      200: {
        description: "Results for all selected farms together and per farm.",
        content: { "application/json": { schema } },
      },
      ...commonErrorResponses,
      400: problemResponseDefinition("Bad request — the query parameters are not valid."),
      422: problemResponseDefinition(
        "Unprocessable entity — a requested farm is not part of the selection.",
      ),
      503: problemResponseDefinition(
        "Service unavailable — indicator calculations are not available on this server.",
      ),
    },
  })
}

const routes = (scope: Scope) => ({
  nitrogenBalance: aggregationRoute(
    scope,
    "/calculations/nitrogen-balance",
    "Nitrogen balance of several farms",
    "Calculates the nitrogen balance for a year: for all selected farms together and per farm. A farm or field that cannot be calculated is reported and does not stop the others. Counts towards the calculation rate limit.",
    MultiFarmNitrogenBalanceSchema,
  ),
  organicMatterBalance: aggregationRoute(
    scope,
    "/calculations/organic-matter-balance",
    "Organic matter balance of several farms",
    "Calculates the organic matter balance for a year: for all selected farms together and per farm. A farm or field that cannot be calculated is reported and does not stop the others. Counts towards the calculation rate limit.",
    MultiFarmOrganicMatterBalanceSchema,
  ),
  indicators: aggregationRoute(
    scope,
    "/indicators",
    "Indicator scores of several farms",
    "Returns the soil quality indicator scores for a year: the area-weighted scores and the lowest score per indicator, for all selected farms together and per farm. Counts towards the NMI rate limit.",
    MultiFarmIndicatorsSchema,
  ),
  measures: aggregationRoute(
    scope,
    "/measures",
    "Measures of several farms",
    "Returns the measures taken on the fields that count for the indicators, and the main cultivations of those fields, for all selected farms together and per farm.",
    MultiFarmMeasuresSchema,
  ),
})

const groupRoutes = routes("group")
const organizationRoutes = routes("organization")

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

function requestedFarms(query: z.infer<ReturnType<typeof groupQuerySchema>>): string[] | undefined {
  if (query.b_id_farm === undefined) return undefined
  return [...new Set(Array.isArray(query.b_id_farm) ? query.b_id_farm : [query.b_id_farm])]
}

function narrow(available: string[], requested: string[] | undefined, what: string): string[] {
  if (!requested) return available
  const outside = requested.filter((b_id_farm) => !available.includes(b_id_farm))
  if (outside.length > 0) {
    throw new ApiError(
      422,
      "unprocessable-entity",
      `These farms are not part of ${what}: ${outside.join(", ")}.`,
    )
  }
  return requested
}

/**
 * Registers the aggregation routes of farm groups and organizations: balances, indicators and
 * measures of several farms, in total and per farm.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerAggregationRoutes(app, fdm, services)
 * ```
 */
export function registerAggregationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: AggregationServices,
): void {
  for (const base of ["/farm-groups/:id", "/organizations/:id"]) {
    app.use(`${base}/calculations/*`, (c, next) => rateLimitMiddleware(fdm, "calc")(c, next))
    app.use(`${base}/indicators`, (c, next) => rateLimitMiddleware(fdm, "nmi")(c, next))
  }

  /**
   * Resolves the farms to aggregate and the principal to calculate them as. For a group this is
   * the user; for an organization it is the organization itself, after checking that the user is
   * a member, as the organization overview of the web app does.
   */
  async function resolve(
    scope: Scope,
    principal: ApiPrincipalContext,
    params: { b_id_group?: string; organization_id?: string },
    query: z.infer<ReturnType<typeof groupQuerySchema>>,
  ) {
    const year = Number.parseInt(query.year, 10)
    if (scope === "group") {
      const b_id_group = params.b_id_group as string
      const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
      if (!group) throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
      const farmIds = narrow(
        getFarmIdsOfFarmGroupInYear(group, year),
        requestedFarms(query),
        `the group in ${year}`,
      )
      return { year, farmIds, principal_id: principal.effectivePrincipalId }
    }
    const organization_id = params.organization_id as string
    const available = await services.getFarmIdsOfOrganization(
      fdm,
      principal.effectivePrincipalId,
      organization_id,
    )
    const farmIds = narrow(available, requestedFarms(query), "the organization")
    return { year, farmIds, principal_id: organization_id }
  }

  function register(scope: Scope, r: ReturnType<typeof routes>) {
    const nitrogenBalanceHandler: RouteHandler<typeof r.nitrogenBalance> = async (c) => {
      const principal = c.get("principal") as unknown as ApiPrincipalContext
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const params = c.req.valid("param") as { b_id_group?: string; organization_id?: string }
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const query = c.req.valid("query") as z.infer<ReturnType<typeof groupQuerySchema>>
      const { year, farmIds, principal_id } = await resolve(scope, principal, params, query)
      const result = await services.getNitrogenBalanceForFarms(
        fdm,
        principal_id,
        farmIds,
        getYearTimeframe(year),
      )
      return c.json(
        {
          year,
          total: result.total,
          farms: result.farms.map((farm) => ({
            b_id_farm: farm.b_id_farm,
            balance: farm.balance,
            error: farmError(farm.errorMessage),
          })),
        } as z.infer<typeof MultiFarmNitrogenBalanceSchema>,
        200,
      )
    }

    const organicMatterBalanceHandler: RouteHandler<typeof r.organicMatterBalance> = async (c) => {
      const principal = c.get("principal") as unknown as ApiPrincipalContext
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const params = c.req.valid("param") as { b_id_group?: string; organization_id?: string }
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const query = c.req.valid("query") as z.infer<ReturnType<typeof groupQuerySchema>>
      const { year, farmIds, principal_id } = await resolve(scope, principal, params, query)
      const result = await services.getOrganicMatterBalanceForFarms(
        fdm,
        principal_id,
        farmIds,
        getYearTimeframe(year),
      )
      return c.json(
        {
          year,
          total: result.total,
          farms: result.farms.map((farm) => ({
            b_id_farm: farm.b_id_farm,
            balance: farm.balance,
            error: farmError(farm.errorMessage),
          })),
        } as z.infer<typeof MultiFarmOrganicMatterBalanceSchema>,
        200,
      )
    }

    const indicatorsHandler: RouteHandler<typeof r.indicators> = async (c) => {
      const principal = c.get("principal") as unknown as ApiPrincipalContext
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const params = c.req.valid("param") as { b_id_group?: string; organization_id?: string }
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const query = c.req.valid("query") as z.infer<ReturnType<typeof groupQuerySchema>>
      const { year, farmIds, principal_id } = await resolve(scope, principal, params, query)
      const nmiApiKey = services.getNmiApiKey()

      const farms = []
      const allFields: FarmIndicators["fields"] = []
      // One farm after the other, to limit the load on the indicator service.
      for (const b_id_farm of farmIds) {
        try {
          const result = await guardIndicators(() =>
            services.getFarmIndicators(fdm, principal_id, b_id_farm, year, nmiApiKey),
          )
          allFields.push(...result.fields)
          farms.push({
            b_id_farm,
            area_weighted: result.farm,
            minimum: computeMinimumScores(result.fields.map((field) => field.score)),
            error: null,
          })
        } catch (err) {
          // A missing NMI configuration or a permission problem applies to every farm.
          if (err instanceof ApiError || getErrorMessages(err).includes("Permission denied")) {
            throw err
          }
          farms.push({ b_id_farm, area_weighted: null, minimum: null, error: FARM_FAILED })
        }
      }
      return c.json(
        {
          year,
          total: {
            area_weighted: aggregateFarmScores(allFields),
            minimum: computeMinimumScores(allFields.map((field) => field.score)),
          },
          farms,
        } as z.infer<typeof MultiFarmIndicatorsSchema>,
        200,
      )
    }

    const measuresHandler: RouteHandler<typeof r.measures> = async (c) => {
      const principal = c.get("principal") as unknown as ApiPrincipalContext
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const params = c.req.valid("param") as { b_id_group?: string; organization_id?: string }
      // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
      const query = c.req.valid("query") as z.infer<ReturnType<typeof groupQuerySchema>>
      const { year, farmIds, principal_id } = await resolve(scope, principal, params, query)
      const timeframe = getYearTimeframe(year)

      const results = await Promise.all(
        farmIds.map(async (b_id_farm) => {
          try {
            const summary = await services.getFarmMeasureSummary(
              fdm,
              principal_id,
              b_id_farm,
              timeframe,
              year,
            )
            return { b_id_farm, summary }
          } catch (err) {
            if (getErrorMessages(err).includes("Permission denied")) throw err
            return { b_id_farm, summary: undefined }
          }
        }),
      )
      const serialiseMeasure = (measure: {
        m_id: string
        m_name: string
        m_start?: Date | null
        m_end?: Date | null
        fieldCount: number
      }) => ({
        m_id: measure.m_id,
        m_name: measure.m_name,
        m_start: serializeDate(measure.m_start ?? null),
        m_end: serializeDate(measure.m_end ?? null),
        field_count: measure.fieldCount,
      })
      const combined = combineFarmMeasureSummaries(
        results
          .map((result) => result.summary)
          .filter((summary): summary is FarmMeasureSummary => summary !== undefined),
      )
      return c.json(
        {
          year,
          total: {
            eligible_field_count: combined.eligibleFieldCount,
            measures: combined.measures.map((measure) => ({
              ...serialiseMeasure(measure),
              b_id_farms: measure.b_id_farms,
            })),
            main_cultivations: combined.mainCultivations,
          },
          farms: results.map(({ b_id_farm, summary }) =>
            summary
              ? {
                  b_id_farm,
                  eligible_fields: summary.eligibleFields.map((field) => field.b_id),
                  measures: summary.measures.map(serialiseMeasure),
                  main_cultivations: summary.mainCultivations,
                  error: null,
                }
              : {
                  b_id_farm,
                  eligible_fields: [],
                  measures: [],
                  main_cultivations: [],
                  error: FARM_FAILED,
                },
          ),
        } as z.infer<typeof MultiFarmMeasuresSchema>,
        200,
      )
    }

    app.openapi(r.nitrogenBalance, nitrogenBalanceHandler)
    app.openapi(r.organicMatterBalance, organicMatterBalanceHandler)
    app.openapi(r.indicators, indicatorsHandler)
    app.openapi(r.measures, measuresHandler)
  }

  register("group", groupRoutes)
  register("organization", organizationRoutes)
}
