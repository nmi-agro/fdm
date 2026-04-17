import type { Timeframe } from "@nmi-agro/fdm-core"
import type { Params } from "react-router"

const yearStart = 2020
const yearEnd = new Date().getFullYear() + 1

export const startMonth = new Date(yearStart, 0)
export const endMonth = new Date(yearEnd, 11)

export function getCalendar(params: Params): string {
    const calendar = params.calendar as string

    return calendar
}

export function getTimeframe(params: Params): Timeframe {
    const calendar = getCalendar(params)

    // Use the server time zone
    // Current assumption is that the user and the server will both be in the same time zone (for the Netherlands: Amsterdam)
    // When retrieving 1 January and 31 December for the given year, the runtime will most of the time fill in the winter time zone (for Amsterdam: CET)
    const timeframe = {
        start: new Date(yearStart, 0, 1, 0, 0, 0, 0),
        end: new Date(yearEnd, 11, 31, 23, 59, 59, 999),
    }

    // Check if calendar is year and create a timeframe
    if (calendar) {
        // Try to coerce to year
        const year = Number(calendar)
        if (!Number.isNaN(year)) {
            // Check if year is supported
            if (year < yearStart || year > yearEnd) {
                throw new Error(`Unsupported year: ${calendar}`)
            }
            // Set start and end date
            timeframe.start = new Date(year, 0, 1, 0, 0, 0, 0)
            timeframe.end = new Date(year, 11, 31, 23, 59, 59, 999)
        }
    }

    return timeframe
}

/**
 * Returns a context-aware default date based on the active cultivation calendar year.
 *
 * - If the calendar year matches the current real-world year, returns today's date.
 * - Otherwise, returns a fixed date (defaultMonth/defaultDay) within the calendar year.
 *
 * @param calendar - Active calendar year as a string (e.g. "2023"), or undefined.
 * @param defaultMonth - 1-indexed month for the fallback date (e.g. 3 for March).
 * @param defaultDay - Day of the month for the fallback date (e.g. 1 for the 1st).
 */
export function getContextualDate(
    calendar: string | undefined,
    defaultMonth: number,
    defaultDay: number,
): Date {
    const currentYear = new Date().getFullYear()
    const parsedYear = calendar ? Number(calendar) : currentYear
    const calendarYear = Number.isInteger(parsedYear) ? parsedYear : currentYear

    if (calendarYear === currentYear) {
        return new Date()
    }

    return new Date(calendarYear, defaultMonth - 1, defaultDay)
}

export function getCalendarSelection(): string[] {
    // Create array of years from 2020 to next year
    const years = []
    for (let i = yearStart; i <= yearEnd; i++) {
        years.push(i.toString())
    }

    // Reverse the array
    years.reverse()

    return years
}
