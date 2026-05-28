import { z } from "zod"

/**
 * Zod schema for a single fertilizer application within a field plan entry.
 */
export const FertilizerApplicationSchema = z.object({
    p_id_catalogue: z
        .string()
        .regex(
            /^[A-Za-z0-9_-]+$/,
            "Catalogue ID must contain only ASCII alphanumeric characters, underscores, or hyphens",
        )
        .describe("Catalogue ID of the fertilizer"),
    p_app_amount: z.number().describe("Application amount in kg/ha"),
    p_app_amount_display: z
        .number()
        .describe("Application amount in the native display unit"),
    p_app_amount_unit: z
        .enum(["kg/ha", "l/ha", "t/ha", "m3/ha"])
        .describe("Display unit for the application amount"),
    p_app_date: z.string().describe("Application date in YYYY-MM-DD format"),
    p_app_method: z.string().describe("Application method identifier"),
})

/**
 * Zod schema for a single field entry in the fertilizer plan.
 */
export const FieldPlanEntrySchema = z.object({
    b_id: z.string().describe("Field ID"),
    fieldSummary: z
        .string()
        .describe(
            "Brief Dutch explanation (≤ 75 words) specific to this field",
        ),
    applications: z
        .array(FertilizerApplicationSchema)
        .describe("Fertilizer applications for this field"),
})

/**
 * Zod schema for the emission breakdown within the nitrogen balance.
 */
const EmissionSchema = z.object({
    ammonia: z.object({ total: z.number() }),
    nitrate: z.object({ total: z.number() }),
})

/**
 * Zod schema for the nitrogen balance at farm level.
 */
const NBalanceSchema = z.object({
    balance: z.number().describe("Nitrogen balance in kg N/ha"),
    target: z.number().describe("Nitrogen balance target in kg N/ha"),
    emission: EmissionSchema,
})

/**
 * Zod schema for the three-norm filling/limit values.
 */
const NormValuesSchema = z.object({
    manure: z.number(),
    nitrogen: z.number(),
    phosphate: z.number(),
})

/**
 * Zod schema for the farm-level metrics block.
 */
const FarmTotalsSchema = z.object({
    normsFilling: NormValuesSchema.describe(
        "Current farm-level norm fillings in kg",
    ),
    norms: NormValuesSchema.describe("Farm-level legal norm limits in kg"),
    nBalance: NBalanceSchema,
})

/**
 * Zod schema for the complete fertilizer plan output from the Gerrit agent.
 * This schema is used with LangChain's `responseFormat` to guarantee
 * structured output from the LLM.
 */
export const FertilizerPlanSchema = z.object({
    summary: z.string().describe("Dutch explanation of the plan (< 250 words)"),
    metrics: z.object({
        farmTotals: FarmTotalsSchema,
    }),
    plan: z
        .array(FieldPlanEntrySchema)
        .describe("One entry per field with fertilizer applications"),
})

/** TypeScript type inferred from the FertilizerPlanSchema. */
export type FertilizerPlanOutput = z.infer<typeof FertilizerPlanSchema>
