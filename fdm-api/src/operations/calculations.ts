import type * as calculator from "@nmi-agro/fdm-calculator"
import type { FdmType } from "@nmi-agro/fdm-core"
import type * as core from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import {
  FARM_NUTRIENT_ADVICE_NUTRIENTS,
  getYearTimeframe,
  NormNotApplicableError,
} from "@nmi-agro/fdm-calculator"
import { ApiError, getErrorMessages } from "../error"
import { FarmIdSchema, FieldIdSchema } from "../fields"
import { assertFarmSizeSupported, type LimitServices } from "../limits"
import { DateStringSchema } from "../schemas"
import { defineOperation, type OperationContext } from "./types"

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/**
 * Defines the calculation functions required by the calculation operations.
 */
export interface CalculationServices extends LimitServices {
  /** Looks up a single field (used to resolve b_id_farm for field-level calculations). */
  getField: typeof core.getField
  /** Collects all data needed to compute the nitrogen balance for a farm. */
  collectInputForNitrogenBalance: typeof calculator.collectInputForNitrogenBalance
  /** Computes the nitrogen balance for an entire farm from pre-collected input. */
  calculateNitrogenBalance: typeof calculator.calculateNitrogenBalance
  /** Computes the nitrogen balance for a single field using cached calculation. */
  getNitrogenBalanceField: typeof calculator.getNitrogenBalanceField
  /** Collects all data needed to compute the organic matter balance for a farm. */
  collectInputForOrganicMatterBalance: typeof calculator.collectInputForOrganicMatterBalance
  /** Computes the organic matter balance for an entire farm from pre-collected input. */
  calculateOrganicMatterBalance: typeof calculator.calculateOrganicMatterBalance
  /** Computes the organic matter balance for a single field using cached calculation. */
  getOrganicMatterBalanceField: typeof calculator.getOrganicMatterBalanceField
  /** Calculates the total NPK dose applied to a specific field. */
  getDoseForField: typeof calculator.getDoseForField
  // Norms & calculation functions
  createFunctionsForNorms: typeof calculator.createFunctionsForNorms
  // Nutrient advice
  /** Calculates the nutrient advice, dose and remaining advice per field of a farm. */
  getFarmNutrientAdviceRows: typeof calculator.getFarmNutrientAdviceRows
  /** Returns the fields of a farm. */
  getFields: typeof core.getFields
  /** Resolves the server-side NMI API key; `undefined` when not configured. */
  getNmiApiKey: () => string | undefined
  // Additional FDM core data fetching
  getCultivations: typeof core.getCultivations
  getCurrentSoilData: typeof core.getCurrentSoilData
  getFertilizerApplications: typeof core.getFertilizerApplications
  getFertilizers: typeof core.getFertilizers
}

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

/** Path parameters that identify the farm of a farm-level calculation. */
export const CalculationFarmParamsSchema = z.object({ b_id_farm: FarmIdSchema })

/** Path parameters that identify the field of a field-level calculation. */
export const CalculationFieldParamsSchema = z.object({ b_id: FieldIdSchema })

const TimeframeQueryShape = {
  start: DateStringSchema.describe("Inclusive start date in YYYY-MM-DD format."),
  end: DateStringSchema.describe("Inclusive end date in YYYY-MM-DD format."),
}

const isTimeframeOrdered = (d: { start: string; end: string }) =>
  new Date(d.start) <= new Date(d.end)

const timeframeOrderError = {
  message: "start must be before or equal to end",
  path: ["end"],
}

/** Timeframe of a balance calculation: an inclusive start and end date, in order. */
export const TimeframeQuerySchema = z
  .object(TimeframeQueryShape)
  .refine(isTimeframeOrdered, timeframeOrderError)

const NitrogenBalanceQueryShape = {
  ...TimeframeQueryShape,
  effective_nitrogen: z
    .enum(["true", "false"])
    .optional()
    .describe(
      "When `true`, the supply by fertilizers is calculated with effective nitrogen (`p_n_rt * p_n_wc`) and the soil mineralization with the MINIP model. Nitrate leaching is still based on the surplus of the balance with total nitrogen. The target is only available for the balance with total nitrogen and is omitted from the response. Defaults to `false`.",
    ),
}

/** Timeframe of a nitrogen balance calculation and whether to use effective nitrogen. */
export const NitrogenBalanceQuerySchema = z
  .object(NitrogenBalanceQueryShape)
  .refine(isTimeframeOrdered, timeframeOrderError)

const ApplicationValueSchema = z.object({
  id: z
    .string()
    .describe(
      "Identifier of the source of the amount: a fertilizer application (`p_app_id`), cultivation (`b_lu`) or harvest (`b_id_harvesting`).",
    ),
  value: z.number().describe("Nitrogen amount from this source (kg N/ha)."),
})

/** Describes a nitrogen total of a balance term (kg N/ha). */
const nitrogenTotal = (meaning: string) => z.number().describe(`${meaning} (kg N/ha).`)
/** Describes a nitrogen loss term, which is reported as a negative number (kg N/ha). */
const nitrogenLoss = (meaning: string) =>
  z.number().describe(`${meaning}, as a negative number (kg N/ha).`)

