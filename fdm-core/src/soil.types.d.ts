import type * as GeoJSON from "geojson"
import type * as schema from "./db/schema"

export interface SoilAnalysis {
  a_id: schema.soilAnalysisTypeSelect["a_id"]
  a_date: schema.soilAnalysisTypeSelect["a_date"]
  a_depth_upper: schema.soilSamplingTypeSelect["a_depth_upper"]
  a_depth_lower: schema.soilSamplingTypeSelect["a_depth_lower"]
  a_source: schema.soilAnalysisTypeSelect["a_source"]
  a_file_path: schema.soilAnalysisTypeSelect["a_file_path"]
  a_al_ox: schema.soilAnalysisTypeSelect["a_al_ox"]
  a_c_of: schema.soilAnalysisTypeSelect["a_c_of"]
  a_ca_co: schema.soilAnalysisTypeSelect["a_ca_co"]
  a_ca_co_po: schema.soilAnalysisTypeSelect["a_ca_co_po"]
  a_caco3_if: schema.soilAnalysisTypeSelect["a_caco3_if"]
  a_cec_co: schema.soilAnalysisTypeSelect["a_cec_co"]
  a_clay_mi: schema.soilAnalysisTypeSelect["a_clay_mi"]
  a_cn_fr: schema.soilAnalysisTypeSelect["a_cn_fr"]
  a_com_fr: schema.soilAnalysisTypeSelect["a_com_fr"]
  a_cu_cc: schema.soilAnalysisTypeSelect["a_cu_cc"]
  a_density_sa: schema.soilAnalysisTypeSelect["a_density_sa"]
  a_fe_ox: schema.soilAnalysisTypeSelect["a_fe_ox"]
  a_k_cc: schema.soilAnalysisTypeSelect["a_k_cc"]
  a_k_co: schema.soilAnalysisTypeSelect["a_k_co"]
  a_k_co_po: schema.soilAnalysisTypeSelect["a_k_co_po"]
  a_mg_cc: schema.soilAnalysisTypeSelect["a_mg_cc"]
  a_mg_co: schema.soilAnalysisTypeSelect["a_mg_co"]
  a_mg_co_po: schema.soilAnalysisTypeSelect["a_mg_co_po"]
  a_n_pmn: schema.soilAnalysisTypeSelect["a_n_pmn"]
  a_n_rt: schema.soilAnalysisTypeSelect["a_n_rt"]
  a_nh4_cc: schema.soilAnalysisTypeSelect["a_nh4_cc"]
  a_nmin_cc: schema.soilAnalysisTypeSelect["a_nmin_cc"]
  a_no3_cc: schema.soilAnalysisTypeSelect["a_no3_cc"]
  a_p_al: schema.soilAnalysisTypeSelect["a_p_al"]
  a_p_cc: schema.soilAnalysisTypeSelect["a_p_cc"]
  a_p_ox: schema.soilAnalysisTypeSelect["a_p_ox"]
  a_p_rt: schema.soilAnalysisTypeSelect["a_p_rt"]
  a_p_sg: schema.soilAnalysisTypeSelect["a_p_sg"]
  a_p_wa: schema.soilAnalysisTypeSelect["a_p_wa"]
  a_ph_cc: schema.soilAnalysisTypeSelect["a_ph_cc"]
  a_s_rt: schema.soilAnalysisTypeSelect["a_s_rt"]
  a_sand_mi: schema.soilAnalysisTypeSelect["a_sand_mi"]
  a_silt_mi: schema.soilAnalysisTypeSelect["a_silt_mi"]
  a_som_loi: schema.soilAnalysisTypeSelect["a_som_loi"]
  a_zn_cc: schema.soilAnalysisTypeSelect["a_zn_cc"]
  b_gwl_class: schema.soilAnalysisTypeSelect["b_gwl_class"]
  b_soiltype_agr: schema.soilAnalysisTypeSelect["b_soiltype_agr"]
  a_ss_bcs: schema.soilAnalysisTypeSelect["a_ss_bcs"]
  a_sc_bcs: schema.soilAnalysisTypeSelect["a_sc_bcs"]
  a_rd_bcs: schema.soilAnalysisTypeSelect["a_rd_bcs"]
  a_ew_bcs: schema.soilAnalysisTypeSelect["a_ew_bcs"]
  a_cc_bcs: schema.soilAnalysisTypeSelect["a_cc_bcs"]
  a_gs_bcs: schema.soilAnalysisTypeSelect["a_gs_bcs"]
  a_p_bcs: schema.soilAnalysisTypeSelect["a_p_bcs"]
  a_c_bcs: schema.soilAnalysisTypeSelect["a_c_bcs"]
  a_rt_bcs: schema.soilAnalysisTypeSelect["a_rt_bcs"]
  b_id_sampling: schema.soilSamplingTypeSelect["b_id_sampling"]
  b_id: schema.soilSamplingTypeSelect["b_id"]
  b_sampling_date: schema.soilSamplingTypeSelect["b_sampling_date"]
  /** Locations of the subsamples (WGS84), or `null` when unknown. */
  b_sampling_geometry: schema.soilSamplingTypeSelect["b_sampling_geometry"] | null
  /** Area the analysis represents (WGS84), or `null` when it represents the whole field. */
  b_sampling_geometry_zone: schema.soilSamplingTypeSelect["b_sampling_geometry_zone"] | null
}

