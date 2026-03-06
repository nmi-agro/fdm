export interface BemestingsplanData {
    config: {
        name: string
        logo?: string
        logoInverted?: string
        coverImage?: string
    }
    farm: {
        name: string
        kvk?: string
    }
    year: string
    totalArea: number
    productiveArea: number
    norms: {
        nitrogen: number
        manure: number
        phosphate: number
    }
    normsFilling: {
        nitrogen: number
        manure: number
        phosphate: number
    }
    totalAdvice: {
        d_n_req: number
        d_p_req: number
        d_k_req: number
        d_c_req: number
    }
    plannedUsage: {
        p_dose_n: number
        p_dose_nw: number
        p_dose_p: number
        p_dose_k: number
        p_dose_eoc: number
    }
    omBalance?: {
        balance: number
        supply: number
        degradation: number
    }
    fields: Array<{
        id: string
        name: string
        area: number
        isBufferstrip: boolean
        mainCrop: string
        catchCrop?: string
        soil: {
            b_sampling_date?: string
            a_p_al?: number
            a_p_cc?: number
            a_k_cc?: number
            a_ph_cc?: number
            a_som_loi?: number
            b_soiltype_agr?: string
            a_clay_mi?: number
            a_sand_mi?: number
            a_silt_mi?: number
        }
        norms: {
            nitrogen: number
            manure: number
            phosphate: number
        }
        normsFilling: {
            nitrogen: number
            manure: number
            phosphate: number
        }
        advice: {
            d_n_req: number
            d_p_req: number
            d_k_req: number
            d_c_req: number
            d_mg_req: number
            d_s_req: number
            d_ca_req: number
            d_na_req: number
            d_cu_req: number
            d_zn_req: number
            d_co_req: number
            d_mn_req: number
            d_mo_req: number
            d_b_req: number
        }
        planned: {
            p_dose_n: number
            p_dose_nw: number
            p_dose_p: number
            p_dose_k: number
            p_dose_eoc: number
            p_dose_mg: number
            p_dose_s: number
            p_dose_ca: number
            p_dose_na: number
            p_dose_cu: number
            p_dose_zn: number
            p_dose_co: number
            p_dose_mn: number
            p_dose_mo: number
            p_dose_b: number
        }
        omBalance?: {
            balance: number
            supply: number
            supplyManure: number
            supplyCompost: number
            supplyCultivations: number
            supplyResidues: number
            degradation: number
        }
        applications: Array<{
            date: string
            product: string
            quantity: number
            p_dose_n: number
            p_dose_nw: number
            p_dose_p: number
            p_dose_k: number
        }>
    }>
}
