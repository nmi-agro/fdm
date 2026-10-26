import type { FdmType } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type {
  NitrogenBalanceFieldInput,
  NitrogenBalanceFieldResultNumeric,
  NitrogenBalanceInput,
} from "./types"
import {
  calculateNitrogenBalance,
  calculateNitrogenBalancesFieldToFarm,
  getNitrogenBalanceField,
} from "."
import { calculateNitrogenSupplyBySoilMineralizationUsingMinip } from "./supply/mineralization"

// Mock FdmType
const mockFdm = {
  select: () => mockFdm,
  from: () => mockFdm,
  where: () => mockFdm,
  limit: () => mockFdm,
  execute: async () => [], // Simulate cache miss
  insert: () => mockFdm,
  values: async () => undefined,
} as unknown as FdmType

describe("calculateNitrogenBalance", () => {
  it("should calculate nitrogen balance correctly with mock input", async () => {
    const mockNitrogenBalanceInput: NitrogenBalanceInput = {
      fields: [
        {
          field: {
            b_id: "field1",
            b_centroid: [5.0, 52.0],
            b_area: 100,
            b_start: new Date("2023-01-01"),
            b_end: new Date("2023-12-31"),
            b_bufferstrip: false,
          },
          cultivations: [
            {
              b_lu: "cultivation1",
              b_lu_catalogue: "catalogue1",
              m_cropresidue: true,
              b_lu_start: new Date("2023-01-01"),
              b_lu_end: new Date("2023-12-31"),
              b_lu_name: "Cultivation 1",
              b_lu_croprotation: "cereal",
            },
          ],
          harvests: [
            {
              b_id_harvesting: "harvest1",
              b_lu: "cultivation1",
              b_lu_harvest_date: new Date(),
              harvestable: {
                b_id_harvestable: "harvestable1",
                harvestable_analyses: [
                  {
                    b_lu_yield: 1000,
                    b_lu_n_harvestable: 20,
                    b_id_harvestable_analysis: "",
                    b_lu_yield_fresh: null,
                    b_lu_yield_bruto: null,
                    b_lu_tarra: null,
                    b_lu_dm: null,
                    b_lu_moist: null,
                    b_lu_uww: null,
                    b_lu_cp: null,
                    b_lu_n_residue: null,
                    b_lu_p_harvestable: null,
                    b_lu_p_residue: null,
                    b_lu_k_harvestable: null,
                    b_lu_k_residue: null,
                  },
                ],
              },
            },
          ],
          soilAnalyses: [
            {
              a_id: "soil1",
              b_sampling_date: new Date(),
              a_c_of: 20,
              a_cn_fr: 10,
              a_density_sa: 1.2,
              a_n_rt: 3000,
              a_som_loi: 2,
              b_soiltype_agr: "dekzand",
              b_gwl_class: "II",
            },
          ],
          fertilizerApplications: [
            {
              p_id_catalogue: "fertilizer1",
              p_app_amount: 100,
              p_app_id: "fertilizerApp1",
              p_id: "",
              p_name_nl: null,
              p_app_method: null,
              p_app_date: new Date("2025-03-15"),
            },
          ],
          depositionSupply: {
            total: new Decimal(0),
          },
        },
      ],
      fertilizerDetails: [
        {
          p_id_catalogue: "fertilizer1",
          p_n_rt: 10,
          p_type: "mineral",
          p_no3_rt: 2,
          p_nh4_rt: 8,
          p_s_rt: 20,
          p_ef_nh3: null,
        },
      ],
      cultivationDetails: [
        {
          b_lu_catalogue: "catalogue1",
          b_lu_croprotation: "cereal",
          b_lu_yield: 1000,
          b_lu_n_harvestable: 20,
          b_lu_hi: 0.4,
          b_lu_n_residue: 2,
          b_n_fixation: 0,
        },
      ],
      timeFrame: {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
      },
    }

    const result = await calculateNitrogenBalance(mockFdm, mockNitrogenBalanceInput)

    function assertValidFertilizerBreakdown(
      obj: { total: number } & Record<"mineral" | "manure" | "compost" | "other", number>,
    ) {
      expect(typeof obj.total).toBe("number")
      expect(typeof obj.mineral).toBe("number")
      expect(typeof obj.manure).toBe("number")
      expect(typeof obj.compost).toBe("number")
      expect(typeof obj.other).toBe("number")
    }
    expect(result).toBeDefined()
    expect(typeof result.balance).toBe("number")

    expect(result.supply).toBeDefined()
    expect(typeof result.supply.total).toBe("number")
    expect(typeof result.supply.deposition).toBe("number")
    expect(typeof result.supply.fixation).toBe("number")
    expect(typeof result.supply.mineralisation).toBe("number")
    expect(result.supply.fertilizers).toBeDefined()
    assertValidFertilizerBreakdown(result.supply.fertilizers)
    expect(typeof result.emission.total).toBe("number")
    expect(result.emission.ammonia).toBeDefined()
    expect(typeof result.emission.ammonia.total).toBe("number")
    expect(result.emission.ammonia.fertilizers).toBeDefined()
    assertValidFertilizerBreakdown(result.emission.ammonia.fertilizers)
    expect(typeof result.emission.ammonia.residues).toBe("number")
    expect(typeof result.emission.nitrate).toBe("number")
    expect(typeof result.target).toBe("number")
    expect(Array.isArray(result.fields)).toBe(true)
  })

  it("should calculate the fertilizer supply with effective nitrogen when requested", async () => {
    const mockNitrogenBalanceInput: NitrogenBalanceInput = {
      fields: [
        {
          field: {
            b_id: "field1",
            b_centroid: [5.0, 52.0],
            b_area: 100,
            b_start: new Date("2023-01-01"),
            b_end: new Date("2023-12-31"),
            b_bufferstrip: false,
          },
          cultivations: [
            {
              b_lu: "cultivation1",
              b_lu_catalogue: "catalogue1",
              m_cropresidue: true,
              b_lu_start: new Date("2023-01-01"),
              b_lu_end: new Date("2023-12-31"),
              b_lu_name: "Cultivation 1",
              b_lu_croprotation: "cereal",
            },
          ],
          harvests: [
            {
              b_id_harvesting: "harvest1",
              b_lu: "cultivation1",
              b_lu_harvest_date: new Date(),
              harvestable: {
                b_id_harvestable: "harvestable1",
                harvestable_analyses: [
                  {
                    b_lu_yield: 1000,
                    b_lu_n_harvestable: 20,
                    b_id_harvestable_analysis: "",
                    b_lu_yield_fresh: null,
                    b_lu_yield_bruto: null,
                    b_lu_tarra: null,
                    b_lu_dm: null,
                    b_lu_moist: null,
                    b_lu_uww: null,
                    b_lu_cp: null,
                    b_lu_n_residue: null,
                    b_lu_p_harvestable: null,
                    b_lu_p_residue: null,
                    b_lu_k_harvestable: null,
                    b_lu_k_residue: null,
                  },
                ],
              },
            },
          ],
          soilAnalyses: [
            {
              a_id: "soil1",
              b_sampling_date: new Date(),
              a_c_of: 20,
              a_cn_fr: 10,
              a_density_sa: 1.2,
              a_n_rt: 3000,
              a_som_loi: 2,
              b_soiltype_agr: "dekzand",
              b_gwl_class: "II",
            },
          ],
          fertilizerApplications: [
            {
              p_id_catalogue: "fertilizer1",
              p_app_amount: 1000,
              p_app_id: "fertilizerApp1",
              p_id: "",
              p_name_nl: null,
              p_app_method: null,
              p_app_date: new Date("2025-03-15"),
            },
          ],
          depositionSupply: {
            total: new Decimal(0),
          },
        },
      ],
      fertilizerDetails: [
        {
          p_id_catalogue: "fertilizer1",
          p_n_rt: 10,
          p_type: "mineral",
          p_no3_rt: 2,
          p_nh4_rt: 8,
          p_s_rt: 20,
          p_ef_nh3: null,
          p_n_wc: 0.5,
        },
      ],
      cultivationDetails: [
        {
          b_lu_catalogue: "catalogue1",
          b_lu_croprotation: "cereal",
          b_lu_yield: 1000,
          b_lu_n_harvestable: 20,
          b_lu_hi: 0.4,
          b_lu_n_residue: 2,
          b_n_fixation: 0,
        },
      ],
      timeFrame: {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
      },
    }

    const totalResult = await calculateNitrogenBalance(mockFdm, mockNitrogenBalanceInput)
    const effectiveResult = await calculateNitrogenBalance(mockFdm, {
      ...mockNitrogenBalanceInput,
      useEffectiveNitrogen: true,
    })

    // 1000 kg/ha * 10 g N/kg = 10 kg N/ha total; with p_n_wc 0.5 -> 5 kg N/ha effective
    expect(totalResult.supply.fertilizers.total).toBe(10)
    expect(effectiveResult.supply.fertilizers.total).toBe(5)

    // Mineralization: default value for dekzand (0) vs MINIP from the soil analysis
    const minip = calculateNitrogenSupplyBySoilMineralizationUsingMinip(20, 10, 1.2)
      .times(364)
      .dividedBy(365) // 2023-01-01 to 2023-12-31
    expect(totalResult.supply.mineralisation).toBe(0)
    expect(effectiveResult.supply.mineralisation).toBe(minip.round().toNumber())
    expect(effectiveResult.supply.mineralisation).toBeGreaterThan(0)

    // Ammonia emission and nitrate leaching are the same in both balances
    expect(effectiveResult.emission.ammonia.total).toBe(totalResult.emission.ammonia.total)
    expect(effectiveResult.emission.nitrate).toBe(totalResult.emission.nitrate)

    // Balance: -5 kg N/ha from fertilizers, + MINIP mineralization (rounding of 1 allowed)
    const expectedDifference = minip.minus(5).toNumber()
    expect(
      Math.abs(effectiveResult.balance - totalResult.balance - expectedDifference),
    ).toBeLessThanOrEqual(1)
  })

  it("should handle errors from sub-calculations", async () => {
    const mockNitrogenBalanceInput: NitrogenBalanceInput = {
      fields: [
        {
          field: {
            b_id: "field1",
            b_centroid: [5.0, 52.0],
            b_area: 100,
            b_start: new Date("2023-01-01"),
            b_end: new Date("2023-12-31"),
            b_bufferstrip: false,
          },
          cultivations: [],
          harvests: [],
          soilAnalyses: [],
          fertilizerApplications: [],
          depositionSupply: {
            total: new Decimal(0),
          },
        },
      ],
      fertilizerDetails: [],
      cultivationDetails: [],
      timeFrame: {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
      },
    }

    const result = await calculateNitrogenBalance(mockFdm, mockNitrogenBalanceInput)

    expect(result.hasErrors).toBe(true)
    expect(result.fieldErrorMessages.length).toBeGreaterThan(0)
  })

  it("should return zero balance for buffer strips", async () => {
    const mockNitrogenBalanceInput: NitrogenBalanceInput = {
      fields: [
        {
          field: {
            b_id: "field1",
            b_centroid: [5.0, 52.0],
            b_area: 100,
            b_start: new Date("2023-01-01"),
            b_end: new Date("2023-12-31"),
            b_bufferstrip: true,
          },
          cultivations: [],
          harvests: [],
          soilAnalyses: [],
          fertilizerApplications: [],
          depositionSupply: {
            total: new Decimal(0),
          },
        },
      ],
      fertilizerDetails: [],
      cultivationDetails: [],
      timeFrame: {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
      },
    }

    const result = await calculateNitrogenBalance(mockFdm, mockNitrogenBalanceInput)

    expect(result.hasErrors).toBe(false)
    expect(result.fieldErrorMessages.length).toBe(0)
    expect(result.balance).toBe(0)
    expect(result.supply.total).toBe(0)
    expect(result.removal.total).toBe(0)
    expect(result.emission.total).toBe(0)
  })

  it("should return correct error message for no fields in input", async () => {
    const result = await calculateNitrogenBalance(mockFdm, {
      fertilizerDetails: [],
      cultivationDetails: [],
      fields: [],
      timeFrame: {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
      },
    })

    expect(result.errorMessage).toBe("No fields in input")
    expect(result.fieldErrorMessages).toContain("No fields in input")
  })

  it("should ignore buffer strips in farm-level aggregation", () => {
    const results: NitrogenBalanceFieldResultNumeric[] = [
      {
        b_id: "field1",
        b_area: 10,
        b_bufferstrip: false,
        balance: {
          balance: 100,
          supply: {
            total: 100,
            deposition: { total: 0 },
            fixation: { total: 0 },
            mineralisation: { total: 0 },
            fertilizers: {
              total: 0,
              mineral: { total: 0 },
              manure: { total: 0 },
              compost: { total: 0 },
              other: { total: 0 },
            },
          } as any,
          removal: {
            total: 0,
            harvests: { total: 0 },
            residues: { total: 0 },
          } as any,
          target: 0,
          emission: {
            total: 0,
            ammonia: {
              total: 0,
              fertilizers: {
                total: 0,
                mineral: { total: 0 },
                manure: { total: 0 },
                compost: { total: 0 },
                other: { total: 0 },
              },
              residues: { total: 0 },
            },
            nitrate: { total: 0 },
          } as any,
        } as any,
      },
      {
        b_id: "buffer1",
        b_area: 100,
        b_bufferstrip: true,
        balance: {
          balance: 0,
          supply: {
            total: 0,
            deposition: { total: 0 },
            fixation: { total: 0 },
            mineralisation: { total: 0 },
            fertilizers: {
              total: 0,
              mineral: { total: 0 },
              manure: { total: 0 },
              compost: { total: 0 },
              other: { total: 0 },
            },
          } as any,
          removal: { total: 0 } as any,
          target: 0,
          emission: { total: 0 } as any,
        } as any,
      },
    ]

    const farmBalance = calculateNitrogenBalancesFieldToFarm(results, false, [])

    // Should match field1 values exactly
    expect(farmBalance.balance).toBe(100)
    expect(farmBalance.supply.total).toBe(100)
  })
})

