import { describe, expect, it } from "vitest"
import {
  censusDateForYear,
  farmToday,
  farmTodayKey,
  fieldGrazingTotals,
  realisedGrazingDays,
} from "./grazing-dates"

describe("farmTodayKey", () => {
  it("follows the calendar day in the Netherlands", () => {
    // 00:30 on 13 May in the Netherlands (summer time) is still 12 May in UTC
    expect(farmTodayKey(new Date("2026-05-12T22:30:00.000Z"))).toBe("2026-05-13")
    // 00:30 on 13 January (winter time)
    expect(farmTodayKey(new Date("2026-01-12T23:30:00.000Z"))).toBe("2026-01-13")
    expect(farmTodayKey(new Date("2026-05-13T12:00:00.000Z"))).toBe("2026-05-13")
  })

  it("gives today as the end of that day in UTC", () => {
    expect(farmToday(new Date("2026-05-12T22:30:00.000Z"))).toEqual(
      new Date("2026-05-13T23:59:59.999Z"),
    )
  })
})

describe("censusDateForYear", () => {
  const now = new Date("2026-05-13T10:00:00.000Z")

  it("counts the current and future years now", () => {
    expect(censusDateForYear(2026, now)).toBe(now)
    expect(censusDateForYear(2027, now)).toBe(now)
  })

  it("counts a past year on its last day", () => {
    expect(censusDateForYear(2024, now)).toEqual(new Date("2024-12-31T23:59:59.999Z"))
  })
})

describe("realisedGrazingDays", () => {
  const today = new Date("2026-06-15T23:59:59.999Z")

  it("lets a running grazing last up to today", () => {
    const days = realisedGrazingDays(
      { l_grazing_start: "2026-06-12T00:00:00.000Z", l_grazing_end: null },
      2026,
      today,
    )
    expect(days).toEqual(["2026-06-12", "2026-06-13", "2026-06-14", "2026-06-15"])
  })

  it("leaves out planned days and days in another year", () => {
    expect(
      realisedGrazingDays(
        { l_grazing_start: "2026-06-14T00:00:00.000Z", l_grazing_end: "2026-06-20T00:00:00.000Z" },
        2026,
        today,
      ),
    ).toEqual(["2026-06-14", "2026-06-15"])
    expect(
      realisedGrazingDays({ l_grazing_start: "2026-07-01T00:00:00.000Z" }, 2026, today),
    ).toEqual([])
    expect(
      realisedGrazingDays(
        { l_grazing_start: "2025-12-31T00:00:00.000Z", l_grazing_end: "2026-01-01T00:00:00.000Z" },
        2026,
        today,
      ),
    ).toEqual(["2026-01-01"])
  })

  it("counts every year without a year", () => {
    expect(
      realisedGrazingDays(
        { l_grazing_start: "2025-12-31T00:00:00.000Z", l_grazing_end: "2026-01-01T00:00:00.000Z" },
        null,
        today,
      ),
    ).toEqual(["2025-12-31", "2026-01-01"])
  })
})

describe("fieldGrazingTotals", () => {
  const today = new Date("2026-06-15T23:59:59.999Z")

  it("counts a day once, with the most hours of that day", () => {
    const totals = fieldGrazingTotals(
      [
        {
          l_grazing_start: "2026-06-10T00:00:00.000Z",
          l_grazing_end: "2026-06-11T00:00:00.000Z",
          l_grazing_hours: 8,
        },
        // A second herd on 11 June
        {
          l_grazing_start: "2026-06-11T00:00:00.000Z",
          l_grazing_end: "2026-06-11T00:00:00.000Z",
          l_grazing_hours: 24,
        },
      ],
      2026,
      today,
    )
    expect(totals).toEqual({ days: 2, hours: 8 + 24 })
  })

  it("adds no hours for a day without hours and leaves planned days out", () => {
    const totals = fieldGrazingTotals(
      [
        { l_grazing_start: "2026-06-01T00:00:00.000Z", l_grazing_end: "2026-06-01T00:00:00.000Z" },
        {
          l_grazing_start: "2026-07-01T00:00:00.000Z",
          l_grazing_end: "2026-07-03T00:00:00.000Z",
          l_grazing_hours: 8,
        },
      ],
      2026,
      today,
    )
    expect(totals).toEqual({ days: 1, hours: 0 })
  })
})
