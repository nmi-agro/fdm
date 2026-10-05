import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type {
  Bln3MeasureAdviceInputs,
  Bln3MeasureAdviceResponse,
  Bln3MeasureAdviceResult,
  Bln3MeasureApplicabilityInputs,
  Bln3MeasureApplicabilityResponse,
  Bln3MeasureApplicabilityResult,
  Bln3Score,
  Bln3ScoreInputs,
  Bln3ScoreResponse,
} from "./types"
import {
  getBln3MeasureAdvice,
  getBln3MeasureApplicability,
  getBln3Score,
  requestBln3MeasureAdvice,
  requestBln3MeasureApplicability,
  requestBln3Score,
} from "./api"

describe("BLN3 score", () => {
  // Default NmiApiClient timeout (60s) plus margin for the retry back-off
  const ATTEMPT_STEP_MS = 62_000

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

    it("should return null immediately without calling fetch if isExcluded is true", async () => {
      const inputs: Bln3ScoreInputs = {
        ...baseInputs,
        nmiApiKey: undefined,
        isExcluded: true,
      }
      const result = await requestBln3Score(inputs)
      expect(result).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it("should return null immediately without calling fetch if b_bufferstrip is true", async () => {
      const inputs: Bln3ScoreInputs = {
        ...baseInputs,
        nmiApiKey: undefined,
        b_bufferstrip: true,
      }
      const result = await requestBln3Score(inputs)
      expect(result).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it("should return null immediately without calling fetch if b_lu_croprotation is nature", async () => {
      const inputs: Bln3ScoreInputs = {
        ...baseInputs,
        nmiApiKey: undefined,
        b_lu_croprotation: "nature",
      }
      const result = await requestBln3Score(inputs)
      expect(result).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it("should return null immediately without calling fetch if b_lu_catalogue is nl_343 or nl_6801", async () => {
      const inputs: Bln3ScoreInputs = {
        ...baseInputs,
        nmiApiKey: undefined,
        b_lu_catalogue: "nl_343",
      }
      const result = await requestBln3Score(inputs)
      expect(result).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it("should throw if nmiApiKey is not provided", async () => {
      const inputs: Bln3ScoreInputs = { ...baseInputs, nmiApiKey: undefined }
      await expect(requestBln3Score(inputs)).rejects.toThrow("NMI API key not provided")
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
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: vi.fn().mockResolvedValue("upstream error"),
      } as unknown as Response)

      await expect(requestBln3Score(baseInputs)).rejects.toThrow(
        "BLN3 score request failed with status 500",
      )
      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it("should throw if the NMI API returns success: false", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          status: 400,
          message: "semantic failure message",
        }),
      } as Response)

      await expect(requestBln3Score(baseInputs)).rejects.toThrow(
        "BLN3 score API returned failure (status 400): semantic failure message",
      )
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it("should throw if the NMI API returns a malformed payload", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 200,
          data: {}, // Missing indicator
        }),
      } as Response)

      await expect(requestBln3Score(baseInputs)).rejects.toThrow(
        "BLN3 score API returned a malformed payload",
      )
    })

    it("should rethrow network errors from fetch", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network connection lost"))

      await expect(requestBln3Score(baseInputs)).rejects.toThrow("Network connection lost")
    })

    it("should map AbortError to a specific timeout message", async () => {
      vi.useFakeTimers()

      try {
        vi.mocked(fetch).mockImplementation((_url, options) => {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              reject(options?.signal?.reason)
            })
          })
        })

        const assertion = expect(requestBln3Score(baseInputs)).rejects.toThrow(
          "BLN3 score request timed out. The NMI API did not respond in time.",
        )

        try {
          await vi.advanceTimersByTimeAsync(ATTEMPT_STEP_MS)
          await vi.advanceTimersByTimeAsync(ATTEMPT_STEP_MS)
          await vi.advanceTimersByTimeAsync(ATTEMPT_STEP_MS)
        } finally {
          await assertion
        }
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe("getBln3Score cache semantics", () => {
    let mockRows: any[] = []
    const mockFdm = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => ({
        // eslint-disable-next-line unicorn/no-thenable -- Mocking third-party query objects with custom `.then` is necessary to simulate Drizzle ORM cache behaviors.
        then: (cb: any) => Promise.resolve(cb(mockRows)),
      })),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      catch: vi.fn().mockResolvedValue(undefined),
    } as any

    const mockResult: Bln3Score = {
      indicators: mockBln3ScoreResponse.data.indicator,
    }

    beforeAll(() => {
      vi.stubGlobal("fetch", vi.fn())
    })

    afterEach(() => {
      mockRows = []
      vi.clearAllMocks()
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    it("should call fetch and store result on cache miss", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBln3ScoreResponse,
      } as Response)

      mockRows = [] // Cache miss

      const result = await getBln3Score(mockFdm, baseInputs)

      expect(result).toEqual(mockResult)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(mockFdm.select).toHaveBeenCalled()
      expect(mockFdm.insert).toHaveBeenCalled()
    })

    it("should return cached result on cache hit without calling fetch", async () => {
      mockRows = [{ result: mockResult }] // Cache hit

      const result = await getBln3Score(mockFdm, baseInputs)

      expect(result).toEqual(mockResult)
      expect(fetch).not.toHaveBeenCalled()
      expect(mockFdm.select).toHaveBeenCalled()
      expect(mockFdm.insert).not.toHaveBeenCalled()
    })

    it("should proceed with calculation and log error if cache read fails", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBln3ScoreResponse,
      } as Response)

      // Mock select chain to throw
      mockFdm.limit.mockImplementationOnce(() => ({
        // eslint-disable-next-line unicorn/no-thenable -- Mocking third-party query objects with custom `.then` is necessary to simulate Drizzle ORM cache behaviors.
        then: () => Promise.reject(new Error("DB Error")),
      }))
      const spyConsole = vi.spyOn(console, "error").mockImplementation(() => {})

      const result = await getBln3Score(mockFdm, baseInputs)

      expect(result).toEqual(mockResult)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(spyConsole).toHaveBeenCalledWith(
        expect.stringContaining("Failed to read from calculation cache"),
      )
      spyConsole.mockRestore()
    })
  })

  // getBln3Score is the cached wrapper around requestBln3Score via withCalculationCache.
  // Cache behaviour is tested thoroughly in fdm-core/src/calculator.test.ts.
  // We just verify the export exists and has the correct shape.
  it("getBln3Score should be a function", () => {
    expect(typeof getBln3Score).toBe("function")
  })
})

