import type * as GeoJSON from "geojson"
import { type AnyColumn, type SQL, sql } from "drizzle-orm"

/**
 * Throws when a list of GeoJSON positions contains a position that is not a valid WGS84
 * longitude/latitude pair.
 *
 * @param positions - The positions to check.
 * @param name - The name of the geometry, used in the error message.
 * @throws {Error} If a position is malformed or outside the WGS84 range.
 */
export function assertWgs84Positions(positions: unknown[], name: string): void {
  for (const position of positions) {
    if (!Array.isArray(position) || position.length < 2) {
      throw new Error(`${name} contains an invalid position`)
    }
    const [lon, lat] = position as number[]
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lon < -180 ||
      lon > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      throw new Error(`${name} must have WGS84 coordinates`)
    }
  }
}

/**
 * Validates a zone within a field and normalises it to a `MultiPolygon`. A `Polygon` is wrapped in
 * a `MultiPolygon`; an empty zone becomes `null`, because a zone without area means the whole field.
 *
 * @param zone - The zone as provided by the caller. `undefined` means "leave unchanged".
 * @param name - The name of the zone column, used in error messages.
 * @returns The zone to store: a `MultiPolygon`, `null` for the whole field, or `undefined`.
 * @throws {Error} If the zone has another geometry type, an invalid ring or invalid WGS84 coordinates.
 */
export function normalizeZone(
  zone: GeoJSON.Polygon | GeoJSON.MultiPolygon | null | undefined,
  name: string,
): GeoJSON.MultiPolygon | null | undefined {
  if (!zone) return zone
  if (
    (zone.type !== "Polygon" && zone.type !== "MultiPolygon") ||
    !Array.isArray(zone.coordinates)
  ) {
    throw new Error(`${name} must be a Polygon or MultiPolygon`)
  }
  const multi: GeoJSON.MultiPolygon =
    zone.type === "Polygon" ? { type: "MultiPolygon", coordinates: [zone.coordinates] } : zone
  for (const polygon of multi.coordinates) {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      throw new Error(`${name} contains an invalid polygon`)
    }
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new Error(`${name} contains an invalid ring`)
      }
      assertWgs84Positions(ring, name)
    }
  }
  return multi.coordinates.length === 0 ? null : multi
}

/**
 * SQL expression for a zone clipped to the field boundary. Without a field geometry the zone is
 * used as is.
 *
 * @param zone - The zone column or expression.
 * @param fieldGeometry - The field geometry column of the same field.
 */
export function clippedZone(zone: AnyColumn | SQL, fieldGeometry: AnyColumn): SQL {
  return sql`CASE WHEN ${fieldGeometry} IS NULL THEN ST_MakeValid(${zone})
    ELSE ST_Intersection(ST_MakeValid(${zone}), ST_MakeValid(${fieldGeometry})) END`
}

/**
 * SQL expression for the area (m²) of a geometry, calculated on the spheroid.
 *
 * @param geometry - The geometry expression.
 */
export function geographyArea(geometry: SQL | AnyColumn): SQL<number> {
  return sql<number>`ST_Area((${geometry})::geography)`.mapWith(Number)
}
