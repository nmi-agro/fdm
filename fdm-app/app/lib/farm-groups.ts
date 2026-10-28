/**
 * A farm group of an organization as used by the interface, with the farms that are part of it in
 * the selected calendar year.
 */
export type OrganizationFarmGroup = {
  b_id_group: string
  b_name_group: string
  b_id_farms: string[]
}

/**
 * Checks whether two lists contain the same ids, regardless of order.
 */
export function hasSameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const sorted = [...b].sort()
  return [...a].sort().every((id, index) => id === sorted[index])
}

/**
 * Parses a date from a form field in the format `YYYY-MM-DD`.
 *
 * @param value - The form value.
 * @returns The date at midnight UTC, or `undefined` when the field is empty or not a date.
 */
export function parseDateInput(value: FormDataEntryValue | null | undefined): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }
  const date = new Date(`${value}T00:00:00Z`)
  // Reject dates that JavaScript moves to another day, such as 2025-02-31
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return undefined
  }
  return date
}

/**
 * Formats a date for display, for example 3 februari 2021.
 */
export function formatPeriodDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Translates validation and conflict errors of the farm group functions into a Dutch message.
 *
 * @param error - The error thrown by an `fdm-core` farm group function.
 * @returns A message for the user, or `undefined` when the error is not a known validation error.
 */
export function getFarmGroupErrorMessage(error: unknown): string | undefined {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : ""
  if (cause.includes("already exists")) {
    return "Er bestaat al een groep met deze naam."
  }
  if (cause.includes("Name of the farm group is required")) {
    return "Geef de groep een naam."
  }
  if (cause.includes("not a valid date")) {
    return "Vul een geldige datum in."
  }
  if (cause.includes("must be after")) {
    return "De datum tot wanneer het bedrijf deel uitmaakt van de groep moet na de startdatum liggen."
  }
  if (cause.includes("already has an end date")) {
    return "Voor deze periode is al een einddatum ingesteld."
  }
  if (cause.includes("from a later date")) {
    return "Het bedrijf maakt vanaf een latere datum al deel uit van deze groep."
  }
  if (cause.includes("already is part of the group on that date")) {
    return "Het bedrijf maakt op de startdatum al deel uit van deze groep."
  }
  if (cause.includes("has not started yet")) {
    return "Het lidmaatschap is nog niet begonnen. Geef een einddatum op of wijzig de periode."
  }
  if (cause.includes("overlaps")) {
    return "Deze periode overlapt een andere periode van het bedrijf in deze groep."
  }
  if (cause.includes("membership not found")) {
    return "Deze periode bestaat niet meer. Ververs de pagina."
  }
  if (cause.includes("does not belong to the organization")) {
    return "Dit bedrijf hoort niet bij de organisatie van de groep."
  }
  return undefined
}

/**
 * Returns the default start of a period in a farm group: 1 January of the selected calendar year.
 *
 * @param calendar - The selected calendar, a year such as `"2025"` or `"all"`.
 * @returns The date as `YYYY-MM-DD`. For anything but a year, 1 January of the current year.
 */
export function getDefaultJoinDate(calendar: string | undefined | null): string {
  const year = calendar && /^\d{4}$/.test(calendar) ? calendar : String(new Date().getFullYear())
  return `${year}-01-01`
}

/**
 * A period in which a farm is part of a group, with dates as `YYYY-MM-DD`.
 */
export type GroupMembership = {
  b_id_farm: string
  b_name_farm: string | null
  b_group_joined: string
  b_group_leaved: string | null
}

/**
 * The dates of a period in a farm group, as `Date` or as `YYYY-MM-DD`.
 */
type PeriodDates = {
  b_group_joined: Date | string
  b_group_leaved: Date | string | null
}

/** Returns a date as `YYYY-MM-DD`, the format in which periods are compared. */
function toDay(date: Date | string): string {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10)
}

