import type * as calculator from "@nmi-agro/fdm-calculator"
import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { IndicatorsUnavailableError } from "@nmi-agro/fdm-calculator"
import * as Sentry from "@sentry/node"
import { nanoid } from "nanoid"
import { ApiError } from "../error"
import { FarmIdSchema, FieldIdSchema } from "../fields"
import { assertFarmSizeSupported, type LimitServices } from "../limits"
import { defineOperation, type OperationContext } from "./types"

/** Defines the services required by the indicator and measure option operations. */
export interface IndicatorServices extends LimitServices {
  getFarm: typeof core.getFarm
  getField: typeof core.getField
  getFieldIndicators: typeof calculator.getFieldIndicators
  getFarmIndicators: typeof calculator.getFarmIndicators
  getFieldMeasureOptions: typeof calculator.getFieldMeasureOptions
  /** Resolves the server-side NMI API key; returns `undefined` when not configured. */
  getNmiApiKey: () => string | undefined
}

/** Path parameters that identify the farm of an indicator request. */
export const IndicatorFarmParamsSchema = z.object({ b_id_farm: FarmIdSchema })

/** Path parameters that identify the field of an indicator or measure option request. */
export const IndicatorFieldParamsSchema = z.object({ b_id: FieldIdSchema })

/** Calendar year of the indicator scores and measure options. */
export const IndicatorYearQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "year must be a four-digit calendar year.")
    .refine((y) => Number.parseInt(y, 10) >= 1900, "year must be 1900 or later.")
    .describe(
      "Calendar year (four digits, e.g. 2026). Soil analyses and adopted measures are limited to 1 January through 31 December of this year; the cultivation history needed for the indicators is not.",
    ),
})

/** Score of a single soil quality indicator. Shared with the farm group and organization operations. */
export const IndicatorScoreSchema = z
  .object({
    indicator_id: z.string().describe("indicator identifier, e.g. `C_N`."),
    status: z.number().describe("Current value of the indicator, in the unit of the indicator."),
    target: z.number().describe("Target value of the indicator, in the unit of the indicator."),
    index: z.number().describe("Normalized distance to the target (0..1)."),
    impact: z.number().describe("Normalized impact of the indicator (0..1)."),
    score: z.number().describe("Normalized indicator score (0..1); higher is better."),
  })
  .openapi("IndicatorScore")

/** Score of a soil function or the overall score. Shared with the farm group and organization operations. */
export const AggregationScoreSchema = z
  .object({
    aggregation_id: z.string().describe("aggregation identifier, e.g. `S_BLN`."),
    score: z.number().describe("Normalized aggregation score (0..1); higher is better."),
  })
  .openapi("AggregationScore")

const FarmMetricSchema = z.object({
  score: z.number().describe("Area-weighted score (0..1)."),
})

/** Indicator and aggregation scores of a field for a calendar year. */
export const FieldIndicatorsSchema = z
  .object({
    b_id: FieldIdSchema,
    year: z.number().int().describe("Calendar year the results apply to."),
    is_excluded: z
      .boolean()
      .describe(
        "`true` for buffer strips and nature fields, which have no indicator score. `indicators` and `aggregations` are then empty.",
      ),
    indicators: z.array(IndicatorScoreSchema).describe("Score per soil quality indicator."),
    aggregations: z
      .array(AggregationScoreSchema)
      .describe("Scores aggregated per soil function and overall."),
  })
  .openapi("FieldIndicators")

/**
 * Indicator scores of the eligible fields of a farm and the area-weighted farm scores for a
 * calendar year. Shared with the farm group and organization operations.
 */
