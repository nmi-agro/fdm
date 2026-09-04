import type { GwlClasses, SoilTypes } from "@nmi-agro/fdm-core"

/**
 * A single cultivation entry for the BLN3 score request.
 */
export type Bln3Cultivation = {
  /** Year of the land use / cultivation */
  b_lu_year: number
  /** Crop cultivation code according to BRP */
  b_lu_brp: number
}

/**
 * A single measure entry for the BLN3 score request.
 * `measure_id` is the raw BLN measure identifier (e.g. "BM3"), not the
 * namespaced format used in fdm-core ("bln_BM3").
 */
export type Bln3Measure = {
  /** ID of the measure (e.g. "BM3", "G1") */
  measure_id: string
  /** Year in which the measure was taken */
  year: number
}

/**
 * Input parameters for the BLN3 score calculation, assembled from the FDM
 * database. Only `a_lat` and `a_lon` are required by the NMI API; all other
 * fields are optional and improve calculation quality when provided.
 */
export type Bln3ScoreCollectedInputs = {
  // ── Location (required) ──────────────────────────────────────────────────
  /** Latitude of the field centroid (WGS84; EPSG:4326) */
  a_lat: number
  /** Longitude of the field centroid (WGS84; EPSG:4326) */
  a_lon: number

  // ── Cultivation history ──────────────────────────────────────────────────
  /** Crop cultivations on the field (most recent first) */
  cultivations?: Bln3Cultivation[]

  // ── Field characteristics ────────────────────────────────────────────────
  /** Dutch agricultural soil type */
  b_soiltype_agr?: SoilTypes
  /** Groundwater class */
  b_gwl_class?: GwlClasses
  /** Buffer strip flag */
  b_bufferstrip?: boolean
  /** Crop rotation category of the target year's main cultivation */
  b_lu_croprotation?: string
  /** Catalogue code of the target year's main cultivation */
  b_lu_catalogue?: string
  /** Flag indicating field is excluded from BLN3 calculations */
  isExcluded?: boolean

  // ── Soil analysis ────────────────────────────────────────────────────────
  /** Calcium occupation of the CEC (%) */
  a_ca_co_po?: number
  /** Cation exchange capacity (mmol+ / kg) */
  a_cec_co?: number
  /** Clay content (%) */
  a_clay_mi?: number
  /** Carbon nitrogen ratio (-) */
  a_cn_fr?: number
  /** Potassium plant available (mg K / kg) */
  a_k_cc?: number
  /** Potassium occupation of CEC (%) */
  a_k_co_po?: number
  /** Magnesium plant available (mg Mg / kg) */
  a_mg_cc?: number
  /** Magnesium occupation of CEC (%) */
  a_mg_co_po?: number
  /** Potentially mineralizable nitrogen / microbial activity (mg N / kg) */
  a_n_pmn?: number
  /** Total nitrogen content (mg N / kg) */
  a_n_rt?: number
  /** Phosphorus plant available (PAE) (mg P / kg) */
  a_p_cc?: number
  /** Phosphate in ammonium lactate extraction (PAL) (mg P2O5 / 100g) */
  a_p_al?: number
  /** Phosphate extractable with water (Pw) (mg P2O5 / l) */
  a_p_wa?: number
  /** Soil acidity in CaCl2 (pH) */
  a_ph_cc?: number
  /** Total sulfur content (mg S / kg) */
  a_s_rt?: number
  /** Sand content (%) */
  a_sand_mi?: number
  /** Silt content (%) */
  a_silt_mi?: number
  /** Soil organic matter content (%) */
  a_som_loi?: number

  // ── BCS visual soil assessment (BodemConditieScore) ──────────────────────
  /** Soil structure BCS score (0–2) */
  a_ss_bcs?: number
  /** Subsoil compaction BCS score (0–2) */
  a_sc_bcs?: number
  /** Root development BCS score (0–2) */
  a_rd_bcs?: number
  /** Earthworm count BCS score (0–2) */
  a_ew_bcs?: number
  /** Crop cover BCS score (0–2) */
  a_cc_bcs?: number
  /** Coloured patches BCS score (0–2) */
  a_gs_bcs?: number
  /** Ponding BCS score, negative contribution (0–2) */
  a_p_bcs?: number
  /** Cracking BCS score, negative contribution (0–2) */
  a_c_bcs?: number
  /** Rutting/trampling BCS score, negative contribution (0–2) */
  a_rt_bcs?: number

  // ── Measures ─────────────────────────────────────────────────────────────
  /** Implemented soil management measures */
  measures?: Bln3Measure[]
}

