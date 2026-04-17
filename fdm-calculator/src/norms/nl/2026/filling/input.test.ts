import type {
    BaseFertilizerApplication,
    Cultivation,
    FdmType,
    Fertilizer,
    FertilizerApplication,
    Field,
} from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    collectNL2026InputForFertilizerApplicationFilling,
    collectNL2026InputForFertilizerApplicationFillingForFarm,
} from "./input"
import type { NL2026NormsFillingInput } from "./types"

// Mock the entire @nmi-agro/fdm-core module
vi.mock("@nmi-agro/fdm-core", () => ({
    getField: vi.fn(),
    getFields: vi.fn(),
    getGrazingIntention: vi.fn(),
    isOrganicCertificationValid: vi.fn(),
    getCultivations: vi.fn(),
    getCultivationsForFarm: vi.fn(),
    getFertilizerApplications: vi.fn(),
    getFertilizerApplicationsForFarm: vi.fn(),
    getFertilizers: vi.fn(),
}))

// Import the mocked functions
import {
    getCultivations,
    getCultivationsForFarm,
    getFertilizerApplications,
    getFertilizerApplicationsForFarm,
    getFertilizers,
    getField,
    getFields,
    getGrazingIntention,
    isOrganicCertificationValid,
} from "@nmi-agro/fdm-core"

describe("collectNL2026InputForFertilizerApplicationFilling", () => {
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
                b_lu_start: new Date(2026, 0, 1),
                b_lu_end: new Date(2026, 5, 1),
                b_lu_catalogue: "nl_2014",
            },
        ] as unknown as Cultivation[])
        vi.mocked(getFertilizerApplications).mockResolvedValue([
            { p_app_id: "app1", p_id_catalogue: "fert1", p_app_amount: 1000 },
        ] as FertilizerApplication[])
        vi.mocked(getFertilizers).mockResolvedValue([
            { p_id: "fert1", p_n_rt: 5, p_type_rvo: "115" },
        ] as Fertilizer[])
    })

    it("should successfully collect all input data for a valid scenario", async () => {
        const expectedB_centroid: [number, number] = [10, 20]
        const expectedCultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date(2026, 0, 1),
                b_lu_end: new Date(2026, 5, 1),
                b_lu_catalogue: "nl_2014",
            },
        ]
        const expectedApplications: BaseFertilizerApplication[] = [
            {
                p_app_id: "app1",
                p_id_catalogue: "fert1",
                p_app_amount: 1000,
            } as BaseFertilizerApplication,
        ]
        const expectedFertilizers: Fertilizer[] = [
            {
                p_id: "fert1",
                p_n_rt: 5,
                p_type_rvo: "115",
            } as Fertilizer,
        ]

        const result = await collectNL2026InputForFertilizerApplicationFilling(
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
            2026,
        )
        expect(isOrganicCertificationValid).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "farm789",
            new Date(2026, 4, 15),
        )
        expect(getCultivations).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFieldId,
            {
                start: new Date(2026, 0, 1),
                end: new Date(2026, 11, 31, 23, 59, 59, 999),
            },
        )
        expect(getFertilizerApplications).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "field456",
            {
                start: new Date(2026, 0, 1),
                end: new Date(2026, 11, 31, 23, 59, 59, 999),
            },
        )
        expect(getFertilizers).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            "farm789",
        )

        // Assert the structure and content of the returned NL2026NormsFillingInput object
        expect(result).toEqual({
            cultivations: expectedCultivations,
            applications: expectedApplications,
            fertilizers: expectedFertilizers,
            has_organic_certification: false,
            has_grazing_intention: true,
            fosfaatgebruiksnorm: mockFosfaatgebruiksnorm,
            b_centroid: expectedB_centroid,
        } as NL2026NormsFillingInput)
    })

    it("should throw an error if the field is not found", async () => {
        // @ts-expect-error
        vi.mocked(getField).mockResolvedValue(null) // Simulate field not found

        await expect(
            collectNL2026InputForFertilizerApplicationFilling(
                mockFdm,
                mockPrincipalId,
                mockFieldId,
                mockFosfaatgebruiksnorm,
            ),
        ).rejects.toThrow(
            `Field with id ${mockFieldId} not found for principal ${mockPrincipalId}`,
        )
    })
})

