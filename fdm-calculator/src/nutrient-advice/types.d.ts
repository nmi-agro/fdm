import type { CurrentSoilData } from "@nmi-agro/fdm-core"

/**
 * Represents the nutrient advice for a given year, as returned by the NMI API.
 * Each property corresponds to a specific nutrient requirement or norm.
 */
export type NutrientAdvice = {
    /** Nitrogen requirement (kg N/ha) */
    d_n_req: number
    /** Nitrogen norm (kg N/ha) */
    d_n_norm: number
    /** Nitrogen norm for manure (kg N/ha) */
    d_n_norm_man: number
    /** Phosphate norm (kg P2O5/ha) */
    d_p_norm: number
    /** Phosphate requirement (kg P2O5/ha) */
    d_p_req: number
    /** Potassium requirement (kg K2O/ha) */
    d_k_req: number
    /** Carbon requirement (kg C/ha) */
    d_c_req: number
    /** Calcium requirement (kg Ca/ha) */
    d_ca_req: number
    /** Sulfur requirement (kg S/ha) */
    d_s_req: number
    /** Magnesium requirement (kg Mg/ha) */
    d_mg_req: number
    /** Copper requirement (g Cu/ha) */
    d_cu_req: number
    /** Zinc requirement (g Zn/ha) */
    d_zn_req: number
    /** Cobalt requirement (g Co/ha) */
    d_co_req: number
    /** Manganese requirement (g Mn/ha) */
    d_mn_req: number
    /** Molybdenum requirement (g Mo/ha) */
    d_mo_req: number
    /** Sodium requirement (kg Na/ha) */
    d_na_req: number
    /** Boron requirement (g B/ha) */
    d_b_req: number
}

/**
 * Represents the full response structure from the NMI Nutrient Advice API.
 */
export type NutrientAdviceResponse = {
    /** Unique identifier for the request */
    request_id: string
    /** Indicates if the request was successful */
    success: boolean
    /** HTTP status code of the response */
    status: number
    /** Optional message providing more details about the response or errors */
    message: string | null
    /** Contains the actual nutrient advice data */
    data: {
        /** Nutrient advice values for the entire year */
        year: NutrientAdvice
        /**
         * Optional: Nutrient advice values per cut for grassland.
         * Only available if the most recent `b_lu_brp` crop code is `265`.
         */
        cut?: {
            yieldclass: "G" | "HM" | "LG" | "LM" | "M" | "VLG"
            cut: 1 | 2 | 3 | 4 | 5 | 6
            d_n_req: number
            d_p_req: number
            d_k_req: number
            d_s_req: number
        }[]
    }
}

/**
 * Defines the input parameters for the `requestNutrientAdvice` function.
 */
export type NutrientAdviceInputs = {
    /** The BRP cultivation catalogue identifier (e.g., "b_lu_1010") */
    b_lu_catalogue: string
    /** The centroid coordinates of the field [longitude, latitude] */
    b_centroid: [number, number]
    /** Current soil data for the field */
    currentSoilData: CurrentSoilData
    /** NMI API key for authentication */
    nmiApiKey: string | undefined
    /** Indicates if the field is a buffer strip */
    b_bufferstrip?: boolean
}
