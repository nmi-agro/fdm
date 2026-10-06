/**
 * A farm group of an organization as used by the interface, with the farms that are part of it today.
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
  return Number.isNaN(date.getTime()) ? undefined : date
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
 * Describes a period relative to today: planned (starts later), ended (the end date has passed)
 * or active.
 *
 * @param membership - The period.
 * @param today - Today as `YYYY-MM-DD`.
 * @returns The status key and its Dutch label.
 */
export function getPeriodStatus(
  membership: GroupMembership,
  today: string,
): { key: "planned" | "ended" | "active"; label: string } {
  if (membership.b_group_joined > today) {
    return { key: "planned", label: "Gepland" }
  }
  if (membership.b_group_leaved && membership.b_group_leaved <= today) {
    return { key: "ended", label: "Beëindigd" }
  }
  return { key: "active", label: "Actief" }
}

/**
 * Counts the farms and periods of a group for an overview.
 *
 * @param memberships - All periods of the group.
 * @param today - Today as `YYYY-MM-DD`.
 * @returns The number of farms that are part of the group today, the number of planned and ended
 *   periods, and the names of the farms that are part of the group today.
 */
export function summarizeMemberships(memberships: GroupMembership[], today: string) {
  const active = new Map<string, string | null>()
  let planned = 0
  let ended = 0
  for (const membership of memberships) {
    const status = getPeriodStatus(membership, today).key
    if (status === "active") {
      active.set(membership.b_id_farm, membership.b_name_farm)
    } else if (status === "planned") {
      planned += 1
    } else {
      ended += 1
    }
  }
  return {
    activeCount: active.size,
    plannedCount: planned,
    endedCount: ended,
    activeNames: [...active.values()].map((name) => name ?? "Onbekend"),
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
