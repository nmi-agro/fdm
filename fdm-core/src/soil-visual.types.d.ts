import type * as schema from "./db/schema"

export interface VisualSoilAssessment {
    a_id_visual: schema.soilAnalysisVisualTypeSelect["a_id_visual"]
    b_id_sampling: schema.soilAnalysisVisualTypeSelect["b_id_sampling"]
    b_id: schema.soilSamplingVisualTypeSelect["b_id"]
    date: schema.soilAnalysisVisualTypeSelect["date"]
    assessor_name: schema.soilAnalysisVisualTypeSelect["assessor_name"]
    assessment_type: schema.soilAnalysisVisualTypeSelect["assessment_type"]
    a_ss_bcs: schema.soilAnalysisVisualTypeSelect["a_ss_bcs"]
    a_sc_bcs: schema.soilAnalysisVisualTypeSelect["a_sc_bcs"]
    a_rd_bcs: schema.soilAnalysisVisualTypeSelect["a_rd_bcs"]
    a_ew_bcs: schema.soilAnalysisVisualTypeSelect["a_ew_bcs"]
    a_cc_bcs: schema.soilAnalysisVisualTypeSelect["a_cc_bcs"]
    a_gs_bcs: schema.soilAnalysisVisualTypeSelect["a_gs_bcs"]
    a_p_bcs: schema.soilAnalysisVisualTypeSelect["a_p_bcs"]
    a_c_bcs: schema.soilAnalysisVisualTypeSelect["a_c_bcs"]
    a_rt_bcs: schema.soilAnalysisVisualTypeSelect["a_rt_bcs"]
    d_bcs: schema.soilAnalysisVisualTypeSelect["d_bcs"]
    i_bcs: schema.soilAnalysisVisualTypeSelect["i_bcs"]
    notes: schema.soilAnalysisVisualTypeSelect["notes"]
    weather_conditions: schema.soilAnalysisVisualTypeSelect["weather_conditions"]
    created: schema.soilAnalysisVisualTypeSelect["created"]
    updated: schema.soilAnalysisVisualTypeSelect["updated"]
    images: VisualSoilImage[]
}

export interface VisualSoilImage {
    a_id_image: schema.soilAnalysisVisualImageTypeSelect["a_id_image"]
    a_id_visual: schema.soilAnalysisVisualImageTypeSelect["a_id_visual"]
    gcs_object_key: schema.soilAnalysisVisualImageTypeSelect["gcs_object_key"]
    image_type: schema.soilAnalysisVisualImageTypeSelect["image_type"]
    sort_order: schema.soilAnalysisVisualImageTypeSelect["sort_order"]
    caption: schema.soilAnalysisVisualImageTypeSelect["caption"]
    created: schema.soilAnalysisVisualImageTypeSelect["created"]
    updated: schema.soilAnalysisVisualImageTypeSelect["updated"]
    annotations: VisualSoilAnnotation[]
}

export interface VisualSoilAnnotation {
    a_id_annotation: schema.soilAnalysisVisualAnnotationTypeSelect["a_id_annotation"]
    a_id_image: schema.soilAnalysisVisualAnnotationTypeSelect["a_id_image"]
    type: schema.soilAnalysisVisualAnnotationTypeSelect["type"]
    data_json: schema.soilAnalysisVisualAnnotationTypeSelect["data_json"]
    text: schema.soilAnalysisVisualAnnotationTypeSelect["text"]
    indicator: schema.soilAnalysisVisualAnnotationTypeSelect["indicator"]
    sort_order: schema.soilAnalysisVisualAnnotationTypeSelect["sort_order"]
    created: schema.soilAnalysisVisualAnnotationTypeSelect["created"]
    updated: schema.soilAnalysisVisualAnnotationTypeSelect["updated"]
}

