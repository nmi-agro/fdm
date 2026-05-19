import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createFdmApi } from "../index"
import type { FdmApiServices } from "../index"

// ---------------------------------------------------------------------------
// Shared test setup
// ---------------------------------------------------------------------------
const mockAuth = {
    api: { verifyApiKey: vi.fn() },
} as any

const mockFdm = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any

const config = { appName: "Test App", appUrl: "https://test.example.com" }

function validKey() {
    mockAuth.api.verifyApiKey.mockResolvedValue({
        valid: true,
        error: null,
        key: { id: "key-1", referenceId: "user-1", name: "Test key" },
    })
}

function makeApp(services: Partial<FdmApiServices> = {}) {
    return createFdmApi(mockFdm, mockAuth, config, services)
}

const START = "2025-01-01"
const END = "2025-12-31"

afterEach(() => {
    vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const mockDose = {
    p_dose_n: 100,
    p_dose_nw: 80,
    p_dose_p: 40,
    p_dose_k: 60,
    p_dose_eoc: 10,
    p_dose_s: 15,
    p_dose_mg: 5,
    p_dose_ca: 30,
    p_dose_na: 2,
    p_dose_cu: 0.5,
    p_dose_zn: 0.3,
    p_dose_co: 0.01,
    p_dose_mn: 0.8,
    p_dose_mo: 0.02,
    p_dose_b: 0.1,
}

const mockNitrogenBalance = {
    balance: 15.5,
    supply: {
        total: 120,
        deposition: 10,
        fixation: 5,
        mineralisation: 30,
        fertilizers: { total: 75, mineral: 50, manure: 15, compost: 5, other: 5 },
    },
    removal: { total: 90, harvests: 80, residues: 10 },
    emission: {
        total: 14.5,
        ammonia: {
            total: 10,
            fertilizers: {},
            residues: { total: 2, cultivations: [] },
        },
        nitrate: 4.5,
    },
    target: 20,
    fields: [],
    hasErrors: false,
    fieldErrorMessages: [],
}

const mockOrganicMatterBalance = {
    balance: 1.2,
    supply: 3.5,
    degradation: -2.3,
    fields: [],
    hasErrors: false,
    fieldErrorMessages: [],
}

const mockField = {
    b_id: "field-1",
    b_id_farm: "farm-1",
    b_name: "Test Field",
    b_area: 5.0,
    b_start: new Date("2020-01-01"),
    b_end: null,
    b_centroid: null,
    b_bufferstrip: false,
    b_id_source: null,
    b_lu_package: null,
    b_geometry: null,
}

const mockNitrogenInput = {
    b_id_farm: "farm-1",
    fields: [
        {
            field: {
                b_id: "field-1",
                b_area: 5.0,
                b_bufferstrip: false,
                b_centroid: null,
                b_start: null,
                b_end: null,
            },
            cultivations: [],
            harvests: [],
            soilAnalyses: [],
            fertilizerApplications: [],
        },
    ],
    fertilizerDetails: [],
    cultivationDetails: [],
    timeFrame: { start: new Date(START), end: new Date(END) },
}

const mockOrganicMatterInput = {
    b_id_farm: "farm-1",
    fields: [
        {
            field: {
                b_id: "field-1",
                b_area: 5.0,
                b_bufferstrip: false,
                b_centroid: null,
                b_start: null,
                b_end: null,
            },
            cultivations: [],
            soilAnalyses: [],
            fertilizerApplications: [],
        },
    ],
    fertilizerDetails: [],
    cultivationDetails: [],
    timeFrame: { start: new Date(START), end: new Date(END) },
}

const mockFieldNitrogenBalance = {
    b_id: "field-1",
    balance: 15.5,
    supply: {
        total: 120,
        fertilizers: {
            total: 75,
            mineral: { total: 50, applications: [] },
            manure: { total: 15, applications: [] },
            compost: { total: 5, applications: [] },
            other: { total: 5, applications: [] },
        },
        fixation: { total: 5, cultivations: [] },
        deposition: { total: 10 },
        mineralisation: { total: 30 },
    },
    removal: {
        total: 90,
        harvests: { total: 80, harvests: [] },
        residues: { total: 10, cultivations: [] },
    },
    emission: {
        total: 14.5,
        ammonia: {
            total: 10,
            fertilizers: {},
            residues: { total: 2, cultivations: [] },
        },
        nitrate: { total: 4.5 },
    },
    target: 20,
}

const mockFieldOrganicMatterBalance = {
    b_id: "field-1",
    balance: 1.2,
    supply: {
        total: 3.5,
        fertilizers: {
            total: 2.0,
            manure: { total: 1.5, applications: [] },
            compost: { total: 0.5, applications: [] },
            other: { total: 0, applications: [] },
        },
        cultivations: { total: 1.0, cultivations: [] },
        residues: { total: 0.5, cultivations: [] },
    },
    degradation: { total: -2.3 },
}

const mockFarmNorms = {
    nitrogen: { normValue: 170, normSource: "Mais - zand/loess" },
    manure: { normValue: 170, normSource: "Standaard" },
    phosphate: { normValue: 75, normSource: "Arm bouwland" },
}

const mockNormsServices = {
    createFunctionsForNorms: vi.fn(() => ({
        collectInputForNormsForFarm: vi.fn().mockResolvedValue(new Map([["field-1", {}]])),
        collectInputForNorms: vi.fn().mockResolvedValue({}),
        calculateNormForNitrogen: vi.fn().mockResolvedValue(mockFarmNorms.nitrogen),
        calculateNormForManure: vi.fn().mockResolvedValue(mockFarmNorms.manure),
        calculateNormForPhosphate: vi.fn().mockResolvedValue(mockFarmNorms.phosphate),
    })),
    getField: vi.fn().mockResolvedValue({ b_id: "field-1", b_id_farm: "farm-1" }),
}

const mockNutrientAdviceServices = {
    getNutrientAdvice: vi.fn().mockResolvedValue({
        d_n_req: 150,
        d_n_norm: 170,
        d_n_norm_man: 170,
        d_p_norm: 75,
        d_p_req: 50,
        d_k_req: 200,
        d_c_req: 0,
        d_ca_req: 0,
        d_s_req: 0,
        d_mg_req: 0,
        d_cu_req: 0,
        d_zn_req: 0,
        d_co_req: 0,
        d_mn_req: 0,
        d_mo_req: 0,
        d_na_req: 0,
        d_b_req: 0,
    }),
    getField: vi.fn().mockResolvedValue({
        b_id: "field-1",
        b_id_farm: "farm-1",
        b_centroid: [5.585, 53.288],
        b_bufferstrip: false,
    }),
    getCultivations: vi.fn().mockResolvedValue([{ b_lu_catalogue: "nl_2014" }]),
    getCurrentSoilData: vi
        .fn()
        .mockResolvedValue([{ parameter: "a_som_loi", value: 3.5, a_depth_lower: 0.3 }]),
}

// [MINERALIZATION: disabled — behind feature flag in fdm-app]
// const mockNSupplyServices = {
//     getNSupply: vi.fn().mockResolvedValue({
//         b_id: "field-1", b_name: "Test field", area: 2.5, method: "minip", totalAnnualN: 80,
//         data: [{ doy: 1, d_n_supply_actual: 0 }, { doy: 365, d_n_supply_actual: 80 }],
//         completeness: { available: [], missing: [], estimated: [], score: 80 },
//     }),
//     assessDataCompleteness: vi.fn().mockReturnValue({ available: [], missing: [], estimated: [], score: 80 }),
//     buildNSupplyRequest: vi.fn().mockReturnValue({}),
//     getField: vi.fn().mockResolvedValue({ b_id: "field-1", b_name: "Test field", b_area: 2.5, b_id_farm: "farm-1" }),
//     getCurrentSoilData: vi.fn().mockResolvedValue([]),
//     getCultivations: vi.fn().mockResolvedValue([]),
// }
//
// const mockDynaServices = {
//     getDyna: vi.fn().mockResolvedValue({
//         b_id: "field-1", calculationDyna: [],
//         nitrogenBalance: { b_nw: 100, b_n_uptake: 80, b_n_greenmanure: 0, b_n_fertilizer_organic: 30,
//             b_n_fertilizer_artificial: 70, b_n_fertilizer_preceeding: 5 },
//         fertilizingRecommendations: null, harvestingRecommendation: null,
//     }),
//     buildDynaRequest: vi.fn().mockReturnValue({}),
//     getField: vi.fn().mockResolvedValue({ b_id: "field-1", b_id_farm: "farm-1", b_name: "Test field", b_area: 2.5 }),
//     getCurrentSoilData: vi.fn().mockResolvedValue([]),
//     getCultivations: vi.fn().mockResolvedValue([]),
//     getCultivationsFromCatalogue: vi.fn().mockResolvedValue([]),
//     getHarvestsForFarm: vi.fn().mockResolvedValue(new Map()),
//     getFertilizerApplications: vi.fn().mockResolvedValue([]),
//     getFertilizers: vi.fn().mockResolvedValue([]),
//     getGrazingIntention: vi.fn().mockResolvedValue(false),
// }

// ---------------------------------------------------------------------------
// 401 — unauthenticated
// ---------------------------------------------------------------------------
describe("Calculations — unauthenticated", () => {
    it("returns 401 for GET /farms/:id/calculations/nitrogen-balance without key", async () => {
        const app = makeApp()
        const res = await app.request(
            `/farms/farm-1/calculations/nitrogen-balance?start=${START}&end=${END}`,
        )
        expect(res.status).toBe(401)
    })

    it("returns 401 for GET /farms/:id/calculations/organic-matter-balance without key", async () => {
        const app = makeApp()
        const res = await app.request(
            `/farms/farm-1/calculations/organic-matter-balance?start=${START}&end=${END}`,
        )
        expect(res.status).toBe(401)
    })

    it("returns 401 for GET /fields/:id/calculations/nitrogen-balance without key", async () => {
        const app = makeApp()
        const res = await app.request(
            `/fields/field-1/calculations/nitrogen-balance?start=${START}&end=${END}`,
        )
        expect(res.status).toBe(401)
    })

    it("returns 401 for GET /fields/:id/calculations/organic-matter-balance without key", async () => {
        const app = makeApp()
        const res = await app.request(
            `/fields/field-1/calculations/organic-matter-balance?start=${START}&end=${END}`,
        )
        expect(res.status).toBe(401)
    })

    it("returns 401 for GET /fields/:id/calculations/dose without key", async () => {
        const app = makeApp()
        const res = await app.request("/fields/field-1/calculations/dose")
        expect(res.status).toBe(401)
    })

    it("returns 401 for GET /farms/:id/calculations/norms without key", async () => {
        const app = makeApp()
        const res = await app.request("/farms/farm-1/calculations/norms?year=2025")
        expect(res.status).toBe(401)
    })

    it("returns 401 for GET /fields/:id/calculations/norms without key", async () => {
        const app = makeApp()
        const res = await app.request("/fields/field-1/calculations/norms?year=2025")
        expect(res.status).toBe(401)
    })

    // [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
    // it("returns 401 for GET /fields/:id/calculations/nutrient-advice without key", async () => {
    //     const app = makeApp()
    //     const res = await app.request("/fields/field-1/calculations/nutrient-advice")
    //     expect(res.status).toBe(401)
    // })

    // [MINERALIZATION: disabled — behind feature flag in fdm-app]
    // it("returns 401 for GET /fields/:id/calculations/nsupply without key", async () => {
    //     const app = makeApp()
    //     const res = await app.request("/fields/field-1/calculations/nsupply?year=2025&method=minip")
    //     expect(res.status).toBe(401)
    // })
    //
    // it("returns 401 for GET /fields/:id/calculations/dyna without key", async () => {
    //     const app = makeApp()
    //     const res = await app.request("/fields/field-1/calculations/dyna?year=2025")
    //     expect(res.status).toBe(401)
    // })
})

// ---------------------------------------------------------------------------
// Farm-level nitrogen balance
// ---------------------------------------------------------------------------
describe("GET /farms/:b_id_farm/calculations/nitrogen-balance", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        validKey()
    })

    it("returns 200 with nitrogen balance result", async () => {
        const collectInput = vi.fn().mockResolvedValue(mockNitrogenInput)
        const calculate = vi.fn().mockResolvedValue(mockNitrogenBalance)

        const app = makeApp({
            collectInputForNitrogenBalance: collectInput,
            calculateNitrogenBalance: calculate,
        })
        const res = await app.request(
            `/farms/farm-1/calculations/nitrogen-balance?start=${START}&end=${END}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.balance).toBe(15.5)
        expect(body.hasErrors).toBe(false)
        expect(collectInput).toHaveBeenCalledWith(
            mockFdm,
            "user-1",
            "farm-1",
            { start: new Date(START), end: new Date(END) },
        )
    })

    it("returns 400 when start date is missing", async () => {
        const app = makeApp()
        const res = await app.request(
            `/farms/farm-1/calculations/nitrogen-balance?end=${END}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(400)
    })

    it("returns 400 when end date is missing", async () => {
        const app = makeApp()
        const res = await app.request(
            `/farms/farm-1/calculations/nitrogen-balance?start=${START}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(400)
    })

    it("returns 400 when start > end", async () => {
        const app = makeApp()
        const res = await app.request(
            `/farms/farm-1/calculations/nitrogen-balance?start=${END}&end=${START}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(400)
    })
})

// ---------------------------------------------------------------------------
// Farm-level organic matter balance
// ---------------------------------------------------------------------------
describe("GET /farms/:b_id_farm/calculations/organic-matter-balance", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        validKey()
    })

    it("returns 200 with organic matter balance result", async () => {
        const collectInput = vi.fn().mockResolvedValue(mockOrganicMatterInput)
        const calculate = vi.fn().mockResolvedValue(mockOrganicMatterBalance)

        const app = makeApp({
            collectInputForOrganicMatterBalance: collectInput,
            calculateOrganicMatterBalance: calculate,
        })
        const res = await app.request(
            `/farms/farm-1/calculations/organic-matter-balance?start=${START}&end=${END}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.balance).toBe(1.2)
        expect(body.hasErrors).toBe(false)
    })

    it("returns 400 for invalid date format", async () => {
        const app = makeApp()
        const res = await app.request(
            `/farms/farm-1/calculations/organic-matter-balance?start=not-a-date&end=${END}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(400)
    })
})