describe("BLN3 measure applicability", () => {
  // Default NmiApiClient timeout (60s) plus margin for the retry back-off
  const ATTEMPT_STEP_MS = 62_000

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

    it("should return empty applicability immediately without calling fetch if isExcluded is true", async () => {
      const inputs: Bln3MeasureApplicabilityInputs = {
        ...baseInputs,
        nmiApiKey: undefined,
        isExcluded: true,
      }
      const result = await requestBln3MeasureApplicability(inputs)
      expect(result).toEqual({ applicability: [] })
      expect(fetch).not.toHaveBeenCalled()
    })

    it("should return empty applicability immediately without calling fetch if b_bufferstrip is true", async () => {
      const inputs: Bln3MeasureApplicabilityInputs = {
        ...baseInputs,
        nmiApiKey: undefined,
        b_bufferstrip: true,
      }
      const result = await requestBln3MeasureApplicability(inputs)
      expect(result).toEqual({ applicability: [] })
      expect(fetch).not.toHaveBeenCalled()
    })

    it("should return empty applicability immediately without calling fetch if b_lu_croprotation is nature", async () => {
      const inputs: Bln3MeasureApplicabilityInputs = {
        ...baseInputs,
        nmiApiKey: undefined,
        b_lu_croprotation: "nature",
      }
      const result = await requestBln3MeasureApplicability(inputs)
      expect(result).toEqual({ applicability: [] })
      expect(fetch).not.toHaveBeenCalled()
    })

    it("should return empty applicability immediately without calling fetch if b_lu_catalogue is nl_6801", async () => {
      const inputs: Bln3MeasureApplicabilityInputs = {
        ...baseInputs,
        nmiApiKey: undefined,
        b_lu_catalogue: "nl_6801",
      }
      const result = await requestBln3MeasureApplicability(inputs)
      expect(result).toEqual({ applicability: [] })
      expect(fetch).not.toHaveBeenCalled()
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
      vi.mocked(fetch).mockResolvedValue({
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

      try {
        vi.mocked(fetch).mockImplementation((_url, options) => {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              reject(options?.signal?.reason)
            })
          })
        })

        const assertion = expect(requestBln3MeasureApplicability(baseInputs)).rejects.toThrow(
          "BLN3 measure applicability request timed out. The NMI API did not respond in time.",
        )

        try {
          await vi.advanceTimersByTimeAsync(ATTEMPT_STEP_MS)
          await vi.advanceTimersByTimeAsync(ATTEMPT_STEP_MS)
          await vi.advanceTimersByTimeAsync(ATTEMPT_STEP_MS)
        } finally {
          await assertion
        }
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe("getBln3MeasureApplicability function export", () => {
    it("getBln3MeasureApplicability should be a function", () => {
      expect(typeof getBln3MeasureApplicability).toBe("function")
    })
  })
})

describe("BLN3 measure advice", () => {
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
})
