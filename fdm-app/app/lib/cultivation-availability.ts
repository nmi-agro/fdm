// Keep in sync with `isCultivationUnavailableInPeriod` in `@nmi-agro/fdm-core`. It is duplicated
// here because fdm-core depends on the database layer and cannot be bundled for the browser,
// while the forms need this check client-side.

// Guards against runaway loops when the dates are clearly wrong.
const MAX_PERIOD_YEARS_FOR_AVAILABILITY = 100

/**
 * Determines whether the RVO crop code of a cultivation is unavailable in at least one of the
 * years in which the cultivation is active.
 *
 * @param period - Start and end date of the cultivation. A missing end date means the cultivation
 * is still active and runs up to `lastCultivationAvailabilityYear`.
 * @param b_lu_ya - Sorted array of years in which the crop code is available, or `null` when no
 * availability information exists for the crop code.
 * @param lastCultivationAvailabilityYear - Last year that is checked for cultivations without an end date.
 * @returns A truthy object, maybe with a not_available in field, when a warning should be shown.
 * This is also the case when the period is invalid (end before start, or longer than 100 years), where no
 * availability info is supplied. `false` when the crop code is available in every year or when availability
 * cannot be determined.
 */
export function isCultivationUnavailableInPeriod(
  period: { b_lu_start?: Date | string | null; b_lu_end?: Date | string | null },
  b_lu_ya: number[] | null | undefined,
  lastCultivationAvailabilityYear: number | undefined,
): { first_unavailable_in?: number; last_unavailable_in?: number } | null {
  if (
    !b_lu_ya ||
    b_lu_ya.length === 0 ||
    typeof lastCultivationAvailabilityYear !== "number" ||
    Number.isNaN(lastCultivationAvailabilityYear) ||
    !period.b_lu_start
  ) {
    return null
  }

  const start = new Date(period.b_lu_start)
  const end = period.b_lu_end ? new Date(period.b_lu_end) : null

  if (Number.isNaN(start.getFullYear()) || (end && Number.isNaN(end.getFullYear()))) {
    return null
  }

  if (end && end.getTime() < start.getTime()) {
    // End before start: user will see another warning anyways so return null.
    return null
  }

  const startYear = Math.min(lastCultivationAvailabilityYear, start.getFullYear())

  // Can return an open unavailability range when end is null.
  if (end === null && lastCultivationAvailabilityYear > b_lu_ya[b_lu_ya.length - 1]) {
    return { first_unavailable_in: b_lu_ya[b_lu_ya.length - 1] + 1 }
  }

  // The boundary offsets can invert the years for very short periods around 1 January.
  const endYear = Math.max(
    startYear,
    Math.min(
      lastCultivationAvailabilityYear,
      end ? end.getFullYear() : lastCultivationAvailabilityYear,
    ),
  )

  if (endYear > b_lu_ya[b_lu_ya.length - 1]) {
    return {
      first_unavailable_in: Math.max(startYear, b_lu_ya[b_lu_ya.length - 1] + 1),
      last_unavailable_in: endYear,
    }
  }

  if (startYear < b_lu_ya[0]) {
    return {
      first_unavailable_in: startYear,
      last_unavailable_in: Math.min(endYear, b_lu_ya[0] - 1),
    }
  }

  if (endYear - startYear > MAX_PERIOD_YEARS_FOR_AVAILABILITY) {
    // Guard against long-running loops, there probably won't be an
    // agricultural cultivation that has been active for 100+ years.
    return {}
  }

  for (let y = startYear; y <= endYear; y++) {
    if (!b_lu_ya.includes(y)) {
      return { first_unavailable_in: y, last_unavailable_in: y }
    }
  }
  return null
}
