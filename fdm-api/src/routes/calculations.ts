import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
  calculateNitrogenBalance,
  calculateOrganicMatterBalance,
  collectInputForNitrogenBalance,
  collectInputForOrganicMatterBalance,
  getDoseForField,
  getNitrogenBalanceField,
  getOrganicMatterBalanceField,
  NitrogenBalanceFieldNumeric,
  NitrogenBalanceNumeric,
} from "@nmi-agro/fdm-calculator"
import type { FdmType, getField } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import {
  // [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
  // NmiApiError,
  type createFunctionsForNorms,
  NormNotApplicableError,
  // getNutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import { commonErrorResponses, DateStringSchema } from "../schemas"

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/**
 * Defines the calculation functions required by the calculation routes.
 */
export interface CalculationServices {
  /** Looks up a single field (used to resolve b_id_farm for field-level calculations). */
  getField: typeof getField
  /** Collects all data needed to compute the nitrogen balance for a farm. */
  collectInputForNitrogenBalance: typeof collectInputForNitrogenBalance
  /** Computes the nitrogen balance for an entire farm from pre-collected input. */
  calculateNitrogenBalance: typeof calculateNitrogenBalance
  /** Computes the nitrogen balance for a single field using cached calculation. */
  getNitrogenBalanceField: typeof getNitrogenBalanceField
  /** Collects all data needed to compute the organic matter balance for a farm. */
  collectInputForOrganicMatterBalance: typeof collectInputForOrganicMatterBalance
  /** Computes the organic matter balance for an entire farm from pre-collected input. */
  calculateOrganicMatterBalance: typeof calculateOrganicMatterBalance
  /** Computes the organic matter balance for a single field using cached calculation. */
  getOrganicMatterBalanceField: typeof getOrganicMatterBalanceField
  /** Calculates the total NPK dose applied to a specific field. */
  getDoseForField: typeof getDoseForField
  // Norms & calculation functions
  createFunctionsForNorms: typeof createFunctionsForNorms
  // [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
  // getNutrientAdvice: typeof getNutrientAdvice
  // Additional FDM core data fetching
  getCultivations: typeof import("@nmi-agro/fdm-core").getCultivations
  getCurrentSoilData: typeof import("@nmi-agro/fdm-core").getCurrentSoilData
  getFertilizerApplications: typeof import("@nmi-agro/fdm-core").getFertilizerApplications
  getFertilizers: typeof import("@nmi-agro/fdm-core").getFertilizers
}

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

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

const TimeframeQuerySchema = z
  .object(TimeframeQueryShape)
  .refine(isTimeframeOrdered, timeframeOrderError)

const NitrogenBalanceQuerySchema = z
  .object({
    ...TimeframeQueryShape,
    effective_nitrogen: z
      .enum(["true", "false"])
      .optional()
      .describe(
        "When `true`, the supply by fertilizers is calculated with effective nitrogen (`p_n_rt * p_n_wc`) and the soil mineralization with the MINIP model. Nitrate leaching is still based on the surplus of the balance with total nitrogen. The target is only available for the balance with total nitrogen and is omitted from the response. Defaults to `false`.",
      ),
  })
  .refine(isTimeframeOrdered, timeframeOrderError)

const ApplicationValueSchema = z.object({
  id: z.string(),
  value: z.number(),
})

// ---------------------------------------------------------------------------
// Dose schema
// ---------------------------------------------------------------------------

const DoseSchema = z
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
  total: z.number(),
  applications: z.array(ApplicationValueSchema),
})

const NitrogenSupplyFertilizersSchema = z.object({
  total: z.number(),
  mineral: NitrogenFertilizersGroupSchema,
  manure: NitrogenFertilizersGroupSchema,
  compost: NitrogenFertilizersGroupSchema,
  other: NitrogenFertilizersGroupSchema,
})

const NitrogenSupplyFieldSchema = z.object({
  total: z.number(),
  fertilizers: NitrogenSupplyFertilizersSchema,
  fixation: z.object({
    total: z.number(),
    cultivations: z.array(ApplicationValueSchema),
  }),
  deposition: z.object({ total: z.number() }),
  mineralisation: z.object({
    total: z.number(),
  }),
})

