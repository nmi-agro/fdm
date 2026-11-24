/**
 * Paths and list logic of the measures catalogue. The catalogue is part of the measures section
 * of a farm, so every path includes the farm and the calendar year; the catalogue shows on which
 * fields of that farm a measure is applied, recommended or applicable in that year.
 */
import type { MeasureCatalogue } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import fuzzysort from "fuzzysort"
import type { FieldMeasureEntry, FieldMeasureStatus } from "~/lib/farm-measures"
import { type Ecosysteemdienst, getMeasureFamilyId } from "~/lib/indicators"
import { getImpactedIndicators } from "~/lib/measure-labels"

/**
 * Returns the path of the measures catalogue of a farm.
 *
 * @param b_id_farm - ID of the farm.
 * @param calendar - Calendar year, e.g. `2026`.
 * @returns The path, e.g. `/farm/abc/2026/measures/catalogue`.
 */
export function getMeasuresCataloguePath(b_id_farm: string, calendar: string): string {
  return `/farm/${b_id_farm}/${calendar}/measures/catalogue`
}

/**
 * Returns the path of the detail page of a measure in the measures catalogue of a farm.
 *
 * @param b_id_farm - ID of the farm.
 * @param calendar - Calendar year, e.g. `2026`.
 * @param m_id - Catalogue ID of the measure, e.g. `bln_BM7`.
 * @returns The path, e.g. `/farm/abc/2026/measures/catalogue/bln_BM7`.
 */
export function getMeasureCataloguePath(b_id_farm: string, calendar: string, m_id: string): string {
  return `${getMeasuresCataloguePath(b_id_farm, calendar)}/${encodeURIComponent(m_id)}`
}

/**
 * Returns the path of the measures page of a farm that opens the dialog to add a measure,
 * with the measure and, optionally, the fields already selected.
 *
 * @param b_id_farm - ID of the farm.
 * @param calendar - Calendar year, e.g. `2026`.
 * @param m_id - Catalogue ID of the measure to add, e.g. `bln_BM7`.
 * @param fieldIds - IDs of the fields to select in the dialog. The user can still change the
 *   selection.
 * @returns The path, e.g. `/farm/abc/2026/measures?openMeasure=bln_BM7&fields=f1%2Cf2`.
 */
export function getAddMeasurePath(
  b_id_farm: string,
  calendar: string,
  m_id: string,
  fieldIds: string[] = [],
): string {
  const params = new URLSearchParams({ openMeasure: m_id })
  if (fieldIds.length > 0) params.set("fields", fieldIds.join(","))
  return `/farm/${b_id_farm}/${calendar}/measures?${params.toString()}`
}

/**
 * Location state with which the catalogue list opens a measure, so the detail page can return
 * to the same filtered list.
 */
export type CatalogueReturnState = {
  /** Search string of the list, e.g. `?q=kalk&status=recommended`, or `""` without filters */
  catalogueSearch: string
}

/**
 * Turns search parameter values into a search string; empty values are left out.
 *
 * @param values - Value per parameter name.
 * @returns The search string with a leading `?`, or `""` when every value is empty.
 */
export function toSearchString(values: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(values)) {
    if (value) params.set(name, value)
  }
  const search = params.toString()
  return search ? `?${search}` : ""
}

/**
 * Returns the search string of the catalogue list a detail page was opened from, so
 * "Terug naar catalogus" returns to the same filtered list.
 *
 * @param state - The location state of the detail page.
 * @returns The search string, or `""` when the page was not opened from the list.
 */
export function getCatalogueReturnSearch(state: unknown): string {
  if (typeof state !== "object" || state === null || !("catalogueSearch" in state)) return ""
  const { catalogueSearch } = state
  return typeof catalogueSearch === "string" && catalogueSearch.startsWith("?")
    ? catalogueSearch
    : ""
}

// ── Catalogue list ─────────────────────────────────────────────────────────

/** Number of fields per status of a measure. */
export type StatusCounts = Record<FieldMeasureStatus, number>

/** Counts for a measure that is on no field. */
export const NO_COUNTS: StatusCounts = { applied: 0, recommended: 0, applicable: 0 }

