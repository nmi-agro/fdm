/**
 * @packageDocumentation
 * @module mineralization/types
 *
 * TypeScript type definitions for the nitrogen mineralization module, which models the input and
 * output of the NMI Dyna v2 endpoint (`POST /bemestingsplan/dyna/v2`).
 */

// ─── Dyna v2 ──────────────────────────────────────────────────────────────────

/** Application methods accepted by `POST /bemestingsplan/dyna/v2`. */
export type DynaV2ApplicationMethod =
  | "injection"
  | "shallow injection"
  | "incorporation"
  | "slotted coulter"
  | "spraying"
  | "broadcasting"
  | "spoke wheel"
  | "pocket placement"
  | "incorporation 2 tracks"
  | "narrowband"

/**
 * Request body for `POST /bemestingsplan/dyna/v2`.
 *
 * All dates are calendar dates formatted as `YYYY-MM-DD`. Cultivations, harvests and fertilizer
 * applications only cover the calendar year that is simulated.
 */
export interface DynaV2Request {
  /** Location of the field (WGS84). */
  field: { a_lat: number; a_lon: number }
  /** Soil parameters that are known for the field; missing parameters are estimated by the model. */
  soil_analysis?: Record<string, number | string>
  /** Cultivations, linked to harvests by `b_lu_id`. */
  cultivations?: { b_lu: string; b_lu_id: string; b_lu_start: string; b_lu_end: string }[]
  /** Harvests (measured or planned). Yield in kg DM/ha, N content in g N/kg. */
  harvests?: {
    b_lu_id: string
    b_date_harvest: string
    b_lu_yield?: number
    b_lu_n_harvestable?: number
    m_cropresidue?: boolean
  }[]
  /** Fertilizer applications; `p_app_amount` in kg product/ha. */
  fertilizer_applications?: {
    p_id: string
    p_app_amount: number
    p_date_fertilization: string
    p_app_method: DynaV2ApplicationMethod
  }[]
  /** Nutrient composition of the applied fertilizers (g/kg). */
  fertilizer_properties?: {
    p_id: string
    p_type_mineral: boolean
    p_n_rt?: number
    p_n_if?: number
    p_n_of?: number
    p_om?: number
    p_no3_rt?: number
    p_nh4_rt?: number
    p_s_rt?: number
  }[]
}

/** One day of a Dyna v2 simulation. Values are cumulative since the start of the simulation, in kg N/ha. */
export interface DynaV2DailyPoint {
  /** Calendar date (`YYYY-MM-DD`). */
  b_date_calculation: string
  /** Mineralized and plant-available nitrogen. */
  b_nw: number
  /** Nitrogen taken up by the crop. */
  b_n_uptake: number
  /** Nitrate leaching. */
  b_no3_leach: number
  /** Nitrogen still available for the crop: `b_nw − b_n_uptake`. */
  b_n_available: number
}

/** Workable nitrogen balance of a Dyna v2 simulation, in kg N/ha. Components the API does not report are 0. */
export interface DynaV2NitrogenBalance {
  /** Mineralized and plant-available nitrogen. */
  b_nw: number
  /** Nitrogen taken up by the crop. */
  b_n_uptake: number
  /** Plant-available nitrogen from mineral fertilizers. */
  b_n_fertilizer_mineral: number
  /** Plant-available nitrogen from organic fertilizers. */
  b_n_fertilizer_organic: number
  /** Plant-available nitrogen from fertilizers applied before the simulation period. */
  b_n_fertilizer_preceeding: number
  /** Plant-available nitrogen from green manure. */
  b_n_greenmanure: number
}

/** Result of a Dyna v2 simulation for one field. */
export interface DynaV2Result {
  /** Daily simulation, sorted by date. */
  series: DynaV2DailyPoint[]
  /** Workable nitrogen balance over the simulation period. */
  balance: DynaV2NitrogenBalance
}

/** Input of `getDynaV2`. */
export interface DynaV2ComputeInput {
  /** NMI API key; redacted before the input is used as cache key. */
  nmiApiKey: string
  /** Request body for the Dyna v2 endpoint. */
  request: DynaV2Request
  /**
   * Date of the calculation (`YYYY-MM-DD`). Part of the cache key, because the simulation uses
   * the latest weather forecast and therefore changes from day to day.
   */
  calculationDate: string
}