// ---------------------------------------------------------------------------
// Dose schema
// ---------------------------------------------------------------------------

/** Total doses of nutrients applied to a field with all its fertilizer applications. */
export const DoseSchema = z
  .object({
    p_dose_n: z.number().describe("Nitrogen (N) dose in kg/ha"),
    p_dose_nw: z.number().describe("Workable nitrogen (Nw) dose in kg/ha"),
    p_dose_p: z.number().describe("Phosphate (P2O5) dose in kg/ha"),
    p_dose_k: z.number().describe("Potassium (K2O) dose in kg/ha"),
    p_dose_eoc: z.number().describe("Effective organic carbon (EOC) dose in kg/ha"),
    p_dose_s: z.number().describe("Sulfur (SO3) dose in kg/ha"),
    p_dose_mg: z.number().describe("Magnesium (MgO) dose in kg/ha"),
    p_dose_ca: z.number().describe("Calcium (CaO) dose in kg/ha"),
    p_dose_na: z.number().describe("Sodium (Na2O) dose in kg/ha"),
    p_dose_cu: z.number().describe("Copper (Cu) dose in kg/ha"),
    p_dose_zn: z.number().describe("Zinc (Zn) dose in kg/ha"),
    p_dose_co: z.number().describe("Cobalt (Co) dose in kg/ha"),
    p_dose_mn: z.number().describe("Manganese (Mn) dose in kg/ha"),
    p_dose_mo: z.number().describe("Molybdenum (Mo) dose in kg/ha"),
    p_dose_b: z.number().describe("Boron (B) dose in kg/ha"),
  })
  .openapi("Dose")

// ---------------------------------------------------------------------------
// Nitrogen balance schemas
// ---------------------------------------------------------------------------

const NitrogenFertilizersGroupSchema = z.object({
  total: nitrogenTotal("Nitrogen supplied by fertilizers of this type"),
  applications: z
    .array(ApplicationValueSchema)
    .describe("Nitrogen supplied per fertilizer application."),
})

const NitrogenSupplyFertilizersSchema = z.object({
  total: nitrogenTotal("Nitrogen supplied by all fertilizers"),
  mineral: NitrogenFertilizersGroupSchema.describe("Nitrogen supplied by mineral fertilizers."),
  manure: NitrogenFertilizersGroupSchema.describe("Nitrogen supplied by animal manure."),
  compost: NitrogenFertilizersGroupSchema.describe("Nitrogen supplied by compost."),
  other: NitrogenFertilizersGroupSchema.describe("Nitrogen supplied by other fertilizers."),
})

const NitrogenSupplyFieldSchema = z.object({
  total: nitrogenTotal("Total nitrogen supply"),
  fertilizers: NitrogenSupplyFertilizersSchema.describe("Nitrogen supplied by fertilizers."),
  fixation: z
    .object({
      total: nitrogenTotal("Nitrogen fixed biologically by the cultivations"),
      cultivations: z
        .array(ApplicationValueSchema)
        .describe("Biological nitrogen fixation per cultivation."),
    })
    .describe("Biological nitrogen fixation, for example by clover or other legumes."),
  deposition: z
    .object({ total: nitrogenTotal("Nitrogen supplied by atmospheric deposition") })
    .describe("Atmospheric nitrogen deposition."),
  mineralisation: z
    .object({ total: nitrogenTotal("Nitrogen released by mineralisation of soil organic matter") })
    .describe("Nitrogen released by mineralisation of soil organic matter."),
})

const NitrogenRemovalFieldSchema = z.object({
  total: nitrogenLoss("Total nitrogen removal"),
  harvests: z
    .object({
      total: nitrogenLoss("Nitrogen removed with the harvested products"),
      harvests: z.array(ApplicationValueSchema).describe("Nitrogen removed per harvest."),
    })
    .describe("Nitrogen removed with the harvested products."),
  residues: z
    .object({
      total: nitrogenLoss("Nitrogen removed with crop residues taken off the field"),
      cultivations: z
        .array(ApplicationValueSchema)
        .describe("Nitrogen removed with crop residues per cultivation."),
    })
    .describe("Nitrogen removed with crop residues taken off the field."),
})

const AmmoniaFertilizersSchema = z
  .record(z.string(), z.unknown())
  .describe(
    "Ammonia emission from fertilizers, split by fertilizer type (`total`, `mineral`, `manure`, `compost`, `other`), as negative numbers (kg N/ha).",
  )

const NitrogenEmissionAmmoniaSchema = z.object({
  total: nitrogenLoss("Total nitrogen emitted as ammonia"),
  fertilizers: AmmoniaFertilizersSchema,
  residues: z
    .object({
      total: nitrogenLoss("Nitrogen emitted as ammonia from crop residues"),
      cultivations: z
        .array(ApplicationValueSchema)
        .describe("Ammonia emission from crop residues per cultivation."),
    })
    .describe("Ammonia emission from crop residues left on the field."),
})

