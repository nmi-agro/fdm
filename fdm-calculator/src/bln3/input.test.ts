import type {
  Cultivation,
  CurrentSoilData,
  FdmType,
  FertilizerApplication,
  Field,
  Measure,
  PrincipalId,
  SoilAnalysis,
  Timeframe,
} from "@nmi-agro/fdm-core"
import {
  getCultivations,
  getCultivationsForFarm,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getField,
  getFields,
  getMeasures,
  getMeasuresForFarm,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  collectInputForBln3MeasureApplicability,
  collectInputForBln3MeasureApplicabilityForFarm,
  collectInputForBln3Score,
  collectInputForBln3ScoreForFarm,
} from "./input"

vi.mock("@nmi-agro/fdm-core", async () => {
  const actual = await vi.importActual("@nmi-agro/fdm-core")
  return {
    ...actual,
    getField: vi.fn(),
    getFields: vi.fn(),
    getSoilAnalyses: vi.fn(),
    getSoilAnalysesForFarm: vi.fn(),
    getCurrentSoilData: vi.fn(),
    getCurrentSoilDataForFarm: vi.fn(),
    getCultivations: vi.fn(),
    getCultivationsForFarm: vi.fn(),
    getMeasures: vi.fn(),
    getMeasuresForFarm: vi.fn(),
    getFertilizerApplications: vi.fn(),
    getFertilizerApplicationsForFarm: vi.fn(),
  }
})

vi.mock("../estimates", () => ({
  getSoilParameterEstimates: vi.fn(),
}))

const mockedGetField = vi.mocked(getField)
const mockedGetSoilAnalyses = vi.mocked(getSoilAnalyses)
const mockedGetCultivations = vi.mocked(getCultivations)
const mockedGetMeasures = vi.mocked(getMeasures)
const mockedGetFertilizerApplications = vi.mocked(getFertilizerApplications)
const mockedGetFields = vi.mocked(getFields)
const mockedGetSoilAnalysesForFarm = vi.mocked(getSoilAnalysesForFarm)
const mockedGetCultivationsForFarm = vi.mocked(getCultivationsForFarm)
const mockedGetMeasuresForFarm = vi.mocked(getMeasuresForFarm)
const mockedGetFertilizerApplicationsForFarm = vi.mocked(getFertilizerApplicationsForFarm)
const mockedGetCurrentSoilData = vi.mocked(getCurrentSoilData)
const mockedGetCurrentSoilDataForFarm = vi.mocked(getCurrentSoilDataForFarm)

/** Soil analysis keys that are not soil parameters of the current soil data. */
const NON_PARAMETER_KEYS = new Set([
  "a_id",
  "a_date",
  "a_source",
  "b_id",
  "b_sampling_date",
  "a_depth_upper",
  "a_depth_lower",
  "b_sampling_geometry",
  "b_sampling_geometry_zone",
])

/**
 * Derives the current soil data of a field without sampling zones from its soil analyses
 * (newest first): per parameter the value of the most recent analysis that has one. Like
 * `getCurrentSoilData`, the BodemConditieScore parameters are not included.
 */
function toCurrentSoilData(soilAnalyses: SoilAnalysis[]): CurrentSoilData {
  const items: CurrentSoilData = []
  const records = soilAnalyses as unknown as Record<string, unknown>[]
  const parameters = new Set(records.flatMap((analysis) => Object.keys(analysis)))
  for (const parameter of parameters) {
    if (NON_PARAMETER_KEYS.has(parameter) || parameter.endsWith("_bcs")) continue
    const analysis = records.find((a) => a[parameter] != null)
    if (!analysis) continue
    items.push({
      parameter: parameter as CurrentSoilData[number]["parameter"],
      value: analysis[parameter] as number | string,
      is_aggregated: false,
      coverage: null,
      has_coverage_warning: false,
      sources: [],
    })
  }
  return items
}

/**
 * The tests describe soil data as soil analyses. The current soil data mocks derive their result
 * from the soil analyses set up in a test, as for fields without sampling zones. A test can still
 * set its own current soil data, for example for a field with sampling zones.
 */
function deriveCurrentSoilDataFromSoilAnalyses() {
  mockedGetCurrentSoilData.mockImplementation(async () => {
    const analyses = await mockedGetSoilAnalyses.getMockImplementation()?.(
      mockFdm,
      "",
      "",
      undefined,
    )
    return toCurrentSoilData(analyses ?? [])
  })
  mockedGetCurrentSoilDataForFarm.mockImplementation(async () => {
    const analysesByField = await mockedGetSoilAnalysesForFarm.getMockImplementation()?.(
      mockFdm,
      "",
      "",
      undefined,
    )
    return new Map(
      [...(analysesByField ?? new Map<string, SoilAnalysis[]>())].map(([id, analyses]) => [
        id,
        toCurrentSoilData(analyses),
      ]),
    )
  })
}

// Minimal FdmType mock — collect functions don't use transactions
const mockFdm = {} as FdmType
const principal_id: PrincipalId = "test-principal"
const b_id = "field-1"
const timeframe: Timeframe = {
  start: new Date("2024-01-01"),
  end: new Date("2024-12-31"),
}

