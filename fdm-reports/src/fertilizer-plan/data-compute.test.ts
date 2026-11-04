import type { FdmType } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const core = vi.hoisted(() => ({
  getFarm: vi.fn(),
  getFields: vi.fn(),
  getCultivationsFromCatalogue: vi.fn(),
  getFertilizers: vi.fn(),
  getCultivationsForFarm: vi.fn(),
  getFertilizerApplicationsForFarm: vi.fn(),
  getSoilAnalysesForFarm: vi.fn(),
  getCurrentSoilDataForFarm: vi.fn(),
  isDerogationGrantedForYear: vi.fn(),
  isOrganicCertificationValid: vi.fn(),
  getGrazingIntention: vi.fn(),
}))
const calculator = vi.hoisted(() => ({
  calculateDose: vi.fn(),
  createFunctionsForFertilizerApplicationFilling: vi.fn(),
  createFunctionsForNorms: vi.fn(),
  getMainCultivation: vi.fn(),
  getNutrientAdvice: vi.fn(),
  getOrganicMatterBalanceField: vi.fn(),
}))

vi.mock("@nmi-agro/fdm-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...core,
}))
vi.mock("@nmi-agro/fdm-calculator", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...calculator,
}))

const { collectFertilizerPlanInput, computeFertilizerPlanData, getFertilizerPlanInputHash } =
  await import("./data")

const fdm = {} as FdmType
const options = { nmiApiKey: "key", branding: { name: "FDM" } }

const norm = (normValue: number) => ({ normValue, normSource: "test" })
const filling = (normFilling: number) => ({ normFilling, applicationFilling: [] })

function normFunctions(withRenure: boolean) {
  return {
    calculateNormForNitrogen: vi.fn().mockResolvedValue(norm(200)),
    calculateNormForManure: vi.fn().mockResolvedValue(norm(170)),
    calculateNormForPhosphate: vi.fn().mockResolvedValue(norm(75)),
    ...(withRenure ? { calculateNormForRenure: vi.fn().mockResolvedValue(norm(100)) } : {}),
  }
}

function fillingFunctions(withRenure: boolean) {
  return {
    calculateFertilizerApplicationFillingForNitrogen: vi.fn().mockResolvedValue(filling(50)),
    calculateFertilizerApplicationFillingForPhosphate: vi.fn().mockResolvedValue(filling(20)),
    calculateFertilizerApplicationFillingForManure: vi.fn().mockResolvedValue(filling(40)),
    ...(withRenure
      ? {
          calculateFertilizerApplicationFillingForRenure: vi.fn().mockResolvedValue(filling(10)),
        }
      : {}),
  }
}

const omBalance = (balance: number) => ({
  balance,
  supply: {
    total: 2000,
    fertilizers: { manure: { total: 1000 }, compost: { total: 500 } },
    cultivations: { total: 300 },
    residues: { total: 200 },
  },
  degradation: { total: 1500 },
})

const mainCultivation = { b_lu: "lu-1", b_lu_catalogue: "nl_265", b_lu_name: "Grasland" }
const catchCrop = { b_lu: "lu-2", b_lu_catalogue: "nl_3512", b_lu_name: "Bladrammenas" }

const zeroDose = {
  p_dose_n: 0,
  p_dose_nw: 0,
  p_dose_p: 0,
  p_dose_k: 0,
  p_dose_eoc: 0,
  p_dose_mg: 0,
  p_dose_s: 0,
  p_dose_ca: 0,
  p_dose_na: 0,
  p_dose_cu: 0,
  p_dose_zn: 0,
  p_dose_co: 0,
  p_dose_mn: 0,
  p_dose_mo: 0,
  p_dose_b: 0,
}

function field(b_id: string, overrides: Record<string, unknown> = {}) {
  return {
    b_id,
    b_name: `Perceel ${b_id}`,
    b_area: 2,
    b_bufferstrip: false,
    b_centroid: [5.0, 52.0],
    fertilizerApplications: [],
    cultivations: [],
    soilAnalyses: [],
    currentSoilData: [],
    ...overrides,
  }
}

