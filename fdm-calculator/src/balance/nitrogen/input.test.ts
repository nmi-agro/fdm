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
    getCultivationsOfFarmsFromCatalogue,
    getFertilizerApplications,
    getFertilizersOfFarms,
    getFields,
    getHarvests,
    getSoilAnalyses,
} from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    collectInputForNitrogenBalance,
    collectInputForNitrogenBalanceForFarms,
} from "./input"
import { calculateAllFieldsNitrogenSupplyByDeposition } from "./supply/deposition"
import type { FieldInput, NitrogenBalanceInput } from "./types"

// Mock the @nmi-agro/fdm-core module
vi.mock("@nmi-agro/fdm-core", async () => {
    const actual = await vi.importActual("@nmi-agro/fdm-core")
    return {
        ...actual,
        getFields: vi.fn(),
        getCultivations: vi.fn(),
        getHarvests: vi.fn(),
        getSoilAnalyses: vi.fn(),
        getFertilizerApplications: vi.fn(),
        getFertilizersOfFarms: vi.fn(),
        getCultivationsFromCatalogue: vi.fn(),
        getCultivationsOfFarmsFromCatalogue: vi.fn(),
    }
})

// Mock the deposition supply calculation
vi.mock("./supply/deposition", () => ({
    calculateAllFieldsNitrogenSupplyByDeposition: vi.fn(),
}))

// Import mocks after vi.mock call
const mockedGetFields = vi.mocked(getFields)
const mockedGetCultivations = vi.mocked(getCultivations)
const mockedGetHarvests = vi.mocked(getHarvests)
const mockedGetSoilAnalyses = vi.mocked(getSoilAnalyses)
const mockedGetFertilizerApplications = vi.mocked(getFertilizerApplications)
const mockedGetFertilizersOfFarms = vi.mocked(getFertilizersOfFarms)
const mockedCalculateAllFieldsNitrogenSupplyByDeposition = vi.mocked(
    calculateAllFieldsNitrogenSupplyByDeposition,
)
const mockedGetCultivationsOfFarmsFromCatalogue = vi.mocked(
    getCultivationsOfFarmsFromCatalogue,
)

