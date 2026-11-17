export interface Cultivation {
  b_lu: string
  b_lus?: string[] | null
  b_lu_catalogue: string
  b_lu_name: string
  b_lu_start: Date | null
  b_lu_end: Date | null
}

export interface CultivationOption {
  value: string
  label: string
  /** Years in which the RVO crop code is available, `null` when unknown. Enables the availability warning. */
  b_lu_ya?: number[] | null
}

/** Pre-fill values sourced from an accepted `CultivationSuggestion` (see `~/lib/cultivation-suggestion.server`). */
export interface CultivationDefaultValues {
  b_lu_catalogue: string
  b_lu_start: Date
  b_lu_end?: Date
}

export interface CultivationsFormProps {
  intent?: string
  b_id?: string
  b_lu?: string
  options: CultivationOption[]
  /** Last year that is checked for the RVO availability of cultivations without an end date. */
  lastCultivationAvailabilityYear?: number
  /** When set, pre-fills the form and auto-opens the dialog (used for accepted suggestions). */
  defaultValues?: CultivationDefaultValues
}
