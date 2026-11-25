import { describe, expect, it } from "vitest"
import { GRAZING_SYSTEMS, SWARD_HEIGHT_CM } from "./constants"

describe("GRAZING_SYSTEMS", () => {
  it("gives every system with grazing a period of at least one day and grazing hours", () => {
    for (const system of Object.values(GRAZING_SYSTEMS)) {
      if (!system.requiresGrazingRecords) continue
      expect(system.defaultPeriodDays).toBeGreaterThanOrEqual(1)
      expect(system.defaultHoursPerDay).toBeGreaterThan(0)
      expect(system.grazingType).not.toBeNull()
    }
  })

  it("plans Nieuw Nederlands Weiden as a new whole field every day", () => {
    expect(GRAZING_SYSTEMS.nieuw_nederlands_weiden).toMatchObject({
      defaultPeriodDays: 1,
      grazingType: "full",
      requiresGrazingRecords: true,
    })
    // The sward heights of the system are known as well
    expect(SWARD_HEIGHT_CM.nieuw_nederlands_weiden.inscharen).toEqual([10, 12])
  })
})