const NitrogenEmissionFieldSchema = z.object({
  total: nitrogenLoss("Total nitrogen emission"),
  ammonia: NitrogenEmissionAmmoniaSchema.describe("Nitrogen emitted as ammonia (NH3)."),
  nitrate: z
    .object({ total: nitrogenLoss("Nitrogen leached as nitrate") })
    .describe("Nitrogen leached as nitrate (NO3)."),
})

const BalanceAreaSchema = z.number().describe("Area of the field (ha).")
const BalanceBufferstripSchema = z
  .boolean()
  .optional()
  .describe("Whether the field is a buffer strip. Buffer strips are left out of the farm averages.")
const BalanceErrorMessageSchema = z
  .string()
  .optional()
  .describe("Reason the balance could not be calculated for this field. Omitted on success.")

/** Nitrogen balance of a single field, with its area and whether it is a buffer strip. */
export const NitrogenBalanceFieldResultSchema = z
  .object({
    b_id: FieldIdSchema,
    b_area: BalanceAreaSchema,
    b_bufferstrip: BalanceBufferstripSchema,
    balance: z
      .object({
        b_id: FieldIdSchema,
        balance: z
          .number()
          .describe("Nitrogen balance of the field: supply plus removal plus emission (kg N/ha)."),
        supply: NitrogenSupplyFieldSchema.describe("Nitrogen supplied to the field."),
        removal: NitrogenRemovalFieldSchema.describe("Nitrogen removed from the field."),
        emission: NitrogenEmissionFieldSchema.describe("Nitrogen lost to the environment."),
        target: z
          .number()
          .optional()
          .describe("Target nitrogen balance in kg N/ha. Omitted when `effective_nitrogen=true`."),
      })
      .optional()
      .describe("Nitrogen balance of the field. Omitted when the calculation failed."),
    errorMessage: BalanceErrorMessageSchema,
  })
  .openapi("NitrogenBalanceFieldResult")

/** Nitrogen balance of a farm, shared with the farm group and organization operations. */
export const NitrogenBalanceSchema = z
  .object({
    balance: z.number().describe("Weighted average nitrogen balance across all fields in kg N/ha"),
    supply: z
      .object({
        total: nitrogenTotal("Weighted average total nitrogen supply"),
        deposition: nitrogenTotal("Weighted average nitrogen supply by atmospheric deposition"),
        fixation: nitrogenTotal("Weighted average biological nitrogen fixation"),
        mineralisation: nitrogenTotal(
          "Weighted average nitrogen released by mineralisation of soil organic matter",
        ),
        fertilizers: z
          .object({
            total: nitrogenTotal("Weighted average nitrogen supply by all fertilizers"),
            mineral: nitrogenTotal("Weighted average nitrogen supply by mineral fertilizers"),
            manure: nitrogenTotal("Weighted average nitrogen supply by animal manure"),
            compost: nitrogenTotal("Weighted average nitrogen supply by compost"),
            other: nitrogenTotal("Weighted average nitrogen supply by other fertilizers"),
          })
          .describe("Weighted average nitrogen supply by fertilizers."),
      })
      .describe("Weighted average nitrogen supply across all fields."),
    removal: z
      .object({
        total: nitrogenLoss("Weighted average total nitrogen removal"),
        harvests: nitrogenLoss("Weighted average nitrogen removal with harvested products"),
        residues: nitrogenLoss("Weighted average nitrogen removal with crop residues"),
      })
      .describe("Weighted average nitrogen removal across all fields."),
    emission: z
      .object({
        total: nitrogenLoss("Weighted average total nitrogen emission"),
        ammonia: z
          .object({
            total: nitrogenLoss("Weighted average nitrogen emission as ammonia"),
            fertilizers: AmmoniaFertilizersSchema,
            residues: nitrogenLoss("Weighted average ammonia emission from crop residues"),
          })
          .describe("Weighted average nitrogen emission as ammonia (NH3)."),
        nitrate: nitrogenLoss("Weighted average nitrogen leaching as nitrate"),
      })
      .describe("Weighted average nitrogen emission across all fields."),
    target: z
      .number()
      .optional()
      .describe(
        "Weighted average target nitrogen balance in kg N/ha. Omitted when `effective_nitrogen=true`.",
      ),
    fields: z.array(NitrogenBalanceFieldResultSchema).describe("Nitrogen balance per field."),
    hasErrors: z
      .boolean()
      .describe("`true` when the balance could not be calculated for one or more fields."),
    fieldErrorMessages: z
      .array(z.string())
      .describe("Error messages of the fields for which the calculation failed."),
  })
  .describe("Nitrogen balance (kg N/ha) of a farm or a group of farms, with the result per field.")
  .openapi("NitrogenBalance")

// ---------------------------------------------------------------------------
// Organic matter balance schemas
// ---------------------------------------------------------------------------

const OrganicMatterApplicationValueSchema = z.object({
  id: z
    .string()
    .describe(
      "Identifier of the source of the amount: a fertilizer application (`p_app_id`) or cultivation (`b_lu`).",
    ),
  value: z.number().describe("Effective organic matter from this source (kg EOM/ha/year)."),
})

