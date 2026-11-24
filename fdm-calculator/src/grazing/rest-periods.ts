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
  /**
   * The most recent earlier use of the same part of the field before the period of `use`; `null`
   * when there is none.
   */
  previous: FieldUse<T> | null
  /**
   * Growth days between `previous` and the period of `use`: the days after the end of `previous`
   * and before the start of the period. `null` without a previous use.
   */
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

const dayOf = (date: Date) => Math.floor(date.getTime() / MS_PER_DAY)

/**
 * Whether a use continues an earlier use of the same part of the field, without a rest period in
 * between: the uses overlap or meet on one day, or a grazing follows a grazing on the next day.
 */
function continuesUse(earlier: FieldUse, later: FieldUse): boolean {
  const freeDays = dayOf(later.start) - dayOf(earlier.end) - 1
  if (freeDays < 0) return true
  return freeDays === 0 && earlier.type === "weiden" && later.type === "weiden"
}

/**
 * Calculates the rest before each use of one field. The rest is counted from the most recent
 * earlier use of the same part of the field, so successive strips of strip grazing each get their
 * own rest period instead of counting as a re-use of the field after a day.
 *
 * The rest is in growth days: from the day the part becomes free, the day after the previous use,
 * up to the day before the next use (Handboek Melkveehouderij §3.9.2). A grazing that ends on
 * 4 May and a next use on 26 May leave 21 growth days.
 *
 * Uses of the same part form one period, without a rest in between, when they overlap or meet on
 * one day (two herds on one zone, the same zone in the morning and the afternoon, a handover on one
 * day), and when grazings follow each other on successive days: omweiden on a field for several
 * days in a row, recorded day by day. A chain of such uses is one period too (1–5 May, 3–8 May,
 * 6–10 May). A use within a period gets no rest; its rest counts from the start of the period back
 * to the use before it, so the use on 6 May has no previous use here. The period of a use is built
 * only from uses of its own part: a use of the whole field joins the periods of two strips, but
 * does not link those strips to each other.
 *
 * @param uses - The uses of one field, in any order.
 * @returns For each use, in order of start, the previous use of the same part and the rest in
 *   growth days.
 */
export function calculateRestBeforeUses<T>(uses: FieldUse<T>[]): FieldUseRest<T>[] {
  const sorted = [...uses].sort((a, b) => a.start.getTime() - b.start.getTime())
  return sorted.map((use, index) => {
    // The period of this use on its own part of the field: earlier uses of this part that
    // continue into it, back to its first use. Another use's period may run over a different
    // part (a whole-field use links strips that do not overlap each other).
    const earlierOfPart = sorted.slice(0, index).filter((e) => zonesOverlap(e.zone, use.zone))
    const period = new Set<FieldUse<T>>()
    let first = use
    let extended = true
    while (extended) {
      extended = false
      for (const earlier of earlierOfPart) {
        if (!period.has(earlier) && continuesUse(earlier, first)) {
          period.add(earlier)
          if (earlier.start < first.start) first = earlier
          extended = true
        }
      }
    }

    let previous: FieldUse<T> | null = null
    for (const candidate of earlierOfPart) {
      if (period.has(candidate)) continue
      if (!previous || candidate.end.getTime() > previous.end.getTime()) previous = candidate
    }
    const restDays = previous ? Math.max(0, dayOf(first.start) - dayOf(previous.end) - 1) : null
    return { use, previous, restDays }
  })
}
