import type * as schema from "./db/schema"

export interface SoilAnalysis {
    a_id: schema.soilAnalysisTypeSelect["a_id"]
    a_date: schema.soilAnalysisTypeSelect["a_date"]
    a_depth_upper: schema.soilAnalysisTypeSelect["a_depth_upper"]
    a_depth_lower: schema.soilAnalysisTypeSelect["a_depth_lower"]
    a_source: schema.soilAnalysisTypeSelect["a_source"]
    a_al_ox: schema.soilAnalysisTypeSelect["a_al_ox"]
    a_c_of: schema.soilAnalysisTypeSelect["a_c_of"]
    a_ca_co: schema.soilAnalysisTypeSelect["a_ca_co"]
    a_ca_co_po: schema.soilAnalysisTypeSelect["a_ca_co_po"]
    a_caco3_if: schema.soilAnalysisTypeSelect["a_caco3_if"]
    a_cec_co: schema.soilAnalysisTypeSelect["a_cec_co"]
    a_clay_mi: schema.soilAnalysisTypeSelect["a_clay_mi"]
    a_cn_fr: schema.soilAnalysisTypeSelect["a_cn_fr"]
    a_com_fr: schema.soilAnalysisTypeSelect["a_com_fr"]
    a_cu_cc: schema.soilAnalysisTypeSelect["a_cu_cc"]
    a_density_sa: schema.soilAnalysisTypeSelect["a_density_sa"]
    a_fe_ox: schema.soilAnalysisTypeSelect["a_fe_ox"]
    a_k_cc: schema.soilAnalysisTypeSelect["a_k_cc"]
    a_k_co: schema.soilAnalysisTypeSelect["a_k_co"]
    a_k_co_po: schema.soilAnalysisTypeSelect["a_k_co_po"]
    a_mg_cc: schema.soilAnalysisTypeSelect["a_mg_cc"]
    a_mg_co: schema.soilAnalysisTypeSelect["a_mg_co"]
    a_mg_co_po: schema.soilAnalysisTypeSelect["a_mg_co_po"]
    a_n_pmn: schema.soilAnalysisTypeSelect["a_n_pmn"]
    a_n_rt: schema.soilAnalysisTypeSelect["a_n_rt"]
    a_nh4_cc: schema.soilAnalysisTypeSelect["a_nh4_cc"]
    a_nmin_cc: schema.soilAnalysisTypeSelect["a_nmin_cc"]
    a_no3_cc: schema.soilAnalysisTypeSelect["a_no3_cc"]
    a_p_al: schema.soilAnalysisTypeSelect["a_p_al"]
    a_p_cc: schema.soilAnalysisTypeSelect["a_p_cc"]
    a_p_ox: schema.soilAnalysisTypeSelect["a_p_ox"]
    a_p_rt: schema.soilAnalysisTypeSelect["a_p_rt"]
    a_p_sg: schema.soilAnalysisTypeSelect["a_p_sg"]
    a_p_wa: schema.soilAnalysisTypeSelect["a_p_wa"]
    a_ph_cc: schema.soilAnalysisTypeSelect["a_ph_cc"]
    a_s_rt: schema.soilAnalysisTypeSelect["a_s_rt"]
    a_sand_mi: schema.soilAnalysisTypeSelect["a_sand_mi"]
    a_silt_mi: schema.soilAnalysisTypeSelect["a_silt_mi"]
    a_som_loi: schema.soilAnalysisTypeSelect["a_som_loi"]
    a_zn_cc: schema.soilAnalysisTypeSelect["a_zn_cc"]
    b_gwl_class: schema.soilAnalysisTypeSelect["b_gwl_class"]
    b_soiltype_agr: schema.soilAnalysisTypeSelect["b_soiltype_agr"]
    b_id: schema.soilSamplingTypeSelect["b_id"]
    b_id_sampling: schema.soilSamplingTypeSelect["b_id_sampling"]
    b_depth: schema.soilSamplingTypeSelect["b_depth"]
    b_sampling_date: schema.soilSamplingTypeSelect["b_sampling_date"]
    b_sampling_geometry: schema.soilSamplingTypeSelect["b_sampling_geometry"]
}

export type SoilParameters =
    | "a_source"
    | "a_id"
    | "b_sampling_date"
    | "a_depth_upper"
    | "a_depth_lower"
    | "a_al_ox"
    | "a_c_of"
    | "a_ca_co"
    | "a_ca_co_po"
    | "a_caco3_if"
    | "a_cec_co"
    | "a_clay_mi"
    | "a_cn_fr"
    | "a_com_fr"
    | "a_cu_cc"
    | "a_density_sa"
    | "a_fe_ox"
    | "a_k_cc"
    | "a_k_co"
    | "a_k_co_po"
    | "a_mg_cc"
    | "a_mg_co"
    | "a_mg_co_po"
    | "a_n_pmn"
    | "a_n_rt"
    | "a_nh4_cc"
    | "a_nmin_cc"
    | "a_no3_cc"
    | "a_p_al"
    | "a_p_cc"
    | "a_p_ox"
    | "a_p_rt"
    | "a_p_sg"
    | "a_p_wa"
    | "a_ph_cc"
    | "a_s_rt"
    | "a_sand_mi"
    | "a_silt_mi"
    | "a_som_loi"
    | "a_zn_cc"
    | "b_gwl_class"
    | "b_soiltype_agr"

export interface CurrentSoilDataItem {
    parameter: SoilParameters
    value: number | string | null
    a_id: schema.soilAnalysisTypeSelect["a_id"]
    b_sampling_date: schema.soilSamplingTypeSelect["b_sampling_date"]
    a_depth_upper: schema.soilSamplingTypeSelect["a_depth_upper"]
    a_depth_lower: schema.soilSamplingTypeSelect["a_depth_lower"]
    a_source: schema.soilAnalysisTypeSelect["a_source"]
}

export type CurrentSoilData = CurrentSoilDataItem[]

export interface SoilParameterDescriptionItem {
    parameter: SoilParameters
    unit: string
    type: "numeric" | "enum" | "date" | "text"
    name: string
    description: string
    min?: number
    max?: number
    options?: {
        value: schema.gwlClasses | schema.soilTypes
        label: string
    }[]
}

export type SoilParameterDescription = SoilParameterDescriptionItem[]
