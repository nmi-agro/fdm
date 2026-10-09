import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CalendarX } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { isSupportedYear } from "~/lib/calendar"

/** Whether the field starts after the selected year or has ended before it. */
export type FieldAvailability = "not_started" | "ended"

interface FieldNotAvailableForYearProps {
  /** Name of the field. */
  b_name?: string | null
  /** Why the field is not available in the selected year. */
  availability: FieldAvailability
  /** The selected calendar year. */
  calendar: string
  /** Start date of the field. */
  b_start: Date | string | null
  /** Last day the field is managed. */
  b_end: Date | string | null
  /** Link to the settings page of the field. */
  settingsHref: string
}

/** Formats a date as a calendar date in Europe/Amsterdam, so server and browser render the same. */
function formatDate(date: Date | string): string {
  return format(new TZDate(new Date(date), "Europe/Amsterdam"), "d MMMM yyyy", { locale: nl })
}

/** Returns the calendar year of a date in Europe/Amsterdam. */
function getYear(date: Date | string): number {
  return new TZDate(new Date(date), "Europe/Amsterdam").getFullYear()
}

/**
 * Shown on the pages of a field when the field is not managed in the selected calendar year,
 * with a link to the same page in the nearest year in which the field is managed (its first or
 * last year) and a link to the settings page where the start and end date can be changed.
 */
export function FieldNotAvailableForYear({
  b_name,
  availability,
  calendar,
  b_start,
  b_end,
  settingsHref,
}: FieldNotAvailableForYearProps) {
  const description =
    availability === "not_started" && b_start
      ? `Dit perceel is in gebruik vanaf ${formatDate(b_start)}.`
      : availability === "ended" && b_end
        ? `Dit perceel was in gebruik tot en met ${formatDate(b_end)}.`
        : null

  // The nearest year in which the field is managed: its first year, or its last year when ended
  const location = useLocation()
  const nearestDate = availability === "not_started" ? b_start : b_end
  const nearestYear = nearestDate ? getYear(nearestDate) : null
  const pathSegments = location.pathname.split("/")
  // Paths look like /farm/{b_id_farm}/{calendar}/...
  const nearestYearHref =
    nearestYear !== null && isSupportedYear(nearestYear) && pathSegments[3] === calendar
      ? [...pathSegments.slice(0, 3), String(nearestYear), ...pathSegments.slice(4)].join("/")
      : null

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarX />
        </EmptyMedia>
        <EmptyTitle>
          {b_name ? `Perceel ${b_name}` : "Dit perceel"} is niet beschikbaar in {calendar}
        </EmptyTitle>
        <EmptyDescription>
          {description} Klopt dit niet? Pas dan de begin- of einddatum van het perceel aan bij de
          eigenschappen.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          {nearestYearHref && (
            <Button asChild>
              <NavLink to={`${nearestYearHref}${location.search}`}>Ga naar {nearestYear}</NavLink>
            </Button>
          )}
          <Button asChild variant={nearestYearHref ? "outline" : "default"}>
            <NavLink to={settingsHref}>Naar eigenschappen</NavLink>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
