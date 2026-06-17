/**
 * BLN3 indicator taxonomy, utilities, and score display helpers.
 * Shared by both farm-level and field-level indicator pages.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type Ecosysteemdienst =
    | "Productie"
    | "Klimaat"
    | "Water"
    | "Nutriëntenkringloop"

export type IndicatorInfo = {
    id: string
    name: string
    description: string
    ecosysteemdienst: Ecosysteemdienst
    /** Physical unit for status/target values, or null when dimensionless */
    unit?: string | null
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

// ── Indicator taxonomy ──────────────────────────────────────────────────────

export const INDICATORS: IndicatorInfo[] = [
    // Productie
    {
        id: "B_DI",
        name: "Ziektewerendheid",
        description:
            "Het vermogen van de bodem om bodemgebonden ziekten en plagen te voorkomen",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "B_SF",
        name: "Microbiele activiteit",
        description:
            "De mate van activiteit van het micro-organismen (zoals bacteriën en schimmels) in de bodem",
        ecosysteemdienst: "Productie",
        unit: "mg N/kg",
    },
    {
        id: "C_K",
        name: "Kaliumbeschikbaarheid",
        description:
            "De beschikbaarheid van kalium vanuit de bodem voor het gewas",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "C_MG",
        name: "Magnesiumbeschikbaarheid",
        description:
            "De beschikbaarheid van magnesium vanuit de bodem voor het gewas",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "C_N",
        name: "Stikstofbeschikbaarheid",
        description:
            "De beschikbaarheid van stikstof vanuit de bodem voor het gewas",
        ecosysteemdienst: "Productie",
        unit: "kg N/ha",
    },
    {
        id: "C_P",
        name: "Fosfaatbeschikbaarheid",
        description:
            "De beschikbaarheid van fosfaat vanuit de bodem voor het gewas",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "C_PH",
        name: "Zuurgraad",
        description:
            "De zuurgraad van de bodem, belangrijk voor de beschikbaarheid van nutriënten en een actief bodemleven",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "C_S",
        name: "Zwavelbeschikbaarheid",
        description:
            "De beschikbaarheid van zwavel vanuit de bodem voor het gewas",
        ecosysteemdienst: "Productie",
        unit: "kg S/ha",
    },
    {
        id: "P_AS",
        name: "Aggregaatstabiliteit",
        description:
            "De stevigheid van bodemaggregaten wat de bodem beter bestand maakt tegen verdichting en zware regenval",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "P_CO",
        name: "Weerstand tegen bodemverdichting",
        description:
            "De mate waarin de bodem bestand is tegen bodemverdichting",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "P_CR",
        name: "Verkruimelbaarheid",
        description:
            "De mate waarin de bodem is te verkruimelen om een goed zaaibed aan te leggen",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "P_DS",
        name: "Weerstand tegen droogte",
        description:
            "Het vermogen van de bodem om voldoende vocht vast te houden en te leveren tijdens droge perioden",
        ecosysteemdienst: "Productie",
        unit: "%",
    },
    {
        id: "P_DU",
        name: "Weerstand tegen verstuiving",
        description: "De weerbaarheid van de bodem tegen winderosie",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "P_RO",
        name: "Bewortelbaarheid",
        description:
            "De mate waarin de bodem gemakkelijk te bewortelen is voor het gewas",
        ecosysteemdienst: "Productie",
        unit: "kg/m³",
    },
    {
        id: "P_SE",
        name: "Weerstand tegen verslemping",
        description:
            "De weerbaarheid van de bodem tegen het vormen van een slempkorst",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "P_WRET",
        name: "Waterbergend vermogen",
        description: "Het vermogen van de bodem om water vast te houden",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "P_WO",
        name: "Bewerkbaarheid",
        description:
            "De mate waarin de bodem bewerkbaar is en voldoende draagkracht heeft",
        ecosysteemdienst: "Productie",
        unit: null,
    },
    {
        id: "P_WS",
        name: "Weerstand tegen wateroverlast",
        description:
            "Het vermogen van de bodem om overtollig water snel af te voeren, zodat zuurstoftekort bij de wortels wordt voorkomen",
        ecosysteemdienst: "Productie",
        unit: "%",
    },
    // Klimaat
    {
        id: "C_SEQ",
        name: "Klimaat",
        description: "De potentie van de bodem om koolstof vast te leggen",
        ecosysteemdienst: "Klimaat",
        unit: null,
    },
    // Water
    {
        id: "GW_GWR",
        name: "Grondwateraanvulling",
        description:
            "De mate waarin regenwater kan infiltreren naar het diepere grondwater in plaats van oppervlakkig af te stromen naar de sloten",
        ecosysteemdienst: "Water",
        unit: null,
    },
    {
        id: "GW_NLEA",
        name: "Weerstand tegen stikstofuitspoeling",
        description:
            "Het vermogen van de bodem om stikstof in de bodem vast te houden in plaats van dat het uitspoelt naar het grondwater",
        ecosysteemdienst: "Water",
        unit: null,
    },
    {
        id: "GW_PEST",
        name: "Weerstand tegen middeluitspoeling",
        description:
            "Het vermogen van de bodem om gewasbeschermingsmiddelen te binden en af te breken, zodat ze niet in het grondwater terechtkomen",
        ecosysteemdienst: "Water",
        unit: null,
    },
    {
        id: "SW_NLEA",
        name: "Weerstand tegen stikstofafspoeling",
        description:
            "Het vermogen van de bodem om afstroming van stikstof naar het oppervlaktewater te voorkomen na hevige neerslag",
        ecosysteemdienst: "Water",
        unit: null,
    },
    {
        id: "SW_PLEA",
        name: "Weerstand tegen fosfaatafspoeling",
        description:
            "Het vermogen van de bodem om fosfaat te binden en afstroming naar het oppervlaktewater te voorkomen na hevige neerslag",
        ecosysteemdienst: "Water",
        unit: null,
    },
    // Nutriëntenkringloop
    {
        id: "NUT_K",
        name: "Kaliumbenutting",
        description:
            "De effectiviteit waarmee het gewas de aanwezige en bemeste kalium kan opnemen en benutten",
        ecosysteemdienst: "Nutriëntenkringloop",
        unit: null,
    },
    {
        id: "NUT_N",
        name: "Stikstofbenutting",
        description:
            "De effectiviteit waarmee het gewas de aanwezige en bemeste stikstof kan opnemen en benutten",
        ecosysteemdienst: "Nutriëntenkringloop",
        unit: null,
    },
    {
        id: "NUT_P",
        name: "Fosfaatbenutting",
        description:
            "De effectiviteit waarmee het gewas de aanwezige en bemeste fosfaat kan opnemen en benutten",
        ecosysteemdienst: "Nutriëntenkringloop",
        unit: null,
    },
]

