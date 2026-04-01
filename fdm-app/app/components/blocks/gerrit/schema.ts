import { z } from "zod"

export const GerritFormSchema = z.object({
    isOrganic: z.coerce.string().transform((val) => val === "true"),
    fillManureSpace: z.coerce.string().transform((val) => val === "true"),
    reduceAmmoniaEmissions: z.coerce
        .string()
        .transform((val) => val === "true"),
    keepNitrogenBalanceBelowTarget: z.coerce
        .string()
        .transform((val) => val === "true"),
    workOnRotationLevel: z.coerce.string().transform((val) => val === "true"),
    isDerogation: z.coerce
        .string()
        .optional()
        .transform((val) => val === "true"),
    additionalContext: z
        .string()
        .max(1000, "Maximaal 1000 karakters toegestaan.")
        .optional()
        .default(""),
    geminiModel: z.string().optional().default("gemini-3-flash-preview"),
})

export type GerritFormValues = z.infer<typeof GerritFormSchema>

export const STRATEGY_LABELS: Record<string, string> = {
    isOrganic: "Biologisch bedrijf",
    fillManureSpace: "Opvullen mestruimte",
    reduceAmmoniaEmissions: "Ammoniakemissies verminderen",
    keepNitrogenBalanceBelowTarget: "Inzetten op doelsturing",
    workOnRotationLevel: "Bouwplanniveau",
    isDerogation: "Derogatie",
}

export const GEMINI_MODELS = [
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (standaard)" },
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (geavanceerd)" },
    // { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (stabiel)" },
    // { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (zuinig)" },
    {
        value: "gemini-3.1-flash-lite-preview",
        label: "Gemini 3.1 Flash Lite (snel)",
    },
]