// Base field: centroid [lon, lat] = [5.2, 51.6]
const mockField: Field = {
  b_id,
  b_name: "Test field",
  b_id_farm: "farm-1",
  b_id_source: null,
  b_geometry: null,
  b_centroid: [5.2, 51.6],
  b_area: 10,
  b_perimeter: 400,
  b_start: new Date("2020-01-01"),
  b_end: null,
  b_acquiring_method: "unknown",
  b_bufferstrip: false,
}

// Soil analysis with assorted a_* fields and metadata
const mockSoilAnalysis: SoilAnalysis = {
  a_id: "sa-1",
  a_date: new Date("2023-06-01"),
  a_source: "lab",
  b_soiltype_agr: "dekzand",
  b_gwl_class: "IIb",
  a_som_loi: 4.5,
  a_clay_mi: 10,
  a_p_cc: 1.2,
  a_p_al: 42,
  a_n_rt: 2500,
  // Non-numeric fields that must NOT appear in the API payload
  a_depth_upper: 0,
  a_depth_lower: 30,
} as unknown as SoilAnalysis

// Cultivation with a valid nl_ BRP catalogue code
const mockCultivation: Cultivation = {
  b_lu: "cult-1",
  b_lu_catalogue: "nl_266",
  b_lu_start: new Date("2024-03-15"),
  b_lu_end: new Date("2024-09-01"),
  b_lu_source: "nl",
  b_lu_name: "Maize",
  b_lu_name_en: "Maize",
  b_lu_hcat3: "hcat3",
  b_lu_hcat3_name: "Hcat3",
  b_lu_croprotation: "maize",
  b_lu_eom: 1,
  b_lu_eom_residue: 1,
  b_lu_harvestcat: "HC010",
  b_lu_harvestable: "once",
  b_lu_variety: null,
  m_cropresidue: false,
  b_id,
} as unknown as Cultivation

// BLN measure
const mockMeasure: Measure = {
  b_id_measure: "meas-1",
  m_id: "bln_BM3",
  b_id,
  m_start: new Date("2024-01-01"),
  m_end: null,
  m_name: "Niet-kerende grondbewerking",
  m_summary: null,
  m_conflicts: null,
}

