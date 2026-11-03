import type { CurrentSoilDataItem, CurrentSoilDataSource, SoilParameters } from "./soil.types"

/**
 * Minimum intersection over union for two sampling zones to be treated as the same zone.
 */
export const SOIL_ZONE_SAME_IOU = 0.9

/**
 * Minimum share of an older zone that must lie within a newer zone for the newer analysis
 * to replace the older one.
 */
export const SOIL_ZONE_COVERED_FRACTION = 0.9

/**
 * Minimum share of the field that the sampling zones must cover. Below this share the current
 * soil data is still returned, but flagged with `has_coverage_warning`.
 */
export const SOIL_ZONE_MIN_COVERAGE = 0.95

/**
 * Maximum number of calendar months between the newest zone analysis and the other zone analyses
 * that are combined with it.
 */
export const SOIL_ZONE_MAX_DATE_SPAN_MONTHS = 1

/**
 * Soil parameters that are categorical. Across zones they take the value with the largest area.
 */
export const CATEGORICAL_SOIL_PARAMETERS: readonly SoilParameters[] = [
  "b_soiltype_agr",
  "b_gwl_class",
]

/**
 * A soil analysis as input for the aggregation, ordered by `b_sampling_date` descending (nulls last).
 */
export interface AggregationAnalysis {
  a_id: CurrentSoilDataSource["a_id"]
  a_source: CurrentSoilDataSource["a_source"]
  b_sampling_date: CurrentSoilDataSource["b_sampling_date"]
  a_depth_upper: CurrentSoilDataSource["a_depth_upper"]
  a_depth_lower: CurrentSoilDataSource["a_depth_lower"]
  /** `true` when the analysis has a sampling zone; otherwise it represents the whole field. */
  has_zone: boolean
  /** Parameter values of the analysis. */
  values: Partial<Record<SoilParameters, unknown>>
}

/**
 * Areas of the sampling zones of one field, clipped to the field boundary.
 */
export interface ZoneAreas {
  /** Area of the field (m²), or `null` when the field has no geometry. */
  field_area: number | null
  /** Clipped area of each zone (m²), keyed by `a_id`. */
  zone_area: Map<string, number>
  /** Clipped area of the intersection of two zones (m²). */
  intersection: (a_id_1: string, a_id_2: string) => number
}

/**
 * Returns whether a value counts as present.
 */
function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined
}

/**
 * Formats a date as a calendar date (`YYYY-MM-DD`) in Europe/Amsterdam.
 */
function toCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/**
 * Returns the calendar date (`YYYY-MM-DD`, Europe/Amsterdam) a number of months before `date`.
 * The day is clamped to the last day of the target month.
 */