function createMockData() {
    return {
        // Mock data
        mockFieldsData: [
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
        ] as Field[],
        mockCultivationsData: [
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
                b_id: "cult-1",
            },
        ] as Cultivation[],
        mockCultivationsData2: [
            {
                b_lu: "cult-2",
                b_lu_catalogue: "cat-cult-2",
                m_cropresidue: false,
                b_lu_start: new Date("2023-04-01"),
                b_lu_end: new Date("2023-09-01"),
                b_lu_source: "source",
                b_lu_name: "Cultivation 2",
                b_lu_name_en: "Cultivation 2",
                b_lu_hcat3: "hcat3",
                b_lu_hcat3_name: "Hcat3 Name",
                b_lu_croprotation: "maize",
                b_lu_eom: 1,
                b_lu_eom_residue: 1,
                b_lu_harvestcat: "HC010",
                b_lu_harvestable: "once",
                b_lu_variety: "variety",
                b_id: "cult-2",
            },
        ] as Cultivation[],
        mockHarvestsData: [
            {
                b_id_harvesting: "harvest-1",
                b_lu: "cult-1",
                b_lu_harvest_date: new Date(),
                harvestable: {
                    b_id_harvestable: "h-1",
                    harvestable_analyses: [],
                },
            },
        ] as Harvest[],
        mockSoilAnalysesData: [
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
        ] as SoilAnalysis[],
        mockFertilizerApplicationsData: [
            {
                p_app_id: "fa-1",
                p_id_catalogue: "fert-1",
                p_name_nl: "test-product",
                p_app_amount: 100,
                p_app_method: "broadcasting", // match one of ApplicationMethods
                p_app_date: new Date(),
                p_id: "",
            },
        ] as FertilizerApplication[],
        mockFertilizerApplicationsData2: [
            {
                p_app_id: "fa-2",
                p_id_catalogue: "fert-2",
                p_name_nl: "test-product",
                p_app_amount: 100,
                p_app_method: "broadcasting", // match one of ApplicationMethods
                p_app_date: new Date(),
                p_id: "",
            },
        ] as FertilizerApplication[],
        mockFertilizerDetailsData: [
            {
                p_id: "fert-cat-1",
                p_n_rt: 5,
                p_type: "manure",
                p_no3_rt: 1,
                p_nh4_rt: 2,
                p_s_rt: 0,
                p_ef_nh3: 0.1,
            },
        ] as Fertilizer[],
        mockFertilizerDetailsData2: [
            {
                p_id: "fert-cat-2",
                p_n_rt: 5,
                p_type: "manure",
                p_no3_rt: 1,
                p_nh4_rt: 2,
                p_s_rt: 0,
                p_ef_nh3: 0.1,
            },
        ] as Fertilizer[],
        mockCultivationDetailsData: [
            {
                b_lu_catalogue: "cat-cult-1",
                b_lu_croprotation: "maize",
                b_lu_yield: 5000,
                b_lu_hi: 0.45,
                b_lu_n_harvestable: 1.2,
                b_lu_n_residue: 0.8,
                b_n_fixation: 0,
            },
        ] as CultivationCatalogue[],
        mockCultivationDetailsData2: [
            {
                b_lu_catalogue: "cat-cult-2",
                b_lu_croprotation: "cereal",
                b_lu_yield: 5000,
                b_lu_hi: 0.45,
                b_lu_n_harvestable: 1.2,
                b_lu_n_residue: 0.8,
                b_n_fixation: 0,
            },
        ] as CultivationCatalogue[],
        mockDepositionSupplyMap: new Map([
            ["field-1", { total: new Decimal(10) }],
            ["field-2", { total: new Decimal(20) }],
        ]),
    }
}
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
        // Setup mocks
        const {
            mockFieldsData,
            mockCultivationsData,
            mockHarvestsData,
            mockSoilAnalysesData,
            mockFertilizerApplicationsData,
            mockFertilizerDetailsData,
            mockCultivationDetailsData,
            mockDepositionSupplyMap,
        } = createMockData()
        mockedGetFields.mockResolvedValue(mockFieldsData)
        mockedGetCultivations.mockResolvedValue(mockCultivationsData)
        mockedGetHarvests.mockResolvedValue(mockHarvestsData) // For simplicity, same harvests for all cultivations
        mockedGetSoilAnalyses.mockResolvedValue(mockSoilAnalysesData)
        mockedGetFertilizerApplications.mockResolvedValue(
            mockFertilizerApplicationsData,
        )
        const allFertilizerDetails = mockFertilizerDetailsData.map((fert) => ({
            ...fert,
            b_id_farm: "test-farm-id",
        }))
        mockedGetFertilizersOfFarms.mockResolvedValue(allFertilizerDetails)
        mockedGetCultivationsOfFarmsFromCatalogue.mockResolvedValue(
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
                depositionSupply: mockDepositionSupplyMap.get(
                    fieldData.b_id,
                ) as { total: Decimal },
            }),
        )

        const expectedResult: NitrogenBalanceInput & { b_id_farm?: string } = {
            b_id_farm: b_id_farm,
            fields: expectedFieldInputs,
            fertilizerDetails: allFertilizerDetails,
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
        for (const field of mockFieldsData) {
            expect(mockedGetCultivations).toHaveBeenCalledWith(
                mockFdm,
                principal_id,
                field.b_id,
                timeframe,
            )
            // For each cultivation, getHarvests is called
            for (const cultivation of mockCultivationsData) {
                expect(mockedGetHarvests).toHaveBeenCalledWith(
                    mockFdm,
                    principal_id,
                    cultivation.b_lu,
                    timeframe,
                )
            }
            expect(mockedGetSoilAnalyses).toHaveBeenCalledWith(
                mockFdm,
                principal_id,
                field.b_id,
                timeframe,
            )
            expect(mockedGetFertilizerApplications).toHaveBeenCalledWith(
                mockFdm,
                principal_id,
                field.b_id,
                timeframe,
            )
        }
        expect(mockedGetFertilizersOfFarms).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            [b_id_farm],
            true,
        )
        expect(mockedGetCultivationsOfFarmsFromCatalogue).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            [b_id_farm],
        )
        expect(
            mockedCalculateAllFieldsNitrogenSupplyByDeposition,
        ).toHaveBeenCalledWith(expect.anything(), timeframe, expect.any(String))
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

    it("should throw an error if getCultivations fails for a field", async () => {
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
        mockedGetCultivations.mockRejectedValue(new Error(errorMessage))

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
        mockedGetFertilizersOfFarms.mockResolvedValue([])
        mockedGetCultivationsOfFarmsFromCatalogue.mockResolvedValue([])

        const result = await collectInputForNitrogenBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        const expectedResult: NitrogenBalanceInput & { b_id_farm?: string } = {
            b_id_farm: "test-farm-id",
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
        expect(mockedGetFertilizersOfFarms).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            [b_id_farm],
            true,
        )
        expect(mockedGetCultivationsOfFarmsFromCatalogue).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            [b_id_farm],
        )
        // Ensure other calls that depend on fields are not made
        expect(mockedGetCultivations).not.toHaveBeenCalled()
        expect(mockedGetHarvests).not.toHaveBeenCalled()
        expect(mockedGetSoilAnalyses).not.toHaveBeenCalled()
        expect(mockedGetFertilizerApplications).not.toHaveBeenCalled()
    })
})

