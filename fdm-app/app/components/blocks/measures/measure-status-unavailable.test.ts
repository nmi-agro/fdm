import { describe, expect, it } from "vitest"
import { getMeasureStatusUnavailableMessage } from "./measure-status-unavailable"

const available = {
  recommendationsAvailable: true,
  applicabilityAvailable: true,
  eligibleFieldCount: 4,
  applicabilityFailedFieldCount: 0,
}

describe("getMeasureStatusUnavailableMessage", () => {
  it("returns null when everything could be loaded", () => {
    expect(getMeasureStatusUnavailableMessage(available)).toBeNull()
  })

  it("names the missing recommendations", () => {
    expect(
      getMeasureStatusUnavailableMessage({ ...available, recommendationsAvailable: false }),
    ).toMatch(/^Aanbevolen maatregelen konden niet worden geladen/)
  })

  it("says for how many fields the applicability failed when only some failed", () => {
    expect(
      getMeasureStatusUnavailableMessage({
        ...available,
        applicabilityAvailable: false,
        applicabilityFailedFieldCount: 1,
      }),
    ).toContain("voor 1 van de 4 percelen")
  })

  it("speaks of the whole farm when the applicability failed for every field", () => {
    expect(
      getMeasureStatusUnavailableMessage({
        ...available,
        recommendationsAvailable: false,
        applicabilityAvailable: false,
        applicabilityFailedFieldCount: 4,
      }),
    ).toContain("voor dit bedrijf")
  })
})
