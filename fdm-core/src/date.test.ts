import { describe, expect, it } from "vitest"
import { adjustEndDateAtYearStart, startOfDayInFdmTimeZone, toFdmDateString } from "./date"

describe("startOfDayInFdmTimeZone", () => {
  it("should return the start of a winter day in Europe/Amsterdam", () => {
    expect(startOfDayInFdmTimeZone(2026, 1, 1).toISOString()).toBe("2025-12-31T23:00:00.000Z")
  })

  it("should return the start of a summer day in Europe/Amsterdam", () => {
    expect(startOfDayInFdmTimeZone(2026, 7, 15).toISOString()).toBe("2026-07-14T22:00:00.000Z")
  })

  it("should handle days with a DST transition", () => {
    // Clocks go forward on 29 March 2026 and back on 25 October 2026
    expect(startOfDayInFdmTimeZone(2026, 3, 29).toISOString()).toBe("2026-03-28T23:00:00.000Z")
    expect(startOfDayInFdmTimeZone(2026, 3, 30).toISOString()).toBe("2026-03-29T22:00:00.000Z")
    expect(startOfDayInFdmTimeZone(2026, 10, 25).toISOString()).toBe("2026-10-24T22:00:00.000Z")
    expect(startOfDayInFdmTimeZone(2026, 10, 26).toISOString()).toBe("2026-10-25T23:00:00.000Z")
  })

  it("should roll over out-of-range days", () => {
    expect(startOfDayInFdmTimeZone(2025, 12, 32).toISOString()).toBe("2025-12-31T23:00:00.000Z")
  })
})

describe("adjustEndDateAtYearStart", () => {
  const endOf2025 = "2025-12-31T22:59:59.999Z"

  it.each([
    ["1 January, UTC midnight", "2026-01-01T00:00:00.000Z"],
    ["1 January, Amsterdam midnight", "2025-12-31T23:00:00.000Z"],
    ["1 January, noon UTC", "2026-01-01T12:00:00.000Z"],
  ])("should adjust %s to the end of 31 December", (_label, input) => {
    expect(adjustEndDateAtYearStart(new Date(input)).toISOString()).toBe(endOf2025)
  })

  it.each([
    ["31 December, UTC midnight", "2025-12-31T00:00:00.000Z"],
    ["31 December, Amsterdam midnight", "2025-12-30T23:00:00.000Z"],
    ["2 January, Amsterdam midnight", "2026-01-01T23:00:00.000Z"],
    ["a summer date", "2026-07-15T00:00:00.000Z"],
  ])("should not change %s", (_label, input) => {
    expect(adjustEndDateAtYearStart(new Date(input)).toISOString()).toBe(input)
  })

  it("should be idempotent", () => {
    const once = adjustEndDateAtYearStart(new Date("2026-01-01T00:00:00.000Z"))
    expect(adjustEndDateAtYearStart(once).toISOString()).toBe(once.toISOString())
  })

  it("should return an invalid date unchanged", () => {
    expect(Number.isNaN(adjustEndDateAtYearStart(new Date("invalid")).getTime())).toBe(true)
  })
})

describe("toFdmDateString", () => {
  it.each([
    ["2025-12-30T23:00:00.000Z", "2025-12-31"],
    ["2025-12-31T00:00:00.000Z", "2025-12-31"],
    ["2025-12-31T22:59:59.999Z", "2025-12-31"],
    ["2025-12-31T23:00:00.000Z", "2026-01-01"],
    ["2026-07-14T22:00:00.000Z", "2026-07-15"],
  ])("should format %s as %s", (input, expected) => {
    expect(toFdmDateString(new Date(input))).toBe(expected)
  })
})