export const FarmIndicatorsSchema = z
  .object({
    b_id_farm: FarmIdSchema,
    year: z.number().int().describe("Calendar year the results apply to."),
    fields: z
      .array(
        z.object({
          b_id: FieldIdSchema,
          b_area: z.number().nullable().describe("Field area in hectares."),
          indicators: z.array(IndicatorScoreSchema).describe("Score per soil quality indicator."),
          aggregations: z
            .array(AggregationScoreSchema)
            .describe("Scores aggregated per soil function and overall."),
        }),
      )
      .describe("Eligible fields only; buffer strips and nature fields are left out."),
    farm: z
      .object({
        indicators: z
          .array(
            FarmMetricSchema.extend({
              indicator_id: z.string().describe("Indicator identifier, e.g. `C_N`."),
            }),
          )
          .describe("Area-weighted score per soil quality indicator."),
        aggregations: z
          .array(
            FarmMetricSchema.extend({
              aggregation_id: z.string().describe("Aggregation identifier, e.g. `S_BLN`."),
            }),
          )
          .describe("Area-weighted score per soil function and overall."),
      })
      .describe(
        "Area-weighted farm scores. Each metric uses only the eligible fields with a score for it and a positive area; metrics without contributing fields are omitted.",
      ),
  })
  .openapi("FarmIndicators")

const ImpactSchema = z.object({
  indicator_id: z.string().describe("Indicator identifier, e.g. `C_N`."),
  measure_impact: z.number().describe("Predicted positive impact on the indicator (0..1 scale)."),
})

const RecommendationImpactSchema = z.object({
  indicator_id: z.string().describe("Indicator identifier, e.g. `C_N`."),
  measure_impact: z
    .number()
    .describe("Predicted impact on the indicator (0..1 scale); can be negative."),
})

const MeasureOptionSchema = z
  .object({
    m_id: z.string().describe("Catalogue identifier; use it to create a measure on the field."),
    m_source: z.string().describe("Catalogue the measure comes from, e.g. 'bln'."),
    m_name: z.string().describe("Name of the measure."),
    m_description: z
      .string()
      .nullable()
      .describe("Detailed description of the measure and its effects. `null` when not available."),
    m_summary: z
      .string()
      .nullable()
      .describe("Short summary of the measure. `null` when not available."),
    m_source_url: z
      .string()
      .nullable()
      .describe("Link to a source that describes the measure. `null` when not available."),
    m_conflicts: z
      .array(z.string())
      .nullable()
      .describe(
        "Catalogue identifiers of measures that cannot be combined with this measure. `null` when none are known.",
      ),
    m_stage_applicability: z
      .enum(["field", "farm"])
      .nullable()
      .describe(
        "Whether the measure is taken per field or for the whole farm. `null` when unknown.",
      ),
    applicability: z
      .object({
        status: z
          .enum(["applicable", "not yet applicable", "inapplicable", "unknown"])
          .describe(
            "Result of the applicability check for this field: 'applicable', 'not yet applicable' (conditions can still be met), 'inapplicable' or 'unknown' (not enough data).",
          ),
        message: z.string().describe("Explanation from the applicability check; may be empty."),
      })
      .describe("Whether the measure can be taken on this field."),
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
        rank: z.number().int().min(1).max(5).describe("Rank of the recommendation, 1 (best) to 5."),
        aggregate_impact: z
          .number()
          .describe(
            "Sum of the impacts on the weak (non-green) indicators; negative impacts lower the sum. Options are ranked by this value.",
          ),
        indicator_impacts: z
          .array(RecommendationImpactSchema)
          .describe(
            "Impacts on the weak (non-green) indicators used for ranking, including negative impacts.",
          ),
      })
      .nullable()
      .describe(
        "`null` when the option is not recommended. At most one variant of a measure (IDs that differ only in a trailing lowercase letter, such as `bln_BM56b` and `bln_BM56c`) is recommended, and none when another variant is already adopted on the field.",
      ),
  })
  .openapi("MeasureOption")

/** Catalogue measures of a field with their applicability, predicted impact and recommendation. */
export const FieldMeasureOptionsSchema = z
  .object({
    b_id: FieldIdSchema,
    year: z.number().int().describe("Calendar year the results apply to."),
    is_excluded: z.boolean().describe("`true` for excluded fields; `data` is then empty."),
    data: z
      .array(MeasureOptionSchema)
      .describe("Measures from the catalogue, with their applicability and predicted impact."),
  })
  .openapi("FieldMeasureOptions")

