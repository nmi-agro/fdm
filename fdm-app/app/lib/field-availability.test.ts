import { describe, expect, it } from "vitest"
import { getFieldAvailability } from "./field-availability"

const year2025 = {
  start: new Date("2025-01-01T00:00:00Z"),
  end: new Date("2025-12-31T23:59:59Z"),
}

describe("getFieldAvailability", () => {
  it("returns null for a field managed during the timeframe", () => {
    expect(getFieldAvailability({ b_start: "2020-01-01", b_end: null }, year2025)).toBeNull()
    expect(
      getFieldAvailability({ b_start: "2025-06-01", b_end: "2025-07-01" }, year2025),
    ).toBeNull()
  })

  it("reports a field that starts after the timeframe", () => {
    expect(getFieldAvailability({ b_start: "2026-01-15", b_end: null }, year2025)).toBe(
      "not_started",
    )
  })

  it("reports a field that ended before the timeframe", () => {
    expect(getFieldAvailability({ b_start: "2020-01-01", b_end: "2024-06-01" }, year2025)).toBe(
      "ended",
    )
  })

  it("treats missing dates as open-ended", () => {
    expect(getFieldAvailability({ b_start: null, b_end: null }, year2025)).toBeNull()
  })
})