/**
 * Full inputs for `getBln3Score`: collected field data plus the NMI API key.
 * Maps to the request body of `POST /maatwerk/bln3/score/field`.
 */
export type Bln3ScoreInputs = Bln3ScoreCollectedInputs & {
  /** NMI API key for authentication — redacted from cache hash */
  nmiApiKey: string | undefined
}

/**
 * A single indicator result from the BLN3 score calculation.
 */
export type Bln3IndicatorResult = {
  /** Indicator identifier (e.g. "B_DI", "C_N", "P_DS") */
  indicator_id: string
  /** Measured value in indicator unit */
  status: number
  /** Target value in the same unit */
  target: number
  /** Normalized score (0–1) comparing status to target */
  index: number
  /** Effect of selected measures on this indicator (0–1) */
  impact: number
  /** Final score: combination of index and impact (0–1) */
  score: number
}

/**
 * An aggregated score (e.g. S_BLN, OBI) combining multiple indicator scores.
 * Returned by the NMI API in the response data.
 */
export type Bln3AggregationResult = {
  /** Aggregation identifier (e.g. "S_BLN", "S_PROD_BIOL_BLN") */
  aggregation_id: string
  /** Aggregated score */
  score: number
}

/**
 * The BLN3 score result returned by `requestBln3Score` / `getBln3Score`.
 */
export type Bln3Score = {
  indicators: Bln3IndicatorResult[]
  /** Aggregation scores returned by the NMI API */
  aggregations?: Bln3AggregationResult[]
}

/**
 * Full response envelope from the NMI API for `POST /maatwerk/bln3/score/field`.
 * The `data.indicator` field (singular, as named in the API) is mapped to
 * `Bln3Score.indicators` (plural) in `requestBln3Score`.
 */
export type Bln3ScoreResponse = {
  request_id: string
  success: boolean
  status: number
  message: string | null
  data: {
    /** The API uses singular "indicator" — mapped to plural "indicators" in Bln3Score */
    indicator: Bln3IndicatorResult[]
    aggregations?: Bln3AggregationResult[]
  }
}

/**
 * Applicability status returned by the NMI API for a measure.
 */
export type Bln3MeasureApplicabilityStatus = "applicable" | "not yet applicable" | "inapplicable"

/**
 * A single measure applicability result from the NMI API (`POST /maatwerk/bln3/measure/applicability`).
 * `m_id` values from the API are prefixed with "bln_" in FDM (e.g. "bln_BM86").
 */
export type Bln3MeasureApplicabilityItem = {
  /** Identifier of the measure (namespaced with "bln_", e.g. "bln_BM86") */
  m_id: string
  /** Applicability status */
  applicability: Bln3MeasureApplicabilityStatus
  /** Explanation message in Dutch when not applicable (empty string when applicable) */
  message: string
}

/**
 * Input parameters collected for `requestBln3MeasureApplicability`.
 * `a_lat`, `a_lon`, and `b_year` are required; all other fields are optional.
 * Note: `measures` is intentionally NOT sent.
 */
