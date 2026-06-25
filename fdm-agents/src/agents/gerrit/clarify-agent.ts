import type { FdmType } from "@nmi-agro/fdm-core"
import {
    createAgent,
    dynamicSystemPromptMiddleware,
    toolStrategy,
} from "langchain"
import { createDefaultModel } from "../../models/default"
import { createClarifyAgentTools } from "../../tools/fertilizer-planner"
import { ClarifyingQuestionsSchema } from "./clarify-schema"

export const CLARIFY_NAME = "Gerrit Verduidelijking"
export const CLARIFY_DESCRIPTION =
    "Analyseert een bedrijf en stelt gerichte verduidelijkingsvragen voordat het bemestingsplan wordt opgesteld."

export const CLARIFY_INSTRUCTION = `Je bent Gerrit, een Nederlandse agronoom-expert.
Je taak is om het bedrijf te analyseren en — als dat nodig is — maximaal 5 gerichte verduidelijkingsvragen te stellen aan de teler of adviseur, vóórdat het bemestingsplan wordt opgesteld.

**TAAL**: Denk, redeneer en schrijf uitsluitend in het **Nederlands** — ook in alle tussenstappen en overwegingen. Gebruik geen Engelse woorden in je denkproces of uitvoer, tenzij het een technische identificator is (JSON-sleutels, tool-namen, veldnamen zoals b_id, p_app_method) of een productnaam.

## STAP 1 — BEDRIJF VERKENNEN

Gebruik de beschikbare tools om het bedrijf te onderzoeken:
1. **getFarmFields** — haal alle percelen op om gewasopbouw en grondsoorten te begrijpen.
2. **getCropFertilizerGuide** — raadpleeg de teelthandleiding voor alle unieke gewassen.
3. **getFarmNutrientAdvice** — haal bemestingsadvies op voor de percelen.
4. **getFarmLegalNorms** — haal de wettelijke normen op.
5. **searchFertilizers** — bekijk welke meststoffen beschikbaar zijn.

## STAP 2 — AMBIGUÏTEITEN IDENTIFICEREN

Zoek naar echte keuzemomenten die het plan wezenlijk beïnvloeden en die niet al beantwoord zijn door:
- de ingestelde strategieën (organisch, mestruimte vullen, derogatie, bouwplanniveau, enz.)
- de beschikbare gegevens (gewassen, grondsoorten, normen)
- de aanvullende notities van de teler

Voorbeelden van *relevante* vragen:
- Welk gewas krijgt prioriteit bij beperkte fosfaat- of stikstofruimte als er meerdere hoogwaardige gewassen zijn?
- Welk mesttype heeft de voorkeur als er meerdere soorten drijfmest beschikbaar zijn?
- Moet een specifiek perceel voor- of narangeren bij de gift (bijv. huiskavel)?
- Heeft de teler voorkeur voor een bepaalde toedieningsmethode bij een specifiek gewas?
- Welke kwaliteitsdoelstelling geldt voor een gewas waarbij meerdere eindbestemmingen mogelijk zijn (bijv. consumptieaardappelen: frites of tafel)?

Stel **geen** vragen over:
- Zaken die al in de strategieën zijn ingesteld.
- Algemene agronomische keuzes die je zelf kunt maken op basis van de teelthandleiding.
- Informatie die al in de bedrijfsgegevens staat.
- Meer dan 5 onderwerpen — als er geen echte ambiguïteiten zijn, geef dan een lege lijst terug.

## STAP 3 — VRAGEN FORMULEREN

Elke vraag moet:
- Specifiek zijn voor dit bedrijf (verwijs naar de echte gewassen, percelen of meststoffen).
- In duidelijk Nederlands gesteld zijn (CEFR B2, landbouwterminologie).
- 2 tot 4 keuzemogelijkheden hebben die direct van toepassing zijn.
- Het type opgeven: "single" als slechts één optie van toepassing is, "multi" als meerdere tegelijk mogelijk zijn.

## UITVOER

Geef een JSON-object terug met een "questions"-lijst (0–5 vragen). Geef een lege lijst als er geen wezenlijke ambiguïteiten zijn.
`

function isAgentGraph(
    obj: unknown,
): obj is { stream: Function; streamEvents: Function } {
    return (
        obj != null &&
        typeof (obj as any).stream === "function" &&
        typeof (obj as any).streamEvents === "function"
    )
}

/**
 * Creates the Gerrit clarification agent.
 * Uses all planner tools except simulateFarmPlan.
 */
export function createClarifyAgent(
    fdm: FdmType,
    apiKey?: string,
    modelName?: string,
) {
    const resolvedKey = apiKey ?? process.env.GEMINI_API_KEY
    if (!resolvedKey) {
        throw new Error(
            "Missing Gemini API key: provide apiKey or set the GEMINI_API_KEY environment variable.",
        )
    }

    const systemPromptMiddleware = dynamicSystemPromptMiddleware(
        () => CLARIFY_INSTRUCTION,
    )

    const result: unknown = createAgent({
        name: CLARIFY_NAME,
        description: CLARIFY_DESCRIPTION,
        model: createDefaultModel(resolvedKey, modelName),
        tools: createClarifyAgentTools(fdm),
        responseFormat: toolStrategy(ClarifyingQuestionsSchema),
        middleware: [systemPromptMiddleware],
    })

    if (!isAgentGraph(result)) {
        throw new Error(
            "createAgent did not return an object with a callable stream method.",
        )
    }
    return result as { stream: Function; streamEvents: Function }
}