describe("collectInputForBln3Score", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    deriveCurrentSoilDataFromSoilAnalyses()
  })

  it("should return lat/lon from field centroid", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    // b_centroid = [lon, lat]
    expect(result.a_lon).toBe(5.2)
    expect(result.a_lat).toBe(51.6)
  })

  it("should map soil analysis: b_soiltype_agr and b_gwl_class", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.b_soiltype_agr).toBe("dekzand")
    expect(result.b_gwl_class).toBe("IIb")
  })

  it("should include only BLN3-relevant soil analysis fields", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    // Fields present in mockSoilAnalysis that are BLN3-relevant
    expect(result.a_p_cc).toBe(1.2)
    expect(result.a_p_al).toBe(42)
    expect(result.a_som_loi).toBe(4.5)
    expect(result.a_clay_mi).toBe(10)
    expect(result.a_n_rt).toBe(2500)
    // a_p_wa is not in mockSoilAnalysis so should be absent
    expect(result).not.toHaveProperty("a_p_wa")
    // Non-BLN3 depth fields must never appear
    expect(result).not.toHaveProperty("a_depth_upper")
    expect(result).not.toHaveProperty("a_depth_lower")
  })

  it("should exclude non-numeric and metadata fields from soil analysis", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result).not.toHaveProperty("a_id")
    expect(result).not.toHaveProperty("a_date")
    expect(result).not.toHaveProperty("a_source")
  })

  it("should use the first (most recent) soil analysis when multiple exist", async () => {
    const olderAnalysis: SoilAnalysis = {
      ...mockSoilAnalysis,
      a_id: "sa-old",
      b_soiltype_agr: "veen",
      a_p_cc: 99,
    }
    mockedGetField.mockResolvedValue(mockField)
    // getSoilAnalyses returns most-recent first (DESC by sampling date)
    mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis, olderAnalysis])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.b_soiltype_agr).toBe("dekzand") // from first (mockSoilAnalysis)
    expect(result.a_p_cc).toBe(1.2) // from first (mockSoilAnalysis)
  })

  it("should omit b_soiltype_agr and b_gwl_class when no soil analyses exist", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.b_soiltype_agr).toBeUndefined()
    expect(result.b_gwl_class).toBeUndefined()
  })

  it("should map a cultivation with nl_ catalogue to { b_lu_brp, b_lu_year }", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.cultivations).toEqual([{ b_lu_brp: 266, b_lu_year: 2024 }])
  })

  it("should skip cultivations with non-nl_ catalogue codes", async () => {
    const foreign: Cultivation = {
      ...mockCultivation,
      b_lu_catalogue: "de_12345",
    }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([foreign])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.cultivations).toBeUndefined()
  })

  it("should skip cultivations where b_lu_start is null", async () => {
    const noStart: Cultivation = { ...mockCultivation, b_lu_start: null }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([noStart])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.cultivations).toBeUndefined()
  })

  it("should skip cultivations where b_lu_start is null even when timeframe is provided", async () => {
    const noStart: Cultivation = { ...mockCultivation, b_lu_start: null }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([noStart])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result.cultivations).toBeUndefined()
  })

  it("should omit cultivations key entirely when no valid cultivations exist", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result).not.toHaveProperty("cultivations")
  })

  it("should map a bln_ measure to { measure_id, year }", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([mockMeasure])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.measures).toEqual([{ measure_id: "BM3", year: 2024 }])
  })

  it("should skip measures without the bln_ prefix", async () => {
    const nonBln: Measure = { ...mockMeasure, m_id: "other_BM3" }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([nonBln])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.measures).toBeUndefined()
  })

  it("should skip measures where m_start is null and no timeframe is provided", async () => {
    const noStart: Measure = { ...mockMeasure, m_start: null }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([noStart])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.measures).toBeUndefined()
  })

  it("should use timeframe.end year as fallback when measure m_start is null", async () => {
    const noStart: Measure = { ...mockMeasure, m_start: null }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([noStart])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result.measures).toEqual([{ measure_id: "BM3", year: 2024 }])
  })

  it("should omit measures key entirely when no valid measures exist", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result).not.toHaveProperty("measures")
  })

  it("should combine all data sources in a full happy-path call", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetMeasures.mockResolvedValue([mockMeasure])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result.a_lat).toBe(51.6)
    expect(result.a_lon).toBe(5.2)
    expect(result.b_soiltype_agr).toBe("dekzand")
    expect(result.b_gwl_class).toBe("IIb")
    expect(result.a_p_cc).toBe(1.2)
    expect(result.a_p_al).toBe(42)
    expect(result.a_som_loi).toBe(4.5)
    expect(result.cultivations).toEqual([{ b_lu_brp: 266, b_lu_year: 2024 }])
    expect(result.measures).toEqual([{ measure_id: "BM3", year: 2024 }])
  })

  it("should wrap errors from fdm-core with a descriptive message", async () => {
    mockedGetField.mockRejectedValue(new Error("DB connection lost"))
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    await expect(collectInputForBln3Score(mockFdm, principal_id, b_id)).rejects.toThrow(
      `Failed to collect BLN3 score inputs for field ${b_id}`,
    )
  })

  it("should pass the timeframe to soil and measures calls but NOT to cultivations", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(mockedGetCurrentSoilData).toHaveBeenCalledWith(mockFdm, principal_id, b_id, {
      start: undefined,
      end: timeframe.end,
    })
    expect(mockedGetSoilAnalyses).toHaveBeenCalledWith(mockFdm, principal_id, b_id, {
      start: undefined,
      end: timeframe.end,
    })
    // Cultivations are fetched without timeframe to get the full history
    expect(mockedGetCultivations).toHaveBeenCalledWith(mockFdm, principal_id, b_id)
    expect(mockedGetMeasures).toHaveBeenCalledWith(mockFdm, principal_id, b_id, timeframe)
  })

  it("should take lab values, soil type and groundwater class from the current soil data", async () => {
    // A field with two sampling zones: the current soil data holds the area-weighted mean and the
    // soil type with the largest area, while the latest analysis alone says otherwise
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
    mockedGetCurrentSoilData.mockResolvedValue([
      { parameter: "a_p_al", value: 35.5, is_aggregated: true },
      { parameter: "a_som_loi", value: 3.8, is_aggregated: true },
      { parameter: "b_soiltype_agr", value: "zeeklei", is_aggregated: true },
      { parameter: "b_gwl_class", value: "IV", is_aggregated: true },
      // Not used by BLN3
      { parameter: "a_zn_cc", value: 1, is_aggregated: false },
    ] as CurrentSoilData)
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result).toMatchObject({
      a_p_al: 35.5,
      a_som_loi: 3.8,
      b_soiltype_agr: "zeeklei",
      b_gwl_class: "IV",
    })
    // Values of the latest analysis that the current soil data lacks are not added
    expect(result).not.toHaveProperty("a_clay_mi")
    expect(result).not.toHaveProperty("a_zn_cc")
  })

  it("should take the BodemConditieScore from the soil analyses, not the current soil data", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([
      { ...mockSoilAnalysis, a_ss_bcs: 2, a_rd_bcs: 0 } as unknown as SoilAnalysis,
    ])
    mockedGetCurrentSoilData.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result).toMatchObject({ a_ss_bcs: 2, a_rd_bcs: 0 })
    expect(result).not.toHaveProperty("a_p_al")
  })

  it("should assign years using the May 15–July 15 hoofdteelt rule, not b_lu_start year", async () => {
    // Grass sown Oct 15, 2024 — NOT the hoofdteelt for 2024 (sown after the window),
    // but IS the hoofdteelt for 2025 and 2026.
    const grass: Cultivation = {
      ...mockCultivation,
      b_lu_catalogue: "nl_265",
      b_lu_start: new Date("2024-10-15"),
      b_lu_end: null,
    }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([grass])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, {
      start: new Date("2026-01-01"),
      end: new Date("2026-12-31"),
    })

    // Range is 2024–2026 (earliest b_lu_start is Oct 2024 → minYear = 2024)
    // 2026 and 2025: grass covers the full May-July window → b_lu_brp 265
    // 2024: grass starts Oct 2024, after the window → groene braak → b_lu_brp 6794
    expect(result.cultivations).toEqual([
      { b_lu_brp: 265, b_lu_year: 2026 },
      { b_lu_brp: 265, b_lu_year: 2025 },
      { b_lu_brp: 6794, b_lu_year: 2024 },
    ])
    expect(
      result.cultivations?.find((c) => c.b_lu_year === 2024 && c.b_lu_brp === 265),
    ).toBeUndefined()
  })

  it("should include BCS scores from a BCS-only analysis record", async () => {
    const bcsAnalysis: SoilAnalysis = {
      ...mockSoilAnalysis,
      a_id: "sa-bcs",
      a_source: "visual",
      // Lab fields absent (null)
      a_som_loi: null,
      a_clay_mi: null,
      a_p_cc: null,
      a_p_al: null,
      a_n_rt: null,
      b_soiltype_agr: null,
      b_gwl_class: null,
      // BCS fields present
      a_ss_bcs: 1,
      a_sc_bcs: 2,
      a_rd_bcs: 0,
      a_ew_bcs: 1,
      a_cc_bcs: 2,
      a_gs_bcs: 1,
      a_p_bcs: 0,
      a_c_bcs: 1,
      a_rt_bcs: 2,
    } as unknown as SoilAnalysis

    mockedGetField.mockResolvedValue(mockField)
    // BCS record is most recent; lab record is older
    mockedGetSoilAnalyses.mockResolvedValue([bcsAnalysis, mockSoilAnalysis])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    // BCS scores from newest (BCS) record
    expect(result.a_ss_bcs).toBe(1)
    expect(result.a_sc_bcs).toBe(2)
    expect(result.a_rd_bcs).toBe(0)
    expect(result.a_ew_bcs).toBe(1)
    expect(result.a_cc_bcs).toBe(2)
    expect(result.a_gs_bcs).toBe(1)
    expect(result.a_p_bcs).toBe(0)
    expect(result.a_c_bcs).toBe(1)
    expect(result.a_rt_bcs).toBe(2)
    // Lab fields from older lab record (per-parameter selection)
    expect(result.a_som_loi).toBe(4.5)
    expect(result.a_p_cc).toBe(1.2)
    expect(result.a_n_rt).toBe(2500)
    // Categorical from older lab record
    expect(result.b_soiltype_agr).toBe("dekzand")
    expect(result.b_gwl_class).toBe("IIb")
  })

  it("should include BCS scores from an older BCS record when newest is lab-only", async () => {
    const labAnalysis: SoilAnalysis = {
      ...mockSoilAnalysis,
      a_id: "sa-lab-new",
      // No BCS scores
      a_ss_bcs: null,
      a_sc_bcs: null,
    } as unknown as SoilAnalysis

    const bcsAnalysis: SoilAnalysis = {
      ...mockSoilAnalysis,
      a_id: "sa-bcs-old",
      a_source: "visual",
      a_som_loi: null,
      a_p_cc: null,
      a_ss_bcs: 2,
      a_ew_bcs: 1,
    } as unknown as SoilAnalysis

    mockedGetField.mockResolvedValue(mockField)
    // Newest is lab-only; BCS record is older
    mockedGetSoilAnalyses.mockResolvedValue([labAnalysis, bcsAnalysis])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    // BCS scores from older BCS record
    expect(result.a_ss_bcs).toBe(2)
    expect(result.a_ew_bcs).toBe(1)
    // Lab fields from newest lab record
    expect(result.a_som_loi).toBe(4.5)
    expect(result.a_p_cc).toBe(1.2)
  })

  it("should preserve BCS score of 0 (not treated as falsy)", async () => {
    const bcsAnalysis: SoilAnalysis = {
      ...mockSoilAnalysis,
      a_id: "sa-bcs-zero",
      a_source: "visual",
      a_som_loi: null,
      a_ss_bcs: 0,
      a_p_bcs: 0,
    } as unknown as SoilAnalysis

    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([bcsAnalysis])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.a_ss_bcs).toBe(0)
    expect(result.a_p_bcs).toBe(0)
  })

  it("should omit BCS fields entirely when no BCS analysis exists", async () => {
    mockedGetField.mockResolvedValue(mockField)
    // Only lab analysis, no BCS scores
    mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result).not.toHaveProperty("a_ss_bcs")
    expect(result).not.toHaveProperty("a_sc_bcs")
    expect(result).not.toHaveProperty("a_ew_bcs")
  })

  it("should mark isExcluded and b_bufferstrip when field is a buffer strip", async () => {
    mockedGetField.mockResolvedValue({ ...mockField, b_bufferstrip: true })
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result.b_bufferstrip).toBe(true)
    expect(result.isExcluded).toBe(true)
  })

  it("should mark isExcluded when main cultivation crop rotation is nature", async () => {
    const natureCultivation: Cultivation = {
      ...mockCultivation,
      b_lu_catalogue: "nl_331",
      b_lu_croprotation: "nature",
    }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([natureCultivation])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result.b_lu_croprotation).toBe("nature")
    expect(result.isExcluded).toBe(true)
  })

  it("should mark isExcluded when main cultivation is sloot (nl_343) or schouwpad (nl_6801)", async () => {
    const ditchCultivation: Cultivation = {
      ...mockCultivation,
      b_lu_catalogue: "nl_343",
      b_lu_croprotation: "other",
    }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([ditchCultivation])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result.b_lu_catalogue).toBe("nl_343")
    expect(result.isExcluded).toBe(true)
    expect(result.exclusionReason).toBe("nature")
  })

  it("should set b_year to the year of the timeframe", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result.b_year).toBe(2024)
    expect(result.isExcluded).toBeUndefined()
    expect(result.exclusionReason).toBeUndefined()
  })

  it("should set b_year to the latest cultivation year without a timeframe", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id)

    expect(result.b_year).toBe(2024)
    expect(result.isExcluded).toBeUndefined()
  })

  it("should use the latest year with a main cultivation for a multi-year timeframe", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, {
      start: new Date("2020-01-01"),
      end: new Date("2027-12-31"),
    })

    expect(result.b_year).toBe(2024)
    expect(result.isExcluded).toBeUndefined()
  })

  it("should exclude a field without any main cultivation for a multi-year timeframe", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, {
      start: new Date("2020-01-01"),
      end: new Date("2027-12-31"),
    })

    expect(result.b_year).toBe(2027)
    expect(result.exclusionReason).toBe("no_main_cultivation")
  })

  it("should exclude a year without a main cultivation", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, {
      start: new Date("2026-01-01"),
      end: new Date("2026-12-31"),
    })

    expect(result.b_year).toBe(2026)
    expect(result.isExcluded).toBe(true)
    expect(result.exclusionReason).toBe("no_main_cultivation")
  })

  it("should give the buffer strip reason precedence over a missing main cultivation", async () => {
    mockedGetField.mockResolvedValue({ ...mockField, b_bufferstrip: true })
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetMeasures.mockResolvedValue([])

    const result = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)

    expect(result.exclusionReason).toBe("bufferstrip")
  })
})

