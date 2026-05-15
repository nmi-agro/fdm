import type {
    Cultivation,
    FdmType,
    Field,
    Measure,
    PrincipalId,
    SoilAnalysis,
    Timeframe,
} from "@nmi-agro/fdm-core"
import {
    getCultivations,
    getField,
    getMeasures,
    getSoilAnalyses,
} from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectInputForBln3Score } from "./input"

vi.mock("@nmi-agro/fdm-core", async () => {
    const actual = await vi.importActual("@nmi-agro/fdm-core")
    return {
        ...actual,
        getField: vi.fn(),
        getSoilAnalyses: vi.fn(),
        getCultivations: vi.fn(),
        getMeasures: vi.fn(),
    }
})

const mockedGetField = vi.mocked(getField)
const mockedGetSoilAnalyses = vi.mocked(getSoilAnalyses)
const mockedGetCultivations = vi.mocked(getCultivations)
const mockedGetMeasures = vi.mocked(getMeasures)

// Minimal FdmType mock — collect functions don't use transactions
const mockFdm = {} as FdmType
const principal_id: PrincipalId = "test-principal"
const b_id = "field-1"
const timeframe: Timeframe = {
    start: new Date("2024-01-01"),
    end: new Date("2024-12-31"),
}

// Base field: centroid [lon, lat] = [5.2, 51.6]
const mockField: Field = {
    b_id,
    b_name: "Test field",
    b_id_farm: "farm-1",
    b_id_source: null,
    b_geometry: null,
    b_centroid: [5.2, 51.6],
    b_area: 10,
    b_perimeter: 400,
    b_start: new Date("2020-01-01"),
    b_end: null,
    b_acquiring_method: "unknown",
    b_bufferstrip: false,
}

// Soil analysis with assorted a_* fields and metadata
const mockSoilAnalysis: SoilAnalysis = {
    a_id: "sa-1",
    a_date: new Date("2023-06-01"),
    a_source: "lab",
    b_soiltype_agr: "dekzand",
    b_gwl_class: "IIb",
    a_som_loi: 4.5,
    a_clay_mi: 10,
    a_p_cc: 1.2,
    a_p_al: 42,
    a_n_rt: 2500,
    // Non-numeric fields that must NOT appear in the API payload
    a_depth_upper: 0,
    a_depth_lower: 30,
} as unknown as SoilAnalysis

// Cultivation with a valid nl_ BRP catalogue code
const mockCultivation: Cultivation = {
    b_lu: "cult-1",
    b_lu_catalogue: "nl_266",
    b_lu_start: new Date("2024-03-15"),
    b_lu_end: new Date("2024-09-01"),
    b_lu_source: "nl",
    b_lu_name: "Maize",
    b_lu_name_en: "Maize",
    b_lu_hcat3: "hcat3",
    b_lu_hcat3_name: "Hcat3",
    b_lu_croprotation: "maize",
    b_lu_eom: 1,
    b_lu_eom_residue: 1,
    b_lu_harvestcat: "HC010",
    b_lu_harvestable: "once",
    b_lu_variety: null,
    m_cropresidue: false,
    b_id,
} as unknown as Cultivation

// BLN measure
const mockMeasure: Measure = {
    b_id_measure: "meas-1",
    m_id: "bln_BM3",
    b_id,
    m_start: new Date("2024-01-01"),
    m_end: null,
    m_name: "Niet-kerende grondbewerking",
    m_summary: null,
    m_conflicts: null,
}

