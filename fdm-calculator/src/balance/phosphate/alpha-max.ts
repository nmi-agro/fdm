import type { SoilAnalysis } from "@nmi-agro/fdm-core"

/**
 * Soil-type parameters for the phosphorus saturation degree (PSD), per agronomic soil type.
 *
 * DRAFT for discussion. The phosphorus sorption capacity is estimated as
 * `PSC = alpha_max · (Fe-ox + Al-ox)` (all in mmol/kg). An `alpha_max` of 0.5 is the value used for
 * Dutch agricultural soils (Breeuwsma & da Silva, 1992; Schoumans & Chardon, 2015). Laboratory studies
 * report roughly 0.3–0.7 depending on soil and method (van der Zee & van Riemsdijk, 1988; Freese et al.,
 * 1992); the ranges below express that uncertainty and are not soil-specific calibrations.
 *
 * The Fe-ox / Al-ox and bulk density values are only used when a field has no (estimated) oxalate data
 * or bulk density. Fe-ox / Al-ox are the median predictions per soil unit of van Doorn et al. (2024),
 * reported in van Doorn (2026), Tables S3.2 and S3.3. Bulk densities are indicative values based on
 * Chardon et al. (2007), Table 3.
 */
export interface PhosphateSoilTypeParameters {
  /** Central value of the maximum saturation factor (-) */
  alpha_max: number
  /** Plausible range of the maximum saturation factor (-) */
  alpha_max_range: [number, number]
  /** Whether the PSD based on oxalate extraction is considered meaningful for this soil type */
  psd_valid: boolean
  /** Fallback Fe-ox in the topsoil (mmol/kg): [grassland 5–10 cm, arable 10–25 cm] */
  a_fe_ox_default: [number, number]
  /** Fallback Al-ox in the topsoil (mmol/kg): [grassland 5–10 cm, arable 10–25 cm] */
  a_al_ox_default: [number, number]
  /** Fallback bulk density (g/cm³) */
  a_density_sa_default: number
  /** Short explanation for the discussion and the UI */
  note: string
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

/**
 * DRAFT table of PSD parameters per `b_soiltype_agr`. To be reviewed before use beyond a prototype.
 */
export const phosphateSoilTypeParameters: Record<SoilType, PhosphateSoilTypeParameters> = {
  dekzand: {
    alpha_max: 0.5,
    alpha_max_range: [0.4, 0.6],
    psd_valid: true,
    ...SAND,
    note: "Non-calcareous sand: the soil type for which alpha_max = 0.5 and the 25% PSD threshold were derived.",
  },
  duinzand: {
    alpha_max: 0.5,
    alpha_max_range: [0.3, 0.7],
    psd_valid: false,
    ...SAND,
    note: "Calcareous sand: P is mainly bound to Ca-carbonates, so the oxalate-based PSD is not meaningful.",
  },
  dalgrond: {
    alpha_max: 0.5,
    alpha_max_range: [0.35, 0.6],
    psd_valid: true,
    ...PEATY,
    note: "Peaty sand: part of the oxalate Fe/Al is organically bound, so the PSC may be overestimated.",
  },
  moerige_klei: {
    alpha_max: 0.5,
    alpha_max_range: [0.35, 0.6],
    psd_valid: true,
    ...PEATY,
    note: "Peaty clay: part of the oxalate Fe/Al is organically bound, so the PSC may be overestimated.",
  },
  zeeklei: {
    alpha_max: 0.5,
    alpha_max_range: [0.4, 0.6],
    psd_valid: true,
    ...CLAY,
    note: "Often calcareous: the oxalate extraction dissolves Ca-P, which can overestimate the PSD.",
  },
  rivierklei: {
    alpha_max: 0.5,
    alpha_max_range: [0.4, 0.6],
    psd_valid: true,
    ...CLAY,
    note: "Mostly non-calcareous clay with a relatively high PSC.",
  },
  maasklei: {
    alpha_max: 0.5,
    alpha_max_range: [0.4, 0.6],
    psd_valid: true,
    ...CLAY,
    note: "Mostly non-calcareous clay with a relatively high PSC.",
  },
  loess: {
    alpha_max: 0.5,
    alpha_max_range: [0.4, 0.6],
    psd_valid: true,
    a_fe_ox_default: [47, 46],
    a_al_ox_default: [37, 37],
    a_density_sa_default: 1.35,
    note: "Silty soil with an intermediate PSC.",
  },
  veen: {
    alpha_max: 0.5,
    alpha_max_range: [0.3, 0.6],
    psd_valid: true,
    a_fe_ox_default: [176, 183],
    a_al_ox_default: [70, 70],
    a_density_sa_default: 0.6,
    note: "Peat: oxalate also extracts organically bound Fe/Al, so the PSC is likely overestimated and the PSD underestimated.",
  },
}

/** Parameters used when the soil type is unknown: those of non-calcareous sand, with a wide range. */
export const phosphateSoilTypeParametersUnknown: PhosphateSoilTypeParameters = {
  ...phosphateSoilTypeParameters.dekzand,
  alpha_max_range: [0.3, 0.7],
  note: "Soil type unknown: parameters of non-calcareous sand with a wide range.",
}

/**
 * Returns the PSD parameters for a soil type, or those for an unknown soil type.
 *
 * @param b_soiltype_agr - The agronomic soil type of the field.
 * @returns The PSD parameters.
 */
export function getPhosphateSoilTypeParameters(
  b_soiltype_agr: SoilAnalysis["b_soiltype_agr"] | undefined,
): PhosphateSoilTypeParameters {
  return b_soiltype_agr
    ? (phosphateSoilTypeParameters[b_soiltype_agr] ?? phosphateSoilTypeParametersUnknown)
    : phosphateSoilTypeParametersUnknown
}
