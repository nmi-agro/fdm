/**
 * Finds the cultivation on a field that covers a date, preferring the tightest-fitting one: the
 * narrowest span wins, as when events are attached to a cultivation on the Tijdlijn. Used to decide
 * which cultivation a new harvest belongs to.
 *
 * @param cultivations - The cultivations of the field.
 * @param date - The date to look up.
 * @param openCultivationEndAt - The end to assume for a cultivation without an end date.
 * @returns The cultivation that covers the date, or `undefined` when none does.
 */
export function findActiveCultivationForDate<
  T extends { b_lu_start: Date | null; b_lu_end: Date | null },
>(cultivations: T[], date: Date, openCultivationEndAt: Date): T | undefined {
  let best: T | undefined
  let bestSpan = Number.POSITIVE_INFINITY
  for (const cultivation of cultivations) {
    if (!cultivation.b_lu_start) continue
    const endAt = cultivation.b_lu_end ?? openCultivationEndAt
    if (date < cultivation.b_lu_start || date > endAt) continue
    const span = endAt.getTime() - cultivation.b_lu_start.getTime()
    if (span < bestSpan) {
      best = cultivation
      bestSpan = span
    }
  }
  return best
}
