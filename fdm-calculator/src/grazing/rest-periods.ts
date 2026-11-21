import type { MultiPolygon, Polygon } from "geojson"
import area from "@turf/area"
import { feature, featureCollection } from "@turf/helpers"
import intersect from "@turf/intersect"

/** A use of a grassland field: a grazing or a mowing (cut). */
export interface FieldUse<T = unknown> {
  type: "weiden" | "maaien"
  start: Date
  end: Date
  /**
   * The part of the field that was used. `null` or omitted means the whole field, which is the
   * case for mowing, a grazing without a zone and a grazing with an area but no location.
   */
  zone?: Polygon | MultiPolygon | null
  /** Data of the caller, returned unchanged. */
  data?: T
}

/** The rest before a use of a field. */
export interface FieldUseRest<T = unknown> {
  use: FieldUse<T>
  /** The most recent earlier use of the same part of the field; `null` when there is none. */
  previous: FieldUse<T> | null
  /** Days between the end of `previous` and the start of `use`; `null` without a previous use. */
  restDays: number | null
}

/**
 * Share of the smaller zone that must overlap the other zone before two zones count as the same
 * part of the field. Strips that only touch along their edge, or overlap by a sliver of a drawn
 * edge, do not count.
 */
const MIN_OVERLAP_SHARE = 0.05

const MS_PER_DAY = 86_400_000

/**
 * Whether two uses concern the same part of a field. A use without a zone covers the whole field,
 * so it overlaps every other use; two zones overlap when at least 5% of the smaller one lies
 * within the other.
 *
 * @param a - The zone of the first use; `null` or omitted for the whole field.
 * @param b - The zone of the second use; `null` or omitted for the whole field.
 * @returns `true` when the uses concern the same part of the field.
 */
export function zonesOverlap(
  a: Polygon | MultiPolygon | null | undefined,
  b: Polygon | MultiPolygon | null | undefined,
): boolean {
  if (!a || !b) return true
  const overlap = intersect(featureCollection<Polygon | MultiPolygon>([feature(a), feature(b)]))
  if (!overlap) return false
  const smaller = Math.min(area(a), area(b))
  return smaller > 0 && area(overlap) / smaller >= MIN_OVERLAP_SHARE
}

/**
 * Calculates the rest before each use of one field. The rest is counted from the most recent
 * earlier use of the same part of the field, so successive strips of strip grazing each get their
 * own rest period instead of counting as a re-use of the field after a day.
 *
 * A use that still runs on the start day of another use of the same part is not a previous use:
 * two herds on the same zone at the same time, the same zone in the morning and the afternoon, or
 * a handover on one day count as one use, so they get no rest of 0 days. The rest of the later
 * use then counts from the use before them.
 *
 * @param uses - The uses of one field, in any order.
 * @returns For each use, in order of start, the previous use of the same part and the rest days.
 */
export function calculateRestBeforeUses<T>(uses: FieldUse<T>[]): FieldUseRest<T>[] {
  const sorted = [...uses].sort((a, b) => a.start.getTime() - b.start.getTime())
  return sorted.map((use, index) => {
    let previous: FieldUse<T> | null = null
    const startDay = Math.floor(use.start.getTime() / MS_PER_DAY)
    for (let i = 0; i < index; i++) {
      const candidate = sorted[i]
      if (Math.floor(candidate.end.getTime() / MS_PER_DAY) >= startDay) continue
      if (!zonesOverlap(candidate.zone, use.zone)) continue
      if (!previous || candidate.end.getTime() > previous.end.getTime()) previous = candidate
    }
    const restDays = previous
      ? Math.max(0, Math.floor((use.start.getTime() - previous.end.getTime()) / MS_PER_DAY))
      : null
    return { use, previous, restDays }
  })
}
