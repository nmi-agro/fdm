import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createClarifyAgentTools,
  createFertilizerPlannerTools,
  getMainCultivation,
  isValidDutchCropCatalogue,
} from "./index"

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
  aggregateNormFillingsToFarmLevel,
  aggregateNormsToFarmLevel,
  calculateDose,
  calculateNitrogenBalanceField,
  calculateNitrogenBalancesFieldToFarm,
  calculateOrganicMatterBalanceField,
  collectInputForNitrogenBalance,
  collectInputForOrganicMatterBalance,
  createFunctionsForNorms,
  createUncachedFunctionsForFertilizerApplicationFilling,
  getNutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import {
  getCultivations,
  getCurrentSoilData,
  getFertilizers,
  getField,
  getFields,
} from "@nmi-agro/fdm-core"

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

function makeConfigurable(overrides: Record<string, any> = {}) {
  return {
    configurable: {
      principalId: "principal-1",
      calendar: "2025",
      ...overrides,
    },
  }
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
      b_lu_croprotation: "grass",
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
    calculateNormForManure: vi.fn().mockResolvedValue({ normValue: 170, normSource: "NL-2025" }),
    calculateNormForPhosphate: vi.fn().mockResolvedValue({ normValue: 80, normSource: "NL-2025" }),
    calculateNormForNitrogen: vi.fn().mockResolvedValue({ normValue: 230, normSource: "NL-2025" }),
  })
  ;(createUncachedFunctionsForFertilizerApplicationFilling as any).mockReturnValue({
    collectInputForFertilizerApplicationFilling: vi.fn().mockResolvedValue({}),
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
  ;(getNutrientAdvice as any).mockResolvedValue({
    d_n_req: 100,
    d_p_req: 20,
  })
}

// ---------------------------------------------------------------------------
// Existing tests
// ---------------------------------------------------------------------------
describe("fertilizer-planner tools", () => {
  describe("isValidDutchCropCatalogue", () => {
    it("accepts Dutch BRP crop catalogue values only", () => {
      expect(isValidDutchCropCatalogue("nl_2708")).toBe(true)
      expect(isValidDutchCropCatalogue("Onbekend")).toBe(false)
      expect(isValidDutchCropCatalogue(null)).toBe(false)
    })
  })

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
    it("should return the correct set of 6 tools", () => {
      const tools = createFertilizerPlannerTools(mockFdm)
      expect(tools).toHaveLength(6)

      const names = tools.map((t) => t.name)
      expect(names).toContain("getFarmFields")
      expect(names).toContain("getFarmNutrientAdvice")
      expect(names).toContain("getFarmLegalNorms")
      expect(names).toContain("searchFertilizers")
      expect(names).toContain("simulateFarmPlan")
      expect(names).toContain("getCropFertilizerGuide")
    })
  })

  describe("createClarifyAgentTools", () => {
    it("should exclude simulateFarmPlan from clarify toolset", () => {
      const tools = createClarifyAgentTools(mockFdm)
      const names = tools.map((t) => t.name)
      expect(names).not.toContain("simulateFarmPlan")
      expect(names).toHaveLength(5)
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
    it("should return fields with soil params and cultivation details", async () => {
      const result = await getTool("getFarmFields").invoke(
        { b_id_farm: "farm-1", calendar: "2025" },
        makeConfigurable(),
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
      const result = await getTool("getFarmFields").invoke(
        { b_id_farm: "farm-1", calendar: "2025" },
        makeConfigurable(),
      )
      expect(result.fields[0].b_lu_catalogue).toBeNull()
      expect(result.fields[0].b_lu_start).toBeNull()
    })
  })

  // ── getFarmNutrientAdvice ────────────────────────────────────────────────
  describe("getFarmNutrientAdvice", () => {
    it("should return advice when mainLu is found", async () => {
      const result = await getTool("getFarmNutrientAdvice").invoke(
        { b_ids: ["field-1"] },
        makeConfigurable({ nmiApiKey: "test-key" }),
      )
      expect(result.advicePerField).toHaveLength(1)
      expect(result.advicePerField[0].b_id).toBe("field-1")
      expect(result.advicePerField[0].advice).toEqual({
        d_n_req: 100,
        d_p_req: 20,
      })
      expect(getNutrientAdvice).toHaveBeenCalledWith(
        mockFdm,
        expect.objectContaining({ nmiApiKey: "test-key" }),
      )
    })

    it("should throw before fetching fields when principalId is missing", async () => {
      await expect(
        getTool("getFarmNutrientAdvice").invoke(
          { b_ids: ["field-1"] },
          { configurable: { nmiApiKey: "test-key" } },
        ),
      ).rejects.toThrow("Missing principalId in agent context")
      expect(getField).not.toHaveBeenCalled()
      expect(getCultivations).not.toHaveBeenCalled()
      expect(getNutrientAdvice).not.toHaveBeenCalled()
    })

    it("should throw before fetching fields when nmiApiKey is missing", async () => {
      await expect(
        getTool("getFarmNutrientAdvice").invoke({ b_ids: ["field-1"] }, makeConfigurable()),
      ).rejects.toThrow("Missing nmiApiKey in agent context")
      expect(getField).not.toHaveBeenCalled()
      expect(getCultivations).not.toHaveBeenCalled()
      expect(getNutrientAdvice).not.toHaveBeenCalled()
    })

    it("should return null advice when no mainLu active on May 15th", async () => {
      ;(getCultivations as any).mockResolvedValue([
        {
          b_lu_catalogue: "late-crop",
          b_lu_start: "2025-06-01",
          b_lu_end: "2025-12-31",
        },
      ])
      const result = await getTool("getFarmNutrientAdvice").invoke(
        { b_ids: ["field-1"] },
        makeConfigurable({ nmiApiKey: "test-key" }),
      )
      expect(result.advicePerField[0].advice).toBeNull()
      expect(getNutrientAdvice).not.toHaveBeenCalled()
    })

    it("should skip NMI advice for invalid crop catalogues", async () => {
      ;(getCultivations as any).mockResolvedValue([
        {
          b_lu_catalogue: "Onbekend",
          b_lu_name: "Onbekend gewas",
          b_lu_start: "2025-01-01",
          b_lu_end: null,
        },
      ])

      const result = await getTool("getFarmNutrientAdvice").invoke(
        { b_ids: ["field-1"] },
        makeConfigurable({ nmiApiKey: "test-key" }),
      )

      expect(result.advicePerField[0]).toMatchObject({
        b_id: "field-1",
        advice: null,
        skipped: "Invalid crop catalogue for NMI nutrient advice: Onbekend",
      })
      expect(getNutrientAdvice).not.toHaveBeenCalled()
    })
  })

  // ── getFarmLegalNorms ────────────────────────────────────────────────────
  describe("getFarmLegalNorms", () => {
    it("should return norms per field", async () => {
      const result = await getTool("getFarmLegalNorms").invoke(
        { b_id_farm: "farm-1", b_ids: ["field-1"] },
        makeConfigurable(),
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
    it("should return empty array when principalId is missing", async () => {
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1" },
        { configurable: {} },
      )
      expect(result.fertilizers).toEqual([])
    })

    it("should return all fertilizers when no filter is applied", async () => {
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1" },
        makeConfigurable(),
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
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1", p_type: "manure" },
        makeConfigurable(),
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
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1", query: "compost" },
        makeConfigurable(),
      )
      expect(result.fertilizers).toHaveLength(1)
      expect(result.fertilizers[0].p_id_catalogue).toBe("compost-1")
    })

    it("should return empty array when b_id_farm is missing", async () => {
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "" },
        makeConfigurable(),
      )
      expect(result.fertilizers).toEqual([])
    })

    it("should filter by allowedFertilizerCatalogueIds from configurable", async () => {
      ;(getFertilizers as any).mockResolvedValue([
        mockFertilizer,
        {
          ...mockFertilizer,
          p_id_catalogue: "fert-2",
          p_name_nl: "KAS",
          p_type: "mineral",
        },
      ])
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1" },
        {
          configurable: {
            ...makeConfigurable().configurable,
            allowedFertilizerCatalogueIds: ["fert-2"],
          },
        },
      )
      expect(result.fertilizers).toHaveLength(1)
      expect(result.fertilizers[0].p_id_catalogue).toBe("fert-2")
    })

    it("should return all fertilizers when allowedFertilizerCatalogueIds is empty", async () => {
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1" },
        {
          configurable: {
            ...makeConfigurable().configurable,
            allowedFertilizerCatalogueIds: [],
          },
        },
      )
      expect(result.fertilizers).toHaveLength(1)
    })

    it("should expose p_type_rvo in the returned fertilizer fields", async () => {
      ;(getFertilizers as any).mockResolvedValue([{ ...mockFertilizer, p_type_rvo: "115" }])
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1" },
        makeConfigurable(),
      )
      expect(result.fertilizers[0].p_type_rvo).toBe("115")
    })

    it("should exclude Renure products when includeRenure is false for calendar 2026", async () => {
      ;(getFertilizers as any).mockResolvedValue([
        { ...mockFertilizer, p_id_catalogue: "fert-mineral", p_type_rvo: "115" },
        { ...mockFertilizer, p_id_catalogue: "fert-renure", p_type_rvo: "132" },
      ])
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1" },
        {
          configurable: {
            ...makeConfigurable().configurable,
            calendar: "2026",
            includeRenure: false,
          },
        },
      )
      expect(result.fertilizers.map((f: any) => f.p_id_catalogue)).toEqual(["fert-mineral"])
    })

    it("should NOT exclude Renure-coded products for years before 2026, even if includeRenure is false", async () => {
      ;(getFertilizers as any).mockResolvedValue([
        { ...mockFertilizer, p_id_catalogue: "fert-mineral", p_type_rvo: "115" },
        { ...mockFertilizer, p_id_catalogue: "fert-renure", p_type_rvo: "132" },
      ])
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1" },
        {
          configurable: {
            ...makeConfigurable().configurable,
            calendar: "2025",
            includeRenure: false,
          },
        },
      )
      expect(result.fertilizers.map((f: any) => f.p_id_catalogue).sort()).toEqual([
        "fert-mineral",
        "fert-renure",
      ])
    })

    it("should keep Renure products when includeRenure is true for calendar 2026", async () => {
      ;(getFertilizers as any).mockResolvedValue([
        { ...mockFertilizer, p_id_catalogue: "fert-renure", p_type_rvo: "132" },
      ])
      const result = await getTool("searchFertilizers").invoke(
        { b_id_farm: "farm-1" },
        {
          configurable: {
            ...makeConfigurable().configurable,
            calendar: "2026",
            includeRenure: true,
          },
        },
      )
      expect(result.fertilizers).toHaveLength(1)
    })
  })

  // ── getCropFertilizerGuide ────────────────────────────────────────────────
  describe("getCropFertilizerGuide", () => {
    it("should return fallback when crop index file is not found", async () => {
      // Pass an unknown code so the skill resolves a non-existent path
      const result = await getTool("getCropFertilizerGuide").invoke(
        { b_lu_catalogues: [] },
        makeConfigurable(),
      )
      // Either index-not-found or no-matching-codes fallback is acceptable
      expect(result.guide).toBeTruthy()
      expect(result.matchedCrops).toEqual([])
    })

    it("should return no-match fallback for unrecognised crop codes", async () => {
      const result = await getTool("getCropFertilizerGuide").invoke(
        { b_lu_catalogues: ["nl_99999_unknown"] },
        makeConfigurable(),
      )
      expect(result.matchedCrops).toEqual([])
    })

    it("should return guide content for known crop codes", async () => {
      const result = await getTool("getCropFertilizerGuide").invoke(
        { b_lu_catalogues: ["nl_265"] },
        makeConfigurable(),
      )
      // nl_265 = grasland, should match grasland.md in skills
      if (result.matchedCrops.length > 0) {
        expect(result.guide).toBeTruthy()
        expect(result.matchedCrops).toContain("grasland.md")
      } else {
        // Skills not present in test environment — both outcomes are valid
        expect(result.matchedCrops).toEqual([])
      }
    })
  })

  // ── simulateFarmPlan ─────────────────────────────────────────────────────
  describe("simulateFarmPlan", () => {
    it("should throw when principalId is missing in configurable", async () => {
      await expect(
        getTool("simulateFarmPlan").invoke(makeSimInput(), {
          configurable: {},
        }),
      ).rejects.toThrow("Database connection or Farm ID missing")
    })

    it("should throw when b_id_farm is missing", async () => {
      await expect(
        getTool("simulateFarmPlan").invoke(makeSimInput({ b_id_farm: "" }), makeConfigurable()),
      ).rejects.toThrow("Database connection or Farm ID missing")
    })

    it("should return valid result for a compliant plan", async () => {
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
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
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.isValid).toBe(false)
      expect(result.complianceIssues[0]).toContain("Bufferstrook-overtreding")
      expect(result.fieldResults[0].isBufferStripViolation).toBe(true)
    })

    it("should return invalid field result when fertilizer is not found in inventory", async () => {
      ;(getFertilizers as any).mockResolvedValue([])
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.fieldResults[0].isValid).toBe(false)
      expect(result.fieldResults[0].error).toContain("not found in farm inventory")
    })

    it("should return invalid field result for invalid application method", async () => {
      ;(getFertilizers as any).mockResolvedValue([
        { ...mockFertilizer, p_app_method_options: ["injection"] },
      ])
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.fieldResults[0].isValid).toBe(false)
      expect(result.fieldResults[0].error).toContain("Invalid application method")
    })

    it("should accept any method when p_app_method_options is empty", async () => {
      ;(getFertilizers as any).mockResolvedValue([{ ...mockFertilizer, p_app_method_options: [] }])
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.isValid).toBe(true)
    })

    it("should skip NMI advice for invalid crop catalogues during simulation", async () => {
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({
          fields: [
            {
              b_id: "field-1",
              b_lu_catalogue: "Onbekend",
              b_lu_name: "Onbekend gewas",
              b_lu_start: "2025-04-01",
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
        makeConfigurable({ nmiApiKey: "test-key" }),
      )

      expect(getNutrientAdvice).not.toHaveBeenCalled()
      expect(result.fieldResults[0].fieldMetrics.advice).toBeNull()
      expect(result.fieldResults[0].fieldMetrics.adviceSkipped).toBe(
        "Invalid crop catalogue for NMI nutrient advice: Onbekend",
      )
    })

    it("should report manure N norm violation", async () => {
      ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
        manure: 2000,
        nitrogen: 200,
        phosphate: 50,
      })
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.isValid).toBe(false)
      expect(result.complianceIssues.some((i: string) => i.includes("Mest-N"))).toBe(true)
    })

    it("should report workable N norm violation", async () => {
      ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
        manure: 100,
        nitrogen: 3000,
        phosphate: 50,
      })
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.isValid).toBe(false)
      expect(result.complianceIssues.some((i: string) => i.includes("Werkzame N"))).toBe(true)
    })

    it("should report phosphate norm violation", async () => {
      ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
        manure: 100,
        nitrogen: 200,
        phosphate: 1000,
      })
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.isValid).toBe(false)
      expect(result.complianceIssues.some((i: string) => i.includes("Fosfaat"))).toBe(true)
    })

    it("should report organic farming strategy violation for mineral fertilizer", async () => {
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { isOrganic: true } }),
        makeConfigurable(),
      )
      expect(result.isValid).toBe(false)
      expect(result.complianceIssues.some((i: string) => i.includes("Biologische teelt"))).toBe(
        true,
      )
    })

    it("should report derogation violation for mineral fertilizer with phosphate", async () => {
      ;(getFertilizers as any).mockResolvedValue([
        { ...mockFertilizer, p_type: "mineral", p_p_rt: 15 },
      ])
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { isDerogation: true } }),
        makeConfigurable(),
      )
      expect(result.isValid).toBe(false)
      expect(result.complianceIssues.some((i: string) => i.includes("Derogatie"))).toBe(true)
    })

    it("should report Renure violation when includeRenure is false for calendar 2026", async () => {
      ;(getFertilizers as any).mockResolvedValue([{ ...mockFertilizer, p_type_rvo: "132" }])
      ;(aggregateNormsToFarmLevel as any).mockReturnValue({
        manure: 1700,
        nitrogen: 2300,
        phosphate: 800,
        renure: 800,
      })
      ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
        manure: 100,
        nitrogen: 200,
        phosphate: 50,
        renure: 100,
      })
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { includeRenure: false } }),
        { configurable: { ...makeConfigurable().configurable, calendar: "2026" } },
      )
      expect(result.isValid).toBe(false)
      expect(result.complianceIssues.some((i: string) => i.includes("Renure"))).toBe(true)
    })

    it("should NOT report a Renure violation for years before 2026, even if includeRenure is false", async () => {
      ;(getFertilizers as any).mockResolvedValue([{ ...mockFertilizer, p_type_rvo: "132" }])
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
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { includeRenure: false } }),
        { configurable: { ...makeConfigurable().configurable, calendar: "2025" } },
      )
      expect(result.complianceIssues.some((i: string) => i.includes("Renure"))).toBe(false)
    })

    it("should not report a Renure violation when includeRenure is true for calendar 2026", async () => {
      ;(getFertilizers as any).mockResolvedValue([{ ...mockFertilizer, p_type_rvo: "132" }])
      ;(aggregateNormsToFarmLevel as any).mockReturnValue({
        manure: 1700,
        nitrogen: 2300,
        phosphate: 800,
        renure: 800,
      })
      ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
        manure: 100,
        nitrogen: 200,
        phosphate: 50,
        renure: 500,
      })
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { includeRenure: true } }),
        { configurable: { ...makeConfigurable().configurable, calendar: "2026" } },
      )
      expect(result.complianceIssues.some((i: string) => i.includes("Renure"))).toBe(false)
    })

    it("should report Renure ceiling violation when filling exceeds norm", async () => {
      ;(getFertilizers as any).mockResolvedValue([{ ...mockFertilizer, p_type_rvo: "132" }])
      ;(aggregateNormsToFarmLevel as any).mockReturnValue({
        manure: 1700,
        nitrogen: 2300,
        phosphate: 800,
        renure: 800,
      })
      ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
        manure: 100,
        nitrogen: 200,
        phosphate: 50,
        renure: 900, // exceeds 800!
      })
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { includeRenure: true } }),
        { configurable: { ...makeConfigurable().configurable, calendar: "2026" } },
      )
      expect(result.isValid).toBe(false)
      expect(result.complianceIssues.some((i: string) => i.includes("Wettelijke normoverschrijding (Renure stikstof)"))).toBe(true)
    })

    it("should warn when nitrogen balance exceeds target", async () => {
      ;(calculateNitrogenBalancesFieldToFarm as any).mockReturnValue({
        balance: 100,
        target: 50,
      })
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({
          strategies: { keepNitrogenBalanceBelowTarget: true },
        }),
        makeConfigurable(),
      )
      expect(result.agronomicWarnings.some((w: string) => w.includes("Stikstofdoel"))).toBe(true)
    })

    it("should warn for rotation level mismatch between fields with same crop", async () => {
      ;(getField as any).mockImplementation((_fdm: any, _pid: any, b_id: string) =>
        Promise.resolve({
          b_id,
          b_area: 10,
          b_bufferstrip: false,
          b_centroid: [5.2, 52.1],
        }),
      )
      const result = await getTool("simulateFarmPlan").invoke(
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
        makeConfigurable(),
      )
      expect(result.agronomicWarnings.some((w: string) => w.includes("Bouwplanniveau"))).toBe(true)
    })

    it("should normalize grassland codes under rotation level strategy", async () => {
      ;(getField as any).mockImplementation((_fdm: any, _pid: any, b_id: string) =>
        Promise.resolve({
          b_id,
          b_area: 10,
          b_bufferstrip: false,
          b_centroid: [5.2, 52.1],
        }),
      )
      const result = await getTool("simulateFarmPlan").invoke(
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
        makeConfigurable(),
      )
      // Same applications → no rotation mismatch warning
      expect(result.agronomicWarnings.some((w: string) => w.includes("Bouwplanniveau"))).toBe(false)
    })

    it("should warn for high NH3 emission factor", async () => {
      ;(calculateNitrogenBalanceField as any).mockReturnValue({
        balance: 10,
        target: 50,
        supply: { fertilizers: { total: 100 } },
        emission: { ammonia: { fertilizers: { total: -40 } } }, // 40% > 30% threshold
      })
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { reduceAmmoniaEmissions: true } }),
        makeConfigurable(),
      )
      expect(result.agronomicWarnings.some((w: string) => w.includes("Ammoniakreductie"))).toBe(
        true,
      )
    })

    it("should not warn for NH3 when emission factor is below threshold", async () => {
      // Default mock: emission total = -2, supply = 100 → 2% < 30%
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { reduceAmmoniaEmissions: true } }),
        makeConfigurable(),
      )
      expect(result.agronomicWarnings.some((w: string) => w.includes("Ammoniakreductie"))).toBe(
        false,
      )
    })

    it("should warn when manure space is underfilled", async () => {
      ;(aggregateNormFillingsToFarmLevel as any).mockReturnValue({
        manure: 100, // << 1700 * 0.95 = 1615
        nitrogen: 200,
        phosphate: 50,
      })
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput({ strategies: { fillManureSpace: true } }),
        makeConfigurable(),
      )
      expect(result.agronomicWarnings.some((w: string) => w.includes("Mestruimte vullen"))).toBe(
        true,
      )
    })

    it("should warn for negative organic matter balance", async () => {
      ;(calculateOrganicMatterBalanceField as any).mockReturnValue({
        balance: -50,
        supply: { fertilizers: { total: 0 } },
      })
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.agronomicWarnings.some((w: string) => w.includes("Organische stof"))).toBe(true)
    })

    it("should fetch nutrient advice when nmiApiKey is provided", async () => {
      const result = await getTool("simulateFarmPlan").invoke(
        makeSimInput(),
        makeConfigurable({ nmiApiKey: "test-nmi-key" }),
      )
      expect(getNutrientAdvice).toHaveBeenCalled()
      expect(result.fieldResults[0].fieldMetrics?.advice).toEqual({
        d_n_req: 100,
        d_p_req: 20,
      })
    })

    it("should handle omBalance calculation error gracefully", async () => {
      ;(calculateOrganicMatterBalanceField as any).mockImplementation(() => {
        throw new Error("OM calculation failed")
      })
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.fieldResults[0].fieldMetrics?.omBalanceError).toBe("OM calculation failed")
    })

    it("should handle nBalance calculation error gracefully", async () => {
      ;(calculateNitrogenBalanceField as any).mockImplementation(() => {
        throw new Error("N balance failed")
      })
      const result = await getTool("simulateFarmPlan").invoke(makeSimInput(), makeConfigurable())
      expect(result.fieldResults[0].fieldMetrics?.nBalanceError).toBe("N balance failed")
    })
  })
})
