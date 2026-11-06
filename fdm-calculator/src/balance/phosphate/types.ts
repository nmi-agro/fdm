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
  | "a_som_loi" // %
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
  /**
   * Optional crop history per year (e.g. from the BRP via the NMI API), used for the long-term
   * average in earlier years without registered cultivations.
   */
  cultivation_history?: { year: number; b_lu_catalogue: string }[]
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
> & {
  /** Name of the cultivation, for messages */
  b_lu_name?: string | null
}

/** Fertilizer properties used by the phosphate balance. */
export type PhosphateFertilizerDetail = Pick<
  Fertilizer,
  | "p_id_catalogue"
  | "p_p_rt" // g P2O5 / kg fertilizer
  | "p_type"
>

/** The fields of one earlier year, for the long-term average balance. */
export type PhosphateBalanceHistoryYear = {
  timeFrame: { start: Date; end: Date }
  fields: PhosphateFieldInput[]
}

/** Input of a farm (or a set of fields) for the phosphate balance. */
export type PhosphateBalanceInput = {
  fields: PhosphateFieldInput[]
  fertilizerDetails: PhosphateFertilizerDetail[]
  cultivationDetails: PhosphateCultivationDetail[]
  timeFrame: { start: Date; end: Date }
  /**
   * Optional earlier years (most recent first). The projection then uses the average balance of
   * the years with data (crop rotation), instead of the balance of this year only.
   */
  history?: PhosphateBalanceHistoryYear[]
}

/**
 * Long-term average balance of a field (kg P2O5 / ha / year), over this year and the earlier years
 * with a cultivation (crop rotation, e.g. from the BRP history). Used for the projection.
 *
 * - Removal, mineralisation and deposition are averaged over all these years. In earlier years, a
 *   cultivation without a registered harvest gets the default yield and phosphate content of the
 *   cultivation catalogue (NMI API).
 * - The fertilizer supply is averaged over the years with registered fertilizer applications (this
 *   year always counts), because missing applications in earlier years usually mean "not
 *   registered" rather than "not fertilized".
 */
export type PhosphateLongTermBalance = {
  /** Average balance per year */
  balance: number
  /** Leaching of the average balance (negative) */
  leaching: number
  /** Calendar years included in the average, oldest first */
  years: number[]
  /** Years whose fertilizer applications are used for the average supply */
  fertilizer_years: number[]
  /** Earlier years in which (part of) the removal was estimated with catalogue defaults */
  estimated_removal_years: number[]
  /** What the user can add for a better long-term balance (Dutch, for display) */
  warnings: string[]
}

/** One contribution to the balance (kg P2O5 / ha). */
export type PhosphateBalanceItem = { id: string; value: number }

/** Where the phosphorus saturation degree comes from. */
export type PhosphateSaturationSource =
  /** Computed from a_p_ox, a_fe_ox and a_al_ox of the soil analyses (measured or NMI map values) */
  | "oxalate"
  /** Taken from a_p_sg; PSC from the oxalate data or the soil-type defaults */
  | "a_p_sg"
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
  /** Phosphorus saturation degree (%) */
  psd: ValueWithRange | null
  /** Oxalate-extractable P (mmol / kg) */
  a_p_ox: number | null
  /** P-AL (mg P2O5 / 100 g), when available */
  a_p_al: number | null
  /** Whether the oxalate-based PSD is meaningful for this soil type (shown with a warning when not) */
  psd_valid: boolean
  /** Soil-type note on the reliability of the PSD (e.g. peat, dalgrond), or `null` (Dutch, for display) */
  soil_note: string | null
  warnings: string[]
}

/** Environmental PSD threshold of the topsoil (van Doorn 2026, Eq. 5.5). */
export type PhosphateSaturationThreshold = {
  /** Threshold used (%) */
  value: number | null
  source: "field" | "default_25"
  /** Environmental PSD threshold (%) */
  psd_env: number | null
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
  /** Balance per year plus leaching (negative) minus fixation (kg P2O5 / ha / year) */
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

/** Phosphate supply by the fertilizers of one type (kg P2O5 / ha for the timeframe). */
export type PhosphateSupplyFertilizerType = {
  total: number
  applications: PhosphateBalanceItem[]
}

/** Phosphate supply by mineralisation of soil organic matter (kg P2O5 / ha for the timeframe). */
export type PhosphateSupplyMineralization = {
  total: number
  /** `mineral`: organic matter degradation; `peat`: peat oxidation by groundwater class; `none`: no data */
  track: "mineral" | "peat" | "none"
  /** Missing data or effects that are not calculated (Dutch, for display) */
  warnings: string[]
}

/** Atmospheric phosphate deposition (kg P2O5 / ha for the timeframe). */
export type PhosphateSupplyDeposition = { total: number }

/**
 * Phosphate leaching (kg P2O5 / ha for the timeframe, negative; runoff and erosion not included): estimated from the
 * surplus and not part of the balance.
 */
export type PhosphateLeaching = {
  total: number
  /** Saturation class: PSD relative to the field threshold */
  risk: "low" | "medium" | "high" | "unknown"
  /** Fraction of the surplus for the saturation class */
  fraction: number
  /** Groundwater factor (shallow groundwater > 1) */
  groundwater_factor: number
  /** fraction × groundwater_factor */
  factor: number
}

/** Phosphate balance of one field (kg P2O5 / ha for the timeframe). */
export type PhosphateBalanceField = {
  b_id: string
  b_area: number
  balance: number
  supply: {
    total: number
    /** Per fertilizer type (`p_type`), with the applications of that type */
    fertilizers: {
      total: number
      mineral: PhosphateSupplyFertilizerType
      manure: PhosphateSupplyFertilizerType
      compost: PhosphateSupplyFertilizerType
      other: PhosphateSupplyFertilizerType
    }
    mineralization: PhosphateSupplyMineralization
    deposition: PhosphateSupplyDeposition
  }
  removal: {
    total: number
    harvests: { total: number; harvests: PhosphateBalanceItem[] }
    residues: { total: number; cultivations: PhosphateBalanceItem[] }
  }
  /** Leaching from the surplus; not included in `balance` */
  leaching: PhosphateLeaching
  /** Average balance over the last years with data; the projection is based on it */
  long_term: PhosphateLongTermBalance
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
  /** Leaching (not included in `balance`) */
  leaching: number
  /** Long-term average balance per year (area-weighted over the fields) */
  long_term_balance: number
  /** Area-weighted averages per ha of the terms of the balance (kg P2O5 / ha) */
  terms: {
    supply: {
      mineral: number
      manure: number
      compost: number
      other: number
      mineralization: number
      deposition: number
    }
    removal: { harvests: number; residues: number }
  }
  fields: PhosphateBalanceFieldResult[]
  /** Whether the balance of one or more (non buffer strip) fields could not be calculated */
  hasErrors: boolean
  fieldErrorMessages: string[]
  /** Set when the farm balance could not be calculated at all (e.g. "No fields in input") */
  errorMessage?: string
}
