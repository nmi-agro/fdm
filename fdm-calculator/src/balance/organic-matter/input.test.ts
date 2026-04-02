import type {
    Cultivation,
    CultivationCatalogue,
    FdmType,
    FertilizerApplication,
    FertilizerCatalogue,
    Field,
    PrincipalId,
    SoilAnalysis,
} from "@nmi-agro/fdm-core"
import * as fdmCore from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    collectInputForOrganicMatterBalance,
    collectInputForOrganicMatterBalanceForFarms,
} from "./input"
import type { FieldInput, OrganicMatterBalanceInput } from "./types"

// Mock the @nmi-agro/fdm-core module
vi.mock("@nmi-agro/fdm-core", async () => {
    const original = await vi.importActual("@nmi-agro/fdm-core")
    return {
        ...original,
        getFields: vi.fn(),
        getCultivations: vi.fn(),
        getCultivationsForFarm: vi.fn(),
        getHarvests: vi.fn(),
        getSoilAnalyses: vi.fn(),
        getSoilAnalysesForFarm: vi.fn(),
        getFertilizerApplications: vi.fn(),
        getFertilizerApplicationsForFarm: vi.fn(),
        getCultivationsFromCatalogue: vi.fn(),
        getFertilizersFromCatalogue: vi.fn(),
        getEnabledCultivationCataloguesForFarms: vi.fn(),
        getEnabledFertilizerCataloguesForFarms: vi.fn(),
        getCultivationsFromCatalogues: vi.fn(),
        getFertilizersFromCatalogues: vi.fn(),
    }
})

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
                p_id_catalogue: "fert-cat-1",
                p_name_nl: "test-product",
                p_app_amount: 100,
                p_app_method: "broadcasting", // match one of ApplicationMethods
                p_app_date: new Date(),
                p_id: "fert-1",
            },
        ] as FertilizerApplication[],
        mockFertilizerApplicationsData2: [
            {
                p_app_id: "fa-2",
                p_id_catalogue: "fert-cat-2",
                p_name_nl: "test-product",
                p_app_amount: 100,
                p_app_method: "broadcasting", // match one of ApplicationMethods
                p_app_date: new Date(),
                p_id: "fert-2",
            },
        ] as FertilizerApplication[],
        mockFertilizerDetailsData: [
            {
                p_id_catalogue: "fert-cat-1",
                p_n_rt: 5,
                p_type: "manure",
                p_no3_rt: 1,
                p_nh4_rt: 2,
                p_s_rt: 0,
                p_ef_nh3: 0.1,
            },
        ] as FertilizerCatalogue[],
        mockFertilizerDetailsData2: [
            {
                p_id_catalogue: "fert-cat-2",
                p_n_rt: 5,
                p_type: "manure",
                p_no3_rt: 1,
                p_nh4_rt: 2,
                p_s_rt: 0,
                p_ef_nh3: 0.1,
            },
        ] as FertilizerCatalogue[],
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
    }
}