/** Returns the year of a calendar selection, or `undefined` for anything but a year (e.g. `all`). */
function getCalendarYear(calendar: string | undefined | null): number | undefined {
  return calendar && /^\d{4}$/.test(calendar) ? Number(calendar) : undefined
}

/**
 * Checks whether a period in a farm group lies (partly) in the selected calendar year.
 *
 * The end date is the first day the farm is no longer part of the group, so a period that ends on
 * 1 January does not reach into that year.
 *
 * @param membership - The period.
 * @param calendar - The selected calendar, a year such as `"2025"` or `"all"`.
 * @returns `true` when the period overlaps the year, and always for anything but a year.
 */
export function isMembershipInCalendar(
  membership: PeriodDates,
  calendar: string | undefined | null,
): boolean {
  const year = getCalendarYear(calendar)
  if (year === undefined) {
    return true
  }
  return (
    toDay(membership.b_group_joined) < `${year + 1}-01-01` &&
    (membership.b_group_leaved === null || toDay(membership.b_group_leaved) > `${year}-01-01`)
  )
}

/**
 * Describes how much of the selected calendar year a period covers.
 *
 * @param membership - A period that lies (partly) in the year.
 * @param calendar - The selected calendar, a year such as `"2025"` or `"all"`.
 * @returns `full` when the period spans the whole year, `partial` when it covers part of it, or
 *   `undefined` for anything but a year.
 */
export function getMembershipCoverage(
  membership: PeriodDates,
  calendar: string | undefined | null,
): "full" | "partial" | undefined {
  const year = getCalendarYear(calendar)
  if (year === undefined) {
    return undefined
  }
  const full =
    toDay(membership.b_group_joined) <= `${year}-01-01` &&
    (membership.b_group_leaved === null || toDay(membership.b_group_leaved) >= `${year + 1}-01-01`)
  return full ? "full" : "partial"
}

/**
 * Formats the selected calendar for running text, for example `2025` or `alle jaren`.
 */
export function formatCalendarLabel(calendar: string | undefined | null): string {
  const year = getCalendarYear(calendar)
  return year === undefined ? "alle jaren" : String(year)
}

/**
 * Returns the ids of the farms that are part of a group in the selected calendar year.
 *
 * @param memberships - All periods of the group.
 * @param calendar - The selected calendar, a year such as `"2025"` or `"all"`.
 * @returns The unique farm ids, in the order of the periods.
 */
export function getFarmIdsInCalendar(
  memberships: (PeriodDates & { b_id_farm: string })[],
  calendar: string | undefined | null,
): string[] {
  return [
    ...new Set(
      memberships
        .filter((membership) => isMembershipInCalendar(membership, calendar))
        .map((membership) => membership.b_id_farm),
    ),
  ]
}

/**
 * Counts the farms of a group in the selected calendar year for an overview.
 *
 * @param memberships - All periods of the group.
 * @param calendar - The selected calendar, a year such as `"2025"` or `"all"`.
 * @returns The number and names of the farms that are part of the group in that year.
 */
export function summarizeMemberships(
  memberships: GroupMembership[],
  calendar: string | undefined | null,
) {
  const farms = new Map<string, string | null>()
  for (const membership of memberships) {
    if (isMembershipInCalendar(membership, calendar)) {
      farms.set(membership.b_id_farm, membership.b_name_farm)
    }
  }
  return {
    farmCount: farms.size,
    farmNames: [...farms.values()].map((name) => name ?? "Onbekend"),
  }
}

/**
 * Validates the dates of a period in a farm group.
 *
 * @param joined - The date from which the farm is part of the group (YYYY-MM-DD), or empty.
 * @param leaved - The date until which the farm is part of the group (YYYY-MM-DD), or empty.
 * @returns A Dutch error message when the end date is not after the start date, otherwise undefined.
 */
export function getPeriodError(joined: string, leaved: string): string | undefined {
  if (joined && leaved && leaved <= joined) {
    return "De einddatum moet na de startdatum liggen."
  }
  return undefined
}
