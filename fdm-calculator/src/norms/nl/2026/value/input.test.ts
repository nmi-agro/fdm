import type {
    Cultivation,
    CurrentSoilData,
    FdmType,
    Field,
} from "@nmi-agro/fdm-core"
import * as fdmCore from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"
import {
    collectNL2026InputForNorms,
    collectNL2026InputForNormsForFarm,
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
        getGrazingIntention: vi.fn(),
    }
})

describe("collectNL2026InputForNorms", () => {
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

        const timeframe = {
            start: new Date(2026, 0, 1),
            end: new Date(2026, 11, 31),
        }

        const timeframeCultivation = {
            start: new Date(2025, 0, 1),
            end: new Date(2026, 11, 31),
        }

        vi.mocked(fdmCore.getField).mockResolvedValue(mockField)
        vi.mocked(fdmCore.getCultivations).mockResolvedValue(mockCultivations)
        vi.mocked(fdmCore.getCurrentSoilData).mockResolvedValue(
            mockCurrentSoilData as unknown as CurrentSoilData,
        )
        vi.mocked(fdmCore.getGrazingIntention).mockResolvedValue(false)

        const result = await collectNL2026InputForNorms(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
        )

        expect(result.farm.has_grazing_intention).toBe(false)
        expect(result.field).toBe(mockField)
        expect(result.cultivations).toBe(mockCultivations)
        expect(result.soilAnalysis).toEqual({ a_p_cc: 1.0, a_p_al: 20 })
        expect(fdmCore.getField).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
        )
        expect(fdmCore.getGrazingIntention).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "farm-1",
            2026,
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

describe("collectNL2026InputForNormsForFarm", () => {
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

        vi.mocked(fdmCore.getFields).mockResolvedValue([mockField])
        vi.mocked(fdmCore.getGrazingIntention).mockResolvedValue(false)
        vi.mocked(fdmCore.getCultivationsForFarm).mockResolvedValue(
            new Map([[mockFieldId, mockCultivations]]),
        )
        vi.mocked(fdmCore.getCurrentSoilDataForFarm).mockResolvedValue(
            new Map([[mockFieldId, mockSoilData]]),
        )

        const result = await collectNL2026InputForNormsForFarm(
            mockFdm,
            mockPrincipalId,
            mockFarmId,
        )

        expect(result).toBeInstanceOf(Map)
        expect(result.has(mockFieldId)).toBe(true)
        const fieldInput = result.get(mockFieldId)!
        expect(fieldInput.farm.has_grazing_intention).toBe(false)
        expect(fieldInput.field).toBe(mockField)
        expect(fieldInput.cultivations).toBe(mockCultivations)
        expect(fieldInput.soilAnalysis).toEqual({ a_p_cc: 2.5, a_p_al: 30 })

        const timeframe2026 = { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) }
        const timeframe2026Cultivation = { start: new Date(2025, 0, 1), end: new Date(2026, 11, 31) }
        expect(fdmCore.getFields).toHaveBeenCalledWith(mockFdm, mockPrincipalId, mockFarmId, timeframe2026Cultivation)
        expect(fdmCore.getCultivationsForFarm).toHaveBeenCalledWith(mockFdm, mockPrincipalId, mockFarmId, timeframe2026Cultivation)
        expect(fdmCore.getCurrentSoilDataForFarm).toHaveBeenCalledWith(mockFdm, mockPrincipalId, mockFarmId, timeframe2026)
        expect(fdmCore.getCultivations).not.toHaveBeenCalled()
        expect(fdmCore.getCurrentSoilData).not.toHaveBeenCalled()
    })
})
