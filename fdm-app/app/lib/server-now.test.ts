import { afterEach, describe, expect, it, vi } from "vitest"
import { farmTodayKey } from "./grazing-dates"
import { serverNow } from "./server-now.server"

describe("serverNow", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is the real moment without FDM_FIXED_TODAY", () => {
    vi.stubEnv("FDM_FIXED_TODAY", "")
    const before = Date.now()
    const now = serverNow().getTime()
    expect(now).toBeGreaterThanOrEqual(before)
    expect(now).toBeLessThanOrEqual(Date.now())
  })

  it("is on the fixed day in the Netherlands", () => {
    vi.stubEnv("FDM_FIXED_TODAY", "2026-06-15")
    expect(farmTodayKey(serverNow())).toBe("2026-06-15")
    vi.stubEnv("FDM_FIXED_TODAY", "2026-01-15")
    expect(farmTodayKey(serverNow())).toBe("2026-01-15")
  })

  it("ignores a value that is not a date", () => {
    vi.stubEnv("FDM_FIXED_TODAY", "15-06-2026")
    expect(Math.abs(serverNow().getTime() - Date.now())).toBeLessThan(1000)
  })
})
