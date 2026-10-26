import type { FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import {
  adjustEndDateAtYearStart,
  getEnabledMeasureCatalogues,
  getField,
  getFields,
  getMeasures,
  getMeasuresFromCatalogue,
} from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Bln3Score } from "./types"
import { getBln3MeasureAdvice, getBln3MeasureApplicability, getBln3Score } from "./api"
import { IndicatorsUnavailableError } from "./errors"
import {
  getFarmIndicators,
  getFieldIndicators,
  getFieldMeasureOptions,
  getYearTimeframe,
} from "./index"
import { collectInputForBln3MeasureApplicability, collectInputForBln3Score } from "./input"

vi.mock("@nmi-agro/fdm-core", async () => {
  const actual = await vi.importActual("@nmi-agro/fdm-core")
  return {
    ...actual,
    getEnabledMeasureCatalogues: vi.fn(),
    getField: vi.fn(),
    getFields: vi.fn(),
    getMeasures: vi.fn(),
    getMeasuresFromCatalogue: vi.fn(),
  }
})

vi.mock("./api", () => ({
  getBln3MeasureAdvice: vi.fn(),
  getBln3MeasureApplicability: vi.fn(),
  getBln3Score: vi.fn(),
}))

vi.mock("./input", () => ({
  collectInputForBln3MeasureApplicability: vi.fn(),
  collectInputForBln3Score: vi.fn(),
}))

const mockedGetBln3Score = vi.mocked(getBln3Score)
const mockedGetBln3MeasureApplicability = vi.mocked(getBln3MeasureApplicability)
const mockedGetBln3MeasureAdvice = vi.mocked(getBln3MeasureAdvice)
const mockedCollectScore = vi.mocked(collectInputForBln3Score)
const mockedCollectApplicability = vi.mocked(collectInputForBln3MeasureApplicability)
const mockedGetFields = vi.mocked(getFields)
const mockedGetField = vi.mocked(getField)
const mockedGetMeasures = vi.mocked(getMeasures)
const mockedGetMeasuresFromCatalogue = vi.mocked(getMeasuresFromCatalogue)
const mockedGetEnabledMeasureCatalogues = vi.mocked(getEnabledMeasureCatalogues)

// Domain functions are mocked, so the FDM instance is never used
const mockFdm = {} as FdmType
const principal_id: PrincipalId = "test-principal"
const nmiApiKey = "mock-api-key"
const year = 2026

const score = (value: number): Bln3Score => ({
  indicators: [
    { indicator_id: "C_N", status: 1, target: 2, index: value, impact: 0, score: value },
  ],
  aggregations: [{ aggregation_id: "S_BLN", score: value }],
})

const scoreInputs = { a_lat: 51.6, a_lon: 5.2 } as Awaited<
  ReturnType<typeof collectInputForBln3Score>
>
const excludedScoreInputs = { ...scoreInputs, isExcluded: true } as Awaited<
  ReturnType<typeof collectInputForBln3Score>
>

describe("getYearTimeframe", () => {
  it("should start at 1 January 00:00 in Europe/Amsterdam", () => {
    expect(getYearTimeframe(2026).start?.toISOString()).toBe("2025-12-31T23:00:00.000Z")
  })

  it("should end at 31 December 23:59:59.999 in Europe/Amsterdam", () => {
    expect(getYearTimeframe(2026).end?.toISOString()).toBe("2026-12-31T22:59:59.999Z")
  })

  it("should end at the same moment as an end date on 1 January of the next year", () => {
    expect(getYearTimeframe(2026).end?.getTime()).toBe(
      adjustEndDateAtYearStart(new Date("2027-01-01")).getTime(),
    )
  })
})

describe("getFieldIndicators", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return the score of the field for the calendar year", async () => {
    mockedCollectScore.mockResolvedValueOnce(scoreInputs)
    mockedGetBln3Score.mockResolvedValueOnce(score(0.5))

    const result = await getFieldIndicators(mockFdm, principal_id, "field-1", year, nmiApiKey)

    expect(result).toEqual({ b_id: "field-1", year, is_excluded: false, score: score(0.5) })
    expect(mockedCollectScore).toHaveBeenCalledWith(
      mockFdm,
      principal_id,
      "field-1",
      getYearTimeframe(year),
    )
    expect(mockedGetBln3Score).toHaveBeenCalledWith(mockFdm, { ...scoreInputs, nmiApiKey })
  })

  it("should return an excluded field without score and without an API key", async () => {
    mockedCollectScore.mockResolvedValueOnce(excludedScoreInputs)

    const result = await getFieldIndicators(mockFdm, principal_id, "field-1", year, undefined)

    expect(result).toEqual({ b_id: "field-1", year, is_excluded: true, score: null })
    expect(mockedGetBln3Score).not.toHaveBeenCalled()
  })

  it("should throw IndicatorsUnavailableError when no API key is configured", async () => {
    mockedCollectScore.mockResolvedValueOnce(scoreInputs)

    await expect(
      getFieldIndicators(mockFdm, principal_id, "field-1", year, undefined),
    ).rejects.toThrow(IndicatorsUnavailableError)
    expect(mockedGetBln3Score).not.toHaveBeenCalled()
  })

  it("should wrap a failing score request in IndicatorsUnavailableError", async () => {
    const cause = new Error("NMI API unavailable")
    mockedCollectScore.mockResolvedValueOnce(scoreInputs)
    mockedGetBln3Score.mockRejectedValueOnce(cause)

    const error = await getFieldIndicators(mockFdm, principal_id, "field-1", year, nmiApiKey).catch(
      (err: unknown) => err,
    )

    expect(error).toBeInstanceOf(IndicatorsUnavailableError)
    expect((error as Error).cause).toBe(cause)
  })

  it("should throw IndicatorsUnavailableError when no score is returned", async () => {
    mockedCollectScore.mockResolvedValueOnce(scoreInputs)
    mockedGetBln3Score.mockResolvedValueOnce(null)

    await expect(
      getFieldIndicators(mockFdm, principal_id, "field-1", year, nmiApiKey),
    ).rejects.toThrow(IndicatorsUnavailableError)
  })
})

