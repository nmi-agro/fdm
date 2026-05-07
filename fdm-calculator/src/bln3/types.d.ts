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
 * Input parameters for the BLN3 score calculation.
 * Maps to the request body of `POST /maatwerk/bln3/score/field`.
 *
 * Only `a_lat` and `a_lon` are required by the NMI API.
 * All other fields are optional and improve calculation quality when provided.
 */
export type Bln3ScoreInputs = {
    /** NMI API key for authentication — redacted from cache hash */
    nmiApiKey: string | undefined

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
    /** HELP soil map unit */
    b_help_wenr?: string
    /** Compaction risk (from Van den Akker, 2012) */
    b_sc_wenr?: 1 | 2 | 3 | 4 | 5 | 10 | 11 | 401 | 901 | 902
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
    /** Whether drains are present */
    b_drain?: boolean

    // ── Soil analysis ────────────────────────────────────────────────────────
    /** Phosphorus plant available (PAE) (mg P / kg) */
    a_p_cc?: number
    /** Phosphate in ammonium lactate extraction (PAL) (mg P2O5 / 100g) */
    a_p_al?: number
    /** Phosphate extractable with water (Pw) (mg P2O5 / l) */
    a_p_wa?: number

    // ── Measures ─────────────────────────────────────────────────────────────
    /** Implemented soil management measures */
    measures?: Bln3Measure[]

    // ── Additional fields accepted by the API (undocumented in schema) ───────
    [key: string]: unknown
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
 * Field data for a BLN3 score request, assembled from the FDM database.
 * Passed to `getBln3Score` together with `nmiApiKey`.
 */
export type Bln3ScoreCollectedInputs = Omit<Bln3ScoreInputs, "nmiApiKey">

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