/** Describes an effective organic matter supply term (kg EOM/ha/year). */
const eomSupply = (meaning: string) => z.number().describe(`${meaning} (kg EOM/ha/year).`)

/** Describes an organic matter supply term per fertilizer application. */
const organicMatterApplicationsGroup = (meaning: string) =>
  z
    .object({
      total: eomSupply(meaning),
      applications: z
        .array(OrganicMatterApplicationValueSchema)
        .describe(`${meaning}, per fertilizer application.`),
    })
    .describe(`${meaning}.`)

/** Describes an organic matter supply term per cultivation. */
const organicMatterCultivationsGroup = (meaning: string) =>
  z
    .object({
      total: eomSupply(meaning),
      cultivations: z
        .array(OrganicMatterApplicationValueSchema)
        .describe(`${meaning}, per cultivation.`),
    })
    .describe(`${meaning}.`)

/** Organic matter balance of a single field, with its area and whether it is a buffer strip. */
export const OrganicMatterBalanceFieldResultSchema = z
  .object({
    b_id: FieldIdSchema,
    b_area: BalanceAreaSchema,
    b_bufferstrip: BalanceBufferstripSchema,
    balance: z
      .object({
        b_id: FieldIdSchema,
        balance: z
          .number()
          .describe(
            "Organic matter balance of the field: supply plus degradation (kg EOM/ha/year).",
          ),
        supply: z
          .object({
            total: eomSupply("Total effective organic matter supply"),
            fertilizers: z
              .object({
                total: eomSupply("Effective organic matter supplied by all fertilizers"),
                manure: organicMatterApplicationsGroup(
                  "Effective organic matter supplied by animal manure",
                ),
                compost: organicMatterApplicationsGroup(
                  "Effective organic matter supplied by compost",
                ),
                other: organicMatterApplicationsGroup(
                  "Effective organic matter supplied by other fertilizers",
                ),
              })
              .describe("Effective organic matter supplied by fertilizers."),
            cultivations: organicMatterCultivationsGroup(
              "Effective organic matter supplied by the cultivations, such as roots and stubble",
            ),
            residues: organicMatterCultivationsGroup(
              "Effective organic matter supplied by crop residues left on the field",
            ),
          })
          .describe("Effective organic matter supplied to the field."),
        degradation: z
          .object({
            total: z
              .number()
              .describe(
                "Soil organic matter degraded in a year, as a negative number (kg EOM/ha/year).",
              ),
          })
          .describe("Degradation of soil organic matter."),
      })
      .optional()
      .describe("Organic matter balance of the field. Omitted when the calculation failed."),
    errorMessage: BalanceErrorMessageSchema,
  })
  .openapi("OrganicMatterBalanceFieldResult")

/** Organic matter balance of a farm, shared with the farm group and organization operations. */
export const OrganicMatterBalanceSchema = z
  .object({
    balance: z
      .number()
      .describe("Weighted average organic matter balance across all fields in kg EOM/ha/year"),
    supply: z.number().describe("Weighted average EOM supply in kg EOM/ha/year"),
    degradation: z.number().describe("Weighted average SOM degradation in kg EOM/ha/year"),
    fields: z
      .array(OrganicMatterBalanceFieldResultSchema)
      .describe("Organic matter balance per field."),
    hasErrors: z
      .boolean()
      .describe("`true` when the balance could not be calculated for one or more fields."),
    fieldErrorMessages: z
      .array(z.string())
      .describe("Error messages of the fields for which the calculation failed."),
  })
  .describe(
    "Organic matter balance (kg EOC/ha) of a farm or a group of farms, with the result per field.",
  )
  .openapi("OrganicMatterBalance")

// ---------------------------------------------------------------------------
// Norms schemas
// ---------------------------------------------------------------------------

const NormResultSchema = z.object({
  normValue: z.number().describe("Norm value in kg/ha"),
  normSource: z.string().describe("Source or category used to determine the norm"),
})

const NitrogenNormSchema = NormResultSchema.nullable().describe("Nitrogen usage norm (kg N/ha)")
const ManureNormSchema = NormResultSchema.nullable().describe(
  "Manure usage norm (kg N/ha from animal manure)",
)
const PhosphateNormSchema = NormResultSchema.nullable().describe(
  "Phosphate usage norm (kg P2O5/ha)",
)
const NormYearSchema = z.number().int().describe("Calendar year the norms apply to.")

/** Nitrogen, manure and phosphate usage norms of a field for a calendar year. */
export const FieldNormsSchema = z
  .object({
    b_id: FieldIdSchema,
    year: NormYearSchema,
    nitrogen: NitrogenNormSchema,
    manure: ManureNormSchema,
    phosphate: PhosphateNormSchema,
  })
  .openapi("FieldNorms")

const FarmNormsFieldSchema = z.object({
  b_id: FieldIdSchema,
  nitrogen: NitrogenNormSchema,
  manure: ManureNormSchema,
  phosphate: PhosphateNormSchema,
})

