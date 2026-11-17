import { describe, expect, it } from "vitest"
import { findActiveCultivationForDate } from "./cultivation-for-date"

const openEnd = new Date(8_640_000_000_000_000)

const grass = { b_lu: "grass", b_lu_start: new Date("2020-03-01"), b_lu_end: null }
const catchCrop = {
  b_lu: "catch",
  b_lu_start: new Date("2026-09-01"),
  b_lu_end: new Date("2026-12-31"),
}

describe("findActiveCultivationForDate", () => {
  it("finds the cultivation that covers the date", () => {
    expect(findActiveCultivationForDate([grass], new Date("2026-06-15"), openEnd)?.b_lu).toBe(
      "grass",
    )
  })

  it("prefers the cultivation with the narrowest span", () => {
    expect(
      findActiveCultivationForDate([grass, catchCrop], new Date("2026-10-01"), openEnd)?.b_lu,
    ).toBe("catch")
  })

  it("returns undefined before any cultivation starts", () => {
    expect(findActiveCultivationForDate([grass], new Date("2019-06-15"), openEnd)).toBeUndefined()
  })
})