describe("collectInputForOrganicMatterBalance", () => {
    const mockFdm: any = {
        transaction: (callback: any) => callback(mockFdm),
    }
    const principal_id = "test-principal"
    const b_id_farm = "test-farm"
    const timeframe = {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
    }

    it("should collect input for all fields in a farm", async () => {
        const mockFields = [{ b_id: "field1" }, { b_id: "field2" }]
        const {
            mockFertilizerApplicationsData,
            mockFertilizerDetailsData,
            mockCultivationsData,
            mockCultivationDetailsData,
        } = createMockData()
        vi.spyOn(fdmCore, "getFields").mockResolvedValue(mockFields as any)
        vi.spyOn(fdmCore, "getCultivationsForFarm").mockResolvedValue(
            new Map(
                (mockFields as any[]).map((f: { b_id: string }) => [
                    f.b_id,
                    mockCultivationsData,
                ]),
            ) as any,
        )
        vi.spyOn(fdmCore, "getSoilAnalysesForFarm").mockResolvedValue(
            new Map() as any,
        )
        vi.spyOn(fdmCore, "getFertilizerApplicationsForFarm").mockResolvedValue(
            new Map(
                (mockFields as any[]).map((f: { b_id: string }) => [
                    f.b_id,
                    mockFertilizerApplicationsData,
                ]),
            ) as any,
        )
        vi.spyOn(fdmCore, "getFertilizersFromCatalogue").mockResolvedValue(
            mockFertilizerDetailsData as any,
        )
        vi.spyOn(fdmCore, "getCultivationsFromCatalogue").mockResolvedValue(
            mockCultivationDetailsData as any,
        )

        const result = await collectInputForOrganicMatterBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        expect(fdmCore.getFields).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )
        expect(result.fields).toHaveLength(2)
        expect(result.fields[0].field.b_id).toBe("field1")
    })

    it("should collect input for a single specified field", async () => {
        const mockField = { b_id: "field1" }
        vi.spyOn(fdmCore, "getField").mockResolvedValue(mockField as any)
        vi.spyOn(fdmCore, "getCultivations").mockResolvedValue([])
        vi.spyOn(fdmCore, "getHarvests").mockResolvedValue([])
        vi.spyOn(fdmCore, "getSoilAnalyses").mockResolvedValue([])
        vi.spyOn(fdmCore, "getFertilizerApplications").mockResolvedValue([])
        vi.spyOn(fdmCore, "getFertilizersFromCatalogue").mockResolvedValue([])
        vi.spyOn(fdmCore, "getCultivationsFromCatalogue").mockResolvedValue([])

        const result = await collectInputForOrganicMatterBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
            "field1",
        )

        expect(fdmCore.getField).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            "field1",
        )
        expect(result.fields).toHaveLength(1)
        expect(result.fields[0].field.b_id).toBe("field1")
    })

    it("should throw an error if a specified field is not found", async () => {
        // @ts-expect-error
        vi.spyOn(fdmCore, "getField").mockResolvedValue(null)

        await expect(
            collectInputForOrganicMatterBalance(
                mockFdm,
                principal_id,
                b_id_farm,
                timeframe,
                "non-existent-field",
            ),
        ).rejects.toThrow("Field not found: non-existent-field")
    })

    it("should correctly structure the output", async () => {
        const mockField = { b_id: "field1" }
        const mockCultivation = { b_lu: "cult1" }
        const mockFertilizer = { p_id: "fert-1", p_id_catalogue: "fert-cat-1" }
        vi.spyOn(fdmCore, "getFields").mockResolvedValue([mockField] as any)
        vi.spyOn(fdmCore, "getCultivationsForFarm").mockResolvedValue(
            new Map([["field1", [mockCultivation]]]) as any,
        )
        vi.spyOn(fdmCore, "getSoilAnalysesForFarm").mockResolvedValue(
            new Map() as any,
        )
        vi.spyOn(fdmCore, "getFertilizerApplicationsForFarm").mockResolvedValue(
            new Map([["field1", [{ p_id_catalogue: "fert-cat-1" }]]]) as any,
        )
        vi.spyOn(fdmCore, "getFertilizersFromCatalogue").mockResolvedValue([
            mockFertilizer,
        ] as any)
        vi.spyOn(fdmCore, "getCultivationsFromCatalogue").mockResolvedValue([
            mockCultivation,
        ] as any)

        const result = await collectInputForOrganicMatterBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        expect(result).toHaveProperty("fields")
        expect(result).toHaveProperty("fertilizerDetails")
        expect(result).toHaveProperty("cultivationDetails")
        expect(result).toHaveProperty("timeFrame")
        expect(result.fertilizerDetails[0].p_id_catalogue).toBe("fert-cat-1")
    })
})

