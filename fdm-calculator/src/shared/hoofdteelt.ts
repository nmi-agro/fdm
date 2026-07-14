/**
 * Minimal cultivation shape required to determine the hoofdteelt.
 * Compatible with both `Cultivation` (fdm-core) and `NL2025NormsInputForCultivation`.
 */
export type CultivationForHoofdteelt = {
  b_lu_catalogue: string
  b_lu_start: Date | null | undefined
  b_lu_end: Date | null | undefined
}

/**
 * BRP/catalogue code for "Groene braak, spontane opkomst" — the Dutch regulatory
 * default when no cultivation is present in the reference period.
 */
export const GROENE_BRAAK = "nl_6794"

/**
 * Finds the main cultivation ('hoofdteelt') for a given year using the legal
 * Dutch definition: the cultivation present for the longest duration within
 * the period May 15–July 15 of that year.
 *
 * In case of a tie in duration, the cultivation with the alphabetically first
 * `b_lu_catalogue` is chosen.
 *
 * Cultivations without a `b_lu_start` are skipped. A missing `b_lu_end` is
 * treated as still being present through the end of the window (July 15).
 *
 * @param cultivations - List of cultivations to evaluate.
 * @param year - The calendar year to evaluate.
 * @param options - When `fallback` is `false`, `null` is returned instead of the
 *          regulatory `GROENE_BRAAK` default when no cultivation overlaps the
 *          window. This lets UI callers distinguish "no cultivation registered"
 *          from the legal fallback. Defaults to `true`.
 * @returns The `b_lu_catalogue` of the hoofdteelt, or `GROENE_BRAAK` (`"nl_6794"`)
 *          if no cultivation overlaps with the May 15–July 15 window (or `null`
 *          when `fallback` is `false`).
 */
export function findHoofdteelt(
  cultivations: CultivationForHoofdteelt[],
  year: number,
  options?: { fallback?: true },
): string
export function findHoofdteelt(
  cultivations: CultivationForHoofdteelt[],
  year: number,
  options: { fallback: false },
): string | null
export function findHoofdteelt(
  cultivations: CultivationForHoofdteelt[],
  year: number,
  options?: { fallback?: boolean },
): string | null {
  const windowStart = new Date(`${year}-05-15`)
  const windowEnd = new Date(`${year}-07-15`)

  let maxDuration = -1
  let result: string | null = null

  for (const c of cultivations) {
    if (!c.b_lu_start) continue
    const start = new Date(c.b_lu_start)
    const end = c.b_lu_end ? new Date(c.b_lu_end) : windowEnd

    const effectiveStart = start > windowStart ? start : windowStart
    const effectiveEnd = end < windowEnd ? end : windowEnd

    if (effectiveEnd > effectiveStart) {
      const duration = effectiveEnd.getTime() - effectiveStart.getTime()
      if (duration > maxDuration) {
        maxDuration = duration
        result = c.b_lu_catalogue
      } else if (duration === maxDuration && result !== null) {
        if (c.b_lu_catalogue.localeCompare(result) < 0) {
          result = c.b_lu_catalogue
        }
      }
    }
  }

  if (result !== null) {
    return result
  }
  return options?.fallback === false ? null : GROENE_BRAAK
}
