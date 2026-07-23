import Decimal from "decimal.js"
import { type CultivationForCropPlan, deriveCropPlanFractions } from "./crop-plan"
import { calcPhDelta, type SoiltypeAgr } from "./ph-delta"

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

/** Clay/loess soil types that require a_clay_mi for pH optimum calculation. */
const CLAY_LOESS_SOILTYPES = new Set<SoiltypeAgr>([
  "zeeklei",
  "rivierklei",
  "maasklei",
  "moerige_klei",
  "loess",
])

/**
 * Lab context needed to derive pH and organic matter BCS scores internally.
 * All fields are optional so each lab indicator can be derived independently.
 */
export interface BcsLabContext {
  // pH derivation inputs
  a_ph_cc?: number | null
  a_som_loi?: number | null
  b_soiltype_agr?: string | null
  /** Required only for clay/loess soils (zeeklei, rivierklei, maasklei, moerige_klei, loess). */
  a_clay_mi?: number | null
  d_cp_starch?: number | null
  d_cp_potato?: number | null
  d_cp_sugarbeet?: number | null
  d_cp_grass?: number | null
  d_cp_mais?: number | null
  b_lu_is_clover?: boolean | null
  // OM derivation inputs
  om_crop_category?: OmCropCategory | null
  om_soiltype_n?: OmSoiltypeN | null
}

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
}

export interface BcsResult {
  /** Weighted total score */
  d_bcs: number
  /** Normalized indicator (0–1) */
  i_bcs: number
  /** Maximum possible D_BCS (always 40 — the official normalizer) */
  d_bcs_max: number
  /** Derived pH BCS score (null when lab data insufficient) */
  a_ph_bcs: 0 | 1 | 2 | null
  /** Derived organic matter BCS score (null when lab data insufficient) */
  a_som_bcs: 0 | 1 | 2 | null
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
 * Null/undefined field scores are treated as 0 (missing observation).
 * pH and OM BCS scores are derived internally from `labContext` when provided.
 * The result is floored at 0 — negative totals are not meaningful.
 */
export function calculateBcs(scores: BcsScores, labContext?: BcsLabContext): BcsResult {
  const d = (v: number | null | undefined) => new Decimal(v ?? 0)

  // Derive pH BCS from lab context — skip for clay/loess soils when clay data is missing
  let a_ph_bcs: 0 | 1 | 2 | null = null
  if (labContext?.a_ph_cc != null && labContext?.a_som_loi != null && labContext?.b_soiltype_agr) {
    const soiltype = labContext.b_soiltype_agr as SoiltypeAgr
    const needsClay = CLAY_LOESS_SOILTYPES.has(soiltype)
    if (!needsClay || labContext.a_clay_mi != null) {
      const phDelta = calcPhDelta({
        b_soiltype_agr: soiltype,
        a_som_loi: labContext.a_som_loi,
        a_clay_mi: labContext.a_clay_mi ?? 0,
        a_ph_cc: labContext.a_ph_cc,
        d_cp_starch: labContext.d_cp_starch ?? 0,
        d_cp_potato: labContext.d_cp_potato ?? 0,
        d_cp_sugarbeet: labContext.d_cp_sugarbeet ?? 0,
        d_cp_grass: labContext.d_cp_grass ?? 0,
        d_cp_mais: labContext.d_cp_mais ?? 0,
        b_lu_is_clover: labContext.b_lu_is_clover ?? false,
      })
      if (phDelta != null) {
        a_ph_bcs = derivePhBcs(phDelta)
      }
    }
  }

  // Derive OM BCS from lab context — independent of pH derivation
  let a_som_bcs: 0 | 1 | 2 | null = null
  if (labContext?.a_som_loi != null && labContext?.om_crop_category && labContext?.om_soiltype_n) {
    a_som_bcs = deriveOmBcs(
      labContext.a_som_loi,
      labContext.om_crop_category,
      labContext.om_soiltype_n,
    )
  }

  const d_bcs_decimal = d(scores.a_cc_bcs)
    .times(2)
    .add(d(scores.a_rd_bcs).times(3))
    .add(d(scores.a_sc_bcs).times(3))
    .add(d(scores.a_ew_bcs).times(3))
    .add(d(scores.a_ss_bcs).times(3))
    .add(d(a_ph_bcs).times(3))
    .add(d(a_som_bcs).times(3))
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
    a_ph_bcs,
    a_som_bcs,
  }
}