describe("getNitrogenBalanceField", () => {
  it("should use the same cache entry for useEffectiveNitrogen false and omitted", async () => {
    // Record the hash of every cache write (always a cache miss)
    const cachedHashes: string[] = []
    const recordingFdm = {
      select: () => recordingFdm,
      from: () => recordingFdm,
      where: () => recordingFdm,
      limit: async () => [],
      insert: () => recordingFdm,
      values: (row: { calculation_hash: string }) => {
        cachedHashes.push(row.calculation_hash)
        return { onConflictDoNothing: async () => undefined }
      },
    } as unknown as FdmType

    const input: NitrogenBalanceFieldInput = {
      fieldInput: {
        field: {
          b_id: "field1",
          b_centroid: [5.0, 52.0],
          b_area: 1,
          b_start: new Date("2023-01-01"),
          b_end: null,
          b_bufferstrip: true,
        },
        cultivations: [],
        harvests: [],
        soilAnalyses: [],
        fertilizerApplications: [],
        depositionSupply: { total: new Decimal(0) },
      },
      fertilizerDetails: [],
      cultivationDetails: [],
      timeFrame: {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
      },
    }

    await getNitrogenBalanceField(recordingFdm, input)
    await getNitrogenBalanceField(recordingFdm, { ...input, useEffectiveNitrogen: false })
    await getNitrogenBalanceField(recordingFdm, { ...input, useEffectiveNitrogen: true })

    expect(cachedHashes).toHaveLength(3)
    expect(cachedHashes[1]).toBe(cachedHashes[0])
    expect(cachedHashes[2]).not.toBe(cachedHashes[0])
  })
})
