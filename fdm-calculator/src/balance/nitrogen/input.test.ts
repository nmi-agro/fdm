import type {
    Cultivation,
    CultivationCatalogue,
    FdmType,
    Fertilizer,
    FertilizerApplication,
    Field,
    fdmSchema,
    Harvest,
    PrincipalId,
    SoilAnalysis,
} from "@nmi-agro/fdm-core"
import {
    getCultivations,
    getCultivationsForFarm,
    getCultivationsFromCatalogue,
    getFertilizerApplications,
    getFertilizerApplicationsForFarm,
    getFertilizers,
    getField,
    getFields,
    getHarvests,
    getHarvestsForCultivations,
    getSoilAnalyses,
    getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectInputForNitrogenBalance } from "./input"
import { calculateAllFieldsNitrogenSupplyByDeposition } from "./supply/deposition"
import type {
    FieldInput,
    NitrogenBalanceInput,
    NitrogenSupplyDeposition,
} from "./types"

// Mock the @nmi-agro/fdm-core module
vi.mock("@nmi-agro/fdm-core", async () => {
    const actual = await vi.importActual("@nmi-agro/fdm-core")
    return {
        ...actual,
        getField: vi.fn(),
        getFields: vi.fn(),
        getCultivations: vi.fn(),
        getCultivationsForFarm: vi.fn(),
        getHarvests: vi.fn(),
        getHarvestsForCultivations: vi.fn(),
        getSoilAnalyses: vi.fn(),
        getSoilAnalysesForFarm: vi.fn(),
        getFertilizerApplications: vi.fn(),
        getFertilizerApplicationsForFarm: vi.fn(),
        getFertilizers: vi.fn(),
        getCultivationsFromCatalogue: vi.fn(),
    }
})

// Mock the deposition supply calculation
vi.mock("./supply/deposition", () => ({
    calculateAllFieldsNitrogenSupplyByDeposition: vi.fn(),
}))

// Import mocks after vi.mock call
const mockedGetField = vi.mocked(getField)
const mockedGetFields = vi.mocked(getFields)
const mockedGetCultivations = vi.mocked(getCultivations)
const mockedGetCultivationsForFarm = vi.mocked(getCultivationsForFarm)
const mockedGetHarvests = vi.mocked(getHarvests)
const mockedGetHarvestsForCultivations = vi.mocked(getHarvestsForCultivations)
const mockedGetSoilAnalyses = vi.mocked(getSoilAnalyses)
const mockedGetSoilAnalysesForFarm = vi.mocked(getSoilAnalysesForFarm)
const mockedGetFertilizerApplications = vi.mocked(getFertilizerApplications)
const mockedGetFertilizerApplicationsForFarm = vi.mocked(
    getFertilizerApplicationsForFarm,
)
const mockedGetFertilizers = vi.mocked(getFertilizers)
const mockedGetCultivationsFromCatalogue = vi.mocked(
    getCultivationsFromCatalogue,
)
const mockedCalculateAllFieldsNitrogenSupplyByDeposition = vi.mocked(
    calculateAllFieldsNitrogenSupplyByDeposition,
)

