import { describe, expect, it } from "vitest"
import {
  clampToYear,
  defaultMapDay,
  getFieldGrazingState,
  type GrazingMapGrazing,
  grazingEndDay,
  shiftDay,
} from "./grazing-map"

const grazing = (start: string, end: string | null): GrazingMapGrazing => ({
  l_id_herd: "herd",
  l_herd_name: "Melkkoeien",
  b_id: "field",
  l_grazing_start: start,
  l_grazing_end: end,
  l_grazing_hours: 8,
  l_grazing_geometry_zone: null,
})

const state = (
  grazings: GrazingMapGrazing[],
  day: string,
  harvests: { harvestDate: string }[] = [],
) =>
  getFieldGrazingState({
    grazings,
    harvests,
    day,
    today: "2026-06-15",
    calendarYear: Number(day.slice(0, 4)),
    isGrassland: true,
    isBufferstrip: false,
  })

describe("getFieldGrazingState", () => {
  it("disables fields that are not grassland or are a buffer strip", () => {
    expect(
      getFieldGrazingState({
        grazings: [],
        harvests: [],
        day: "2026-06-15",
        today: "2026-06-15",
        calendarYear: 2026,
        isGrassland: false,
        isBufferstrip: false,
      }).status,
    ).toBe("disabled")
  })

  it("shows a grazing that covers the day", () => {
    expect(state([grazing("2026-06-10", "2026-06-20")], "2026-06-15").status).toBe("weiden")
  })

  it("lets a running grazing last up to today", () => {
    const running = [grazing("2026-06-01", null)]
    expect(state(running, "2026-06-15").status).toBe("weiden")
    // After today the running grazing is the last use, ending today
    expect(state(running, "2026-06-18")).toMatchObject({ status: "rust", restDays: 3 })
  })

  it("shows a harvest on the day", () => {
    expect(state([], "2026-06-15", [{ harvestDate: "2026-06-15" }]).status).toBe("maaien")
  })

  it("counts rest from the last use before the day", () => {
    const result = state([grazing("2026-05-01", "2026-05-04")], "2026-05-24", [
      { harvestDate: "2026-05-10" },
    ])
    expect(result).toMatchObject({
      status: "rust",
      restDays: 14,
      lastUse: { type: "maaien", date: "2026-05-10" },
    })
  })

  it("ignores uses in another year and planned uses after the day", () => {
    const grazings = [grazing("2025-10-01", "2025-10-05"), grazing("2026-07-01", "2026-07-05")]
    expect(state(grazings, "2026-04-01").status).toBe("unused")
  })

  it("counts a grazing that started last year and ended this year", () => {
    expect(state([grazing("2025-12-28", "2026-01-03")], "2026-01-10")).toMatchObject({
      status: "rust",
      restDays: 7,
    })
  })
})

describe("days", () => {
  it("opens today in the current year and the same day in another year", () => {
    expect(defaultMapDay("2026-11-17", 2026)).toBe("2026-11-17")
    expect(defaultMapDay("2026-11-17", 2025)).toBe("2025-11-17")
  })

  it("moves 29 February to 28 February outside a leap year", () => {
    expect(defaultMapDay("2028-02-29", 2027)).toBe("2027-02-28")
    expect(defaultMapDay("2028-02-29", 2024)).toBe("2024-02-29")
  })

  it("shifts and clamps days within the year", () => {
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01")
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28")
    expect(clampToYear("2027-01-01", 2026)).toBe("2026-12-31")
    expect(clampToYear("2025-12-31", 2026)).toBe("2026-01-01")
  })

  it("ends a grazing that starts after today on its first day", () => {
    expect(grazingEndDay(grazing("2026-07-01", null), "2026-06-15")).toBe("2026-07-01")
  })
})