describe("getFarmIndicators", () => {
  const fields = Array.from({ length: 6 }, (_, i) => ({
    b_id: `field-${i + 1}`,
    b_area: i + 1,
  })) as Awaited<ReturnType<typeof getFields>>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should score all eligible fields across batches and weight the farm scores by area", async () => {
    mockedGetFields.mockResolvedValueOnce(fields)
    // Six fields span two batches; field-6 is excluded
    mockedCollectScore.mockImplementation(async (_fdm, _principal, b_id) =>
      b_id === "field-6" ? excludedScoreInputs : scoreInputs,
    )
    mockedGetBln3Score.mockResolvedValue(score(0.5))

    const result = await getFarmIndicators(mockFdm, principal_id, "farm-1", year, nmiApiKey)

    expect(mockedGetFields).toHaveBeenCalledWith(
      mockFdm,
      principal_id,
      "farm-1",
      getYearTimeframe(year),
    )
    expect(mockedCollectScore).toHaveBeenCalledTimes(6)
    expect(result.b_id_farm).toBe("farm-1")
    expect(result.year).toBe(year)
    expect(result.fields.map((f) => f.b_id)).toEqual([
      "field-1",
      "field-2",
      "field-3",
      "field-4",
      "field-5",
    ])
    expect(result.farm).toEqual({
      indicators: [{ indicator_id: "C_N", score: 0.5 }],
      aggregations: [{ aggregation_id: "S_BLN", score: 0.5 }],
    })
  })

  it("should weight the farm scores by field area", async () => {
    mockedGetFields.mockResolvedValueOnce(fields.slice(0, 2))
    mockedCollectScore.mockResolvedValue(scoreInputs)
    // field-1 (1 ha) scores 0.2, field-2 (2 ha) scores 0.8
    mockedGetBln3Score.mockResolvedValueOnce(score(0.2)).mockResolvedValueOnce(score(0.8))

    const result = await getFarmIndicators(mockFdm, principal_id, "farm-1", year, nmiApiKey)

    expect(result.farm.aggregations[0].score).toBeCloseTo(0.6)
  })

  it("should return empty scores for a farm without fields", async () => {
    mockedGetFields.mockResolvedValueOnce([])

    const result = await getFarmIndicators(mockFdm, principal_id, "farm-1", year, nmiApiKey)

    expect(result).toEqual({
      b_id_farm: "farm-1",
      year,
      fields: [],
      farm: { indicators: [], aggregations: [] },
    })
  })

  it("should fail as a whole when one eligible field cannot be scored", async () => {
    mockedGetFields.mockResolvedValueOnce(fields.slice(0, 2))
    mockedCollectScore.mockResolvedValue(scoreInputs)
    mockedGetBln3Score.mockResolvedValueOnce(score(0.5)).mockResolvedValueOnce(null)

    await expect(
      getFarmIndicators(mockFdm, principal_id, "farm-1", year, nmiApiKey),
    ).rejects.toThrow(IndicatorsUnavailableError)
  })
})

