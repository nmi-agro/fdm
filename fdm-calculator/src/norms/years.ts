/**
 * The years for which the legal application norms (gebruiksnormen) and their fillings can be
 * calculated, oldest first.
 *
 * The norms of 2027 are provisional: they use the 2026 rules until the official 2027 RVO tables
 * are published.
 */
export const NORMS_YEARS = ["2025", "2026", "2027"] as const

/** A year for which the legal application norms can be calculated. See {@link NORMS_YEARS}. */
export type NormsYear = (typeof NORMS_YEARS)[number]

/**
 * Checks whether the norms can be calculated for a year.
 *
 * @param year - The year to check, for example a calendar from a route parameter.
 * @returns `true` when `year` is one of {@link NORMS_YEARS}.
 */
export function isNormsYear(year: unknown): year is NormsYear {
  return (NORMS_YEARS as readonly unknown[]).includes(year)
}
