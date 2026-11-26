import type { Cultivation, CurrentSoilData, FdmType, Field, Harvest } from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"
import {
  collectNL2027InputForNorms,
  collectNL2027InputForNormsForFarm,
  type NL2027FarmFdmCoreOperations,
  type NL2027SingleFdmCoreOperations,
} from "./input"

describe("collectNL2027InputForNorms", () => {
  it("should collect input correctly", async () => {
    const mockFdm = {} as FdmType
    const mockPrincipalId = "principal-1"
    const mockFieldId = "field-1"

    const mockField = {
      b_id: mockFieldId,
      b_id_farm: "farm-1",
      b_centroid: { type: "Point", coordinates: [5.0, 52.0] },
    } as unknown as Field
    const mockCultivations = [{ b_lu: "test" }] as Cultivation[]
    const mockCurrentSoilData = [
      { parameter: "a_p_cc", value: 1.0 },
      { parameter: "a_p_al", value: 20 },
    ]

    const operations = {
      getField: async () => mockField,
      getCultivations: async () => mockCultivations,
      getHarvests: async () => [],
      getCurrentSoilData: async () => mockCurrentSoilData as unknown as CurrentSoilData,
      getGrazingIntention: async () => false,
    } as NL2027SingleFdmCoreOperations

    const result = await collectNL2027InputForNorms(
      mockFdm,
      mockPrincipalId,
      mockFieldId,
      operations,
    )

    expect(result.farm.has_grazing_intention).toBe(false)
    expect(result.field).toBe(mockField)
    expect(result.cultivations).toEqual([{ ...mockCultivations[0], harvests: [] }])
    expect(result.soilAnalysis).toEqual({ a_p_cc: 1.0, a_p_al: 20 })
  })

  it("should map missing soil parameters to null", async () => {
    const mockFdm = {} as FdmType
    const mockPrincipalId = "principal-1"
    const mockFieldId = "field-1"

    const operations = {
      getField: async () =>
        ({
          b_id: mockFieldId,
          b_id_farm: "farm-1",
          b_centroid: [5.0, 52.0],
        }) as Field,
      getCultivations: async () => [],
      getHarvests: async () => [],
      getCurrentSoilData: async () => [] as unknown as CurrentSoilData,
      getGrazingIntention: async () => false,
    } as NL2027SingleFdmCoreOperations

    const result = await collectNL2027InputForNorms(
      mockFdm,
      mockPrincipalId,
      mockFieldId,
      operations,
    )
    expect(result.soilAnalysis).toEqual({ a_p_cc: null, a_p_al: null })
  })
})

