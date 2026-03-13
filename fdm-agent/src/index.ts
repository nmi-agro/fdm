import { createNutrientManagementAgent } from './agents/gerrit/agent';
import { runOneShotAgent } from './runners/one-shot';

export { createNutrientManagementAgent as createNutrientPlannerAgent };
export { runOneShotAgent };

export interface FertilizerPlanStrategies {
    /** Whether the farm is organic (prohibits mineral fertilizers) */
    isOrganic: boolean;
    /** Whether to maximize manure applications up to the legal norm */
    fillManureSpace: boolean;
    /** Whether to prioritize ammonia emission reduction */
    reduceAmmoniaEmissions: boolean;
    /** Whether to keep the nitrogen balance below the calculated target */
    keepNitrogenBalanceBelowTarget: boolean;
}

/**
 * Fertilizer-specific high-level API.
 * @param fdm The FDM instance.
 * @param principalId The ID of the principal.
 * @param farmData The farm data.
 * @param strategies Explicit planning strategies.
 * @param geminiApiKey Optional Gemini API key.
 * @param additionalContext Any extra user instructions.
 * @param posthog Optional PostHog client or config.
 */
export async function generateFarmFertilizerPlan(
    fdm: any, 
    principalId: any, 
    farmData: any, 
    strategies: FertilizerPlanStrategies,
    geminiApiKey?: string,
    additionalContext?: string,
    posthog?: { client: any, distinctId: string }
) {
    const agent = createNutrientManagementAgent(fdm, geminiApiKey);
    const input = `Please generate a fertilizer plan for the following farm. 
Farm Data: ${JSON.stringify(farmData)}

STRATEGIES TO ENFORCE:
- Organic Farming: ${strategies.isOrganic ? 'YES (No mineral fertilizers allowed)' : 'NO'}
- Fill Manure Space: ${strategies.fillManureSpace ? 'YES (Maximize manure usage up to legal limits)' : 'NO (Only use manure as needed for advice)'}
- Reduce NH3 Emissions: ${strategies.reduceAmmoniaEmissions ? 'YES (Prioritize fertilizers and methods with lower ammonia emission factors)' : 'NO'}
- Keep Nitrogen Balance Below Target: ${strategies.keepNitrogenBalanceBelowTarget ? 'YES (Ensure the N balance surplus is within the legal/environmental target)' : 'NO'}

Additional Context: ${additionalContext || 'None'}`;
    
    return runOneShotAgent(agent, input, { principalId, farmId: farmData.farmId }, posthog);
}