// ---------------------------------------------------------------------------
// Field-level nitrogen balance
// ---------------------------------------------------------------------------
describe("GET /fields/:b_id/calculations/nitrogen-balance", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        validKey()
    })

    it("returns 200 with field nitrogen balance result", async () => {
        const getFieldFn = vi.fn().mockResolvedValue(mockField)
        const collectInput = vi.fn().mockResolvedValue(mockNitrogenInput)
        const getNitrogenField = vi
            .fn()
            .mockResolvedValue(mockFieldNitrogenBalance)

        const app = makeApp({
            getField: getFieldFn,
            collectInputForNitrogenBalance: collectInput,
            getNitrogenBalanceField: getNitrogenField,
        })
        const res = await app.request(
            `/fields/field-1/calculations/nitrogen-balance?start=${START}&end=${END}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.b_id).toBe("field-1")
        expect(body.b_area).toBe(5.0)
        expect(body.b_bufferstrip).toBe(false)
        expect(body.balance).toBeDefined()
        // getField should be called first to resolve b_id_farm
        expect(getFieldFn).toHaveBeenCalledWith(mockFdm, "user-1", "field-1")
        // collectInput should use the farm id from the field
        expect(collectInput).toHaveBeenCalledWith(
            mockFdm,
            "user-1",
            "farm-1",
            { start: new Date(START), end: new Date(END) },
            "field-1",
        )
    })

    it("returns 404 when field is not found", async () => {
        const getFieldFn = vi.fn().mockResolvedValue(null)

        const app = makeApp({ getField: getFieldFn })
        const res = await app.request(
            `/fields/no-such-field/calculations/nitrogen-balance?start=${START}&end=${END}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(404)
    })

    it("returns 400 when start > end", async () => {
        const app = makeApp()
        const res = await app.request(
            `/fields/field-1/calculations/nitrogen-balance?start=${END}&end=${START}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(400)
    })
})

// ---------------------------------------------------------------------------
// Field-level organic matter balance
// ---------------------------------------------------------------------------
describe("GET /fields/:b_id/calculations/organic-matter-balance", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        validKey()
    })

    it("returns 200 with field organic matter balance result", async () => {
        const getFieldFn = vi.fn().mockResolvedValue(mockField)
        const collectInput = vi.fn().mockResolvedValue(mockOrganicMatterInput)
        const getOmField = vi
            .fn()
            .mockResolvedValue(mockFieldOrganicMatterBalance)

        const app = makeApp({
            getField: getFieldFn,
            collectInputForOrganicMatterBalance: collectInput,
            getOrganicMatterBalanceField: getOmField,
        })
        const res = await app.request(
            `/fields/field-1/calculations/organic-matter-balance?start=${START}&end=${END}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.b_id).toBe("field-1")
        expect(body.b_area).toBe(5.0)
        expect(body.balance).toBeDefined()
    })

    it("returns 404 when field is not found", async () => {
        const getFieldFn = vi.fn().mockResolvedValue(null)

        const app = makeApp({ getField: getFieldFn })
        const res = await app.request(
            `/fields/no-such-field/calculations/organic-matter-balance?start=${START}&end=${END}`,
            { headers: { "x-api-key": "valid-key" } },
        )
        expect(res.status).toBe(404)
    })
})