describe("collectInputForNitrogenBalanceForFarms", () => {
    const mockFdm: FdmType = {
        // @ts-expect-error - we are mocking the transaction
        transaction: async (callback) => callback(mockFdm), // Simplified mock transaction
        // Add other FdmType properties if needed for type checking, or cast to any
    } as FdmType

    const principal_id: PrincipalId = "test-principal-id"
    const timeframe = {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
    }

    beforeEach(() => {
        vi.resetAllMocks()
    })

    it("should collect cultivation details only once", async () => {
        // Setup mocks
        const {
            mockFieldsData,
            mockCultivationsData,
            mockCultivationsData2,
            mockHarvestsData,
            mockSoilAnalysesData,
            mockFertilizerApplicationsData,
            mockFertilizerApplicationsData2,
            mockFertilizerDetailsData,
            mockCultivationDetailsData,
            mockCultivationDetailsData2,
            mockDepositionSupplyMap,
        } = createMockData()
        const mockFieldsData2 = mockFieldsData.map((field) => ({
            ...field,
            b_id: `2-${field.b_id}`,
            b_id_farm: "test-farm-id-2",
        }))

        // Setup mocks
        mockedGetFields.mockImplementation(async (_1, _2, b_id_farm) =>
            b_id_farm === "test-farm-id-2" ? mockFieldsData2 : mockFieldsData,
        )
        mockedGetCultivations.mockImplementation(async (_1, _2, b_id) =>
            b_id.startsWith("2-")
                ? mockCultivationsData2
                : mockCultivationsData,
        )
        mockedGetHarvests.mockResolvedValue(mockHarvestsData) // For simplicity, same harvests for all cultivations
        mockedGetSoilAnalyses.mockResolvedValue(mockSoilAnalysesData)
        mockedGetFertilizerApplications.mockImplementation(
            async (_1, _2, b_id) =>
                b_id.startsWith("2-")
                    ? mockFertilizerApplicationsData2
                    : mockFertilizerApplicationsData,
        )
        const fertData1 = mockFertilizerDetailsData.map((fert) => ({
            ...fert,
            b_id_farm: "test-farm-id",
        }))
        const fertData2 = mockFertilizerDetailsData.map((fert) => ({
            ...fert,
            b_id_farm: "test-farm-id-2",
        }))
        const allFertilizerDetails = [...fertData1, ...fertData2]
        mockedGetFertilizersOfFarms.mockResolvedValue(allFertilizerDetails)
        const combinedCultivationDetails = [
            ...mockCultivationDetailsData,
            ...mockCultivationDetailsData2,
        ]
        mockedGetCultivationsOfFarmsFromCatalogue.mockResolvedValue(
            combinedCultivationDetails,
        )
        mockedCalculateAllFieldsNitrogenSupplyByDeposition.mockResolvedValue(
            mockDepositionSupplyMap,
        )

        const result = await collectInputForNitrogenBalanceForFarms(
            mockFdm,
            principal_id,
            ["test-farm-id", "test-farm-id-2"],
            timeframe,
        )

        const makeFieldInput = (
            fieldData: Field,
            fertilizerApplications: FertilizerApplication[],
            cultivations: Cultivation[],
        ) => ({
            field: fieldData,
            cultivations: cultivations,
            harvests: mockHarvestsData,
            soilAnalyses: mockSoilAnalysesData,
            fertilizerApplications: fertilizerApplications,
            depositionSupply: mockDepositionSupplyMap.get(fieldData.b_id) as {
                total: Decimal
            },
        })
        const expectedFieldInputs: FieldInput[] = mockFieldsData.map(
            (fieldData) =>
                makeFieldInput(
                    fieldData,
                    mockFertilizerApplicationsData,
                    mockCultivationsData,
                ),
        )
        const expectedFieldInputs2: FieldInput[] = mockFieldsData2.map(
            (fieldData) =>
                makeFieldInput(
                    fieldData,
                    mockFertilizerApplicationsData2,
                    mockCultivationsData2,
                ),
        )

        const expectedResult: (NitrogenBalanceInput & {
            b_id_farm?: string
        })[] = [
            {
                b_id_farm: "test-farm-id",
                fields: expectedFieldInputs,
                fertilizerDetails: fertData1,
                cultivationDetails: mockCultivationDetailsData,
                timeFrame: timeframe,
            },
            {
                b_id_farm: "test-farm-id-2",
                fields: expectedFieldInputs2,
                fertilizerDetails: fertData2,
                cultivationDetails: mockCultivationDetailsData2,
                timeFrame: timeframe,
            },
        ]

        expect(result).toEqual(expectedResult)

        expect(mockedGetCultivationsOfFarmsFromCatalogue).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            ["test-farm-id", "test-farm-id-2"],
        )
        expect(mockedGetCultivationsOfFarmsFromCatalogue).toHaveBeenCalledTimes(
            1,
        )
        expect(mockedGetFertilizersOfFarms).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            ["test-farm-id", "test-farm-id-2"],
            true,
        )
        expect(mockedGetFertilizersOfFarms).toHaveBeenCalledTimes(1)
    })
})