/** Nitrogen, manure and phosphate usage norms of every field of a farm for a calendar year. */
export const FarmNormsSchema = z
  .object({
    b_id_farm: FarmIdSchema,
    year: NormYearSchema,
    fields: z.array(FarmNormsFieldSchema).describe("Usage norms per field of the farm."),
  })
  .openapi("FarmNorms")

/** Calendar year of the usage norms; only the years with implemented norms are accepted. */
export const NormsYearQuerySchema = z.object({
  year: z
    .enum(["2025", "2026"])
    .default("2026")
    .describe("Calendar year. Only 2025 and 2026 are currently supported for norms."),
})

// ---------------------------------------------------------------------------
// Nutrient advice schema
// ---------------------------------------------------------------------------

const NutrientAdviceValueSchema = z.object({
  advice: z.number().describe("Advised amount of the nutrient, per hectare."),
  dose: z
    .number()
    .describe("Amount of the nutrient already applied with fertilizers in the year, per hectare."),
  remaining: z
    .number()
    .describe(
      "`advice - dose`, per hectare. A negative value means more was applied than advised.",
    ),
})

const NutrientAdviceValuesSchema = z
  .object(
    Object.fromEntries(
      FARM_NUTRIENT_ADVICE_NUTRIENTS.map((nutrient) => [
        nutrient.symbol,
        NutrientAdviceValueSchema.optional().describe(
          `Advice, dose and remaining advice of ${nutrient.symbol}, in ${nutrient.unit}.`,
        ),
      ]),
    ),
  )
  .openapi("NutrientAdviceValues")

/** Nutrient advice, dose and remaining advice of a field for the main cultivation of a year. */
export const FieldNutrientAdviceSchema = z
  .object({
    b_id: FieldIdSchema.describe("Unique identifier of the field."),
    b_name: z.string().describe("Name of the field."),
    b_area: z.number().describe("Area of the field (ha)."),
    b_lu_catalogue: z
      .string()
      .nullable()
      .describe(
        "Cultivation catalogue code of the main cultivation of the year that the advice is for. `null` when the field has no main cultivation.",
      ),
    b_lu_name: z
      .string()
      .nullable()
      .describe("Name of the main cultivation. `null` when the field has no main cultivation."),
    suggested_b_lu_catalogue: z
      .string()
      .nullable()
      .describe(
        "Cultivation catalogue code of a suggested main cultivation, based on the crop registered for this location in the Dutch crop registration (BRP). Only set when the field has no main cultivation; otherwise `null`.",
      ),
    nutrients: NutrientAdviceValuesSchema.describe(
      "Advice, dose and remaining advice per nutrient. Empty when `error` is set.",
    ),
    error: z
      .object({
        code: z
          .enum(["no_cultivation", "no_main_cultivation", "farm_data_unavailable", "advice_failed"])
          .describe(
            "Why the advice could not be calculated: `no_cultivation` (no cultivation in the year), `no_main_cultivation` (no cultivation between 15 May and 15 July), `farm_data_unavailable` (the data of the farm could not be read) or `advice_failed` (the dose or the advice could not be calculated).",
          ),
        message: z.string().describe("Description of the problem."),
      })
      .nullable()
      .describe("Set when the advice of this field could not be calculated; otherwise `null`."),
  })
  .openapi("FieldNutrientAdvice")

/** Nutrient advice of every field of a farm for the main cultivation of a year. */
export const FarmNutrientAdviceSchema = z
  .object({
    b_id_farm: FarmIdSchema.describe("Unique identifier of the farm."),
    year: z.number().int().describe("Calendar year the advice is for."),
    hasErrors: z
      .boolean()
      .describe("True when the advice of one or more fields could not be calculated."),
    fields: z
      .array(FieldNutrientAdviceSchema)
      .describe("Nutrient advice per field. A field that failed has `error` set."),
  })
  .openapi("FarmNutrientAdvice")

/** Calendar year of the nutrient advice. */
export const NutrientAdviceYearQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "year must be a four-digit calendar year.")
    .describe(
      "Calendar year (four digits, e.g. 2026). The main cultivation is the cultivation present longest between 15 May and 15 July of this year; the dose counts the fertilizer applications of this year.",
    ),
})

const ERROR_MESSAGES: Record<
  NonNullable<calculator.FarmNutrientAdviceRow["error"]>["code"],
  string
> = {
  no_cultivation: "The field has no cultivation in this year.",
  no_main_cultivation: "The field has no main cultivation in this year.",
  farm_data_unavailable: "The data of the farm could not be read.",
  advice_failed: "The nutrient advice could not be calculated for this field.",
}