const NitrogenRemovalFieldSchema = z.object({
  total: z.number(),
  harvests: z.object({
    total: z.number(),
    harvests: z.array(ApplicationValueSchema),
  }),
  residues: z.object({
    total: z.number(),
    cultivations: z.array(ApplicationValueSchema),
  }),
})

const NitrogenEmissionAmmoniaSchema = z.object({
  total: z.number(),
  fertilizers: z.record(z.string(), z.unknown()),
  residues: z.object({
    total: z.number(),
    cultivations: z.array(ApplicationValueSchema),
  }),
})

const NitrogenEmissionFieldSchema = z.object({
  total: z.number(),
  ammonia: NitrogenEmissionAmmoniaSchema,
  nitrate: z.object({ total: z.number() }),
})

const NitrogenBalanceFieldResultSchema = z
  .object({
    b_id: z.string(),
    b_area: z.number(),
    b_bufferstrip: z.boolean().optional(),
    balance: z
      .object({
        b_id: z.string(),
        balance: z.number().describe("kg N/ha"),
        supply: NitrogenSupplyFieldSchema,
        removal: NitrogenRemovalFieldSchema,
        emission: NitrogenEmissionFieldSchema,
        target: z
          .number()
          .optional()
          .describe("Target nitrogen balance in kg N/ha. Omitted when `effective_nitrogen=true`."),
      })
      .optional(),
    errorMessage: z.string().optional(),
  })
  .openapi("NitrogenBalanceFieldResult")

const NitrogenBalanceSchema = z
  .object({
    balance: z.number().describe("Weighted average nitrogen balance across all fields in kg N/ha"),
    supply: z.object({
      total: z.number(),
      deposition: z.number(),
      fixation: z.number(),
      mineralisation: z.number(),
      fertilizers: z.object({
        total: z.number(),
        mineral: z.number(),
        manure: z.number(),
        compost: z.number(),
        other: z.number(),
      }),
    }),
    removal: z.object({
      total: z.number(),
      harvests: z.number(),
      residues: z.number(),
    }),
    emission: z.object({
      total: z.number(),
      ammonia: z.object({
        total: z.number(),
        fertilizers: z.record(z.string(), z.unknown()),
        residues: z.number(),
      }),
      nitrate: z.number(),
    }),
    target: z
      .number()
      .optional()
      .describe(
        "Weighted average target nitrogen balance in kg N/ha. Omitted when `effective_nitrogen=true`.",
      ),
    fields: z.array(NitrogenBalanceFieldResultSchema),
    hasErrors: z.boolean(),
    fieldErrorMessages: z.array(z.string()),
  })
  .openapi("NitrogenBalance")

// ---------------------------------------------------------------------------
// Organic matter balance schemas
// ---------------------------------------------------------------------------

const OrganicMatterApplicationValueSchema = z.object({
  id: z.string(),
  value: z.number(),
})

const OrganicMatterBalanceFieldResultSchema = z
  .object({
    b_id: z.string(),
    b_area: z.number(),
    b_bufferstrip: z.boolean().optional(),
    balance: z
      .object({
        b_id: z.string(),
        balance: z.number().describe("kg EOM/ha/year"),
        supply: z.object({
          total: z.number(),
          fertilizers: z.object({
            total: z.number(),
            manure: z.object({
              total: z.number(),
              applications: z.array(OrganicMatterApplicationValueSchema),
            }),
            compost: z.object({
              total: z.number(),
              applications: z.array(OrganicMatterApplicationValueSchema),
            }),
            other: z.object({
              total: z.number(),
              applications: z.array(OrganicMatterApplicationValueSchema),
            }),
          }),
          cultivations: z.object({
            total: z.number(),
            cultivations: z.array(OrganicMatterApplicationValueSchema),
          }),
          residues: z.object({
            total: z.number(),
            cultivations: z.array(OrganicMatterApplicationValueSchema),
          }),
        }),
        degradation: z.object({ total: z.number() }),
      })
      .optional(),
    errorMessage: z.string().optional(),
  })
  .openapi("OrganicMatterBalanceFieldResult")

