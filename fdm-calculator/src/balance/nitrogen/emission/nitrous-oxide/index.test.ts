import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type { CultivationDetail, FertilizerDetail, FieldInput } from "../../types"
import { calculateNitrogenEmissionViaNitrousOxide, createEmptyNitrousOxideEmission } from "."
import { convertNitrousOxideToCo2Equivalent } from "./conversion"

const oneYear = { start: new Date("2025-01-01"), end: new Date("2025-12-31") }

const cultivationDetailsMap = new Map<string, CultivationDetail>([
  [
    "nl_265",
    {
      b_lu_catalogue: "nl_265",
      b_lu_croprotation: "grass",
      b_lu_yield: 0,
      b_lu_hi: 0,
      b_lu_n_harvestable: 0,
      b_lu_n_residue: 0,
      b_n_fixation: 0,
    },
  ],
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

const fertilizerDetailsMap = new Map<string, FertilizerDetail>([
  [
    "slurry",
    {
      p_id_catalogue: "slurry",
      p_type: "manure",
      p_n_rt: 4.1,
      p_no3_rt: 0,
      p_nh4_rt: 1.9,
      p_s_rt: 0,
      p_ef_nh3: null,
    },
  ],
  [
    "can",
    {
      p_id_catalogue: "can",
      p_type: "mineral",
      p_n_rt: 270,
      p_no3_rt: 135,
      p_nh4_rt: 135,
      p_s_rt: 0,
      p_ef_nh3: null,
    },
  ],
])

const grassland: FieldInput["cultivations"] = [
  {
    b_lu: "grass",
    b_lu_catalogue: "nl_265",
    b_lu_start: new Date("2025-01-01"),
    b_lu_end: new Date("2025-12-31"),
    m_cropresidue: null,
    b_lu_name: "Grasland",
    b_lu_croprotation: "grass",
  },
]

const wheat: FieldInput["cultivations"] = [
  {
    b_lu: "wheat",
    b_lu_catalogue: "nl_233",
    b_lu_start: new Date("2025-01-01"),
    b_lu_end: new Date("2025-08-15"),
    m_cropresidue: true,
    b_lu_name: "Wintertarwe",
    b_lu_croprotation: "cereal",
  },
]

function application(
  p_id_catalogue: string,
  p_app_amount: number,
  p_app_method: FieldInput["fertilizerApplications"][number]["p_app_method"],
  p_app_date = new Date("2025-03-15"),
): FieldInput["fertilizerApplications"][number] {
  return {
    p_app_id: `app-${p_id_catalogue}`,
    p_id_catalogue,
    p_app_amount,
    p_app_date,
    p_app_method,
    p_name_nl: p_id_catalogue,
    p_id: p_id_catalogue,
  }
}

describe("calculateNitrogenEmissionViaNitrousOxide", () => {
  it("calculates the reference case: slurry and CAN on wheat on mineral soil", () => {
    // 30 t cattle slurry (123 kg N), injected, and 100 kg N calcium ammonium nitrate
    const result = calculateNitrogenEmissionViaNitrousOxide(
      wheat,
      [],
      [
        application("slurry", 30000, "injection"),
        application("can", 370.37037037037, "broadcasting", new Date("2025-04-01")),
      ],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "dekzand" },
      oneYear,
    )

    expect(result.fertilizers.total.toNumber()).toBeCloseTo(-2.299, 3) // 123 × 0.013 + 100 × 0.007
    expect(result.residues.total.toNumber()).toBeCloseTo(-0.35, 3) // 35 kg N × 0.01
    expect(result.soil.total.isZero()).toBe(true)
    expect(result.total.toNumber()).toBeCloseTo(-2.649, 3)
    expect(result.co2eq.toNumber()).toBeCloseTo(2.649 * (44 / 28) * 265, 1)
    expect(result.co2eq.gt(0)).toBe(true)
  })

  it("adds the soil emission of peat", () => {
    const result = calculateNitrogenEmissionViaNitrousOxide(
      grassland,
      [],
      [application("can", 370.37037037037, "broadcasting")],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "veen" },
      oneYear,
    )
    expect(result.fertilizers.total.toNumber()).toBeCloseTo(-3, 3) // 100 × 0.03
    expect(result.soil.total.toNumber()).toBeCloseTo(-4.67, 3)
    expect(result.total.toNumber()).toBeCloseTo(-7.67, 3)
  })

  it("returns zero without fertilizers, residues and organic soil", () => {
    const result = calculateNitrogenEmissionViaNitrousOxide(
      grassland,
      [],
      [],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "dekzand" },
      oneYear,
    )
    expect(result.total.isZero()).toBe(true)
    expect(result.co2eq.isZero()).toBe(true)
  })
})

describe("createEmptyNitrousOxideEmission", () => {
  it("returns an emission of zero", () => {
    const result = createEmptyNitrousOxideEmission()
    expect(result.total.isZero()).toBe(true)
    expect(result.fertilizers.mineral.applications).toEqual([])
    expect(result.co2eq.isZero()).toBe(true)
  })
})

describe("convertNitrousOxideToCo2Equivalent", () => {
  it("converts kg N2O-N to kg CO2-eq with GWP 265, as a positive value", () => {
    expect(convertNitrousOxideToCo2Equivalent(new Decimal(-1)).toNumber()).toBeCloseTo(
      (44 / 28) * 265,
      8,
    )
    expect(convertNitrousOxideToCo2Equivalent(new Decimal(0)).isZero()).toBe(true)
  })
})
