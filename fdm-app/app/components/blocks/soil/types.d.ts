/**
+ * Represents soil analysis data with various measurements and properties
+ */
export interface SoilAnalysis {
    /** Unique identifier for the soil analysis */
    a_id: string
    /** Source of the soil analysis data */
    a_source: string | undefined | null
    /** Date when soil samples were collected */
    b_sampling_date: Date | null
    /** Organic carbon content ( g C / kg) */
    a_c_of: number | undefined | null
    /** Carbon to nitrogen ratio */
    a_cn_fr: number | undefined | null
    /** Bulk density (g/cm³) */
    a_density_sa: number | undefined | null
    /** Total nitrogen content (mg N / kg) */
    a_n_rt: number | undefined | null
    /** Phosphorus content measured with ammonium lactate method (mg P2O5/100g) */
    a_p_al: number | undefined | null
    /** Phosphorus content measured with calcium chloride method (mg P/kg) */
    a_p_cc: number | undefined | null
    /** Soil organic matter measured by loss on ignition (%) */
    a_som_loi: number | undefined | null
    /** Agricultural soil type classification */
    b_soiltype_agr: string | undefined | null
    /** Groundwater level classification */
    b_gwl_class: string | undefined | null
}
