import type { FieldGeometry } from "@nmi-agro/fdm-core"

export interface FeatureFdm {
  type: "Feature"
  geometry: FieldGeometry
  properties: {
    b_id_source: string
    [key: string]: unknown
  }
}

export interface FeatureCollectionFdm {
  type: "FeatureCollection"
  features: FeatureFdm[]
}