describe("collectInputForNitrogenBalance", () => {
    const mockFdm: FdmType = {
        // @ts-expect-error - we are mocking the transaction
        transaction: async (callback) => callback(mockFdm), // Simplified mock transaction
        // Add other FdmType properties if needed for type checking, or cast to any
    } as FdmType

    const principal_id: PrincipalId = "test-principal-id"
    const b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"] = "test-farm-id"
    const timeframe = {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
    }

    beforeEach(() => {
        vi.resetAllMocks()
    })

    it("should collect input successfully when all data is available", async () => {
        // Mock data
        const mockFieldsData: Field[] = [
            {
                b_id: "field-1",
                b_name: "Field 1",
                b_id_farm: "test-farm-id",
                b_id_source: "source-1",
                b_geometry: { type: "Polygon", coordinates: [] },
                b_centroid: [0, 0],
                b_area: 10,
                b_perimeter: 10,
                b_start: new Date("2023-01-01"),
                b_end: new Date("2023-12-31"),
                b_acquiring_method: "purchase",
                b_bufferstrip: false,
            },
            {
                b_id: "field-2",
                b_name: "Field 2",
                b_id_farm: "test-farm-id",
                b_id_source: "source-2",
                b_geometry: { type: "Polygon", coordinates: [] },
                b_centroid: [1, 1],
                b_area: 20,
                b_perimeter: 20,
                b_start: new Date("2023-01-01"),
                b_end: new Date("2023-12-31"),
                b_acquiring_method: "purchase",
                b_bufferstrip: false,
            },
        ]
        const mockCultivationsData: Cultivation[] = [
            {
                b_lu: "cult-1",
                b_lu_catalogue: "cat-cult-1",
                m_cropresidue: false,
                b_lu_start: new Date("2023-04-01"),
                b_lu_end: new Date("2023-09-01"),
                b_lu_source: "source",
                b_lu_name: "Cultivation 1",
                b_lu_name_en: "Cultivation 1",
                b_lu_hcat3: "hcat3",
                b_lu_hcat3_name: "Hcat3 Name",
                b_lu_croprotation: "maize",
                b_lu_eom: 1,
                b_lu_eom_residue: 1,
                b_lu_harvestcat: "HC010",
                b_lu_harvestable: "once",
                b_lu_variety: "variety",
                b_id: "field-1",
            },
        ]
        const mockHarvestsData: Harvest[] = [
            {
                b_id_harvesting: "harvest-1",
                b_lu: "cult-1",
                b_lu_harvest_date: new Date(),
                harvestable: {
                    b_id_harvestable: "h-1",
                    harvestable_analyses: [],
                },
            },
        ]
        const mockSoilAnalysesData = [
            {
                a_id: "sa-1",
                a_date: new Date(),
                a_depth_upper: 0,
                a_depth_lower: 30,
                a_source: "source",
                a_c_of: 25,
                a_cn_fr: 10,
                a_density_sa: 1.5,
                a_n_rt: 100,
                b_soiltype_agr: "SAND",
                b_sampling_date: new Date("2023-05-01"),
                a_som_loi: 5,
                b_gwl_class: "HIGH",
            },
        ] as unknown as SoilAnalysis[]
        const mockFertilizerApplicationsData: FertilizerApplication[] = [
            {
                b_id: "field-1",
                p_app_id: "fa-1",
                p_id_catalogue: "fert-1",
                p_name_nl: "test-product",
                p_app_amount: 100,
                p_app_method: "broadcasting", // match one of ApplicationMethods
                p_app_date: new Date(),
                p_id: "",
            },
        ]
        const mockFertilizerDetailsData = [
            {
                p_id: "fert-cat-1",
                p_n_rt: 5,
                p_type: "manure",
                p_no3_rt: 1,
                p_nh4_rt: 2,
                p_s_rt: 0,
                p_ef_nh3: 0.1,
            },
        ] as unknown as Fertilizer[]
        const mockCultivationDetailsData = [
            {
                b_lu_catalogue: "cat-cult-1",
                b_lu_croprotation: "maize",
                b_lu_yield: 5000,
                b_lu_hi: 0.45,
                b_lu_n_harvestable: 1.2,
                b_lu_n_residue: 0.8,
                b_n_fixation: 0,
            },
        ] as unknown as CultivationCatalogue[]
        const mockDepositionSupplyMap = new Map([
            ["field-1", { total: new Decimal(10) }],
            ["field-2", { total: new Decimal(20) }],
        ])

        // Setup mocks
        mockedGetFields.mockResolvedValue(mockFieldsData)
        mockedGetCultivationsForFarm.mockResolvedValue({
            "field-1": mockCultivationsData,
            "field-2": mockCultivationsData,
        })
        let cultivationIdsCapture: string[] | null = null
        mockedGetHarvestsForCultivations.mockImplementation(
            async (_fdm, _principal_id, cultivationIds) => {
                cultivationIdsCapture = cultivationIds
                return {
                    "cult-1": mockHarvestsData,
                    "cult-2": mockHarvestsData,
                }
            },
        ) // For simplicity, same harvests for all cultivations
        mockedGetSoilAnalysesForFarm.mockResolvedValue({
            "field-1": mockSoilAnalysesData,
            "field-2": mockSoilAnalysesData,
        })
        mockedGetFertilizerApplicationsForFarm.mockResolvedValue({
            "field-1": mockFertilizerApplicationsData,
            "field-2": mockFertilizerApplicationsData,
        })
        mockedGetFertilizers.mockResolvedValue(mockFertilizerDetailsData)
        mockedGetCultivationsFromCatalogue.mockResolvedValue(
            mockCultivationDetailsData,
        )
        mockedCalculateAllFieldsNitrogenSupplyByDeposition.mockResolvedValue(
            mockDepositionSupplyMap,
        )

        const result = await collectInputForNitrogenBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        const expectedFieldInputs: FieldInput[] = mockFieldsData.map(
            (fieldData) => ({
                field: fieldData,
                cultivations: mockCultivationsData,
                harvests: mockHarvestsData,
                soilAnalyses: mockSoilAnalysesData,
                fertilizerApplications: mockFertilizerApplicationsData,
                depositionSupply: mockDepositionSupplyMap.get(fieldData.b_id)!,
            }),
        )

        const expectedResult: NitrogenBalanceInput = {
            fields: expectedFieldInputs,
            fertilizerDetails: mockFertilizerDetailsData,
            cultivationDetails: mockCultivationDetailsData,
            timeFrame: timeframe,
        }

        expect(result).toEqual(expectedResult)

        // Verify calls
        expect(mockedGetFields).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )
        expect(mockedGetCultivationsForFarm).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )
        // For each cultivation, getHarvestsForCultivatiosn is called
        expect(mockedGetHarvestsForCultivations).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            cultivationIdsCapture,
            timeframe,
        )
        expect(cultivationIdsCapture).toHaveLength(1)
        expect(cultivationIdsCapture).toContain("cult-1")
        expect(mockedGetSoilAnalysesForFarm).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )
        expect(mockedGetFertilizerApplicationsForFarm).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )
        expect(mockedGetFertilizers).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
        )
        expect(mockedGetCultivationsFromCatalogue).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
        )
        expect(
            mockedCalculateAllFieldsNitrogenSupplyByDeposition,
        ).toHaveBeenCalledWith(expect.anything(), timeframe, expect.any(String))
    })

    it("should collect input successfully for a single field", async () => {
        // Mock data
        const mockFieldData: Field = {
            b_id: "field-1",
            b_name: "Field 1",
            b_id_farm: "test-farm-id",
            b_id_source: "source-1",
            b_geometry: { type: "Polygon", coordinates: [] },
            b_centroid: [0, 0],
            b_area: 10,
            b_perimeter: 10,
            b_start: new Date("2023-01-01"),
            b_end: new Date("2023-12-31"),
            b_acquiring_method: "purchase",
            b_bufferstrip: false,
        }
        const mockCultivationsData: Cultivation[] = [
            {
                b_lu: "cult-1",
                b_lu_catalogue: "cat-cult-1",
                m_cropresidue: false,
                b_lu_start: new Date("2023-04-01"),
                b_lu_end: new Date("2023-09-01"),
                b_lu_source: "source",
                b_lu_name: "Cultivation 1",
                b_lu_name_en: "Cultivation 1",
                b_lu_hcat3: "hcat3",
                b_lu_hcat3_name: "Hcat3 Name",
                b_lu_croprotation: "maize",
                b_lu_eom: 1,
                b_lu_eom_residue: 1,
                b_lu_harvestcat: "HC010",
                b_lu_harvestable: "once",
                b_lu_variety: "variety",
                b_id: "field-1",
            },
        ]
        const mockHarvestsData: Harvest[] = [
            {
                b_id_harvesting: "harvest-1",
                b_lu: "cult-1",
                b_lu_harvest_date: new Date(),
                harvestable: {
                    b_id_harvestable: "h-1",
                    harvestable_analyses: [],
                },
            },
        ]
        const mockSoilAnalysesData = [
            {
                a_id: "sa-1",
                a_date: new Date(),
                a_depth_upper: 0,
                a_depth_lower: 30,
                a_source: "source",
                a_c_of: 25,
                a_cn_fr: 10,
                a_density_sa: 1.5,
                a_n_rt: 100,
                b_soiltype_agr: "SAND",
                b_sampling_date: new Date("2023-05-01"),
                a_som_loi: 5,
                b_gwl_class: "HIGH",
            },
        ] as unknown as SoilAnalysis[]
        const mockFertilizerApplicationsData: FertilizerApplication[] = [
            {
                b_id: "field-1",
                p_app_id: "fa-1",
                p_id_catalogue: "fert-1",
                p_name_nl: "test-product",
                p_app_amount: 100,
                p_app_method: "broadcasting", // match one of ApplicationMethods
                p_app_date: new Date(),
                p_id: "",
            },
        ]
        const mockFertilizerDetailsData = [
            {
                p_id: "fert-cat-1",
                p_n_rt: 5,
                p_type: "manure",
                p_no3_rt: 1,
                p_nh4_rt: 2,
                p_s_rt: 0,
                p_ef_nh3: 0.1,
            },
        ] as unknown as Fertilizer[]
        const mockCultivationDetailsData = [
            {
                b_lu_catalogue: "cat-cult-1",
                b_lu_croprotation: "maize",
                b_lu_yield: 5000,
                b_lu_hi: 0.45,
                b_lu_n_harvestable: 1.2,
                b_lu_n_residue: 0.8,
                b_n_fixation: 0,
            },
        ] as unknown as CultivationCatalogue[]
        const mockDepositionSupplyMap = new Map([
            ["field-1", { total: new Decimal(10) }],
        ])

        // Setup mocks
        mockedGetField.mockResolvedValue(mockFieldData)
        mockedGetCultivations.mockResolvedValue(mockCultivationsData)
        mockedGetHarvests.mockResolvedValue(mockHarvestsData)
        mockedGetSoilAnalyses.mockResolvedValue(mockSoilAnalysesData)
        mockedGetFertilizerApplications.mockResolvedValue(
            mockFertilizerApplicationsData,
        )
        mockedGetFertilizers.mockResolvedValue(mockFertilizerDetailsData)
        mockedGetCultivationsFromCatalogue.mockResolvedValue(
            mockCultivationDetailsData,
        )
        mockedCalculateAllFieldsNitrogenSupplyByDeposition.mockResolvedValue(
            mockDepositionSupplyMap,
        )

        const result = await collectInputForNitrogenBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
            "field-1",
        )

        const expectedFieldInputs: FieldInput[] = [
            {
                field: mockFieldData,
                cultivations: mockCultivationsData,
                harvests: mockHarvestsData,
                soilAnalyses: mockSoilAnalysesData,
                fertilizerApplications: mockFertilizerApplicationsData,
                depositionSupply: mockDepositionSupplyMap.get(
                    mockFieldData.b_id,
                )!,
            },
        ]

        const expectedResult: NitrogenBalanceInput = {
            fields: expectedFieldInputs,
            fertilizerDetails: mockFertilizerDetailsData,
            cultivationDetails: mockCultivationDetailsData,
            timeFrame: timeframe,
        }

        expect(result).toEqual(expectedResult)

        // Verify calls
        expect(mockedGetField).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            "field-1",
        )
        expect(mockedGetCultivations).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            "field-1",
            timeframe,
        )
        // For each cultivation, getHarvestsForCultivatiosn is called
        expect(mockedGetHarvests).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            "cult-1",
            timeframe,
        )
        expect(mockedGetSoilAnalyses).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            "field-1",
            timeframe,
        )
        expect(mockedGetFertilizerApplications).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            "field-1",
            timeframe,
        )
        expect(mockedGetFertilizers).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
        )
        expect(mockedGetCultivationsFromCatalogue).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
        )
        expect(
            mockedCalculateAllFieldsNitrogenSupplyByDeposition,
        ).toHaveBeenCalledWith(expect.anything(), timeframe, expect.any(String))
    })

    it("should handle cultivation with no harvests", () => {
        // Mock data
        const mockFieldsData: Field[] = [
            {
                b_id: "field-1",
                b_name: "Field 1",
                b_id_farm: "test-farm-id",
                b_id_source: "source-1",
                b_geometry: { type: "Polygon", coordinates: [] },
                b_centroid: [0, 0],
                b_area: 10,
                b_perimeter: 10,
                b_start: new Date("2023-01-01"),
                b_end: new Date("2023-12-31"),
                b_acquiring_method: "purchase",
                b_bufferstrip: false,
            },
        ]
        const mockCultivationsData: Cultivation[] = [
            {
                b_lu: "cult-1",
                b_lu_catalogue: "cat-cult-1",
                m_cropresidue: false,
                b_lu_start: new Date("2023-04-01"),
                b_lu_end: new Date("2023-09-01"),
                b_lu_source: "source",
                b_lu_name: "Cultivation 1",
                b_lu_name_en: "Cultivation 1",
                b_lu_hcat3: "hcat3",
                b_lu_hcat3_name: "Hcat3 Name",
                b_lu_croprotation: "maize",
                b_lu_eom: 1,
                b_lu_eom_residue: 1,
                b_lu_harvestcat: "HC010",
                b_lu_harvestable: "once",
                b_lu_variety: "variety",
                b_id: "field-1",
            },
        ]
        const mockDepositionSupplyMap = new Map([
            ["field-1", { total: new Decimal(10) }],
        ])

        mockedGetFields.mockResolvedValue(mockFieldsData)
        mockedGetFertilizers.mockResolvedValue([])
        mockedGetCultivationsFromCatalogue.mockResolvedValue([])
        mockedGetCultivationsForFarm.mockResolvedValue({
            "field-1": mockCultivationsData,
        })
        mockedGetHarvestsForCultivations.mockResolvedValue({})
        mockedGetFertilizerApplicationsForFarm.mockResolvedValue({})
        mockedGetSoilAnalysesForFarm.mockResolvedValue({})
        mockedCalculateAllFieldsNitrogenSupplyByDeposition.mockResolvedValue(
            mockDepositionSupplyMap,
        )

        const timeFrame = {
            start: new Date("2023-01-03"),
            end: new Date("2023-12-31"),
        }

        expect(
            collectInputForNitrogenBalance(
                mockFdm,
                principal_id,
                b_id_farm,
                timeFrame,
            ),
        ).resolves.toEqual({
            fields: mockFieldsData.map((field) => ({
                field: field,
                cultivations: mockCultivationsData,
                harvests: [],
                fertilizerApplications: [],
                soilAnalyses: [],
                depositionSupply: mockDepositionSupplyMap.get(
                    field.b_id,
                ) as NitrogenSupplyDeposition,
            })),
            fertilizerDetails: [],
            cultivationDetails: [],
            timeFrame: timeFrame,
        } satisfies NitrogenBalanceInput)
    })

    it("should throw an error if getFields fails", async () => {
        const errorMessage = "Failed to get fields"
        mockedGetFields.mockRejectedValue(new Error(errorMessage))

        await expect(
            collectInputForNitrogenBalance(
                mockFdm,
                principal_id,
                b_id_farm,
                timeframe,
            ),
        ).rejects.toThrow(errorMessage)
    })

    it("should throw an error if getCultivationsForFarm fails for a field", async () => {
        const mockFieldsData: Field[] = [
            {
                b_id: "field-1",
                b_name: "Field 1",
                b_id_farm: "test-farm-id",
                b_id_source: "source-1",
                b_geometry: { type: "Polygon", coordinates: [] },
                b_centroid: [0, 0],
                b_area: 10,
                b_perimeter: 10,
                b_start: new Date("2023-01-01"),
                b_end: new Date("2023-12-31"),
                b_acquiring_method: "purchase",
                b_bufferstrip: false,
            },
        ]
        mockedGetFields.mockResolvedValue(mockFieldsData)

        const errorMessage = "Failed to get cultivations"
        mockedGetCultivationsForFarm.mockRejectedValue(new Error(errorMessage))

        await expect(
            collectInputForNitrogenBalance(
                mockFdm,
                principal_id,
                b_id_farm,
                timeframe,
            ),
        ).rejects.toThrow(errorMessage)
    })

    it("should throw an error if fdm.transaction fails", async () => {
        const errorMessage = "Transaction failed"
        const mockFdmError: FdmType = {
            ...mockFdm,
            transaction: vi.fn().mockRejectedValue(new Error(errorMessage)),
        }

        await expect(
            collectInputForNitrogenBalance(
                mockFdmError,
                principal_id,
                b_id_farm,
                timeframe,
            ),
        ).rejects.toThrow(errorMessage)
    })

    it("should handle empty arrays from core functions correctly", async () => {
        mockedGetFields.mockResolvedValue([])
        mockedGetFertilizers.mockResolvedValue([])
        mockedGetCultivationsFromCatalogue.mockResolvedValue([])

        const result = await collectInputForNitrogenBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        const expectedResult: NitrogenBalanceInput = {
            fields: [],
            fertilizerDetails: [],
            cultivationDetails: [],
            timeFrame: timeframe,
        }

        expect(result).toEqual(expectedResult)
        expect(mockedGetFields).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )
        expect(mockedGetFertilizers).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
        )
        expect(mockedGetCultivationsFromCatalogue).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
        )
        // Ensure other calls that depend on fields are not made
        expect(mockedGetCultivationsForFarm).not.toHaveBeenCalled()
        expect(mockedGetHarvestsForCultivations).not.toHaveBeenCalled()
        expect(mockedGetSoilAnalysesForFarm).not.toHaveBeenCalled()
        expect(mockedGetFertilizerApplicationsForFarm).not.toHaveBeenCalled()
    })
})
