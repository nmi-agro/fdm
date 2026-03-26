import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import type * as schema from "./db/schema"

export interface Fertilizer {
    p_id: string
    p_id_catalogue: string
    p_source: string
    p_name_nl: string | null
    p_name_en: string | null
    p_description: string | null
    p_app_method_options: ApplicationMethods[] | null
    p_app_amount: number | null
    p_date_acquiring: Date | null
    p_picking_date: Date | null
    p_dm: number | null
    p_density: number | null
    p_om: number | null
    p_a: number | null
    p_hc: number | null
    p_eom: number | null
    p_eoc: number | null
    p_c_rt: number | null
    p_c_of: number | null
    p_c_if: number | null
    p_c_fr: number | null
    p_cn_of: number | null
    p_n_rt: number | null
    p_n_if: number | null
    p_n_of: number | null
    p_n_wc: number | null
    p_no3_rt: number | null
    p_nh4_rt: number | null
    p_p_rt: number | null
    p_k_rt: number | null
    p_om: number | null
    p_eom: number | null
    p_eoc: number | null
    p_mg_rt: number | null
    p_ca_rt: number | null
    p_ne: number | null
    p_s_rt: number | null
    p_s_wc: number | null
    p_cu_rt: number | null
    p_zn_rt: number | null
    p_na_rt: number | null
    p_si_rt: number | null
    p_b_rt: number | null
    p_mn_rt: number | null
    p_ni_rt: number | null
    p_fe_rt: number | null
    p_mo_rt: number | null
    p_co_rt: number | null
    p_as_rt: number | null
    p_cd_rt: number | null
    p_cr_rt: number | null
    p_cr_vi: number | null
    p_pb_rt: number | null
    p_hg_rt: number | null
    p_cl_rt: number | null
    p_ef_nh3: number | null
    p_type: FertilizerType | null
    p_type_rvo: schema.fertilizersCatalogueTypeSelect["p_type_rvo"]
}
type FertilizerType = "manure" | "mineral" | "compost"

export interface FertilizerApplication {
    p_id: string
    p_id_catalogue: string
    p_name_nl: string | null
    p_app_amount: number | null
    p_app_method: ApplicationMethods | null
    p_app_date: Date
    p_app_id: string
}

export type FertilizerParameters =
    | "p_id_catalogue"
    | "p_source"
    | "p_name_nl"
    | "p_name_en"
    | "p_description"
    | "p_app_method_options"
    | "p_dm"
    | "p_density"
    | "p_om"
    | "p_a"
    | "p_hc"
    | "p_eom"
    | "p_eoc"
    | "p_c_rt"
    | "p_c_of"
    | "p_c_if"
    | "p_c_fr"
    | "p_cn_of"
    | "p_n_rt"
    | "p_n_if"
    | "p_n_of"
    | "p_n_wc"
    | "p_no3_rt"
    | "p_nh4_rt"
    | "p_p_rt"
    | "p_k_rt"
    | "p_mg_rt"
    | "p_ca_rt"
    | "p_ne"
    | "p_s_rt"
    | "p_s_wc"
    | "p_cu_rt"
    | "p_zn_rt"
    | "p_na_rt"
    | "p_si_rt"
    | "p_b_rt"
    | "p_mn_rt"
    | "p_ni_rt"
    | "p_fe_rt"
    | "p_mo_rt"
    | "p_co_rt"
    | "p_as_rt"
    | "p_cd_rt"
    | "p_cr_rt"
    | "p_cr_vi"
    | "p_pb_rt"
    | "p_hg_rt"
    | "p_cl_rt"
    | "p_ef_nh3"
    | "p_type"
    | "p_type_rvo"

export interface FertilizerParameterDescriptionItem {
    parameter: FertilizerParameters
    unit: string
    type: "numeric" | "enum" | "enum_multi" | "date" | "text"
    name: string
    description: string
    category:
        | "general"
        | "primary"
        | "secondary"
        | "trace"
        | "heavy_metals"
        | "physical"
    min?: number
    max?: number
    options?: {
        value:
            | FertilizerType
            | ApplicationMethods
            | schema.fertilizersCatalogueTypeSelect["p_type_rvo"]
        label: string
    }[]
}

export type FertilizerParameterDescription =
    FertilizerParameterDescriptionItem[]
