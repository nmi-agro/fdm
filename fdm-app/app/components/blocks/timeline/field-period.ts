import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"
import { nl } from "date-fns/locale"

/** Time zone in which calendar days are interpreted, matching `~/lib/calendar`. */
const TIME_ZONE = "Europe/Amsterdam"

/**
 * The period in which a field is in use. A missing bound means the period is open on that side,
 * so a field without `b_start` is treated as active from the start of the timeline.
 */
export type FieldPeriod = {
  b_start: Date | null
  b_end: Date | null
}

/** How a field's period relates to a calendar year. */
export type FieldPeriodStatus = "active" | "partial" | "inactive"

/** Error shown when a date lies outside the period in which a field is in use. */
export const OUTSIDE_FIELD_PERIOD_MESSAGE =
  "De datum valt buiten de periode waarin dit perceel in gebruik is."

function startOfZonedDay(date: Date): number {
  const zoned = new TZDate(date.getTime(), TIME_ZONE)
  return new TZDate(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), TIME_ZONE).getTime()
}

function endOfZonedDay(date: Date): number {
  const zoned = new TZDate(date.getTime(), TIME_ZONE)
  return (
    new TZDate(zoned.getFullYear(), zoned.getMonth(), zoned.getDate() + 1, TIME_ZONE).getTime() - 1
  )
}

/**
 * Determines how a field's period relates to a calendar year.
 *
 * @param field - The field period.
 * @param year - The calendar year (Europe/Amsterdam).
 * @returns `inactive` when the field is not in use at any moment of the year, `partial` when it
 *   starts or ends within the year, and `active` when it is in use during the whole year.
 */
export function getFieldPeriodStatus(field: FieldPeriod, year: number): FieldPeriodStatus {
  const yearStart = new TZDate(year, 0, 1, TIME_ZONE).getTime()
  const yearEnd = new TZDate(year + 1, 0, 1, TIME_ZONE).getTime() - 1
  const start = field.b_start ? startOfZonedDay(field.b_start) : null
  const end = field.b_end ? endOfZonedDay(field.b_end) : null

  if ((start !== null && start > yearEnd) || (end !== null && end < yearStart)) return "inactive"
  if ((start !== null && start > yearStart) || (end !== null && end < yearEnd)) return "partial"
  return "active"
}

/**
 * Checks whether a date lies within a field's period. Both the start and end day are included.
 */
export function isDateInFieldPeriod(date: Date, period: FieldPeriod): boolean {
  const time = date.getTime()
  if (period.b_start && time < startOfZonedDay(period.b_start)) return false
  if (period.b_end && time > endOfZonedDay(period.b_end)) return false
  return true
}

/**
 * Moves a date into a field's period, to the nearest bound when it lies outside.
 */
export function clampToFieldPeriod(date: Date, period: FieldPeriod): Date {
  if (period.b_start && date.getTime() < startOfZonedDay(period.b_start)) {
    return new Date(startOfZonedDay(period.b_start))
  }
  if (period.b_end && date.getTime() > period.b_end.getTime()) {
    return period.b_end
  }
  return date
}

/**
 * The end of a cultivation without end date: the end of the field, or `fallback` when the field
 * has no end date.
 */
export function getOpenCultivationEndAt(field: FieldPeriod, fallback: Date): Date {
  return field.b_end ?? fallback
}

const formatDay = (date: Date) => format(date, "d MMM", { locale: nl })
const formatDayYear = (date: Date) => format(date, "d MMM yyyy", { locale: nl })

/**
 * Text for the badge in a field's row header, or `null` when the field is in use during the
 * whole reference year.
 *
 * @param field - The field period.
 * @param referenceYear - The year in view. The year is added to a date when it differs from this.
 */
export function getFieldPeriodBadge(field: FieldPeriod, referenceYear: number): string | null {
  const fmt = (date: Date) =>
    date.getFullYear() === referenceYear ? formatDay(date) : formatDayYear(date)
  if (getFieldPeriodStatus(field, referenceYear) === "active") return null
  const startsInYear = field.b_start && field.b_start.getFullYear() === referenceYear
  const endsInYear = field.b_end && field.b_end.getFullYear() === referenceYear
  if (startsInYear && endsInYear && field.b_start && field.b_end) {
    return `${formatDay(field.b_start)} – ${formatDay(field.b_end)}`
  }
  if (getFieldPeriodStatus(field, referenceYear) === "inactive") {
    if (field.b_start && field.b_start.getFullYear() > referenceYear) {
      return `Vanaf ${formatDayYear(field.b_start)}`
    }
    if (field.b_end) return `Beëindigd per ${formatDayYear(field.b_end)}`
  }
  if (field.b_end && (!field.b_start || endsInYear)) return `Beëindigd per ${fmt(field.b_end)}`
  if (field.b_start) return `Vanaf ${fmt(field.b_start)}`
  return null
}

/** Tooltip for the marker at the start of a field's period. */
export function getFieldStartTooltip(b_start: Date): string {
  return `Perceel in gebruik vanaf ${formatDayYear(b_start)}`
}

/** Tooltip for the marker at the end of a field's period. */
export function getFieldEndTooltip(b_end: Date): string {
  return `Perceel beëindigd per ${formatDayYear(b_end)}`
}

/** Hint about the period in which a field is in use, or `null` when it has no bounds. */
export function getFieldPeriodHint(period: FieldPeriod): string | null {
  if (period.b_start && period.b_end) {
    return `Perceel is in gebruik van ${formatDayYear(period.b_start)} tot ${formatDayYear(period.b_end)}`
  }
  if (period.b_start) return `Perceel is in gebruik vanaf ${formatDayYear(period.b_start)}`
  if (period.b_end) return `Perceel is in gebruik tot ${formatDayYear(period.b_end)}`
  return null
}

/** Label of the group of fields that are not in use in the reference year. */
export function getInactiveGroupLabel(year: number, count: number): string {
  return `Niet in gebruik in ${year} (${count})`
}

/** Text shown when no field is in use in the reference year. */
export function getNoFieldsInUseLabel(year: number): string {
  return `Geen percelen in gebruik in ${year}`
}

/** Text announced to screen readers after the view regroups for another year. */
export function getRegroupAnnouncement(year: number, inactiveCount: number): string {
  const fields = inactiveCount === 1 ? "1 perceel" : `${inactiveCount} percelen`
  return `Weergave bijgewerkt voor ${year}: ${fields} niet in gebruik`
}
