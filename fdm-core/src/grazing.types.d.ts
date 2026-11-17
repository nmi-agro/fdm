import type * as GeoJSON from "geojson"
import type * as schema from "./db/schema"

/**
 * The grazed part of a field as a geometry. A `Polygon` is stored as a `MultiPolygon`; `null` means
 * the whole field (or the part given by `l_grazing_area`).
 */
export type GrazingZoneInput = GeoJSON.Polygon | GeoJSON.MultiPolygon | null

export interface Grazing {
  l_id_grazing: schema.grazingTypeSelect["l_id_grazing"]
  b_id?: schema.grazingTypeSelect["b_id"]
  l_id_herd: schema.grazingTypeSelect["l_id_herd"]
  l_grazing_start: schema.grazingTypeSelect["l_grazing_start"]
  l_grazing_end?: schema.grazingTypeSelect["l_grazing_end"]
  l_grazing_hours?: schema.grazingTypeSelect["l_grazing_hours"]
  /** Grazed part of the field without a known location (ha), as recorded. Only set without a zone. */
  l_grazing_area?: schema.grazingTypeSelect["l_grazing_area"]
  /** Grazed part of the field as a geometry, as recorded. `null` means no zone. */
  l_grazing_geometry_zone?: GeoJSON.MultiPolygon | null
  /**
   * Grazed area (ha): the zone clipped to the field, else `l_grazing_area` capped at the field
   * area, else the field area. `null` when the grazing has no field and no area.
   */
  l_grazing_area_grazed: number | null
  created: schema.grazingTypeSelect["created"]
  updated?: schema.grazingTypeSelect["updated"]
}

export interface GrazingCalendarEntry extends Grazing {
  l_herd_name?: schema.herdsTypeSelect["l_herd_name"]
  l_id_category?: schema.herdsTypeSelect["l_id_category"]
  l_category?: schema.animalCategoriesCatalogueTypeSelect["l_category"]
  l_lsu?: schema.animalCategoriesCatalogueTypeSelect["l_lsu"]
  b_name?: schema.fieldsTypeSelect["b_name"]
  b_area?: number | null
}

/** A zone used earlier for grazing on a field, for reuse. */
export interface GrazingZone {
  l_grazing_geometry_zone: GeoJSON.MultiPolygon
  /** Area of the zone within the field (ha). */
  l_grazing_area_grazed: number
  /** Start of the most recent grazing in this zone. */
  last_used: Date
  /** Number of grazings recorded in this zone. */
  usage_count: number
  /** Names of the herds that grazed this zone. */
  l_herd_names: string[]
}

/** The area of a field that was grazed in a period. */
export interface GrazedFieldArea {
  b_id: schema.fieldsTypeSelect["b_id"]
  /** Area of the field (ha). */
  b_area: number
  /**
   * Grazed area of the field (ha): the field area when a grazing covered the whole field, else the
   * union of all zones, or the largest `l_grazing_area` when that is larger, capped at the field area.
   */
  b_area_grazed: number
}
