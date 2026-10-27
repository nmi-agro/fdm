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
 * - Fallback Fe-ox / Al-ox (median per soil unit, van Doorn 2026, Tables S3.2 and S3.3) and bulk
 *   density (indicative, Chardon et al. 2007), used only when a field has no data of its own.
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
  /** Fallback Fe-ox in the topsoil (mmol/kg): [grassland 5–10 cm, arable 10–25 cm] */
  a_fe_ox_default: [number, number]
  /** Fallback Al-ox in the topsoil (mmol/kg): [grassland 5–10 cm, arable 10–25 cm] */
  a_al_ox_default: [number, number]
  /** Fallback bulk density (g/cm³) */
  a_density_sa_default: number
  /** Agronomic P-AL target for grassland (mg P2O5 / 100 g); arable land uses 40 for all soils */
  p_al_target_grassland: number
  /** Short explanation for the discussion and the UI; shown as a warning when relevant */
  note: string | null
}

type SoilType = NonNullable<SoilAnalysis["b_soiltype_agr"]>

type SoilUnitDefaults = Pick<
  PhosphateSoilTypeParameters,
  "a_fe_ox_default" | "a_al_ox_default" | "a_density_sa_default"
>
const SAND: SoilUnitDefaults = {
  a_fe_ox_default: [30, 29],
  a_al_ox_default: [35, 36],
  a_density_sa_default: 1.35,
}
const PEATY: SoilUnitDefaults = {
  a_fe_ox_default: [74, 74],
  a_al_ox_default: [39, 39],
  a_density_sa_default: 1.1,
}
const CLAY: SoilUnitDefaults = {
  a_fe_ox_default: [87, 86],
  a_al_ox_default: [27, 27],
  a_density_sa_default: 1.3,
}
const MINERAL = { alpha_max: 0.5, beta_max: 0.167, fixation: 20, psd_valid: true }

/**
 * DRAFT table of the soil-type parameters per `b_soiltype_agr`. To be reviewed before use beyond a prototype.
 */
export const phosphateSoilTypeParameters: Record<SoilType, PhosphateSoilTypeParameters> = {
  dekzand: {
    ...MINERAL,
    ...SAND,
    p_al_buffer: [65, 60, 70],
    p_al_target_grassland: 31,
    note: null,
  },
  duinzand: {
    ...MINERAL,
    ...SAND,
    psd_valid: false,
    p_al_buffer: [65, 60, 70],
    p_al_target_grassland: 31,
    note: "Kalkrijk zand: fosfaat is vooral aan kalk gebonden, de fosfaatverzadigingsgraad is hier weinig betrouwbaar.",
  },
  dalgrond: {
    ...MINERAL,
    ...PEATY,
    p_al_buffer: [65, 60, 70],
    p_al_target_grassland: 31,
    note: "Dalgrond: een deel van het ijzer en aluminium is organisch gebonden, de fosfaatbindingscapaciteit kan overschat zijn.",
  },
  moerige_klei: {
    ...MINERAL,
    ...PEATY,
    p_al_buffer: [50, 50, 50],
    p_al_target_grassland: 31,
    note: "Moerige klei: een deel van het ijzer en aluminium is organisch gebonden, de fosfaatbindingscapaciteit kan overschat zijn.",
  },
  zeeklei: {
    ...MINERAL,
    ...CLAY,
    p_al_buffer: [50, 50, 50],
    p_al_target_grassland: 31,
    note: "Zeeklei is vaak kalkrijk: de oxalaatextractie lost dan calciumfosfaat op, de fosfaatverzadigingsgraad kan overschat zijn.",
  },
  rivierklei: {
    ...MINERAL,
    ...CLAY,
    p_al_buffer: [50, 50, 50],
    p_al_target_grassland: 26,
    note: null,
  },
  maasklei: {
    ...MINERAL,
    ...CLAY,
    p_al_buffer: [50, 50, 50],
    p_al_target_grassland: 26,
    note: null,
  },
  loess: {
    ...MINERAL,
    p_al_buffer: [50, 50, 50],
    a_fe_ox_default: [47, 46],
    a_al_ox_default: [37, 37],
    a_density_sa_default: 1.35,
    p_al_target_grassland: 22,
    note: null,
  },
  veen: {
    alpha_max: 0.5,
    beta_max: 0.125,
    fixation: 0,
    psd_valid: true,
    p_al_buffer: [45, 40, 50],
    a_fe_ox_default: [176, 183],
    a_al_ox_default: [70, 70],
    a_density_sa_default: 0.6,
    p_al_target_grassland: 31,
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

/**
 * DRAFT mean highest groundwater level (GHG, cm below surface) per groundwater class (Gt), used for the
 * environmental PSD threshold. Typical values within the class definitions: a-classes and Gt I–III/V
 * without suffix 15 cm (GHG < 25), b-classes 32 cm (25–40), IV and VI 60 cm (40–80), VII 110 cm
 * (80–140), VIII 160 cm (> 140). To be reviewed.
 */
export const ghgPerGroundwaterClass: Record<NonNullable<SoilAnalysis["b_gwl_class"]>, number> = {
  I: 10,
  Ia: 10,
  Ic: 10,
  II: 15,
  IIa: 15,
  IIb: 32,
  IIc: 15,
  III: 15,
  IIIa: 15,
  IIIb: 32,
  IV: 60,
  IVu: 60,
  IVc: 60,
  V: 15,
  Va: 15,
  Vao: 15,
  Vad: 15,
  Vb: 32,
  Vbo: 32,
  Vbd: 32,
  sV: 32,
  sVb: 32,
  VI: 60,
  VIo: 60,
  VId: 60,
  VII: 110,
  VIIo: 110,
  VIId: 110,
  VIII: 160,
  VIIIo: 160,
  VIIId: 160,
}
