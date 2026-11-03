import { describe, expect, it } from "vitest"
import { getFarmIdsOfFarmGroupInYear, isFarmGroupMembershipInYear } from "./farm-group"

const period = (joined: string, leaved: string | null) => ({
  b_group_joined: new Date(joined),
  b_group_leaved: leaved ? new Date(leaved) : null,
})

describe("isFarmGroupMembershipInYear", () => {
  it("includes a period that overlaps the year", () => {
    expect(isFarmGroupMembershipInYear(period("2024-06-01", null), 2025)).toBe(true)
    expect(isFarmGroupMembershipInYear(period("2025-12-31", null), 2025)).toBe(true)
    expect(isFarmGroupMembershipInYear(period("2024-01-01", "2025-01-02"), 2025)).toBe(true)
  })

  it("excludes a period that ends on 1 January or starts after the year", () => {
    expect(isFarmGroupMembershipInYear(period("2024-01-01", "2025-01-01"), 2025)).toBe(false)
    expect(isFarmGroupMembershipInYear(period("2026-01-01", null), 2025)).toBe(false)
  })

  it("includes every period without a year", () => {
    expect(isFarmGroupMembershipInYear(period("2030-01-01", null), undefined)).toBe(true)
  })
})

describe("getFarmIdsOfFarmGroupInYear", () => {
  it("returns each farm in the year once", () => {
    const group = {
      memberships: [
        { b_id_farm: "a", ...period("2020-01-01", "2022-01-01") },
        { b_id_farm: "b", ...period("2024-01-01", null) },
        { b_id_farm: "b", ...period("2025-03-01", null) },
        { b_id_farm: "a", ...period("2025-06-01", null) },
      ],
    }
    expect(getFarmIdsOfFarmGroupInYear(group, 2025)).toEqual(["b", "a"])
    expect(getFarmIdsOfFarmGroupInYear(group, 2021)).toEqual(["a"])
  })
})
