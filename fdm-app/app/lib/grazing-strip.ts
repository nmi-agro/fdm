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
 * Divides a field into plots of equal size, as Nieuw Nederlands Weiden asks: the number of plots
 * follows from the intended plot size, and every plot gets the same share of the field. The plots
 * are bands perpendicular to `bearing`, in order of use.
 *
 * @param options - Field, intended plot size (ha) and direction.
 * @returns The plots in order of use; one plot for a field smaller than about one plot, none for an
 *   empty field or plot size.
 */
export function cutEqualPlots({
  field,
  plotAreaHa,
  bearing,
}: {
  field: Area
  plotAreaHa: number
  bearing: number
}): Area[] {
  const fieldArea = areaHa(field)
  if (!(plotAreaHa > 0) || !(fieldArea > 0)) return []
  const count = Math.max(1, Math.round(fieldArea / plotAreaHa))
  if (count === 1) return [field]

  // As in cutStrip: rotate so the plots advance eastwards. The plots are bands between fence
  // lines, each found by bisection on the area west of it, so no plot is subtracted from another
  // (which fails on edges that almost coincide)
  const pivot = centroid(field).geometry.coordinates as Position
  const toFrame = 90 - bearing
  const rotated = transformRotate(feature(field), toFrame, { pivot }).geometry as Area
  const [minX, minY, maxX, maxY] = bbox(rotated)
  const rotatedArea = areaHa(rotated)
  const areaWestOf = (x: number) => {
    const band = intersectAreas(rotated, bboxPolygon([minX, minY, x, maxY]).geometry)
    return band ? areaHa(band) : 0
  }

  const fences = [minX]
  for (let k = 1; k < count; k++) {
    const target = (rotatedArea * k) / count
    let low = fences[k - 1]
    let high = maxX
    for (let step = 0; step < MAX_STEPS; step++) {
      const x = (low + high) / 2
      const area = areaWestOf(x)
      if (Math.abs(area - target) <= (rotatedArea / count) * AREA_TOLERANCE) {
        low = x
        high = x
        break
      }
      if (area < target) low = x
      else high = x
    }
    fences.push((low + high) / 2)
  }
  fences.push(maxX)

  const plots: Area[] = []
  for (let k = 0; k < count; k++) {
    const band = intersectAreas(
      rotated,
      bboxPolygon([fences[k], minY, fences[k + 1], maxY]).geometry,
    )
    if (band) plots.push(transformRotate(feature(band), -toFrame, { pivot }).geometry as Area)
  }
  return plots
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

/** Converts a WGS84 position to screen pixels, as the map does. */
export type ProjectToScreen = (lng: number, lat: number) => { x: number; y: number }

/** Distance within which a drawn point snaps to an edge (screen pixels). */
export const SNAP_TOLERANCE_PX = 12

/** The rings of an area as lists of positions. */
function ringsOf(target: Area): Position[][] {
  return target.type === "Polygon" ? target.coordinates : target.coordinates.flat()
}

/**
 * Finds the point to snap a drawn point to: a corner of one of the areas within the tolerance,
 * or else the nearest point on one of their edges within the tolerance. Corners go first, so a
 * zone can start exactly in the corner of the field. Distances are measured in screen pixels, so
 * snapping feels the same at every zoom level.
 *
 * @param point - The drawn point (WGS84).
 * @param targets - The areas to snap to, such as the field outline and earlier strips.
 * @param project - Converts a WGS84 position to screen pixels.
 * @param tolerancePx - Maximum distance to snap (pixels). Defaults to {@link SNAP_TOLERANCE_PX}.
 * @returns The position to use, or `undefined` when nothing is within the tolerance.
 */
export function snapToEdges(
  point: Position,
  targets: Area[],
  project: ProjectToScreen,
  tolerancePx = SNAP_TOLERANCE_PX,
): Position | undefined {
  const p = project(point[0], point[1])
  let bestCorner: { position: Position; distance: number } | undefined
  let bestEdge: { position: Position; distance: number } | undefined

  for (const target of targets) {
    for (const ring of ringsOf(target)) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i]
        const b = ring[i + 1]
        const pa = project(a[0], a[1])
        const pb = project(b[0], b[1])

        const cornerDistance = Math.hypot(p.x - pa.x, p.y - pa.y)
        if (
          cornerDistance <= tolerancePx &&
          (!bestCorner || cornerDistance < bestCorner.distance)
        ) {
          bestCorner = { position: [a[0], a[1]], distance: cornerDistance }
        }

        // Nearest point on the segment, in screen space; at field scale the map projection is
        // linear enough to interpolate the WGS84 position with the same fraction
        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared === 0) continue
        const t = Math.max(0, Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / lengthSquared))
        const edgeDistance = Math.hypot(p.x - (pa.x + t * dx), p.y - (pa.y + t * dy))
        if (edgeDistance <= tolerancePx && (!bestEdge || edgeDistance < bestEdge.distance)) {
          bestEdge = {
            position: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
            distance: edgeDistance,
          }
        }
      }
    }
  }

  return bestCorner?.position ?? bestEdge?.position
}

/** Area below which a difference between two zones counts as rounding (square metres). */
const NEGLIGIBLE_AREA_M2 = 0.5

/**
 * Clips a drawn zone to the field, so it never extends beyond the field outline.
 *
 * @param zone - The drawn zone.
 * @param field - The field outline.
 * @returns The part of the zone within the field: `zone` itself when it already lies within the
 *   field, `null` when it lies entirely outside the field.
 */
export function clipZoneToField(zone: Area, field: Area): Area | null {
  const clipped = intersectAreas(zone, field)
  if (!clipped) return null
  return area(zone) - area(clipped) < NEGLIGIBLE_AREA_M2 ? zone : clipped
}