// ---------------------------------------------------------------------------
// Field-level dose
// ---------------------------------------------------------------------------
describe("GET /fields/:b_id/calculations/dose", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        validKey()
    })

    it("returns 200 with dose result", async () => {
        const getFieldFn = vi.fn().mockResolvedValue(mockField)
        const getDose = vi.fn().mockResolvedValue(mockDose)

        const app = makeApp({
            getField: getFieldFn,
            getDoseForField: getDose,
        })
        const res = await app.request("/fields/field-1/calculations/dose", {
            headers: { "x-api-key": "valid-key" },
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.p_dose_n).toBe(100)
        expect(body.p_dose_p).toBe(40)
        expect(body.p_dose_k).toBe(60)
        // getField called before getDoseForField for 404 guard
        expect(getFieldFn).toHaveBeenCalledWith(mockFdm, "user-1", "field-1")
        expect(getDose).toHaveBeenCalledWith({
            fdm: mockFdm,
            principal_id: "user-1",
            b_id: "field-1",
        })
    })

    it("returns 404 when field is not found", async () => {
        const getFieldFn = vi.fn().mockResolvedValue(null)

        const app = makeApp({ getField: getFieldFn })
        const res = await app.request("/fields/no-such-field/calculations/dose", {
            headers: { "x-api-key": "valid-key" },
        })
        expect(res.status).toBe(404)
    })

    it("dose endpoint does not require timeframe query params", async () => {
        const getFieldFn = vi.fn().mockResolvedValue(mockField)
        const getDose = vi.fn().mockResolvedValue(mockDose)

        const app = makeApp({
            getField: getFieldFn,
            getDoseForField: getDose,
        })
        // No start/end — should still work
        const res = await app.request("/fields/field-1/calculations/dose", {
            headers: { "x-api-key": "valid-key" },
        })
        expect(res.status).toBe(200)
    })
})

