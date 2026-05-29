import Decimal from "decimal.js"

/**
 * BCS (BodemConditieScore) calculation utilities.
 *
 * Implements the D_BCS weighted formula and I_BCS normalization
 * as defined by the Open Bodem Index Calculator.
 *
 * Source: https://github.com/nmi-agro/Open-Bodem-Index-Calculator/blob/main/R/bodemconditiescore.R
 * Source: https://github.com/nmi-agro/Open-Bodem-Index-Calculator/blob/master/R/ph.R
 */

/** Crop category used for organic matter BCS scoring. */
export type OmCropCategory = "akkerbouw" | "grasland" | "mais" | "natuur"

/** Simplified soil type used for organic matter BCS scoring (OBIC soiltype.n). */
export type OmSoiltypeN = "klei" | "zand" | "loess" | "veen"

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
    /** Zuurgraad score (0–2, derived from pH-CaCl2 lab value) */
    a_ph_bcs?: number | null
    /** Organische stof score (0–2, derived from a_som_loi lab value) */
    a_som_bcs?: number | null
}

export interface BcsResult {
    /** Weighted total score */
    d_bcs: number
    /** Normalized indicator (0–1) */
    i_bcs: number
    /** Maximum possible D_BCS (always 40 — the official normalizer) */
    d_bcs_max: number
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
 * `a_ph_bcs` and `a_som_bcs` are derived from lab values via `derivePhBcs` / `deriveOmBcs`.
 */
export function calculateBcs(scores: BcsScores): BcsResult {
    const d = (v: number | null | undefined) => new Decimal(v ?? 0)

    const d_bcs_decimal = d(scores.a_cc_bcs).times(2)
        .add(d(scores.a_rd_bcs).times(3))
        .add(d(scores.a_sc_bcs).times(3))
        .add(d(scores.a_ew_bcs).times(3))
        .add(d(scores.a_ss_bcs).times(3))
        .add(d(scores.a_ph_bcs).times(3))
        .add(d(scores.a_som_bcs).times(3))
        .add(d(scores.a_gs_bcs).times(1))
        .sub(d(scores.a_p_bcs).times(2))
        .sub(d(scores.a_c_bcs).times(1))
        .sub(d(scores.a_rt_bcs).times(1))

    const d_bcs_floored = Decimal.max(d_bcs_decimal, ZERO)
    const i_bcs_decimal = Decimal.min(d_bcs_floored.div(D_BCS_NORMALIZER), ONE)

    return {
        d_bcs: d_bcs_floored.toNumber(),
        i_bcs: i_bcs_decimal.toNumber(),
        d_bcs_max: D_BCS_NORMALIZER.toNumber(),
    }
}

/**
 * Returns a colour band for the D_BCS score.
 * - `"red"`:    d_bcs < 20  (slecht / onvoldoende)
 * - `"orange"`: d_bcs < 30  (matig)
 * - `"green"`:  d_bcs >= 30 (goed / zeer goed)
 */
export function getBcsScoreColor(
    d_bcs: number,
): "red" | "orange" | "yellow" | "green" | "emerald" {
    if (d_bcs < 10) return "red"
    if (d_bcs < 20) return "orange"
    if (d_bcs < 30) return "yellow"
    if (d_bcs < 40) return "green"
    return "emerald"
}

/**
 * Returns the Dutch BCS score label for a D_BCS score.
 * - 0–10:  Slecht
 * - 10–20: Onvoldoende
 * - 20–30: Matig
 * - 30–40: Goed
 * - 40+:   Zeer goed
 */
export function getBcsScoreLabel(d_bcs: number): string {
    if (d_bcs < 10) return "Slecht"
    if (d_bcs < 20) return "Onvoldoende"
    if (d_bcs < 30) return "Matig"
    if (d_bcs < 40) return "Goed"
    return "Zeer goed"
}

/** Metadata for each BCS indicator — useful for rendering score inputs and tables. */
export const BCS_INDICATORS = [
    {
        key: "a_cc_bcs" as const,
        name: "Gewasbedekking",
        description: "% bodemoppervlak bedekt door vegetatie",
        weight: 2,
        direction: "positive" as const,
        source: "field" as const,
    },
    {
        key: "a_rd_bcs" as const,
        name: "Beworteling",
        description: "Bewortelingsdiepte, dichtheid en vertakking",
        weight: 3,
        direction: "positive" as const,
        source: "field" as const,
    },
    {
        key: "a_sc_bcs" as const,
        name: "Verdichting ondergrond",
        description: "Weerstand bij indrukken, plaatstructuren",
        weight: 3,
        direction: "positive" as const,
        source: "field" as const,
    },
    {
        key: "a_ew_bcs" as const,
        name: "Regenwormen",
        description: "Aantal en soort regenwormen",
        weight: 3,
        direction: "positive" as const,
        source: "field" as const,
    },
    {
        key: "a_ss_bcs" as const,
        name: "Bodemstructuur",
        description: "Kluitgrootte en aggregaatstabiliteit",
        weight: 3,
        direction: "positive" as const,
        source: "field" as const,
    },
    {
        key: "a_ph_bcs" as const,
        name: "Zuurgraad (pH)",
        description: "pH-CaCl2 afgeleid van laboratoriumanalyse",
        weight: 3,
        direction: "positive" as const,
        source: "lab" as const,
    },
    {
        key: "a_som_bcs" as const,
        name: "Organische stof",
        description: "Organische stofgehalte afgeleid van laboratoriumanalyse",
        weight: 3,
        direction: "positive" as const,
        source: "lab" as const,
    },
    {
        key: "a_gs_bcs" as const,
        name: "Gekleurde vlekken",
        description: "Roest/blauwe/grijze vlekken (wateroverlast)",
        weight: 1,
        direction: "positive" as const,
        source: "field" as const,
    },
    {
        key: "a_p_bcs" as const,
        name: "Plasvorming",
        description: "Waterplassen op het oppervlak",
        weight: 2,
        direction: "negative" as const,
        source: "field" as const,
    },
    {
        key: "a_c_bcs" as const,
        name: "Scheuren",
        description: "Zichtbare scheuren in de toplaag",
        weight: 1,
        direction: "negative" as const,
        source: "field" as const,
    },
    {
        key: "a_rt_bcs" as const,
        name: "Spoorvorming/vertrapping",
        description: "Wielsporen, hoefafdrukken",
        weight: 1,
        direction: "negative" as const,
        source: "field" as const,
    },
] as const

export type BcsIndicatorKey = (typeof BCS_INDICATORS)[number]["key"]

/**
 * Replicates OBIC `evaluate_logistic(x, b, x0, v, increasing=TRUE)`.
 * Uses the logistic with sign-flipped b for the increasing variant.
 */
function evaluateLogisticIncreasing(
    x: number,
    b: number,
    x0: number,
    v: number,
): number {
    const raw = Math.pow(1 + v * Math.exp(-b * (x - x0)), -1 / v)
    return Math.max(0, Math.min(1, raw))
}

/**
 * Derives a BCS pH score (0–2) from a D_PH_DELTA value.
 *
 * D_PH_DELTA = max(0, pH_optimum − A_PH_CC) as computed by the OBIC `calc_ph_delta`.
 * Replicates: bcs_ph = round(ind_ph(D_PH_DELTA) × 2)
 * where ind_ph(x) = 1 − evaluate_logistic(x, b=9, x0=0.3, v=0.4, increasing=TRUE)
 *
 * Source: https://github.com/nmi-agro/Open-Bodem-Index-Calculator/blob/master/R/ph.R
 */
export function derivePhBcs(d_ph_delta: number): 0 | 1 | 2 {
    const logistic = evaluateLogisticIncreasing(d_ph_delta, 9, 0.3, 0.4)
    const ind_ph = 1 - logistic
    return Math.round(ind_ph * 2) as 0 | 1 | 2
}

/**
 * OM score thresholds per crop category and soil type.
 * Source: https://github.com/nmi-agro/Open-Bodem-Index-Calculator/blob/master/R/bodemconditiescore.R
 *
 * Score 0 if a_som_loi < low, score 2 if > high, else score 1.
 */
const OM_THRESHOLDS: Record<
    Exclude<OmCropCategory, "natuur">,
    Record<OmSoiltypeN, { low: number; high: number }>
> = {
    akkerbouw: {
        klei:  { low: 2.2, high: 3.8 },
        zand:  { low: 3.0, high: 4.8 },
        loess: { low: 2.4, high: 3.3 },
        veen:  { low: 7.9, high: 14.6 },
    },
    grasland: {
        klei:  { low: 6.8, high: 12.9 },
        zand:  { low: 4.6, high: 6.6 },
        loess: { low: 5.1, high: 7.7 },
        veen:  { low: 15.5, high: 28.6 },
    },
    mais: {
        klei:  { low: 3.4, high: 6.2 },
        zand:  { low: 3.4, high: 4.8 },
        loess: { low: 2.6, high: 3.4 },
        veen:  { low: 8.7, high: 20.1 },
    },
}

/**
 * Derives a BCS organic matter score (0–2) from an a_som_loi lab measurement (%).
 *
 * Replicates the OBIC bcs_om scoring based on crop category × soil type quantile thresholds.
 * Natuur always returns 2. Other combinations use the 30th/70th percentile thresholds.
 *
 * Source: https://github.com/nmi-agro/Open-Bodem-Index-Calculator/blob/master/R/bodemconditiescore.R
 */
export function deriveOmBcs(
    a_som_loi: number,
    crop_category: OmCropCategory,
    soiltype_n: OmSoiltypeN,
): 0 | 1 | 2 {
    if (crop_category === "natuur") return 2
    const { low, high } = OM_THRESHOLDS[crop_category][soiltype_n]
    if (a_som_loi < low) return 0
    if (a_som_loi > high) return 2
    return 1
}