const OrganicMatterBalanceSchema = z
  .object({
    balance: z
      .number()
      .describe("Weighted average organic matter balance across all fields in kg EOM/ha/year"),
    supply: z.number().describe("Weighted average EOM supply in kg EOM/ha/year"),
    degradation: z.number().describe("Weighted average SOM degradation in kg EOM/ha/year"),
    fields: z.array(OrganicMatterBalanceFieldResultSchema),
    hasErrors: z.boolean(),
    fieldErrorMessages: z.array(z.string()),
  })
  .openapi("OrganicMatterBalance")

// ---------------------------------------------------------------------------
// Norms schemas
// ---------------------------------------------------------------------------

const NormResultSchema = z.object({
  normValue: z.number().describe("Norm value in kg/ha"),
  normSource: z.string().describe("Source or category used to determine the norm"),
})

const FieldNormsSchema = z
  .object({
    b_id: z.string(),
    year: z.number().int(),
    nitrogen: NormResultSchema.nullable().describe("Nitrogen usage norm (kg N/ha)"),
    manure: NormResultSchema.nullable().describe("Manure usage norm (kg N/ha from animal manure)"),
    phosphate: NormResultSchema.nullable().describe("Phosphate usage norm (kg P2O5/ha)"),
  })
  .openapi("FieldNorms")

const FarmNormsFieldSchema = z.object({
  b_id: z.string(),
  nitrogen: NormResultSchema.nullable(),
  manure: NormResultSchema.nullable(),
  phosphate: NormResultSchema.nullable(),
})

const FarmNormsSchema = z
  .object({
    b_id_farm: z.string(),
    year: z.number().int(),
    fields: z.array(FarmNormsFieldSchema),
  })
  .openapi("FarmNorms")

// ---------------------------------------------------------------------------
// Nutrient advice schema
// ---------------------------------------------------------------------------

// [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
// const NutrientAdviceSchema = z
//     .object({
//         b_id: z.string(),
//         d_n_req: z.number().describe("Nitrogen requirement (kg N/ha)"),
//         d_n_norm: z.number().describe("Nitrogen norm (kg N/ha)"),
//         d_n_norm_man: z.number().describe("Nitrogen norm from animal manure (kg N/ha)"),
//         d_p_norm: z.number().describe("Phosphate norm (kg P2O5/ha)"),
//         d_p_req: z.number().describe("Phosphate requirement (kg P2O5/ha)"),
//         d_k_req: z.number().describe("Potassium requirement (kg K2O/ha)"),
//         d_c_req: z.number().describe("Carbon requirement (kg C/ha)"),
//         d_ca_req: z.number().describe("Calcium requirement (kg Ca/ha)"),
//         d_s_req: z.number().describe("Sulfur requirement (kg S/ha)"),
//         d_mg_req: z.number().describe("Magnesium requirement (kg Mg/ha)"),
//         d_cu_req: z.number().describe("Copper requirement (kg Cu/ha)"),
//         d_zn_req: z.number().describe("Zinc requirement (kg Zn/ha)"),
//         d_co_req: z.number().describe("Cobalt requirement (kg Co/ha)"),
//         d_mn_req: z.number().describe("Manganese requirement (kg Mn/ha)"),
//         d_mo_req: z.number().describe("Molybdenum requirement (kg Mo/ha)"),
//         d_na_req: z.number().describe("Sodium requirement (kg Na/ha)"),
//         d_b_req: z.number().describe("Boron requirement (kg B/ha)"),
//     })
//     .openapi("NutrientAdvice")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Removes the target from a nitrogen balance. The target only applies to the balance with total
 * nitrogen, so it is omitted from the balance with effective nitrogen.
 */
function omitTarget(
  balance: NitrogenBalanceFieldNumeric,
): Omit<NitrogenBalanceFieldNumeric, "target"> {
  const { target: _target, ...rest } = balance
  return rest
}

