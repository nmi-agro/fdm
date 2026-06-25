import type { Bln3Score } from "@nmi-agro/fdm-calculator"

export const AGG_IDS: AggregationId[] = [
    "S_BLN",
    "S_BBWP",
    "S_WAT_BLN",
    "S_NUT_BLN",
    "S_CLIM_BLN",
    "S_PROD_BLN",
    "S_GW_QUANT_BLN",
    "S_GW_QUAL_BLN",
    "S_SW_QUAL_BLN",
    "S_PROD_BIOL_BLN",
    "S_PROD_CHEM_BLN",
    "S_PROD_PHYS_BLN",
]

export type AggregationId =
    | "S_BLN"
    | "S_BBWP"
    | "S_WAT_BLN"
    | "S_NUT_BLN"
    | "S_CLIM_BLN"
    | "S_PROD_BLN"
    | "S_GW_QUANT_BLN"
    | "S_GW_QUAL_BLN"
    | "S_SW_QUAL_BLN"
    | "S_PROD_BIOL_BLN"
    | "S_PROD_CHEM_BLN"
    | "S_PROD_PHYS_BLN"

export type AggregationInfo = {
    id: AggregationId
    name: string
    description: string
    parent: AggregationId | null
    color: string // Hex code or tailwind color class prefix
}

export const AGGREGATIONS: Record<AggregationId, AggregationInfo> = {
    S_BLN: {
        id: "S_BLN",
        name: "BLN Bodemkwaliteit",
        description:
            "De overkoepelende BLN-bodemkwaliteitsscore voor uw bedrijf of perceel.",
        parent: null,
        color: "#10b981", // Emerald-500
    },
    S_BBWP: {
        id: "S_BBWP",
        name: "BedrijfsBodemWaterPlan (BBWP)",
        description:
            "Beoordeling van de bodemkwaliteit gerelateerd aan waterbeheer, uitspoeling en afspoeling.",
        parent: null,
        color: "#2563eb", // Blue-600
    },
    S_WAT_BLN: {
        id: "S_WAT_BLN",
        name: "Water",
        description:
            "Beoordeling van de bodemfuncties gerelateerd aan waterberging, grondwateraanvulling en waterkwaliteit.",
        parent: "S_BLN",
        color: "#3b82f6", // Blue-500
    },
    S_NUT_BLN: {
        id: "S_NUT_BLN",
        name: "Nutriëntenkringloop",
        description:
            "De efficiëntie waarmee de bodem nutriënten (stikstof, fosfaat, kalium) vasthoudt en beschikbaar stelt aan het gewas.",
        parent: "S_BLN",
        color: "#8b5cf6", // Violet-500
    },
    S_CLIM_BLN: {
        id: "S_CLIM_BLN",
        name: "Klimaat",
        description:
            "De bijdrage van de bodem aan koolstofvastlegging en klimaatmitigatie.",
        parent: "S_BLN",
        color: "#78716c", // Stone-500
    },
    S_PROD_BLN: {
        id: "S_PROD_BLN",
        name: "Productie (OBI)",
        description:
            "De Open Bodem Index (OBI) score die de biologische, chemische en fysische geschiktheid van de bodem voor gewasproductie samenvat.",
        parent: "S_BLN",
        color: "#f97316", // Orange-500
    },
    S_GW_QUANT_BLN: {
        id: "S_GW_QUANT_BLN",
        name: "Grondwaterkwantiteit",
        description:
            "Het vermogen van de bodem om regenwater te infiltreren en vast te houden ter aanvulling van het grondwater en bescherming tegen droogte.",
        parent: "S_WAT_BLN",
        color: "#60a5fa", // Blue-400
    },
    S_GW_QUAL_BLN: {
        id: "S_GW_QUAL_BLN",
        name: "Grondwaterkwaliteit",
        description:
            "De weerstand van de bodem tegen uitspoeling van stikstof en gewasbeschermingsmiddelen naar het grondwater.",
        parent: "S_WAT_BLN",
        color: "#2563eb", // Blue-600
    },
    S_SW_QUAL_BLN: {
        id: "S_SW_QUAL_BLN",
        name: "Oppervlaktewaterkwaliteit",
        description:
            "De weerstand van de bodem tegen oppervlakkige afspoeling van nutriënten (stikstof, fosfaat) naar het oppervlaktewater.",
        parent: "S_WAT_BLN",
        color: "#1d4ed8", // Blue-700
    },
    S_PROD_BIOL_BLN: {
        id: "S_PROD_BIOL_BLN",
        name: "Biologische bodemkwaliteit",
        description:
            "De biologische gezondheid van de bodem, bepaald door het bodemleven en ziektewerend vermogen.",
        parent: "S_PROD_BLN",
        color: "#22c55e", // Green-500
    },
    S_PROD_CHEM_BLN: {
        id: "S_PROD_CHEM_BLN",
        name: "Chemische bodemkwaliteit",
        description:
            "De chemische bodemvruchtbaarheid, bepaald door de zuurgraad en de beschikbaarheid van hoofd- en spoorelementen.",
        parent: "S_PROD_BLN",
        color: "#eab308", // Yellow-500
    },
    S_PROD_PHYS_BLN: {
        id: "S_PROD_PHYS_BLN",
        name: "Fysische bodemkwaliteit",
        description:
            "De fysische bodemstructuur, bepaald door de aggregaatstabiliteit, bewerkbaarheid, bewortelbaarheid en weerstand tegen verdichting of verslemping.",
        parent: "S_PROD_BLN",
        color: "#ea580c", // Orange-600
    },
}

