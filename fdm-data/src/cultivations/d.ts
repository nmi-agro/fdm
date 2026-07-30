export type CatalogueCultivationName = "brp"

export interface CatalogueCultivationItem {
  b_lu_source: CatalogueCultivationName
  b_lu_catalogue: string
  b_lu_name: string
  b_lu_name_en: string | null
  b_lu_harvestable: "once" | "none" | "multiple"
  b_lu_hcat3: string | null
  b_lu_hcat3_name: string | null
  b_lu_croprotation:
    | "other"
    | "clover"
    | "nature"
    | "potato"
    | "grass"
    | "rapeseed"
    | "starch"
    | "maize"
    | "cereal"
    | "sugarbeet"
    | "alfalfa"
    | "catchcrop"
  b_lu_harvestcat:
    | "HC010" // Standard
    | "HC020" // Grass
    | "HC031" // Maize
    | "HC040" // Root crops
    | "HC041" // Sugar beets
    | "HC042" // Potatoes
    | "HC050" // Cereals
    | null
  b_lu_yield: number
  b_lu_dm: number
  b_lu_hi: number
  b_lu_eom: number
  b_lu_eom_residue: number
  b_lu_n_harvestable: number
  b_lu_n_residue: number
  b_n_fixation: number
  b_lu_rest_oravib: boolean
  b_lu_variety_options: string[] | null
  b_lu_start_default: string | null
  b_date_harvest_default: string | null
  hash: string | null
}

export type CatalogueCultivation = CatalogueCultivationItem[]
