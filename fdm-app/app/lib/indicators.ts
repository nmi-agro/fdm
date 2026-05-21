/**
 * BLN3 indicator taxonomy, utilities, and score display helpers.
 * Shared by both farm-level and field-level indicator pages.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type IndicatorCategory =
    | "Biologisch"
    | "Chemisch"
    | "Fysisch"
    | "Grondwater"
    | "Nutriënten"
    | "Oppervlaktewater"

export type IndicatorInfo = {
    id: string
    name: string
    description: string
    category: IndicatorCategory
}

export type ScoreTier = "green" | "yellow" | "red"

/**
 * A measure as returned by the React Router loader after JSON serialization.
 * Dates are strings (ISO 8601) rather than Date objects.
 */
export type FieldMeasure = {
    b_id_measure: string
    m_id: string
    m_name: string
    m_summary: string | null
    m_conflicts: string[] | null
    m_start: string | null
    m_end: string | null
}

// ── Aggregation groupings ──────────────────────────────────────────────────

/** OBI = Biologisch + Chemisch (excl. C_SEQ) + Fysisch */
export const OBI_INDICATOR_IDS = [
    "B_DI",
    "B_SF",
    "C_K",
    "C_MG",
    "C_N",
    "C_P",
    "C_PH",
    "C_S",
    "P_AS",
    "P_CO",
    "P_CR",
    "P_DS",
    "P_DU",
    "P_RO",
    "P_SE",
    "P_WRET",
    "P_WO",
    "P_WS",
]

/** BBWP = Grondwater + Nutriënten + Oppervlaktewater + C_SEQ */
export const BBWP_INDICATOR_IDS = [
    "C_SEQ",
    "GW_GWR",
    "GW_NLEA",
    "GW_PEST",
    "NUT_K",
    "NUT_N",
    "NUT_P",
    "SW_NLEA",
    "SW_PLEA",
]

// ── Indicator taxonomy ──────────────────────────────────────────────────────

export const INDICATORS: IndicatorInfo[] = [
    // Biologisch
    {
        id: "B_DI",
        name: "Ziektewerendheid",
        description:
            "Het vermogen van de bodem om bodemgebonden ziekten en plagen te voorkomen",
        category: "Biologisch",
    },
    {
        id: "B_SF",
        name: "Microbiele activiteit",
        description:
            "De mate van activiteit van het micro-organismen (zoals bacteriën en schimmels) in de bodem",
        category: "Biologisch",
    },
    // Chemisch
    {
        id: "C_K",
        name: "Kaliumbeschikbaarheid",
        description:
            "De beschikbaarheid van kalium vanuit de bodem voor het gewas",
        category: "Chemisch",
    },
    {
        id: "C_MG",
        name: "Magnesiumbeschikbaarheid",
        description:
            "De beschikbaarheid van magnesium vanuit de bodem voor het gewas",
        category: "Chemisch",
    },
    {
        id: "C_N",
        name: "Stikstofbeschikbaarheid",
        description:
            "De beschikbaarheid van stikstof vanuit de bodem voor het gewas",
        category: "Chemisch",
    },
    {
        id: "C_P",
        name: "Fosfaatbeschikbaarheid",
        description:
            "De beschikbaarheid van fosfaat vanuit de bodem voor het gewas",
        category: "Chemisch",
    },
    {
        id: "C_PH",
        name: "Zuurgraad",
        description:
            "De zuurgraad van de bodem, belangrijk voor de beschikbaarheid van nutriënten en een actief bodemleven",
        category: "Chemisch",
    },
    {
        id: "C_S",
        name: "Zwavelbeschikbaarheid",
        description: "De beschikbaarheid van zwavel vanuit de bodem voor het gewas",
        category: "Chemisch",
    },
    {
        id: "C_SEQ",
        name: "Koolstofvastlegging",
        description: "De potentie van de bodem om koolstof vast te leggen",
        category: "Chemisch",
    },
    // Fysisch
    {
        id: "P_AS",
        name: "Aggregaatstabiliteit",
        description:
            "De stevigheid van bodemaggregaten wat de bodem beter bestand maakt tegen verdichting en zware regenval",
        category: "Fysisch",
    },
    {
        id: "P_CO",
        name: "Weerstand tegen bodemverdichting",
        description: "De mate waarin de bodem bestand is tegen bodemverdichting",
        category: "Fysisch",
    },
    {
        id: "P_CR",
        name: "Verkruimelbaarheid",
        description:
            "De mate waarin de bodem is te verkruimelen om een goed zaaibed aan te leggen",
        category: "Fysisch",
    },
    {
        id: "P_DS",
        name: "Weerstand tegen droogte",
        description:
            "Het vermogen van de bodem om voldoende vocht vast te houden en te leveren tijdens droge perioden",
        category: "Fysisch",
    },
    {
        id: "P_DU",
        name: "Weerstand tegen verstuiving",
        description: "De weerbaarheid van de bodem tegen winderosie",
        category: "Fysisch",
    },
    {
        id: "P_RO",
        name: "Bewortelbaarheid",
        description:
            "De mate waarin de bodem gemakkelijk te bewortelen is voor het gewas",
        category: "Fysisch",
    },
    {
        id: "P_SE",
        name: "Weerstand tegen verslemping",
        description:
            "De weerbaarheid van de bodem tegen het vormen van een slempkorst",
        category: "Fysisch",
    },
    {
        id: "P_WRET",
        name: "Waterbergend vermogen",
        description: "Het vermogen van de bodem om water vast te houden",
        category: "Fysisch",
    },
    {
        id: "P_WO",
        name: "Bewerkbaarheid",
        description:
            "De mate waarin de bodem bewerkbaar is en voldoende draagkracht heeft",
        category: "Fysisch",
    },
    {
        id: "P_WS",
        name: "Weerstand tegen wateroverlast",
        description:
            "Het vermogen van de bodem om overtollig water snel af te voeren, zodat zuurstoftekort bij de wortels wordt voorkomen",
        category: "Fysisch",
    },
    // Grondwater
    {
        id: "GW_GWR",
        name: "Grondwateraanvulling",
        description:
            "De mate waarin regenwater kan infiltreren naar het diepere grondwater in plaats van oppervlakkig af te stromen naar de sloten",
        category: "Grondwater",
    },
    {
        id: "GW_NLEA",
        name: "Weerstand tegen stikstofuitspoeling",
        description:
            "Het vermogen van de bodem om stikstof in de bodem vast te houden in plaats van dat het uitspoelt naar het grondwater",
        category: "Grondwater",
    },
    {
        id: "GW_PEST",
        name: "Weerstand tegen middeluitspoeling",
        description:
            "Het vermogen van de bodem om gewasbeschermingsmiddelen te binden en af te breken, zodat ze niet in het grondwater terechtkomen",
        category: "Grondwater",
    },
    // Nutriënten
    {
        id: "NUT_K",
        name: "Kaliumbenutting",
        description:
            "De effectiviteit waarmee het gewas de aanwezige en bemeste kalium kan opnemen en benutten",
        category: "Nutriënten",
    },
    {
        id: "NUT_N",
        name: "Stikstofbenutting",
        description:
            "De effectiviteit waarmee het gewas de aanwezige en bemeste stikstof kan opnemen en benutten",
        category: "Nutriënten",
    },
    {
        id: "NUT_P",
        name: "Fosfaatbenutting",
        description:
            "De effectiviteit waarmee het gewas de aanwezige en bemeste fosfaat kan opnemen en benutten",
        category: "Nutriënten",
    },
    // Oppervlaktewater
    {
        id: "SW_NLEA",
        name: "Weerstand tegen stikstofafspoeling",
        description:
            "Het vermogen van de bodem om afstroming van stikstof naar het oppervlaktewater te voorkomen na hevige neerslag",
        category: "Oppervlaktewater",
    },
    {
        id: "SW_PLEA",
        name: "Weerstand tegen fosfaatafspoeling",
        description:
            "Het vermogen van de bodem om fosfaat te binden en afstroming naar het oppervlaktewater te voorkomen na hevige neerslag",
        category: "Oppervlaktewater",
    },
]

