import { describe, expect, it } from "vitest"
import { getEffectiveHarvestable } from "./harvest"

describe("getEffectiveHarvestable", () => {
  it("allows multiple harvests for grassland only", () => {
    expect(getEffectiveHarvestable("multiple", "grass")).toBe("multiple")
    expect(getEffectiveHarvestable("multiple", "cereal")).toBe("once")
    expect(getEffectiveHarvestable("once", "grass")).toBe("once")
  })

  it("keeps crops that are not harvested", () => {
    expect(getEffectiveHarvestable("none", "grass")).toBe("none")
  })
})
