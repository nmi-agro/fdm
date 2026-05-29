/**
 * Shared color class mappings for BCS score visualization.
 * Used by BcsScoreCard, BcsWizard, and the assessment list.
 */

export type BcsColor = "red" | "orange" | "yellow" | "green" | "emerald"

export const SCORE_TEXT_CLASSES: Record<BcsColor, string> = {
    red: "text-destructive",
    orange: "text-orange-500",
    yellow: "text-yellow-500",
    green: "text-green-600",
    emerald: "text-emerald-600",
}

export const SCORE_BG_CLASSES: Record<BcsColor, string> = {
    red: "bg-destructive/10",
    orange: "bg-orange-50",
    yellow: "bg-yellow-50",
    green: "bg-green-50",
    emerald: "bg-emerald-50",
}

export const SCORE_BAR_CLASSES: Record<BcsColor, string> = {
    red: "bg-destructive",
    orange: "bg-orange-500",
    yellow: "bg-yellow-500",
    green: "bg-green-600",
    emerald: "bg-emerald-600",
}

/** BCS indicator key type (client-safe, no fdm-calculator dependency) */
export type BcsIndicatorKey =
    | "a_ss_bcs"
    | "a_sc_bcs"
    | "a_rd_bcs"
    | "a_ew_bcs"
    | "a_cc_bcs"
    | "a_gs_bcs"
    | "a_p_bcs"
    | "a_c_bcs"
    | "a_rt_bcs"
    | "a_ph_bcs"
    | "a_som_bcs"

/** Client-safe BCS scores type */
export type BcsScores = Partial<Record<BcsIndicatorKey, number | null>>

/** Static BCS indicator metadata — no Node.js dependencies */
export const BCS_INDICATORS = [
    { key: "a_cc_bcs" as const, name: "Gewasbedekking", description: "% bodemoppervlak bedekt door vegetatie", weight: 2, direction: "positive" as const, source: "field" as const },
    { key: "a_rd_bcs" as const, name: "Beworteling", description: "Bewortelingsdiepte, dichtheid en vertakking", weight: 3, direction: "positive" as const, source: "field" as const },
    { key: "a_sc_bcs" as const, name: "Verdichting ondergrond", description: "Weerstand bij indrukken, plaatstructuren", weight: 3, direction: "positive" as const, source: "field" as const },
    { key: "a_ew_bcs" as const, name: "Regenwormen", description: "Aantal en soort regenwormen", weight: 3, direction: "positive" as const, source: "field" as const },
    { key: "a_ss_bcs" as const, name: "Bodemstructuur", description: "Kluitgrootte en aggregaatstabiliteit", weight: 3, direction: "positive" as const, source: "field" as const },
    { key: "a_ph_bcs" as const, name: "Zuurgraad (pH)", description: "pH-CaCl2 afgeleid van laboratoriumanalyse", weight: 3, direction: "positive" as const, source: "lab" as const },
    { key: "a_som_bcs" as const, name: "Organische stof", description: "Organische stofgehalte afgeleid van laboratoriumanalyse", weight: 3, direction: "positive" as const, source: "lab" as const },
    { key: "a_gs_bcs" as const, name: "Gekleurde vlekken", description: "Roest/blauwe/grijze vlekken (wateroverlast)", weight: 1, direction: "positive" as const, source: "field" as const },
    { key: "a_p_bcs" as const, name: "Plasvorming", description: "Waterplassen op het oppervlak", weight: 2, direction: "negative" as const, source: "field" as const },
    { key: "a_c_bcs" as const, name: "Scheuren", description: "Zichtbare scheuren in de toplaag", weight: 1, direction: "negative" as const, source: "field" as const },
    { key: "a_rt_bcs" as const, name: "Spoorvorming/vertrapping", description: "Wielsporen, hoefafdrukken", weight: 1, direction: "negative" as const, source: "field" as const },
] as const
