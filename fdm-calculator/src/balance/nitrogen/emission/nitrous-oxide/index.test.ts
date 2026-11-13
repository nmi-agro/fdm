import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type {
  CultivationDetail,
  FertilizerDetail,
  FieldInput,
  NitrogenEmissionNitrousOxideNumeric,
} from "../../types"
import {
  calculateNitrogenEmissionViaNitrousOxide,
  calculateNitrousOxideEmissionFarm,
  calculateNitrousOxideEmissionOrganicSoil,
  convertNitrousOxideToCo2Equivalent,
  determineNitrousOxideEmissionFactor,
} from "."

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
  [
    "compost",
    {
      p_id_catalogue: "compost",
      p_type: "compost",
      p_n_rt: 7.8,
      p_no3_rt: 0,
      p_nh4_rt: 0.8,
      p_s_rt: 0,
      p_ef_nh3: null,
    },
  ],
  [
    "sludge",
    {
      p_id_catalogue: "sludge",
      p_type: null,
      p_type_rvo: "114",
      p_n_rt: 10,
      p_no3_rt: 0,
      p_nh4_rt: 1,
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

describe("determineNitrousOxideEmissionFactor", () => {
  const cases: [string, FieldInput["cultivations"], boolean, string, number][] = [
    // manure: method × crop rotation group × soil (NEMA WOT-283, table 2.7)
    ["broadcasting", grassland, true, "slurry", 0.005],
    ["broadcasting", grassland, false, "slurry", 0.001],
    ["broadcasting", wheat, true, "slurry", 0.005],
    ["broadcasting", wheat, false, "slurry", 0.006],
    ["spraying", wheat, false, "slurry", 0.006],
    ["injection", grassland, true, "slurry", 0.01],
    ["slotted coulter", grassland, false, "slurry", 0.003],
    ["shallow injection", wheat, true, "slurry", 0.01],
    ["incorporation", wheat, false, "slurry", 0.013],
    ["narrowband", wheat, false, "slurry", 0.013],
    // mineral fertilizer: crop rotation group × soil, any method (NEMA WOT-283, table 3.2)
    ["broadcasting", grassland, true, "can", 0.03],
    ["broadcasting", grassland, false, "can", 0.008],
    ["injection", wheat, true, "can", 0.03],
    ["broadcasting", wheat, false, "can", 0.007],
    // other organic fertilizers (NEMA WOT-283, table 3.3)
    ["broadcasting", wheat, false, "compost", 0.004],
    ["broadcasting", grassland, true, "sludge", 0.009],
  ]

  it.each(cases)(
    "uses the NEMA factor for application method %s (case %#)",
    (method, cultivations, isPeat, fertilizer, expected) => {
      const fertilizerDetail = fertilizerDetailsMap.get(fertilizer) as FertilizerDetail
      const factor = determineNitrousOxideEmissionFactor(
        application(fertilizer, 1000, method as never),
        fertilizerDetail,
        cultivations,
        cultivationDetailsMap,
        isPeat,
      )
      expect(factor.toNumber()).toBe(expected)
    },
  )

  it("treats bare soil as cropland", () => {
    const fertilizerDetail = fertilizerDetailsMap.get("can") as FertilizerDetail
    const factor = determineNitrousOxideEmissionFactor(
      application("can", 100, "broadcasting", new Date("2025-10-01")),
      fertilizerDetail,
      wheat, // ended on 2025-08-15
      cultivationDetailsMap,
      false,
    )
    expect(factor.toNumber()).toBe(0.007)
  })

  it("throws for manure without application method, as in the ammonia emission", () => {
    const fertilizerDetail = fertilizerDetailsMap.get("slurry") as FertilizerDetail
    expect(() =>
      determineNitrousOxideEmissionFactor(
        application("slurry", 1000, null as never),
        fertilizerDetail,
        wheat,
        cultivationDetailsMap,
        false,
      ),
    ).toThrowError("Unsupported application method null for slurry (slurry)")
  })

  it("does not need an application method for mineral fertilizers and compost", () => {
    for (const fertilizer of ["can", "compost"]) {
      const fertilizerDetail = fertilizerDetailsMap.get(fertilizer) as FertilizerDetail
      expect(() =>
        determineNitrousOxideEmissionFactor(
          application(fertilizer, 100, null as never),
          fertilizerDetail,
          wheat,
          cultivationDetailsMap,
          false,
        ),
      ).not.toThrow()
    }
  })
})

describe("calculateNitrousOxideEmissionOrganicSoil", () => {
  it("returns the yearly emission for peat and peaty soil", () => {
    expect(calculateNitrousOxideEmissionOrganicSoil("veen", oneYear).toNumber()).toBeCloseTo(
      4.67,
      5,
    )
    expect(
      calculateNitrousOxideEmissionOrganicSoil("moerige_klei", oneYear).toNumber(),
    ).toBeCloseTo(4.09, 5)
  })

  it("returns zero for mineral soils and unknown soil types", () => {
    expect(calculateNitrousOxideEmissionOrganicSoil("dekzand", oneYear).isZero()).toBe(true)
    expect(calculateNitrousOxideEmissionOrganicSoil("rivierklei", oneYear).isZero()).toBe(true)
    expect(calculateNitrousOxideEmissionOrganicSoil(null as never, oneYear).isZero()).toBe(true)
  })

  it("scales the yearly emission to the length of the time frame", () => {
    const halfYear = { start: new Date("2025-01-01"), end: new Date("2025-07-01") }
    expect(calculateNitrousOxideEmissionOrganicSoil("veen", halfYear).toNumber()).toBeCloseTo(
      (4.67 * 182) / 365,
      5,
    )
    const threeYears = { start: new Date("2023-01-01"), end: new Date("2025-12-31") }
    expect(calculateNitrousOxideEmissionOrganicSoil("veen", threeYears).toNumber()).toBeCloseTo(
      (4.67 * 1096) / 365,
      5,
    )
  })

  it("returns zero for an empty time frame", () => {
    const empty = { start: new Date("2025-07-01"), end: new Date("2025-01-01") }
    expect(calculateNitrousOxideEmissionOrganicSoil("veen", empty).isZero()).toBe(true)
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

describe("calculateNitrogenEmissionViaNitrousOxide", () => {
  it("calculates the reference case: slurry and CAN on wheat on mineral soil", () => {
    // 30 t cattle slurry (123 kg N), injected, and 100 kg N calcium ammonium nitrate
    const fertilizerApplications = [
      application("slurry", 30000, "injection"),
      application("can", 370.37037037037, "broadcasting", new Date("2025-04-01")),
    ]

    const result = calculateNitrogenEmissionViaNitrousOxide(
      wheat,
      [],
      fertilizerApplications,
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "dekzand" },
      new Decimal(-3.6), // ammonia
      new Decimal(-40), // nitrate leaching
      oneYear,
    )

    expect(result.fertilizers.manure.total.toNumber()).toBeCloseTo(-1.599, 3) // 123 × 0.013
    expect(result.fertilizers.mineral.total.toNumber()).toBeCloseTo(-0.7, 3) // 100 × 0.007
    expect(result.fertilizers.total.toNumber()).toBeCloseTo(-2.299, 3)
    expect(result.residues.total.toNumber()).toBeCloseTo(-0.35, 3) // 35 kg N × 0.01
    expect(result.residues.cultivations).toEqual([{ id: "wheat", value: expect.any(Decimal) }])
    expect(result.soil.total.isZero()).toBe(true)
    expect(result.indirect.volatilisation.toNumber()).toBeCloseTo(-0.036, 3) // 3.6 × 0.01
    expect(result.indirect.leaching.toNumber()).toBeCloseTo(-0.3, 3) // 40 × 0.0075
    expect(result.total.toNumber()).toBeCloseTo(-2.985, 3)
    expect(result.co2eq.toNumber()).toBeCloseTo(2.985 * (44 / 28) * 265, 1)
    expect(result.co2eq.gt(0)).toBe(true)
  })

  it("adds the soil emission of peat and uses the peat factors", () => {
    const result = calculateNitrogenEmissionViaNitrousOxide(
      grassland,
      [],
      [application("can", 370.37037037037, "broadcasting")],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "veen" },
      new Decimal(0),
      new Decimal(0),
      oneYear,
    )
    expect(result.fertilizers.mineral.total.toNumber()).toBeCloseTo(-3, 3) // 100 × 0.03
    expect(result.soil.total.toNumber()).toBeCloseTo(-4.67, 3)
    expect(result.total.toNumber()).toBeCloseTo(-7.67, 3)
  })

  it("uses the mineral factors for peaty soil, but adds its soil emission", () => {
    const result = calculateNitrogenEmissionViaNitrousOxide(
      grassland,
      [],
      [application("can", 370.37037037037, "broadcasting")],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "moerige_klei" },
      new Decimal(0),
      new Decimal(0),
      oneYear,
    )
    expect(result.fertilizers.mineral.total.toNumber()).toBeCloseTo(-0.8, 3) // 100 × 0.008
    expect(result.soil.total.toNumber()).toBeCloseTo(-4.09, 3)
  })

  it("puts sewage sludge without fertilizer type in the group other", () => {
    const result = calculateNitrogenEmissionViaNitrousOxide(
      wheat,
      [],
      [application("sludge", 10000, "incorporation")],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "dekzand" },
      new Decimal(0),
      new Decimal(0),
      oneYear,
    )
    expect(result.fertilizers.other.total.toNumber()).toBeCloseTo(-0.9, 3) // 100 kg N × 0.009
    expect(result.fertilizers.other.applications).toHaveLength(1)
  })

  it("counts no crop residues when they are removed or when this is unknown", () => {
    for (const m_cropresidue of [false, null]) {
      const result = calculateNitrogenEmissionViaNitrousOxide(
        [{ ...wheat[0], m_cropresidue }],
        [],
        [],
        cultivationDetailsMap,
        fertilizerDetailsMap,
        { b_soiltype_agr: "dekzand" },
        new Decimal(0),
        new Decimal(0),
        oneYear,
      )
      expect(result.residues.total.isZero()).toBe(true)
    }
  })

  it("returns zero without fertilizers, residues, organic soil and losses", () => {
    const result = calculateNitrogenEmissionViaNitrousOxide(
      grassland,
      [],
      [],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "dekzand" },
      new Decimal(0),
      new Decimal(0),
      oneYear,
    )
    expect(result.total.isZero()).toBe(true)
    expect(result.co2eq.isZero()).toBe(true)
    expect(result.residues.cultivations).toEqual([{ id: "grass", value: new Decimal(0) }])
  })

  it("throws when the fertilizer details are missing", () => {
    expect(() =>
      calculateNitrogenEmissionViaNitrousOxide(
        wheat,
        [],
        [application("unknown", 100, "broadcasting")],
        cultivationDetailsMap,
        fertilizerDetailsMap,
        { b_soiltype_agr: "dekzand" },
        new Decimal(0),
        new Decimal(0),
        oneYear,
      ),
    ).toThrowError("has no fertilizerDetails")
  })
})

describe("calculateNitrousOxideEmissionFarm", () => {
  const fieldEmission = (total: number): NitrogenEmissionNitrousOxideNumeric => ({
    total,
    fertilizers: {
      total,
      mineral: { total, applications: [] },
      manure: { total: 0, applications: [] },
      compost: { total: 0, applications: [] },
      other: { total: 0, applications: [] },
    },
    residues: { total: 0, cultivations: [] },
    soil: { total: 0 },
    indirect: { total: 0, volatilisation: 0, leaching: 0 },
    co2eq: Math.abs(total) * (44 / 28) * 265,
  })

  it("calculates the area-weighted average", () => {
    const result = calculateNitrousOxideEmissionFarm([
      { b_area: 10, nitrousOxide: fieldEmission(-1) },
      { b_area: 30, nitrousOxide: fieldEmission(-3) },
    ])
    expect(result.total.toNumber()).toBeCloseTo(-2.5, 5)
    expect(result.fertilizers.mineral.toNumber()).toBeCloseTo(-2.5, 5)
    expect(result.co2eq.toNumber()).toBeCloseTo(2.5 * (44 / 28) * 265, 5)
  })

  it("averages the CO2-equivalents of the fields, so that small emissions still count", () => {
    const small = { ...fieldEmission(0), co2eq: 1.5 } // N2O-N rounded to 0, CO2-eq kept
    const result = calculateNitrousOxideEmissionFarm([
      { b_area: 10, nitrousOxide: small },
      { b_area: 10, nitrousOxide: fieldEmission(0) },
    ])
    expect(result.total.isZero()).toBe(true)
    expect(result.co2eq.toNumber()).toBeCloseTo(0.75, 8)
  })

  it("counts fields without N2O emission as zero and handles no area", () => {
    const result = calculateNitrousOxideEmissionFarm([
      { b_area: 10, nitrousOxide: fieldEmission(-2) },
      { b_area: 10, nitrousOxide: undefined },
    ])
    expect(result.total.toNumber()).toBeCloseTo(-1, 5)
    expect(calculateNitrousOxideEmissionFarm([]).total.isZero()).toBe(true)
  })
})
