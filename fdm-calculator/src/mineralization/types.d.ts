/**
 * @packageDocumentation
 * @module mineralization/types
 *
 * TypeScript type definitions for the Mineralisatie (Nitrogen Mineralization) module.
 * These types model the inputs, outputs, and intermediate data structures used by the
 * NMI API endpoints `/bemestingsplan/nsupply` and `/bemestingsplan/dyna`.
 */

// ─── N-Supply ─────────────────────────────────────────────────────────────────

/**
 * Identifies which soil–model combination is used to compute the N mineralization curve.
 *
 * | Value | Model | Key soil inputs |
 * |-------|-------|-----------------|
 * | `"minip"` | MINIP (organic matter decomposition) | `a_som_loi`, `a_clay_mi`, `a_silt_mi` |
 * | `"pmn"` | Potentially Mineralizable Nitrogen | `a_n_pmn`, `a_clay_mi` |
 * | `"century"` | CENTURY (carbon cycling) | `a_c_of`, `a_cn_fr`, `a_clay_mi`, `a_silt_mi` |
 */
export type NSupplyMethod = "minip" | "pmn" | "century"

/**
 * A single day in the N supply mineralization curve returned by the NMI
 * `/bemestingsplan/nsupply` endpoint.
 */
export interface NSupplyDataPoint {
    /** Day of year (1–366) */
    doy: number
    /** Cumulative mineralised N to this DOY (kg N/ha) */
    d_n_supply_actual: number
}

/**
 * Describes the quality and completeness of soil data for a given method.
 * Used to inform the user how reliable the mineralization estimate is.
 */
export interface DataCompleteness {
    /**
     * Parameters that were found in the soil data, including optional metadata
     * about the measurement source and date.
     */
    available: {
        /** Parameter key (e.g. `"a_som_loi"`) */
        param: string
        /** The measured value */
        value: number | string
        /** Data source identifier (e.g. lab code or `"nl-other-nmi"` for estimated values) */
        source?: string
        /** Date the sample was taken */
        date?: Date
    }[]
    /** Required parameters that were **not** found in the soil data */
    missing: string[]
    /** Optional parameters that were absent and will be estimated by the API */
    estimated: string[]
    /**
     * Overall completeness score from 0–100.
     * - Required params account for 80 points (proportional).
     * - Optional params account for 20 points (proportional).
     * - Parameters sourced from NMI estimates (`"nl-other-nmi"`) are not counted.
     */
    score: number
}

/**
 * The complete result for a single field's N supply calculation.
 * Returned by {@link getNSupply} and consumed by the farm overview and field detail pages.
 */
export interface NSupplyResult {
    /** FDM field identifier */
    b_id: string
    /** Human-readable field name */
    b_name: string
    /** Field area in hectares (used for farm-level weighting) */
    area: number
    /** The mineralization model used for this calculation */
    method: NSupplyMethod
    /** Daily cumulative N supply curve (365 or 366 data points) */
    data: NSupplyDataPoint[]
    /**
     * Total annual N mineralised (kg N/ha/yr).
     * Taken from the last point in `data` (`data[data.length - 1].d_n_supply_actual`).
     */
    totalAnnualN: number
    /** Soil data completeness assessment for the chosen method */
    completeness: DataCompleteness
    /**
     * If present, indicates the calculation failed.
     * The value is a user-facing Dutch-language error message.
     * Used by `getNSupplyForFarm` to isolate per-field failures.
     */
    error?: string
}

/**
 * Input bundle passed to the cached `getNSupply` function.
 * The caller (app server layer) is responsible for fetching field/soil/cultivation
 * data and building the `requestBody` via {@link buildNSupplyRequest}.
 */
export interface NSupplyComputeInput {
    /** FDM field identifier — included in the result and used as part of the cache key */
    b_id: string
    /** Human-readable field name — passed through to {@link NSupplyResult} */
    b_name: string
    /** Field area in hectares — passed through to {@link NSupplyResult} */
    area: number
    /** NMI API bearer token — redacted from the cache key hash */
    nmiApiKey: string
    /** Fully-formed request body for `POST /bemestingsplan/nsupply` */
    requestBody: Record<string, unknown>
    /** Model used — stored in the result */
    method: NSupplyMethod
    /** Pre-computed completeness assessment — stored in the result */
    completeness: DataCompleteness
}

