import type { MultiPolygon, Polygon } from "geojson"
import { data } from "react-router"
import z from "zod"
import { formText } from "~/lib/form"

/** Form field with the grazing zone as GeoJSON; empty means no zone (the whole field). */
export const GRAZING_ZONE_FIELD = "l_grazing_geometry_zone"

/** Form field with the grazed area (ha) when its location is not known; empty means no area. */
export const GRAZING_AREA_FIELD = "l_grazing_area"

/** A WGS84 position: longitude and latitude, with optional extra values. */
const positionSchema = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .rest(z.number())

/** The rings of a polygon; a ring has at least 4 positions, like fdm-core requires. */
const polygonSchema = z.array(z.array(positionSchema).min(4)).min(1)

/**
 * Shape check for a zone, with the same rules for rings and coordinates as fdm-core, so an invalid
 * zone gets a clear 400. fdm-core normalises a Polygon to a MultiPolygon.
 */
export const grazingZoneSchema = z.discriminatedUnion("type", [
  z.looseObject({ type: z.literal("Polygon"), coordinates: polygonSchema }),
  z.looseObject({ type: z.literal("MultiPolygon"), coordinates: z.array(polygonSchema) }),
])

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
  return {
    l_grazing_geometry_zone: parseGrazingZone(formText(formData, GRAZING_ZONE_FIELD)),
    l_grazing_area: parseGrazingArea(formText(formData, GRAZING_AREA_FIELD)),
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
  // The whole value must be a number, so "1,5" or "1abc" is refused instead of read as 1
  const area = Number(value)
  if (!Number.isFinite(area) || area <= 0) {
    throw data("Ongeldige oppervlakte", { status: 400 })
  }
  return area
}

/**
 * Parses a grazing date submitted as `YYYY-MM-DD`.
 *
 * @param value - The submitted date; empty means not given.
 * @returns The date at midnight UTC, or `undefined` when empty.
 * @throws A 400 response when the value is not an existing calendar date, such as `2026-02-30`.
 */
export function parseGrazingDate(value: string): Date | undefined {
  if (value.trim() === "") return undefined
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : null
  // A rolled-over date such as 30 February no longer reads back as the same text
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw data("Ongeldige datum", { status: 400 })
  }
  return date
}

/**
 * Parses the grazing hours per day.
 *
 * @param value - The submitted hours; empty means not given.
 * @returns The hours, or `undefined` when empty.
 * @throws A 400 response when the value is not a number above 0 and at most 24.
 */
export function parseGrazingHours(value: string): number | undefined {
  if (value.trim() === "") return undefined
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    throw data("Ongeldig aantal uren per dag", { status: 400 })
  }
  return hours
}
