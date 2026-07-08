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

export interface CultivationsFormProps {
  options: CultivationOption[]
}
