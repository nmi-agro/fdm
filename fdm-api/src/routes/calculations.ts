import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import {
    // [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
    // NmiApiError,
    // [MINERALIZATION: disabled — behind feature flag in fdm-app]
    // assessDataCompleteness,
    // buildDynaRequest,
    // buildNSupplyRequest,
    createFunctionsForNorms,
    // getDyna,
    // getNSupply,
    // getNutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import type {
    calculateNitrogenBalance,
    calculateOrganicMatterBalance,
    collectInputForNitrogenBalance,
    collectInputForOrganicMatterBalance,
    getDoseForField,
    getNitrogenBalanceField,
    getOrganicMatterBalanceField,
} from "@nmi-agro/fdm-calculator"
import type { getField } from "@nmi-agro/fdm-core"
// [MINERALIZATION: disabled — behind feature flag in fdm-app]
// import {
//     getCultivationsFromCatalogue,
//     getGrazingIntention,
//     getHarvestsForFarm,
// } from "@nmi-agro/fdm-core"
import type { FdmType } from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import type { ApiEnv, ApiPrincipalContext } from "../types"
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
    // [MINERALIZATION: disabled — behind feature flag in fdm-app]
    // buildNSupplyRequest: typeof buildNSupplyRequest
    // assessDataCompleteness: typeof assessDataCompleteness
    // getNSupply: typeof getNSupply
    // buildDynaRequest: typeof buildDynaRequest
    // getDyna: typeof getDyna
    // Additional FDM core data fetching
    getCultivations: typeof import("@nmi-agro/fdm-core").getCultivations
    getCurrentSoilData: typeof import("@nmi-agro/fdm-core").getCurrentSoilData
    getFertilizerApplications: typeof import("@nmi-agro/fdm-core").getFertilizerApplications
    getFertilizers: typeof import("@nmi-agro/fdm-core").getFertilizers
    // [MINERALIZATION: disabled — behind feature flag in fdm-app]
    // getCultivationsFromCatalogue: typeof getCultivationsFromCatalogue
    // getHarvestsForFarm: typeof getHarvestsForFarm
    // getGrazingIntention: typeof getGrazingIntention
}

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const TimeframeQuerySchema = z
    .object({
        start: DateStringSchema
            .describe("Inclusive start date in YYYY-MM-DD format."),
        end: DateStringSchema
            .describe("Inclusive end date in YYYY-MM-DD format."),
    })
    .refine((d) => new Date(d.start) <= new Date(d.end), {
        message: "start must be before or equal to end",
        path: ["end"],
    })

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
        p_dose_nw: z
            .number()
            .describe("Workable nitrogen (Nw) dose in kg/ha"),
        p_dose_p: z.number().describe("Phosphate (P2O5) dose in kg/ha"),
        p_dose_k: z.number().describe("Potassium (K2O) dose in kg/ha"),
        p_dose_eoc: z
            .number()
            .describe("Effective organic carbon (EOC) dose in kg/ha"),
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
                target: z.number().describe("Target nitrogen balance in kg N/ha"),
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
        target: z.number().describe("Weighted average target nitrogen balance in kg N/ha"),
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

