import type { Harvest } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import type { PhosphateBalanceInput } from "./types"
import {
  calculatePhosphateBalance,
  calculatePhosphateBalanceField,
  determinePhosphateFrame,
} from "./field"

const harvest = (b_lu: string, b_lu_yield: number | null, b_lu_p_harvestable: number | null) =>
  ({
    b_id_harvesting: `h-${b_lu}`,
    b_lu,
    b_lu_harvest_date: new Date("2025-08-01"),
    harvestable: {
      b_id_harvestable: "hb",
      harvestable_analyses: [{ b_lu_yield, b_lu_p_harvestable }],
    },
  }) as unknown as Harvest

const input: PhosphateBalanceInput = {
  timeFrame: { start: new Date("2025-01-01"), end: new Date("2025-12-31") },
  fertilizerDetails: [
    { p_id_catalogue: "manure", p_p_rt: 1.4, p_type: "manure" },
    { p_id_catalogue: "tsp", p_p_rt: 450, p_type: "mineral" },
  ],
  cultivationDetails: [
    {
      b_lu_catalogue: "nl_2014",
      b_lu_croprotation: "potato",
      b_lu_yield: 12000,
      b_lu_hi: 0.8,
      b_lu_p_harvestable: 4,
      b_lu_p_residue: 2,
    },
  ],
  fields: [
    {
      field: { b_id: "f1", b_area: 10, b_bufferstrip: false },
      cultivations: [
        {
          b_lu: "c1",
          b_lu_catalogue: "nl_2014",
          b_lu_croprotation: "potato",
          m_cropresidue: false,
          b_lu_start: new Date("2025-04-01"),
          b_lu_end: new Date("2025-09-01"),
        },
      ],
      harvests: [harvest("c1", 10000, null)],
      soilAnalyses: [{ a_p_ox: 12, a_fe_ox: 29, a_al_ox: 36, b_soiltype_agr: "dekzand" }],
      fertilizerApplications: [
        { p_app_id: "a1", p_id_catalogue: "manure", p_app_amount: 30000 },
        { p_app_id: "a2", p_id_catalogue: "tsp", p_app_amount: 50 },
      ] as PhosphateBalanceInput["fields"][number]["fertilizerApplications"],
    },
    {
      field: { b_id: "strip", b_area: 1, b_bufferstrip: true },
      cultivations: [],
      harvests: [],
      soilAnalyses: [],
      fertilizerApplications: [],
    },
  ],
}

describe("calculatePhosphateBalanceField", () => {
  it("should calculate supply, removal and balance in kg P2O5 / ha", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: input.fields[0],
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    // 30 t manure × 1.4 + 50 kg TSP × 450 / 1000 = 42 + 22.5
    expect(result.supply.fertilizers.manure).toBeCloseTo(42)
    expect(result.supply.fertilizers.mineral).toBeCloseTo(22.5)
    // harvest: 10 000 kg DM × 4 g / kg (catalogue fallback) = 40
    expect(result.removal.harvests.total).toBeCloseTo(-40)
    // residues removed: 10 000 / 0.8 × 0.2 × 2 g / kg = 5
    expect(result.removal.residues.total).toBeCloseTo(-5)
    expect(result.balance).toBeCloseTo(64.5 - 45)
    expect(result.saturation.source).toBe("oxalate")
    expect(result.projection?.depth.source).toBe("default_arable")
    // Balance 19.5 (per 364 days, scaled to a year) minus fixation 20: slightly negative
    expect(result.projection?.balance_effective_per_year).toBeCloseTo((19.5 * 365.25) / 364 - 20)
  })

  it("should use the phosphate content of the harvest analysis when present", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: { ...input.fields[0], harvests: [harvest("c1", 10000, 6)] },
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    expect(result.removal.harvests.total).toBeCloseTo(-60)
  })

  it("should return zeros for a buffer strip", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: input.fields[1],
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    expect(result.balance).toBe(0)
    expect(result.projection).toBeNull()
  })
})

describe("determinePhosphateFrame", () => {
  it("should follow the P-AL bands of the issue", () => {
    expect(determinePhosphateFrame(20, 20)).toEqual({
      name: "opbouwen",
      a_p_al: 20,
      target_balance_min: 20,
    })
    expect(determinePhosphateFrame(30, 20).name).toBe("onderhouden")
    expect(determinePhosphateFrame(50, 20)).toEqual({
      name: "afbouwen",
      a_p_al: 50,
      target_balance_min: null,
    })
    expect(determinePhosphateFrame(null, 20).name).toBeNull()
  })
})

describe("calculatePhosphateBalance", () => {
  it("should average the fields per ha and exclude buffer strips", () => {
    const result = calculatePhosphateBalance(input)
    expect(result.fields).toHaveLength(2)
    expect(result.balance).toBeCloseTo(19.5)
  })
})
