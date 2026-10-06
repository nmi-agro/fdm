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
  if (cause.includes("does not belong to the organization")) {
    return "Dit bedrijf hoort niet bij de organisatie van de groep."
  }
  return undefined
}