// [MINERALIZATION: disabled — behind feature flag in fdm-app]
// const NSupplyDataPointSchema = z.object({
//     doy: z.number().int().describe("Day of year (1–366)"),
//     d_n_supply_actual: z.number().describe("Cumulative mineralised N to this DOY (kg N/ha)"),
// })
//
// const DataCompletenessSchema = z.object({
//     available: z.array(
//         z.object({
//             param: z.string(),
//             value: z.union([z.number(), z.string()]),
//             source: z.string().optional(),
//             date: z.string().datetime().optional(),
//         }),
//     ),
//     missing: z.array(z.string()),
//     estimated: z.array(z.string()),
//     score: z.number().int().describe("Completeness score from 0 to 100"),
// })
//
// const NSupplyResultSchema = z
//     .object({
//         b_id: z.string(),
//         b_name: z.string(),
//         area: z.number().describe("Field area in ha"),
//         method: z.enum(["minip", "pmn", "century"]).describe("Mineralization model used"),
//         totalAnnualN: z.number().describe("Total annual N mineralised (kg N/ha/yr)"),
//         data: z.array(NSupplyDataPointSchema).describe("Daily cumulative N supply curve"),
//         completeness: DataCompletenessSchema,
//     })
//     .openapi("NSupplyResult")
//
// const DynaDailyPointSchema = z.object({
//     b_date_calculation: z.string().describe("Calendar date (ISO 8601)"),
//     b_nw: z.number().describe("Simulated N availability — central estimate (kg N/ha)"),
//     b_nw_min: z.number(),
//     b_nw_max: z.number(),
//     b_nw_recommended: z.number().nullable(),
//     b_n_uptake: z.number().nullable().describe("Cumulative N uptake (kg N/ha)"),
//     b_n_uptake_min: z.number(),
//     b_n_uptake_max: z.number(),
//     b_n_uptake_recommended: z.number(),
//     b_no3_leach: z.number().nullable().describe("Cumulative NO₃ leaching (kg NO₃/ha)"),
//     b_no3_leach_min: z.number(),
//     b_no3_leach_max: z.number(),
//     b_no3_leach_recommended: z.number(),
// })
//
// const DynaNitrogenBalanceSchema = z.object({
//     b_nw: z.number().describe("Total N supply (kg N/ha)"),
//     b_n_uptake: z.number().describe("Total N uptake (kg N/ha)"),
//     b_n_greenmanure: z.number().describe("N from green manure incorporation (kg N/ha)"),
//     b_n_fertilizer_organic: z.number().describe("N from organic fertilizers (kg N/ha)"),
//     b_n_fertilizer_artificial: z.number().describe("N from mineral fertilizers (kg N/ha)"),
//     b_n_fertilizer_preceeding: z.number().describe("N carry-over from preceding crop (kg N/ha)"),
// })
//
// const DynaFertilizerAdviceSchema = z.object({
//     b_n_recommended: z.number().describe("Recommended N dose (kg N/ha)"),
//     b_date_recommended: z.string().describe("Recommended application date (ISO 8601)"),
//     b_n_remaining: z.number().describe("N remaining after applying recommendation (kg N/ha)"),
// })
//
// const DynaResultSchema = z
//     .object({
//         b_id: z.string(),
//         calculationDyna: z.array(DynaDailyPointSchema).describe("Daily simulation points"),
//         nitrogenBalance: DynaNitrogenBalanceSchema,
//         fertilizingRecommendations: DynaFertilizerAdviceSchema.nullable(),
//         harvestingRecommendation: z
//             .object({ b_date_harvest: z.string() })
//             .nullable(),
//     })
//     .openapi("DynaResult")

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const farmNitrogenBalanceRoute = createRoute({
    method: "get",
    path: "/farms/{b_id_farm}/calculations/nitrogen-balance",
    summary: "Calculate nitrogen balance for a farm",
    description:
        "Computes the weighted-average nitrogen balance across all fields for the given farm and timeframe. All values in kg N/ha.",
    tags: ["Calculations"],
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_farm: z.string() }),
        query: TimeframeQuerySchema,
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
        "Computes the nitrogen balance for a single field for the given timeframe. All values in kg N/ha.",
    tags: ["Calculations"],
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id: z.string() }),
        query: TimeframeQuerySchema,
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
        .string()
        .regex(/^\d{4}$/, "Must be a 4-digit year")
        .default(new Date().getFullYear().toString())
        .describe("Calendar year, e.g. 2025. Only 2025 and 2026 are supported for norms."),
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