// ---------------------------------------------------------------------------
// Norms
// ---------------------------------------------------------------------------
describe("GET /farms/:b_id_farm/calculations/norms", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        validKey()
    })

    it("returns 200 with farm norms result", async () => {
        const app = makeApp(mockNormsServices)
        const res = await app.request("/farms/farm-1/calculations/norms?year=2025", {
            headers: { "x-api-key": "valid-key" },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toEqual({
            b_id_farm: "farm-1",
            year: 2025,
            fields: [{ b_id: "field-1", ...mockFarmNorms }],
        })
    })

    it("returns 400 for unsupported year", async () => {
        const app = makeApp(mockNormsServices)
        const res = await app.request("/farms/farm-1/calculations/norms?year=2030", {
            headers: { "x-api-key": "valid-key" },
        })

        expect(res.status).toBe(400)
    })
})

describe("GET /fields/:b_id/calculations/norms", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        validKey()
    })

    it("returns 200 with field norms result", async () => {
        const app = makeApp(mockNormsServices)
        const res = await app.request("/fields/field-1/calculations/norms?year=2025", {
            headers: { "x-api-key": "valid-key" },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toEqual({
            b_id: "field-1",
            year: 2025,
            ...mockFarmNorms,
        })
    })
})

// ---------------------------------------------------------------------------
// Nutrient advice
// ---------------------------------------------------------------------------
// [NMI API: disabled — requires NMI credit/billing strategy before enabling via API]
// describe("GET /fields/:b_id/calculations/nutrient-advice", () => {
//     beforeEach(() => {
//         vi.clearAllMocks()
//         validKey()
//     })
//
//     it("returns 200 with nutrient advice", async () => {
//         vi.stubEnv("NMI_API_KEY", "test-nmi-key")
//
//         const app = makeApp(mockNutrientAdviceServices)
//         const res = await app.request("/fields/field-1/calculations/nutrient-advice", {
//             headers: { "x-api-key": "valid-key" },
//         })
//
//         expect(res.status).toBe(200)
//         const body = await res.json()
//         expect(body.b_id).toBe("field-1")
//         expect(body.d_n_req).toBe(150)
//     })
// })

