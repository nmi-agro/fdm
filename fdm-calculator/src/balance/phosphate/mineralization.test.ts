import { describe, expect, it } from "vitest"
import type { PhosphateCultivationDetail, PhosphateFieldInput } from "./types"
import {
  calculatePhosphateDeposition,
  calculatePhosphateMineralization,
  getPeatGroundwaterFactor,
} from "./mineralization"

const year = { start: new Date("2025-01-01"), end: new Date("2025-12-31") }

const grass: PhosphateCultivationDetail = {
  b_lu_catalogue: "nl_265",
  b_lu_croprotation: "grass",
  b_lu_yield: 10000,
  b_lu_hi: 1,
  b_lu_harvestable: "multiple",
  b_lu_p_harvestable: 6,
  b_lu_p_residue: null,
}

const fieldInput = (soilAnalyses: PhosphateFieldInput["soilAnalyses"]): PhosphateFieldInput => ({
  field: { b_id: "f1", b_area: 1, b_bufferstrip: false },
  cultivations: [
    {
      b_lu: "c1",
      b_lu_catalogue: "nl_265",
      b_lu_name: "Grasland, blijvend",
      b_lu_croprotation: "grass",
      m_cropresidue: null,
      b_lu_start: new Date("2020-01-01"),
      b_lu_end: null,
    },
  ],
  harvests: [],
  soilAnalyses,
  fertilizerApplications: [],
})

const details = new Map([[grass.b_lu_catalogue, grass]])

describe("calculatePhosphateMineralization", () => {
  it("should use the organic matter degradation on mineral soils", () => {
    // 8% OM grassland, 1.2 g/cm³: ~1460 kg OM/ha/year × 0.0046 × 0.65 ≈ 4.4 kg P2O5/ha
    const result = calculatePhosphateMineralization(
      fieldInput([{ b_soiltype_agr: "dekzand", a_som_loi: 8, a_density_sa: 1.2 }]),
      details,
      true,
      year,
    )
    expect(result.track).toBe("mineral")
    expect(result.total).toBeGreaterThan(3.5)
    expect(result.total).toBeLessThan(5.5)
    expect(result.warnings).toEqual([])
  })

  it("should use the groundwater-driven track on peat, not the organic matter degradation", () => {
    // 12 t × 1.0 (Gt V) × 0.774 × 1.7 kg P/t × 0.65 = 10.3 kg P = 23.5 kg P2O5
    const result = calculatePhosphateMineralization(
      fieldInput([{ b_soiltype_agr: "veen", a_som_loi: 70, a_density_sa: 0.3, b_gwl_class: "V" }]),
      details,
      true,
      year,
    )
    expect(result.track).toBe("peat")
    expect(result.total).toBeCloseTo(23.5, 0)
  })

  it("should use Gt V with a note when the groundwater class of peat is unknown", () => {
    const unknown = calculatePhosphateMineralization(
      fieldInput([{ b_soiltype_agr: "veen", a_som_loi: 70 }]),
      details,
      true,
      year,
    )
    const reference = calculatePhosphateMineralization(
      fieldInput([{ b_soiltype_agr: "veen", a_som_loi: 70, b_gwl_class: "V" }]),
      details,
      true,
      year,
    )
    expect(unknown.total).toBeCloseTo(reference.total)
    expect(unknown.warnings.join(" ")).toMatch(/Grondwatertrap onbekend/)
  })

  it("should give less mineralisation on wet peat", () => {
    const wet = calculatePhosphateMineralization(
      fieldInput([{ b_soiltype_agr: "veen", b_gwl_class: "IIb" }]),
      details,
      true,
      year,
    )
    const dry = calculatePhosphateMineralization(
      fieldInput([{ b_soiltype_agr: "veen", b_gwl_class: "VII" }]),
      details,
      true,
      year,
    )
    expect(wet.total).toBeLessThan(dry.total)
  })

  it("should flag a changed groundwater class on peat (Fe-P release on rewetting)", () => {
    const result = calculatePhosphateMineralization(
      fieldInput([
        { b_soiltype_agr: "veen", b_gwl_class: "III", b_sampling_date: new Date("2025-01-01") },
        { b_soiltype_agr: "veen", b_gwl_class: "V", b_sampling_date: new Date("2020-01-01") },
      ]),
      details,
      true,
      year,
    )
    expect(result.warnings[0]).toMatch(/vernatting/)
  })

  it("should return 0 with a note when the organic matter content is missing", () => {
    const result = calculatePhosphateMineralization(
      fieldInput([{ b_soiltype_agr: "zeeklei" }]),
      details,
      false,
      year,
    )
    expect(result).toEqual({
      total: 0,
      track: "none",
      warnings: ["Geen organische-stofgehalte bekend: de mineralisatie is op 0 gezet."],
    })
  })
})

describe("getPeatGroundwaterFactor", () => {
  it("should match groundwater classes on their Roman numeral", () => {
    expect(getPeatGroundwaterFactor("IIIb")).toBe(0.75)
    expect(getPeatGroundwaterFactor("sVb")).toBe(1)
    expect(getPeatGroundwaterFactor("VIIId")).toBe(1.4)
    expect(getPeatGroundwaterFactor(null)).toBeNull()
  })
})

describe("calculatePhosphateDeposition", () => {
  it("should be 0.7 kg P2O5 per ha per year", () => {
    expect(calculatePhosphateDeposition(year).total).toBeCloseTo(0.7)
  })
})
