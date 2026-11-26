import { describe, expect, it } from "vitest"
import { getCalendarYearTimeframe } from "./data"

describe("getCalendarYearTimeframe", () => {
  it("covers the calendar year in the Europe/Amsterdam time zone", () => {
    const { start, end } = getCalendarYearTimeframe(2026)
    // 1 January 2026 00:00 in Amsterdam is 31 December 2025 23:00 UTC (CET, UTC+1).
    expect(start.toISOString()).toBe("2025-12-31T23:00:00.000Z")
    expect(end.toISOString()).toBe("2026-12-31T22:59:59.999Z")
  })
})