function serialiseNutrientAdviceRow(row: calculator.FarmNutrientAdviceRow) {
  return {
    b_id: row.b_id,
    b_name: row.b_name,
    b_area: row.b_area,
    b_lu_catalogue: row.mainCultivation?.b_lu_catalogue ?? null,
    b_lu_name: row.mainCultivation?.b_lu_name ?? null,
    suggested_b_lu_catalogue: row.cultivationSuggestion?.b_lu_catalogue ?? null,
    nutrients: row.values,
    // Only fixed messages: the underlying error can contain details of external services.
    error: row.error ? { code: row.error.code, message: ERROR_MESSAGES[row.error.code] } : null,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The start of the fdm-calculator message when a soil analysis lacks required parameters. */
const MISSING_SOIL_PARAMETERS = "Missing required soil parameters:"

/**
 * Runs a field calculation and turns missing soil data into a 422 the client can act on, instead
 * of an internal error.
 */
async function withSoilDataCheck<T>(calculate: () => Promise<T>): Promise<T> {
  try {
    return await calculate()
  } catch (err) {
    const missing = getErrorMessages(err).find((message) =>
      message.startsWith(MISSING_SOIL_PARAMETERS),
    )
    if (missing) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        `The soil data of the field is not complete enough for this calculation. Missing: ${missing.slice(MISSING_SOIL_PARAMETERS.length).trim()}. Add a soil analysis with these parameters.`,
      )
    }
    throw err
  }
}

/**
 * Removes the target from a nitrogen balance. The target only applies to the balance with total
 * nitrogen, so it is omitted from the balance with effective nitrogen.
 */
function omitTarget(
  balance: calculator.NitrogenBalanceFieldNumeric,
): Omit<calculator.NitrogenBalanceFieldNumeric, "target"> {
  const { target: _target, ...rest } = balance
  return rest
}

/**
 * Removes the target from a farm nitrogen balance and from the balance of each of its fields.
 */
function omitNitrogenBalanceTargets(result: calculator.NitrogenBalanceNumeric) {
  const { target: _target, fields, ...rest } = result
  return {
    ...rest,
    fields: fields.map((field) =>
      field.balance ? { ...field, balance: omitTarget(field.balance) } : field,
    ),
  }
}

async function calculateNormResults(
  fdm: FdmType,
  normFunctions: {
    calculateNormForNitrogen: (
      fdm: FdmType,
      input: unknown,
    ) => Promise<z.infer<typeof NormResultSchema>>
    calculateNormForManure: (
      fdm: FdmType,
      input: unknown,
    ) => Promise<z.infer<typeof NormResultSchema>>
    calculateNormForPhosphate: (
      fdm: FdmType,
      input: unknown,
    ) => Promise<z.infer<typeof NormResultSchema>>
  },
  input: unknown,
) {
  const [nitrogen, manure, phosphate] = await Promise.all([
    normFunctions.calculateNormForNitrogen(fdm, input).catch((err) => {
      if (err instanceof NormNotApplicableError) return null
      throw err
    }),
    normFunctions.calculateNormForManure(fdm, input).catch((err) => {
      if (err instanceof NormNotApplicableError) return null
      throw err
    }),
    normFunctions.calculateNormForPhosphate(fdm, input).catch((err) => {
      if (err instanceof NormNotApplicableError) return null
      throw err
    }),
  ])

  return { nitrogen, manure, phosphate }
}

/** Returns the NMI API key, or answers 503 when nutrient advice is not configured. */
function requireNmiApiKey(services: Pick<CalculationServices, "getNmiApiKey">): string {
  const nmiApiKey = services.getNmiApiKey()
  if (!nmiApiKey) {
    throw new ApiError(
      503,
      "service-unavailable",
      "Nutrient advice is not configured on this server.",
    )
  }
  return nmiApiKey
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Calculates the weighted-average nitrogen balance across all fields of a farm for a timeframe,
 * with total nitrogen or, when `effective_nitrogen` is `"true"`, with effective nitrogen.
 */
export const calculateFarmNitrogenBalance = defineOperation({
  name: "calculateFarmNitrogenBalance",
  kind: "read",
  bucket: "calc",
  input: z
    .object({ ...CalculationFarmParamsSchema.shape, ...NitrogenBalanceQueryShape })
    .refine(isTimeframeOrdered, timeframeOrderError),
  output: NitrogenBalanceSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CalculationServices>,
    { b_id_farm, start, end, effective_nitrogen },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const useEffectiveNitrogen = effective_nitrogen === "true"

    const timeframe = { start: new Date(start), end: new Date(end) }
    const input = await services.collectInputForNitrogenBalance(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      timeframe,
    )
    const result = await services.calculateNitrogenBalance(fdm, {
      ...input,
      useEffectiveNitrogen,
    })
    return (useEffectiveNitrogen ? omitNitrogenBalanceTargets(result) : result) as z.infer<
      typeof NitrogenBalanceSchema
    >
  },
})

/** Calculates the weighted-average organic matter balance across all fields of a farm for a timeframe. */
export const calculateFarmOrganicMatterBalance = defineOperation({
  name: "calculateFarmOrganicMatterBalance",
  kind: "read",
  bucket: "calc",
  input: z
    .object({ ...CalculationFarmParamsSchema.shape, ...TimeframeQueryShape })
    .refine(isTimeframeOrdered, timeframeOrderError),
  output: OrganicMatterBalanceSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CalculationServices>,
    { b_id_farm, start, end },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const timeframe = { start: new Date(start), end: new Date(end) }
    const input = await services.collectInputForOrganicMatterBalance(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      timeframe,
    )
    const result = await services.calculateOrganicMatterBalance(fdm, {
      ...input,
      timeFrame: {
        start: input.timeFrame.start as Date,
        end: input.timeFrame.end as Date,
      },
    })
    return result as z.infer<typeof OrganicMatterBalanceSchema>
  },
})