describe("collectNL2027InputForNormsForFarm", () => {
  it("should collect farm input correctly", async () => {
    const mockFdm = {} as FdmType
    const mockPrincipalId = "principal-1"
    const mockFarmId = "farm-1"
    const mockFieldId = "field-1"

    const mockField = {
      b_id: mockFieldId,
      b_id_farm: mockFarmId,
      b_centroid: [5.0, 52.0],
    } as Field
    const mockCultivations = [{ b_lu: "test" }] as Cultivation[]
    const mockSoilData: CurrentSoilData = [
      { parameter: "a_p_cc", value: 2.5 } as any,
      { parameter: "a_p_al", value: 30 } as any,
    ]

    const operations = {
      getFields: async () => [mockField],
      getGrazingIntention: async () => false,
      getCultivationsForFarm: async () => new Map([[mockFieldId, mockCultivations]]),
      getHarvestsForFarm: async () => new Map(),
      getCurrentSoilDataForFarm: async () => new Map([[mockFieldId, mockSoilData]]),
    } as NL2027FarmFdmCoreOperations

    const result = await collectNL2027InputForNormsForFarm(
      mockFdm,
      mockPrincipalId,
      mockFarmId,
      operations,
    )

    expect(result).toBeInstanceOf(Map)
    expect(result.has(mockFieldId)).toBe(true)
    const fieldInput = result.get(mockFieldId)!
    expect(fieldInput.farm.has_grazing_intention).toBe(false)
    expect(fieldInput.field).toBe(mockField)
    expect(fieldInput.cultivations).toEqual([{ ...mockCultivations[0], harvests: [] }])
    expect(fieldInput.soilAnalysis).toEqual({ a_p_cc: 2.5, a_p_al: 30 })
  })

  it("should default soil and cultivation values for non-array soil data and missing field maps", async () => {
    const mockFdm = {} as FdmType
    const mockPrincipalId = "principal-1"
    const mockFarmId = "farm-1"
    const mockFieldId = "field-1"

    const mockField = {
      b_id: mockFieldId,
      b_id_farm: mockFarmId,
      b_centroid: [5.0, 52.0],
    } as Field

    const operations = {
      getFields: async () => [mockField],
      getGrazingIntention: async () => false,
      getCultivationsForFarm: async () => new Map(),
      getHarvestsForFarm: async () => new Map(),
      getCurrentSoilDataForFarm: async () =>
        new Map([[mockFieldId, { not: "an-array" } as unknown as CurrentSoilData]]),
    } as NL2027FarmFdmCoreOperations

    const result = await collectNL2027InputForNormsForFarm(
      mockFdm,
      mockPrincipalId,
      mockFarmId,
      operations,
    )
    const fieldInput = result.get(mockFieldId)!

    expect(fieldInput.cultivations).toEqual([])
    expect(fieldInput.soilAnalysis).toEqual({ a_p_cc: null, a_p_al: null })
  })

  it("should fallback to empty soil array when a field has no soil map entry", async () => {
    const mockFdm = {} as FdmType
    const mockPrincipalId = "principal-1"
    const mockFarmId = "farm-1"
    const mockFieldId = "field-1"

    const mockField = {
      b_id: mockFieldId,
      b_id_farm: mockFarmId,
      b_centroid: [5.0, 52.0],
    } as Field

    const operations = {
      getFields: async () => [mockField],
      getGrazingIntention: async () => false,
      getCultivationsForFarm: async () => new Map(),
      getHarvestsForFarm: async () => new Map(),
      getCurrentSoilDataForFarm: async () => new Map(),
    } as NL2027FarmFdmCoreOperations

    const result = await collectNL2027InputForNormsForFarm(
      mockFdm,
      mockPrincipalId,
      mockFarmId,
      operations,
    )
    expect(result.get(mockFieldId)?.soilAnalysis).toEqual({ a_p_cc: null, a_p_al: null })
  })
})