// ── Ecosystem service groupings ────────────────────────────────────────────
// Derived from INDICATORS to stay in sync automatically.

/** Crop production: all indicators that drive agronomic soil quality */
export const GEWASPRODUCTIE_INDICATOR_IDS = INDICATORS.filter(
    (i) => i.ecosysteemdienst === "Productie",
).map((i) => i.id)

/** Carbon sequestration: soil carbon storage potential */
export const KOOLSTOFVASTLEGGING_INDICATOR_IDS = INDICATORS.filter(
    (i) => i.ecosysteemdienst === "Klimaat",
).map((i) => i.id)

/** Water quality & quantity: groundwater and surface water protection */
export const WATERKWALITEIT_INDICATOR_IDS = INDICATORS.filter(
    (i) => i.ecosysteemdienst === "Water",
).map((i) => i.id)

/** Nutrient recycling efficiency: how effectively crops utilise applied nutrients */
export const NUTRIENTENKRINGLOOP_INDICATOR_IDS = INDICATORS.filter(
    (i) => i.ecosysteemdienst === "Nutriëntenkringloop",
).map((i) => i.id)

export const ECOSYSTEEMDIENSTEN: Ecosysteemdienst[] = [
    "Productie",
    "Klimaat",
    "Water",
    "Nutriëntenkringloop",
]

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

/** Returns a hex fill colour for a 0–100 display score (used by MapLibre). */
export function getScoreColor(score100: number): string {
    const tier = getScoreTier(score100)
    if (tier === "green") return "#22c55e"
    if (tier === "yellow") return "#eab308"
    return "#ef4444"
}

/** Returns Tailwind classes for the score bar background based on score tier. */
export function getScoreBarClass(score100: number): string {
    const tier = getScoreTier(score100)
    if (tier === "green") return "bg-emerald-500"
    if (tier === "yellow") return "bg-amber-500"
    return "bg-red-500"
}

/** Returns Tailwind classes for a status dot based on score tier. */
export function getScoreDotClass(score100: number): string {
    const tier = getScoreTier(score100)
    if (tier === "green") return "bg-emerald-500"
    if (tier === "yellow") return "bg-amber-500"
    return "bg-red-500"
}

/** Returns Tailwind classes for text colored by score tier. */
export function getScoreTextClass(score100: number): string {
    const tier = getScoreTier(score100)
    if (tier === "green") return "text-emerald-600 dark:text-emerald-500"
    if (tier === "yellow") return "text-amber-600 dark:text-amber-500"
    return "text-red-600 dark:text-red-500"
}

/** Returns Tailwind classes for the badge variant based on score tier. */
export function getScoreBadgeClass(score100: number): string {
    const tier = getScoreTier(score100)
    if (tier === "green") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 border-transparent hover:bg-emerald-200 dark:hover:bg-emerald-800"
    if (tier === "yellow") return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 border-transparent hover:bg-amber-200 dark:hover:bg-amber-800"
    return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-transparent hover:bg-red-200 dark:hover:bg-red-900"
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

/** Returns all indicators for a given ecosystem service. */
export function getIndicatorsByEcosysteemdienst(
    ecosysteemdienst: Ecosysteemdienst,
): IndicatorInfo[] {
    return INDICATORS.filter((i) => i.ecosysteemdienst === ecosysteemdienst)
}
