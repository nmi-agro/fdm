import type * as schema from "./db/schema"

export interface Harvest {
    b_id_harvesting: schema.cultivationHarvestingTypeSelect["b_id_harvesting"]
    b_lu_harvest_date: schema.cultivationHarvestingTypeSelect["b_lu_harvest_date"]
    b_lu: schema.cultivationHarvestingTypeSelect["b_lu"]
    harvestable: Harvestable
}

export interface Harvestable {
    b_id_harvestable: schema.harvestablesTypeSelect["b_id_harvestable"]
    harvestable_analyses: HarvestableAnalysis[]
}

export interface HarvestableAnalysis {
    b_id_harvestable_analysis: schema.harvestableAnalysesTypeSelect["b_id_harvestable_analysis"]
    b_lu_yield: schema.harvestableAnalysesTypeSelect["b_lu_yield"]
    b_lu_yield_fresh: schema.harvestableAnalysesTypeSelect["b_lu_yield_fresh"]
    b_lu_yield_bruto: schema.harvestableAnalysesTypeSelect["b_lu_yield_bruto"]
    b_lu_tarra: schema.harvestableAnalysesTypeSelect["b_lu_tarra"]
    b_lu_dm: schema.harvestableAnalysesTypeSelect["b_lu_dm"]
    b_lu_moist: schema.harvestableAnalysesTypeSelect["b_lu_moist"]
    b_lu_uww: schema.harvestableAnalysesTypeSelect["b_lu_uww"]
    b_lu_cp: schema.harvestableAnalysesTypeSelect["b_lu_cp"]
    b_lu_n_harvestable: schema.harvestableAnalysesTypeSelect["b_lu_n_harvestable"]
    b_lu_n_residue: schema.harvestableAnalysesTypeSelect["b_lu_n_residue"]
    b_lu_p_harvestable: schema.harvestableAnalysesTypeSelect["b_lu_p_harvestable"]
    b_lu_p_residue: schema.harvestableAnalysesTypeSelect["b_lu_p_residue"]
    b_lu_k_harvestable: schema.harvestableAnalysesTypeSelect["b_lu_k_harvestable"]
    b_lu_k_residue: schema.harvestableAnalysesTypeSelect["b_lu_k_residue"]
}

export type HarvestParameter =
    | "b_lu_yield"
    | "b_lu_yield_fresh"
    | "b_lu_yield_bruto"
    | "b_lu_tarra"
    | "b_lu_uww"
    | "b_lu_moist"
    | "b_lu_dm"
    | "b_lu_cp"
    | "b_lu_n_harvestable"

export type HarvestParameters = HarvestParameter[]

export interface HarvestParametersDefault {
    b_lu_yield?: schema.harvestableAnalysesTypeInsert["b_lu_yield"]
    b_lu_yield_bruto?: schema.harvestableAnalysesTypeInsert["b_lu_yield_bruto"]
    b_lu_yield_fresh?: schema.harvestableAnalysesTypeInsert["b_lu_yield_fresh"]
    b_lu_tarra?: schema.harvestableAnalysesTypeInsert["b_lu_tarra"]
    b_lu_dm?: schema.harvestableAnalysesTypeInsert["b_lu_dm"]
    b_lu_moist?: schema.harvestableAnalysesTypeInsert["b_lu_moist"]
    b_lu_uww?: schema.harvestableAnalysesTypeInsert["b_lu_uww"]
    b_lu_cp?: schema.harvestableAnalysesTypeInsert["b_lu_cp"]
    b_lu_n_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"]
}
