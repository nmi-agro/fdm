import type { FdmType, Harvest } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import type { PhosphateBalanceInput } from "./types"
import {
  calculatePhosphateBalance,
  calculatePhosphateBalanceField,
  calculatePhosphateBalanceFieldsToFarm,
  determinePhosphateFrame,
} from "./field"

// Minimal FDM mock: every cache lookup misses and cache writes are ignored
const mockFdm = {
  select: () => mockFdm,
  from: () => mockFdm,
  where: () => mockFdm,
  limit: () => mockFdm,
  execute: async () => [],
  insert: () => mockFdm,
  values: () => mockFdm,
  onConflictDoNothing: async () => undefined,
} as unknown as FdmType

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
      b_lu_harvestable: "once",
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
          b_lu_name: "Aardappelen",
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
    expect(result.supply.fertilizers.manure.total).toBeCloseTo(42)
    expect(result.supply.fertilizers.mineral.total).toBeCloseTo(22.5)
    expect(result.supply.fertilizers.manure.applications.map((a) => a.id)).toEqual(["a1"])
    expect(result.supply.fertilizers.mineral.applications.map((a) => a.id)).toEqual(["a2"])
    // harvest: 10 000 kg DM × 4 g / kg (catalogue fallback) = 40
    expect(result.removal.harvests.total).toBeCloseTo(-40)
    // residues removed: 10 000 / 0.8 × 0.2 × 2 g / kg = 5
    expect(result.removal.residues.total).toBeCloseTo(-5)
    // No organic matter content: no mineralisation; deposition 0.7 for one year
    expect(result.supply.mineralization).toEqual({
      total: 0,
      track: "none",
      warnings: ["Geen organische-stofgehalte bekend: de mineralisatie is op 0 gezet."],
    })
    expect(result.supply.deposition.total).toBeCloseTo(0.7)
    expect(result.supply.total).toBeCloseTo(65.2)
    expect(result.balance).toBeCloseTo(65.2 - 45)
    expect(result.saturation.source).toBe("oxalate")
    expect(result.projection?.depth.source).toBe("default_arable")
    // PSD 12 / 32.5 = 37% > threshold 25% (≤ 2×): fraction 0.03; Gt unknown: factor 0.2 / 0.1 = 2
    expect(result.leaching.risk).toBe("medium")
    expect(result.leaching.factor).toBeCloseTo(0.06)
    expect(result.leaching.total).toBeCloseTo(-20.2 * 0.06)
    // Leaching is not part of the balance, but it is in the projection (minus fixation 20)
    expect(result.projection?.balance_effective_per_year).toBeCloseTo(20.2 * 0.94 - 20)
  })

  it("should average the balance over the years with data, with default yields for missing harvests", () => {
    const pastYear = (year: number, tspAmount: number | null, harvested = false) => ({
      timeFrame: { start: new Date(`${year}-01-01`), end: new Date(`${year}-12-31`) },
      fieldInput: {
        ...input.fields[0],
        cultivations: [
          {
            ...input.fields[0].cultivations[0],
            b_lu: `c${year}`,
            b_lu_start: new Date(`${year}-04-01`),
            b_lu_end: new Date(`${year}-09-01`),
          },
        ],
        harvests: harvested ? [harvest(`c${year}`, 12000, null)] : [],
        fertilizerApplications: (tspAmount
          ? [{ p_app_id: `p${year}`, p_id_catalogue: "tsp", p_app_amount: tspAmount }]
          : []) as PhosphateBalanceInput["fields"][number]["fertilizerApplications"],
      },
    })
    const noCrop = {
      timeFrame: { start: new Date("2022-01-01"), end: new Date("2022-12-31") },
      fieldInput: {
        ...input.fields[0],
        cultivations: [],
        harvests: [],
        fertilizerApplications: [],
      },
    }
    const result = calculatePhosphateBalanceField({
      fieldInput: input.fields[0],
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
      history: [pastYear(2024, 100), pastYear(2023, null, true), pastYear(2021, null), noCrop],
    })
    // 2021 has a crop but no registered fertilisation or harvest: left out
    expect(result.long_term.years).toEqual([2023, 2024, 2025])
    expect(result.long_term.fertilizer_years).toEqual([2024, 2025])
    expect(result.long_term.estimated_removal_years).toEqual([2024])
    // Fertilizers: mean of 2025 (64.5) and 2024 (45, over 366 days)
    const fertilizers = (64.5 + (45 * 365) / 366) / 2
    // Rest: 2025 −45 + 0.7; 2024 default harvest −48, residues −6, deposition 0.7;
    // 2023 registered harvest 12 000 kg × 4 g/kg −48, residues −6, deposition 0.7
    const rest = (-44.3 + (-53.3 * 365) / 366 - 53.3) / 3
    expect(result.long_term.balance).toBeCloseTo(fertilizers + rest, 1)
    expect(result.long_term.warnings[0]).toMatch(
      /Voor 2021 zijn geen bemesting en oogst geregistreerd: deze jaren tellen niet mee/,
    )
    expect(result.long_term.warnings[1]).toMatch(/Voor 2023 is geen bemesting geregistreerd/)
    expect(result.balance).toBeCloseTo(20.2)
    expect(result.projection?.balance_effective_per_year).toBeCloseTo(
      result.long_term.balance + result.long_term.leaching - 20,
    )
  })

  it("should use only this year when no earlier year has registered data", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: {
        ...input.fields[0],
        cultivation_history: [
          { year: 2024, b_lu_catalogue: "nl_2014" },
          { year: 2023, b_lu_catalogue: "nl_2014" },
        ],
      },
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    // The BRP crops of 2023 and 2024 have no registered fertilisation or harvest
    expect(result.long_term.years).toEqual([2025])
    expect(result.long_term.estimated_removal_years).toEqual([])
    expect(result.long_term.balance).toBeCloseTo(result.balance)
    expect(result.long_term.warnings).toEqual([
      "Voor 2023 en 2024 zijn geen bemesting en oogst geregistreerd: de trend gebruikt alleen de balans van 2025. Voeg de bemesting en oogsten van eerdere jaren toe voor een gemiddelde balans over de vruchtwisseling.",
    ])
  })

  it("should use the crop history (BRP) for an earlier year with fertilisation but no registered cultivation", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: {
        ...input.fields[0],
        cultivation_history: [{ year: 2024, b_lu_catalogue: "nl_2014" }],
      },
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
      history: [
        {
          timeFrame: { start: new Date("2024-01-01"), end: new Date("2024-12-31") },
          fieldInput: {
            ...input.fields[0],
            cultivations: [],
            harvests: [],
            fertilizerApplications: [
              { p_app_id: "p2024", p_id_catalogue: "tsp", p_app_amount: 100 },
            ] as PhosphateBalanceInput["fields"][number]["fertilizerApplications"],
          },
        },
      ],
    })
    // 2024: BRP crop with the default harvest −48 (no residues), deposition 0.7, TSP 45
    expect(result.long_term.years).toEqual([2024, 2025])
    expect(result.long_term.estimated_removal_years).toEqual([2024])
    expect(result.long_term.fertilizer_years).toEqual([2024, 2025])
    const fertilizers = (64.5 + (45 * 365) / 366) / 2
    const rest = (-44.3 + (-47.3 * 365) / 366) / 2
    expect(result.long_term.balance).toBeCloseTo(fertilizers + rest, 1)
  })

  it("should ask for the harvest when no default yield or phosphate content is known", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: input.fields[0],
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: [{ ...input.cultivationDetails[0], b_lu_p_harvestable: null }],
      timeFrame: input.timeFrame,
      history: [
        {
          timeFrame: { start: new Date("2024-01-01"), end: new Date("2024-12-31") },
          fieldInput: {
            ...input.fields[0],
            cultivations: [
              {
                ...input.fields[0].cultivations[0],
                b_lu_start: new Date("2024-04-01"),
                b_lu_end: new Date("2024-09-01"),
              },
            ],
            harvests: [],
          },
        },
      ],
    })
    expect(result.long_term.warnings.join(" ")).toMatch(/Aardappelen \(2024\): voeg de oogst toe/)
  })

  it("should add mineralisation of soil organic matter on mineral soils", () => {
    const fieldInput = {
      ...input.fields[0],
      soilAnalyses: [{ ...input.fields[0].soilAnalyses[0], a_som_loi: 3, a_density_sa: 1.3 }],
    }
    const result = calculatePhosphateBalanceField({
      fieldInput,
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    expect(result.supply.mineralization.track).toBe("mineral")
    expect(result.supply.mineralization.total).toBeGreaterThan(0)
    expect(result.balance).toBeCloseTo(65.2 + result.supply.mineralization.total - 45)
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

  it("should warn when a harvested cultivation has no phosphate content", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: input.fields[0],
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: [{ ...input.cultivationDetails[0], b_lu_p_harvestable: null }],
      timeFrame: input.timeFrame,
    })
    expect(result.removal.harvests.total).toBe(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/Geen fosfaatgehalte bekend voor Aardappelen/)
  })

  it("should warn when a cultivation that ended in the timeframe has no harvest", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: { ...input.fields[0], harvests: [] },
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    expect(result.removal.harvests.total).toBe(0)
    expect(result.warnings[0]).toMatch(/geen oogst geregistreerd/)
  })

  it("should not warn for a cultivation that is still growing at the end of the timeframe", () => {
    const fieldInput = {
      ...input.fields[0],
      harvests: [],
      cultivations: [{ ...input.fields[0].cultivations[0], b_lu_end: new Date("2026-08-01") }],
    }
    const result = calculatePhosphateBalanceField({
      fieldInput,
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    expect(result.warnings).toEqual([])
  })

  it("should count all phosphate at face value, without working coefficients", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: {
        ...input.fields[0],
        fertilizerApplications: [
          { p_app_id: "a1", p_id_catalogue: "manure", p_app_amount: 30000 },
          { p_app_id: "a3", p_id_catalogue: "compost", p_app_amount: 10000 },
          { p_app_id: "a4", p_id_catalogue: "lime", p_app_amount: 2000 },
        ] as PhosphateBalanceInput["fields"][number]["fertilizerApplications"],
      },
      fertilizerDetails: [
        ...input.fertilizerDetails,
        { p_id_catalogue: "compost", p_p_rt: 3, p_type: "compost" },
        { p_id_catalogue: "lime", p_p_rt: 1, p_type: null },
      ],
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    // Cattle slurry 1.4 g P2O5 / kg: 30 t gives 42 kg (not 60% of it)
    expect(result.supply.fertilizers.manure.total).toBeCloseTo(42)
    // Compost 3 g / kg × 10 t = 30 kg (not 60–80% of it)
    expect(result.supply.fertilizers.compost.total).toBeCloseTo(30)
    // A fertilizer without type counts as "other"
    expect(result.supply.fertilizers.other.total).toBeCloseTo(2)
    expect(result.supply.fertilizers.total).toBeCloseTo(74)
  })

  it("should warn when the yield of a harvest is unknown", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: { ...input.fields[0], harvests: [harvest("c1", null, 4)] },
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: [{ ...input.cultivationDetails[0], b_lu_yield: null }],
      timeFrame: input.timeFrame,
    })
    expect(result.removal.harvests.total).toBe(0)
    expect(result.warnings.join(" ")).toMatch(/Geen opbrengst bekend voor Aardappelen/)
  })

  it("should throw when a harvest has no cultivation details", () => {
    expect(() =>
      calculatePhosphateBalanceField({
        fieldInput: input.fields[0],
        fertilizerDetails: input.fertilizerDetails,
        cultivationDetails: [],
        timeFrame: input.timeFrame,
      }),
    ).toThrow()
  })

  it("should keep leaching at 0 when the balance is a deficit", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: { ...input.fields[0], fertilizerApplications: [] },
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    expect(result.balance).toBeLessThan(0)
    expect(result.leaching.total).toBe(0)
  })

  it("should return zeros for a buffer strip", () => {
    const result = calculatePhosphateBalanceField({
      fieldInput: input.fields[1],
      fertilizerDetails: input.fertilizerDetails,
      cultivationDetails: input.cultivationDetails,
      timeFrame: input.timeFrame,
    })
    expect(result.balance).toBe(0)
    expect(result.supply.total).toBe(0)
    expect(result.leaching.total).toBe(0)
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
    expect(determinePhosphateFrame(40, 20).name).toBe("onderhouden")
    expect(determinePhosphateFrame(30, 20).name).toBe("opbouwen")
    expect(determinePhosphateFrame(50, 20)).toEqual({
      name: "afbouwen",
      a_p_al: 50,
      target_balance_min: null,
    })
    expect(determinePhosphateFrame(null, 20).name).toBeNull()
  })
})

