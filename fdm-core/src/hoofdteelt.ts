/**
 * Minimal cultivation shape required to determine the hoofdteelt.
 * Compatible with both `Cultivation` (fdm-core) and `NL2025NormsInputForCultivation`.
 */
export type CultivationForHoofdteelt = {
  b_lu_catalogue: string
  b_lu_start: Date | null | undefined
  b_lu_end: Date | null | undefined
}

export type CompleteHoofdteeltCultivation = Omit<
  CultivationForHoofdteelt,
  "b_lu_start" | "b_lu_end"
> & {
  b_lu: string
  b_lu_start: Date | null
  b_lu_end: Date | null
  b_lu_variety: string | null
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
 * @param returnNull - When `true`, returns `null` instead of `GROENE_BRAAK` if no
 *   cultivation overlaps the window. Defaults to `false`, preserving the regulatory
 *   fallback behaviour required for compliance calculations.
 * @param treatMissingStartAsPresent - When `true`, treats a missing start date as
 *   the start of time. This preserves the Dutch norms rule for unknown start dates.
 * @returns The hoofdteelt cultivation object. If no cultivation overlaps with the
 *          May 15–July 15 window, returns a complete synthetic `GROENE_BRAAK`
 *          object by default, or `null` when `returnNull` is `true`.
 */
export function findHoofdteelt<T extends CultivationForHoofdteelt>(
  cultivations: T[],
  year: number,
  returnNull?: false,
  treatMissingStartAsPresent?: boolean,
): T | CompleteHoofdteeltCultivation
export function findHoofdteelt<T extends CultivationForHoofdteelt>(
  cultivations: T[],
  year: number,
  returnNull: true,
  treatMissingStartAsPresent?: boolean,
): T | null
export function findHoofdteelt<T extends CultivationForHoofdteelt>(
  cultivations: T[],
  year: number,
  returnNull = false,
  treatMissingStartAsPresent = false,
): T | CompleteHoofdteeltCultivation | null {
  const windowStart = new Date(`${year}-05-15`)
  const windowEnd = new Date(`${year}-07-15`)

  let maxDuration = -1
  let result: T | null = null

  for (const c of cultivations) {
    if (!c.b_lu_start && !treatMissingStartAsPresent) continue
    const start = c.b_lu_start ? new Date(c.b_lu_start) : new Date(0)
    const end = c.b_lu_end ? new Date(c.b_lu_end) : windowEnd

    const effectiveStart = start > windowStart ? start : windowStart
    const effectiveEnd = end < windowEnd ? end : windowEnd

    if (effectiveEnd > effectiveStart) {
      const duration = effectiveEnd.getTime() - effectiveStart.getTime()
      if (duration > maxDuration) {
        maxDuration = duration
        result = c
      } else if (duration === maxDuration && result !== null) {
        if (c.b_lu_catalogue.localeCompare(result.b_lu_catalogue) < 0) {
          result = c
        }
      }
    }
  }

  if (result !== null) return result
  if (returnNull) return null

  return {
    b_lu: "Groene braak, spontane opkomst",
    b_lu_catalogue: GROENE_BRAAK,
    b_lu_start: new Date(`${year}-01-01`),
    b_lu_end: new Date(`${year}-12-31`),
    b_lu_variety: null,
  }
}