import { findHoofdteelt } from "../shared/hoofdteelt"

describe("collectInputForBln3MeasureApplicability", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    deriveCurrentSoilDataFromSoilAnalyses()
  })

  it("should collect applicability inputs including b_year and excluding measures", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([mockSoilAnalysis])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetFertilizerApplications.mockResolvedValue([])

    const result = await collectInputForBln3MeasureApplicability(
      mockFdm,
      principal_id,
      b_id,
      2026,
      timeframe,
    )

    expect(result.a_lat).toBe(51.6)
    expect(result.a_lon).toBe(5.2)
    expect(result.b_year).toBe(2026)
    expect(result.b_soiltype_agr).toBe("dekzand")
    expect(result.b_gwl_class).toBe("IIb")
    expect(result.a_som_loi).toBe(4.5)
    expect(result.cultivations).toEqual([{ b_lu_brp: 266, b_lu_year: 2024 }])
    expect(result).not.toHaveProperty("measures")
  })

  it("should read the soil values only from the current soil data", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetCurrentSoilData.mockResolvedValue([
      { parameter: "a_som_loi", value: 3.8, is_aggregated: true },
      { parameter: "b_gwl_class", value: "IV", is_aggregated: true },
    ] as CurrentSoilData)
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetFertilizerApplications.mockResolvedValue([])

    const result = await collectInputForBln3MeasureApplicability(
      mockFdm,
      principal_id,
      b_id,
      2026,
      timeframe,
    )

    expect(result).toMatchObject({ a_som_loi: 3.8, b_gwl_class: "IV" })
    expect(mockedGetCurrentSoilData).toHaveBeenCalledWith(mockFdm, principal_id, b_id, {
      start: undefined,
      end: timeframe.end,
    })
    // The applicability needs no BodemConditieScore, so the soil analyses are not read
    expect(mockedGetSoilAnalyses).not.toHaveBeenCalled()
  })

  it("should collect p_app_method from fertilizer applications", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetFertilizerApplications.mockResolvedValue([
      { p_app_method: "slotted coulter" } as unknown as FertilizerApplication,
      { p_app_method: "injection" } as unknown as FertilizerApplication,
      { p_app_method: "slotted coulter" } as unknown as FertilizerApplication,
    ])

    const result = await collectInputForBln3MeasureApplicability(mockFdm, principal_id, b_id, 2026)

    expect(result.p_app_method).toEqual(["slotted coulter", "injection"])
  })

  it("should omit cultivations if none exist", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetFertilizerApplications.mockResolvedValue([])

    const result = await collectInputForBln3MeasureApplicability(mockFdm, principal_id, b_id, 2026)

    expect(result.a_lat).toBe(51.6)
    expect(result.a_lon).toBe(5.2)
    expect(result.b_year).toBe(2026)
    expect(result).not.toHaveProperty("cultivations")
    expect(result).not.toHaveProperty("measures")
  })

  it("should wrap errors from fdm-core with a descriptive message", async () => {
    mockedGetField.mockRejectedValue(new Error("DB error"))
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([])
    mockedGetFertilizerApplications.mockResolvedValue([])

    await expect(
      collectInputForBln3MeasureApplicability(mockFdm, principal_id, b_id, 2026),
    ).rejects.toThrow(`Failed to collect BLN3 measure applicability inputs for field ${b_id}`)
  })

  it("should mark isExcluded when field is a buffer strip", async () => {
    mockedGetField.mockResolvedValue({ ...mockField, b_bufferstrip: true })
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetFertilizerApplications.mockResolvedValue([])

    const result = await collectInputForBln3MeasureApplicability(mockFdm, principal_id, b_id, 2024)

    expect(result.b_bufferstrip).toBe(true)
    expect(result.isExcluded).toBe(true)
  })

  it("should mark isExcluded when main cultivation in b_year is nature", async () => {
    const natureCultivation: Cultivation = {
      ...mockCultivation,
      b_lu_catalogue: "nl_331",
      b_lu_croprotation: "nature",
    }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([natureCultivation])
    mockedGetFertilizerApplications.mockResolvedValue([])

    const result = await collectInputForBln3MeasureApplicability(mockFdm, principal_id, b_id, 2024)

    expect(result.b_lu_croprotation).toBe("nature")
    expect(result.isExcluded).toBe(true)
  })

  it("should mark isExcluded when main cultivation in b_year is schouwpad (nl_6801)", async () => {
    const padCultivation: Cultivation = {
      ...mockCultivation,
      b_lu_catalogue: "nl_6801",
      b_lu_croprotation: "other",
    }
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([padCultivation])
    mockedGetFertilizerApplications.mockResolvedValue([])

    const result = await collectInputForBln3MeasureApplicability(mockFdm, principal_id, b_id, 2024)

    expect(result.b_lu_catalogue).toBe("nl_6801")
    expect(result.isExcluded).toBe(true)
    expect(result.exclusionReason).toBe("nature")
  })

  it("should not exclude a year with a main cultivation", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetFertilizerApplications.mockResolvedValue([])

    const result = await collectInputForBln3MeasureApplicability(mockFdm, principal_id, b_id, 2024)

    expect(result.isExcluded).toBeUndefined()
    expect(result.exclusionReason).toBeUndefined()
  })

  it("should exclude a b_year without a main cultivation", async () => {
    mockedGetField.mockResolvedValue(mockField)
    mockedGetSoilAnalyses.mockResolvedValue([])
    mockedGetCultivations.mockResolvedValue([mockCultivation])
    mockedGetFertilizerApplications.mockResolvedValue([])

    const result = await collectInputForBln3MeasureApplicability(mockFdm, principal_id, b_id, 2026)

    expect(result.b_year).toBe(2026)
    expect(result.isExcluded).toBe(true)
    expect(result.exclusionReason).toBe("no_main_cultivation")
  })
})

