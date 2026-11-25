import type { MultiPolygon, Polygon } from "geojson"
import { clipZoneToField } from "~/lib/grazing-strip"

/** A herd as the grazing pages count it for a calendar year. */
export interface YearHerd {
  l_id_herd: string
  l_herd_name: string
  l_id_category: string
  l_lsu: number
  /** Number of animals on the census date of the year. */
  count: number
  /** Index of the herd's colour (0–5). */
  colorIndex: number
}

/** Number of herd colours in the grazing pages. */
const HERD_COLORS = 6

/**
 * The herds of a calendar year for the grazing pages: the herds of the census of that year, plus
 * the herds that grazed in that year but have ended since (with 0 animals), so their grazing
 * days, hours and Weidemelk days still count. Sorted by name, so each herd keeps its colour.
 *
 * @param census - The census on the census date of the year (`censusDateForYear`).
 * @param grazings - The grazings of the year, with the name, category and LSU of their herd.
 * @returns The herds with their count and colour index.
 */
export function herdsOfYear(
  census: Array<{
    l_id_herd: string
    l_herd_name: string | null
    l_id_category: string
    l_lsu: number | null
    count: number
  }>,
  grazings: Array<{
    l_id_herd: string
    l_herd_name?: string | null
    l_id_category?: string | null
    l_lsu?: number | null
  }>,
): YearHerd[] {
  const herds = new Map<string, Omit<YearHerd, "colorIndex">>()
  for (const c of census) {
    herds.set(c.l_id_herd, {
      l_id_herd: c.l_id_herd,
      l_herd_name: c.l_herd_name ?? "Koppel",
      l_id_category: c.l_id_category,
      l_lsu: c.l_lsu ?? 1,
      count: c.count,
    })
  }
  for (const g of grazings) {
    if (herds.has(g.l_id_herd) || !g.l_id_category) continue
    herds.set(g.l_id_herd, {
      l_id_herd: g.l_id_herd,
      l_herd_name: g.l_herd_name ?? "Koppel",
      l_id_category: g.l_id_category,
      l_lsu: g.l_lsu ?? 1,
      count: 0,
    })
  }
  return [...herds.values()]
    .sort(
      (a, b) =>
        a.l_herd_name.localeCompare(b.l_herd_name, "nl") || a.l_id_herd.localeCompare(b.l_id_herd),
    )
    .map((herd, index) => ({ ...herd, colorIndex: index % HERD_COLORS }))
}

/**
 * The zone of a grazing within its field, for the rest periods: two zones that only overlap
 * outside the field (for example after the field outline was changed) are not the same part of
 * the field. A zone that lies entirely outside the field is kept as it is.
 *
 * @param zone - The stored zone, or `null` for the whole field.
 * @param field - The field outline, if known.
 * @returns The zone clipped to the field, or `null` for the whole field.
 */
export function zoneWithinField(
  zone: Polygon | MultiPolygon | null | undefined,
  field: Polygon | MultiPolygon | null | undefined,
): Polygon | MultiPolygon | null {
  if (!zone) return null
  if (!field) return zone
  return clipZoneToField(zone, field) ?? zone
}