/**
 * Removes the target from a farm nitrogen balance and from the balance of each of its fields.
 */
function omitNitrogenBalanceTargets(result: NitrogenBalanceNumeric) {
  const { target: _target, fields, ...rest } = result
  return {
    ...rest,
    fields: fields.map((field) =>
      field.balance ? { ...field, balance: omitTarget(field.balance) } : field,
    ),
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const farmNitrogenBalanceRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/calculations/nitrogen-balance",
  summary: "Calculate nitrogen balance for a farm",
  description:
    "Computes the weighted-average nitrogen balance across all fields for the given farm and timeframe. Set `effective_nitrogen=true` for the balance with effective nitrogen. All values in kg N/ha.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: z.string() }),
    query: NitrogenBalanceQuerySchema,
  },
  responses: {
    200: {
      description: "Nitrogen balance result",
      content: { "application/json": { schema: NitrogenBalanceSchema } },
    },
    ...commonErrorResponses,
  },
})

const farmOrganicMatterBalanceRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/calculations/organic-matter-balance",
  summary: "Calculate organic matter balance for a farm",
  description:
    "Computes the weighted-average organic matter balance across all fields for the given farm and timeframe. All values in kg EOM/ha/year.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: z.string() }),
    query: TimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "Organic matter balance result",
      content: {
        "application/json": { schema: OrganicMatterBalanceSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const fieldNitrogenBalanceRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/calculations/nitrogen-balance",
  summary: "Calculate nitrogen balance for a field",
  description:
    "Computes the nitrogen balance for a single field for the given timeframe. Set `effective_nitrogen=true` for the balance with effective nitrogen. All values in kg N/ha.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: z.string() }),
    query: NitrogenBalanceQuerySchema,
  },
  responses: {
    200: {
      description: "Field nitrogen balance result",
      content: {
        "application/json": {
          schema: NitrogenBalanceFieldResultSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
})

const fieldOrganicMatterBalanceRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/calculations/organic-matter-balance",
  summary: "Calculate organic matter balance for a field",
  description:
    "Computes the organic matter balance for a single field for the given timeframe. All values in kg EOM/ha/year.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: z.string() }),
    query: TimeframeQuerySchema,
  },
  responses: {
    200: {
      description: "Field organic matter balance result",
      content: {
        "application/json": {
          schema: OrganicMatterBalanceFieldResultSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
})

const fieldDoseRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/calculations/dose",
  summary: "Calculate fertilizer dose for a field",
  description:
    "Computes the total NPK and micro-nutrient doses applied to a specific field based on all recorded fertilizer applications.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: z.string() }),
  },
  responses: {
    200: {
      description: "Dose result",
      content: { "application/json": { schema: DoseSchema } },
    },
    ...commonErrorResponses,
  },
})

const YearQuerySchema = z.object({
  year: z
    .enum(["2025", "2026"])
    .default("2026")
    .describe("Calendar year. Only 2025 and 2026 are currently supported for norms."),
})

const farmNormsRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/calculations/norms",
  summary: "Calculate usage norms for all fields on a farm",
  description:
    "Computes the NL nitrogen, manure, and phosphate usage norms per field for the given calendar year. Only years 2025 and 2026 are currently supported.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id_farm: z.string() }),
    query: YearQuerySchema,
  },
  responses: {
    200: {
      description: "Farm usage norms",
      content: { "application/json": { schema: FarmNormsSchema } },
    },
    ...commonErrorResponses,
  },
})

const fieldNormsRoute = createRoute({
  method: "get",
  path: "/fields/{b_id}/calculations/norms",
  summary: "Calculate usage norms for a field",
  description:
    "Computes the NL nitrogen, manure, and phosphate usage norms for the given field and calendar year. Only years 2025 and 2026 are currently supported.",
  tags: ["Calculations"],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: z.object({ b_id: z.string() }),
    query: YearQuerySchema,
  },
  responses: {
    200: {
      description: "Field usage norms",
      content: { "application/json": { schema: FieldNormsSchema } },
    },
    ...commonErrorResponses,
  },
})