// [MINERALIZATION: disabled — behind feature flag in fdm-app]
// const NSupplyQuerySchema = YearQuerySchema.extend({
//     method: z
//         .enum(["minip", "pmn", "century"])
//         .default("minip")
//         .describe("Mineralization model: minip (organic matter), pmn (incubation), century (carbon cycling)"),
// })
//
// const fieldNSupplyRoute = createRoute({
//     method: "get",
//     path: "/fields/{b_id}/calculations/nsupply",
//     summary: "Calculate nitrogen mineralization curve for a field",
//     description:
//         "Computes the daily cumulative nitrogen supply (N mineralization) curve for the field using the chosen model. Requires NMI API key to be configured on the server.",
//     tags: ["Calculations"],
//     security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
//     request: {
//         params: z.object({ b_id: z.string() }),
//         query: NSupplyQuerySchema,
//     },
//     responses: {
//         200: {
//             description: "N-Supply curve",
//             content: { "application/json": { schema: NSupplyResultSchema } },
//         },
//         ...commonErrorResponses,
//     },
// })
//
// const fieldDynaRoute = createRoute({
//     method: "get",
//     path: "/fields/{b_id}/calculations/dyna",
//     summary: "Run DYNA nitrogen advice simulation for a field",
//     description:
//         "Simulates daily nitrogen dynamics through the growing season for the field, combining soil N supply, crop uptake, fertilizer releases, and leaching. Returns a fertilizer dose/timing recommendation. Requires NMI API key to be configured on the server.",
//     tags: ["Calculations"],
//     security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
//     request: {
//         params: z.object({ b_id: z.string() }),
//         query: YearQuerySchema,
//     },
//     responses: {
//         200: {
//             description: "DYNA simulation result",
//             content: { "application/json": { schema: DynaResultSchema } },
//         },
//         ...commonErrorResponses,
//     },
// })

