import { afterEach, describe, expect, it, vi } from "vitest"
import {
  adjustEndDateAtYearStart,
  getCalendar,
  getCalendarSelection,
  getContextualDate,
  getTimeframe,
  getTimeframeForYears,
  isSupportedYear,
} from "./calendar"

const nextYear = new Date().getFullYear() + 1

describe("getCalendar", () => {
  it("returns the calendar route param", () => {
    expect(getCalendar({ calendar: "2025" })).toBe("2025")
    expect(getCalendar({ calendar: "all" })).toBe("all")
  })
})

describe("isSupportedYear", () => {
  it("accepts whole years from 2020 up to next year", () => {
    expect(isSupportedYear(2020)).toBe(true)
    expect(isSupportedYear(nextYear)).toBe(true)
    expect(isSupportedYear(2019)).toBe(false)
    expect(isSupportedYear(nextYear + 1)).toBe(false)
    expect(isSupportedYear(2024.5)).toBe(false)
  })
})

describe("getTimeframe", () => {
  it("spans one calendar year in Europe/Amsterdam", () => {
    const { start, end } = getTimeframe({ calendar: "2025" })
    expect(start?.toISOString()).toBe("2024-12-31T23:00:00.000Z")
    expect(end?.toISOString()).toBe("2025-12-31T22:59:59.999Z")
  })

  it("spans all supported years when the calendar is not a year", () => {
    const { start, end } = getTimeframe({ calendar: "all" })
    expect(start?.toISOString()).toBe("2019-12-31T23:00:00.000Z")
    expect(end?.getUTCFullYear()).toBe(nextYear)
  })

  it("throws on an unsupported year", () => {
    expect(() => getTimeframe({ calendar: "1999" })).toThrow("Unsupported year: 1999")
  })
})

describe("getTimeframeForYears", () => {
  it("clamps the years to the supported range", () => {
    const { start, end } = getTimeframeForYears(2000, 2021)
    expect(start?.toISOString()).toBe("2019-12-31T23:00:00.000Z")
    expect(end?.toISOString()).toBe("2021-12-31T22:59:59.999Z")
  })
})

describe("adjustEndDateAtYearStart", () => {
  it("moves 1 January to the end of the previous year", () => {
    const end = new Date("2024-12-31T23:00:00.000Z") // 1 January 2025, 00:00 in Amsterdam
    expect(adjustEndDateAtYearStart(end).toISOString()).toBe("2024-12-31T22:59:59.999Z")
  })

  it("leaves other dates unchanged", () => {
    const end = new Date("2025-06-01T10:00:00.000Z")
    expect(adjustEndDateAtYearStart(end)).toBe(end)
  })
})

describe("getContextualDate", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns today in the current year and a fixed date in other years", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 4, 15, 12))
    expect(getContextualDate("2025", 3, 1)).toEqual(new Date(2025, 4, 15, 12))
    expect(getContextualDate("2023", 3, 1)).toEqual(new Date(2023, 2, 1))
    expect(getContextualDate("all", 3, 1)).toEqual(new Date(2025, 4, 15, 12))
  })
})

describe("getCalendarSelection", () => {
  it("lists the supported years, newest first", () => {
    const years = getCalendarSelection()
    expect(years[0]).toBe(String(nextYear))
    expect(years.at(-1)).toBe("2020")
  })
})
