/**
 * Emission factors and conversion constants for the nitrous oxide (N₂O) emission.
 *
 * The values follow the Dutch National Emission Model for Agriculture (NEMA), as described in:
 * Van der Most, M., C. van Bruggen et al. (2025). Emissies naar lucht uit de landbouw berekend met
 * NEMA voor 1990-2023. WOT-technical report 283, WOT Natuur & Milieu, Wageningen.
 *
 * Emission factors are fractions: kg N emitted as N₂O-N per kg N.
 */

/**
 * Application methods that are considered as surface spreading. All other application methods are
 * considered as low-emission application (injection or incorporation).
 */
export const SURFACE_APPLICATION_METHODS: ReadonlySet<string> = new Set([
  "broadcasting",
  "spraying",
])

/**
 * Emission factors for manure, by application method, crop rotation group and soil (NEMA WOT-283, table 2.7).
 */
export const EF_N2O_MANURE = {
  surface: {
    grassland: { peat: 0.005, mineral: 0.001 },
    cropland: { peat: 0.005, mineral: 0.006 },
  },
  lowEmission: {
    grassland: { peat: 0.01, mineral: 0.003 },
    cropland: { peat: 0.01, mineral: 0.013 },
  },
} as const

/**
 * Emission factors for mineral fertilizers, the same for all types, by crop rotation group and soil
 * (NEMA WOT-283, table 3.2).
 */
export const EF_N2O_MINERAL = {
  grassland: { peat: 0.03, mineral: 0.008 },
  cropland: { peat: 0.03, mineral: 0.007 },
} as const

/**
 * Emission factor for sewage sludge (NEMA WOT-283, table 3.3).
 */
export const EF_N2O_SEWAGE_SLUDGE = 0.009

/**
 * The RVO fertilizer types (`p_type_rvo`) that are sewage sludge: liquid (113) and solid (114).
 */
export const SEWAGE_SLUDGE_TYPES_RVO: ReadonlySet<string> = new Set(["113", "114"])

/**
 * Emission factor for compost and other organic fertilizers (NEMA WOT-283, table 3.3).
 */
export const EF_N2O_OTHER_ORGANIC = 0.004

/**
 * Emission factor for the nitrogen in crop residues (NEMA WOT-283, section 3.3; IPCC 2006 default).
 */
export const EF_N2O_CROP_RESIDUES = 0.01

/**
 * Yearly emission from the mineralisation of organic soils, in kg N (as N₂O-N) per ha per year
 * (NEMA WOT-283, section 3.4):
 * - peat (`veen`): 233.5 kg N mineralised × 0.02 = 4.67
 * - peaty soil (`moerige_klei`, NEMA "moerige grond"): 204.5 kg N mineralised × 0.02 = 4.09
 */
export const YEARLY_N2O_ORGANIC_SOILS: Readonly<Record<string, number>> = {
  veen: 4.67,
  moerige_klei: 4.09,
}

/**
 * Indirect emission factor for the nitrogen volatilised as ammonia and deposited elsewhere
 * (NEMA WOT-283, table 4.1; IPCC 2006).
 */
export const EF_N2O_INDIRECT_VOLATILISATION = 0.01

/**
 * Indirect emission factor for the nitrogen lost by leaching and runoff (NEMA WOT-283, table 4.1; IPCC 2006).
 */
export const EF_N2O_INDIRECT_LEACHING = 0.0075

/**
 * Conversion from kg N (as N₂O-N) to kg N₂O (molar masses: 44 / 28).
 */
export const N2O_N_TO_N2O = 44 / 28

/**
 * Global warming potential of N₂O over 100 years (IPCC AR5), as used by NEMA WOT-283 (table 9.2).
 */
export const GWP_N2O = 265
