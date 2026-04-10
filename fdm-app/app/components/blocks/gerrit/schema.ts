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
