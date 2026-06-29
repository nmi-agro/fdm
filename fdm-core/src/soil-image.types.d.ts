import type * as schema from "./db/schema"

export interface SoilImage {
  a_id_image: schema.soilImageTypeSelect["a_id_image"]
  b_id_sampling: schema.soilImageTypeSelect["b_id_sampling"]
  a_image_path: schema.soilImageTypeSelect["a_image_path"]
  a_image_type: schema.soilImageTypeSelect["a_image_type"]
  a_image_order: schema.soilImageTypeSelect["a_image_order"]
  a_image_caption: schema.soilImageTypeSelect["a_image_caption"]
  created: schema.soilImageTypeSelect["created"]
  updated: schema.soilImageTypeSelect["updated"]
  annotations: SoilImageAnnotation[]
}

export interface SoilImageAnnotation {
  a_id_annotation: schema.soilImageAnnotatingTypeSelect["a_id_annotation"]
  a_id_image: schema.soilImageAnnotatingTypeSelect["a_id_image"]
  a_image_annotation_type: schema.soilImageAnnotatingTypeSelect["a_image_annotation_type"]
  a_image_annotation_coordinates: schema.soilImageAnnotatingTypeSelect["a_image_annotation_coordinates"]
  a_image_annotation: schema.soilImageAnnotatingTypeSelect["a_image_annotation"]
  a_image_annotation_bcs: schema.soilImageAnnotatingTypeSelect["a_image_annotation_bcs"]
  a_image_annotation_order: schema.soilImageAnnotatingTypeSelect["a_image_annotation_order"]
  created: schema.soilImageAnnotatingTypeSelect["created"]
  updated: schema.soilImageAnnotatingTypeSelect["updated"]
}

export interface AddSoilImageInput {
  a_image_path: schema.soilImageTypeInsert["a_image_path"]
  a_image_type?: schema.soilImageTypeInsert["a_image_type"]
  a_image_order?: schema.soilImageTypeInsert["a_image_order"]
  a_image_caption?: schema.soilImageTypeInsert["a_image_caption"]
}

export interface AddSoilImageAnnotationInput {
  a_image_annotation_type: schema.soilImageAnnotatingTypeInsert["a_image_annotation_type"]
  a_image_annotation_coordinates: schema.soilImageAnnotatingTypeInsert["a_image_annotation_coordinates"]
  a_image_annotation?: schema.soilImageAnnotatingTypeInsert["a_image_annotation"]
  a_image_annotation_bcs?: schema.soilImageAnnotatingTypeInsert["a_image_annotation_bcs"]
  a_image_annotation_order?: schema.soilImageAnnotatingTypeInsert["a_image_annotation_order"]
}

export interface UpdateSoilImageAnnotationInput {
  a_image_annotation_coordinates?: schema.soilImageAnnotatingTypeInsert["a_image_annotation_coordinates"]
  a_image_annotation?: schema.soilImageAnnotatingTypeInsert["a_image_annotation"]
  a_image_annotation_bcs?: schema.soilImageAnnotatingTypeInsert["a_image_annotation_bcs"]
  a_image_annotation_order?: schema.soilImageAnnotatingTypeInsert["a_image_annotation_order"]
}
