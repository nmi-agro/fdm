import type { SoilAnalysis } from "@nmi-agro/fdm-core"

/**
 * Soil-type parameters of the phosphate balance prototype, per agronomic soil type.
 *
 * DRAFT for discussion.
 * - `alpha_max`: maximum saturation factor in `PSC = alpha_max · (Fe-ox + Al-ox)`. Fixed at 0.5 for all
 *   soils, the Dutch calibration (Breeuwsma & da Silva, 1992; Schoumans & Chardon, 2015) that the PSD
 *   thresholds were derived with. Soil-specific ranges are still to be decided.
 * - `beta_max`: scaling factor of the Langmuir sorption maximum used for the environmental PSD threshold
 *   (van Doorn, 2026, Eq. 5.5): 0.167, and 0.125 for peat (Schoumans & Chardon, 2015).
 * - `p_al_buffer`: kg P2O5 / ha needed to change P-AL by 1 mg P2O5 / 100 g in the arable layer
 *   (0–25 cm), with its range. Values as proposed in the issue (to be reviewed with Maarten van Doorn).
 * - `fixation`: kg P2O5 / ha / year that becomes unavailable at a balanced supply: 20 on mineral soils
 *   (Handboek Bodem en Bemesting), not set for peat.
 * - Fallback bulk density (indicative, Chardon et al. 2007), used only when a field has no data of
 *   its own. There are no fallback values for Fe-ox and Al-ox: they come from a soil analysis or
 *   from the NMI BodemSchat estimate of the location.
 */
export interface PhosphateSoilTypeParameters {
  /** Maximum saturation factor (-) */
  alpha_max: number
  /** Scaling factor of the Langmuir sorption maximum (-) */
  beta_max: number
  /** kg P2O5 / ha per P-AL unit in 0–25 cm: [central, low, high] */
  p_al_buffer: [number, number, number]
  /** kg P2O5 / ha / year fixed at a balanced supply */
  fixation: number
  /** Whether the oxalate-based PSD is considered meaningful for this soil type */
  psd_valid: boolean
  /** Fallback bulk density (g/cm³) */
  a_density_sa_default: number
  /** Short explanation for the discussion and the UI; shown as a warning when relevant */
  note: string | null
}

type SoilType = NonNullable<SoilAnalysis["b_soiltype_agr"]>

type SoilUnitDefaults = Pick<PhosphateSoilTypeParameters, "a_density_sa_default">
const SAND: SoilUnitDefaults = { a_density_sa_default: 1.35 }
const PEATY: SoilUnitDefaults = { a_density_sa_default: 1.1 }
const CLAY: SoilUnitDefaults = { a_density_sa_default: 1.3 }
const MINERAL = { alpha_max: 0.5, beta_max: 0.167, fixation: 20, psd_valid: true }

/**
 * DRAFT table of the soil-type parameters per `b_soiltype_agr`. To be reviewed before use beyond a prototype.
 */
export const phosphateSoilTypeParameters: Record<SoilType, PhosphateSoilTypeParameters> = {
  dekzand: {
    ...MINERAL,
    ...SAND,
    p_al_buffer: [65, 60, 70],
    note: null,
  },
  duinzand: {
    ...MINERAL,
    ...SAND,
    psd_valid: false,
    p_al_buffer: [65, 60, 70],
    note: "Kalkrijk zand: fosfaat is vooral aan kalk gebonden, de fosfaatverzadigingsgraad is hier weinig betrouwbaar.",
  },
  dalgrond: {
    ...MINERAL,
    ...PEATY,
    p_al_buffer: [65, 60, 70],
    note: "Dalgrond (voormalig veen): oxalaat lost ook organisch gebonden ijzer en aluminium op en de kaartschatting van Fe-ox en Al-ox is hier het minst zeker; de fosfaatverzadigingsgraad is waarschijnlijk onderschat.",
  },
  moerige_klei: {
    ...MINERAL,
    ...PEATY,
    p_al_buffer: [50, 50, 50],
    note: "Moerige klei: oxalaat lost ook organisch gebonden ijzer en aluminium op; de fosfaatverzadigingsgraad is waarschijnlijk onderschat.",
  },
  zeeklei: {
    ...MINERAL,
    ...CLAY,
    p_al_buffer: [50, 50, 50],
    note: "Zeeklei is vaak kalkrijk: de oxalaatextractie lost dan calciumfosfaat op, de fosfaatverzadigingsgraad kan overschat zijn.",
  },
  rivierklei: {
    ...MINERAL,
    ...CLAY,
    p_al_buffer: [50, 50, 50],
    note: null,
  },
  maasklei: {
    ...MINERAL,
    ...CLAY,
    p_al_buffer: [50, 50, 50],
    note: null,
  },
  loess: {
    ...MINERAL,
    p_al_buffer: [50, 50, 50],
    a_density_sa_default: 1.35,
    note: null,
  },
  veen: {
    alpha_max: 0.5,
    beta_max: 0.125,
    fixation: 0,
    psd_valid: true,
    p_al_buffer: [45, 40, 50],
    a_density_sa_default: 0.6,
    note: "Veen: oxalaat lost ook organisch gebonden ijzer en aluminium op, de fosfaatverzadigingsgraad is waarschijnlijk onderschat.",
  },
}

