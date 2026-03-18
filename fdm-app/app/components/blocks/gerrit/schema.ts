import { z } from "zod"

export const GerritFormSchema = z.object({
    isOrganic: z.boolean(),
    fillManureSpace: z.boolean(),
    reduceAmmoniaEmissions: z.boolean(),
    keepNitrogenBalanceBelowTarget: z.boolean(),
    workOnRotationLevel: z.boolean(),
    additionalContext: z
        .string()
        .max(1000, "Maximaal 1000 karakters toegestaan.")
        .optional()
        .default(""),
    geminiModel: z.string().optional().default("gemini-3.1-pro-preview"),
})

export type GerritFormValues = z.infer<typeof GerritFormSchema>

export const STRATEGY_LABELS: Record<string, string> = {
    isOrganic: "Biologisch",
    fillManureSpace: "Max. mestplaatsing",
    reduceAmmoniaEmissions: "Emissiearme aanwending",
    keepNitrogenBalanceBelowTarget: "Doelsturing N",
    workOnRotationLevel: "Bouwplanniveau",
}

export const GEMINI_MODELS = [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (standaard)" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (snel)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (stabiel)" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (zuinig)" },
    {
        value: "gemini-3.1-flash-lite-preview",
        label: "Gemini 3.1 Flash Lite (goedkoopst)",
    },
]
