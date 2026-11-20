import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { claimFarmWarmup, FARM_WARMUP_INTERVAL_MS, releaseFarmWarmup } from "./use-farm-warmup"

const KEY = "fdm-farm-warmup:farm-1:2026"

describe("claimFarmWarmup", () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    })
  })

  it("claims again after a failed warm-up released its claim", () => {
    claimFarmWarmup(KEY, 1_000)
    releaseFarmWarmup(KEY, 1_000)
    expect(claimFarmWarmup(KEY, 2_000)).toBe(true)
  })

  it("keeps a later claim when an earlier warm-up fails", () => {
    claimFarmWarmup(KEY, 1_000)
    const later = 1_000 + FARM_WARMUP_INTERVAL_MS
    claimFarmWarmup(KEY, later)
    releaseFarmWarmup(KEY, 1_000)
    expect(store.get(KEY)).toBe(String(later))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("claims a farm and year that were not warmed yet, and records the moment", () => {
    expect(claimFarmWarmup(KEY, 1_000)).toBe(true)
    expect(store.get(KEY)).toBe("1000")
  })

  it("skips a farm and year that were warmed recently", () => {
    claimFarmWarmup(KEY, 1_000)
    expect(claimFarmWarmup(KEY, 1_000 + FARM_WARMUP_INTERVAL_MS - 1)).toBe(false)
    expect(store.get(KEY)).toBe("1000")
  })

  it("claims again once the interval has passed", () => {
    claimFarmWarmup(KEY, 1_000)
    expect(claimFarmWarmup(KEY, 1_000 + FARM_WARMUP_INTERVAL_MS)).toBe(true)
  })

  it("claims again when the stored moment is in the future or not a number", () => {
    store.set(KEY, String(10_000))
    expect(claimFarmWarmup(KEY, 1_000)).toBe(true)
    store.set(KEY, "not a number")
    expect(claimFarmWarmup(KEY, 1_000)).toBe(true)
  })

  it("claims when the storage is not available", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError")
        },
      },
    })
    expect(claimFarmWarmup(KEY, 1_000)).toBe(true)
  })
})
