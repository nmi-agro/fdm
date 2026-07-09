/**
 * Input parameters for `requestSoilParameterEstimates`/`getSoilParameterEstimates`.
 * The centroid coordinates are the caller's responsibility to resolve — see
 * `collectInputForSoilParameterEstimates` (persisted fields, resolves via `getField`)
 * for the common case.
 */
export type SoilParameterEstimatesInput = {
  /** Latitude of the field centroid (WGS84) */
  a_lat: number
  /** Longitude of the field centroid (WGS84) */
  a_lon: number
  /** NMI API key for authentication */
  nmiApiKey: string | undefined
}

/**
 * The full response structure from the NMI Estimates API (`GET /estimates`),
 * unchanged from the original `fdm-app`-local implementation.
 */
export type SoilParameterEstimatesResponse = {
  a_al_ox: number
  a_ca_co: number
  a_ca_co_po: number
  a_caco3_if: number
  a_cec_co: number
  a_clay_mi: number
  a_cn_fr: number
  a_com_fr: number
  a_cu_cc: number
  a_fe_ox: number
  a_k_cc: number
  a_k_co: number
  a_k_co_po: number
  a_mg_cc: number
  a_mg_co: number
  a_mg_co_po: number
  a_n_pmn: number
  a_n_rt: number
  a_p_al: number
  a_p_cc: number
  a_p_ox: number
  a_p_rt: number
  a_p_sg: number
  a_p_wa: number
  a_ph_cc: number
  a_s_rt: number
  a_sand_mi: number
  a_silt_mi: number
  a_som_loi: number
  a_zn_cc: number
  b_soiltype_agr: string
  b_gwl_class: string
  b_gwl_ghg: number
  b_gwl_glg: number
  b_c_st03: number
  b_som_potential: number
  b_c_st03_potential: number
  b_c_delta: number
  cultivations: { year: number; b_lu_brp: number }[]
  cultivations_advanced: {
    year: number
    fields: {
      b_lu_brp: number
      b_area: number
      b_area_overlap: number
    }[]
  }[]
  a_source: string
  a_depth_upper: number
  a_depth_lower: number | undefined
}
