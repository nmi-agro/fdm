/**
 * Paths of the measures catalogue. The catalogue is part of the measures section of a farm,
 * so every path includes the farm and the calendar year; the catalogue shows on which fields
 * of that farm a measure is applied, recommended or applicable in that year.
 */

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
