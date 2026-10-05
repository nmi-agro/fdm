import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  getFarmIndicators,
  getFieldIndicators,
  getFieldMeasureOptions,
} from "@nmi-agro/fdm-calculator"
import type { FdmType, getFarm, getField } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import { IndicatorsUnavailableError } from "@nmi-agro/fdm-calculator"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import { commonErrorResponses, ProblemDetailsSchema } from "../schemas"

/** Defines the services required by the indicator and measure option routes. */
export interface IndicatorServices {
  getFarm: typeof getFarm
  getField: typeof getField
  getFieldIndicators: typeof getFieldIndicators
  getFarmIndicators: typeof getFarmIndicators
  getFieldMeasureOptions: typeof getFieldMeasureOptions
  /** Resolves the server-side NMI API key; returns `undefined` when not configured. */
  getNmiApiKey: () => string | undefined
}

const YearQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "year must be a four-digit calendar year.")
    .describe(
      "Calendar year (four digits, e.g. 2026). Soil analyses and adopted measures are limited to 1 January through 31 December of this year; the cultivation history needed for the indicators is not.",
    ),
})

const IndicatorScoreSchema = z
  .object({
    indicator_id: z.string().describe("indicator identifier, e.g. `C_N`."),
    status: z.number().describe("Current value of the indicator, in the unit of the indicator."),
    target: z.number().describe("Target value of the indicator, in the unit of the indicator."),
    index: z.number().describe("Normalized distance to the target (0..1)."),
    impact: z.number().describe("Normalized impact of the indicator (0..1)."),
    score: z.number().describe("Normalized indicator score (0..1); higher is better."),
  })
  .openapi("IndicatorScore")

const AggregationScoreSchema = z
  .object({
    aggregation_id: z.string().describe("aggregation identifier, e.g. `S_BLN`."),
    score: z.number().describe("Normalized aggregation score (0..1); higher is better."),
  })
  .openapi("AggregationScore")

const FarmMetricSchema = z.object({
  score: z.number().describe("Area-weighted score (0..1)."),
})

const FieldIndicatorsSchema = z
  .object({
    b_id: z.string(),
    year: z.number().int(),
    is_excluded: z
      .boolean()
      .describe(
        "`true` for buffer strips and nature fields, which have no indicator score. `indicators` and `aggregations` are then empty.",
      ),
    indicators: z.array(IndicatorScoreSchema),
    aggregations: z.array(AggregationScoreSchema),
  })
  .openapi("FieldIndicators")

const FarmIndicatorsSchema = z
  .object({
    b_id_farm: z.string(),
    year: z.number().int(),
    fields: z
      .array(
        z.object({
          b_id: z.string(),
          b_area: z.number().nullable().describe("Field area in hectares."),
          indicators: z.array(IndicatorScoreSchema),
          aggregations: z.array(AggregationScoreSchema),
        }),
      )
      .describe("Eligible fields only; buffer strips and nature fields are left out."),
    farm: z
      .object({
        indicators: z.array(FarmMetricSchema.extend({ indicator_id: z.string() })),
        aggregations: z.array(FarmMetricSchema.extend({ aggregation_id: z.string() })),
      })
      .describe(
        "Area-weighted farm scores. Each metric uses only the eligible fields with a score for it and a positive area; metrics without contributing fields are omitted.",
      ),
  })
  .openapi("FarmIndicators")

const ImpactSchema = z.object({
  indicator_id: z.string(),
  measure_impact: z.number().describe("Predicted positive impact on the indicator (0..1 scale)."),
})

const MeasureOptionSchema = z
  .object({
    m_id: z.string().describe("Catalogue identifier; use it to create a measure on the field."),
    m_source: z.string(),
    m_name: z.string(),
    m_description: z.string().nullable(),
    m_summary: z.string().nullable(),
    m_source_url: z.string().nullable(),
    m_conflicts: z.array(z.string()).nullable(),
    m_stage_applicability: z.enum(["field", "farm"]).nullable(),
    applicability: z.object({
      status: z.enum(["applicable", "not yet applicable", "inapplicable", "unknown"]),
      message: z.string().describe("Explanation from the applicability check; may be empty."),
    }),
    active_measures: z
      .array(z.string())
      .describe("Instance IDs of adopted measures with this catalogue ID in the selected year."),
    conflicts_with_active: z
      .array(z.string())
      .describe("Catalogue IDs of active measures that conflict with this option."),
    selectable: z
      .boolean()
      .describe(
        "Hint that the option is applicable, not active and not conflicting. Creating the measure is validated again and can still fail.",
      ),
    predicted_impacts: z
      .array(ImpactSchema)
      .describe(
        "Positive predicted impacts over all indicators, also for options that are not recommended. An unreported impact is not a zero impact.",
      ),
    recommendation: z
      .object({
        rank: z.number().int().min(1).max(5),
        aggregate_impact: z.number(),
        indicator_impacts: z
          .array(ImpactSchema)
          .describe("Impacts on the weak (non-green) indicators used for ranking."),
      })
      .nullable()
      .describe("`null` when the option is not recommended."),
  })
  .openapi("MeasureOption")

const FieldMeasureOptionsSchema = z
  .object({
    b_id: z.string(),
    year: z.number().int(),
    is_excluded: z.boolean().describe("`true` for excluded fields; `data` is then empty."),
    data: z.array(MeasureOptionSchema),
  })
  .openapi("FieldMeasureOptions")

const bln3ErrorResponses = {
  ...commonErrorResponses,
  400: {
    description: "Bad request — `year` is missing or not a four-digit calendar year.",
    content: { "application/problem+json": { schema: ProblemDetailsSchema } },
  },
  503: {
    description:
      "Service unavailable — scores, measure applicability or advice cannot be produced, or the server is not configured for indicator calculations.",
    content: { "application/problem+json": { schema: ProblemDetailsSchema } },
  },
}

const fieldIndicatorsRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/indicators",
  tags: ["Indicators"],
  summary: "Get indicator scores of a field",
  description:
    "Returns the indicator and aggregation scores of a field for a calendar year. Buffer strips and nature fields return `is_excluded: true` with empty arrays. Counts against the `nmi` rate limit.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id: z.string() }), query: YearQuerySchema },
  responses: {
    200: {
      description: "indicator scores of the field.",
      content: { "application/json": { schema: FieldIndicatorsSchema } },
    },
    ...bln3ErrorResponses,
  },
})

const farmIndicatorsRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/indicators",
  tags: ["Indicators"],
  summary: "Get indicator scores of a farm",
  description:
    "Returns indicator scores of all eligible fields of a farm and the area-weighted farm scores for a calendar year. Fields that cannot be scored fail the whole request with 503. A farm without eligible fields returns empty `fields` and empty farm aggregates. Counts against the `nmi` rate limit.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id_farm: z.string() }), query: YearQuerySchema },
  responses: {
    200: {
      description: "indicator scores of the farm.",
      content: { "application/json": { schema: FarmIndicatorsSchema } },
    },
    ...bln3ErrorResponses,
  },
})

const fieldMeasureOptionsRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/measures/catalogue",
  tags: ["Measures"],
  summary: "Get measure options and recommendations for a field",
  description:
    "Lists field-level catalogue measures with descriptions, applicability, active and conflicting status, predicted impacts and recommendations for a calendar year. These are catalogue candidates, not adopted measures; use `m_id` of a selectable option with `POST /fields/{b_id}/measures`. Predicted impacts are advice for this field and year, not stored properties. Counts against the `nmi` rate limit.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id: z.string() }), query: YearQuerySchema },
  responses: {
    200: {
      description: "Measure options of the field.",
      content: { "application/json": { schema: FieldMeasureOptionsSchema } },
    },
    ...bln3ErrorResponses,
  },
})

/**
 * Maps failures of Indicator calculations to a generic 503 problem response, keeping upstream
 * details and credentials out of the response. Other errors (permissions, missing
 * resources) pass through to the central error handler.
 */
async function guardIndicators<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof IndicatorsUnavailableError) {
      throw new ApiError(
        503,
        "service-unavailable",
        "Indicator results are temporarily unavailable. Try again later.",
      )
    }
    throw err
  }
}

/**
 * Registers the read-only indicator endpoints: field and farm indicator scores and the field
 * measure options.
 *
 * @param app - The OpenAPI application.
 * @param fdm - The FDM instance.
 * @param services - Injectable services.
 */
export function registerIndicatorRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: IndicatorServices,
): void {
  // Requests to the NMI API have their own bucket; the general middleware skips these paths.
  app.use("/fields/:b_id/indicators", (c, next) => rateLimitMiddleware(fdm, "nmi")(c, next))
  app.use("/farms/:b_id_farm/indicators", (c, next) => rateLimitMiddleware(fdm, "nmi")(c, next))
  app.use("/fields/:b_id/measures/catalogue", (c, next) => rateLimitMiddleware(fdm, "nmi")(c, next))

  const requireField = async (principalId: string, b_id: string) => {
    const field = await services.getField(fdm, principalId, b_id)
    if (!field) throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
  }

  const fieldIndicatorsHandler: RouteHandler<typeof fieldIndicatorsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { year } = c.req.valid("query") as { year: string }
    await requireField(principal.effectivePrincipalId, b_id)

    const result = await guardIndicators(() =>
      services.getFieldIndicators(
        fdm,
        principal.effectivePrincipalId,
        b_id,
        Number.parseInt(year, 10),
        services.getNmiApiKey(),
      ),
    )
    return c.json(
      {
        b_id: result.b_id,
        year: result.year,
        is_excluded: result.is_excluded,
        indicators: result.score?.indicators ?? [],
        aggregations: result.score?.aggregations ?? [],
      },
      200,
    )
  }

  const farmIndicatorsHandler: RouteHandler<typeof farmIndicatorsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { year } = c.req.valid("query") as { year: string }
    const farm = await services.getFarm(fdm, principal.effectivePrincipalId, b_id_farm)
    if (!farm) throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)

    const result = await guardIndicators(() =>
      services.getFarmIndicators(
        fdm,
        principal.effectivePrincipalId,
        b_id_farm,
        Number.parseInt(year, 10),
        services.getNmiApiKey(),
      ),
    )
    return c.json(
      {
        b_id_farm: result.b_id_farm,
        year: result.year,
        fields: result.fields.map((f) => ({
          b_id: f.b_id,
          b_area: f.b_area,
          indicators: f.score.indicators,
          aggregations: f.score.aggregations ?? [],
        })),
        farm: result.farm,
      },
      200,
    )
  }

  const fieldMeasureOptionsHandler: RouteHandler<typeof fieldMeasureOptionsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { year } = c.req.valid("query") as { year: string }
    await requireField(principal.effectivePrincipalId, b_id)

    const result = await guardIndicators(() =>
      services.getFieldMeasureOptions(
        fdm,
        principal.effectivePrincipalId,
        b_id,
        Number.parseInt(year, 10),
        services.getNmiApiKey(),
      ),
    )
    return c.json(result as z.infer<typeof FieldMeasureOptionsSchema>, 200)
  }

  app.openapi(fieldIndicatorsRoute, fieldIndicatorsHandler)
  app.openapi(farmIndicatorsRoute, farmIndicatorsHandler)
  app.openapi(fieldMeasureOptionsRoute, fieldMeasureOptionsHandler)
}