function input(
  year: number,
  fields: ReturnType<typeof field>[],
  derogationGranted: boolean | null,
) {
  return {
    year,
    farm: { b_id_farm: "farm-1", b_name_farm: "Testbedrijf", b_businessid_farm: "12345678" },
    fields,
    fertilizersCatalogue: [{ p_id: "fert-1", p_name_nl: "Rundveedrijfmest" }],
    cultivationsCatalogue: [],
    derogationGranted,
    has_organic_certification: false,
    has_grazing_intention: true,
  } as never
}

describe("collectFertilizerPlanInput", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    core.getFarm.mockResolvedValue({ b_id_farm: "farm-1" })
    core.getFields.mockResolvedValue([{ b_id: "f1" }, { b_id: "f2" }])
    core.getCultivationsFromCatalogue.mockResolvedValue([])
    core.getFertilizers.mockResolvedValue([])
    core.getCultivationsForFarm.mockResolvedValue(new Map([["f1", [mainCultivation]]]))
    core.getFertilizerApplicationsForFarm.mockResolvedValue(new Map([["f1", [{ p_app_id: "a" }]]]))
    core.getSoilAnalysesForFarm.mockResolvedValue(new Map([["f1", [{ a_id: "s" }]]]))
    core.getCurrentSoilDataForFarm.mockResolvedValue(new Map([["f1", [{ parameter: "a_p_al" }]]]))
    core.isDerogationGrantedForYear.mockResolvedValue(true)
    core.isOrganicCertificationValid.mockResolvedValue(false)
    core.getGrazingIntention.mockResolvedValue(true)
  })

  it("combines the farm data per field, with empty lists for fields without data", async () => {
    const result = await collectFertilizerPlanInput(fdm, "p1", "farm-1", 2025)
    expect(result.derogationGranted).toBe(true)
    expect(result.has_grazing_intention).toBe(true)
    expect(result.fields[0]).toMatchObject({
      b_id: "f1",
      cultivations: [mainCultivation],
      fertilizerApplications: [{ p_app_id: "a" }],
      soilAnalyses: [{ a_id: "s" }],
      currentSoilData: [{ parameter: "a_p_al" }],
    })
    expect(result.fields[1]).toMatchObject({
      b_id: "f2",
      cultivations: [],
      fertilizerApplications: [],
      soilAnalyses: [],
      currentSoilData: [],
    })
  })

  it("only checks the derogation for years that need it", async () => {
    const result = await collectFertilizerPlanInput(fdm, "p1", "farm-1", 2026)
    expect(result.derogationGranted).toBeNull()
    expect(core.isDerogationGrantedForYear).not.toHaveBeenCalled()
  })
})

describe("getFertilizerPlanInputHash", () => {
  it("changes when the input changes", () => {
    const a = getFertilizerPlanInputHash(input(2026, [field("f1")], null))
    const b = getFertilizerPlanInputHash(input(2026, [field("f2")], null))
    expect(a).toBeTypeOf("string")
    expect(a).not.toBe(b)
  })
})

