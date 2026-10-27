import type {
  BaseFertilizerApplication,
  Cultivation,
  CultivationCatalogue,
  Fertilizer,
  Field,
  Harvest,
  SoilAnalysis,
} from "@nmi-agro/fdm-core"

/**
 * Soil parameters used by the phosphate balance prototype.
 */
export type PhosphateSoilAnalysis = Pick<
  SoilAnalysis,
  | "a_id"
  | "a_source"
  | "b_sampling_date"
  | "a_depth_upper" // cm
  | "a_depth_lower" // cm
  | "a_p_ox" // mmol P / kg
  | "a_fe_ox" // mmol Fe / kg
  | "a_al_ox" // mmol Al / kg
  | "a_p_sg" // %
  | "a_p_al" // mg P2O5 / 100 g
  | "a_p_cc" // mg P / kg
  | "a_density_sa" // g / cm³
  | "b_soiltype_agr"
>

/** Input of one field for the phosphate balance. */
export type PhosphateFieldInput = {
  field: Pick<Field, "b_id" | "b_area" | "b_bufferstrip">
  cultivations: Pick<
    Cultivation,
    "b_lu" | "b_lu_catalogue" | "b_lu_croprotation" | "m_cropresidue" | "b_lu_start" | "b_lu_end"
  >[]
  harvests: Harvest[]
  soilAnalyses: Partial<PhosphateSoilAnalysis>[]
  fertilizerApplications: BaseFertilizerApplication[]
}

/** Cultivation catalogue properties used by the phosphate balance. */
export type PhosphateCultivationDetail = Pick<
  CultivationCatalogue,
  | "b_lu_catalogue"
  | "b_lu_croprotation"
  | "b_lu_yield" // kg DM / ha
  | "b_lu_hi" // -
  | "b_lu_p_harvestable" // g P2O5 / kg DM
  | "b_lu_p_residue" // g P2O5 / kg DM
>

/** Fertilizer properties used by the phosphate balance. */
export type PhosphateFertilizerDetail = Pick<
  Fertilizer,
  | "p_id_catalogue"
  | "p_p_rt" // g P2O5 / kg fertilizer
  | "p_type"
>

/** Input of a farm (or a set of fields) for the phosphate balance. */
export type PhosphateBalanceInput = {
  fields: PhosphateFieldInput[]
  fertilizerDetails: PhosphateFertilizerDetail[]
  cultivationDetails: PhosphateCultivationDetail[]
  timeFrame: { start: Date; end: Date }
}

/** One contribution to the balance (kg P2O5 / ha). */
export type PhosphateBalanceItem = { id: string; value: number }

/** Where the phosphorus saturation degree comes from. */
export type PhosphateSaturationSource =
  /** Computed from a_p_ox, a_fe_ox and a_al_ox of the soil analyses */
  | "oxalate"
  /** Taken from a_p_sg; PSC from the oxalate data or the soil-type defaults */
  | "a_p_sg"
  /** Estimated from P-AL and the soil-type default PSC (van Doorn 2026, Fig. S5.7) */
  | "estimated_from_p_al"
  /** Not enough data */
  | "missing"

/** Phosphorus saturation of the topsoil. */
export type PhosphateSaturation = {
  source: PhosphateSaturationSource
  /** Sources (`a_source`) of the soil analyses the values were taken from */
  analysis_sources: string[]
  b_soiltype_agr: SoilAnalysis["b_soiltype_agr"] | null
  alpha_max: number
  /** Phosphorus sorption capacity (mmol / kg) with its range from alpha_max */
  psc: { value: number; min: number; max: number } | null
  /** Phosphorus saturation degree (%) with its range from alpha_max */
  psd: { value: number; min: number; max: number } | null
  /** Oxalate-extractable P (mmol / kg) */
  a_p_ox: number | null
  /** Whether the oxalate-based PSD is meaningful for this soil type */
  psd_valid: boolean
  warnings: string[]
}

/** Effect of the yearly balance on the soil phosphorus stock of the sampled layer. */
export type PhosphateStock = {
  /** Sampling depth used (m) and where it comes from */
  depth: { value: number; source: "soil_analysis" | "default_grassland" | "default_arable" }
  /** Bulk density used (g / cm³) and where it comes from */
  a_density_sa: { value: number; source: "soil_analysis" | "default_soil_type" }
  /** Oxalate-extractable P stock in the sampled layer (kg P2O5 / ha) */
  stock_p_ox: number | null
  /** Change of P-ox per year at the current balance (mmol / kg / year) */
  delta_p_ox_per_year: number
  /** Change of the PSD per year at the current balance (% / year), with its range */
  delta_psd_per_year: { value: number; min: number; max: number }
  /** Years until the PSD reaches the reference value at the current balance, with its range */
  years_to_reference: { value: number; min: number; max: number } | null
  /** Reference PSD used for `years_to_reference` (%) */
  psd_reference: number
}

/** Phosphate balance of one field (kg P2O5 / ha for the timeframe). */
export type PhosphateBalanceField = {
  b_id: string
  b_area: number
  balance: number
  supply: {
    total: number
    fertilizers: {
      total: number
      mineral: number
      manure: number
      compost: number
      other: number
      applications: PhosphateBalanceItem[]
    }
  }
  removal: {
    total: number
    harvests: { total: number; harvests: PhosphateBalanceItem[] }
    residues: { total: number; cultivations: PhosphateBalanceItem[] }
  }
  saturation: PhosphateSaturation
  stock: PhosphateStock | null
}

/** Phosphate balance of a farm: area-weighted averages per ha, plus the field results. */
export type PhosphateBalance = {
  balance: number
  supply: number
  removal: number
  fields: PhosphateBalanceField[]
}