// [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
// const fieldNutrientAdviceRoute = createRoute({
//     method: "get",
//     path: "/fields/{b_id}/calculations/nutrient-advice",
//     summary: "Get nutrient advice for a field",
//     description:
//         "Returns AI-powered NPK and micro-nutrient recommendations for the field based on current soil data and cultivation. Requires NMI API key to be configured on the server.",
//     tags: ["Calculations"],
//     security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
//     request: {
//         params: z.object({ b_id: z.string() }),
//     },
//     responses: {
//         200: {
//             description: "Nutrient advice",
//             content: { "application/json": { schema: NutrientAdviceSchema } },
//         },
//         ...commonErrorResponses,
//     },
// })

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

// [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
// /** Converts an NmiApiError into an ApiError with appropriate HTTP status. */
// function toApiError(err: unknown): never {
//     if (err instanceof NmiApiError) {
//         if (err.status === 422) {
//             throw new ApiError(422, "unprocessable-entity", err.message)
//         }
//         if (err.status === 408) {
//             throw new ApiError(504, "gateway-timeout", err.message)
//         }
//         if (err.status === 503) {
//             throw new ApiError(503, "service-unavailable", err.message)
//         }
//         throw new ApiError(502, "bad-gateway", err.message)
//     }
//     throw err
// }

// ---------------------------------------------------------------------------
// registerCalculationRoutes
// ---------------------------------------------------------------------------

/**
 * Registers the calculation endpoints on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Calculation service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerCalculationRoutes(app, fdm, services)
 * ```
 */
