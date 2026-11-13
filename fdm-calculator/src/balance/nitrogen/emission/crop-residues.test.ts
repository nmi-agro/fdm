import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type { CultivationDetail, FieldInput } from "../types"
import { calculateNitrogenInCropResiduesLeft } from "./crop-residues"

describe("calculateNitrogenInCropResiduesLeft", () => {
  const cultivation: FieldInput["cultivations"][number] = {
    b_lu: "wheat",
    b_lu_catalogue: "nl_233",
    b_lu_start: new Date("2025-01-01"),
    b_lu_end: new Date("2025-08-15"),
    m_cropresidue: true,
    b_lu_name: "Wintertarwe",
    b_lu_croprotation: "cereal",
  }
  const cultivationDetail: CultivationDetail = {
    b_lu_catalogue: "nl_233",
    b_lu_croprotation: "cereal",
    b_lu_yield: 7000,
    b_lu_hi: 0.5,
    b_lu_n_harvestable: 20,
    b_lu_n_residue: 5,
    b_n_fixation: 0,
  }
  const harvest = (b_lu_yield: number | null): FieldInput["harvests"][number] =>
    ({
      b_id_harvesting: "harvest1",
      b_lu: "wheat",
      b_lu_harvest_date: new Date("2025-08-01"),
      harvestable: {
        b_id_harvestable: "harvestable1",
        harvestable_analyses: [{ b_lu_yield, b_lu_n_harvestable: 20 }],
      },
    }) as unknown as FieldInput["harvests"][number]

  it("uses the yield of the harvest", () => {
    // 9000 / 0.5 * 0.5 * 5 / 1000 = 45
    const result = calculateNitrogenInCropResiduesLeft(
      cultivation,
      [harvest(9000)],
      cultivationDetail,
    )
    expect(result.toNumber()).toBeCloseTo(45, 8)
  })

  it("uses the catalogue yield when the harvest has no yield", () => {
    // 7000 / 0.5 * 0.5 * 5 / 1000 = 35
    const result = calculateNitrogenInCropResiduesLeft(
      cultivation,
      [harvest(null)],
      cultivationDetail,
    )
    expect(result.toNumber()).toBeCloseTo(35, 8)
  })

  it("returns zero when residues are not left on the field or when this is unknown", () => {
    for (const m_cropresidue of [false, null]) {
      const result = calculateNitrogenInCropResiduesLeft(
        { ...cultivation, m_cropresidue },
        [],
        cultivationDetail,
      )
      expect(result.equals(new Decimal(0))).toBe(true)
    }
  })
})