/**
 * Optional sampling geometries that can be passed when adding or updating a soil analysis.
 *
 * Coordinates are in WGS84 (EPSG:4326). A `Polygon` zone is stored as a `MultiPolygon`.
 */
export interface SoilSamplingGeometries {
  /** Locations of the subsamples. Pass `null` to clear. */
  b_sampling_geometry?: GeoJSON.MultiPoint | null
  /** Area the analysis represents: the whole field or a zone within it. Pass `null` to clear. */
  b_sampling_geometry_zone?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
}

export type SoilParameters =
  | "a_source"
  | "a_id"
  | "b_sampling_date"
  | "a_depth_upper"
  | "a_depth_lower"
  | "a_al_ox"
  | "a_c_of"
  | "a_ca_co"
  | "a_ca_co_po"
  | "a_caco3_if"
  | "a_cec_co"
  | "a_clay_mi"
  | "a_cn_fr"
  | "a_com_fr"
  | "a_cu_cc"
  | "a_density_sa"
  | "a_fe_ox"
  | "a_k_cc"
  | "a_k_co"
  | "a_k_co_po"
  | "a_mg_cc"
  | "a_mg_co"
  | "a_mg_co_po"
  | "a_n_pmn"
  | "a_n_rt"
  | "a_nh4_cc"
  | "a_nmin_cc"
  | "a_no3_cc"
  | "a_p_al"
  | "a_p_cc"
  | "a_p_ox"
  | "a_p_rt"
  | "a_p_sg"
  | "a_p_wa"
  | "a_ph_cc"
  | "a_s_rt"
  | "a_sand_mi"
  | "a_silt_mi"
  | "a_som_loi"
  | "a_zn_cc"
  | "d_n_supply_base"
  | "b_gwl_class"
  | "b_soiltype_agr"
  | "a_ss_bcs"
  | "a_sc_bcs"
  | "a_rd_bcs"
  | "a_ew_bcs"
  | "a_cc_bcs"
  | "a_gs_bcs"
  | "a_p_bcs"
  | "a_c_bcs"
  | "a_rt_bcs"

/**
 * A soil analysis that contributes to the current value of a soil parameter.
 */
export interface CurrentSoilDataSource {
  a_id: schema.soilAnalysisTypeSelect["a_id"]
  a_source: schema.soilAnalysisTypeSelect["a_source"]
  b_sampling_date: schema.soilSamplingTypeSelect["b_sampling_date"]
  a_depth_upper: schema.soilSamplingTypeSelect["a_depth_upper"]
  a_depth_lower: schema.soilSamplingTypeSelect["a_depth_lower"]
  /** The value of the parameter in this analysis. */
  value: number | string | null
  /** Share of the area with a value that this analysis represents (0–1). */
  area_fraction: number
}

/**
 * The current value of a soil parameter for a field.
 *
 * When the value comes from several sampling zones, `is_aggregated` is `true` and `sources`
 * lists every contributing analysis with its area share.
 */
export interface CurrentSoilDataItem {
  parameter: SoilParameters
  /** Area-weighted mean for numeric parameters; the value with the largest area for categorical parameters. */
  value: number | string | null
  /** `true` when the value combines several sampling zones. */
  is_aggregated: boolean
  /** Share of the field area that the sources represent (0–1), or `null` when it cannot be determined. */
  coverage: number | null
  /** `true` when the sampling zones cover less than 95% of the field (`SOIL_ZONE_MIN_COVERAGE`). */
  has_coverage_warning: boolean
  /** Contributing analyses, newest first. Contains at least one entry. */
  sources: CurrentSoilDataSource[]
}

export type CurrentSoilData = CurrentSoilDataItem[]

/**
 * The current soil data of a single sampling zone within a field.
 */
export interface SoilZone {
  /** The zone clipped to the field boundary, or `null` when the zone is the whole field. */
  b_sampling_geometry_zone: GeoJSON.MultiPolygon | null
  /** Area of the zone (ha), or `null` when it cannot be determined. */
  b_area: number | null
  /** Analyses that belong to this zone, newest first. */
  a_ids: schema.soilAnalysisTypeSelect["a_id"][]
  /** The current soil data within this zone. Every item has exactly one source. */
  data: CurrentSoilData
}

export interface SoilParameterDescriptionItem {
  parameter: SoilParameters
  unit: string
  type: "numeric" | "enum" | "date" | "text"
  name: string
  description: string
  min?: number
  max?: number
  options?: {
    value: schema.GwlClasses
    label: string
  }[]
}

export type SoilParameterDescription = SoilParameterDescriptionItem[]
