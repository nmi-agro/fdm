import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type {
  Bln3MeasureAdviceInputs,
  Bln3MeasureAdviceResponse,
  Bln3MeasureAdviceResult,
} from "./types"
import { getBln3MeasureAdvice, requestBln3MeasureAdvice } from "./advice"

const mockAdviceResponse: Bln3MeasureAdviceResponse = {
  request_id: "test-uuid",
  success: true,
  status: 200,
  message: null,
  data: {
    indicator_advice: [
      {
        indicator: "B_DI",
        measures: [{ m_id: "BM201", measure_impact: 0.0001 }],
      },
      {
        indicator: "C_K",
        measures: [
          { m_id: "BM226", measure_impact: 1.6504 },
          { m_id: "BM177", measure_impact: 0.2063 },
        ],
      },
      {
        indicator: "C_N",
        measures: [],
      },
    ],
  },
}

const baseInputs: Bln3MeasureAdviceInputs = {
  nmiApiKey: "mock-api-key",
  a_lat: 51.613,
  a_lon: 5.2,
  b_year: 2026,
}

describe("requestBln3MeasureAdvice", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.mocked(fetch).mockClear()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it("should return null immediately without calling fetch if isExcluded is true", async () => {
    const inputs: Bln3MeasureAdviceInputs = {
      ...baseInputs,
      nmiApiKey: undefined,
      isExcluded: true,
    }
    const result = await requestBln3MeasureAdvice(inputs)
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("should return null immediately without calling fetch if b_bufferstrip is true", async () => {
    const inputs: Bln3MeasureAdviceInputs = {
      ...baseInputs,
      nmiApiKey: undefined,
      b_bufferstrip: true,
    }
    const result = await requestBln3MeasureAdvice(inputs)
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("should return null immediately without calling fetch if b_lu_croprotation is nature", async () => {
    const inputs: Bln3MeasureAdviceInputs = {
      ...baseInputs,
      nmiApiKey: undefined,
      b_lu_croprotation: "nature",
    }
    const result = await requestBln3MeasureAdvice(inputs)
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("should return null immediately without calling fetch if b_lu_catalogue is nl_343", async () => {
    const inputs: Bln3MeasureAdviceInputs = {
      ...baseInputs,
      nmiApiKey: undefined,
      b_lu_catalogue: "nl_343",
    }
    const result = await requestBln3MeasureAdvice(inputs)
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("should throw if nmiApiKey is not provided", async () => {
    const inputs: Bln3MeasureAdviceInputs = {
      ...baseInputs,
      nmiApiKey: undefined,
    }
    await expect(requestBln3MeasureAdvice(inputs)).rejects.toThrow("NMI API key not provided")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("should call NMI API with correct URL, headers, and body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAdviceResponse,
    } as Response)

    const inputs: Bln3MeasureAdviceInputs = {
      ...baseInputs,
      cultivations: [{ b_lu_brp: 266, b_lu_year: 2025 }],
    }

    await requestBln3MeasureAdvice(inputs)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      "https://api.nmi-agro.nl/maatwerk/bln3/measure/advice",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer mock-api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          a_lat: 51.613,
          a_lon: 5.2,
          b_year: 2026,
          cultivations: [{ b_lu_brp: 266, b_lu_year: 2025 }],
        }),
      }),
    )
  })

  it("should prefix measure IDs with 'bln_' in response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAdviceResponse,
    } as Response)

    const result = await requestBln3MeasureAdvice(baseInputs)

    expect(result).toEqual<Bln3MeasureAdviceResult>({
      indicator_advice: [
        {
          indicator: "B_DI",
          measures: [{ m_id: "bln_BM201", measure_impact: 0.0001 }],
        },
        {
          indicator: "C_K",
          measures: [
            { m_id: "bln_BM226", measure_impact: 1.6504 },
            { m_id: "bln_BM177", measure_impact: 0.2063 },
          ],
        },
        {
          indicator: "C_N",
          measures: [],
        },
      ],
    })
  })

  it("should preserve measure IDs that are already prefixed with 'bln_'", async () => {
    const responseWithPrefixed: Bln3MeasureAdviceResponse = {
      ...mockAdviceResponse,
      data: {
        indicator_advice: [
          {
            indicator: "C_K",
            measures: [{ m_id: "bln_BM226", measure_impact: 1.6504 }],
          },
        ],
      },
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => responseWithPrefixed,
    } as Response)

    const result = await requestBln3MeasureAdvice(baseInputs)

    expect(result?.indicator_advice[0].measures[0].m_id).toBe("bln_BM226")
  })

  it("should throw if the NMI API returns a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: vi.fn().mockResolvedValue("upstream error"),
    } as unknown as Response)

    await expect(requestBln3MeasureAdvice(baseInputs)).rejects.toThrow(
      "BLN3 measure advice request failed with status 500",
    )
  })

  it("should throw if the NMI API returns success: false", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        status: 400,
        message: "Invalid input",
      }),
    } as Response)

    await expect(requestBln3MeasureAdvice(baseInputs)).rejects.toThrow(
      "BLN3 measure advice API returned failure (status 400): Invalid input",
    )
  })

  it("should throw if response payload is missing indicator_advice array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        status: 200,
        data: {},
      }),
    } as Response)

    await expect(requestBln3MeasureAdvice(baseInputs)).rejects.toThrow(
      "BLN3 measure advice API returned a malformed payload (missing data or indicator_advice array)",
    )
  })

  it("should throw if an entry in the indicator_advice array is malformed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        status: 200,
        data: {
          indicator_advice: [{ indicator: "", measures: [] }],
        },
      }),
    } as unknown as Response)

    await expect(requestBln3MeasureAdvice(baseInputs)).rejects.toThrow(
      "BLN3 measure advice API returned a malformed payload (invalid item in indicator_advice array)",
    )
  })

  it("should throw if a measure within an indicator_advice entry is malformed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        status: 200,
        data: {
          indicator_advice: [
            { indicator: "C_K", measures: [{ m_id: "", measure_impact: "not-a-number" }] },
          ],
        },
      }),
    } as unknown as Response)

    await expect(requestBln3MeasureAdvice(baseInputs)).rejects.toThrow(
      "BLN3 measure advice API returned a malformed payload (invalid measure in indicator_advice array)",
    )
  })

  it("should handle request timeout via AbortError", async () => {
    vi.useFakeTimers()
    const abortError = new DOMException("The operation was aborted", "AbortError")

    vi.mocked(fetch).mockImplementationOnce((_url, options) => {
      const signal = options?.signal
      return new Promise((_resolve, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => reject(abortError))
        }
      })
    })

    const promise = requestBln3MeasureAdvice(baseInputs)
    vi.advanceTimersByTime(30000)

    await expect(promise).rejects.toThrow(
      "BLN3 measure advice request timed out (30s). The NMI API did not respond in time.",
    )
    vi.useRealTimers()
  })
})

describe("getBln3MeasureAdvice function export", () => {
  it("getBln3MeasureAdvice should be a function", () => {
    expect(typeof getBln3MeasureAdvice).toBe("function")
  })
})
