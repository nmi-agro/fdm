import type * as schema from "./db/schema"

export interface Field {
    b_id: schema.fieldsTypeSelect["b_id"]
    b_name: schema.fieldsTypeSelect["b_name"]
    b_id_farm: schema.fieldAcquiringTypeSelect["b_id_farm"]
    b_id_source: schema.fieldsTypeSelect["b_id_source"]
    b_geometry: schema.fieldsTypeSelect["b_geometry"]
    b_centroid: [number, number]
    b_area: number | null
    b_perimeter: number | null
    b_start: schema.fieldAcquiringTypeSelect["b_start"]
    b_end: schema.fieldDiscardingTypeSelect["b_end"]
    b_acquiring_method: schema.fieldAcquiringTypeSelect["b_acquiring_method"]
    b_bufferstrip: schema.fieldsTypeSelect["b_bufferstrip"]
}