describe("getFieldMeasureOptions", () => {
  const applicabilityInputs = { a_lat: 51.6, a_lon: 5.2, b_year: year } as Awaited<
    ReturnType<typeof collectInputForBln3MeasureApplicability>
  >
  const catalogue = [
    {
      m_id: "bln_BM1",
      m_source: "bln",
      m_name: "Measure BM1",
      m_description: "desc",
      m_summary: null,
      m_source_url: null,
      m_conflicts: null,
      m_stage_applicability: "field",
    },
    {
      m_id: "bln_BM2",
      m_source: "bln",
      m_name: "Measure BM2",
      m_description: "desc",
      m_summary: null,
      m_source_url: null,
      m_conflicts: null,
      m_stage_applicability: "field",
    },
  ] as Awaited<ReturnType<typeof getMeasuresFromCatalogue>>
  const applicability = {
    applicability: [
      { m_id: "bln_BM1", applicability: "applicable" as const, message: "" },
      { m_id: "bln_BM2", applicability: "applicable" as const, message: "" },
    ],
  }
  const advice = {
    indicator_advice: [{ indicator: "C_N", measures: [{ m_id: "bln_BM1", measure_impact: 0.2 }] }],
  }

  /** Sets up a field that is scored and has `bln_BM2` already adopted. */
  function setupEligibleField() {
    mockedGetField.mockResolvedValueOnce({ b_id: "field-1", b_id_farm: "farm-1" } as Awaited<
      ReturnType<typeof getField>
    >)
    mockedCollectApplicability.mockResolvedValueOnce(applicabilityInputs)
    mockedGetMeasuresFromCatalogue.mockResolvedValueOnce(catalogue)
    mockedGetEnabledMeasureCatalogues.mockResolvedValueOnce(["bln"])
    mockedGetMeasures.mockResolvedValueOnce([
      { b_id_measure: "measure-1", m_id: "bln_BM2", m_conflicts: null },
    ] as Awaited<ReturnType<typeof getMeasures>>)
    mockedCollectScore.mockResolvedValueOnce(scoreInputs)
    mockedGetBln3Score.mockResolvedValueOnce(score(0.3))
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return the measure options of the field with recommendations", async () => {
    setupEligibleField()
    mockedGetBln3MeasureApplicability.mockResolvedValueOnce(applicability)
    mockedGetBln3MeasureAdvice.mockResolvedValueOnce(advice)

    const result = await getFieldMeasureOptions(mockFdm, principal_id, "field-1", year, nmiApiKey)

    expect(result.b_id).toBe("field-1")
    expect(result.year).toBe(year)
    expect(result.is_excluded).toBe(false)
    expect(mockedGetEnabledMeasureCatalogues).toHaveBeenCalledWith(mockFdm, principal_id, "farm-1")
    expect(mockedGetMeasures).toHaveBeenCalledWith(
      mockFdm,
      principal_id,
      "field-1",
      getYearTimeframe(year),
    )
    expect(mockedCollectApplicability).toHaveBeenCalledWith(
      mockFdm,
      principal_id,
      "field-1",
      year,
      getYearTimeframe(year),
    )
    const bm1 = result.data.find((o) => o.m_id === "bln_BM1")
    const bm2 = result.data.find((o) => o.m_id === "bln_BM2")
    expect(bm1?.recommendation?.rank).toBe(1)
    expect(bm2?.active_measures).toEqual(["measure-1"])
  })

  it("should return no options for an excluded field without an API key", async () => {
    mockedGetField.mockResolvedValueOnce({ b_id: "field-1", b_id_farm: "farm-1" } as Awaited<
      ReturnType<typeof getField>
    >)
    mockedCollectApplicability.mockResolvedValueOnce({
      ...applicabilityInputs,
      isExcluded: true,
    })

    const result = await getFieldMeasureOptions(mockFdm, principal_id, "field-1", year, undefined)

    expect(result).toEqual({ b_id: "field-1", year, is_excluded: true, data: [] })
    expect(mockedGetBln3MeasureApplicability).not.toHaveBeenCalled()
    expect(mockedGetBln3MeasureAdvice).not.toHaveBeenCalled()
  })

  it("should throw IndicatorsUnavailableError when no API key is configured", async () => {
    mockedGetField.mockResolvedValueOnce({ b_id: "field-1", b_id_farm: "farm-1" } as Awaited<
      ReturnType<typeof getField>
    >)
    mockedCollectApplicability.mockResolvedValueOnce(applicabilityInputs)

    await expect(
      getFieldMeasureOptions(mockFdm, principal_id, "field-1", year, undefined),
    ).rejects.toThrow(IndicatorsUnavailableError)
  })

  it("should throw IndicatorsUnavailableError when the field score is unavailable", async () => {
    setupEligibleField()
    mockedGetBln3Score.mockReset().mockResolvedValueOnce(null)

    await expect(
      getFieldMeasureOptions(mockFdm, principal_id, "field-1", year, nmiApiKey),
    ).rejects.toThrow(IndicatorsUnavailableError)
    expect(mockedGetBln3MeasureAdvice).not.toHaveBeenCalled()
  })

  it("should wrap a failing applicability or advice request in IndicatorsUnavailableError", async () => {
    const cause = new Error("NMI API unavailable")
    setupEligibleField()
    mockedGetBln3MeasureApplicability.mockRejectedValueOnce(cause)
    mockedGetBln3MeasureAdvice.mockResolvedValueOnce(advice)

    const error = await getFieldMeasureOptions(
      mockFdm,
      principal_id,
      "field-1",
      year,
      nmiApiKey,
    ).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(IndicatorsUnavailableError)
    expect((error as Error).cause).toBe(cause)
  })

  it("should throw IndicatorsUnavailableError when no advice is returned", async () => {
    setupEligibleField()
    mockedGetBln3MeasureApplicability.mockResolvedValueOnce(applicability)
    mockedGetBln3MeasureAdvice.mockResolvedValueOnce(null)

    await expect(
      getFieldMeasureOptions(mockFdm, principal_id, "field-1", year, nmiApiKey),
    ).rejects.toThrow(IndicatorsUnavailableError)
  })
})
