import type {
    Cultivation,
    CurrentSoilData,
    FdmType,
    Field,
} from "@nmi-agro/fdm-core"
import * as fdmCore from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"
import {
    collectNL2025InputForNorms,
    collectNL2025InputForNormsForFarm,
} from "./input"

vi.mock("@nmi-agro/fdm-core", async () => {
    const actual = await vi.importActual("@nmi-agro/fdm-core")
    return {
        ...actual,
        getField: vi.fn(),
        getFields: vi.fn(),
        getCultivations: vi.fn(),
        getCultivationsForFarm: vi.fn(),
        getCurrentSoilData: vi.fn(),
        getCurrentSoilDataForFarm: vi.fn(),
        isDerogationGrantedForYear: vi.fn(),
        getGrazingIntention: vi.fn(),
    }
})

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

        const timeframe = {
            start: new Date(2025, 0, 1),
            end: new Date(2025, 11, 31),
        }

        const timeframeCultivation = {
            start: new Date(2024, 0, 1),
            end: new Date(2025, 11, 31),
        }

        vi.mocked(fdmCore.getField).mockResolvedValue(mockField)
        vi.mocked(fdmCore.getCultivations).mockResolvedValue(mockCultivations)
        vi.mocked(fdmCore.getCurrentSoilData).mockResolvedValue(
            mockSoilAnalysis as CurrentSoilData,
        )
        vi.mocked(fdmCore.isDerogationGrantedForYear).mockResolvedValue(false)
        vi.mocked(fdmCore.getGrazingIntention).mockResolvedValue(false)

        const result = await collectNL2025InputForNorms(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
        )

        expect(result.farm.is_derogatie_bedrijf).toBe(false)
        expect(result.farm.has_grazing_intention).toBe(false)
        expect(result.field).toBe(mockField)
        expect(result.cultivations).toBe(mockCultivations)
        expect(result.soilAnalysis).toEqual({ a_p_cc: 1.0, a_p_al: 20 })
        expect(fdmCore.getField).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
        )
        expect(fdmCore.isDerogationGrantedForYear).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "farm-1",
            2025,
        )
        expect(fdmCore.getGrazingIntention).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "farm-1",
            2025,
        )
        expect(fdmCore.getCultivations).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
            timeframeCultivation,
        )
        expect(fdmCore.getCurrentSoilData).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
            timeframe,
        )
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

        vi.mocked(fdmCore.getFields).mockResolvedValue([mockField])
        vi.mocked(fdmCore.isDerogationGrantedForYear).mockResolvedValue(false)
        vi.mocked(fdmCore.getGrazingIntention).mockResolvedValue(true)
        vi.mocked(fdmCore.getCultivationsForFarm).mockResolvedValue(
            new Map([[mockFieldId, mockCultivations]]),
        )
        vi.mocked(fdmCore.getCurrentSoilDataForFarm).mockResolvedValue(
            new Map([[mockFieldId, mockSoilData]]),
        )

        const result = await collectNL2025InputForNormsForFarm(
            mockFdm,
            mockPrincipalId,
            mockFarmId,
        )

        expect(result).toBeInstanceOf(Map)
        expect(result.has(mockFieldId)).toBe(true)
        const fieldInput = result.get(mockFieldId)!
        expect(fieldInput.farm.is_derogatie_bedrijf).toBe(false)
        expect(fieldInput.farm.has_grazing_intention).toBe(true)
        expect(fieldInput.field).toBe(mockField)
        expect(fieldInput.cultivations).toBe(mockCultivations)
        expect(fieldInput.soilAnalysis).toEqual({ a_p_cc: 1.0, a_p_al: 20 })

        const timeframe2025 = { start: new Date(2025, 0, 1), end: new Date(2025, 11, 31) }
        const timeframe2025Cultivation = { start: new Date(2024, 0, 1), end: new Date(2025, 11, 31) }
        expect(fdmCore.getFields).toHaveBeenCalledWith(mockFdm, mockPrincipalId, mockFarmId, timeframe2025Cultivation)
        expect(fdmCore.getCultivationsForFarm).toHaveBeenCalledWith(mockFdm, mockPrincipalId, mockFarmId, timeframe2025Cultivation)
        expect(fdmCore.getCurrentSoilDataForFarm).toHaveBeenCalledWith(mockFdm, mockPrincipalId, mockFarmId, timeframe2025)
        expect(fdmCore.getCultivations).not.toHaveBeenCalled()
        expect(fdmCore.getCurrentSoilData).not.toHaveBeenCalled()
    })
})