describe("collectNL2026InputForFertilizerApplicationFillingForFarm", () => {
    const mockFdm = {} as FdmType
    const mockPrincipalId = "principal123"
    const mockFarmId = "farm789"
    const mockFieldId = "field456"

    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(getFields).mockResolvedValue([
            {
                b_id: mockFieldId,
                b_id_farm: mockFarmId,
                b_centroid: [10, 20],
            } as Field,
        ])
        vi.mocked(getGrazingIntention).mockResolvedValue(false)
        vi.mocked(isOrganicCertificationValid).mockResolvedValue(true)
        vi.mocked(getFertilizers).mockResolvedValue([
            { p_id: "fert1", p_n_rt: 5 },
        ] as unknown as Fertilizer[])
        vi.mocked(getCultivationsForFarm).mockResolvedValue(
            new Map([[mockFieldId, [{ b_lu: "cult1" }] as Cultivation[]]]),
        )
        vi.mocked(getFertilizerApplicationsForFarm).mockResolvedValue(
            new Map([
                [
                    mockFieldId,
                    [
                        { p_app_id: "app1", p_app_amount: 1000 },
                    ] as FertilizerApplication[],
                ],
            ]),
        )
    })

    it("should collect farm filling input correctly", async () => {
        const fosfaatgebruiksnormByField = new Map([[mockFieldId, 120]])

        const result =
            await collectNL2026InputForFertilizerApplicationFillingForFarm(
                mockFdm,
                mockPrincipalId,
                mockFarmId,
                fosfaatgebruiksnormByField,
            )

        expect(result).toBeInstanceOf(Map)
        expect(result.has(mockFieldId)).toBe(true)
        const fieldInput = result.get(mockFieldId)!
        expect(fieldInput.has_grazing_intention).toBe(false)
        expect(fieldInput.has_organic_certification).toBe(true)
        expect(fieldInput.fosfaatgebruiksnorm).toBe(120)
        expect(fieldInput.cultivations).toHaveLength(1)
        expect(fieldInput.applications).toHaveLength(1)
        expect(fieldInput.b_centroid).toEqual([10, 20])
        expect(fieldInput.fertilizers).toHaveLength(1)

        const timeframe2026 = {
            start: new Date(2026, 0, 1),
            end: new Date(2026, 11, 31, 23, 59, 59, 999),
        }
        expect(getFields).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFarmId,
        )
        expect(getCultivationsForFarm).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFarmId,
            timeframe2026,
        )
        expect(getFertilizerApplicationsForFarm).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFarmId,
            timeframe2026,
        )
    })

    it("should handle multiple fields with independent fosfaatgebruiksnorm values", async () => {
        const mockFieldId2 = "field789"
        vi.mocked(getFields).mockResolvedValue([
            {
                b_id: mockFieldId,
                b_id_farm: mockFarmId,
                b_centroid: [10, 20],
            } as Field,
            {
                b_id: mockFieldId2,
                b_id_farm: mockFarmId,
                b_centroid: [11, 21],
            } as Field,
        ])
        vi.mocked(getCultivationsForFarm).mockResolvedValue(
            new Map([
                [mockFieldId, [{ b_lu: "cult1" }] as Cultivation[]],
                [mockFieldId2, [{ b_lu: "cult2" }] as Cultivation[]],
            ]),
        )
        vi.mocked(getFertilizerApplicationsForFarm).mockResolvedValue(
            new Map([
                [
                    mockFieldId,
                    [
                        { p_app_id: "app1", p_app_amount: 500 },
                    ] as FertilizerApplication[],
                ],
                [
                    mockFieldId2,
                    [
                        { p_app_id: "app2", p_app_amount: 800 },
                    ] as FertilizerApplication[],
                ],
            ]),
        )

        const fosfaatgebruiksnormByField = new Map([
            [mockFieldId, 80],
            [mockFieldId2, 95],
        ])

        const result =
            await collectNL2026InputForFertilizerApplicationFillingForFarm(
                mockFdm,
                mockPrincipalId,
                mockFarmId,
                fosfaatgebruiksnormByField,
            )

        expect(result.size).toBe(2)
        expect(result.get(mockFieldId)?.fosfaatgebruiksnorm).toBe(80)
        expect(result.get(mockFieldId2)?.fosfaatgebruiksnorm).toBe(95)
    })

    it("should default to empty arrays when farm maps have no entry for a field", async () => {
        vi.mocked(getCultivationsForFarm).mockResolvedValue(new Map())
        vi.mocked(getFertilizerApplicationsForFarm).mockResolvedValue(new Map())

        const fosfaatgebruiksnormByField = new Map([[mockFieldId, 60]])

        const result =
            await collectNL2026InputForFertilizerApplicationFillingForFarm(
                mockFdm,
                mockPrincipalId,
                mockFarmId,
                fosfaatgebruiksnormByField,
            )

        const fieldInput = result.get(mockFieldId)!
        expect(fieldInput.cultivations).toEqual([])
        expect(fieldInput.applications).toEqual([])
        expect(fieldInput.has_grazing_intention).toBe(false)
        expect(fieldInput.has_organic_certification).toBe(true)
        expect(getFields).toHaveBeenCalledWith(
            mockFdm,
            mockPrincipalId,
            mockFarmId,
        )
        expect(getCultivationsForFarm).toHaveBeenCalled()
        expect(getFertilizerApplicationsForFarm).toHaveBeenCalled()
    })
})