/**
 * Calculates the nitrogen balance of a single field for a timeframe, with total nitrogen or, when
 * `effective_nitrogen` is `"true"`, with effective nitrogen.
 */
export const calculateFieldNitrogenBalance = defineOperation({
  name: "calculateFieldNitrogenBalance",
  kind: "read",
  bucket: "calc",
  input: z
    .object({ ...CalculationFieldParamsSchema.shape, ...NitrogenBalanceQueryShape })
    .refine(isTimeframeOrdered, timeframeOrderError),
  output: NitrogenBalanceFieldResultSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CalculationServices>,
    { b_id, start, end, effective_nitrogen },
  ) => {
    const useEffectiveNitrogen = effective_nitrogen === "true"

    const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    if (!field) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }

    const timeframe = { start: new Date(start), end: new Date(end) }
    const input = await services.collectInputForNitrogenBalance(
      fdm,
      principal.effectivePrincipalId,
      field.b_id_farm,
      timeframe,
      b_id,
    )

    if (input.fields.length === 0) {
      throw new ApiError(
        404,
        "not-found",
        `Field '${b_id}' not found in farm '${field.b_id_farm}'.`,
      )
    }

    const fieldInput = input.fields[0]
    const balance = await withSoilDataCheck(() =>
      services.getNitrogenBalanceField(fdm, {
        fieldInput,
        fertilizerDetails: input.fertilizerDetails,
        cultivationDetails: input.cultivationDetails,
        timeFrame: {
          start: input.timeFrame.start as Date,
          end: input.timeFrame.end as Date,
        },
        useEffectiveNitrogen,
      }),
    )

    return {
      b_id: fieldInput.field.b_id,
      b_area: fieldInput.field.b_area ?? 0,
      b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
      balance: useEffectiveNitrogen ? omitTarget(balance) : balance,
    } as z.infer<typeof NitrogenBalanceFieldResultSchema>
  },
})

/** Calculates the organic matter balance of a single field for a timeframe. */
export const calculateFieldOrganicMatterBalance = defineOperation({
  name: "calculateFieldOrganicMatterBalance",
  kind: "read",
  bucket: "calc",
  input: z
    .object({ ...CalculationFieldParamsSchema.shape, ...TimeframeQueryShape })
    .refine(isTimeframeOrdered, timeframeOrderError),
  output: OrganicMatterBalanceFieldResultSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CalculationServices>,
    { b_id, start, end },
  ) => {
    const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    if (!field) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }

    const timeframe = { start: new Date(start), end: new Date(end) }
    const input = await services.collectInputForOrganicMatterBalance(
      fdm,
      principal.effectivePrincipalId,
      field.b_id_farm,
      timeframe,
      b_id,
    )

    if (input.fields.length === 0) {
      throw new ApiError(
        404,
        "not-found",
        `Field '${b_id}' not found in farm '${field.b_id_farm}'.`,
      )
    }

    const fieldInput = input.fields[0]
    const balance = await withSoilDataCheck(() =>
      services.getOrganicMatterBalanceField(fdm, {
        fieldInput,
        fertilizerDetails: input.fertilizerDetails,
        cultivationDetails: input.cultivationDetails,
        timeFrame: {
          start: input.timeFrame.start as Date,
          end: input.timeFrame.end as Date,
        },
      }),
    )

    return {
      b_id: fieldInput.field.b_id,
      b_area: fieldInput.field.b_area ?? 0,
      b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
      balance,
    } as z.infer<typeof OrganicMatterBalanceFieldResultSchema>
  },
})

/** Calculates the total doses of nutrients applied to a field with all its fertilizer applications. */
export const getFieldDose = defineOperation({
  name: "getFieldDose",
  kind: "read",
  bucket: "calc",
  input: CalculationFieldParamsSchema,
  output: DoseSchema,
  run: async ({ fdm, services, principal }: OperationContext<CalculationServices>, { b_id }) => {
    // Resolve field first to surface 404/403 before delegating to calculator
    const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    if (!field) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }

    const dose = await services.getDoseForField({
      fdm,
      principal_id: principal.effectivePrincipalId,
      b_id,
    })
    return dose as z.infer<typeof DoseSchema>
  },
})

