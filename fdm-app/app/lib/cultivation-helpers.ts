import type { Cultivation } from "@nmi-agro/fdm-core"

/**
 * Determines the default cultivation based on the "May 15th" rule.
 * It searches for a cultivation that is active on May 15th of the given calendar year.
 *
 * @param cultivations - List of available cultivations.
 * @param calendarYear - The calendar year (string) to check against.
 * @returns The cultivation active on May 15th, or undefined if none found.
 */
export function getDefaultCultivation(
    cultivations: Cultivation[],
    calendarYear: string,
): Cultivation | undefined {
    // Create the target date: May 15th of the selected year.
    // Using 12:00 PM to avoid timezone edge cases at midnight.
    const targetDate = new Date(`${calendarYear}-05-15T12:00:00`)

    // Sort by start date descending to prioritize newer ones if overlaps occur (though overlaps shouldn't happen ideally)
    const sortedCultivations = [...cultivations].sort((a, b) => {
        return (
            new Date(b.b_lu_start).getTime() - new Date(a.b_lu_start).getTime()
        )
    })

    return sortedCultivations.find((cultivation) => {
        const start = new Date(cultivation.b_lu_start)
        // If no end date, it's assumed to be active indefinitely or until the end of the season/year context
        const end = cultivation.b_lu_end ? new Date(cultivation.b_lu_end) : null

        // Check if target date is within [start, end]
        if (end) {
            return start <= targetDate && end >= targetDate
        }
        return start <= targetDate
    })
}
