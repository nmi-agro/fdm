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

    const timeframe = {
        start: new Date(`${yearStart}-01-01T00:00:00.000Z`),
        end: new Date(`${yearEnd}-12-31T23:59:59.999Z`),
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
            timeframe.start = new Date(`${year}-01-01T00:00:00.000Z`)
            timeframe.end = new Date(`${year}-12-31T23:59:59.999Z`)
        }
    }

    return timeframe
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
