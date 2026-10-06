import type { Bln3MeasureApplicabilityCollectedInputs, Bln3ScoreCollectedInputs } from "./types"

/**
 * Soil analysis parameters accepted by all BLN3 endpoints.
 */
const SOIL_ANALYSIS_FIELDS = [
  "a_ca_co_po",
  "a_cec_co",
  "a_clay_mi",
  "a_cn_fr",
  "a_k_cc",
  "a_k_co_po",
  "a_mg_cc",
  "a_mg_co_po",
  "a_n_pmn",
  "a_n_rt",
  "a_p_cc",
  "a_p_al",
  "a_p_wa",
  "a_ph_cc",
  "a_s_rt",
  "a_sand_mi",
  "a_silt_mi",
  "a_som_loi",
] as const

/**
 * Request fields sent to `POST /maatwerk/bln3/score/field`.
 *
 * `b_bufferstrip`, `b_lu_croprotation`, `b_lu_catalogue` and `isExcluded` are
 * deliberately absent: they are only used internally to decide whether a field
 * is excluded and use FDM vocabulary the NMI API does not accept.
 */
export const BLN3_SCORE_FIELDS = [
  "a_lat",
  "a_lon",
  "cultivations",
  "b_soiltype_agr",
  "b_gwl_class",
  ...SOIL_ANALYSIS_FIELDS,
  "a_ss_bcs",
  "a_sc_bcs",
  "a_rd_bcs",
  "a_ew_bcs",
  "a_cc_bcs",
  "a_gs_bcs",
  "a_p_bcs",
  "a_c_bcs",
  "a_rt_bcs",
  "measures",
] as const satisfies readonly (keyof Bln3ScoreCollectedInputs)[]

/**
 * Request fields sent to `POST /maatwerk/bln3/measure/applicability` and
 * `POST /maatwerk/bln3/measure/advice` (identical request schema).
 *
 * `measures` is intentionally not sent. Internal-only fields are absent for
 * the same reason as in {@link BLN3_SCORE_FIELDS}.
 */
export const BLN3_MEASURE_FIELDS = [
  "a_lat",
  "a_lon",
  "b_year",
  "cultivations",
  "b_soiltype_agr",
  "b_gwl_class",
  "b_gwl_glg",
  "b_gwl_ghg",
  "b_gwl_zcrit",
  "b_som_potential",
  "b_help_wenr",
  "b_sc_wenr",
  "b_drain",
  "d_ro_r",
  "p_app_method",
  ...SOIL_ANALYSIS_FIELDS,
] as const satisfies readonly (keyof Bln3MeasureApplicabilityCollectedInputs)[]

/** BLN3 endpoints for which a request payload can be built. */
export type Bln3Endpoint = "score" | "applicability" | "advice"

const FIELDS_BY_ENDPOINT: Record<Bln3Endpoint, readonly string[]> = {
  score: BLN3_SCORE_FIELDS,
  applicability: BLN3_MEASURE_FIELDS,
  advice: BLN3_MEASURE_FIELDS,
}

/**
 * Builds the request body for a BLN3 endpoint by picking only the parameters
 * documented for that endpoint. Keys with an `undefined` value are omitted and
 * the key order follows the whitelist, so the body is stable.
 *
 * @param endpoint - The BLN3 endpoint the body is intended for.
 * @param inputs - Collected inputs (may contain internal-only fields and the API key).
 * @returns A new object containing only the whitelisted, defined fields.
 */
export function pickBln3Payload(endpoint: Bln3Endpoint, inputs: object): Record<string, unknown> {
  const source = inputs as Record<string, unknown>
  const payload: Record<string, unknown> = {}
  for (const key of FIELDS_BY_ENDPOINT[endpoint]) {
    if (source[key] !== undefined) {
      payload[key] = source[key]
    }
  }
  return payload
}
