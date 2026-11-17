import type { MultiPolygon, Polygon } from "geojson"
import { data } from "react-router"
import z from "zod"

/** Form field with the grazing zone as GeoJSON; empty means no zone (the whole field). */
export const GRAZING_ZONE_FIELD = "l_grazing_geometry_zone"

/** Form field with the grazed area (ha) when its location is not known; empty means no area. */
export const GRAZING_AREA_FIELD = "l_grazing_area"

/**
 * Loose shape check for a zone. fdm-core validates the coordinates and normalises a Polygon to a
 * MultiPolygon.
 */
export const grazingZoneSchema = z.looseObject({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.array(z.any()),
})

/** The grazed part of a field: a zone, an area without a location, or neither (the whole field). */
export interface GrazingExtent {
  l_grazing_geometry_zone: Polygon | MultiPolygon | null
  l_grazing_area: number | null
}

/**
 * Reads the grazed part of the field from a submitted form: the zone from
 * {@link GRAZING_ZONE_FIELD} (GeoJSON) and the area from {@link GRAZING_AREA_FIELD} (ha). Both empty
 * means the whole field.
 *
 * @param formData - The submitted form.
 * @returns The zone and the area; `null` for what is not given.
 * @throws A 400 response when the zone is not a Polygon or MultiPolygon, or the area is not a positive number.
 */
export function parseGrazingExtent(formData: FormData): GrazingExtent {
  const zoneValue = formData.get(GRAZING_ZONE_FIELD)
  const areaValue = formData.get(GRAZING_AREA_FIELD)
  return {
    l_grazing_geometry_zone: parseGrazingZone(typeof zoneValue === "string" ? zoneValue : ""),
    l_grazing_area: parseGrazingArea(typeof areaValue === "string" ? areaValue : ""),
  }
}

/**
 * Parses a zone submitted as GeoJSON text.
 *
 * @param value - The GeoJSON text; empty means no zone.
 * @returns The zone, or `null` without a zone.
 * @throws A 400 response when the text is not a Polygon or MultiPolygon.
 */
export function parseGrazingZone(value: string): Polygon | MultiPolygon | null {
  if (value.trim() === "") return null
  try {
    return grazingZoneSchema.parse(JSON.parse(value)) as Polygon | MultiPolygon
  } catch {
    throw data("Ongeldige zone", { status: 400 })
  }
}

function parseGrazingArea(value: string): number | null {
  if (value.trim() === "") return null
  const area = Number.parseFloat(value)
  if (!Number.isFinite(area) || area <= 0) {
    throw data("Ongeldige oppervlakte", { status: 400 })
  }
  return area
}