describe("computeFertilizerPlanData", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    calculator.createFunctionsForNorms.mockReturnValue(normFunctions(true))
    calculator.createFunctionsForFertilizerApplicationFilling.mockReturnValue(
      fillingFunctions(true),
    )
    calculator.getMainCultivation.mockImplementation((cultivations: unknown[]) => cultivations[0])
    calculator.getNutrientAdvice.mockResolvedValue({ d_n_req: 150, d_p_req: 60, d_k_req: 0 })
    calculator.getOrganicMatterBalanceField.mockResolvedValue(omBalance(500))
    calculator.calculateDose.mockReturnValue({
      dose: { ...zeroDose, p_dose_n: 100, p_dose_nw: 60 },
      applications: [],
    })
  })

  it("calculates the norms, advice, doses and balance per field and for the farm", async () => {
    calculator.calculateDose.mockReturnValue({
      dose: { ...zeroDose, p_dose_n: 100, p_dose_nw: 60 },
      applications: [
        { ...zeroDose, p_app_id: "app-1", p_dose_n: 100, p_dose_nw: 60 },
        { ...zeroDose, p_app_id: "app-unknown" },
        undefined,
      ],
    })
    const withData = field("f1", {
      cultivations: [mainCultivation, catchCrop],
      fertilizerApplications: [
        {
          p_app_id: "app-1",
          p_id: "fert-1",
          p_app_date: new Date("2026-03-15"),
          p_app_amount: 30000,
          p_app_amount_display: 30,
          p_app_amount_unit: "m3/ha",
        },
      ],
      currentSoilData: [
        {
          parameter: "a_p_al",
          value: 40,
          sources: [{ b_sampling_date: new Date("2024-02-01") }, { b_sampling_date: null }],
        },
        {
          parameter: "a_p_cc",
          value: 2.1,
          sources: [{ b_sampling_date: new Date("2025-02-01") }],
        },
        {
          parameter: "a_som_loi",
          value: 3,
          sources: [{ b_sampling_date: new Date("2023-02-01") }],
        },
      ],
    })
    const buffer = field("f2", { b_area: 1, b_bufferstrip: true })
    calculator.getOrganicMatterBalanceField.mockImplementation(
      async (_fdm: unknown, om: { fieldInput: { field: { b_id: string } } }) =>
        om.fieldInput.field.b_id === "f1" ? omBalance(500) : undefined,
    )

    const data = await computeFertilizerPlanData(
      fdm,
      input(2026, [withData, buffer], null),
      options,
    )

    expect(data.farm).toEqual({ name: "Testbedrijf", kvk: "12345678" })
    expect(data.totalArea).toBe(3)
    expect(data.productiveArea).toBe(2)
    const f1 = data.fields.find((f) => f.id === "f1")
    expect(f1).toMatchObject({
      mainCrop: "Grasland",
      catchCrop: "Bladrammenas",
      soil: { b_sampling_date: "1 feb.", a_p_al: 40, a_p_cc: 2.1, a_som_loi: 3 },
      norms: { nitrogen: 200, manure: 170, phosphate: 75, renure: 100 },
      normsFilling: { nitrogen: 50, manure: 40, phosphate: 20, renure: 10 },
      advice: { d_n_req: 150, d_p_req: 60, d_k_req: 0 },
      omBalance: { balance: 500, supply: 2000, supplyManure: 1000, degradation: 1500 },
    })
    expect(f1?.applications).toEqual([
      expect.objectContaining({
        date: "15 mrt.",
        product: "Rundveedrijfmest",
        quantity: 30000,
        quantity_display: 30,
        quantity_unit: "m3/ha",
        p_dose_n: 100,
      }),
      expect.objectContaining({
        date: "-",
        product: "onbekend",
        quantity: 0,
        quantity_unit: "kg/ha",
      }),
      expect.objectContaining({ date: "-", product: "onbekend", p_dose_n: 0 }),
    ])
    const f2 = data.fields.find((f) => f.id === "f2")
    expect(f2).toMatchObject({ mainCrop: "Geen gewas", isBufferstrip: true, omBalance: undefined })
    expect(f2?.soil.b_sampling_date).toBe("-")
    // Without a main cultivation there is no advice.
    expect(calculator.getNutrientAdvice).toHaveBeenCalledTimes(1)
    // The norm input has no derogation without a derogation status.
    const normInput =
      calculator.createFunctionsForNorms.mock.results[0]?.value.calculateNormForNitrogen.mock
        .calls[0]?.[1]
    expect(normInput.farm).not.toHaveProperty("is_derogatie_bedrijf")
    expect(normInput.soilAnalysis).toEqual({ a_p_cc: 2.1, a_p_al: 40 })
    // The farm balance is weighted by area over all fields.
    expect(data.omBalance?.balance).toBeCloseTo((500 * 2) / 3)
    expect(data.totalAdvice.d_n_req).toBeGreaterThan(0)
    expect(data.config).toEqual({ name: "FDM" })
  })

  it("passes the derogation status, and handles norms without a renure norm", async () => {
    calculator.createFunctionsForNorms.mockReturnValue(normFunctions(false))
    calculator.createFunctionsForFertilizerApplicationFilling.mockReturnValue(
      fillingFunctions(false),
    )
    const data = await computeFertilizerPlanData(
      fdm,
      input(2025, [field("f1", { cultivations: [mainCultivation] })], true),
      options,
    )
    expect(data.fields[0]?.norms.renure).toBeUndefined()
    expect(data.fields[0]?.normsFilling.renure).toBeUndefined()
    const normInput =
      calculator.createFunctionsForNorms.mock.results[0]?.value.calculateNormForNitrogen.mock
        .calls[0]?.[1]
    expect(normInput.farm.is_derogatie_bedrijf).toBe(true)
  })

  it("has no norms outside the norm years, and keeps the field when the advice fails", async () => {
    calculator.getNutrientAdvice.mockRejectedValue(new Error("NMI down"))
    const data = await computeFertilizerPlanData(
      fdm,
      input(2027, [field("f1", { cultivations: [mainCultivation], b_area: null })], null),
      options,
    )
    expect(calculator.createFunctionsForNorms).not.toHaveBeenCalled()
    expect(data.fields[0]).toMatchObject({
      area: 0,
      norms: { nitrogen: 0, manure: 0, phosphate: 0, renure: 0 },
      normsFilling: { nitrogen: 0, manure: 0, phosphate: 0 },
      advice: { d_n_req: 0 },
    })
    expect(data.omBalance).toEqual({ balance: 0, supply: 0, degradation: 0 })
  })

  it("keeps the advice at zero when the advice has no result", async () => {
    calculator.getNutrientAdvice.mockResolvedValue(undefined)
    const data = await computeFertilizerPlanData(
      fdm,
      input(2026, [field("f1", { cultivations: [mainCultivation] })], null),
      options,
    )
    expect(data.fields[0]?.advice.d_n_req).toBe(0)
  })

  it("adds an error row when a norm fails while other norms are still running", async () => {
    // The phosphate norm fails before the nitrogen norm settles. The failure must be handled
    // per field; an unhandled rejection would stop the server process.
    calculator.createFunctionsForNorms.mockReturnValue({
      ...normFunctions(true),
      calculateNormForNitrogen: vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve(norm(200)), 20)),
      ),
      calculateNormForPhosphate: vi.fn().mockRejectedValue(new Error("no soil data")),
    })
    const data = await computeFertilizerPlanData(
      fdm,
      input(2026, [field("f1", { cultivations: [mainCultivation] }), field("f2")], null),
      options,
    )
    expect(data.fields.map((f) => f.mainCrop).sort()).toEqual(["Fout bij laden", "Fout bij laden"])
  })

  it("adds a placeholder row for a field that fails", async () => {
    calculator.getOrganicMatterBalanceField.mockRejectedValue(new Error("boom"))
    const data = await computeFertilizerPlanData(
      fdm,
      input(2026, [field("f1", { b_area: null })], null),
      options,
    )
    expect(data.fields[0]).toMatchObject({
      id: "f1",
      area: 0,
      mainCrop: "Fout bij laden",
      applications: [],
    })
  })

  it("uses fallbacks for a farm without a name or business ID", async () => {
    const farmless = {
      ...(input(2026, [], null) as object),
      farm: { b_id_farm: "farm-1", b_name_farm: null, b_businessid_farm: null },
    }
    const data = await computeFertilizerPlanData(fdm, farmless as never, options)
    expect(data.farm).toEqual({ name: "Onbekend", kvk: undefined })
    expect(data.fields).toEqual([])
  })
})
