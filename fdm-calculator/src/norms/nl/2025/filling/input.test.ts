import type {
    Cultivation,
    FdmType,
    Fertilizer,
    FertilizerApplication,
    Field,
} from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectNL2025InputForFertilizerApplicationFilling } from "./input"
import type { NL2025NormsFillingInput } from "./types"

// Mock the entire @nmi-agro/fdm-core module
vi.mock("@nmi-agro/fdm-core", () => ({
    getField: vi.fn(),
    getGrazingIntention: vi.fn(),
    isOrganicCertificationValid: vi.fn(),
    getCultivations: vi.fn(),
    getFertilizerApplications: vi.fn(),
    getFertilizers: vi.fn(),
}))

// Import the mocked functions
import {
    getCultivations,
    getFertilizerApplications,
    getFertilizers,
    getField,
    getGrazingIntention,
    isOrganicCertificationValid,
} from "@nmi-agro/fdm-core"

describe("collectNL2025InputForFertilizerApplicationFilling", () => {
    const mockFdm = {} as FdmType
    const mockPrincipalId = "principal123"
    const mockFieldId = "field456"
    const mockFosfaatgebruiksnorm = 100

    beforeEach(() => {
        // Reset all mocks before each test
        vi.clearAllMocks()

        // Set up default mock implementations for a successful scenario
        vi.mocked(getField).mockResolvedValue({
            b_id: mockFieldId,
            b_id_farm: "farm789",
            b_centroid: [10, 20],
            // Add other necessary Field properties
        } as Field)
        vi.mocked(getGrazingIntention).mockResolvedValue(true)
        vi.mocked(isOrganicCertificationValid).mockResolvedValue(false)
        vi.mocked(getCultivations).mockResolvedValue([
            {
                b_lu: "cult1",
                b_lu_start: new Date(2025, 0, 1),
                b_lu_end: new Date(2025, 5, 1),
                b_lu_catalogue: "nl_2014",
            },
        ] as unknown as Cultivation[])
        vi.mocked(getFertilizerApplications).mockResolvedValue([
            { p_app_id: "app1", p_id_catalogue: "fert1", p_app_amount: 1000 },
        ] as FertilizerApplication[])
        vi.mocked(getFertilizers).mockResolvedValue([
            { p_id: "fert1", p_n_rt: 5, p_type_rvo: "115" },
        ] as unknown as Fertilizer[])
    })

    it("should successfully collect all input data for a valid scenario", async () => {
        const expectedB_centroid: [number, number] = [10, 20]
        const expectedCultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date(2025, 0, 1),
                b_lu_end: new Date(2025, 5, 1),
                b_lu_catalogue: "nl_2014",
            },
        ]
        const expectedApplications: FertilizerApplication[] = [
            {
                p_app_id: "app1",
                p_id_catalogue: "fert1",
                p_app_amount: 1000,
            } as FertilizerApplication,
        ]
        const expectedFertilizers: Fertilizer[] = [
            { p_id: "fert1", p_n_rt: 5, p_type_rvo: "115" },
        ] as unknown as Fertilizer[]

        const result = await collectNL2025InputForFertilizerApplicationFilling(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
            mockFosfaatgebruiksnorm,
        )

        // Assert that all fdm-core functions were called with the correct arguments
        expect(getField).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
        )
        expect(getGrazingIntention).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "farm789",
            2025,
        )
        expect(isOrganicCertificationValid).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "farm789",
            new Date(2025, 4, 15),
        )
        expect(getCultivations).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
            {
                start: new Date(2025, 0, 1),
                end: new Date(2025, 11, 31, 23, 59, 59, 999),
            },
        )
        expect(getFertilizerApplications).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "field456",
            {
                start: new Date(2025, 0, 1),
                end: new Date(2025, 11, 31, 23, 59, 59, 999),
            },
        )
        expect(getFertilizers).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "farm789",
        )

        // Assert the structure and content of the returned NL2025NormsFillingInput object
        expect(result).toEqual({
            cultivations: expectedCultivations,
            applications: expectedApplications,
            fertilizers: expectedFertilizers,
            has_organic_certification: false,
            has_grazing_intention: true,
            fosfaatgebruiksnorm: mockFosfaatgebruiksnorm,
            b_centroid: expectedB_centroid,
        } as NL2025NormsFillingInput)
    })

    it("should throw an error if the field is not found", async () => {
        vi.mocked(getField).mockResolvedValue(null as unknown as Field) // Simulate field not found

        await expect(
            collectNL2025InputForFertilizerApplicationFilling(
                mockFdm,
                mockPrincipalId,
                mockFieldId,
                mockFosfaatgebruiksnorm,
            ),
        ).rejects.toThrow(
            `Field with id ${mockFieldId} not found for principal ${mockPrincipalId}`,
        )
    })

    // Add more tests for edge cases and different scenarios as needed
    // For example:
    // - No cultivations
    // - No applications
    // - No fertilizers
    // - Different grazing intention / organic certification status
    // - Empty b_centroid (if getField returns a field without centroid, though current mock ensures it has one)
})
