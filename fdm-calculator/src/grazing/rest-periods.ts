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
 * Uses of the same part that follow each other without a free day form one continuous use: two
 * herds on the same zone at the same time, the same zone in the morning and the afternoon, a
 * handover on one day, or a chain of such uses (1–5 May, 3–8 May, 6–10 May). A use within such a
 * chain gets no rest of 0 days; its rest counts from the start of the chain back to the use before
 * the chain, so the use on 6 May has no previous use here, as the part was grazed without a break.
 * The chain of a use is built only from uses of its own part: a use of the whole field joins the
 * chains of two strips, but does not link those strips to each other.
 *
 * @param uses - The uses of one field, in any order.
 * @returns For each use, in order of start, the previous use of the same part and the rest days.
 */
export function calculateRestBeforeUses<T>(uses: FieldUse<T>[]): FieldUseRest<T>[] {
  const sorted = [...uses].sort((a, b) => a.start.getTime() - b.start.getTime())
  const dayOf = (date: Date) => Math.floor(date.getTime() / MS_PER_DAY)
  return sorted.map((use, index) => {
    // The start of the continuous use of this use's own part of the field. Only earlier uses of
    // this part that still run on the chain start extend the chain; another use's chain may run
    // over a different part (a whole-field use links strips that do not overlap each other).
    const earlierOfPart = sorted.slice(0, index).filter((e) => zonesOverlap(e.zone, use.zone))
    let chainStart = use.start
    let extended = true
    while (extended) {
      extended = false
      for (const earlier of earlierOfPart) {
        if (earlier.start < chainStart && dayOf(earlier.end) >= dayOf(chainStart)) {
          chainStart = earlier.start
          extended = true
        }
      }
    }

    let previous: FieldUse<T> | null = null
    for (const candidate of earlierOfPart) {
      if (dayOf(candidate.end) >= dayOf(chainStart)) continue
      if (!previous || candidate.end.getTime() > previous.end.getTime()) previous = candidate
    }
    const restDays = previous
      ? Math.max(0, Math.floor((chainStart.getTime() - previous.end.getTime()) / MS_PER_DAY))
      : null
    return { use, previous, restDays }
  })
}
