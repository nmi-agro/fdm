import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest"
import { getBln3Score, requestBln3Score } from "./index"
import type { Bln3Score, Bln3ScoreInputs, Bln3ScoreResponse } from "./types"

const mockBln3ScoreResponse: Bln3ScoreResponse = {
    request_id: "test-uuid",
    success: true,
    status: 200,
    message: null,
    data: {
        indicator: [
            {
                indicator_id: "C_P",
                status: 4.9398,
                target: 6,
                index: 0.9752,
                impact: 0,
                score: 0.9752,
            },
            {
                indicator_id: "C_K",
                status: 0.7559,
                target: 30,
                index: 0.1748,
                impact: 0,
                score: 0.1748,
            },
        ],
    },
}

const baseInputs: Bln3ScoreInputs = {
    nmiApiKey: "mock-api-key",
    a_lat: 51.613,
    a_lon: 5.2,
}

describe("requestBln3Score", () => {
    beforeAll(() => {
        vi.stubGlobal("fetch", vi.fn())
    })

    afterEach(() => {
        vi.mocked(fetch).mockClear()
    })

    afterAll(() => {
        vi.restoreAllMocks()
    })

    it("should throw if nmiApiKey is not provided", async () => {
        const inputs: Bln3ScoreInputs = { ...baseInputs, nmiApiKey: undefined }
        await expect(requestBln3Score(inputs)).rejects.toThrow(
            "NMI API key not provided",
        )
        expect(fetch).not.toHaveBeenCalled()
    })

    it("should call the NMI API with correct URL, headers, and body", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => mockBln3ScoreResponse,
        } as Response)

        const inputs: Bln3ScoreInputs = {
            ...baseInputs,
            cultivations: [{ b_lu_brp: 266, b_lu_year: 2025 }],
            measures: [{ measure_id: "BM3", year: 2025 }],
        }

        await requestBln3Score(inputs)

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
            "https://api.nmi-agro.nl/maatwerk/bln3/score/field",
            expect.objectContaining({
                method: "POST",
                headers: {
                    Authorization: "Bearer mock-api-key",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    a_lat: 51.613,
                    a_lon: 5.2,
                    cultivations: [{ b_lu_brp: 266, b_lu_year: 2025 }],
                    measures: [{ measure_id: "BM3", year: 2025 }],
                }),
            }),
        )
    })

    it("should return mapped Bln3Score with indicators (plural)", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => mockBln3ScoreResponse,
        } as Response)

        const result = await requestBln3Score(baseInputs)

        expect(result).toEqual<Bln3Score>({
            indicators: mockBln3ScoreResponse.data.indicator,
            aggregations: undefined,
        })
    })

    it("should throw if the NMI API returns a non-ok response", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            text: vi.fn().mockResolvedValue("upstream error"),
        } as unknown as Response)

        await expect(requestBln3Score(baseInputs)).rejects.toThrow(
            "BLN3 score request failed with status 500",
        )
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it("should rethrow network errors from fetch", async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error("Network connection lost"))

        await expect(requestBln3Score(baseInputs)).rejects.toThrow(
            "Network connection lost",
        )
    })

    it("should map AbortError to a specific timeout message", async () => {
        const abortError = new Error("The operation was aborted")
        abortError.name = "AbortError"
        vi.mocked(fetch).mockRejectedValueOnce(abortError)

        await expect(requestBln3Score(baseInputs)).rejects.toThrow(
            "BLN3 score request timed out (30s). The NMI API did not respond in time.",
        )
    })
})

// getBln3Score is the cached wrapper around requestBln3Score via withCalculationCache.
// Cache behaviour is tested thoroughly in fdm-core/src/calculator.test.ts.
// We just verify the export exists and has the correct shape.
it("getBln3Score should be a function", () => {
    expect(typeof getBln3Score).toBe("function")
})