export function registerCalculationRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: CalculationServices,
): void {
  // Use the "calc" rate bucket (10 req/min) for all calculation endpoints.
  // These paths are narrow enough to avoid double-counting with farm/field middleware.
  app.use("/farms/:b_id_farm/calculations/*", (c, next) =>
    rateLimitMiddleware(fdm, "calc")(c, next),
  )
  app.use("/fields/:b_id/calculations/*", (c, next) => rateLimitMiddleware(fdm, "calc")(c, next))

  // --- Farm-level nitrogen balance ---
  const farmNitrogenBalanceHandler: RouteHandler<typeof farmNitrogenBalanceRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { start, end, effective_nitrogen } = c.req.valid("query") as {
      start: string
      end: string
      effective_nitrogen?: "true" | "false"
    }
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
    return c.json(
      (useEffectiveNitrogen ? omitNitrogenBalanceTargets(result) : result) as z.infer<
        typeof NitrogenBalanceSchema
      >,
      200,
    )
  }

  // --- Farm-level organic matter balance ---
  const farmOrganicMatterBalanceHandler: RouteHandler<
    typeof farmOrganicMatterBalanceRoute
  > = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { start, end } = c.req.valid("query") as {
      start: string
      end: string
    }

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
    return c.json(result as z.infer<typeof OrganicMatterBalanceSchema>, 200)
  }

  // --- Field-level nitrogen balance ---
  const fieldNitrogenBalanceHandler: RouteHandler<typeof fieldNitrogenBalanceRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { start, end, effective_nitrogen } = c.req.valid("query") as {
      start: string
      end: string
      effective_nitrogen?: "true" | "false"
    }
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
    const balance = await services.getNitrogenBalanceField(fdm, {
      fieldInput,
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: {
        start: input.timeFrame.start as Date,
        end: input.timeFrame.end as Date,
      },
      useEffectiveNitrogen,
    })

    return c.json(
      {
        b_id: fieldInput.field.b_id,
        b_area: fieldInput.field.b_area ?? 0,
        b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
        balance: useEffectiveNitrogen ? omitTarget(balance) : balance,
      } as z.infer<typeof NitrogenBalanceFieldResultSchema>,
      200,
    )
  }

  // --- Field-level organic matter balance ---
  const fieldOrganicMatterBalanceHandler: RouteHandler<
    typeof fieldOrganicMatterBalanceRoute
  > = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { start, end } = c.req.valid("query") as {
      start: string
      end: string
    }

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
    const balance = await services.getOrganicMatterBalanceField(fdm, {
      fieldInput,
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: {
        start: input.timeFrame.start as Date,
        end: input.timeFrame.end as Date,
      },
    })

    return c.json(
      {
        b_id: fieldInput.field.b_id,
        b_area: fieldInput.field.b_area ?? 0,
        b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
        balance,
      } as z.infer<typeof OrganicMatterBalanceFieldResultSchema>,
      200,
    )
  }

  // --- Field-level dose ---
  const fieldDoseHandler: RouteHandler<typeof fieldDoseRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }

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
    return c.json(dose as z.infer<typeof DoseSchema>, 200)
  }

  const farmNormsHandler: RouteHandler<typeof farmNormsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { year } = c.req.valid("query") as { year: string }

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

    return c.json(
      { b_id_farm, year: Number.parseInt(year, 10), fields } as z.infer<typeof FarmNormsSchema>,
      200,
    )
  }

  const fieldNormsHandler: RouteHandler<typeof fieldNormsRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id } = c.req.valid("param") as { b_id: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { year } = c.req.valid("query") as { year: string }

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

    return c.json(
      {
        b_id,
        year: Number.parseInt(year, 10),
        nitrogen,
        manure,
        phosphate,
      } as z.infer<typeof FieldNormsSchema>,
      200,
    )
  }

  // [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
  // const fieldNutrientAdviceHandler: RouteHandler<typeof fieldNutrientAdviceRoute> = async (c) => {
  //     const principal = c.get("principal") as unknown as ApiPrincipalContext
  //     // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
  //     const { b_id } = c.req.valid("param") as { b_id: string }
  //
  //     const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
  //     if (!field) {
  //         throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
  //     }
  //
  //     if (!field.b_centroid && !field.b_bufferstrip) {
  //         throw new ApiError(422, "unprocessable-entity", `Field '${b_id}' has no centroid coordinates.`)
  //     }
  //
  //     const nmiApiKey = process.env.NMI_API_KEY
  //     if (!nmiApiKey && !field.b_bufferstrip) {
  //         throw new ApiError(503, "service-unavailable", "NMI API key is not configured on this server.")
  //     }
  //
  //     const [cultivations, soilData] = await Promise.all([
  //         services.getCultivations(fdm, principal.effectivePrincipalId, b_id),
  //         services.getCurrentSoilData(fdm, principal.effectivePrincipalId, b_id),
  //     ])
  //
  //     const b_lu_catalogue = cultivations[0]?.b_lu_catalogue ?? ""
  //
  //     try {
  //         const advice = await services.getNutrientAdvice(fdm, {
  //             b_lu_catalogue,
  //             b_centroid: field.b_centroid as [number, number],
  //             currentSoilData: soilData as Parameters<typeof services.getNutrientAdvice>[1]["currentSoilData"],
  //             nmiApiKey: nmiApiKey ?? "",
  //             b_bufferstrip: field.b_bufferstrip ?? false,
  //         })
  //         return c.json({ b_id, ...advice } as z.infer<typeof NutrientAdviceSchema>, 200)
  //     } catch (err) {
  //         toApiError(err)
  //     }
  // }

  app.openapi(farmNitrogenBalanceRoute, farmNitrogenBalanceHandler)
  app.openapi(farmOrganicMatterBalanceRoute, farmOrganicMatterBalanceHandler)
  app.openapi(fieldNitrogenBalanceRoute, fieldNitrogenBalanceHandler)
  app.openapi(fieldOrganicMatterBalanceRoute, fieldOrganicMatterBalanceHandler)
  app.openapi(fieldDoseRoute, fieldDoseHandler)
  app.openapi(farmNormsRoute, farmNormsHandler)
  app.openapi(fieldNormsRoute, fieldNormsHandler)
  // [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
  // app.openapi(fieldNutrientAdviceRoute, fieldNutrientAdviceHandler)
}
