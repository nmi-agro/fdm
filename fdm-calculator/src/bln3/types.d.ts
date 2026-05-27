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
    b_soiltype_agr?:
        | "zeeklei"
        | "rivierklei"
        | "maasklei"
        | "moerige_klei"
        | "duinzand"
        | "dalgrond"
        | "dekzand"
        | "loess"
        | "veen"
    /** Groundwater class */
    b_gwl_class?:
        | "Ia"
        | "Ic"
        | "IIa"
        | "IIb"
        | "IIc"
        | "IIIa"
        | "IIIb"
        | "IVu"
        | "IVc"
        | "Va"
        | "Vao"
        | "Vad"
        | "Vb"
        | "Vbo"
        | "Vbd"
        | "VIo"
        | "VId"
        | "VIIo"
        | "VIId"
        | "VIIIo"
        | "VIIId"

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
 * An aggregated score (e.g. OBI, BBWP) combining multiple indicator scores.
 * Not yet implemented in the NMI API — the `aggregations` field is optional.
 */
export type Bln3AggregationResult = {
    /** Aggregation identifier (e.g. "OBI", "BBWP") */
    aggregation_id: string
    /** Aggregated score */
    score: number
}

/**
 * The BLN3 score result returned by `requestBln3Score` / `getBln3Score`.
 */
export type Bln3Score = {
    indicators: Bln3IndicatorResult[]
    /** Aggregation scores — not yet implemented by the NMI API */
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
