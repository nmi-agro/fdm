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
  | "b_gwl_class"
>

/** Input of one field for the phosphate balance. */
export type PhosphateFieldInput = {
  field: Pick<Field, "b_id" | "b_area" | "b_bufferstrip">
  cultivations: Pick<
    Cultivation,
    | "b_lu"
    | "b_lu_catalogue"
    | "b_lu_name"
    | "b_lu_croprotation"
    | "m_cropresidue"
    | "b_lu_start"
    | "b_lu_end"
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
  | "b_lu_harvestable"
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
  /** Computed from a_p_ox, a_fe_ox and a_al_ox of the soil analyses (measured or NMI map values) */
  | "oxalate"
  /** Taken from a_p_sg; PSC from the oxalate data or the soil-type defaults */
  | "a_p_sg"
  /** Estimated from P-AL and the PSC (van Doorn 2026, Fig. S5.7): indicative only */
  | "estimated_from_p_al"
  /** Not enough data */
  | "missing"

/** A value with its range; `min` and `max` equal `value` when no uncertainty is known. */
export type ValueWithRange = { value: number; min: number; max: number }

/** Phosphorus saturation of the topsoil. */
export type PhosphateSaturation = {
  source: PhosphateSaturationSource
  /** Sources (`a_source`) of the soil analyses the values were taken from */
  analysis_sources: string[]
  b_soiltype_agr: SoilAnalysis["b_soiltype_agr"] | null
  alpha_max: number
  /** Phosphorus sorption capacity (mmol / kg) */
  psc: number | null
  /** Phosphorus saturation degree (%); a range only when estimated from P-AL */
  psd: ValueWithRange | null
  /** Oxalate-extractable P (mmol / kg) */
  a_p_ox: number | null
  /** P-AL (mg P2O5 / 100 g), when available */
  a_p_al: number | null
  /** Whether the oxalate-based PSD is meaningful for this soil type (shown with a warning when not) */
  psd_valid: boolean
  warnings: string[]
}

/** PSD threshold of the topsoil (van Doorn 2026, Eq. 5.5), capped at the agronomic target PSD. */
export type PhosphateSaturationThreshold = {
  /** Threshold used (%) */
  value: number | null
  source: "field" | "default_25"
  /** Environmental PSD threshold (%) */
  psd_env: number | null
  /** PSD at the agronomic P-AL target (%) */
  psd_agronomic: number | null
  /** Mean highest groundwater level (cm below surface) derived from b_gwl_class */
  ghg: number | null
  /** Critical ortho-P concentration (mg P / L) */
  c_p_env: number | null
  /** Langmuir affinity constant (m³ / mol) */
  k_l: number | null
  warnings: string[]
}

/** Years until a level is reached, as a class for display. */
export type YearsClass = "reached" | "lt_5" | "5_10" | "10_20" | "gt_20" | "not_reached"

/** Opbouwen / Onderhouden / Afbouwen, based on P-AL. */
export type PhosphateFrame = {
  name: "opbouwen" | "onderhouden" | "afbouwen" | null
  a_p_al: number | null
  /** Minimum desirable balance (kg P2O5 / ha / year); `null` when a deficit is acceptable */
  target_balance_min: number | null
}

/** Projection of the soil P status at the current balance. */
export type PhosphateProjection = {
  /** Balance per year minus fixation (kg P2O5 / ha / year) */
  balance_effective_per_year: number
  fixation: number
  /** Sampling depth used (m) and where it comes from */
  depth: { value: number; source: "soil_analysis" | "default_grassland" | "default_arable" }
  /** Bulk density used (g / cm³) and where it comes from */
  a_density_sa: { value: number; source: "soil_analysis" | "default_soil_type" }
  /** P-AL track: ΔP-AL = (balance − fixation) / buffer */
  p_al: {
    current: number
    /** kg P2O5 / ha per P-AL unit, scaled to the sampling depth */
    buffer: ValueWithRange
    delta_per_year: ValueWithRange
    /** Lower bound the P-AL declines towards: 45 (afbouwen) or 25 (onderhouden) */
    floor: number | null
    years: ValueWithRange | null
    years_class: YearsClass
  } | null
  /** PSD track (van Doorn 2026, Eq. 5.7): ΔP-ox = (balance − fixation) / (ρ · d · 0.31) */
  psd: {
    current: ValueWithRange
    delta_per_year: number
    threshold: PhosphateSaturationThreshold
    years: number | null
    years_class: YearsClass
  } | null
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
  frame: PhosphateFrame
  saturation: PhosphateSaturation
  projection: PhosphateProjection | null
  /** Missing data that makes the balance incomplete (Dutch, for display) */
  warnings: string[]
}

/** Result of one field within the farm balance: the balance, or the error that prevented it. */
export type PhosphateBalanceFieldResult = {
  b_id: string
  b_area: number
  b_bufferstrip: boolean
  balance?: PhosphateBalanceField
  errorMessage?: string
}

/** Phosphate balance of a farm: area-weighted averages per ha, plus the field results. */
export type PhosphateBalance = {
  balance: number
  supply: number
  removal: number
  fields: PhosphateBalanceFieldResult[]
  /** Whether the balance of one or more (non buffer strip) fields could not be calculated */
  hasErrors: boolean
  fieldErrorMessages: string[]
  /** Set when the farm balance could not be calculated at all (e.g. "No fields in input") */
  errorMessage?: string
}
