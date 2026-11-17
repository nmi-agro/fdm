import type { Feature, MultiPolygon, Polygon, Position } from "geojson"
import area from "@turf/area"
import bbox from "@turf/bbox"
import bboxPolygon from "@turf/bbox-polygon"
import centroid from "@turf/centroid"
import difference from "@turf/difference"
import { feature, featureCollection } from "@turf/helpers"
import intersect from "@turf/intersect"
import transformRotate from "@turf/transform-rotate"

/** A polygonal area: a field, a zone or a strip. */
export type Area = Polygon | MultiPolygon

const SQUARE_METERS_PER_HECTARE = 10_000

/** Relative precision of the strip area. */
const AREA_TOLERANCE = 0.005

/** Maximum number of bisection steps when cutting a strip. */
const MAX_STEPS = 50

/** Area of a geometry in hectares. */
export function areaHa(geometry: Area): number {
  return area(geometry) / SQUARE_METERS_PER_HECTARE
}

/**
 * Converts a zone to a `MultiPolygon`, the form in which zones are stored.
 *
 * @param zone - A Polygon or MultiPolygon.
 * @returns The zone as a MultiPolygon.
 */
export function toMultiPolygon(zone: Area): MultiPolygon {
  return zone.type === "MultiPolygon"
    ? zone
    : { type: "MultiPolygon", coordinates: [zone.coordinates] }
}

/**
 * Intersects two areas.
 *
 * @returns The overlapping area, or `null` when they don't overlap.
 */
export function intersectAreas(a: Area, b: Area): Area | null {
  const result = intersect(featureCollection<Area>([feature(a), feature(b)]))
  return result ? result.geometry : null
}

/**
 * Subtracts areas from an area.
 *
 * @returns What remains of `base`, or `null` when nothing remains.
 */
export function subtractAreas(base: Area, subtract: Area[]): Area | null {
  let remaining: Area | null = base
  for (const part of subtract) {
    if (!remaining) return null
    const result: Feature<Area> | null = difference(
      featureCollection<Area>([feature(remaining), feature(part)]),
    )
    remaining = result ? result.geometry : null
  }
  return remaining
}

/**
 * The part of a zone that lies within the field, in hectares. A zone is stored as drawn and
 * clipped to the field when it is used, as fdm-core does.
 *
 * @param zone - The grazing zone.
 * @param field - The field outline.
 * @returns The area of the zone within the field (ha).
 */
export function zoneAreaWithinField(zone: Area, field: Area): number {
  const clipped = intersectAreas(zone, field)
  return clipped ? areaHa(clipped) : 0
}

export interface StripOptions {
  /** The field outline. */
  field: Area
  /** Parts of the field already used (earlier strips); the new strip connects to them. */
  occupied?: Area[]
  /** Intended area of the strip (ha). */
  targetAreaHa: number
  /**
   * Direction in which the strips advance over the field, in degrees clockwise from north
   * (0 = northwards, 90 = eastwards). The fence runs perpendicular to it.
   */
  bearing: number
}

/**
 * Cuts the next grazing strip from a field: a band perpendicular to `bearing`, starting at the
 * back of the part of the field that is still free, with the intended area. When the free part is
 * smaller than the intended area, the whole free part is returned.
 *
 * The band is found by bisection on the position of the front fence, to within 0,5 % of the
 * intended area.
 *
 * @param options - Field, occupied parts, intended area and direction.
 * @returns The strip, or `null` when nothing of the field is free or the intended area is 0.
 */
export function cutStrip({
  field,
  occupied = [],
  targetAreaHa,
  bearing,
}: StripOptions): Area | null {
  if (!(targetAreaHa > 0)) return null
  const free = subtractAreas(field, occupied)
  if (!free) return null
  const freeArea = areaHa(free)
  if (freeArea <= targetAreaHa * (1 + AREA_TOLERANCE)) return free

  // Rotate so that the strips advance eastwards; the strip is then everything west of a meridian
  const pivot = centroid(field).geometry.coordinates as Position
  const toFrame = 90 - bearing
  const rotated = transformRotate(feature(free), toFrame, { pivot }).geometry as Area
  const [minX, minY, maxX, maxY] = bbox(rotated)

  const bandUpTo = (x: number): Area | null =>
    intersectAreas(rotated, bboxPolygon([minX, minY, x, maxY]).geometry)

  let low = minX
  let high = maxX
  let best: Area | null = null
  for (let step = 0; step < MAX_STEPS; step++) {
    const x = (low + high) / 2
    const band = bandUpTo(x)
    const bandArea = band ? areaHa(band) : 0
    best = band
    if (Math.abs(bandArea - targetAreaHa) <= targetAreaHa * AREA_TOLERANCE) break
    if (bandArea < targetAreaHa) low = x
    else high = x
  }
  if (!best) return null

  return transformRotate(feature(best), -toFrame, { pivot }).geometry as Area
}

/**
 * Cuts successive strips from a field, each connecting to the previous one. When the field is used
 * up, the next strip starts again at the back of the field, as the herd returns to the first strip
 * after its rest period.
 *
 * @param options - Field, intended area per strip and direction.
 * @param count - Number of strips.
 * @returns The strips in order of use. Empty when the field or the intended area is empty.
 */
export function cutStrips(options: Omit<StripOptions, "occupied">, count: number): Area[] {
  const strips: Area[] = []
  let occupied: Area[] = []
  for (let i = 0; i < count; i++) {
    let strip = cutStrip({ ...options, occupied })
    if (!strip && occupied.length > 0) {
      occupied = []
      strip = cutStrip({ ...options, occupied })
    }
    if (!strip) break
    strips.push(strip)
    occupied.push(strip)
  }
  return strips
}
