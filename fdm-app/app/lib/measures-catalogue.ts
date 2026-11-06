/**
 * URLs of the measures catalogue and the farm context they carry.
 *
 * The catalogue itself is the same for everyone. When a farm is selected, the catalogue also
 * shows on which fields of that farm a measure is applied in the selected year. The farm and
 * year are passed as the query parameters `farm` and `calendar`; `farm=none` means that the
 * user explicitly chose no farm.
 */

/** Query parameter with the ID of the selected farm. */
export const CATALOGUE_FARM_PARAM = "farm"
/** Query parameter with the selected calendar year. */
export const CATALOGUE_CALENDAR_PARAM = "calendar"
/** Value of {@link CATALOGUE_FARM_PARAM} when the user explicitly chose no farm. */
export const CATALOGUE_NO_FARM = "none"

export type CatalogueFarmContext = {
  b_id_farm?: string | null
  calendar?: string | null
}

/**
 * Builds the query string with the farm context, e.g. `?farm=abc&calendar=2026`, or an empty
 * string when there is no context.
 *
 * @param context - Farm and calendar year to carry along.
 */
export function getCatalogueSearch(context?: CatalogueFarmContext): string {
  if (!context?.b_id_farm) return ""
  const params = new URLSearchParams({ [CATALOGUE_FARM_PARAM]: context.b_id_farm })
  if (context.calendar && context.b_id_farm !== CATALOGUE_NO_FARM) {
    params.set(CATALOGUE_CALENDAR_PARAM, context.calendar)
  }
  return `?${params.toString()}`
}

/**
 * Returns the path of the measures catalogue, with the farm context when given.
 *
 * @param context - Farm and calendar year to carry along.
 */
export function getMeasuresCataloguePath(context?: CatalogueFarmContext): string {
  return `/measures-catalogue${getCatalogueSearch(context)}`
}

/**
 * Returns the path of the detail page of a measure in the measures catalogue, with the farm
 * context when given.
 *
 * @param m_id - Catalogue ID of the measure, e.g. `bln_BM7`.
 * @param context - Farm and calendar year to carry along.
 * @returns The path, e.g. `/measures-catalogue/bln_BM7?farm=abc&calendar=2026`.
 */
export function getMeasureCataloguePath(m_id: string, context?: CatalogueFarmContext): string {
  return `/measures-catalogue/${encodeURIComponent(m_id)}${getCatalogueSearch(context)}`
}