/**
 * Runs an indicator calculation and maps failures of the indicator calculations to a generic 503
 * problem response, keeping upstream details and credentials out of the response. The underlying
 * cause is logged and reported server-side under the same `error_id` as the response. Other
 * errors (permissions, missing resources) pass through to the central error handler.
 *
 * @param work - The calculation.
 * @returns The result of the calculation.
 * @throws {ApiError} 503 `service-unavailable` when the indicator results cannot be produced.
 */
export async function guardIndicators<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof IndicatorsUnavailableError) {
      const error_id = nanoid()
      console.error(`[fdm-api] error_id=${error_id} Indicator calculation failed:`, err)
      Sentry.withScope((scope) => {
        scope.setTag("error_id", error_id)
        Sentry.captureException(err)
      })
      throw new ApiError(
        503,
        "service-unavailable",
        "Indicator results are temporarily unavailable. Try again later.",
        undefined,
        error_id,
      )
    }
    throw err
  }
}

/** Throws a 404 when the field does not exist or is not visible to the principal. */
async function requireField(
  { fdm, services, principal }: OperationContext<IndicatorServices>,
  b_id: string,
) {
  const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
  if (!field) throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
}

/**
 * Returns the indicator and aggregation scores of a field for a calendar year. Buffer strips and
 * nature fields are returned with `is_excluded: true` and empty arrays. Calls the NMI API.
 */
export const getFieldIndicators = defineOperation({
  name: "getFieldIndicators",
  kind: "read",
  bucket: "nmi",
  external: true,
  input: IndicatorFieldParamsSchema.extend(IndicatorYearQuerySchema.shape),
  output: FieldIndicatorsSchema,
  run: async (ctx: OperationContext<IndicatorServices>, { b_id, year }) => {
    const { fdm, services, principal } = ctx
    await requireField(ctx, b_id)

    const result = await guardIndicators(() =>
      services.getFieldIndicators(
        fdm,
        principal.effectivePrincipalId,
        b_id,
        Number.parseInt(year, 10),
        services.getNmiApiKey(),
      ),
    )
    return {
      b_id: result.b_id,
      year: result.year,
      is_excluded: result.is_excluded,
      indicators: result.score?.indicators ?? [],
      aggregations: result.score?.aggregations ?? [],
    }
  },
})

/**
 * Returns the indicator scores of all eligible fields of a farm and the area-weighted farm scores
 * for a calendar year. Calls the NMI API.
 */
export const getFarmIndicators = defineOperation({
  name: "getFarmIndicators",
  kind: "read",
  bucket: "nmi",
  external: true,
  input: IndicatorFarmParamsSchema.extend(IndicatorYearQuerySchema.shape),
  output: FarmIndicatorsSchema,
  run: async (
    { fdm, services, principal }: OperationContext<IndicatorServices>,
    { b_id_farm, year },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
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
    return {
      b_id_farm: result.b_id_farm,
      year: result.year,
      fields: result.fields.map((f) => ({
        b_id: f.b_id,
        b_area: f.b_area,
        indicators: f.score.indicators,
        aggregations: f.score.aggregations ?? [],
      })),
      farm: result.farm,
    }
  },
})

/**
 * Lists the field-level catalogue measures of a field with their applicability, active and
 * conflicting status, predicted impacts and recommendations for a calendar year. Calls the NMI API.
 */
export const listFieldMeasureOptions = defineOperation({
  name: "listFieldMeasureOptions",
  kind: "read",
  bucket: "nmi",
  external: true,
  input: IndicatorFieldParamsSchema.extend(IndicatorYearQuerySchema.shape),
  output: FieldMeasureOptionsSchema,
  run: async (ctx: OperationContext<IndicatorServices>, { b_id, year }) => {
    const { fdm, services, principal } = ctx
    await requireField(ctx, b_id)

    const result = await guardIndicators(() =>
      services.getFieldMeasureOptions(
        fdm,
        principal.effectivePrincipalId,
        b_id,
        Number.parseInt(year, 10),
        services.getNmiApiKey(),
      ),
    )
    return result as z.infer<typeof FieldMeasureOptionsSchema>
  },
})