/** Calculates the Dutch nitrogen, manure and phosphate usage norms of every field of a farm. */
export const getFarmFertilizationNorms = defineOperation({
  name: "getFarmFertilizationNorms",
  kind: "read",
  bucket: "calc",
  input: CalculationFarmParamsSchema.extend(NormsYearQuerySchema.shape),
  output: FarmNormsSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CalculationServices>,
    { b_id_farm, year },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const fields: z.infer<typeof FarmNormsFieldSchema>[] = []

    if (year === "2025") {
      const normFunctions = services.createFunctionsForNorms("NL", "2025")
      const inputMap = await normFunctions.collectInputForNormsForFarm(
        fdm,
        principal.effectivePrincipalId,
        b_id_farm,
      )

      for (const [b_id, input] of inputMap) {
        const result = await calculateNormResults(fdm, normFunctions as never, input)
        fields.push({ b_id, ...result })
      }
    } else {
      const normFunctions = services.createFunctionsForNorms("NL", "2026")
      const inputMap = await normFunctions.collectInputForNormsForFarm(
        fdm,
        principal.effectivePrincipalId,
        b_id_farm,
      )

      for (const [b_id, input] of inputMap) {
        const result = await calculateNormResults(fdm, normFunctions as never, input)
        fields.push({ b_id, ...result })
      }
    }

    return { b_id_farm, year: Number.parseInt(year, 10), fields } as z.infer<typeof FarmNormsSchema>
  },
})

/** Calculates the Dutch nitrogen, manure and phosphate usage norms of a field. */
export const getFieldFertilizationNorms = defineOperation({
  name: "getFieldFertilizationNorms",
  kind: "read",
  bucket: "calc",
  input: CalculationFieldParamsSchema.extend(NormsYearQuerySchema.shape),
  output: FieldNormsSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CalculationServices>,
    { b_id, year },
  ) => {
    const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    if (!field) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }

    let nitrogen: z.infer<typeof NormResultSchema> | null = null
    let manure: z.infer<typeof NormResultSchema> | null = null
    let phosphate: z.infer<typeof NormResultSchema> | null = null

    if (year === "2025") {
      const normFunctions = services.createFunctionsForNorms("NL", "2025")
      const input = await normFunctions.collectInputForNorms(
        fdm,
        principal.effectivePrincipalId,
        b_id,
      )

      ;({ nitrogen, manure, phosphate } = await calculateNormResults(
        fdm,
        normFunctions as never,
        input,
      ))
    } else {
      const normFunctions = services.createFunctionsForNorms("NL", "2026")
      const input = await normFunctions.collectInputForNorms(
        fdm,
        principal.effectivePrincipalId,
        b_id,
      )

      ;({ nitrogen, manure, phosphate } = await calculateNormResults(
        fdm,
        normFunctions as never,
        input,
      ))
    }

    return {
      b_id,
      year: Number.parseInt(year, 10),
      nitrogen,
      manure,
      phosphate,
    } as z.infer<typeof FieldNormsSchema>
  },
})

/**
 * Returns the nutrient advice, the dose already applied and the remaining advice for every field
 * of a farm, for the main cultivation of a year. Calls the NMI nutrient advice service.
 *
 * @throws {ApiError} 503 when nutrient advice is not configured on this server.
 */
export const getFarmNutrientAdvice = defineOperation({
  name: "getFarmNutrientAdvice",
  kind: "read",
  bucket: "nmi",
  external: true,
  input: CalculationFarmParamsSchema.extend(NutrientAdviceYearQuerySchema.shape),
  output: FarmNutrientAdviceSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CalculationServices>,
    { b_id_farm, year },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const nmiApiKey = requireNmiApiKey(services)
    const yearNumber = Number.parseInt(year, 10)
    const timeframe = getYearTimeframe(yearNumber)

    const fields = await services.getFields(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      timeframe,
    )
    const rows = await services.getFarmNutrientAdviceRows({
      fdm,
      principal_id: principal.effectivePrincipalId,
      b_id_farm,
      year: yearNumber,
      timeframe,
      fields,
      nmiApiKey,
    })
    return {
      b_id_farm,
      year: yearNumber,
      hasErrors: rows.some((row) => row.error !== undefined),
      fields: rows.map(serialiseNutrientAdviceRow),
    } as z.infer<typeof FarmNutrientAdviceSchema>
  },
})

/**
 * Returns the nutrient advice, the dose already applied and the remaining advice for a field,
 * for the main cultivation of a year. Calls the NMI nutrient advice service.
 *
 * @throws {ApiError} 503 when nutrient advice is not configured on this server.
 */
export const getFieldNutrientAdvice = defineOperation({
  name: "getFieldNutrientAdvice",
  kind: "read",
  bucket: "nmi",
  external: true,
  input: CalculationFieldParamsSchema.extend(NutrientAdviceYearQuerySchema.shape),
  output: FieldNutrientAdviceSchema,
  run: async (
    { fdm, services, principal }: OperationContext<CalculationServices>,
    { b_id, year },
  ) => {
    const nmiApiKey = requireNmiApiKey(services)

    const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    if (!field) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }
    const yearNumber = Number.parseInt(year, 10)
    const [row] = await services.getFarmNutrientAdviceRows({
      fdm,
      principal_id: principal.effectivePrincipalId,
      b_id_farm: field.b_id_farm,
      year: yearNumber,
      timeframe: getYearTimeframe(yearNumber),
      fields: [field],
      nmiApiKey,
    })
    if (!row) {
      throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    }
    return serialiseNutrientAdviceRow(row) as z.infer<typeof FieldNutrientAdviceSchema>
  },
})
