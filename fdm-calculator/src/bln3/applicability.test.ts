import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type {
  Bln3MeasureApplicabilityInputs,
  Bln3MeasureApplicabilityResponse,
  Bln3MeasureApplicabilityResult,
} from "./types"
import { getBln3MeasureApplicability, requestBln3MeasureApplicability } from "./applicability"

const mockApplicabilityResponse: Bln3MeasureApplicabilityResponse = {
  request_id: "test-uuid",
  success: true,
  status: 200,
  message: null,
  data: {
    applicability: [
      {
        m_id: "BM86",
        applicability: "not yet applicable",
        message: "Gewascategorie is niet geschikt.",
      },
      {
        m_id: "BM93",
        applicability: "applicable",
        message: "",
      },
      {
        m_id: "BM206",
        applicability: "inapplicable",
        message: "Bodemtype ongeschikt.",
      },
    ],
  },
}

const baseInputs: Bln3MeasureApplicabilityInputs = {
  nmiApiKey: "mock-api-key",
  a_lat: 51.613,
  a_lon: 5.2,
  b_year: 2026,
}

describe("requestBln3MeasureApplicability", () => {
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
    const inputs: Bln3MeasureApplicabilityInputs = {
      ...baseInputs,
      nmiApiKey: undefined,
    }
    await expect(requestBln3MeasureApplicability(inputs)).rejects.toThrow(
      "NMI API key not provided",
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it("should call NMI API with correct URL, headers, and body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApplicabilityResponse,
    } as Response)

    const inputs: Bln3MeasureApplicabilityInputs = {
      ...baseInputs,
      cultivations: [{ b_lu_brp: 266, b_lu_year: 2025 }],
    }

    await requestBln3MeasureApplicability(inputs)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      "https://api.nmi-agro.nl/maatwerk/bln3/measure/applicability",
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
      json: async () => mockApplicabilityResponse,
    } as Response)

    const result = await requestBln3MeasureApplicability(baseInputs)

    expect(result).toEqual<Bln3MeasureApplicabilityResult>({
      applicability: [
        {
          m_id: "bln_BM86",
          applicability: "not yet applicable",
          message: "Gewascategorie is niet geschikt.",
        },
        {
          m_id: "bln_BM93",
          applicability: "applicable",
          message: "",
        },
        {
          m_id: "bln_BM206",
          applicability: "inapplicable",
          message: "Bodemtype ongeschikt.",
        },
      ],
    })
  })

  it("should preserve measure IDs that are already prefixed with 'bln_'", async () => {
    const responseWithPrefixed: Bln3MeasureApplicabilityResponse = {
      ...mockApplicabilityResponse,
      data: {
        applicability: [
          {
            m_id: "bln_BM86",
            applicability: "applicable",
            message: "",
          },
        ],
      },
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => responseWithPrefixed,
    } as Response)

    const result = await requestBln3MeasureApplicability(baseInputs)

    expect(result.applicability[0].m_id).toBe("bln_BM86")
  })

  it("should throw if the NMI API returns a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: vi.fn().mockResolvedValue("upstream error"),
    } as unknown as Response)

    await expect(requestBln3MeasureApplicability(baseInputs)).rejects.toThrow(
      "BLN3 measure applicability request failed with status 500",
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

    await expect(requestBln3MeasureApplicability(baseInputs)).rejects.toThrow(
      "BLN3 measure applicability API returned failure (status 400): Invalid input",
    )
  })

  it("should throw if response payload is missing applicability array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        status: 200,
        data: {},
      }),
    } as Response)

    await expect(requestBln3MeasureApplicability(baseInputs)).rejects.toThrow(
      "BLN3 measure applicability API returned a malformed payload",
    )
  })

  it("should throw if an item in the applicability array is malformed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        status: 200,
        data: {
          applicability: [{ m_id: "", applicability: "invalid_status", message: null }],
        },
      }),
    } as unknown as Response)

    await expect(requestBln3MeasureApplicability(baseInputs)).rejects.toThrow(
      "BLN3 measure applicability API returned a malformed payload (invalid item in applicability array)",
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

    const promise = requestBln3MeasureApplicability(baseInputs)
    vi.advanceTimersByTime(30000)

    await expect(promise).rejects.toThrow(
      "BLN3 measure applicability request timed out (30s). The NMI API did not respond in time.",
    )
    vi.useRealTimers()
  })
})

describe("getBln3MeasureApplicability function export", () => {
  it("getBln3MeasureApplicability should be a function", () => {
    expect(typeof getBln3MeasureApplicability).toBe("function")
  })
})

describe("getBln3MeasureApplicability exclusion short-circuit", () => {
  const mockFdm = {} as any

  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.mocked(fetch).mockClear()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it("should return { applicability: [] } without calling fetch when inputs are excluded (buffer strip / nature field)", async () => {
    const result = await getBln3MeasureApplicability(mockFdm, { ...baseInputs, excluded: true })

    expect(result).toEqual<Bln3MeasureApplicabilityResult>({ applicability: [] })
    expect(fetch).not.toHaveBeenCalled()
  })
})
