import type { Cultivation, Field, SoilAnalysis } from "@nmi-agro/fdm-core"

/**
 * Represents the collected input for a single cultivation, required for NL 2025 norm calculations.
 */
export type NL2025NormsInputForCultivation = Pick<
    Cultivation,
    "b_lu" | "b_lu_catalogue" | "b_lu_start" | "b_lu_end" | "b_lu_variety"
>

/**
 * Represents the complete set of inputs required to calculate all NL 2025 norms for a given farm.
 */
export type NL2025NormsInput = {
    /** Farm-level properties, such as derogation status. */
    farm: {
        is_derogatie_bedrijf: boolean
        has_grazing_intention: boolean
    }
    /** The field record from fdm-core, including its ID and centroid for location-based checks. */
    field: Pick<Field, "b_id" | "b_centroid" | "b_bufferstrip">
    /** An array of all cultivations on the field with their required norm inputs. */
    cultivations: NL2025NormsInputForCultivation[]
    /** The most recent soil analysis data available before the start of the cultivation. */
    soilAnalysis: Pick<SoilAnalysis, "a_p_cc" | "a_p_al">
}

/**
 * Defines the possible phosphate classes based on RVO's "Tabel Fosfaatgebruiksnormen 2025".
 * These classes are determined by P-CaCl2 and P-Al soil analysis values.
 */
export type FosfaatKlasse = "Arm" | "Laag" | "Neutraal" | "Ruim" | "Hoog"

/**
 * Defines the structure for a single nitrogen standard entry,
 * based on the RVO's "Tabel 2 Stikstof landbouwgrond 2025" and related documents.
 * This interface supports various complexities like different norms for regions,
 * specific varieties, derogation status, and sub-types for temporary grasslands.
 */
export interface NitrogenStandard {
    /**
     * The cultivation name as it appears in RVO's "Tabel 2 Stikstof landbouwgrond 2025".
     * This is used for descriptive purposes and as part of the function's return value.
     * @example "Grasland", "Akkerbouwgewassen, mais"
     */
    cultivation_rvo_table2: string
    /**
     * An array of BRP (Basisregistratie Percelen) cultivation codes that match this standard.
     * This allows a single standard entry to apply to multiple BRP codes.
     * @example ["nl_265", "nl_331"]
     */
    b_lu_catalogue_match: string[]
    /**
     * A general type classification for the cultivation (e.g., "grasland", "aardappel", "akkerbouw").
     * Used internally for conditional logic in norm determination.
     */
    type: string
    /**
     * Optional. A more specific classification for varieties, particularly for potatoes.
     * @example "consumptie_overig", "poot_overig"
     */
    is_winterteelt: boolean
    is_vanggewas: boolean
    norms?: {
        klei: { standard: number; nv_area: number }
        zand_nwc: { standard: number; nv_area: number }
        zand_zuid: { standard: number; nv_area: number }
        loess: { standard: number; nv_area: number }
        veen: { standard: number; nv_area: number }
    }
    sub_types?: Array<{
        omschrijving?: string
        period_description?: string
        period_start_month?: number
        period_start_day?: number
        period_end_month?: number
        period_end_day?: number
        varieties?: string[] // Added for potato varieties
        norms: {
            klei: { standard: number; nv_area: number }
            zand_nwc: { standard: number; nv_area: number }
            zand_zuid: { standard: number; nv_area: number }
            loess: { standard: number; nv_area: number }
            veen: { standard: number; nv_area: number }
        }
        winterteelt_voor_31_12?: {
            klei: { standard: number; nv_area: number }
            zand_nwc: { standard: number; nv_area: number }
            zand_zuid: { standard: number; nv_area: number }
            loess: { standard: number; nv_area: number }
            veen: { standard: number; nv_area: number }
        }
        winterteelt_na_31_12?: {
            klei: { standard: number; nv_area: number }
            zand_nwc: { standard: number; nv_area: number }
            zand_zuid: { standard: number; nv_area: number }
            loess: { standard: number; nv_area: number }
            veen: { standard: number; nv_area: number }
        }
    }>
}

/**
 * Defines the valid keys for different soil regions in the Netherlands.
 */
export type RegionKey = "klei" | "zand_nwc" | "zand_zuid" | "loess" | "veen"

/**
 * A utility type to represent nitrogen norms structured by region.
 */
export type NormsByRegion = {
    [key in RegionKey]: { standard: number; nv_area: number }
}