/**
 * Definitive hand-curated mapping between leaf-level aggregations and their impacting indicators.
 * An indicator can belong to multiple leaf aggregations (many-to-many relationship).
 */
export const LEAF_AGGREGATION_INDICATORS: Record<AggregationId, string[]> = {
    // Top-levels (non-leaves) do not have their own indicators directly; they inherit from their leaf children.
    S_BLN: [],
    S_WAT_BLN: [],
    S_PROD_BLN: [],

    // S_BBWP acts as both a top-level aggregation and maps directly to its indicators
    S_BBWP: [
        "GW_GWR",
        "GW_NLEA",
        "P_WRET",
        "P_DS",
        "P_WS",
        "NUT_N",
        "NUT_P",
        "SW_NLEA",
        "SW_PLEA",
    ],

    // Leaves under Water
    S_GW_QUANT_BLN: ["GW_GWR", "P_WRET"],
    S_GW_QUAL_BLN: ["GW_NLEA", "GW_PEST"],
    S_SW_QUAL_BLN: ["SW_NLEA", "SW_PLEA"],

    // Nutrient Cycle (direct leaf in S_BLN)
    S_NUT_BLN: ["NUT_K", "NUT_N", "NUT_P"],

    // Climate (direct leaf in S_BLN)
    S_CLIM_BLN: ["C_SEQ"],

    // Leaves under OBI/Productivity
    S_PROD_BIOL_BLN: ["B_DI", "B_SF"],
    S_PROD_CHEM_BLN: ["C_K", "C_MG", "C_N", "C_P", "C_PH", "C_S"],
    S_PROD_PHYS_BLN: [
        "P_AS",
        "P_CO",
        "P_CR",
        "P_DS",
        "P_DU",
        "P_RO",
        "P_SE",
        "P_PAW",
        "P_WO",
        "P_WS",
    ],
}

export const TOP_LEVEL_AGGREGATION_IDS: AggregationId[] = [
    "S_WAT_BLN",
    "S_NUT_BLN",
    "S_CLIM_BLN",
    "S_PROD_BLN",
]

export const LEAF_AGGREGATION_IDS: AggregationId[] = [
    "S_GW_QUANT_BLN",
    "S_GW_QUAL_BLN",
    "S_SW_QUAL_BLN",
    "S_NUT_BLN",
    "S_CLIM_BLN",
    "S_PROD_BIOL_BLN",
    "S_PROD_CHEM_BLN",
    "S_PROD_PHYS_BLN",
    "S_BBWP",
]

/**
 * Returns info about a single aggregation.
 */
export function getAggregationInfo(id: AggregationId): AggregationInfo {
    return AGGREGATIONS[id]
}

/**
 * Returns immediate children of a parent aggregation.
 */
export function getChildren(id: AggregationId): AggregationId[] {
    return Object.values(AGGREGATIONS)
        .filter((agg) => agg.parent === id)
        .map((agg) => agg.id)
}

/**
 * Returns the root of the hierarchy.
 */
export function getRootAggregation(): AggregationId {
    return "S_BLN"
}

/**
 * Recursively resolves and returns all indicator IDs that impact an aggregation.
 */
export function getIndicatorIdsForAggregation(id: AggregationId): string[] {
    const direct = LEAF_AGGREGATION_INDICATORS[id]
    if (direct && direct.length > 0) {
        return direct
    }

    // Otherwise, collect from children recursively
    const children = getChildren(id)
    const set = new Set<string>()
    for (const child of children) {
        for (const indId of getIndicatorIdsForAggregation(child)) {
            set.add(indId)
        }
    }
    return Array.from(set)
}

/**
 * Performs a reverse lookup to find all leaf aggregations impacted by a given indicator.
 */
export function getAggregationIdsForIndicator(
    indicatorId: string,
): AggregationId[] {
    const list: AggregationId[] = []
    for (const id of LEAF_AGGREGATION_IDS) {
        if (LEAF_AGGREGATION_INDICATORS[id]?.includes(indicatorId)) {
            list.push(id)
        }
    }
    return list
}

/**
 * Extract a single aggregation score (0-1 scale) safely from a Bln3Score object.
 */
export function getFieldAggregationScore(
    score: Bln3Score | null | undefined,
    aggId: AggregationId,
): number | null {
    if (!score?.aggregations) return null
    const found = score.aggregations.find((a) => a.aggregation_id === aggId)
    return found &&
        typeof found.score === "number" &&
        !Number.isNaN(found.score)
        ? found.score
        : null
}

export type FieldScoreInput = {
    b_id: string
    score: Bln3Score | null
}

export type FieldAreaInput = {
    b_id: string
    b_area: number | null
}

/**
 * Calculates the area-weighted average score of a specific aggregation across fields.
 * Excludes fields that are missing an area or a score for this aggregation.
 *
 * @returns Average score on a 0-1 scale, or null if no valid fields exist.
 */
export function computeAreaWeightedAggregation(
    fieldScores: FieldScoreInput[],
    fields: FieldAreaInput[],
    aggId: AggregationId,
): number | null {
    const areaByBid = new Map<string, number>()
    for (const f of fields) {
        if (f.b_area !== null && f.b_area > 0) {
            areaByBid.set(f.b_id, f.b_area)
        }
    }

    let totalWeightedScore = 0
    let totalArea = 0

    for (const fs of fieldScores) {
        if (!fs.score) continue
        const score01 = getFieldAggregationScore(fs.score, aggId)
        if (score01 === null) continue

        const area = areaByBid.get(fs.b_id)
        if (area === undefined) continue // Skip if field has no area

        totalWeightedScore += score01 * area
        totalArea += area
    }

    if (totalArea === 0) return null
    return totalWeightedScore / totalArea
}
