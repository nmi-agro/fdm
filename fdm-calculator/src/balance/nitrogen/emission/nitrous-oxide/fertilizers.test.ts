import { describe, expect, it } from "vitest"
import type { CultivationDetail, FertilizerDetail, FieldInput } from "../../types"
import {
  calculateNitrogenEmissionViaNitrousOxideByFertilizers,
  determineNitrousOxideEmissionFactor,
} from "./fertilizers"

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

describe("calculateNitrogenEmissionViaNitrousOxideByFertilizers", () => {
  it("calculates the emission by type of fertilizer and per application", () => {
    // 30 t cattle slurry (123 kg N), injected, and 100 kg N calcium ammonium nitrate
    const result = calculateNitrogenEmissionViaNitrousOxideByFertilizers(
      wheat,
      [
        application("slurry", 30000, "injection"),
        application("can", 370.37037037037, "broadcasting", new Date("2025-04-01")),
      ],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "dekzand" },
    )
    expect(result.manure.total.toNumber()).toBeCloseTo(-1.599, 3) // 123 × 0.013
    expect(result.manure.applications).toHaveLength(1)
    expect(result.mineral.total.toNumber()).toBeCloseTo(-0.7, 3) // 100 × 0.007
    expect(result.total.toNumber()).toBeCloseTo(-2.299, 3)
  })

  it("uses the peat factors on peat", () => {
    const result = calculateNitrogenEmissionViaNitrousOxideByFertilizers(
      grassland,
      [application("can", 370.37037037037, "broadcasting")],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "veen" },
    )
    expect(result.mineral.total.toNumber()).toBeCloseTo(-3, 3) // 100 × 0.03
  })

  it("uses the mineral factors on peaty soil", () => {
    const result = calculateNitrogenEmissionViaNitrousOxideByFertilizers(
      grassland,
      [application("can", 370.37037037037, "broadcasting")],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "moerige_klei" },
    )
    expect(result.mineral.total.toNumber()).toBeCloseTo(-0.8, 3) // 100 × 0.008
  })

  it("puts sewage sludge without fertilizer type in the group other", () => {
    const result = calculateNitrogenEmissionViaNitrousOxideByFertilizers(
      wheat,
      [application("sludge", 10000, "incorporation")],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "dekzand" },
    )
    expect(result.other.total.toNumber()).toBeCloseTo(-0.9, 3) // 100 kg N × 0.009
    expect(result.other.applications).toHaveLength(1)
  })

  it("returns zero without fertilizer applications", () => {
    const result = calculateNitrogenEmissionViaNitrousOxideByFertilizers(
      wheat,
      [],
      cultivationDetailsMap,
      fertilizerDetailsMap,
      { b_soiltype_agr: "dekzand" },
    )
    expect(result.total.isZero()).toBe(true)
    expect(result.mineral.applications).toEqual([])
  })

  it("throws when the fertilizer details are missing", () => {
    expect(() =>
      calculateNitrogenEmissionViaNitrousOxideByFertilizers(
        wheat,
        [application("unknown", 100, "broadcasting")],
        cultivationDetailsMap,
        fertilizerDetailsMap,
        { b_soiltype_agr: "dekzand" },
      ),
    ).toThrowError("has no fertilizerDetails")
  })
})
