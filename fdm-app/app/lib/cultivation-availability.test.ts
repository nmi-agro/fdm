import { describe, expect, it } from "vitest"
import { isCultivationUnavailableInPeriod } from "./cultivation-availability"

const years = [2022, 2023, 2024, 2025]

describe("isCultivationUnavailableInPeriod", () => {
  it("returns null when the crop code is available in every active year", () => {
    expect(
      isCultivationUnavailableInPeriod(
        { b_lu_start: "2023-04-01", b_lu_end: "2024-09-01" },
        years,
        2025,
      ),
    ).toBeNull()
  })

  it("returns null when availability cannot be determined", () => {
    const period = { b_lu_start: "2023-04-01", b_lu_end: "2023-09-01" }
    expect(isCultivationUnavailableInPeriod(period, null, 2025)).toBeNull()
    expect(isCultivationUnavailableInPeriod(period, [], 2025)).toBeNull()
    expect(isCultivationUnavailableInPeriod(period, years, undefined)).toBeNull()
    expect(isCultivationUnavailableInPeriod({ b_lu_start: null }, years, 2025)).toBeNull()
  })

  it("returns null when the end is before the start", () => {
    expect(
      isCultivationUnavailableInPeriod(
        { b_lu_start: "2024-04-01", b_lu_end: "2023-04-01" },
        years,
        2025,
      ),
    ).toBeNull()
  })

  it("reports the years before the crop code existed", () => {
    expect(
      isCultivationUnavailableInPeriod(
        { b_lu_start: "2020-04-01", b_lu_end: "2022-09-01" },
        years,
        2025,
      ),
    ).toEqual({ first_unavailable_in: 2020, last_unavailable_in: 2021 })
  })

  it("reports the years after the crop code was dropped", () => {
    expect(
      isCultivationUnavailableInPeriod(
        { b_lu_start: "2025-04-01", b_lu_end: "2026-09-01" },
        years,
        2026,
      ),
    ).toEqual({ first_unavailable_in: 2026, last_unavailable_in: 2026 })
  })

  it("reports an open range for a running cultivation whose code was dropped", () => {
    expect(isCultivationUnavailableInPeriod({ b_lu_start: "2024-04-01" }, years, 2027)).toEqual({
      first_unavailable_in: 2026,
    })
  })

  it("reports a gap year in the middle of the period", () => {
    expect(
      isCultivationUnavailableInPeriod(
        { b_lu_start: "2022-04-01", b_lu_end: "2025-09-01" },
        [2022, 2024, 2025],
        2025,
      ),
    ).toEqual({ first_unavailable_in: 2023, last_unavailable_in: 2023 })
  })
})
