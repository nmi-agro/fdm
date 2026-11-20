import type {
  BaseFertilizerApplication,
  Cultivation,
  CultivationCatalogue,
  Fertilizer,
  Field,
  Harvest,
  SoilAnalysis,
} from "@nmi-agro/fdm-core"
import type { FieldExclusionReason } from "../../shared/field-exclusion"

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
 * with a cultivation (crop rotation, e.g. from the BRP history) and registered data. Used for the
 * projection.
 *
 * - An earlier year counts only when it has registered fertilizer applications or harvests. Without
 *   any earlier year with data, `years` holds only this year and the balance is the balance of this
 *   year; a warning asks the user to add the data of the earlier years.
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
  /** Average fertilizer supply per year, over the years with registered fertilizer applications */
  fertilizers: number
  /** Leaching of the average balance (negative) */
  leaching: number
  /** Calendar years included in the average, oldest first (only this year without earlier data) */
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
  /** Sources (`a_source`) of the soil analyses the PSD (and PSC) were taken from */
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
  /** Source (`a_source`) of the soil analysis P-AL was taken from, or `null` */
  a_p_al_source: string | null
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
    /** Lower bound the P-AL declines towards: 45 (afbouwen) or 35 (onderhouden) */
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

/**
 * Overall judgement of a field: `good` when the soil P status is in the target zone and stays there,
 * or reaches it soon; `attention` when it moves the right way but slowly, or will leave the zone
 * within the horizon; `adjust` when it moves away from the zone or leaves it soon; `unknown` without
 * PSD and P-AL.
 */
export type PhosphateVerdict = "good" | "attention" | "adjust" | "unknown"

/**
 * Status of the soil phosphorus of a field relative to its target zone, with the direction and the
 * speed of the long-term average balance. See `assessPhosphateStatus`.
 */
export type PhosphateStatus = {
  /** What the balance should do: build up below the zone, maintain inside it, reduce above it */
  aim: "opbouwen" | "onderhouden" | "afbouwen" | null
  /**
   * The indicator whose bound sets the aim, or that is crossed first when the status is inside the
   * zone: `psd` (environmental threshold) or `p_al` (agronomic bound)
   */
  binding: "psd" | "p_al" | null
  /**
   * The PSD is above the environmental threshold while P-AL is not high (≤ 45): reducing is needed
   * for the environment, not for the yield
   */
  conflict: boolean
  /** Direction of the soil P status at the long-term average balance (after fixation) */
  direction: "up" | "stable" | "down"
  verdict: PhosphateVerdict
  /**
   * Years until the zone (with its margin) is reached, or, inside the zone, until it is left; `null`
   * when that does not happen at the current balance
   */
  years: ValueWithRange | null
  years_class: YearsClass
  /**
   * Years until P-AL declines to the agronomic minimum when the balance mines the soil, or `null`.
   * Shown when reducing for the environment, as the room left before the yield is at stake.
   */
  p_al_min_years: ValueWithRange | null
  /**
   * Long-term average balance (kg P2O5 / ha / year) that reaches the zone within the reach horizon
   * (outside the zone), or keeps the status in the zone for the stay horizon (inside the zone, when
   * it would leave it sooner); `null` when the current balance is fine. `limit` says whether the
   * balance should be at most (`max`) or at least (`min`) this value. `fertilizers` is the average
   * fertilizer supply per year that gives this balance at the current removal, mineralisation and
   * deposition (0 when even no fertilizer gives a higher balance); compare it with the phosphate
   * application standard before using it as advice.
   */
  balance_needed: { value: number; limit: "max" | "min"; fertilizers: number } | null
  /** Whether fertilizers supply phosphate in the long-term average (there is something to lower) */
  has_fertilizer_input: boolean
  /**
   * The judgement is indicative: the PSD is less reliable for this soil type, the threshold is the
   * general 25%, the soil data are NMI estimates only, or the PSD is missing and only P-AL is used
   */
  indicative: boolean
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

/**
 * Result of one field within the farm balance: the balance, the error that prevented it, or why the
 * field is left out (`exclusion`: buffer strip, nature or landscape element; no balance and no error).
 */
export type PhosphateBalanceFieldResult = {
  b_id: string
  b_area: number
  b_bufferstrip: boolean
  balance?: PhosphateBalanceField
  errorMessage?: string
  exclusion?: FieldExclusionReason
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
  /** Area (ha) and number of fields per verdict (see `assessPhosphateStatus`), without buffer strips */
  status_area: Record<PhosphateVerdict, { area: number; count: number }>
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
