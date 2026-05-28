import Decimal from "decimal.js"

/**
 * BCS (BodemConditieScore) calculation utilities.
 *
 * Implements the D_BCS weighted formula and I_BCS normalization
 * as defined by the Open Bodem Index Calculator.
 *
 * Source: https://github.com/nmi-agro/Open-Bodem-Index-Calculator/blob/main/R/bodemconditiescore.R
 */

export interface BcsScores {
    /** Bodemstructuur (0–2) */
    a_ss_bcs?: number | null
    /** Verdichting ondergrond (0–2) */
    a_sc_bcs?: number | null
    /** Beworteling (0–2) */
    a_rd_bcs?: number | null
    /** Regenwormen (0–2) */
    a_ew_bcs?: number | null
    /** Gewasbedekking (0–2) */
    a_cc_bcs?: number | null
    /** Gekleurde vlekken (0–2) */
    a_gs_bcs?: number | null
    /** Plasvorming (0–2, negative contribution) */
    a_p_bcs?: number | null
    /** Scheuren (0–2, negative contribution) */
    a_c_bcs?: number | null
    /** Spoorvorming/vertrapping (0–2, negative contribution) */
    a_rt_bcs?: number | null
    /** Derived organic matter score (0–2, from lab analysis) */
    bcs_om?: number | null
    /** Derived pH score (0–2, from lab analysis) */
    bcs_ph?: number | null
}

export interface BcsResult {
    /** Weighted total score */
    d_bcs: number
    /** Normalized indicator (0–1) */
    i_bcs: number
    /** Maximum possible D_BCS given the available inputs */
    d_bcs_max: number
    /** Whether derived lab scores (bcs_om, bcs_ph) were included */
    includes_lab_scores: boolean
}

const ZERO = new Decimal(0)
const ONE = new Decimal(1)
const D_BCS_NORMALIZER = new Decimal(40)

/**
 * Calculates the D_BCS weighted total and I_BCS normalized indicator.
 *
 * D_BCS = 2×CC + 3×(RD + SC + EW + SS + pH + OM) + 1×GS − 2×P − 1×(C + RT)
 * I_BCS = min(D_BCS / 40, 1.0)
 *
 * Null/undefined scores are treated as 0 (missing observation).
 * The result is floored at 0 — negative totals are not meaningful.
 */
export function calculateBcs(scores: BcsScores): BcsResult {
    const d = (v: number | null | undefined) => new Decimal(v ?? 0)

    const d_bcs_decimal = d(scores.a_cc_bcs).times(2)
        .add(d(scores.a_rd_bcs).times(3))
        .add(d(scores.a_sc_bcs).times(3))
        .add(d(scores.a_ew_bcs).times(3))
        .add(d(scores.a_ss_bcs).times(3))
        .add(d(scores.bcs_ph).times(3))
        .add(d(scores.bcs_om).times(3))
        .add(d(scores.a_gs_bcs).times(1))
        .sub(d(scores.a_p_bcs).times(2))
        .sub(d(scores.a_c_bcs).times(1))
        .sub(d(scores.a_rt_bcs).times(1))

    const d_bcs_floored = Decimal.max(d_bcs_decimal, ZERO)
    const i_bcs_decimal = Decimal.min(d_bcs_floored.div(D_BCS_NORMALIZER), ONE)

    const includes_lab_scores = scores.bcs_om != null || scores.bcs_ph != null

    // Max possible: all positives at 2, all negatives at 0
    const d_bcs_max = includes_lab_scores
        ? new Decimal(2).times(2).add(new Decimal(3).times(2).times(7)) // CC + 7 weight-3 fields
        : new Decimal(2).times(2).add(new Decimal(3).times(2).times(5)) // CC + 5 weight-3 fields

    return {
        d_bcs: d_bcs_floored.toNumber(),
        i_bcs: i_bcs_decimal.toNumber(),
        d_bcs_max: d_bcs_max.toNumber(),
        includes_lab_scores,
    }
}

/**
 * Returns a colour band for the I_BCS score.
 * - `"red"`:    I_BCS < 0.33  (poor)
 * - `"orange"`: I_BCS < 0.66  (moderate)
 * - `"green"`:  I_BCS >= 0.66 (good)
 */
export function getBcsScoreColor(i_bcs: number): "red" | "orange" | "green" {
    const score = new Decimal(i_bcs)
    if (score.lt(new Decimal("0.33"))) return "red"
    if (score.lt(new Decimal("0.66"))) return "orange"
    return "green"
}

/** Metadata for each BCS indicator — useful for rendering score inputs and tables. */
export const BCS_INDICATORS = [
    {
        key: "a_ss_bcs" as const,
        name: "Bodemstructuur",
        description: "Kluitgrootte en aggregaatstabiliteit",
        weight: 3,
        direction: "positive" as const,
    },
    {
        key: "a_sc_bcs" as const,
        name: "Verdichting ondergrond",
        description: "Weerstand bij indrukken, plaatstructuren",
        weight: 3,
        direction: "positive" as const,
    },
    {
        key: "a_rd_bcs" as const,
        name: "Beworteling",
        description: "Bewortelingsdiepte, dichtheid en vertakking",
        weight: 3,
        direction: "positive" as const,
    },
    {
        key: "a_ew_bcs" as const,
        name: "Regenwormen",
        description: "Aantal en soort regenwormen",
        weight: 3,
        direction: "positive" as const,
    },
    {
        key: "a_cc_bcs" as const,
        name: "Gewasbedekking",
        description: "% bodemoppervlak bedekt door vegetatie",
        weight: 2,
        direction: "positive" as const,
    },
    {
        key: "a_gs_bcs" as const,
        name: "Gekleurde vlekken",
        description: "Roest/blauwe/grijze vlekken (wateroverlast)",
        weight: 1,
        direction: "positive" as const,
    },
    {
        key: "a_p_bcs" as const,
        name: "Plasvorming",
        description: "Waterplassen op het oppervlak",
        weight: 2,
        direction: "negative" as const,
    },
    {
        key: "a_c_bcs" as const,
        name: "Scheuren",
        description: "Zichtbare scheuren in de toplaag",
        weight: 1,
        direction: "negative" as const,
    },
    {
        key: "a_rt_bcs" as const,
        name: "Spoorvorming/vertrapping",
        description: "Wielsporen, hoefafdrukken",
        weight: 1,
        direction: "negative" as const,
    },
] as const

export type BcsIndicatorKey = (typeof BCS_INDICATORS)[number]["key"]