describe("collectInputForOrganicMatterBalanceForFarms", () => {
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
            mockSoilAnalysesData,
            mockFertilizerApplicationsData,
            mockFertilizerApplicationsData2,
            mockFertilizerDetailsData,
            mockFertilizerDetailsData2,
            mockCultivationDetailsData,
            mockCultivationDetailsData2,
        } = createMockData()
        const mockFieldsData2 = mockFieldsData.map((field) => ({
            ...field,
            b_id: `2-${field.b_id}`,
            b_id_farm: "test-farm-id-2",
        }))

        // Setup mocks
        vi.spyOn(fdmCore, "getFields").mockImplementation(
            async (_1, _2, b_id_farm) =>
                b_id_farm === "test-farm-id-2"
                    ? mockFieldsData2
                    : mockFieldsData,
        )
        vi.spyOn(fdmCore, "getCultivationsForFarm").mockImplementation(
            async (_1, _2, b_id_farm) =>
                b_id_farm === "test-farm-id-2"
                    ? new Map(
                          mockFieldsData2.map((f) => [f.b_id, mockCultivationsData2]),
                      )
                    : new Map(
                          mockFieldsData.map((f) => [f.b_id, mockCultivationsData]),
                      ),
        )
        vi.spyOn(fdmCore, "getSoilAnalysesForFarm").mockImplementation(
            async (_1, _2, b_id_farm) =>
                b_id_farm === "test-farm-id-2"
                    ? new Map(
                          mockFieldsData2.map(
                              (f) => [f.b_id, mockSoilAnalysesData] as [string, typeof mockSoilAnalysesData],
                          ),
                      ) as any
                    : new Map(
                          mockFieldsData.map(
                              (f) => [f.b_id, mockSoilAnalysesData] as [string, typeof mockSoilAnalysesData],
                          ),
                      ) as any,
        )
        vi.spyOn(fdmCore, "getFertilizerApplicationsForFarm").mockImplementation(
            async (_1, _2, b_id_farm) =>
                b_id_farm === "test-farm-id-2"
                    ? new Map(
                          mockFieldsData2.map((f) => [
                              f.b_id,
                              mockFertilizerApplicationsData2,
                          ]),
                      )
                    : new Map(
                          mockFieldsData.map((f) => [
                              f.b_id,
                              mockFertilizerApplicationsData,
                          ]),
                      ),
        )
        const cultDetailsWithSource1 = mockCultivationDetailsData.map((c) => ({
            ...c,
            b_lu_source: "brp",
        }))
        const cultDetailsWithSource2 = mockCultivationDetailsData2.map((c) => ({
            ...c,
            b_lu_source: "brp",
        }))
        const allCultivationDetails = [
            ...cultDetailsWithSource1,
            ...cultDetailsWithSource2,
        ]
        const fertData1 = mockFertilizerDetailsData.map((fert) => ({
            ...fert,
            p_source: "test-farm-id",
        }))
        const fertData2 = mockFertilizerDetailsData2.map((fert) => ({
            ...fert,
            p_source: "test-farm-id-2",
        }))
        const allFertilizerDetails = [...fertData1, ...fertData2]
        vi.spyOn(
            fdmCore,
            "getEnabledCultivationCataloguesForFarms",
        ).mockResolvedValue({
            "test-farm-id": ["brp"],
            "test-farm-id-2": ["brp"],
        })
        vi.spyOn(
            fdmCore,
            "getEnabledFertilizerCataloguesForFarms",
        ).mockResolvedValue({
            "test-farm-id": ["test-farm-id"],
            "test-farm-id-2": ["test-farm-id-2"],
        })
        vi.spyOn(fdmCore, "getCultivationsFromCatalogues").mockResolvedValue(
            allCultivationDetails as any,
        )
        vi.spyOn(fdmCore, "getFertilizersFromCatalogues").mockResolvedValue(
            allFertilizerDetails as any,
        )

        const result = await collectInputForOrganicMatterBalanceForFarms(
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
            soilAnalyses: mockSoilAnalysesData,
            fertilizerApplications: fertilizerApplications,
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

        const expectedResult: (OrganicMatterBalanceInput & {
            b_id_farm?: string
        })[] = [
            {
                b_id_farm: "test-farm-id",
                fields: expectedFieldInputs,
                fertilizerDetails: fertData1,
                cultivationDetails: cultDetailsWithSource1,
                timeFrame: timeframe,
            },
            {
                b_id_farm: "test-farm-id-2",
                fields: expectedFieldInputs2,
                fertilizerDetails: fertData2,
                cultivationDetails: cultDetailsWithSource2,
                timeFrame: timeframe,
            },
        ]

        expect(result).toEqual(expectedResult)

        expect(
            fdmCore.getEnabledCultivationCataloguesForFarms,
        ).toHaveBeenCalledWith(mockFdm, principal_id, [
            "test-farm-id",
            "test-farm-id-2",
        ])
        expect(
            fdmCore.getEnabledCultivationCataloguesForFarms,
        ).toHaveBeenCalledTimes(1)
        expect(
            fdmCore.getEnabledFertilizerCataloguesForFarms,
        ).toHaveBeenCalledWith(mockFdm, principal_id, [
            "test-farm-id",
            "test-farm-id-2",
        ])
        expect(
            fdmCore.getEnabledFertilizerCataloguesForFarms,
        ).toHaveBeenCalledTimes(1)
        expect(fdmCore.getCultivationsFromCatalogues).toHaveBeenCalledWith(
            mockFdm,
            ["brp"],
        )
        expect(fdmCore.getCultivationsFromCatalogues).toHaveBeenCalledTimes(1)
        expect(fdmCore.getFertilizersFromCatalogues).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            expect.arrayContaining(["test-farm-id", "test-farm-id-2"]),
        )
        expect(fdmCore.getFertilizersFromCatalogues).toHaveBeenCalledTimes(1)
    })
})