describe("calculatePhosphateBalance", () => {
  it("should average the fields per ha and exclude buffer strips", async () => {
    const result = await calculatePhosphateBalance(mockFdm, input)
    expect(result.fields).toHaveLength(2)
    expect(result.balance).toBeCloseTo(20.2)
    expect(result.leaching).toBeCloseTo(-20.2 * 0.06)
    expect(result.terms.supply.manure).toBeCloseTo(42)
    expect(result.terms.supply.deposition).toBeCloseTo(0.7)
    expect(result.terms.removal.harvests).toBeCloseTo(-40)
    expect(result.hasErrors).toBe(false)
    expect(result.fieldErrorMessages).toEqual([])
  })

  it("should report a failing field without failing the farm", async () => {
    const result = await calculatePhosphateBalance(mockFdm, {
      ...input,
      fields: [
        input.fields[0],
        {
          ...input.fields[0],
          field: { b_id: "f2", b_area: 5, b_bufferstrip: false },
          fertilizerApplications: [
            { p_app_id: "a3", p_id_catalogue: "unknown", p_app_amount: 10 },
          ] as PhosphateBalanceInput["fields"][number]["fertilizerApplications"],
        },
      ],
    })
    expect(result.hasErrors).toBe(true)
    expect(result.fields[1].errorMessage).toMatch(/no fertilizerDetails/)
    // Only f1 counts in the farm average
    expect(result.balance).toBeCloseTo(20.2)
  })

  it("should return an error when there are no fields", async () => {
    const result = await calculatePhosphateBalance(mockFdm, { ...input, fields: [] })
    expect(result.errorMessage).toBe("No fields in input")
    expect(result.balance).toBe(0)
  })
})

describe("calculatePhosphateBalanceFieldsToFarm", () => {
  it("should return zeros when no field has an area", () => {
    const result = calculatePhosphateBalanceFieldsToFarm(
      [{ b_id: "f", b_area: 0, b_bufferstrip: false }],
      [],
    )
    expect(result.balance).toBe(0)
    expect(result.supply).toBe(0)
    expect(result.removal).toBe(0)
    expect(result.leaching).toBe(0)
  })
})
