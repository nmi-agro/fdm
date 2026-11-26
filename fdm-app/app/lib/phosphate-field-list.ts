import type { PhosphateVerdict } from "@nmi-agro/fdm-calculator/browser"

/** Columns of the phosphate field table that can be sorted. */
export type PhosphateFieldSortKey = "verdict" | "name" | "area" | "saldo"

/** Sorting of the phosphate field table. */
export type PhosphateFieldSort = { key: PhosphateFieldSortKey; dir: "asc" | "desc" }

/** Filter and sorting of the phosphate field table, kept in the URL. */
export type PhosphateFieldListState = {
  filter: PhosphateVerdict | "all"
  sort: PhosphateFieldSort
}

/** Search parameters of the field table: `verdict` (filter) and `sort` (e.g. `area:desc`). */
const PARAMS = ["verdict", "sort"] as const

const SORT_KEYS: PhosphateFieldSortKey[] = ["verdict", "name", "area", "saldo"]
const VERDICTS: PhosphateVerdict[] = ["good", "attention", "adjust", "unknown"]
const DEFAULT_SORT: PhosphateFieldSort = { key: "verdict", dir: "asc" }

/**
 * Reads the filter and sorting of the phosphate field table from the URL. Unknown values fall back
 * to all fields, most urgent first.
 *
 * @param searchParams - The search parameters of the page.
 * @returns The filter and sorting.
 */
export function readPhosphateFieldListState(
  searchParams: URLSearchParams,
): PhosphateFieldListState {
  const verdict = searchParams.get("verdict")
  const [key, dir] = (searchParams.get("sort") ?? "").split(":")
  return {
    filter: VERDICTS.includes(verdict as PhosphateVerdict) ? (verdict as PhosphateVerdict) : "all",
    sort:
      SORT_KEYS.includes(key as PhosphateFieldSortKey) && (dir === "asc" || dir === "desc")
        ? { key: key as PhosphateFieldSortKey, dir }
        : DEFAULT_SORT,
  }
}

/**
 * Writes the filter and sorting of the phosphate field table into the search parameters. Defaults
 * are left out, so the plain page URL stays clean; other parameters are kept.
 *
 * @param searchParams - The current search parameters.
 * @param state - The filter and sorting to write.
 * @returns New search parameters.
 */
export function writePhosphateFieldListState(
  searchParams: URLSearchParams,
  state: PhosphateFieldListState,
): URLSearchParams {
  const next = new URLSearchParams(searchParams)
  if (state.filter === "all") next.delete("verdict")
  else next.set("verdict", state.filter)
  if (state.sort.key === DEFAULT_SORT.key && state.sort.dir === DEFAULT_SORT.dir)
    next.delete("sort")
  else next.set("sort", `${state.sort.key}:${state.sort.dir}`)
  return next
}

/**
 * Whether a navigation changes only the filter or sorting of the phosphate field table. The loaders
 * then do not need to run again: sorting a table should not recalculate the farm balance.
 *
 * @param currentUrl - The URL before the navigation.
 * @param nextUrl - The URL after the navigation.
 * @returns `true` when only `verdict` or `sort` changed.
 */
export function isPhosphateFieldListChange(currentUrl: URL, nextUrl: URL): boolean {
  if (currentUrl.pathname !== nextUrl.pathname || currentUrl.search === nextUrl.search) {
    return false
  }
  const withoutListParams = (url: URL) => {
    const params = new URLSearchParams(url.search)
    for (const param of PARAMS) params.delete(param)
    params.sort()
    return params.toString()
  }
  return withoutListParams(currentUrl) === withoutListParams(nextUrl)
}
