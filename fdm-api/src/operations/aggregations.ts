import type * as calculator from "@nmi-agro/fdm-calculator"
import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import {
  aggregateFarmScores,
  combineFarmMeasureSummaries,
  computeMinimumScores,
  getYearTimeframe,
} from "@nmi-agro/fdm-calculator"
import { getFarmIdsOfFarmGroupInYear } from "@nmi-agro/fdm-core"
import type { RateBucket } from "../rate-limit"
import { ApiError, getErrorMessages } from "../error"
import { FarmGroupIdSchema, FarmIdSchema, FieldIdSchema, OrganizationIdSchema } from "../fields"
import { assertFarmSizeSupported, type LimitServices } from "../limits"
import { DateStringSchema, serializeDate } from "../schemas"
import { NitrogenBalanceSchema, OrganicMatterBalanceSchema } from "./calculations"
import {
  AggregationScoreSchema,
  FarmIndicatorsSchema,
  guardIndicators,
  IndicatorScoreSchema,
} from "./indicators"
import { defineOperation, type Operation, type OperationContext } from "./types"

/** Defines the functions required by the aggregation operations. */
export interface AggregationServices extends LimitServices {
  getFarmGroup: typeof core.getFarmGroup
  getFarmIdsOfOrganization: typeof core.getFarmIdsOfOrganization
  getNitrogenBalanceForFarms: typeof calculator.getNitrogenBalanceForFarms
  getOrganicMatterBalanceForFarms: typeof calculator.getOrganicMatterBalanceForFarms
  getFarmIndicators: typeof calculator.getFarmIndicators
  getFarmMeasureSummary: typeof calculator.getFarmMeasureSummary
  getNmiApiKey: () => string | undefined
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * The set of farms an aggregation covers: the farms of a farm group (`group`) or the farms of an
 * organization (`organization`).
 */
export type AggregationScope = "group" | "organization"

/** Path parameters that identify the farm group of an aggregation. */
export const FarmGroupAggregationParamsSchema = z.object({ b_id_group: FarmGroupIdSchema })

/** Path parameters that identify the organization of an aggregation. */
export const OrganizationAggregationParamsSchema = z.object({
  organization_id: OrganizationIdSchema,
})

/**
 * Builds the query parameters of an aggregation: the calendar year and, optionally, the farms to
 * limit the results to.
 *
 * @param scope - Whether the aggregation covers a farm group or an organization.
 * @returns The query schema, with descriptions for the scope.
 */
export const aggregationQuerySchema = (scope: AggregationScope) =>
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

/** Input of an aggregation over a farm group: the group, the year and the optional farm filter. */
export const FarmGroupAggregationInputSchema = FarmGroupAggregationParamsSchema.extend(
  aggregationQuerySchema("group").shape,
)

/**
 * Input of an aggregation over an organization: the organization, the year and the optional farm
 * filter.
 */
export const OrganizationAggregationInputSchema = OrganizationAggregationParamsSchema.extend(
  aggregationQuerySchema("organization").shape,
)

/** Input of an aggregation over a farm group or an organization. */
type AggregationInput =
  | z.infer<typeof FarmGroupAggregationInputSchema>
  | z.infer<typeof OrganizationAggregationInputSchema>

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

/** Nitrogen balance of several farms: for all selected farms together and per farm. */
export const MultiFarmNitrogenBalanceSchema = balanceSchema(
  NitrogenBalanceSchema,
  "MultiFarmNitrogenBalance",
  "Nitrogen balance",
)

/** Organic matter balance of several farms: for all selected farms together and per farm. */
export const MultiFarmOrganicMatterBalanceSchema = balanceSchema(
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

/** Indicator scores of several farms: for all selected farms together and per farm. */
export const MultiFarmIndicatorsSchema = z
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

/** Measures and main cultivations of several farms: for all selected farms together and per farm. */
export const MultiFarmMeasuresSchema = z
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
// Helpers
// ---------------------------------------------------------------------------

const FARM_FAILED = "The result of this farm could not be calculated."

/** A fixed message per known failure; the underlying error is not shown to clients. */
function farmError(message: string | undefined): string | null {
  if (message === undefined) return null
  if (message === "No fields in input") return "The farm has no fields in this year."
  return FARM_FAILED
}

function requestedFarms(query: { b_id_farm?: string | string[] }): string[] | undefined {
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

/** The farms to aggregate, the year, and the principal to calculate them as. */
interface FarmSelection {
  year: number
  farmIds: string[]
  principal_id: string
}

/**
 * Resolves the farms to aggregate and the principal to calculate them as. For a group this is
 * the user; for an organization it is the organization itself, after checking that the user is
 * a member, as the organization overview of the web app does.
 */
async function resolve(
  scope: AggregationScope,
  { fdm, services, principal }: OperationContext<AggregationServices>,
  input: AggregationInput,
): Promise<FarmSelection> {
  const year = Number.parseInt(input.year, 10)
  if (scope === "group") {
    const { b_id_group } = input as z.infer<typeof FarmGroupAggregationInputSchema>
    const group = await services.getFarmGroup(fdm, principal.effectivePrincipalId, b_id_group)
    if (!group) throw new ApiError(404, "not-found", `Farm group '${b_id_group}' not found.`)
    const farmIds = narrow(
      getFarmIdsOfFarmGroupInYear(group, year),
      requestedFarms(input),
      `the group in ${year}`,
    )
    return { year, farmIds, principal_id: principal.effectivePrincipalId }
  }
  const { organization_id } = input as z.infer<typeof OrganizationAggregationInputSchema>
  const available = await services.getFarmIdsOfOrganization(
    fdm,
    principal.effectivePrincipalId,
    organization_id,
  )
  const farmIds = narrow(available, requestedFarms(input), "the organization")
  return { year, farmIds, principal_id: organization_id }
}

/**
 * Declares an aggregation operation for one scope. The operation resolves the selected farms of
 * the farm group or organization, refuses farms larger than the API supports, and passes the
 * farms to `compute`.
 */
function defineAggregationOperation<I extends z.ZodType<AggregationInput>, O extends z.ZodType>(
  scope: AggregationScope,
  definition: {
    name: string
    bucket: RateBucket
    external?: boolean
    input: I
    output: O
    compute: (
      ctx: OperationContext<AggregationServices>,
      selection: FarmSelection,
    ) => Promise<z.infer<O>>
  },
): Operation<I, O, AggregationServices> {
  const { compute, ...rest } = definition
  return defineOperation<I, O, AggregationServices>({
    ...rest,
    kind: "read",
    run: async (ctx, input) => {
      const selection = await resolve(scope, ctx, input)
      await assertFarmSizeSupported(ctx.fdm, ctx.services, selection.farmIds)
      return compute(ctx, selection)
    },
  })
}

// ---------------------------------------------------------------------------
// Computations, shared by the farm group and organization operations
// ---------------------------------------------------------------------------

async function computeNitrogenBalance(
  { fdm, services }: OperationContext<AggregationServices>,
  { year, farmIds, principal_id }: FarmSelection,
) {
  const result = await services.getNitrogenBalanceForFarms(
    fdm,
    principal_id,
    farmIds,
    getYearTimeframe(year),
  )
  return {
    year,
    total: result.total,
    farms: result.farms.map((farm) => ({
      b_id_farm: farm.b_id_farm,
      balance: farm.balance,
      error: farmError(farm.errorMessage),
    })),
  } as z.infer<typeof MultiFarmNitrogenBalanceSchema>
}

async function computeOrganicMatterBalance(
  { fdm, services }: OperationContext<AggregationServices>,
  { year, farmIds, principal_id }: FarmSelection,
) {
  const result = await services.getOrganicMatterBalanceForFarms(
    fdm,
    principal_id,
    farmIds,
    getYearTimeframe(year),
  )
  return {
    year,
    total: result.total,
    farms: result.farms.map((farm) => ({
      b_id_farm: farm.b_id_farm,
      balance: farm.balance,
      error: farmError(farm.errorMessage),
    })),
  } as z.infer<typeof MultiFarmOrganicMatterBalanceSchema>
}

async function computeIndicators(
  { fdm, services }: OperationContext<AggregationServices>,
  { year, farmIds, principal_id }: FarmSelection,
) {
  const nmiApiKey = services.getNmiApiKey()
  // Without a key no farm can be calculated: report that once for the whole request.
  if (!nmiApiKey) {
    throw new ApiError(
      503,
      "service-unavailable",
      "Indicator calculations are not available on this server.",
    )
  }

  const farms = []
  const allFields: calculator.FarmIndicators["fields"] = []
  let lastUnavailable: ApiError | undefined
  let unavailableFarms = 0
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
      // The indicators of this farm are unavailable (guardIndicators has reported it): keep the
      // other farms, unless no farm succeeds (checked below). A permission problem or another
      // API error applies to every farm.
      const unavailable =
        err instanceof ApiError && err.status === 503 && err.slug === "service-unavailable"
      if (
        !unavailable &&
        (err instanceof ApiError || getErrorMessages(err).includes("Permission denied"))
      ) {
        throw err
      }
      if (unavailable) {
        lastUnavailable = err
        unavailableFarms++
      }
      farms.push({ b_id_farm, area_weighted: null, minimum: null, error: FARM_FAILED })
    }
  }
  // When the indicators of no farm are available, the indicator service itself is unavailable.
  if (lastUnavailable && unavailableFarms === farmIds.length) {
    throw lastUnavailable
  }
  return {
    year,
    total: {
      area_weighted: aggregateFarmScores(allFields),
      minimum: computeMinimumScores(allFields.map((field) => field.score)),
    },
    farms,
  } as z.infer<typeof MultiFarmIndicatorsSchema>
}

async function computeMeasures(
  { fdm, services }: OperationContext<AggregationServices>,
  { year, farmIds, principal_id }: FarmSelection,
) {
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
      .filter((summary): summary is calculator.FarmMeasureSummary => summary !== undefined),
  )
  return {
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
  } as z.infer<typeof MultiFarmMeasuresSchema>
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Calculates the nitrogen balance of the farms of a farm group for a year: for all selected farms
 * together and per farm. A farm or field that cannot be calculated is reported and does not stop
 * the others.
 */
export const calculateFarmGroupNitrogenBalance = defineAggregationOperation("group", {
  input: FarmGroupAggregationInputSchema,
  name: "calculateFarmGroupNitrogenBalance",
  bucket: "calc",
  output: MultiFarmNitrogenBalanceSchema,
  compute: computeNitrogenBalance,
})

/**
 * Calculates the nitrogen balance of the farms of an organization for a year: for all selected
 * farms together and per farm. The principal must be a member of the organization.
 */
export const calculateOrganizationNitrogenBalance = defineAggregationOperation("organization", {
  input: OrganizationAggregationInputSchema,
  name: "calculateOrganizationNitrogenBalance",
  bucket: "calc",
  output: MultiFarmNitrogenBalanceSchema,
  compute: computeNitrogenBalance,
})

/**
 * Calculates the organic matter balance of the farms of a farm group for a year: for all selected
 * farms together and per farm. A farm or field that cannot be calculated is reported and does not
 * stop the others.
 */
export const calculateFarmGroupOrganicMatterBalance = defineAggregationOperation("group", {
  input: FarmGroupAggregationInputSchema,
  name: "calculateFarmGroupOrganicMatterBalance",
  bucket: "calc",
  output: MultiFarmOrganicMatterBalanceSchema,
  compute: computeOrganicMatterBalance,
})

/**
 * Calculates the organic matter balance of the farms of an organization for a year: for all
 * selected farms together and per farm. The principal must be a member of the organization.
 */
export const calculateOrganizationOrganicMatterBalance = defineAggregationOperation(
  "organization",
  {
    input: OrganizationAggregationInputSchema,
    name: "calculateOrganizationOrganicMatterBalance",
    bucket: "calc",
    output: MultiFarmOrganicMatterBalanceSchema,
    compute: computeOrganicMatterBalance,
  },
)

/**
 * Returns the soil quality indicator scores of the farms of a farm group for a year: the
 * area-weighted scores and the lowest score per indicator, for all selected farms together and
 * per farm. Calls the NMI API once per farm.
 */
export const getFarmGroupIndicators = defineAggregationOperation("group", {
  input: FarmGroupAggregationInputSchema,
  name: "getFarmGroupIndicators",
  bucket: "nmi",
  external: true,
  output: MultiFarmIndicatorsSchema,
  compute: computeIndicators,
})

/**
 * Returns the soil quality indicator scores of the farms of an organization for a year: the
 * area-weighted scores and the lowest score per indicator, for all selected farms together and
 * per farm. Calls the NMI API once per farm. The principal must be a member of the organization.
 */
export const getOrganizationIndicators = defineAggregationOperation("organization", {
  input: OrganizationAggregationInputSchema,
  name: "getOrganizationIndicators",
  bucket: "nmi",
  external: true,
  output: MultiFarmIndicatorsSchema,
  compute: computeIndicators,
})

/**
 * Lists the measures taken on the eligible fields of the farms of a farm group, and the main
 * cultivations of those fields, for all selected farms together and per farm.
 */
export const listFarmGroupMeasures = defineAggregationOperation("group", {
  input: FarmGroupAggregationInputSchema,
  name: "listFarmGroupMeasures",
  bucket: "general",
  output: MultiFarmMeasuresSchema,
  compute: computeMeasures,
})

/**
 * Lists the measures taken on the eligible fields of the farms of an organization, and the main
 * cultivations of those fields, for all selected farms together and per farm. The principal must
 * be a member of the organization.
 */
export const listOrganizationMeasures = defineAggregationOperation("organization", {
  input: OrganizationAggregationInputSchema,
  name: "listOrganizationMeasures",
  bucket: "general",
  output: MultiFarmMeasuresSchema,
  compute: computeMeasures,
})
