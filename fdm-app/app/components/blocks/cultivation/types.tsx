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
}

/** Pre-fill values sourced from an accepted `CultivationSuggestion` (see `~/lib/cultivation-suggestion.server`). */
export interface CultivationDefaultValues {
  b_lu_catalogue: string
  b_lu_start: Date
}

export interface CultivationsFormProps {
  options: CultivationOption[]
  /** When set, pre-fills the form and auto-opens the dialog (used for accepted suggestions). */
  defaultValues?: CultivationDefaultValues
}
