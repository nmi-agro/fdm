import { z } from "zod"

/**
 * A single answer option for a clarifying question.
 */
export const ClarifyingQuestionOptionSchema = z.object({
    id: z
        .string()
        .describe("Kort uniek ID voor deze optie (bijv. 'a', 'b', 'c', 'd')"),
    label: z
        .string()
        .describe(
            "De tekst van de optie zoals getoond aan de gebruiker (Nederlands, max 80 tekens)",
        ),
})

/**
 * A single clarifying question with its answer options.
 */
export const ClarifyingQuestionSchema = z.object({
    id: z.string().describe("Uniek ID voor deze vraag (bijv. 'q1', 'q2')"),
    question: z
        .string()
        .describe(
            "De vraag in het Nederlands, gericht aan de agronomisch adviseur of teler (max 120 tekens)",
        ),
    rationale: z
        .string()
        .optional()
        .describe(
            "Interne redenering waarom deze vraag relevant is voor het plan (niet getoond aan gebruiker)",
        ),
    selection: z
        .enum(["single", "multi"])
        .describe(
            "'single' als slechts één optie van toepassing is; 'multi' als meerdere opties tegelijk mogelijk zijn",
        ),
    options: z
        .array(ClarifyingQuestionOptionSchema)
        .min(2)
        .max(4)
        .describe("2 tot 4 antwoordopties (exclusief het vrije 'Anders'-veld)"),
})

/**
 * The full structured output of the clarify agent: 0–5 clarifying questions.
 */
export const ClarifyingQuestionsSchema = z.object({
    questions: z
        .array(ClarifyingQuestionSchema)
        .max(5)
        .describe(
            "0 tot 5 relevante verduidelijkingsvragen. Geef een lege lijst als er niets te verduidelijken is.",
        ),
})

/** An answer submitted by the user for one clarifying question. */
export const ClarificationAnswerSchema = z.object({
    questionId: z.string(),
    question: z.string().describe("De vraagtekst (voor weergave in de prompt)"),
    selectedOptionIds: z.array(z.string()).describe("Gekozen optie-ID's"),
    selectedOptionLabels: z.array(z.string()).describe("Gekozen optieteksten"),
    other: z
        .string()
        .optional()
        .describe("Ingevulde tekst als de gebruiker 'Anders' heeft gekozen"),
})

export type ClarifyingQuestionOption = z.infer<
    typeof ClarifyingQuestionOptionSchema
>
export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>
export type ClarifyingQuestions = z.infer<typeof ClarifyingQuestionsSchema>
export type ClarificationAnswer = z.infer<typeof ClarificationAnswerSchema>