/** Sort order of the catalogue list. */
export type SortMode = "name" | "code" | "recommended"

/** Status filter of the catalogue list. */
export type StatusFilter = "all" | FieldMeasureStatus

/** A measure in the catalogue list, with its short code and the ecosystem services it affects. */
export type CatalogueRow = MeasureCatalogue & {
  code: string
  ecosysteemdiensten: Ecosysteemdienst[]
}

/** The search and filters of the catalogue list. */
export type CatalogueFilters = {
  query: string
  sortMode: SortMode
  status: StatusFilter
  /** Effect type (`m_effect_type`), or `all` */
  effectType: string
  /** Cost level (`m_effect_costs`) as text, or `all` */
  costLevel: string
  theme: Ecosysteemdienst | "all"
}

/**
 * Returns the short code of a measure without the source prefix.
 *
 * @param m_id - Catalogue ID of the measure, e.g. `bln_BM7`.
 * @returns The code, e.g. `BM7`.
 */
export function getMeasureCode(m_id: string): string {
  return m_id.replace(/^bln_/, "")
}

/**
 * Returns the value of a URL search parameter when it is one of the allowed values, otherwise
 * the fallback. Keeps a hand-edited or outdated link from selecting an unknown option.
 *
 * @param params - The URL search parameters.
 * @param name - Name of the parameter.
 * @param allowed - The values that may be selected.
 * @param fallback - Value to use when the parameter is missing or not allowed.
 */