export interface AddVisualSoilAnalysisInput {
    b_id: schema.soilSamplingVisualTypeInsert["b_id"]
    a_id?: schema.soilSamplingVisualTypeInsert["a_id"]
    b_sampling_date?: schema.soilSamplingVisualTypeInsert["b_sampling_date"]
    a_depth_upper?: schema.soilSamplingVisualTypeInsert["a_depth_upper"]
    a_depth_lower?: schema.soilSamplingVisualTypeInsert["a_depth_lower"]
    date?: schema.soilAnalysisVisualTypeInsert["date"]
    assessor_name?: schema.soilAnalysisVisualTypeInsert["assessor_name"]
    assessment_type?: schema.soilAnalysisVisualTypeInsert["assessment_type"]
    a_ss_bcs?: schema.soilAnalysisVisualTypeInsert["a_ss_bcs"]
    a_sc_bcs?: schema.soilAnalysisVisualTypeInsert["a_sc_bcs"]
    a_rd_bcs?: schema.soilAnalysisVisualTypeInsert["a_rd_bcs"]
    a_ew_bcs?: schema.soilAnalysisVisualTypeInsert["a_ew_bcs"]
    a_cc_bcs?: schema.soilAnalysisVisualTypeInsert["a_cc_bcs"]
    a_gs_bcs?: schema.soilAnalysisVisualTypeInsert["a_gs_bcs"]
    a_p_bcs?: schema.soilAnalysisVisualTypeInsert["a_p_bcs"]
    a_c_bcs?: schema.soilAnalysisVisualTypeInsert["a_c_bcs"]
    a_rt_bcs?: schema.soilAnalysisVisualTypeInsert["a_rt_bcs"]
    notes?: schema.soilAnalysisVisualTypeInsert["notes"]
    weather_conditions?: schema.soilAnalysisVisualTypeInsert["weather_conditions"]
}

export interface UpdateVisualSoilAnalysisInput {
    date?: schema.soilAnalysisVisualTypeInsert["date"]
    assessor_name?: schema.soilAnalysisVisualTypeInsert["assessor_name"]
    assessment_type?: schema.soilAnalysisVisualTypeInsert["assessment_type"]
    a_ss_bcs?: schema.soilAnalysisVisualTypeInsert["a_ss_bcs"]
    a_sc_bcs?: schema.soilAnalysisVisualTypeInsert["a_sc_bcs"]
    a_rd_bcs?: schema.soilAnalysisVisualTypeInsert["a_rd_bcs"]
    a_ew_bcs?: schema.soilAnalysisVisualTypeInsert["a_ew_bcs"]
    a_cc_bcs?: schema.soilAnalysisVisualTypeInsert["a_cc_bcs"]
    a_gs_bcs?: schema.soilAnalysisVisualTypeInsert["a_gs_bcs"]
    a_p_bcs?: schema.soilAnalysisVisualTypeInsert["a_p_bcs"]
    a_c_bcs?: schema.soilAnalysisVisualTypeInsert["a_c_bcs"]
    a_rt_bcs?: schema.soilAnalysisVisualTypeInsert["a_rt_bcs"]
    d_bcs?: schema.soilAnalysisVisualTypeInsert["d_bcs"]
    i_bcs?: schema.soilAnalysisVisualTypeInsert["i_bcs"]
    notes?: schema.soilAnalysisVisualTypeInsert["notes"]
    weather_conditions?: schema.soilAnalysisVisualTypeInsert["weather_conditions"]
}

export interface AddVisualSoilImageInput {
    gcs_object_key: schema.soilAnalysisVisualImageTypeInsert["gcs_object_key"]
    image_type?: schema.soilAnalysisVisualImageTypeInsert["image_type"]
    sort_order?: schema.soilAnalysisVisualImageTypeInsert["sort_order"]
    caption?: schema.soilAnalysisVisualImageTypeInsert["caption"]
}

export interface AddImageAnnotationInput {
    type: schema.soilAnalysisVisualAnnotationTypeInsert["type"]
    data_json: schema.soilAnalysisVisualAnnotationTypeInsert["data_json"]
    text?: schema.soilAnalysisVisualAnnotationTypeInsert["text"]
    indicator?: schema.soilAnalysisVisualAnnotationTypeInsert["indicator"]
    sort_order?: schema.soilAnalysisVisualAnnotationTypeInsert["sort_order"]
}

export interface UpdateImageAnnotationInput {
    data_json?: schema.soilAnalysisVisualAnnotationTypeInsert["data_json"]
    text?: schema.soilAnalysisVisualAnnotationTypeInsert["text"]
    indicator?: schema.soilAnalysisVisualAnnotationTypeInsert["indicator"]
    sort_order?: schema.soilAnalysisVisualAnnotationTypeInsert["sort_order"]
}
