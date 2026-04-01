import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest"
import { getMainCultivation, createFertilizerPlannerTools } from "./index"

// ---------------------------------------------------------------------------
// Mock @google/adk so FunctionTool exposes execute() directly
// ---------------------------------------------------------------------------
vi.mock("@google/adk", async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        FunctionTool: class {
            name: string
            private _execute: Function
            constructor(config: {
                name: string
                execute: Function
                description?: string
                parameters?: any
            }) {
                this.name = config.name
                this._execute = config.execute
            }
            async execute(input: any, context?: any) {
                return this._execute(input, context)
            }
        },
    }
})

// ---------------------------------------------------------------------------
// Mock fdm-core
// ---------------------------------------------------------------------------
vi.mock("@nmi-agro/fdm-core", () => ({
    getFields: vi.fn(),
    getCultivations: vi.fn(),
    getCurrentSoilData: vi.fn(),
    getField: vi.fn(),
    getFertilizers: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock fdm-calculator
// ---------------------------------------------------------------------------
vi.mock("@nmi-agro/fdm-calculator", () => ({
    getNutrientAdvice: vi.fn(),
    createFunctionsForNorms: vi.fn(),
    createUncachedFunctionsForFertilizerApplicationFilling: vi.fn(),
    calculateOrganicMatterBalanceField: vi.fn(),
    collectInputForOrganicMatterBalance: vi.fn(),
    calculateNitrogenBalanceField: vi.fn(),
    collectInputForNitrogenBalance: vi.fn(),
    calculateNitrogenBalancesFieldToFarm: vi.fn(),
    calculateDose: vi.fn(),
    aggregateNormsToFarmLevel: vi.fn(),
    aggregateNormFillingsToFarmLevel: vi.fn(),
}))

import {
    getFields,
    getCultivations,
    getCurrentSoilData,
    getField,
    getFertilizers,
} from "@nmi-agro/fdm-core"
import {
    getNutrientAdvice,
    createFunctionsForNorms,
    createUncachedFunctionsForFertilizerApplicationFilling,
    calculateOrganicMatterBalanceField,
    collectInputForOrganicMatterBalance,
    calculateNitrogenBalanceField,
    collectInputForNitrogenBalance,
    calculateNitrogenBalancesFieldToFarm,
    calculateDose,
    aggregateNormsToFarmLevel,
    aggregateNormFillingsToFarmLevel,
} from "@nmi-agro/fdm-calculator"

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const mockFdm = {} as any

const mockFertilizer = {
    p_id: "p-1",
    p_id_catalogue: "fert-1",
    p_name_nl: "KAS",
    p_type: "mineral",
    p_app_method_options: ["broadcasting", "injection"],
    p_n_rt: 27,
    p_n_wc: 0.6,
    p_p_rt: 0,
    p_k_rt: 0,
    p_mg_rt: 0,
    p_ca_rt: 0,
    p_s_rt: 0,
    p_cu_rt: null,
    p_zn_rt: null,
    p_b_rt: null,
    p_om: 0,
    p_eom: 0,
    p_ef_nh3: 0.02,
    p_source: "catalogue",
}

const mockDosage = {
    dose: {
        p_dose_n: 27,
        p_dose_nw: 20,
        p_dose_p: 0,
        p_dose_k: 0,
        p_dose_s: 0,
        p_dose_mg: 0,
        p_dose_ca: 0,
        p_dose_na: 0,
        p_dose_cu: 0,
        p_dose_zn: 0,
        p_dose_b: 0,
        p_dose_mn: 0,
        p_dose_mo: 0,
        p_dose_co: 0,
    },
}

function makeContext(overrides: Record<string, any> = {}) {
    const data: Record<string, any> = {
        principalId: "principal-1",
        calendar: "2025",
        ...overrides,
    }
    return { state: { get: (k: string) => data[k] } } as any
}

function makeSimInput(
    overrides: Partial<{
        b_id_farm: string
        strategies: any
        fields: any[]
    }> = {},
) {
    return {
        b_id_farm: "farm-1",
        strategies: {},
        fields: [
            {
                b_id: "field-1",
                b_lu_catalogue: "nl_123",
                b_lu_name: "Wheat",
                b_lu_start: "2025-03-01",
                applications: [
                    {
                        p_id_catalogue: "fert-1",
                        p_app_amount: 1000,
                        p_app_date: "2025-04-01",
                        p_app_method: "broadcasting",
                    },
                ],
            },
        ],
        ...overrides,
    }
}

function setupDefaultMocks() {
    ;(getField as any).mockResolvedValue({
        b_id: "field-1",
        b_area: 10,
        b_bufferstrip: false,
        b_centroid: [5.2, 52.1],
    })
    ;(getFields as any).mockResolvedValue([
        {
            b_id: "field-1",
            b_name: "Test Field",
            b_area: 10,
            b_bufferstrip: false,
        },
    ])
    ;(getCultivations as any).mockResolvedValue([
        {
            b_lu_catalogue: "nl_265",
            b_lu_name: "Gras",
            b_lu_start: "2025-01-01",
            b_lu_end: null,
        },
    ])
    ;(getCurrentSoilData as any).mockResolvedValue([
        { parameter: "b_soiltype_agr", value: "sand" },
        { parameter: "b_gwl_class", value: "IV" },
        { parameter: "a_som_loi", value: 3.5 },
    ])
    ;(getFertilizers as any).mockResolvedValue([mockFertilizer])
    ;(collectInputForOrganicMatterBalance as any).mockResolvedValue({
        fields: [{ field: { b_id: "field-1" } }],
        fertilizerDetails: [],
        cultivationDetails: [],
    })
    ;(collectInputForNitrogenBalance as any).mockResolvedValue({
        fields: [{ field: { b_id: "field-1" } }],
        fertilizerDetails: [],
        cultivationDetails: [],
    })
    ;(createFunctionsForNorms as any).mockReturnValue({
        collectInputForNorms: vi.fn().mockResolvedValue({}),
        calculateNormForManure: vi
            .fn()
            .mockResolvedValue({ normValue: 170, normSource: "NL-2025" }),
        calculateNormForPhosphate: vi
            .fn()
            .mockResolvedValue({ normValue: 80, normSource: "NL-2025" }),
        calculateNormForNitrogen: vi
            .fn()
            .mockResolvedValue({ normValue: 230, normSource: "NL-2025" }),
    })
    ;(
        createUncachedFunctionsForFertilizerApplicationFilling as any
    ).mockReturnValue({
        collectInputForFertilizerApplicationFilling: vi
            .fn()
            .mockResolvedValue({}),
        calculateFertilizerApplicationFillingForManure: vi
            .fn()
            .mockResolvedValue({ normFilling: 10, applicationFilling: [] }),
        calculateFertilizerApplicationFillingForNitrogen: vi
            .fn()
            .mockResolvedValue({ normFilling: 20, applicationFilling: [] }),
        calculateFertilizerApplicationFillingForPhosphate: vi
            .fn()
            .mockResolvedValue({ normFilling: 5, applicationFilling: [] }),
    })
    ;(calculateOrganicMatterBalanceField as any).mockReturnValue({
        balance: 100,
        supply: { fertilizers: { total: 50 } },
    })
    ;(calculateNitrogenBalanceField as any).mockReturnValue({
        balance: 10,
        target: 50,
        supply: { fertilizers: { total: 100 } },
        emission: { ammonia: { fertilizers: { total: -2 } } },
    })
    ;(calculateDose as any).mockReturnValue(mockDosage)
    ;(aggregateNormsToFarmLevel as any).mockReturnValue({
        manure: 1700,
        nitrogen: 2300,
        phosphate: 800,
    })
    ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
        manure: 100,
        nitrogen: 200,
        phosphate: 50,
    })
    ;(calculateNitrogenBalancesFieldToFarm as any).mockReturnValue({
        balance: 10,
        target: 50,
    })
    ;(getNutrientAdvice as any).mockResolvedValue({ d_n_req: 100, d_p_req: 20 })
}

// ---------------------------------------------------------------------------
// Existing tests
// ---------------------------------------------------------------------------
describe("fertilizer-planner tools", () => {
    describe("getMainCultivation", () => {
        const cultivations = [
            {
                b_lu_catalogue: "crop-1",
                b_lu_name: "Crop 1",
                b_lu_start: "2025-01-01",
                b_lu_end: "2025-06-01",
            },
            {
                b_lu_catalogue: "crop-2",
                b_lu_name: "Crop 2",
                b_lu_start: "2025-06-02",
                b_lu_end: "2025-12-31",
            },
        ]

        it("should pick the cultivation active on May 15th", () => {
            const result = getMainCultivation(cultivations, "2025")
            expect(result?.b_lu_catalogue).toBe("crop-1")
        })

        it("should handle cultivations with no end date", () => {
            const openCultivations = [
                {
                    b_lu_catalogue: "open-crop",
                    b_lu_name: "Open Crop",
                    b_lu_start: "2025-01-01",
                    b_lu_end: null,
                },
            ]
            const result = getMainCultivation(openCultivations, "2025")
            expect(result?.b_lu_catalogue).toBe("open-crop")
        })

        it("should pick the latest cultivation if multiple are active (overlap)", () => {
            const overlapping = [
                {
                    b_lu_catalogue: "older",
                    b_lu_start: "2025-01-01",
                    b_lu_end: "2025-12-31",
                },
                {
                    b_lu_catalogue: "newer",
                    b_lu_start: "2025-05-01",
                    b_lu_end: "2025-06-01",
                },
            ]
            const result = getMainCultivation(overlapping, "2025")
            expect(result?.b_lu_catalogue).toBe("newer")
        })

        it("should return undefined if no cultivation is active on May 15th", () => {
            const lateCultivations = [
                {
                    b_lu_catalogue: "late-crop",
                    b_lu_start: "2025-06-01",
                    b_lu_end: "2025-12-31",
                },
            ]
            const result = getMainCultivation(lateCultivations, "2025")
            expect(result).toBeUndefined()
        })
    })

    describe("createFertilizerPlannerTools", () => {
        it("should return the correct set of 5 tools", () => {
            const tools = createFertilizerPlannerTools(mockFdm)
            expect(tools).toHaveLength(5)

            const names = tools.map((t) => t.name)
            expect(names).toContain("getFarmFields")
            expect(names).toContain("getFarmNutrientAdvice")
            expect(names).toContain("getFarmLegalNorms")
            expect(names).toContain("searchFertilizers")
            expect(names).toContain("simulateFarmPlan")
        })
    })
})

// ---------------------------------------------------------------------------
// Tool execute function tests
// ---------------------------------------------------------------------------
describe("tool execute functions", () => {
    let tools: any[]

    beforeAll(() => {
        tools = createFertilizerPlannerTools(mockFdm)
    })

    beforeEach(() => {
        vi.clearAllMocks()
        setupDefaultMocks()
    })

    function getTool(name: string) {
        return tools.find((t) => t.name === name)
    }

    // ── getFarmFields ────────────────────────────────────────────────────────
    describe("getFarmFields", () => {
        it("should throw when context is missing", async () => {
            await expect(
                getTool("getFarmFields").execute(
                    { b_id_farm: "farm-1", calendar: "2025" },
                    undefined,
                ),
            ).rejects.toThrow("Context is required")
        })

        it("should return fields with soil params and cultivation details", async () => {
            const result = await getTool("getFarmFields").execute(
                { b_id_farm: "farm-1", calendar: "2025" },
                makeContext(),
            )
            expect(result.fields).toHaveLength(1)
            expect(result.fields[0].b_id).toBe("field-1")
            expect(result.fields[0].b_lu_catalogue).toBe("nl_265")
            expect(result.fields[0].b_soiltype_agr).toBe("sand")
            expect(result.fields[0].b_gwl_class).toBe("IV")
            expect(result.fields[0].a_som_loi).toBe(3.5)
        })

        it("should return null cultivation info when no mainLu found", async () => {
            ;(getCultivations as any).mockResolvedValue([
                {
                    b_lu_catalogue: "late-crop",
                    b_lu_start: "2025-06-01",
                    b_lu_end: "2025-12-31",
                },
            ])
            const result = await getTool("getFarmFields").execute(
                { b_id_farm: "farm-1", calendar: "2025" },
                makeContext(),
            )
            expect(result.fields[0].b_lu_catalogue).toBeNull()
            expect(result.fields[0].b_lu_start).toBeNull()
        })
    })

    // ── getFarmNutrientAdvice ────────────────────────────────────────────────
    describe("getFarmNutrientAdvice", () => {
        it("should throw when context is missing", async () => {
            await expect(
                getTool("getFarmNutrientAdvice").execute(
                    { b_ids: ["field-1"] },
                    undefined,
                ),
            ).rejects.toThrow("Context is required")
        })

        it("should return advice when mainLu is found", async () => {
            const result = await getTool("getFarmNutrientAdvice").execute(
                { b_ids: ["field-1"] },
                makeContext({ nmiApiKey: "test-key" }),
            )
            expect(result.advicePerField).toHaveLength(1)
            expect(result.advicePerField[0].b_id).toBe("field-1")
            expect(result.advicePerField[0].advice).toEqual({
                d_n_req: 100,
                d_p_req: 20,
            })
        })

        it("should return null advice when no mainLu active on May 15th", async () => {
            ;(getCultivations as any).mockResolvedValue([
                {
                    b_lu_catalogue: "late-crop",
                    b_lu_start: "2025-06-01",
                    b_lu_end: "2025-12-31",
                },
            ])
            const result = await getTool("getFarmNutrientAdvice").execute(
                { b_ids: ["field-1"] },
                makeContext({ nmiApiKey: "test-key" }),
            )
            expect(result.advicePerField[0].advice).toBeNull()
            expect(getNutrientAdvice).not.toHaveBeenCalled()
        })
    })

    // ── getFarmLegalNorms ────────────────────────────────────────────────────
    describe("getFarmLegalNorms", () => {
        it("should throw when context is missing", async () => {
            await expect(
                getTool("getFarmLegalNorms").execute(
                    { b_id_farm: "farm-1", b_ids: ["field-1"] },
                    undefined,
                ),
            ).rejects.toThrow("Context is required")
        })

        it("should return norms per field", async () => {
            const result = await getTool("getFarmLegalNorms").execute(
                { b_id_farm: "farm-1", b_ids: ["field-1"] },
                makeContext(),
            )
            expect(result.normsPerField).toHaveLength(1)
            expect(result.normsPerField[0].b_id).toBe("field-1")
            expect(result.normsPerField[0].norms.animalManureN).toBe(170)
            expect(result.normsPerField[0].norms.workableN).toBe(230)
            expect(result.normsPerField[0].norms.phosphate).toBe(80)
        })
    })

    // ── searchFertilizers ────────────────────────────────────────────────────
    describe("searchFertilizers", () => {
        it("should throw when context is missing", async () => {
            await expect(
                getTool("searchFertilizers").execute(
                    { b_id_farm: "farm-1" },
                    undefined,
                ),
            ).rejects.toThrow("Context is required")
        })

        it("should return all fertilizers when no filter is applied", async () => {
            const result = await getTool("searchFertilizers").execute(
                { b_id_farm: "farm-1" },
                makeContext(),
            )
            expect(result.fertilizers).toHaveLength(1)
            expect(result.fertilizers[0].p_id_catalogue).toBe("fert-1")
        })

        it("should filter by p_type", async () => {
            ;(getFertilizers as any).mockResolvedValue([
                mockFertilizer,
                {
                    ...mockFertilizer,
                    p_id_catalogue: "manure-1",
                    p_type: "manure",
                },
            ])
            const result = await getTool("searchFertilizers").execute(
                { b_id_farm: "farm-1", p_type: "manure" },
                makeContext(),
            )
            expect(result.fertilizers).toHaveLength(1)
            expect(result.fertilizers[0].p_id_catalogue).toBe("manure-1")
        })

        it("should filter by query string", async () => {
            ;(getFertilizers as any).mockResolvedValue([
                mockFertilizer,
                {
                    ...mockFertilizer,
                    p_id_catalogue: "compost-1",
                    p_name_nl: "Compost",
                    p_type: "compost",
                },
            ])
            const result = await getTool("searchFertilizers").execute(
                { b_id_farm: "farm-1", query: "compost" },
                makeContext(),
            )
            expect(result.fertilizers).toHaveLength(1)
            expect(result.fertilizers[0].p_id_catalogue).toBe("compost-1")
        })

        it("should return empty array when b_id_farm is missing", async () => {
            const result = await getTool("searchFertilizers").execute(
                { b_id_farm: "" },
                makeContext(),
            )
            expect(result.fertilizers).toEqual([])
        })
    })

    // ── simulateFarmPlan ─────────────────────────────────────────────────────
    describe("simulateFarmPlan", () => {
        it("should throw when context is missing", async () => {
            await expect(
                getTool("simulateFarmPlan").execute(makeSimInput(), undefined),
            ).rejects.toThrow("Context is required")
        })

        it("should throw when b_id_farm is missing", async () => {
            await expect(
                getTool("simulateFarmPlan").execute(
                    makeSimInput({ b_id_farm: "" }),
                    makeContext(),
                ),
            ).rejects.toThrow("Database connection or Farm ID missing")
        })

        it("should return valid result for a compliant plan", async () => {
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(result.isValid).toBe(true)
            expect(result.complianceIssues).toHaveLength(0)
            expect(result.fieldResults).toHaveLength(1)
            expect(result.fieldResults[0].isValid).toBe(true)
            expect(result.farmTotals.normsFilling).toBeDefined()
        })

        it("should flag buffer strip violation", async () => {
            ;(getField as any).mockResolvedValue({
                b_id: "field-1",
                b_area: 10,
                b_bufferstrip: true,
                b_centroid: [5.2, 52.1],
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(result.isValid).toBe(false)
            expect(result.complianceIssues[0]).toContain(
                "Buffer strip violation",
            )
            expect(result.fieldResults[0].isBufferStripViolation).toBe(true)
        })

        it("should throw when fertilizer is not found in inventory", async () => {
            ;(getFertilizers as any).mockResolvedValue([])
            await expect(
                getTool("simulateFarmPlan").execute(
                    makeSimInput(),
                    makeContext(),
                ),
            ).rejects.toThrow("not found in farm inventory")
        })

        it("should throw for invalid application method", async () => {
            ;(getFertilizers as any).mockResolvedValue([
                { ...mockFertilizer, p_app_method_options: ["injection"] },
            ])
            await expect(
                getTool("simulateFarmPlan").execute(
                    makeSimInput(),
                    makeContext(),
                ),
            ).rejects.toThrow("Invalid application method")
        })

        it("should accept any method when p_app_method_options is empty", async () => {
            ;(getFertilizers as any).mockResolvedValue([
                { ...mockFertilizer, p_app_method_options: [] },
            ])
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(result.isValid).toBe(true)
        })

        it("should report manure N norm violation", async () => {
            ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
                manure: 2000,
                nitrogen: 200,
                phosphate: 50,
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(result.isValid).toBe(false)
            expect(
                result.complianceIssues.some((i: string) =>
                    i.includes("Manure N"),
                ),
            ).toBe(true)
        })

        it("should report workable N norm violation", async () => {
            ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
                manure: 100,
                nitrogen: 3000,
                phosphate: 50,
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(result.isValid).toBe(false)
            expect(
                result.complianceIssues.some((i: string) =>
                    i.includes("Workable N"),
                ),
            ).toBe(true)
        })

        it("should report phosphate norm violation", async () => {
            ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
                manure: 100,
                nitrogen: 200,
                phosphate: 1000,
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(result.isValid).toBe(false)
            expect(
                result.complianceIssues.some((i: string) =>
                    i.includes("Phosphate"),
                ),
            ).toBe(true)
        })

        it("should report organic farming strategy violation for mineral fertilizer", async () => {
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput({ strategies: { isOrganic: true } }),
                makeContext(),
            )
            expect(result.isValid).toBe(false)
            expect(
                result.complianceIssues.some((i: string) =>
                    i.includes("Organic Farming"),
                ),
            ).toBe(true)
        })

        it("should report derogation violation for mineral fertilizer with phosphate", async () => {
            ;(getFertilizers as any).mockResolvedValue([
                { ...mockFertilizer, p_type: "mineral", p_p_rt: 15 },
            ])
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput({ strategies: { isDerogation: true } }),
                makeContext(),
            )
            expect(result.isValid).toBe(false)
            expect(
                result.complianceIssues.some((i: string) =>
                    i.includes("Derogation"),
                ),
            ).toBe(true)
        })

        it("should warn when nitrogen balance exceeds target", async () => {
            ;(calculateNitrogenBalancesFieldToFarm as any).mockReturnValue({
                balance: 100,
                target: 50,
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput({
                    strategies: { keepNitrogenBalanceBelowTarget: true },
                }),
                makeContext(),
            )
            expect(
                result.agronomicWarnings.some((w: string) =>
                    w.includes("Nitrogen Target"),
                ),
            ).toBe(true)
        })

        it("should warn for rotation level mismatch between fields with same crop", async () => {
            ;(getField as any).mockImplementation(
                (_fdm: any, _pid: any, b_id: string) =>
                    Promise.resolve({
                        b_id,
                        b_area: 10,
                        b_bufferstrip: false,
                        b_centroid: [5.2, 52.1],
                    }),
            )
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput({
                    strategies: { workOnRotationLevel: true },
                    fields: [
                        {
                            b_id: "field-1",
                            b_lu_catalogue: "nl_123",
                            b_lu_name: "Wheat",
                            b_lu_start: "2025-03-01",
                            applications: [
                                {
                                    p_id_catalogue: "fert-1",
                                    p_app_amount: 1000,
                                    p_app_date: "2025-04-01",
                                    p_app_method: "broadcasting",
                                },
                            ],
                        },
                        {
                            b_id: "field-2",
                            b_lu_catalogue: "nl_123",
                            b_lu_name: "Wheat",
                            b_lu_start: "2025-03-01",
                            applications: [
                                {
                                    p_id_catalogue: "fert-1",
                                    p_app_amount: 2000, // different amount!
                                    p_app_date: "2025-04-01",
                                    p_app_method: "broadcasting",
                                },
                            ],
                        },
                    ],
                }),
                makeContext(),
            )
            expect(
                result.agronomicWarnings.some((w: string) =>
                    w.includes("Rotation Level"),
                ),
            ).toBe(true)
        })

        it("should normalize grassland codes under rotation level strategy", async () => {
            ;(getField as any).mockImplementation(
                (_fdm: any, _pid: any, b_id: string) =>
                    Promise.resolve({
                        b_id,
                        b_area: 10,
                        b_bufferstrip: false,
                        b_centroid: [5.2, 52.1],
                    }),
            )
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput({
                    strategies: { workOnRotationLevel: true },
                    fields: [
                        {
                            b_id: "field-1",
                            b_lu_catalogue: "nl_265",
                            b_lu_name: "Gras",
                            b_lu_start: "2025-01-01",
                            applications: [
                                {
                                    p_id_catalogue: "fert-1",
                                    p_app_amount: 1000,
                                    p_app_date: "2025-04-01",
                                    p_app_method: "broadcasting",
                                },
                            ],
                        },
                        {
                            b_id: "field-2",
                            b_lu_catalogue: "nl_266",
                            b_lu_name: "Gras",
                            b_lu_start: "2025-01-01",
                            applications: [
                                {
                                    p_id_catalogue: "fert-1",
                                    p_app_amount: 1000,
                                    p_app_date: "2025-04-01",
                                    p_app_method: "broadcasting",
                                },
                            ],
                        },
                    ],
                }),
                makeContext(),
            )
            // Same applications → no rotation mismatch warning
            expect(
                result.agronomicWarnings.some((w: string) =>
                    w.includes("Rotation Level"),
                ),
            ).toBe(false)
        })

        it("should warn for high NH3 emission factor", async () => {
            ;(calculateNitrogenBalanceField as any).mockReturnValue({
                balance: 10,
                target: 50,
                supply: { fertilizers: { total: 100 } },
                emission: { ammonia: { fertilizers: { total: -40 } } }, // 40% > 30% threshold
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput({ strategies: { reduceAmmoniaEmissions: true } }),
                makeContext(),
            )
            expect(
                result.agronomicWarnings.some((w: string) =>
                    w.includes("Reduce Ammonia Emissions"),
                ),
            ).toBe(true)
        })

        it("should not warn for NH3 when emission factor is below threshold", async () => {
            // Default mock: emission total = -2, supply = 100 → 2% < 30%
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput({ strategies: { reduceAmmoniaEmissions: true } }),
                makeContext(),
            )
            expect(
                result.agronomicWarnings.some((w: string) =>
                    w.includes("Reduce Ammonia Emissions"),
                ),
            ).toBe(false)
        })

        it("should warn when manure space is underfilled", async () => {
            ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
                manure: 100, // << 1700 * 0.95 = 1615
                nitrogen: 200,
                phosphate: 50,
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput({ strategies: { fillManureSpace: true } }),
                makeContext(),
            )
            expect(
                result.agronomicWarnings.some((w: string) =>
                    w.includes("Fill Manure Space"),
                ),
            ).toBe(true)
        })

        it("should warn for negative organic matter balance", async () => {
            ;(calculateOrganicMatterBalanceField as any).mockReturnValue({
                balance: -50,
                supply: { fertilizers: { total: 0 } },
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(
                result.agronomicWarnings.some((w: string) =>
                    w.includes("Organic Matter"),
                ),
            ).toBe(true)
        })

        it("should fetch nutrient advice when nmiApiKey is provided", async () => {
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext({ nmiApiKey: "test-nmi-key" }),
            )
            expect(getNutrientAdvice).toHaveBeenCalled()
            expect(result.fieldResults[0].fieldMetrics?.advice).toEqual({
                d_n_req: 100,
                d_p_req: 20,
            })
        })

        it("should handle omBalance calculation error gracefully", async () => {
            ;(calculateOrganicMatterBalanceField as any).mockImplementation(
                () => {
                    throw new Error("OM calculation failed")
                },
            )
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(result.fieldResults[0].fieldMetrics?.omBalanceError).toBe(
                "OM calculation failed",
            )
        })

        it("should handle nBalance calculation error gracefully", async () => {
            ;(calculateNitrogenBalanceField as any).mockImplementation(() => {
                throw new Error("N balance failed")
            })
            const result = await getTool("simulateFarmPlan").execute(
                makeSimInput(),
                makeContext(),
            )
            expect(result.fieldResults[0].fieldMetrics?.nBalanceError).toBe(
                "N balance failed",
            )
        })
    })
})
