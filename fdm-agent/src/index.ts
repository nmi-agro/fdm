import { createNutrientManagementAgent } from "./agents/gerrit/agent"
import { runOneShotAgent } from "./runners/one-shot"
import { z } from "zod"

export { createNutrientManagementAgent as createNutrientPlannerAgent }
export { runOneShotAgent }

export interface FertilizerPlanStrategies {
    /** Whether the farm is organic (prohibits mineral fertilizers) */
    isOrganic: boolean
    /** Whether to maximize manure applications up to the legal norm */
    fillManureSpace: boolean
    /** Whether to prioritize ammonia emission reduction */
    reduceAmmoniaEmissions: boolean
    /** Whether to keep the nitrogen balance below the calculated target */
    keepNitrogenBalanceBelowTarget: boolean
    /** Whether to apply the same plan to all fields with the same cultivation (bouwplan level) */
    workOnRotationLevel: boolean
}

/** Schema for validating FertilizerPlanStrategies — all fields must be explicit booleans. */
export const FertilizerPlanStrategiesSchema = z.object({
    isOrganic: z.boolean(),
    fillManureSpace: z.boolean(),
    reduceAmmoniaEmissions: z.boolean(),
    keepNitrogenBalanceBelowTarget: z.boolean(),
    workOnRotationLevel: z.boolean(),
})

/** Compact field summary injected into the initial prompt for faster agent orientation. */
export interface FarmFieldSummary {
    b_id: string
    b_name: string
    b_area: number
    b_bufferstrip: boolean
    b_lu_catalogue: string
    b_lu_name: string
}

/**
 * Sanitizes the additionalContext string: trims whitespace, limits to 1000 characters,
 * and strips any prompt-injection attempts (e.g. lines starting with "IGNORE " or "SYSTEM:").
 */
function sanitizeAdditionalContext(raw: string): string {
    return raw
        .trim()
        .slice(0, 1000)
        .replace(/^(IGNORE|SYSTEM:|OVERRIDE|INSTRUCTION:).*/gim, "[removed]")
}

/**
 * Fertilizer-specific high-level API.
 * @param fdm The FDM instance.
 * @param principalId The ID of the principal.
 * @param farmData The farm metadata (containing b_id_farm).
 * @param strategies Explicit planning strategies (validated with Zod internally).
 * @param calendar The calendar year (e.g. "2025").
 * @param geminiApiKey Optional Gemini API key.
 * @param nmiApiKey Optional NMI API key (injected server-side into agent context, never sent to LLM).
 * @param additionalContext Any extra user instructions (sanitized to 1000 chars max).
 * @param posthog Optional PostHog client or config.
 * @param fieldsSummary Optional pre-fetched field list to include in the prompt context.
 */
/**
 * Builds the prompt string for the fertilizer planning agent.
 * Shared between the one-shot and streaming entry points.
 */
export function buildFertilizerPlanPrompt(
    farmData: { b_id_farm: string },
    strategies: FertilizerPlanStrategies,
    calendar: string,
    additionalContext?: string,
    fieldsSummary?: FarmFieldSummary[],
): string {
    const validatedStrategies = FertilizerPlanStrategiesSchema.parse(strategies)
    const safeContext = additionalContext
        ? sanitizeAdditionalContext(additionalContext)
        : "None"

    const fieldsBlock =
        fieldsSummary && fieldsSummary.length > 0
            ? `\nFARM FIELDS (${fieldsSummary.length} fields, pre-loaded for your reference):\n${fieldsSummary
                  .map(
                      (f) =>
                          `- b_id: ${f.b_id} | Name: ${f.b_name} | Area: ${f.b_area?.toFixed(2)} ha | Crop: ${f.b_lu_name} (${f.b_lu_catalogue}) | BufferStrip: ${f.b_bufferstrip}`,
                  )
                  .join("\n")}\n`
            : ""

    return `Please generate a fertilizer plan for farm "${farmData.b_id_farm}" for the year "${calendar}".
${fieldsBlock}
STRATEGIES TO ENFORCE:
- Organic Farming: ${validatedStrategies.isOrganic ? "YES (No mineral fertilizers allowed)" : "NO"}
- Fill Manure Space: ${validatedStrategies.fillManureSpace ? "YES (Maximize manure usage up to legal limits)" : "NO (Only use manure as needed for advice)"}
- Reduce NH3 Emissions: ${validatedStrategies.reduceAmmoniaEmissions ? "YES (Prioritize fertilizers and methods with lower ammonia emission factors)" : "NO"}
- Keep Nitrogen Balance Below Target: ${validatedStrategies.keepNitrogenBalanceBelowTarget ? "YES (Ensure the N balance surplus is within the legal/environmental target)" : "NO"}
- Work on Rotation Level (Bouwplan): ${validatedStrategies.workOnRotationLevel ? "YES (All fields sharing the same b_lu_catalogue MUST receive identical applications — same products, amounts, dates and methods)" : "NO"}

Additional Context: ${safeContext}`
}

export async function generateFarmFertilizerPlan(
    fdm: any,
    principalId: any,
    farmData: { b_id_farm: string },
    strategies: FertilizerPlanStrategies,
    calendar: string,
    geminiApiKey?: string,
    nmiApiKey?: string,
    additionalContext?: string,
    posthog?: { client: any; distinctId: string },
    fieldsSummary?: FarmFieldSummary[],
) {
    const validatedStrategies = FertilizerPlanStrategiesSchema.parse(strategies)
    const safeContext = additionalContext
        ? sanitizeAdditionalContext(additionalContext)
        : "None"

    const agent = createNutrientManagementAgent(fdm, geminiApiKey)
    const input = buildFertilizerPlanPrompt(
        farmData,
        validatedStrategies,
        calendar,
        safeContext,
        fieldsSummary,
    )
    return runOneShotAgent(
        agent,
        input,
        { principalId, b_id_farm: farmData.b_id_farm, calendar, nmiApiKey },
        posthog,
    )
}
