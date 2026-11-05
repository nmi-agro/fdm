export type CatalogueMeasureName = "bln"

/**
 * A condition on a field or farm property, used in the applicability and effect size of a
 * measure. A condition either lists the allowed `values` or gives a numeric range with
 * `min` and/or `max`.
 */
export interface CatalogueMeasureCondition {
  /** Variable the condition applies to, e.g. `B_LU_BBWP` or `A_P_AL` */
  variable: string
  /** Allowed values of the variable */
  values?: (string | number | boolean)[]
  /** Lower bound of the variable */
  min?: number
  /** Upper bound of the variable */
  max?: number
}

/**
 * Effect of a measure on one score variable.
 */
export interface CatalogueMeasureImpact {
  /** Score variable, e.g. `S_SW_PLEA` */
  key: string
  /** Effect size, on the scale used by the source catalogue */
  value: number
}

/**
 * A block of effects of a measure: the base effects (no conditions) or the effects that
 * apply when all conditions are met.
 */
export interface CatalogueMeasureEffectSize {
  /** Description of the block, e.g. "Base effects" */
  comment: string | null
  /** Conditions under which the block applies; empty for the base effects */
  conditions: CatalogueMeasureCondition[]
  /** Effects per score variable */
  impacts: CatalogueMeasureImpact[]
}

export interface CatalogueMeasureItem {
  m_id: string // "bln_BM1", "bln_BM2", etc.
  m_source: CatalogueMeasureName | string // "bln"; future: "anlb", etc.
  m_name: string
  m_description: string | null
  m_summary: string | null
  m_source_url: string | null
  m_conflicts: string[] | null // m_id values, e.g. ["bln_BM2"]
  m_stage_applicability?: "field" | "farm" | null
  /** Cost indication: 0 (low), 1 (medium) or 2 (high) */
  m_effect_costs?: number | null
  /** How the effect is described: `qual` (fixed effect) or `classed` (depends on conditions) */
  m_effect_type?: string | null
  /** Score variables the measure affects, e.g. ["S_GW_NLEA", "S_NUT_N"] */
  m_impacts_score?: string[] | null
  /** Conditions that must be met for the measure to apply */
  m_applicability?: CatalogueMeasureCondition[] | null
  /** Effect sizes per score variable, with optional conditions */
  m_effect_size?: CatalogueMeasureEffectSize[] | null
  /** Where the measure comes from, e.g. a scheme or publication */
  m_origin?: string | null
  /** IDs of the measure in related schemes, e.g. `{ bbwp: "B121", ecoregeling24: "3a" }` */
  m_external_ids?: Record<string, string> | null
  hash?: string | null
}

export type CatalogueMeasure = CatalogueMeasureItem[]