function subtractCalendarMonths(date: Date, months: number): string {
  const [year, month, day] = toCalendarDate(date).split("-").map(Number)
  const target = new Date(Date.UTC(year, month - 1 - months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * Selects the analyses that contribute to the current value of a parameter.
 *
 * - The newest analysis with a value decides. Without a zone it is the only contributor.
 * - With a zone, only zone analyses are combined: from newest to oldest, until the first
 *   analysis without a zone or the first analysis sampled more than
 *   {@link SOIL_ZONE_MAX_DATE_SPAN_MONTHS} month before the newest one.
 * - An older zone is dropped when at least {@link SOIL_ZONE_COVERED_FRACTION} of it lies within a
 *   newer, selected zone. Within one zone this keeps the newest value.
 *
 * @param parameter - The soil parameter.
 * @param analyses - The analyses of the field, ordered by `b_sampling_date` descending (nulls last).
 * @param areas - The zone areas of the field. Only needed when the newest analysis has a zone.
 * @returns The contributing analyses, newest first. Empty when no analysis has a value.
 */
export function selectContributingAnalyses(
  parameter: SoilParameters,
  analyses: AggregationAnalysis[],
  areas?: ZoneAreas,
): AggregationAnalysis[] {
  const candidates = analyses.filter((analysis) => hasValue(analysis.values[parameter]))
  const newest = candidates[0]
  if (!newest) return []
  if (!newest.has_zone || !areas || !newest.b_sampling_date) return [newest]

  const earliestDate = subtractCalendarMonths(
    newest.b_sampling_date,
    SOIL_ZONE_MAX_DATE_SPAN_MONTHS,
  )

  const selected: AggregationAnalysis[] = [newest]
  for (const candidate of candidates.slice(1)) {
    if (!candidate.has_zone || !candidate.b_sampling_date) break
    if (toCalendarDate(candidate.b_sampling_date) < earliestDate) break

    const area = areas.zone_area.get(candidate.a_id) ?? 0
    const isCovered = selected.some(
      (newer) =>
        area > 0 &&
        areas.intersection(candidate.a_id, newer.a_id) / area >= SOIL_ZONE_COVERED_FRACTION,
    )
    if (!isCovered) selected.push(candidate)
  }
  return selected
}

/**
 * Returns whether any two of the selected zones overlap. Only then does the effective area of a
 * zone differ from its clipped area.
 *
 * @param selected - The contributing analyses, newest first.
 * @param areas - The zone areas of the field.
 * @returns `true` when at least two selected zones share area.
 */
export function hasOverlappingZones(selected: AggregationAnalysis[], areas: ZoneAreas): boolean {
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      if (areas.intersection(selected[i].a_id, selected[j].a_id) > 0) return true
    }
  }
  return false
}

/**
 * Combines the contributing analyses into the current value of a parameter.
 *
 * Numeric parameters take the area-weighted mean; categorical parameters take the value with the
 * largest total area. The weights are normalised over the area that has a value.
 *
 * @param parameter - The soil parameter.
 * @param selected - The contributing analyses, newest first (see {@link selectContributingAnalyses}).
 * @param effectiveArea - Area (m²) each analysis represents, keyed by `a_id`. Ignored for a single analysis without a zone.
 * @param fieldArea - Area of the field (m²), or `null` when unknown.
 * @returns The current soil data item, or `null` when `selected` is empty.
 */
export function aggregateParameter(
  parameter: SoilParameters,
  selected: AggregationAnalysis[],
  effectiveArea: Map<string, number>,
  fieldArea: number | null,
): CurrentSoilDataItem | null {
  if (selected.length === 0) return null

  const toSource = (analysis: AggregationAnalysis, area_fraction: number) => ({
    a_id: analysis.a_id,
    a_source: analysis.a_source,
    b_sampling_date: analysis.b_sampling_date,
    a_depth_upper: analysis.a_depth_upper,
    a_depth_lower: analysis.a_depth_lower,
    value: analysis.values[parameter] as CurrentSoilDataSource["value"],
    area_fraction,
  })

  // A single analysis without a zone represents the whole field
  if (selected.length === 1 && !selected[0].has_zone) {
    return {
      parameter,
      value: selected[0].values[parameter] as CurrentSoilDataItem["value"],
      is_aggregated: false,
      coverage: 1,
      has_coverage_warning: false,
      sources: [toSource(selected[0], 1)],
    }
  }

  const areas = selected.map((analysis) => Math.max(effectiveArea.get(analysis.a_id) ?? 0, 0))
  const totalArea = areas.reduce((sum, area) => sum + area, 0)

  const coverage = fieldArea && fieldArea > 0 ? Math.min(totalArea / fieldArea, 1) : null
  const has_coverage_warning = coverage !== null && coverage < SOIL_ZONE_MIN_COVERAGE

  // Zones outside the field carry no weight: fall back to the newest analysis
  if (totalArea <= 0) {
    return {
      parameter,
      value: selected[0].values[parameter] as CurrentSoilDataItem["value"],
      is_aggregated: false,
      coverage,
      has_coverage_warning,
      sources: [toSource(selected[0], 1)],
    }
  }

  const fractions = areas.map((area) => area / totalArea)
  const sources = selected
    .map((analysis, i) => toSource(analysis, fractions[i]))
    .filter((source) => source.area_fraction > 0)

  let value: CurrentSoilDataItem["value"]
  if (CATEGORICAL_SOIL_PARAMETERS.includes(parameter)) {
    const areaPerValue = new Map<string, number>()
    for (const source of sources) {
      const key = String(source.value)
      areaPerValue.set(key, (areaPerValue.get(key) ?? 0) + source.area_fraction)
    }
    // Ties go to the value of the newest analysis, because sources are ordered newest first
    let best: string | null = null
    for (const [key, fraction] of areaPerValue) {
      if (best === null || fraction > (areaPerValue.get(best) ?? 0)) best = key
    }
    value = best
  } else {
    value = sources.reduce((sum, source) => sum + Number(source.value) * source.area_fraction, 0)
  }

  return {
    parameter,
    value,
    is_aggregated: sources.length > 1,
    coverage,
    has_coverage_warning,
    sources,
  }
}

/**
 * Groups analyses into sampling zones. Two zones are the same when their intersection over union
 * is at least {@link SOIL_ZONE_SAME_IOU}. Analyses without a zone form the whole-field zone.
 *
 * @param analyses - The analyses of the field, ordered by `b_sampling_date` descending (nulls last).
 * @param areas - The zone areas of the field.
 * @returns The zones as lists of analyses, newest first. The zone of the newest analysis comes first.
 */
export function clusterZones(
  analyses: AggregationAnalysis[],
  areas: ZoneAreas,
): AggregationAnalysis[][] {
  const zones: AggregationAnalysis[][] = []
  const wholeField: AggregationAnalysis[] = []

  for (const analysis of analyses) {
    if (!analysis.has_zone) {
      if (wholeField.length === 0) zones.push(wholeField)
      wholeField.push(analysis)
      continue
    }
    const area = areas.zone_area.get(analysis.a_id) ?? 0
    const zone = zones.find((members) => {
      const first = members[0]
      if (!first?.has_zone) return false
      const firstArea = areas.zone_area.get(first.a_id) ?? 0
      const inter = areas.intersection(analysis.a_id, first.a_id)
      const union = area + firstArea - inter
      return union > 0 && inter / union >= SOIL_ZONE_SAME_IOU
    })
    if (zone) {
      zone.push(analysis)
    } else {
      zones.push([analysis])
    }
  }
  return zones
}