/** Parameters used when the soil type is unknown: those of non-calcareous sand. */
export const phosphateSoilTypeParametersUnknown: PhosphateSoilTypeParameters = {
  ...phosphateSoilTypeParameters.dekzand,
  note: "Grondsoort onbekend: de waarden van dekzand zijn gebruikt.",
}

/**
 * Returns the soil-type parameters, or those for an unknown soil type.
 *
 * @param b_soiltype_agr - The agronomic soil type of the field.
 * @returns The soil-type parameters.
 */
export function getPhosphateSoilTypeParameters(
  b_soiltype_agr: SoilAnalysis["b_soiltype_agr"] | undefined,
): PhosphateSoilTypeParameters {
  return b_soiltype_agr
    ? (phosphateSoilTypeParameters[b_soiltype_agr] ?? phosphateSoilTypeParametersUnknown)
    : phosphateSoilTypeParametersUnknown
}

type GroundwaterClass = NonNullable<SoilAnalysis["b_gwl_class"]>

/** Upper bound used for open-ended GHG ranges (e.g. "> 140 cm") in the groundwater class table. */
const GHG_OPEN_ENDED = 300

/**
 * Range of the mean highest groundwater level (GHG, cm below surface) per groundwater class (Gt),
 * following the definitions of the Dutch groundwater classes. An open-ended range ("> 25 cm") has
 * the maximum 300.
 */
export const ghgRangePerGroundwaterClass: Record<GroundwaterClass, { min: number; max: number }> = {
  I: { min: 0, max: 20 },
  Ia: { min: 0, max: 25 },
  Ic: { min: 25, max: GHG_OPEN_ENDED },
  II: { min: 0, max: 30 },
  IIa: { min: 0, max: 25 },
  IIb: { min: 25, max: 40 },
  IIc: { min: 40, max: GHG_OPEN_ENDED },
  III: { min: 0, max: 40 },
  IIIa: { min: 0, max: 25 },
  IIIb: { min: 25, max: 40 },
  IV: { min: 40, max: 80 },
  IVu: { min: 40, max: 80 },
  IVc: { min: 80, max: GHG_OPEN_ENDED },
  V: { min: 0, max: 40 },
  sV: { min: 0, max: 40 },
  sVb: { min: 25, max: 40 },
  Va: { min: 0, max: 25 },
  Vao: { min: 0, max: 25 },
  Vad: { min: 0, max: 25 },
  Vb: { min: 25, max: 40 },
  Vbo: { min: 25, max: 40 },
  Vbd: { min: 25, max: 40 },
  VI: { min: 40, max: 80 },
  VIo: { min: 40, max: 80 },
  VId: { min: 40, max: 80 },
  VII: { min: 80, max: 140 },
  VIIo: { min: 80, max: 140 },
  VIId: { min: 80, max: 140 },
  VIII: { min: 140, max: GHG_OPEN_ENDED },
  VIIIo: { min: 140, max: GHG_OPEN_ENDED },
  VIIId: { min: 140, max: GHG_OPEN_ENDED },
}

/**
 * Mean highest groundwater level (GHG, cm below surface) per groundwater class (Gt), used for the
 * environmental PSD threshold and the leaching groundwater factor. Derived from the ranges in
 * `ghgRangePerGroundwaterClass`: the middle of a closed range, and the lower bound of an open-ended
 * range (the shallowest level of the class, so the strictest threshold).
 */
export const ghgPerGroundwaterClass = Object.fromEntries(
  Object.entries(ghgRangePerGroundwaterClass).map(([gt, { min, max }]) => [
    gt,
    max >= GHG_OPEN_ENDED ? min : (min + max) / 2,
  ]),
) as Record<GroundwaterClass, number>