describe("findHoofdteelt boundary and tie-break cases", () => {
  it("counts a cultivation that spans exactly May 15–July 15 as in-window", () => {
    const result = findHoofdteelt(
      [
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date("2024-05-15"),
          b_lu_end: new Date("2024-07-15"),
        },
      ],
      2024,
    )
    expect(result.b_lu_catalogue).toBe("nl_265")
  })

  it("excludes a cultivation that starts exactly on July 15 (zero-length overlap)", () => {
    // effectiveStart === effectiveEnd → condition effectiveEnd > effectiveStart is false
    const result = findHoofdteelt(
      [
        {
          b_lu_catalogue: "nl_265",
          b_lu_start: new Date("2024-07-15"),
          b_lu_end: null,
        },
      ],
      2024,
    )
    expect(result.b_lu_catalogue).toBe("nl_6794") // groene braak
  })

  it("resolves a tie by choosing the alphabetically-first b_lu_catalogue", () => {
    // Both cultivations cover the exact same May 15–July 15 window
    const result = findHoofdteelt(
      [
        {
          b_lu_catalogue: "nl_999",
          b_lu_start: new Date("2024-05-15"),
          b_lu_end: new Date("2024-07-15"),
        },
        {
          b_lu_catalogue: "nl_100",
          b_lu_start: new Date("2024-05-15"),
          b_lu_end: new Date("2024-07-15"),
        },
      ],
      2024,
    )
    expect(result.b_lu_catalogue).toBe("nl_100")
  })
})

