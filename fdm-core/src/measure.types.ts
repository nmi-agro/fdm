import type { CatalogueMeasureCondition, CatalogueMeasureEffectSize } from "@nmi-agro/fdm-data"

export type MeasureCatalogue = {
  m_id: string // "bln_BM1", etc.
  m_source: string // "bln", etc.
  m_name: string
  m_description: string | null
  m_summary: string | null
  m_source_url: string | null
  m_conflicts: string[] | null // m_id values
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
  /** IDs of the measure in related schemes, e.g. `{ bbwp: "B121" }` */
  m_external_ids?: Record<string, string> | null
  /** `active`, or `inactive` when the measure is no longer in its source catalogue */
  m_status?: string
}

/**
 * A single catalogue entry with its timestamps, as returned by `getMeasureFromCatalogue`.
 */
export type MeasureCatalogueDetails = MeasureCatalogue & {
  /** When the entry was first added to the catalogue */
  created: Date
  /** When the entry was last changed by a catalogue sync, or `null` if never changed */
  updated: Date | null
}

export type Measure = {
  b_id_measure: string
  m_id: string
  b_id: string
  m_start: Date | null
  m_end: Date | null // null = doorlopend / ongoing
  // Denormalized from measures_catalogue:
  m_name: string
  m_summary: string | null
  m_conflicts: string[] | null
  m_stage_applicability?: "field" | "farm" | null
}