// [MINERALIZATION: disabled — behind feature flag in fdm-app]
// describe("GET /fields/:b_id/calculations/nsupply", () => {
//     beforeEach(() => { vi.clearAllMocks(); validKey() })
//     it("returns 200 with nsupply result", async () => {
//         vi.stubEnv("NMI_API_KEY", "test-nmi-key")
//         const app = makeApp(mockNSupplyServices)
//         const res = await app.request("/fields/field-1/calculations/nsupply?year=2025&method=minip",
//             { headers: { "x-api-key": "valid-key" } })
//         expect(res.status).toBe(200)
//         const body = await res.json()
//         expect(body.b_id).toBe("field-1")
//         expect(body.method).toBe("minip")
//         expect(body.totalAnnualN).toBe(80)
//     })
// })
//
// describe("GET /fields/:b_id/calculations/dyna", () => {
//     beforeEach(() => { vi.clearAllMocks(); validKey() })
//     it("returns 200 with dyna result", async () => {
//         vi.stubEnv("NMI_API_KEY", "test-nmi-key")
//         const app = makeApp(mockDynaServices)
//         const res = await app.request("/fields/field-1/calculations/dyna?year=2025",
//             { headers: { "x-api-key": "valid-key" } })
//         expect(res.status).toBe(200)
//         const body = await res.json()
//         expect(body.b_id).toBe("field-1")
//         expect(body.nitrogenBalance.b_nw).toBe(100)
//         expect(body.fertilizingRecommendations).toBeNull()
//     })
// })