describe("farm collectors give the same inputs as the field collectors", () => {
  // The farm collectors read their data in a transaction
  const txFdm = {} as FdmType
  const farmFdm = {
    transaction: (fn: (tx: FdmType) => unknown) => fn(txFdm),
  } as unknown as FdmType
  const b_id_farm = "farm-1"

  /** The data of one synthetic field, as returned by the getters. */
  type Scenario = {
    name: string
    field: Field
    soilAnalyses: SoilAnalysis[]
    cultivations: Cultivation[]
    measures: Measure[]
    fertilizerApplications: FertilizerApplication[]
    timeframe?: Timeframe
  }

  const bcsAnalysis = {
    ...mockSoilAnalysis,
    a_id: "sa-bcs",
    a_date: new Date("2024-02-01"),
    a_ss_bcs: 1,
    a_rd_bcs: 0,
    a_som_loi: undefined,
  } as unknown as SoilAnalysis
  const estimate = {
    ...mockSoilAnalysis,
    a_id: "sa-estimate",
    a_date: null,
    a_source: "nl-other-nmi",
    a_cec_co: 120,
  } as unknown as SoilAnalysis
  const grass = {
    ...mockCultivation,
    b_lu: "cult-grass",
    b_lu_catalogue: "nl_265",
    b_lu_start: new Date("2022-03-01"),
    b_lu_end: null,
    b_lu_croprotation: "grass",
  } as unknown as Cultivation
  const application = {
    p_app_id: "app-1",
    p_app_method: "injection",
    p_app_date: new Date("2024-03-01"),
  } as unknown as FertilizerApplication

  const scenarios: Scenario[] = [
    {
      name: "a field with all data in a single-year timeframe",
      field: mockField,
      soilAnalyses: [bcsAnalysis, mockSoilAnalysis, estimate],
      cultivations: [mockCultivation, grass],
      measures: [mockMeasure, { ...mockMeasure, m_id: "other_X1", b_id_measure: "meas-2" }],
      fertilizerApplications: [application, { ...application, p_app_id: "app-2" }],
      timeframe,
    },
    {
      name: "a field with all data without a timeframe",
      field: mockField,
      soilAnalyses: [mockSoilAnalysis],
      cultivations: [mockCultivation, grass],
      measures: [{ ...mockMeasure, m_start: null } as unknown as Measure],
      fertilizerApplications: [application],
    },
    {
      name: "a field in a multi-year timeframe",
      field: mockField,
      soilAnalyses: [mockSoilAnalysis],
      cultivations: [mockCultivation, grass],
      measures: [mockMeasure],
      fertilizerApplications: [],
      timeframe: { start: new Date("2020-01-01"), end: new Date("2026-12-31") },
    },
    {
      name: "a buffer strip",
      field: { ...mockField, b_bufferstrip: true },
      soilAnalyses: [],
      cultivations: [grass],
      measures: [],
      fertilizerApplications: [],
      timeframe,
    },
    {
      name: "a nature field",
      field: mockField,
      soilAnalyses: [mockSoilAnalysis],
      cultivations: [
        { ...mockCultivation, b_lu_catalogue: "nl_331", b_lu_croprotation: "nature" },
      ] as Cultivation[],
      measures: [],
      fertilizerApplications: [],
      timeframe,
    },
    {
      name: "a field without a main cultivation",
      field: mockField,
      soilAnalyses: [mockSoilAnalysis],
      cultivations: [
        { ...mockCultivation, b_lu_start: new Date("2024-08-01"), b_lu_end: null },
      ] as Cultivation[],
      measures: [],
      fertilizerApplications: [],
      timeframe,
    },
    {
      name: "a field without data",
      field: mockField,
      soilAnalyses: [],
      cultivations: [],
      measures: [],
      fertilizerApplications: [],
      timeframe,
    },
  ]

  // Another field of the farm, which must not leak into the inputs of the scenario field
  const otherField: Field = { ...mockField, b_id: "field-2", b_centroid: [6, 52] }

  beforeEach(() => {
    vi.resetAllMocks()
    deriveCurrentSoilDataFromSoilAnalyses()
  })

  function mockFieldGetters(scenario: Scenario) {
    mockedGetField.mockResolvedValue(scenario.field)
    mockedGetSoilAnalyses.mockResolvedValue(scenario.soilAnalyses)
    mockedGetCultivations.mockResolvedValue(scenario.cultivations)
    mockedGetMeasures.mockResolvedValue(scenario.measures)
    mockedGetFertilizerApplications.mockResolvedValue(scenario.fertilizerApplications)
  }

  function mockFarmGetters(scenario: Scenario) {
    mockedGetFields.mockResolvedValue([scenario.field, otherField])
    mockedGetSoilAnalysesForFarm.mockResolvedValue(
      new Map([
        [b_id, scenario.soilAnalyses],
        [otherField.b_id, [mockSoilAnalysis]],
        // A field outside the timeframe, which getFields does not return
        ["field-old", [mockSoilAnalysis]],
      ]),
    )
    mockedGetCultivationsForFarm.mockResolvedValue(
      new Map([
        [b_id, scenario.cultivations],
        [otherField.b_id, [grass]],
      ]),
    )
    mockedGetMeasuresForFarm.mockResolvedValue(new Map([[b_id, scenario.measures]]))
    mockedGetFertilizerApplicationsForFarm.mockResolvedValue(
      new Map([[b_id, scenario.fertilizerApplications]]),
    )
  }

  for (const scenario of scenarios) {
    it(`should give the same BLN3 score inputs for ${scenario.name}`, async () => {
      mockFieldGetters(scenario)
      const expected = await collectInputForBln3Score(
        mockFdm,
        principal_id,
        b_id,
        scenario.timeframe,
      )
      mockFarmGetters(scenario)

      const { fields, inputs } = await collectInputForBln3ScoreForFarm(
        farmFdm,
        principal_id,
        b_id_farm,
        scenario.timeframe,
      )

      expect(fields).toEqual([scenario.field, otherField])
      expect([...inputs.keys()]).toEqual([b_id, otherField.b_id])
      expect(inputs.get(b_id)).toEqual(expected)
    })

    it(`should give the same measure applicability inputs for ${scenario.name}`, async () => {
      mockFieldGetters(scenario)
      const expected = await collectInputForBln3MeasureApplicability(
        mockFdm,
        principal_id,
        b_id,
        2024,
        scenario.timeframe,
      )
      mockFarmGetters(scenario)

      const inputs = await collectInputForBln3MeasureApplicabilityForFarm(
        farmFdm,
        principal_id,
        b_id_farm,
        2024,
        scenario.timeframe,
      )

      expect([...inputs.keys()]).toEqual([b_id, otherField.b_id])
      expect(inputs.get(b_id)).toEqual(expected)
    })
  }

  it("should read the farm data with farm-level getters in one transaction", async () => {
    mockFarmGetters(scenarios[0])

    await collectInputForBln3ScoreForFarm(farmFdm, principal_id, b_id_farm, timeframe)

    expect(mockedGetFields).toHaveBeenCalledWith(txFdm, principal_id, b_id_farm, timeframe)
    expect(mockedGetCurrentSoilDataForFarm).toHaveBeenCalledWith(txFdm, principal_id, b_id_farm, {
      start: undefined,
      end: timeframe.end,
    })
    // Only for the BodemConditieScore
    expect(mockedGetSoilAnalysesForFarm).toHaveBeenCalledWith(txFdm, principal_id, b_id_farm, {
      start: undefined,
      end: timeframe.end,
    })
    // Cultivations without a timeframe, for the multi-year history
    expect(mockedGetCultivationsForFarm).toHaveBeenCalledWith(txFdm, principal_id, b_id_farm)
    expect(mockedGetMeasuresForFarm).toHaveBeenCalledWith(txFdm, principal_id, b_id_farm, timeframe)
    expect(mockedGetField).not.toHaveBeenCalled()
  })

  it("should read the farm's current soil data for the applicability, without soil analyses", async () => {
    mockFarmGetters(scenarios[0])

    await collectInputForBln3MeasureApplicabilityForFarm(
      farmFdm,
      principal_id,
      b_id_farm,
      2024,
      timeframe,
    )

    expect(mockedGetCurrentSoilDataForFarm).toHaveBeenCalledWith(txFdm, principal_id, b_id_farm, {
      start: undefined,
      end: timeframe.end,
    })
    expect(mockedGetSoilAnalysesForFarm).not.toHaveBeenCalled()
  })

  it("should give the same inputs with zone-weighted current soil data", async () => {
    const zoned = [
      { parameter: "a_p_al", value: 35.5, is_aggregated: true },
      { parameter: "b_soiltype_agr", value: "zeeklei", is_aggregated: true },
    ] as CurrentSoilData
    mockFieldGetters(scenarios[0])
    mockedGetCurrentSoilData.mockResolvedValue(zoned)
    const expected = await collectInputForBln3Score(mockFdm, principal_id, b_id, timeframe)
    mockFarmGetters(scenarios[0])
    mockedGetCurrentSoilDataForFarm.mockResolvedValue(new Map([[b_id, zoned]]))

    const { inputs } = await collectInputForBln3ScoreForFarm(
      farmFdm,
      principal_id,
      b_id_farm,
      timeframe,
    )

    expect(inputs.get(b_id)).toEqual(expected)
    expect(inputs.get(b_id)).toMatchObject({ a_p_al: 35.5, b_soiltype_agr: "zeeklei" })
  })

  it("should keep the applicability inputs when the fertilizer applications cannot be read", async () => {
    const scenario = { ...scenarios[0], fertilizerApplications: [] }
    mockFieldGetters(scenario)
    mockedGetFertilizerApplications.mockRejectedValue(new Error("no access"))
    const expected = await collectInputForBln3MeasureApplicability(
      mockFdm,
      principal_id,
      b_id,
      2024,
      timeframe,
    )
    mockFarmGetters(scenario)
    mockedGetFertilizerApplicationsForFarm.mockRejectedValue(new Error("no access"))

    const inputs = await collectInputForBln3MeasureApplicabilityForFarm(
      farmFdm,
      principal_id,
      b_id_farm,
      2024,
      timeframe,
    )

    expect(inputs.get(b_id)).toEqual(expected)
    expect(inputs.get(b_id)?.p_app_method).toBeUndefined()
  })

  it("should wrap errors with the farm ID", async () => {
    mockFarmGetters(scenarios[0])
    mockedGetFields.mockRejectedValue(new Error("Permission denied"))

    await expect(
      collectInputForBln3ScoreForFarm(farmFdm, principal_id, b_id_farm, timeframe),
    ).rejects.toThrow("Failed to collect BLN3 score inputs for farm farm-1: Permission denied")
    await expect(
      collectInputForBln3MeasureApplicabilityForFarm(
        farmFdm,
        principal_id,
        b_id_farm,
        2024,
        timeframe,
      ),
    ).rejects.toThrow(
      "Failed to collect BLN3 measure applicability inputs for farm farm-1: Permission denied",
    )
  })
})