export const INDICATOR_CATEGORIES: IndicatorCategory[] = [
    "Biologisch",
    "Chemisch",
    "Fysisch",
    "Grondwater",
    "Nutriënten",
    "Oppervlaktewater",
]

/**
 * Short GeoJSON property names for per-category average scores stored on map features.
 * Used to drive dynamic map colouring when a category filter is active.
 */
export const CATEGORY_MAP_PROP: Record<IndicatorCategory, string> = {
    Biologisch:       "avg_bio",
    Chemisch:         "avg_che",
    Fysisch:          "avg_fys",
    Grondwater:       "avg_grw",
    "Nutriënten":     "avg_nut",
    Oppervlaktewater: "avg_opp",
}

// ── Score utilities ─────────────────────────────────────────────────────────

/** Convert 0–1 API score to 0–100 display value. */
export function scoreToDisplay(score01: number): number {
    return Math.round(score01 * 100)
}

/** Returns a colour tier for a 0–100 display score. */
export function getScoreTier(score100: number): ScoreTier {
    if (score100 >= 70) return "green"
    if (score100 >= 40) return "yellow"
    return "red"
}

/** Returns a hex fill colour for a 0–100 display score. */
export function getScoreColor(score100: number): string {
    const tier = getScoreTier(score100)
    if (tier === "green") return "#22c55e"
    if (tier === "yellow") return "#eab308"
    return "#ef4444"
}

/** Returns a Dutch text verdict for a 0–100 display score. */
export function getScoreVerdict(score100: number): string {
    if (score100 >= 80) return "Uitstekend"
    if (score100 >= 70) return "Goed"
    if (score100 >= 50) return "Matig"
    if (score100 >= 40) return "Aandacht gewenst"
    return "Actie nodig"
}

/** Looks up an indicator by ID. Returns undefined if not found. */
export function getIndicatorInfo(id: string): IndicatorInfo | undefined {
    return INDICATORS.find((i) => i.id === id)
}

/** Returns all indicators for a given category. */
export function getIndicatorsByCategory(
    category: IndicatorCategory,
): IndicatorInfo[] {
    return INDICATORS.filter((i) => i.category === category)
}