export function readSearchParam<T extends string>(
  params: URLSearchParams,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = params.get(name)
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/**
 * Returns whether a status is missing because its NMI request failed.
 *
 * @param status - The status.
 * @param availability - Which parts of the status could be loaded.
 */
export function isStatusUnavailable(
  status: FieldMeasureStatus,
  availability: { recommendationsAvailable: boolean; applicabilityAvailable: boolean },
): boolean {
  if (status === "recommended") return !availability.recommendationsAvailable
  if (status === "applicable") return !availability.applicabilityAvailable
  return false
}

/**
 * Counts per measure on how many fields it is applied, recommended or applicable.
 *
 * @param fieldsByMeasure - Per measure ID the fields with their status.
 * @returns Per measure ID the number of fields per status.
 */
export function countStatusesByMeasure(
  fieldsByMeasure: Map<string, FieldMeasureEntry[]>,
): Record<string, StatusCounts> {
  const countsByMeasure: Record<string, StatusCounts> = {}
  for (const [m_id, fields] of fieldsByMeasure) {
    const counts: StatusCounts = { ...NO_COUNTS }
    for (const field of fields) counts[field.status] += 1
    countsByMeasure[m_id] = counts
  }
  return countsByMeasure
}

/**
 * Builds the rows of the catalogue list: each measure with its short code and the ecosystem
 * services of the indicators it affects.
 *
 * @param catalogue - The measures catalogue.
 */
export function buildCatalogueRows(catalogue: MeasureCatalogue[]): CatalogueRow[] {
  return catalogue.map((item) => ({
    ...item,
    code: getMeasureCode(item.m_id),
    ecosysteemdiensten: [
      ...new Set(
        getImpactedIndicators(item.m_impacts_score)
          .map((indicator) => indicator.ecosysteemdienst)
          .filter((value): value is Ecosysteemdienst => value !== null),
      ),
    ],
  }))
}

/**
 * Sorts, filters and searches the catalogue list.
 *
 * The status filter and the "recommended" sort order only apply once the counts are loaded. The search is fuzzy over name, code, summary and description, and
 * keeps the chosen sort order.
 *
 * @param rows - Rows from {@link buildCatalogueRows}.
 * @param filters - The search and filters.
 * @param countsByMeasure - Number of fields per status per measure, or `undefined` while loading.
 * @returns The rows to show, in display order.
 */
export function filterCatalogueRows(
  rows: CatalogueRow[],
  filters: CatalogueFilters,
  countsByMeasure: Record<string, StatusCounts> | undefined,
): CatalogueRow[] {
  const { query, sortMode, status, effectType, costLevel, theme } = filters
  const countsOf = (m_id: string) => countsByMeasure?.[m_id] ?? NO_COUNTS
  const sorted = [...rows]
  if (sortMode === "code") {
    sorted.sort((a, b) => a.code.localeCompare(b.code, "nl", { numeric: true }))
  } else if (sortMode === "recommended" && countsByMeasure) {
    sorted.sort(
      (a, b) =>
        countsOf(b.m_id).recommended - countsOf(a.m_id).recommended ||
        countsOf(b.m_id).applicable - countsOf(a.m_id).applicable ||
        a.m_name.localeCompare(b.m_name, "nl"),
    )
  } else {
    sorted.sort((a, b) => a.m_name.localeCompare(b.m_name, "nl"))
  }
  const passesFilters = sorted.filter(
    (row) =>
      (status === "all" || !countsByMeasure || countsOf(row.m_id)[status] > 0) &&
      (effectType === "all" || row.m_effect_type === effectType) &&
      (costLevel === "all" || String(row.m_effect_costs) === costLevel) &&
      (theme === "all" || row.ecosysteemdiensten.includes(theme)),
  )
  if (!query.trim()) return passesFilters
  const targets = passesFilters.map((row, index) => ({
    index,
    name: row.m_name,
    code: row.code,
    summary: row.m_summary ?? "",
    description: row.m_description ?? "",
  }))
  const results = fuzzysort.go(query, targets, {
    keys: ["name", "code", "summary", "description"],
  })
  // Keep the chosen sort order instead of the fuzzy score order
  const matched = new Set(results.map((r) => r.obj.index))
  return passesFilters.filter((_, index) => matched.has(index))
}

// ── Measure detail ─────────────────────────────────────────────────────────

/** A related measure on the detail page: a conflict or another variant. */
export type RelatedMeasure = { m_id: string; m_name: string }

/**
 * Returns the measures that conflict with a measure and the other variants of the same
 * measure family.
 *
 * Conflicts with measures that are not in the catalogue are left out. Variants are ordered by ID.
 *
 * @param measure - The measure.
 * @param catalogue - The measures catalogue.
 */
export function getMeasureRelations(
  measure: MeasureCatalogue,
  catalogue: MeasureCatalogue[],
): { conflicts: RelatedMeasure[]; variants: RelatedMeasure[] } {
  const byId = new Map(catalogue.map((item) => [item.m_id, item]))
  const conflicts = (measure.m_conflicts ?? []).flatMap((conflict_id) => {
    const item = byId.get(conflict_id)
    return item ? [{ m_id: item.m_id, m_name: item.m_name }] : []
  })

  const familyId = getMeasureFamilyId(measure.m_id)
  const variants = catalogue
    .filter((item) => item.m_id !== measure.m_id && getMeasureFamilyId(item.m_id) === familyId)
    .map((item) => ({ m_id: item.m_id, m_name: item.m_name }))
    .sort((a, b) => a.m_id.localeCompare(b.m_id, "nl", { numeric: true }))

  return { conflicts, variants }
}

/**
 * Formats the period in which a measure is applied, e.g. "1-3-2026 – doorlopend".
 *
 * @param start - First day of the measure, or `null` when unknown.
 * @param end - Last day of the measure, or `null` when it is ongoing.
 */
export function formatMeasurePeriod(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  const formatDate = (value: Date | string) => format(new Date(value), "d-M-yyyy", { locale: nl })
  return `${start ? formatDate(start) : "?"} – ${end ? formatDate(end) : "doorlopend"}`
}

/**
 * Counts per indicator on how many fields the measure is recommended to improve that indicator.
 *
 * @param fields - The fields with their status for the measure.
 * @returns Per indicator ID the number of fields.
 */
export function countRecommendedFieldsByIndicator(
  fields: FieldMeasureEntry[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const field of fields) {
    if (field.status !== "recommended") continue
    for (const indicatorId of field.indicatorIds ?? []) {
      counts.set(indicatorId, (counts.get(indicatorId) ?? 0) + 1)
    }
  }
  return counts
}