// ─── DYNA ─────────────────────────────────────────────────────────────────────

/**
 * A single day's simulated nitrogen state from the DYNA model,
 * as returned by `POST /bemestingsplan/dyna`.
 */
export interface DynaDailyPoint {
    /** Calendar date of this simulation step (ISO 8601, e.g. `"2026-04-15"`) */
    b_date_calculation: string
    /** Simulated N availability — central estimate (kg N/ha, cumulative) */
    b_nw: number
    /** Lower bound of the N availability uncertainty band (kg N/ha) */
    b_nw_min: number
    /** Upper bound of the N availability uncertainty band (kg N/ha) */
    b_nw_max: number
    /** Recommended N availability target for this date (kg N/ha) */
    b_nw_recommended: number
    /** Cumulative N uptake by the crop — central estimate (kg N/ha) */
    b_n_uptake: number
    /** Lower bound of N uptake (kg N/ha) */
    b_n_uptake_min: number
    /** Upper bound of N uptake (kg N/ha) */
    b_n_uptake_max: number
    /** Recommended N uptake target (kg N/ha) */
    b_n_uptake_recommended: number
    /** Cumulative NO₃ leaching — central estimate (kg NO₃/ha) */
    b_no3_leach: number
    /** Lower bound of NO₃ leaching (kg NO₃/ha) */
    b_no3_leach_min: number
    /** Upper bound of NO₃ leaching (kg NO₃/ha) */
    b_no3_leach_max: number
    /** Recommended NO₃ leaching target (kg NO₃/ha) */
    b_no3_leach_recommended: number
}

/**
 * The season-total nitrogen balance components returned by the DYNA model.
 * All values are in kg N/ha for the full growing season.
 */
export interface DynaNitrogenBalance {
    /** Total N supply from all sources (kg N/ha) */
    b_nw: number
    /** Total N uptake by the crop (kg N/ha) */
    b_n_uptake: number
    /** N contribution from green manure / catch crop incorporation (kg N/ha) */
    b_n_greenmanure: number
    /** N supplied by organic fertilizers (kg N/ha) */
    b_n_fertilizer_organic: number
    /** N supplied by mineral (artificial) fertilizers (kg N/ha) */
    b_n_fertilizer_artificial: number
    /** N carried over from the preceding crop rotation entry (kg N/ha) */
    b_n_fertilizer_preceeding: number
}

/**
 * Fertilizer application advice generated by the DYNA model.
 * `null` when no additional application is required or when the model
 * could not generate a recommendation.
 */
export interface DynaFertilizerAdvice {
    /** Recommended N dose to apply (kg N/ha) */
    b_n_recommended: number
    /** Recommended application date (ISO 8601) */
    b_date_recommended: string
    /** N still available to the crop after applying the recommended dose (kg N/ha) */
    b_n_remaining: number
}

/**
 * The complete result of a DYNA nitrogen advice simulation for a single field.
 * Returned by {@link getDyna}.
 */
export interface DynaResult {
    /** FDM field identifier */
    b_id: string
    /**
     * Daily simulation points for the entire rotation period.
     * Filtered to the target calendar year before display.
     */
    calculationDyna: DynaDailyPoint[]
    /** Season-total nitrogen balance */
    nitrogenBalance: DynaNitrogenBalance
    /**
     * Fertilizer dose and timing recommendation.
     * `null` if no additional fertilization is needed or not computable.
     */
    fertilizingRecommendations: DynaFertilizerAdvice | null
    /**
     * Optimal harvest date recommendation.
     * `null` if not applicable or not computable.
     */
    harvestingRecommendation: { b_date_harvest: string } | null
}

/**
 * Input bundle passed to the cached `getDyna` function.
 * The caller (app server layer) is responsible for fetching all required FDM data
 * and building the `requestBody` via {@link buildDynaRequest}.
 */
export interface DynaComputeInput {
    /** FDM field identifier — included in the result and used as part of the cache key */
    b_id: string
    /** NMI API bearer token — redacted from the cache key hash */
    nmiApiKey: string
    /** Fully-formed request body for `POST /bemestingsplan/dyna` */
    requestBody: Record<string, unknown>
}