async function calculateNormResults(
    fdm: FdmType,
    normFunctions: {
        calculateNormForNitrogen: (fdm: FdmType, input: unknown) => Promise<z.infer<typeof NormResultSchema>>
        calculateNormForManure: (fdm: FdmType, input: unknown) => Promise<z.infer<typeof NormResultSchema>>
        calculateNormForPhosphate: (fdm: FdmType, input: unknown) => Promise<z.infer<typeof NormResultSchema>>
    },
    input: unknown,
) {
    const [nitrogen, manure, phosphate] = await Promise.all([
        normFunctions.calculateNormForNitrogen(fdm, input).catch(() => null),
        normFunctions.calculateNormForManure(fdm, input).catch(() => null),
        normFunctions.calculateNormForPhosphate(fdm, input).catch(() => null),
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
    app.use("/fields/:b_id/calculations/*", (c, next) =>
        rateLimitMiddleware(fdm, "calc")(c, next),
    )

    // --- Farm-level nitrogen balance ---
    const farmNitrogenBalanceHandler: RouteHandler<
        typeof farmNitrogenBalanceRoute
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
        const input = await services.collectInputForNitrogenBalance(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
            timeframe,
        )
        const result = await services.calculateNitrogenBalance(fdm, input)
        return c.json(result as z.infer<typeof NitrogenBalanceSchema>, 200)
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
            timeFrame: { start: input.timeFrame.start as Date, end: input.timeFrame.end as Date },
        })
        return c.json(
            result as z.infer<typeof OrganicMatterBalanceSchema>,
            200,
        )
    }

    // --- Field-level nitrogen balance ---
    const fieldNitrogenBalanceHandler: RouteHandler<
        typeof fieldNitrogenBalanceRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { start, end } = c.req.valid("query") as {
            start: string
            end: string
        }

        const field = await services.getField(
            fdm,
            principal.effectivePrincipalId,
            b_id,
        )
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
        })

        return c.json(
            {
                b_id: fieldInput.field.b_id,
                b_area: fieldInput.field.b_area ?? 0,
                b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
                balance,
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

        const field = await services.getField(
            fdm,
            principal.effectivePrincipalId,
            b_id,
        )
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
        const field = await services.getField(
            fdm,
            principal.effectivePrincipalId,
            b_id,
        )
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

        if (!["2025", "2026"].includes(year)) {
            throw new ApiError(400, "validation-failed", "Only years 2025 and 2026 are currently supported.")
        }

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
            { b_id_farm, year: Number.parseInt(year), fields } as z.infer<typeof FarmNormsSchema>,
            200,
        )
    }

    const fieldNormsHandler: RouteHandler<typeof fieldNormsRoute> = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { year } = c.req.valid("query") as { year: string }

        if (!["2025", "2026"].includes(year)) {
            throw new ApiError(400, "validation-failed", "Only years 2025 and 2026 are currently supported.")
        }

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
                year: Number.parseInt(year),
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

    // [MINERALIZATION: disabled — behind feature flag in fdm-app]
    // const fieldNSupplyHandler: RouteHandler<typeof fieldNSupplyRoute> = async (c) => {
    //     const principal = c.get("principal") as unknown as ApiPrincipalContext
    //     // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    //     const { b_id } = c.req.valid("param") as { b_id: string }
    //     // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    //     const { year, method } = c.req.valid("query") as {
    //         year: string
    //         method: "minip" | "pmn" | "century"
    //     }
    //     const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    //     if (!field) throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    //     const nmiApiKey = process.env.NMI_API_KEY
    //     if (!nmiApiKey) throw new ApiError(503, "service-unavailable", "NMI API key is not configured on this server.")
    //     const yearNum = Number.parseInt(year)
    //     const timeframe = { start: new Date(yearNum, 0, 1), end: new Date(yearNum, 11, 31) }
    //     const [soilDataArray, cultivations] = await Promise.all([
    //         services.getCurrentSoilData(fdm, principal.effectivePrincipalId, b_id),
    //         services.getCultivations(fdm, principal.effectivePrincipalId, b_id),
    //     ])
    //     const soilData: Record<string, number | string | null | undefined> = {}
    //     const soilMeta: Record<string, { source?: string; date?: Date }> = {}
    //     for (const entry of soilDataArray) {
    //         if (entry.parameter && entry.value !== undefined) {
    //             soilData[entry.parameter] = entry.value as number | string | null | undefined
    //             soilMeta[entry.parameter] = { source: entry.a_source ?? undefined, date: entry.b_sampling_date ?? undefined }
    //         }
    //     }
    //     const somEntry = soilDataArray.find((e) => e.parameter === "a_som_loi")
    //     const anyEntry = soilDataArray[0]
    //     if (somEntry && "a_depth_lower" in somEntry && somEntry.a_depth_lower !== undefined)
    //         soilData.a_depth_lower = somEntry.a_depth_lower as number
    //     else if (anyEntry && "a_depth_lower" in anyEntry && anyEntry.a_depth_lower !== undefined)
    //         soilData.a_depth_lower = anyEntry.a_depth_lower as number
    //     const completeness = services.assessDataCompleteness(soilData, method, soilMeta)
    //     const requestBody = services.buildNSupplyRequest(field, soilData, cultivations, method, timeframe)
    //     try {
    //         const result = await services.getNSupply(fdm, {
    //             b_id, b_name: field.b_name ?? b_id, area: field.b_area ?? 0,
    //             nmiApiKey, requestBody, method, completeness,
    //             cacheDate: new Date().toLocaleDateString("en-CA"),
    //         })
    //         return c.json(result as z.infer<typeof NSupplyResultSchema>, 200)
    //     } catch (err) { toApiError(err) }
    // }
    //
    // const fieldDynaHandler: RouteHandler<typeof fieldDynaRoute> = async (c) => {
    //     const principal = c.get("principal") as unknown as ApiPrincipalContext
    //     // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    //     const { b_id } = c.req.valid("param") as { b_id: string }
    //     // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    //     const { year } = c.req.valid("query") as { year: string }
    //     const field = await services.getField(fdm, principal.effectivePrincipalId, b_id)
    //     if (!field) throw new ApiError(404, "not-found", `Field '${b_id}' not found.`)
    //     const nmiApiKey = process.env.NMI_API_KEY
    //     if (!nmiApiKey) throw new ApiError(503, "service-unavailable", "NMI API key is not configured on this server.")
    //     const yearNum = Number.parseInt(year)
    //     const timeframe = { start: new Date(yearNum, 0, 1), end: new Date(yearNum, 11, 31) }
    //     const isGrazing = await services.getGrazingIntention(fdm, principal.effectivePrincipalId, field.b_id_farm, yearNum)
    //     const farmSector = isGrazing ? "dairy" : "arable"
    //     const [soilDataArray, cultivations, catalogueEntries, harvestsMap, applications] = await Promise.all([
    //         services.getCurrentSoilData(fdm, principal.effectivePrincipalId, b_id),
    //         services.getCultivations(fdm, principal.effectivePrincipalId, b_id),
    //         services.getCultivationsFromCatalogue(fdm, principal.effectivePrincipalId, field.b_id_farm),
    //         services.getHarvestsForFarm(fdm, principal.effectivePrincipalId, field.b_id_farm, timeframe),
    //         services.getFertilizerApplications(fdm, principal.effectivePrincipalId, b_id, timeframe),
    //     ])
    //     const fertilizers = await services.getFertilizers(fdm, principal.effectivePrincipalId, field.b_id_farm)
    //     const fertilizerMap = new Map(fertilizers.map((f) => [f.p_id, f] as const))
    //     const soilData: Record<string, number | string | null | undefined> = {}
    //     for (const entry of soilDataArray) {
    //         if (entry.parameter && entry.value !== undefined)
    //             soilData[entry.parameter] = entry.value as number | string | null | undefined
    //     }
    //     const somEntry = soilDataArray.find((e) => e.parameter === "a_som_loi")
    //     const anyEntry = soilDataArray[0]
    //     if (somEntry && "a_depth_lower" in somEntry && somEntry.a_depth_lower !== undefined)
    //         soilData.a_depth_lower = somEntry.a_depth_lower as number
    //     else if (anyEntry && "a_depth_lower" in anyEntry && anyEntry.a_depth_lower !== undefined)
    //         soilData.a_depth_lower = anyEntry.a_depth_lower as number
    //     const dynaFertilizers = applications.map((app) => {
    //         const props = fertilizerMap.get(app.p_id)
    //         return { p_id: app.p_id, p_n_rt: props?.p_n_rt ?? null, p_n_if: props?.p_n_if ?? null,
    //             p_n_of: props?.p_n_of ?? null, p_n_wc: props?.p_n_wc ?? null, p_p_rt: props?.p_p_rt ?? null,
    //             p_k_rt: props?.p_k_rt ?? null, p_dm: props?.p_dm ?? null, p_om: props?.p_om ?? null,
    //             p_date: app.p_app_date ?? null, p_dose: app.p_app_amount ?? 0, p_app_method: app.p_app_method ?? null }
    //     })
    //     const cultivationCodes = new Set(cultivations.map((c) => c.b_lu_catalogue).filter((code): code is string => Boolean(code)))
    //     const cropProperties = catalogueEntries
    //         .filter((e) => e.b_lu_catalogue && cultivationCodes.has(e.b_lu_catalogue))
    //         .map((e) => ({ b_lu_catalogue: e.b_lu_catalogue, b_lu_yield: e.b_lu_yield ?? null,
    //             b_lu_n_harvestable: e.b_lu_n_harvestable ?? null, b_lu_n_residue: e.b_lu_n_residue ?? null }))
    //     const fieldHarvestsByBlu = new Map<string, { b_lu_harvest_date?: Date | null; b_lu_yield?: number | null }[]>()
    //     for (const cult of cultivations) {
    //         if (cult.b_lu) {
    //             const harvests = harvestsMap.get(cult.b_lu) ?? []
    //             fieldHarvestsByBlu.set(cult.b_lu, harvests.map((h) => ({
    //                 b_lu_harvest_date: h.b_lu_harvest_date ?? null,
    //                 b_lu_yield: h.harvestable.harvestable_analyses[0]?.b_lu_yield ?? null,
    //             })))
    //         }
    //     }
    //     const requestBody = services.buildDynaRequest(field, soilData, cultivations, dynaFertilizers,
    //         farmSector, timeframe, cropProperties.length > 0 ? cropProperties : undefined, fieldHarvestsByBlu)
    //     try {
    //         const result = await services.getDyna(fdm, {
    //             b_id, nmiApiKey, requestBody, cacheDate: new Date().toLocaleDateString("en-CA"),
    //         })
    //         return c.json(result as z.infer<typeof DynaResultSchema>, 200)
    //     } catch (err) { toApiError(err) }
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
    // [MINERALIZATION: disabled — behind feature flag in fdm-app]
    // app.openapi(fieldNSupplyRoute, fieldNSupplyHandler)
    // app.openapi(fieldDynaRoute, fieldDynaHandler)
}
