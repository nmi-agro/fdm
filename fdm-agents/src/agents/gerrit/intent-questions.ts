import { GoogleGenAI } from "@google/genai"
import { gerritModels } from "../../config"
import type { FertilizerPlanStrategies } from "../../index"

export interface IntentOption {
    value: string
    label: string
    /** true for the "Anders, namelijk:" open-text option */
    isOpen: boolean
}

export interface IntentQuestion {
    id: string
    /** The question Gerrit is asking the farmer */
    question: string
    /**
     * Short explanation of why Gerrit needs this information to make a good plan.
     * Shown below the question in the UI.
     */
    context: string
    options: IntentOption[]
}

/** Minimal fertilizer info needed for the intent question prompt */
export interface FertilizerSummary {
    p_name_nl: string
    p_type: string
}

/** Minimal field data needed for the intent question prompt */
export interface IntentFieldSummary {
    b_id: string
    b_name: string
    b_lu_name: string
    b_area: number | null
    b_bufferstrip: boolean
    b_soiltype_agr: string | null
    b_gwl_class: string | null
    a_som_loi: number | null
}

/**
 * Compact Dutch names for fertilizer types, used in the LLM prompt.
 */
const TYPE_LABELS: Record<string, string> = {
    animal_manure: "dierlijke mest",
    mineral: "kunstmest",
    organic: "organische meststof",
    compost: "compost",
    other: "overig",
}

function fertilizerTypeLabel(p_type: string): string {
    return TYPE_LABELS[p_type] ?? p_type
}

export interface IntentQuestionsResult {
    questions: IntentQuestion[]
    usage: {
        inputTokens: number | null
        outputTokens: number | null
        totalTokens: number | null
        latencyMs: number
    }
}

/**
 * Asks Gemini Flash to identify the 0–3 decisions it cannot make for this
 * farm without explicit user input, then returns them as structured questions.
 *
 * The LLM receives:
 * - Field data: crops, area, soil type, organic matter %
 * - Available fertilizers: name and type (cattle slurry, pig slurry, compost, …)
 * - Strategy settings
 * - Any additional context already provided by the user
 *
 * Falls back to an empty array (= skip to generation) if the API call fails.
 */
export async function generateIntentQuestions(
    fields: IntentFieldSummary[],
    fertilizers: FertilizerSummary[],
    strategies: FertilizerPlanStrategies,
    apiKey: string,
    additionalContext?: string,
): Promise<IntentQuestionsResult> {
    const emptyResult = (latencyMs = 0): IntentQuestionsResult => ({
        questions: [],
        usage: { inputTokens: null, outputTokens: null, totalTokens: null, latencyMs },
    })

    if (!apiKey) return emptyResult()

    const genAI = new GoogleGenAI({ apiKey })

    // ── Build farm context block ─────────────────────────────────────────────
    const activeFields = fields.filter((f) => !f.b_bufferstrip).slice(0, 20)
    const fieldsBlock = activeFields
        .map(
            (f) =>
                `- ${f.b_name}: ${f.b_lu_name}, ${(f.b_area ?? 0).toFixed(1)} ha` +
                (f.b_soiltype_agr ? `, soil: ${f.b_soiltype_agr}` : "") +
                (f.b_gwl_class ? `, GWT: ${f.b_gwl_class}` : "") +
                (f.a_som_loi != null ? `, SOM: ${f.a_som_loi}%` : ""),
        )
        .join("\n")

    const fertilizersBlock =
        fertilizers.length > 0
            ? fertilizers
                  .map(
                      (f) =>
                          `- ${f.p_name_nl} (${fertilizerTypeLabel(f.p_type)})`,
                  )
                  .join("\n")
            : "No fertilizers in inventory"

    const activeStrategies = [
        strategies.isOrganic && "organic farming (no mineral fertilizers)",
        strategies.fillManureSpace && "maximise manure application space",
        strategies.reduceAmmoniaEmissions && "reduce NH₃ emissions",
        strategies.keepNitrogenBalanceBelowTarget && "keep N balance below target",
        strategies.workOnRotationLevel && "work at crop rotation level",
        strategies.isDerogation && "derogation",
    ].filter(Boolean)

    const strategiesBlock =
        activeStrategies.length > 0
            ? activeStrategies.join(", ")
            : "no special strategies"

    const contextBlock = additionalContext?.trim()
        ? `Additional farmer instruction: "${additionalContext.slice(0, 500)}"`
        : ""

    // ── Prompt ──────────────────────────────────────────────────────────────
    const prompt = `You are Gerrit, an expert Dutch agronomist preparing a fertilizer plan for a Dutch farm.

FARM CONTEXT:

Fields (${activeFields.length}):
${fieldsBlock}

Available fertilizers:
${fertilizersBlock}

Active strategies: ${strategiesBlock}
${contextBlock ? `\n${contextBlock}` : ""}

TASK:
Analyse this farm situation and identify decisions you CANNOT make without explicit farmer input — choices where multiple agronomically valid options exist, each representing a different trade-off.

Examples of decisions that typically need farmer input:
- Choice between fertilizers with different N/P ratios when both fit within the norms
- Distribution of manure when total supply cannot cover all fields equally
- Prioritisation of crops or fields competing for the same product
- Ambiguities or contradictions in the additional farmer instruction
- Application timing or technique when the strategy allows multiple valid approaches

If you have enough information to build a good plan independently, return an empty questions array.

Return ONLY valid JSON (no explanation, no markdown, just JSON):
{
  "questions": [
    {
      "id": "unique-kebab-id",
      "question": "Specific question in Dutch, referencing actual field or fertilizer names from the data above",
      "context": "One sentence in Dutch explaining why you as Gerrit cannot make this choice without farmer input",
      "options": [
        { "value": "opt1", "label": "Option A in Dutch (use concrete names/numbers from the data)" },
        { "value": "opt2", "label": "Option B in Dutch" },
        { "value": "other", "label": "Anders, namelijk:", "isOpen": true }
      ]
    }
  ]
}

Rules:
- Maximum 3 questions
- Each question needs at least 2 options plus the open "Anders, namelijk:" option
- Questions and options MUST be in Dutch (the output is shown to Dutch farmers)
- Reference real field names and fertilizer names from the data above
- Only ask if the answer would materially change the plan`

    const startTime = Date.now()

    try {
        const response = await genAI.models.generateContent({
            model: gerritModels.intent,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { temperature: 0.3, maxOutputTokens: 1024 },
        })

        const latencyMs = Date.now() - startTime
        const usage = {
            inputTokens: response.usageMetadata?.promptTokenCount ?? null,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
            totalTokens: response.usageMetadata?.totalTokenCount ?? null,
            latencyMs,
        }

        const raw = response.text ?? ""
        const firstBrace = raw.indexOf("{")
        const lastBrace = raw.lastIndexOf("}")
        if (firstBrace === -1 || lastBrace <= firstBrace) return { questions: [], usage }

        const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as {
            questions?: IntentQuestion[]
        }

        const questions = (parsed.questions ?? [])
            .filter(
                (q) =>
                    q.id &&
                    q.question &&
                    Array.isArray(q.options) &&
                    q.options.length >= 2,
            )
            .slice(0, 3)
            .map((q, i) => ({
                ...q,
                id: q.id || `q${i + 1}`,
                context: q.context ?? "",
                options: q.options.map((o) => ({
                    value: o.value ?? String(Math.random()),
                    label: o.label ?? "",
                    isOpen: !!o.isOpen,
                })),
            }))

        return { questions, usage }
    } catch {
        // Never block the user — silently skip intent questions on error
        return emptyResult(Date.now() - startTime)
    }
}
