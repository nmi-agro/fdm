import { InMemoryRunner, isFinalResponse, stringifyContent } from '@google/adk';
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
        // Surface model errors immediately instead of silently returning empty string.
        // When Gemini returns a non-200 (e.g. 400), the LlmAgent emits an event
        // with errorCode/errorMessage but no content.
        if (event.errorCode) {
            throw new Error(`Gemini API error [${event.errorCode}]: ${event.errorMessage ?? 'unknown error'}`);
        }

        // Aggregate usage metadata if available
        if (event.usageMetadata) {
            totalInputTokens += event.usageMetadata.promptTokenCount || 0;
            totalOutputTokens += event.usageMetadata.candidatesTokenCount || 0;
        }

        // Only capture the final text response, not intermediate reasoning or tool calls.
        if (isFinalResponse(event)) {
            const text = stringifyContent(event);
            if (text) {
                finalResponse = text;
            }
        }
    }

    // Calculate estimated cost (Gemini 3.1 Pro Preview estimate)
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
                    $ai_model: 'gemini-3.1-pro-preview',
                    $ai_provider: 'google',
                    $ai_input: [{ role: 'user', content: input }],
                    $ai_output: [{ role: 'assistant', content: finalResponse }],
                    $ai_input_tokens: totalInputTokens,
                    $ai_output_tokens: totalOutputTokens,
                    $ai_total_tokens: totalInputTokens + totalOutputTokens,
                    $ai_cost: totalCost,
                    $ai_currency: 'USD',
                    agent_name: agent.name,
                    b_id_farm: context.b_id_farm,
                    principal_id: context.principalId
                }
            });
        } catch (e) {
            console.error('Failed to log to PostHog:', e);
        }
    }
    
    return finalResponse;
}
