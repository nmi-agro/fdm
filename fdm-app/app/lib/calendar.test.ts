import { describe, it, expect, beforeEach, vi } from "vitest"
import {
    getCalendar,
    getTimeframe,
    getContextualDate,
    getCalendarSelection,
    startMonth,
    endMonth,
} from "./calendar"

describe("calendar utilities", () => {
    describe("getCalendar", () => {
        it("should return the calendar parameter from params", () => {
            const params = { calendar: "2024" }
            expect(getCalendar(params)).toBe("2024")
        })

        it("should return calendar value even if other params exist", () => {
            const params = { calendar: "2023", b_id_farm: "farm123" }
            expect(getCalendar(params)).toBe("2023")
        })

        it("should handle undefined calendar gracefully", () => {
            const params = {}
            expect(getCalendar(params)).toBeUndefined()
        })
    })

    describe("getTimeframe", () => {
        const yearStart = 2020
        const currentYear = new Date().getFullYear()
        const yearEnd = currentYear + 1

        it("should return default timeframe when calendar is undefined", () => {
            const params = {}
            const timeframe = getTimeframe(params)

            expect(timeframe.start).toEqual(
                new Date(`${yearStart}-01-01T00:00:00.000Z`),
            )
            expect(timeframe.end).toEqual(
                new Date(`${yearEnd}-12-31T23:59:59.999Z`),
            )
        })

        it("should return timeframe for specific year", () => {
            const params = { calendar: "2023" }
            const timeframe = getTimeframe(params)

            expect(timeframe.start).toEqual(
                new Date("2023-01-01T00:00:00.000Z"),
            )
            expect(timeframe.end).toEqual(
                new Date("2023-12-31T23:59:59.999Z"),
            )
        })

        it("should return timeframe for current year", () => {
            const params = { calendar: String(currentYear) }
            const timeframe = getTimeframe(params)

            expect(timeframe.start).toEqual(
                new Date(`${currentYear}-01-01T00:00:00.000Z`),
            )
            expect(timeframe.end).toEqual(
                new Date(`${currentYear}-12-31T23:59:59.999Z`),
            )
        })

        it("should return timeframe for future year", () => {
            const params = { calendar: String(yearEnd) }
            const timeframe = getTimeframe(params)

            expect(timeframe.start).toEqual(
                new Date(`${yearEnd}-01-01T00:00:00.000Z`),
            )
            expect(timeframe.end).toEqual(
                new Date(`${yearEnd}-12-31T23:59:59.999Z`),
            )
        })

        it("should throw error for year before supported range", () => {
            const params = { calendar: "2019" }

            expect(() => getTimeframe(params)).toThrow("Unsupported year: 2019")
        })

        it("should throw error for year after supported range", () => {
            const params = { calendar: String(yearEnd + 1) }

            expect(() => getTimeframe(params)).toThrow(
                `Unsupported year: ${yearEnd + 1}`,
            )
        })

        it("should handle non-numeric calendar values gracefully", () => {
            const params = { calendar: "not-a-year" }

            // Non-numeric values result in NaN, which should return default timeframe
            const timeframe = getTimeframe(params)
            expect(timeframe.start).toEqual(
                new Date(`${yearStart}-01-01T00:00:00.000Z`),
            )
            expect(timeframe.end).toEqual(
                new Date(`${yearEnd}-12-31T23:59:59.999Z`),
            )
        })

        it("should handle boundary year 2020", () => {
            const params = { calendar: "2020" }
            const timeframe = getTimeframe(params)

            expect(timeframe.start).toEqual(
                new Date("2020-01-01T00:00:00.000Z"),
            )
            expect(timeframe.end).toEqual(
                new Date("2020-12-31T23:59:59.999Z"),
            )
        })
    })

    describe("getContextualDate", () => {
        const currentYear = new Date().getFullYear()

        it("should return today's date when calendar year matches current year", () => {
            const calendar = String(currentYear)
            const result = getContextualDate(calendar, 3, 15)

            const today = new Date()
            expect(result.getDate()).toBe(today.getDate())
            expect(result.getMonth()).toBe(today.getMonth())
            expect(result.getFullYear()).toBe(today.getFullYear())
        })

        it("should return today's date when calendar is undefined", () => {
            const result = getContextualDate(undefined, 3, 15)

            const today = new Date()
            expect(result.getDate()).toBe(today.getDate())
            expect(result.getMonth()).toBe(today.getMonth())
            expect(result.getFullYear()).toBe(today.getFullYear())
        })

        it("should return fixed date for past calendar year", () => {
            const calendar = "2022"
            const result = getContextualDate(calendar, 3, 15)

            expect(result).toEqual(new Date(2022, 2, 15)) // Month is 0-indexed
        })

        it("should return fixed date for future calendar year", () => {
            const futureYear = currentYear + 1
            const calendar = String(futureYear)
            const result = getContextualDate(calendar, 6, 1)

            expect(result).toEqual(new Date(futureYear, 5, 1))
        })

        it("should handle month=1 (January) correctly", () => {
            const calendar = "2023"
            const result = getContextualDate(calendar, 1, 1)

            expect(result).toEqual(new Date(2023, 0, 1))
        })

        it("should handle month=12 (December) correctly", () => {
            const calendar = "2023"
            const result = getContextualDate(calendar, 12, 31)

            expect(result).toEqual(new Date(2023, 11, 31))
        })

        it("should handle different days of the month", () => {
            const calendar = "2023"

            const result1 = getContextualDate(calendar, 4, 1)
            expect(result1).toEqual(new Date(2023, 3, 1))

            const result2 = getContextualDate(calendar, 4, 15)
            expect(result2).toEqual(new Date(2023, 3, 15))

            const result3 = getContextualDate(calendar, 4, 30)
            expect(result3).toEqual(new Date(2023, 3, 30))
        })

        it("should correctly handle leap years", () => {
            const calendar = "2024" // Leap year
            const result = getContextualDate(calendar, 2, 29)

            expect(result).toEqual(new Date(2024, 1, 29))
        })
    })

    describe("getCalendarSelection", () => {
        const currentYear = new Date().getFullYear()
        const yearStart = 2020
        const yearEnd = currentYear + 1

        it("should return array of years from 2020 to next year", () => {
            const selection = getCalendarSelection()

            expect(Array.isArray(selection)).toBe(true)
            expect(selection.length).toBe(yearEnd - yearStart + 1)
        })

        it("should return years in reverse order (newest first)", () => {
            const selection = getCalendarSelection()

            expect(selection[0]).toBe(String(yearEnd))
            expect(selection[selection.length - 1]).toBe(String(yearStart))
        })

        it("should include current year", () => {
            const selection = getCalendarSelection()

            expect(selection).toContain(String(currentYear))
        })

        it("should include next year", () => {
            const selection = getCalendarSelection()

            expect(selection).toContain(String(yearEnd))
        })

        it("should include year 2020", () => {
            const selection = getCalendarSelection()

            expect(selection).toContain("2020")
        })

        it("should have all years as strings", () => {
            const selection = getCalendarSelection()

            selection.forEach((year) => {
                expect(typeof year).toBe("string")
            })
        })

        it("should have consecutive years", () => {
            const selection = getCalendarSelection()

            for (let i = 0; i < selection.length - 1; i++) {
                const year1 = Number(selection[i])
                const year2 = Number(selection[i + 1])
                expect(year1 - year2).toBe(1) // Since reversed, should decrease by 1
            }
        })
    })

    describe("startMonth and endMonth constants", () => {
        const currentYear = new Date().getFullYear()
        const yearStart = 2020
        const yearEnd = currentYear + 1

        it("should have startMonth set to January 2020", () => {
            expect(startMonth).toEqual(new Date(yearStart, 0))
        })

        it("should have endMonth set to December of next year", () => {
            expect(endMonth).toEqual(new Date(yearEnd, 11))
        })

        it("should have startMonth before endMonth", () => {
            expect(startMonth.getTime()).toBeLessThan(endMonth.getTime())
        })
    })

    describe("edge cases and negative tests", () => {
        it("should handle empty params object in getCalendar", () => {
            const params = {}
            const result = getCalendar(params)

            expect(result).toBeUndefined()
        })

        it("should handle null calendar value", () => {
            const params = { calendar: null as any }
            const result = getCalendar(params)

            expect(result).toBeNull()
        })

        it("should handle very large month values in getContextualDate", () => {
            const calendar = "2023"
            // JavaScript Date handles overflow, month 13 becomes January of next year
            const result = getContextualDate(calendar, 13, 1)

            expect(result).toEqual(new Date(2023, 12, 1)) // This becomes Jan 2024
        })

        it("should handle day=0 in getContextualDate", () => {
            const calendar = "2023"
            // Day 0 is treated as last day of previous month
            const result = getContextualDate(calendar, 3, 0)

            expect(result).toEqual(new Date(2023, 2, 0)) // Last day of Feb
        })
    })

    describe("integration scenarios", () => {
        it("should support full workflow: get calendar -> get timeframe -> get contextual date", () => {
            const params = { calendar: "2023" }

            // Step 1: Get calendar
            const calendar = getCalendar(params)
            expect(calendar).toBe("2023")

            // Step 2: Get timeframe
            const timeframe = getTimeframe(params)
            expect(timeframe.start.getFullYear()).toBe(2023)
            expect(timeframe.end.getFullYear()).toBe(2023)

            // Step 3: Get contextual date
            const contextualDate = getContextualDate(calendar, 6, 15)
            expect(contextualDate.getFullYear()).toBe(2023)
            expect(contextualDate.getMonth()).toBe(5) // June (0-indexed)
            expect(contextualDate.getDate()).toBe(15)

            // Verify contextual date is within timeframe
            expect(contextualDate.getTime()).toBeGreaterThanOrEqual(
                timeframe.start.getTime(),
            )
            expect(contextualDate.getTime()).toBeLessThanOrEqual(
                timeframe.end.getTime(),
            )
        })

        it("should handle switching between years", () => {
            const params2022 = { calendar: "2022" }
            const params2023 = { calendar: "2023" }

            const timeframe2022 = getTimeframe(params2022)
            const timeframe2023 = getTimeframe(params2023)

            expect(timeframe2022.start.getFullYear()).toBe(2022)
            expect(timeframe2023.start.getFullYear()).toBe(2023)

            // Verify timeframes don't overlap
            expect(timeframe2022.end.getTime()).toBeLessThan(
                timeframe2023.start.getTime(),
            )
        })
    })
})