/**
 * Maps a `b_soiltype_agr` value to the simplified soil type used for OM BCS scoring.
 */
function mapOmSoilType(soiltype: string | null | undefined): OmSoiltypeN | null {
  switch (soiltype as SoiltypeAgr | null | undefined) {
    case "dekzand":
    case "dalgrond":
    case "duinzand":
      return "zand"
    case "zeeklei":
    case "rivierklei":
    case "maasklei":
    case "moerige_klei":
      return "klei"
    case "loess":
      return "loess"
    case "veen":
      return "veen"
    default:
      return null
  }
}

/** Raw soil analysis values needed for BCS lab scoring. */
export interface BcsRawSoilData {
  a_ph_cc?: number | null
  a_som_loi?: number | null
  b_soiltype_agr?: string | null
  a_clay_mi?: number | null
}

/**
 * Derives a `BcsLabContext` from raw soil analysis data and cultivation history.
 *
 * All internal derivations (crop plan fractions, soil type mapping) are handled
 * here so callers only need to supply the collected raw inputs.
 */
export function deriveBcsLabContext(
  soilData: BcsRawSoilData,
  cultivations: CultivationForCropPlan[],
  bcsYear: number,
): BcsLabContext {
  const cropPlan = deriveCropPlanFractions(cultivations, bcsYear)
  const omSoilType = mapOmSoilType(soilData.b_soiltype_agr)

  return {
    a_ph_cc: soilData.a_ph_cc ?? null,
    a_som_loi: soilData.a_som_loi ?? null,
    b_soiltype_agr: (soilData.b_soiltype_agr as SoiltypeAgr) ?? null,
    a_clay_mi: soilData.a_clay_mi ?? null,
    d_cp_starch: cropPlan.d_cp_starch,
    d_cp_potato: cropPlan.d_cp_potato,
    d_cp_sugarbeet: cropPlan.d_cp_sugarbeet,
    d_cp_grass: cropPlan.d_cp_grass,
    d_cp_mais: cropPlan.d_cp_mais,
    b_lu_is_clover: cropPlan.b_lu_is_clover,
    om_crop_category: cropPlan.om_crop_category,
    om_soiltype_n: omSoilType ?? undefined,
  }
}

/**
 * Returns a colour band for the D_BCS score.
 * - `"red"`:     d_bcs < 10  (slecht)
 * - `"orange"`:  d_bcs < 20  (onvoldoende)
 * - `"yellow"`:  d_bcs < 30  (matig)
 * - `"green"`:   d_bcs < 40  (goed)
 * - `"emerald"`: d_bcs >= 40 (zeer goed)
 *
 * @param d_bcs - The D_BCS weighted total score
 * @returns One of `"red" | "orange" | "yellow" | "green" | "emerald"`
 */
export function getBcsScoreColor(d_bcs: number): "red" | "orange" | "yellow" | "green" | "emerald" {
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
 * Uses Decimal.js for precise arithmetic.
 */
function evaluateLogisticIncreasing(x: number, b: number, x0: number, v: number): number {
  const dX = new Decimal(x)
  const dB = new Decimal(b)
  const dX0 = new Decimal(x0)
  const dV = new Decimal(v)

  // 1 + v * exp(-b * (x - x0))
  const exponent = dB.neg().times(dX.minus(dX0))
  const inner = ONE.add(dV.times(Decimal.exp(exponent)))
  // inner^(-1/v)
  const raw = inner.pow(ONE.neg().div(dV))

  return Decimal.max(ZERO, Decimal.min(ONE, raw)).toNumber()
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
    klei: { low: 2.2, high: 3.8 },
    zand: { low: 3.0, high: 4.8 },
    loess: { low: 2.4, high: 3.3 },
    veen: { low: 7.9, high: 14.6 },
  },
  grasland: {
    klei: { low: 6.8, high: 12.9 },
    zand: { low: 4.6, high: 6.6 },
    loess: { low: 5.1, high: 7.7 },
    veen: { low: 15.5, high: 28.6 },
  },
  mais: {
    klei: { low: 3.4, high: 6.2 },
    zand: { low: 3.4, high: 4.8 },
    loess: { low: 2.6, high: 3.4 },
    veen: { low: 8.7, high: 20.1 },
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
