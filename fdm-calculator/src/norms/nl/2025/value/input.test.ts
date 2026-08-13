import type { Cultivation, CurrentSoilData, FdmType, Field } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import {
  collectNL2025InputForNorms,
  collectNL2025InputForNormsForFarm,
  type NL2025FarmFdmCoreOperations,
  type NL2025SingleFdmCoreOperations,
} from "./input"

describe("collectNL2025InputForNorms", () => {
  it("should collect input correctly", async () => {
    const mockFdm = {} as FdmType
    const mockPrincipalId = "principal-1"
    const mockFieldId = "field-1"

    const mockField = {
      b_id: mockFieldId,
      b_id_farm: "farm-1",
      b_centroid: [5.0, 52.0],
    } as Field
    const mockCultivations = [{ b_lu: "test" }] as Cultivation[]
    const mockSoilAnalysis = [
      { parameter: "a_p_cc", value: 1.0 },
      { parameter: "a_p_al", value: 20 },
    ]

    const operations = {
      getField: async () => mockField,
      getCultivations: async () => mockCultivations,
      getCurrentSoilData: async () => mockSoilAnalysis as CurrentSoilData,
      isDerogationGrantedForYear: async () => false,
      getGrazingIntention: async () => false,
    } as NL2025SingleFdmCoreOperations

    const result = await collectNL2025InputForNorms(
      mockFdm,
      mockPrincipalId,
      mockFieldId,
      operations,
    )

    expect(result.farm.is_derogatie_bedrijf).toBe(false)
    expect(result.farm.has_grazing_intention).toBe(false)
    expect(result.field).toBe(mockField)
    expect(result.cultivations).toBe(mockCultivations)
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
      getCurrentSoilData: async () => [] as CurrentSoilData,
      isDerogationGrantedForYear: async () => false,
      getGrazingIntention: async () => false,
    } as NL2025SingleFdmCoreOperations

    const result = await collectNL2025InputForNorms(
      mockFdm,
      mockPrincipalId,
      mockFieldId,
      operations,
    )
    expect(result.soilAnalysis).toEqual({ a_p_cc: null, a_p_al: null })
  })
})

describe("collectNL2025InputForNormsForFarm", () => {
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
      { parameter: "a_p_cc", value: 1.0 } as any,
      { parameter: "a_p_al", value: 20 } as any,
    ]

    const operations = {
      getFields: async () => [mockField],
      isDerogationGrantedForYear: async () => false,
      getGrazingIntention: async () => true,
      getCultivationsForFarm: async () => new Map([[mockFieldId, mockCultivations]]),
      getCurrentSoilDataForFarm: async () => new Map([[mockFieldId, mockSoilData]]),
    } as NL2025FarmFdmCoreOperations

    const result = await collectNL2025InputForNormsForFarm(
      mockFdm,
      mockPrincipalId,
      mockFarmId,
      operations,
    )

    expect(result).toBeInstanceOf(Map)
    expect(result.has(mockFieldId)).toBe(true)
    const fieldInput = result.get(mockFieldId)!
    expect(fieldInput.farm.is_derogatie_bedrijf).toBe(false)
    expect(fieldInput.farm.has_grazing_intention).toBe(true)
    expect(fieldInput.field).toBe(mockField)
    expect(fieldInput.cultivations).toBe(mockCultivations)
    expect(fieldInput.soilAnalysis).toEqual({ a_p_cc: 1.0, a_p_al: 20 })
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
      isDerogationGrantedForYear: async () => false,
      getGrazingIntention: async () => false,
      getCultivationsForFarm: async () => new Map(),
      getCurrentSoilDataForFarm: async () =>
        new Map([[mockFieldId, { not: "an-array" } as unknown as CurrentSoilData]]),
    } as NL2025FarmFdmCoreOperations

    const result = await collectNL2025InputForNormsForFarm(
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
      isDerogationGrantedForYear: async () => false,
      getGrazingIntention: async () => false,
      getCultivationsForFarm: async () => new Map(),
      getCurrentSoilDataForFarm: async () => new Map(),
    } as NL2025FarmFdmCoreOperations

    const result = await collectNL2025InputForNormsForFarm(
      mockFdm,
      mockPrincipalId,
      mockFarmId,
      operations,
    )
    expect(result.get(mockFieldId)?.soilAnalysis).toEqual({ a_p_cc: null, a_p_al: null })
  })
})
