import type { CurrentSoilData } from "@nmi-agro/fdm-core"
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest"
import { requestNutrientAdvice } from "./index"
import type { NutrientAdviceInputs, NutrientAdviceResponse } from "./types"

// Mock data for CurrentSoilData
const mockCurrentSoilData: CurrentSoilData = [
    {
        parameter: "a_nmin_cc",
        a_depth_lower: 30,
        value: 50,
        a_id: "",
        b_sampling_date: null,
        a_depth_upper: 0,
        a_source: null,
    },
    {
        parameter: "a_nmin_cc",
        a_depth_lower: 60,
        value: 70,
        a_id: "",
        b_sampling_date: null,
        a_depth_upper: 0,
        a_source: null,
    },
    {
        parameter: "a_som_loi",
        a_depth_lower: 0,
        value: 10,
        a_id: "",
        b_sampling_date: null,
        a_depth_upper: 0,
        a_source: null,
    },
]

// Mock response from the NMI API
const mockNutrientAdviceResponse: NutrientAdviceResponse = {
    request_id: "test-uuid",
    success: true,
    status: 200,
    message: null,
    data: {
        year: {
            d_n_req: 120,
            d_n_norm: 120,
            d_n_norm_man: 170,
            d_p_norm: 80,
            d_p_req: 80,
            d_k_req: 0,
            d_c_req: 2340,
            d_ca_req: 2180,
            d_s_req: 10,
            d_mg_req: 0,
            d_cu_req: 0,
            d_zn_req: 0,
            d_co_req: 0,
            d_mn_req: 0,
            d_mo_req: 0,
            d_na_req: 0,
            d_b_req: 0,
        },
    },
}

describe("requestNutrientAdvice", () => {
    // Mock the global fetch function
    beforeAll(() => {
        vi.stubGlobal("fetch", vi.fn())
    })

    afterEach(() => {
        vi.mocked(fetch).mockClear()
    })

    afterAll(() => {
        vi.restoreAllMocks()
    })

    it("should throw an error if nmiApiKey is not provided", async () => {
        const inputs: NutrientAdviceInputs = {
            b_lu_catalogue: "nl_2014",
            b_centroid: [4.3, 52.4],
            currentSoilData: mockCurrentSoilData,
            nmiApiKey: undefined,
        }

        await expect(requestNutrientAdvice(inputs)).rejects.toThrow(
            "NMI API key not provided",
        )
        expect(fetch).not.toHaveBeenCalled()
    })

    it("should successfully fetch nutrient advice from NMI API", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => mockNutrientAdviceResponse,
        } as Response)

        const inputs: NutrientAdviceInputs = {
            b_lu_catalogue: "nl_2014",
            b_centroid: [4.3, 52.4],
            currentSoilData: mockCurrentSoilData,
            nmiApiKey: "mock-api-key",
        }

        const result = await requestNutrientAdvice(inputs)

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
            "https://api.nmi-agro.nl/bemestingsplan/nutrients",
            expect.objectContaining({
                method: "POST",
                headers: {
                    Authorization: "Bearer mock-api-key",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    a_lon: 4.3,
                    a_lat: 52.4,
                    b_lu_brp: ["2014"],
                    a_nmin_cc_d30: 50,
                    a_nmin_cc_d60: 70,
                    a_som_loi: 10,
                }),
            }),
        )
        expect(result).toEqual(mockNutrientAdviceResponse.data.year)
    })

    it("should throw an error if NMI API request fails", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        } as Response)

        const inputs: NutrientAdviceInputs = {
            b_lu_catalogue: "nl_2014",
            b_centroid: [4.3, 52.4],
            currentSoilData: mockCurrentSoilData,
            nmiApiKey: "mock-api-key",
        }

        await expect(requestNutrientAdvice(inputs)).rejects.toThrow(
            "Request to NMI API failed",
        )
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it("should return zero advice for buffer strips without calling NMI API", async () => {
        const inputs: NutrientAdviceInputs = {
            b_lu_catalogue: "nl_2014",
            b_centroid: [4.3, 52.4],
            currentSoilData: mockCurrentSoilData,
            nmiApiKey: "mock-api-key",
            b_bufferstrip: true,
        }

        const result = await requestNutrientAdvice(inputs)

        expect(fetch).not.toHaveBeenCalled()
        expect(result.d_n_req).toBe(0)
        expect(result.d_p_req).toBe(0)
        expect(result.d_k_req).toBe(0)
    })
})
