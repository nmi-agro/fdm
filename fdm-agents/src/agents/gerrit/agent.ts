import { Agent, SkillToolset } from "@google/adk"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createDefaultModel } from "../../models/default"
import { composeSkills, loadSkill } from "../../skills"
import { createFertilizerPlannerTools } from "../../tools/fertilizer-planner"

/**
 * Creates the Fertilizer Application Planner Agent: "Gerrit"
 * @param fdm The non-serializable FDM database instance.
 * @param apiKey Optional API key for the Gemini model.
 * @param model Optional model override — use `gerritModels` values, not client input.
 */
export async function createFertilizerPlannerAgent(
    fdm: FdmType,
    apiKey?: string,
    model?: string,
) {
    const resolvedKey = apiKey ?? process.env.GEMINI_API_KEY
    if (!resolvedKey) {
        throw new Error(
            "Missing Gemini API key: provide apiKey or set the GEMINI_API_KEY environment variable.",
        )
    }

    const [instruction, cropSkill] = await Promise.all([
        composeSkills([
            "dutch-agronomist-persona",
            "legal-norms-nl",
            "nutrient-advice-targeting",
            "fertilizer-selection",
            "organic-matter",
            "nitrogen-management",
            "output-format",
            "security-boundaries",
        ]),
        loadSkill("crop-specific-fertilizer-preferences"),
    ])

    const skillToolset = new SkillToolset([cropSkill])

    return new Agent({
        name: "Gerrit",
        description:
            "Expert Dutch Agronomist for fertilizer application planning.",
        model: createDefaultModel(resolvedKey, model),
        instruction,
        tools: [...createFertilizerPlannerTools(fdm), skillToolset],
    })
}

