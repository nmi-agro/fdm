import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type { CultivationDetail, FieldInput } from "../../types"
import { calculateNitrogenEmissionViaNitrousOxideByResidues } from "./residues"

const cultivationDetailsMap = new Map<string, CultivationDetail>([
  [
    "nl_233",
    {
      b_lu_catalogue: "nl_233",
      b_lu_croprotation: "cereal",
      // Yield and harvest index chosen so that 35 kg N is left in the crop residues:
      // 7000 / 0.5 * (1 - 0.5) * 5 / 1000 = 35
      b_lu_yield: 7000,
      b_lu_hi: 0.5,
      b_lu_n_harvestable: 0,
      b_lu_n_residue: 5,
      b_n_fixation: 0,
    },
  ],
])

const wheat: FieldInput["cultivations"][number] = {
  b_lu: "wheat",
  b_lu_catalogue: "nl_233",
  b_lu_start: new Date("2025-01-01"),
  b_lu_end: new Date("2025-08-15"),
  m_cropresidue: true,
  b_lu_name: "Wintertarwe",
  b_lu_croprotation: "cereal",
}

describe("calculateNitrogenEmissionViaNitrousOxideByResidues", () => {
  it("calculates the emission from the nitrogen in the crop residues left on the field", () => {
    const result = calculateNitrogenEmissionViaNitrousOxideByResidues(
      [wheat],
      [],
      cultivationDetailsMap,
    )
    expect(result.total.toNumber()).toBeCloseTo(-0.35, 3) // 35 kg N × 0.01
    expect(result.cultivations).toEqual([{ id: "wheat", value: expect.any(Decimal) }])
  })

  it("counts no crop residues when they are removed or when this is unknown", () => {
    for (const m_cropresidue of [false, null]) {
      const result = calculateNitrogenEmissionViaNitrousOxideByResidues(
        [{ ...wheat, m_cropresidue }],
        [],
        cultivationDetailsMap,
      )
      expect(result.total.isZero()).toBe(true)
      expect(result.cultivations).toEqual([{ id: "wheat", value: new Decimal(0) }])
    }
  })

  it("returns zero without cultivations", () => {
    const result = calculateNitrogenEmissionViaNitrousOxideByResidues([], [], cultivationDetailsMap)
    expect(result.total.isZero()).toBe(true)
    expect(result.cultivations).toEqual([])
  })

  it("throws when the cultivation details are missing", () => {
    expect(() =>
      calculateNitrogenEmissionViaNitrousOxideByResidues(
        [{ ...wheat, b_lu_catalogue: "unknown" }],
        [],
        cultivationDetailsMap,
      ),
    ).toThrowError("has no corresponding cultivation in cultivationDetails")
  })
})
