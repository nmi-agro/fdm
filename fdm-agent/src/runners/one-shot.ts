import { InMemoryRunner } from '@google/adk';
import type { BaseAgent } from '@google/adk';

/**
 * Common runner for one-shot agent execution in fdm-agent.
 * @param agent The agent instance to run.
 * @param input The user input string.
 * @param context Extra context to provide to the agent (e.g. fdm, principalId).
 * @param posthog Optional PostHog client and distinctId for tracking.
 * @returns The final response from the agent.
 */
export async function runOneShotAgent(
    agent: BaseAgent, 
    input: string, 
    context: Record<string, any> = {},
    posthog?: { client: any, distinctId: string }
): Promise<string> {
    const runner = new InMemoryRunner({ agent, appName: 'fdm-agent' });
    
    const stream = runner.runEphemeral({
        userId: 'system',
        newMessage: { 
            role: 'user', 
            parts: [{ text: input }] 
        },
        stateDelta: context
    });
    
    let finalResponse = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for await (const event of stream) {
        // Aggregate usage metadata if available
        if (event.usageMetadata) {
            totalInputTokens += event.usageMetadata.promptTokenCount || 0;
            totalOutputTokens += event.usageMetadata.candidatesTokenCount || 0;
        }

        if (event.content && event.content.role === 'model') {
           const parts = event.content.parts || [];
           for (const part of parts) {
               if (part.text) {
                   finalResponse += part.text;
               }
           }
        }
    }

    // Calculate estimated cost (Gemini 3.1 Pro Estimate)
    // Input: $1.25 / 1M tokens
    // Output: $5.00 / 1M tokens
    const inputCost = (totalInputTokens / 1_000_000) * 1.25;
    const outputCost = (totalOutputTokens / 1_000_000) * 5.00;
    const totalCost = inputCost + outputCost;

    // PostHog LLM Tracking
    if (posthog?.client) {
        try {
            posthog.client.capture({
                distinctId: posthog.distinctId,
                event: '$ai_generation',
                properties: {
                    $ai_model: 'gemini-3.1-pro',
                    $ai_provider: 'google',
                    $ai_input: [{ role: 'user', content: input }],
                    $ai_output: [{ role: 'assistant', content: finalResponse }],
                    $ai_input_tokens: totalInputTokens,
                    $ai_output_tokens: totalOutputTokens,
                    $ai_total_tokens: totalInputTokens + totalOutputTokens,
                    $ai_cost: totalCost,
                    $ai_currency: 'USD',
                    agent_name: agent.name,
                    farm_id: context.farmId,
                    principal_id: context.principalId
                }
            });
        } catch (e) {
            console.error('Failed to log to PostHog:', e);
        }
    }
    
    return finalResponse;
}