describe("collectInputForBln3Score", () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it("should return lat/lon from field centroid", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        // b_centroid = [lon, lat]
        expect(result.a_lon).toBe(5.2)
        expect(result.a_lat).toBe(51.6)
    })

    it("should map soil analysis: b_soiltype_agr and b_gwl_class", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.b_soiltype_agr).toBe("dekzand")
        expect(result.b_gwl_class).toBe("IIb")
    })

    it("should include numeric a_* fields from the most recent soil analysis", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.a_som_loi).toBe(4.5)
        expect(result.a_clay_mi).toBe(10)
        expect(result.a_p_cc).toBe(1.2)
        expect(result.a_n_rt).toBe(2500)
    })

    it("should exclude non-numeric fields from soil analysis (metadata and integers used for depth)", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result).not.toHaveProperty("a_id")
        expect(result).not.toHaveProperty("a_date")
        expect(result).not.toHaveProperty("a_source")
    })

    it("should use the first (most recent) soil analysis when multiple exist", async () => {
        const olderAnalysis: SoilAnalysis = {
            ...mockSoilAnalysis,
            a_id: "sa-old",
            b_soiltype_agr: "veen",
            a_som_loi: 99,
        }
        mockedGetField.mockResolvedValue(mockField)
        // getSoilAnalyses returns most-recent first (DESC by sampling date)
        mockedGetSoilAnalyses.mockResolvedValue([
            mockSoilAnalysis,
            olderAnalysis,
        ])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.b_soiltype_agr).toBe("dekzand") // from first (mockSoilAnalysis)
        expect(result.a_som_loi).toBe(4.5)
    })

    it("should omit b_soiltype_agr and b_gwl_class when no soil analyses exist", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.b_soiltype_agr).toBeUndefined()
        expect(result.b_gwl_class).toBeUndefined()
    })

    it("should map a cultivation with nl_ catalogue to { b_lu_brp, b_lu_year }", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([mockCultivation])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.cultivations).toEqual([
            { b_lu_brp: 266, b_lu_year: 2024 },
        ])
    })

    it("should skip cultivations with non-nl_ catalogue codes", async () => {
        const foreign: Cultivation = {
            ...mockCultivation,
            b_lu_catalogue: "de_12345",
        }
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([foreign])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.cultivations).toBeUndefined()
    })

    it("should skip cultivations where b_lu_start is null", async () => {
        const noStart: Cultivation = { ...mockCultivation, b_lu_start: null }
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([noStart])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.cultivations).toBeUndefined()
    })

    it("should skip cultivations where b_lu_start is null even when timeframe is provided", async () => {
        const noStart: Cultivation = { ...mockCultivation, b_lu_start: null }
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([noStart])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
            timeframe,
        )

        expect(result.cultivations).toBeUndefined()
    })

    it("should omit cultivations key entirely when no valid cultivations exist", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result).not.toHaveProperty("cultivations")
    })

    it("should map a bln_ measure to { measure_id, year }", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([mockMeasure])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.measures).toEqual([{ measure_id: "BM3", year: 2024 }])
    })

    it("should skip measures without the bln_ prefix", async () => {
        const nonBln: Measure = { ...mockMeasure, m_id: "other_BM3" }
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([nonBln])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.measures).toBeUndefined()
    })

    it("should skip measures where m_start is null and no timeframe is provided", async () => {
        const noStart: Measure = { ...mockMeasure, m_start: null }
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([noStart])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result.measures).toBeUndefined()
    })

    it("should use timeframe.end year as fallback when measure m_start is null", async () => {
        const noStart: Measure = { ...mockMeasure, m_start: null }
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([noStart])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
            timeframe,
        )

        expect(result.measures).toEqual([{ measure_id: "BM3", year: 2024 }])
    })

    it("should omit measures key entirely when no valid measures exist", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
        )

        expect(result).not.toHaveProperty("measures")
    })

    it("should combine all data sources in a full happy-path call", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
        mockedGetCultivations.mockResolvedValue([mockCultivation])
        mockedGetMeasures.mockResolvedValue([mockMeasure])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
            timeframe,
        )

        expect(result.a_lat).toBe(51.6)
        expect(result.a_lon).toBe(5.2)
        expect(result.b_soiltype_agr).toBe("dekzand")
        expect(result.b_gwl_class).toBe("IIb")
        expect(result.a_som_loi).toBe(4.5)
        expect(result.cultivations).toEqual([
            { b_lu_brp: 266, b_lu_year: 2024 },
        ])
        expect(result.measures).toEqual([{ measure_id: "BM3", year: 2024 }])
    })

    it("should wrap errors from fdm-core with a descriptive message", async () => {
        mockedGetField.mockRejectedValue(new Error("DB connection lost"))
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        await expect(
            collectInputForBln3Score(mockFdm, principal_id, b_id),
        ).rejects.toThrow(
            `Failed to collect BLN3 score inputs for field ${b_id}`,
        )
    })

    it("should pass the timeframe to soil and measures calls but NOT to cultivations", async () => {
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([])
        mockedGetMeasures.mockResolvedValue([])

        await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

        expect(mockedGetSoilAnalyses).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id,
            timeframe,
        )
        // Cultivations are fetched without timeframe to get the full history
        expect(mockedGetCultivations).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id,
        )
        expect(mockedGetMeasures).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id,
            timeframe,
        )
    })

    it("should assign years using the May 15–July 15 hoofdteelt rule, not b_lu_start year", async () => {
        // Grass sown Oct 15, 2024 — NOT the hoofdteelt for 2024 (sown after the window),
        // but IS the hoofdteelt for 2025 and 2026.
        const grass: Cultivation = {
            ...mockCultivation,
            b_lu_catalogue: "nl_265",
            b_lu_start: new Date("2024-10-15"),
            b_lu_end: null,
        }
        mockedGetField.mockResolvedValue(mockField)
        mockedGetSoilAnalyses.mockResolvedValue([])
        mockedGetCultivations.mockResolvedValue([grass])
        mockedGetMeasures.mockResolvedValue([])

        const result = await collectInputForBln3Score(
            mockFdm,
            principal_id,
            b_id,
            { start: new Date("2026-01-01"), end: new Date("2026-12-31") },
        )

        // 2024 excluded (grass starts Oct 2024, after the May-July window)
        // 2025 and 2026 included (grass covers the full May-July window)
        expect(result.cultivations).toEqual([
            { b_lu_brp: 265, b_lu_year: 2026 },
            { b_lu_brp: 265, b_lu_year: 2025 },
        ])
        expect(result.cultivations?.find((c) => c.b_lu_year === 2024)).toBeUndefined()
    })
})