export type Bln3MeasureApplicabilityCollectedInputs = {
  // ── Required ─────────────────────────────────────────────────────────────
  /** Latitude of the field centroid (WGS84; EPSG:4326) */
  a_lat: number
  /** Longitude of the field centroid (WGS84; EPSG:4326) */
  a_lon: number
  /** Calendar year for the applicability check */
  b_year: number

  // ── Cultivation history ──────────────────────────────────────────────────
  /** Crop cultivations on the field (most recent first) */
  cultivations?: Bln3Cultivation[]

  // ── Field characteristics ────────────────────────────────────────────────
  /** Dutch agricultural soil type */
  b_soiltype_agr?: SoilTypes
  /** Groundwater class */
  b_gwl_class?: GwlClasses
  /** Buffer strip flag */
  b_bufferstrip?: boolean
  /** Crop rotation category of the target year's main cultivation */
  b_lu_croprotation?: string
  /** Catalogue code of the target year's main cultivation */
  b_lu_catalogue?: string
  /** Flag indicating field is excluded from BLN3 calculations */
  isExcluded?: boolean

  // Groundwater / soil potential estimates (optional)
  b_gwl_glg?: number
  b_gwl_ghg?: number
  b_gwl_zcrit?: number
  b_som_potential?: number
  b_help_wenr?: string
  b_sc_wenr?: number
  b_drain?: boolean
  d_ro_r?: number

  /** Application methods applied on the field */
  p_app_method?: string[]

  // ── Soil analysis ────────────────────────────────────────────────────────
  a_ca_co_po?: number
  a_cec_co?: number
  a_clay_mi?: number
  a_cn_fr?: number
  a_k_cc?: number
  a_k_co_po?: number
  a_mg_cc?: number
  a_mg_co_po?: number
  a_n_pmn?: number
  a_n_rt?: number
  a_p_cc?: number
  a_p_al?: number
  a_p_wa?: number
  a_ph_cc?: number
  a_s_rt?: number
  a_sand_mi?: number
  a_silt_mi?: number
  a_som_loi?: number
}

/**
 * Full inputs for `getBln3MeasureApplicability`: collected field data plus the NMI API key.
 */
export type Bln3MeasureApplicabilityInputs = Bln3MeasureApplicabilityCollectedInputs & {
  /** NMI API key for authentication — redacted from cache hash */
  nmiApiKey: string | undefined
}

/**
 * The BLN3 measure applicability result returned by `requestBln3MeasureApplicability` / `getBln3MeasureApplicability`.
 */
export type Bln3MeasureApplicabilityResult = {
  applicability: Bln3MeasureApplicabilityItem[]
}

/**
 * Response envelope from the NMI API for `POST /maatwerk/bln3/measure/applicability`.
 */
export type Bln3MeasureApplicabilityResponse = {
  request_id: string
  success: boolean
  status: number
  message: string | null
  data: {
    applicability: {
      m_id: string
      applicability: Bln3MeasureApplicabilityStatus
      message: string
    }[]
  }
}

/**
 * A single candidate measure and its predicted impact on one indicator, as
 * returned by `POST /maatwerk/bln3/measure/advice`. `measure_impact` uses a
 * consistent unit across indicators (confirmed with NMI), so it is valid to
 * sum or compare it across indicators and fields without normalization.
 * Higher is always better.
 */
export type Bln3IndicatorMeasureAdvice = {
  /** ID of the measure (namespaced with "bln_", e.g. "bln_BM226") */
  m_id: string
  /** Predicted impact of taking this measure on this indicator; higher is always better */
  measure_impact: number
}

/**
 * Ranked measure advice for a single BLN3 indicator. `measures` is already
 * sorted descending by `measure_impact` by the NMI API. An empty array means
 * no measure meaningfully improves this indicator further.
 */
export type Bln3IndicatorAdvice = {
  /** Indicator identifier (e.g. "B_DI", "C_N", "P_DS") */
  indicator: string
  measures: Bln3IndicatorMeasureAdvice[]
}

/**
 * Input parameters for `requestBln3MeasureAdvice`. The request body is
 * identical to `measure/applicability`'s `bln_model`, so the same collected
 * inputs type is reused.
 */
export type Bln3MeasureAdviceInputs = Bln3MeasureApplicabilityCollectedInputs & {
  /** NMI API key for authentication — redacted from cache hash */
  nmiApiKey: string | undefined
}

/**
 * The BLN3 measure advice result returned by `requestBln3MeasureAdvice` / `getBln3MeasureAdvice`.
 *
 * Note: the NMI API does not guarantee `indicator_advice[].measures` excludes
 * measures that are inapplicable to the field or already taken. Callers must
 * always cross-reference results against a fresh `measure/applicability`
 * call (the definitive source of truth for applicability) before display.
 */
export type Bln3MeasureAdviceResult = {
  indicator_advice: Bln3IndicatorAdvice[]
}

/**
 * Response envelope from the NMI API for `POST /maatwerk/bln3/measure/advice`.
 */
export type Bln3MeasureAdviceResponse = {
  request_id: string
  success: boolean
  status: number
  message: string | null
  data: {
    indicator_advice: Bln3IndicatorAdvice[]
  }
}