describe("NL2027 norm input harvests", () => {
  const mockFdm = {} as FdmType
  const mockPrincipalId = "principal-1"
  const mockFarmId = "farm-1"
  const mockFieldId = "field-1"
  const mockField = {
    b_id: mockFieldId,
    b_id_farm: mockFarmId,
    b_centroid: [5.0, 52.0],
  } as Field
  const mockCultivations = [
    { b_lu: "lu-harvested", b_lu_catalogue: "nl_2791" },
    { b_lu: "lu-unharvested", b_lu_catalogue: "nl_2743" },
  ] as Cultivation[]
  const harvestDates = [new Date(2027, 5, 21), new Date(2027, 7, 15)]
  const mockHarvests = harvestDates.map((b_lu_harvest_date, i) => ({
    b_id_harvesting: `harvest-${i}`,
    b_lu_harvest_date,
  })) as unknown as Harvest[]
  const normYear = { start: new Date(2027, 0, 1), end: new Date(2027, 11, 31, 23, 59, 59, 999) }

  it("attaches the harvests of the norm year to each cultivation of a field", async () => {
    const getHarvests = vi.fn(async (_fdm: FdmType, _principal: string, b_lu: string) =>
      b_lu === "lu-harvested" ? mockHarvests : [],
    )
    const operations = {
      getField: async () => mockField,
      getCultivations: async () => mockCultivations,
      getHarvests,
      getCurrentSoilData: async () => [] as unknown as CurrentSoilData,
      getGrazingIntention: async () => false,
    } as unknown as NL2027SingleFdmCoreOperations

    const result = await collectNL2027InputForNorms(
      mockFdm,
      mockPrincipalId,
      mockFieldId,
      operations,
    )

    expect(getHarvests).toHaveBeenCalledWith(mockFdm, mockPrincipalId, "lu-harvested", normYear)
    expect(result.cultivations).toEqual([
      {
        ...mockCultivations[0],
        harvests: harvestDates.map((b_lu_harvest_date) => ({ b_lu_harvest_date })),
      },
      { ...mockCultivations[1], harvests: [] },
    ])
  })

  it("attaches the harvests of the norm year to each cultivation of a farm by b_lu", async () => {
    const getHarvestsForFarm = vi.fn(async () => new Map([["lu-harvested", mockHarvests]]))
    const operations = {
      getFields: async () => [mockField],
      getGrazingIntention: async () => false,
      getCultivationsForFarm: async () => new Map([[mockFieldId, mockCultivations]]),
      getHarvestsForFarm,
      getCurrentSoilDataForFarm: async () => new Map(),
    } as unknown as NL2027FarmFdmCoreOperations

    const result = await collectNL2027InputForNormsForFarm(
      mockFdm,
      mockPrincipalId,
      mockFarmId,
      operations,
    )

    expect(getHarvestsForFarm).toHaveBeenCalledWith(mockFdm, mockPrincipalId, mockFarmId, normYear)
    expect(result.get(mockFieldId)?.cultivations).toEqual([
      {
        ...mockCultivations[0],
        harvests: harvestDates.map((b_lu_harvest_date) => ({ b_lu_harvest_date })),
      },
      { ...mockCultivations[1], harvests: [] },
    ])
  })

  it("includes harvests at any time on 31 December and excludes 1 January 2028", async () => {
    const isInWindow = (timeframe: { start: Date; end: Date }, date: Date) =>
      date >= timeframe.start && date <= timeframe.end
    const lateOnLastDay = new Date(2027, 11, 31, 23, 30)
    const utcMidnightLastDay = new Date(Date.UTC(2027, 11, 31))
    const nextYear = new Date(2028, 0, 1)

    const getHarvests = vi.fn(async () => [])
    await collectNL2027InputForNorms(mockFdm, mockPrincipalId, mockFieldId, {
      getField: async () => mockField,
      getCultivations: async () => mockCultivations,
      getHarvests,
      getCurrentSoilData: async () => [] as unknown as CurrentSoilData,
      getGrazingIntention: async () => false,
    } as unknown as NL2027SingleFdmCoreOperations)

    const getHarvestsForFarm = vi.fn(async () => new Map())
    await collectNL2027InputForNormsForFarm(mockFdm, mockPrincipalId, mockFarmId, {
      getFields: async () => [mockField],
      getGrazingIntention: async () => false,
      getCultivationsForFarm: async () => new Map([[mockFieldId, mockCultivations]]),
      getHarvestsForFarm,
      getCurrentSoilDataForFarm: async () => new Map(),
    } as unknown as NL2027FarmFdmCoreOperations)

    const timeframes = [
      ...getHarvests.mock.calls.map((call) => (call as unknown[])[3]),
      ...getHarvestsForFarm.mock.calls.map((call) => (call as unknown[])[3]),
    ] as { start: Date; end: Date }[]
    expect(timeframes).toHaveLength(mockCultivations.length + 1)
    for (const timeframe of timeframes) {
      expect(isInWindow(timeframe, lateOnLastDay)).toBe(true)
      expect(isInWindow(timeframe, utcMidnightLastDay)).toBe(true)
      expect(isInWindow(timeframe, nextYear)).toBe(false)
    }
  })
})
