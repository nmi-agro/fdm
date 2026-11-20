import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getFields: vi.fn(),
  startFarmNutrientAdviceCalculation: vi.fn(),
  collectFarmNormsContext: vi.fn(),
  calculateFarmNorms: vi.fn(),
  getIndicatorsForFarm: vi.fn(),
  collectFarmMeasureInputs: vi.fn(),
  getMeasureApplicabilityForFields: vi.fn(),
  getMeasureAdviceForFields: vi.fn(),
  getNitrogenBalanceForFarm: vi.fn(),
  getOrganicMatterBalanceForFarm: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock("@nmi-agro/fdm-core", () => ({ getFields: mocks.getFields }))
vi.mock("~/lib/fdm.server", () => ({ fdm: {} }))
vi.mock("~/lib/error", () => ({ reportError: mocks.reportError }))
vi.mock("~/lib/timing.server", () => ({
  withTiming: (_id: string, _event: string, _props: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock("~/lib/nutrient-advice.server", () => ({
  startFarmNutrientAdviceCalculation: mocks.startFarmNutrientAdviceCalculation,
}))
vi.mock("./farm-norms.server", () => ({
  isNormsCalendar: (calendar: string) => calendar === "2025" || calendar === "2026",
  collectFarmNormsContext: mocks.collectFarmNormsContext,
  calculateFarmNorms: mocks.calculateFarmNorms,
}))
vi.mock("./bln3.server", () => ({
  getIndicatorsForFarm: mocks.getIndicatorsForFarm,
  collectFarmMeasureInputs: mocks.collectFarmMeasureInputs,
  getMeasureApplicabilityForFields: mocks.getMeasureApplicabilityForFields,
  getMeasureAdviceForFields: mocks.getMeasureAdviceForFields,
}))
vi.mock("./calculator", () => ({
  getNitrogenBalanceForFarm: mocks.getNitrogenBalanceForFarm,
  getOrganicMatterBalanceForFarm: mocks.getOrganicMatterBalanceForFarm,
}))

const { warmFarmCalculations } = await import("./farm-warmup.server")

const fields = [{ b_id: "field-1" }, { b_id: "field-2" }]
const args = { principal_id: "principal-1", b_id_farm: "farm-1", calendar: "2026" }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getFields.mockResolvedValue(fields)
  mocks.startFarmNutrientAdviceCalculation.mockReturnValue([
    Promise.resolve({}),
    Promise.resolve({}),
  ])
  mocks.collectFarmNormsContext.mockResolvedValue({})
  mocks.calculateFarmNorms.mockResolvedValue({})
  mocks.getIndicatorsForFarm.mockResolvedValue([])
  mocks.collectFarmMeasureInputs.mockResolvedValue(new Map())
  mocks.getMeasureApplicabilityForFields.mockResolvedValue({})
  mocks.getMeasureAdviceForFields.mockResolvedValue({})
  mocks.getNitrogenBalanceForFarm.mockResolvedValue({})
  mocks.getOrganicMatterBalanceForFarm.mockResolvedValue({})
})

describe("warmFarmCalculations", () => {
  it("runs every calculation of the farm and year", async () => {
    await warmFarmCalculations(args)

    expect(mocks.startFarmNutrientAdviceCalculation).toHaveBeenCalledWith(
      expect.objectContaining({ b_id_farm: "farm-1", calendar: "2026" }),
      fields,
    )
    expect(mocks.calculateFarmNorms).toHaveBeenCalledOnce()
    expect(mocks.getIndicatorsForFarm).toHaveBeenCalledWith(
      expect.objectContaining({ b_id_farm: "farm-1", preloadedFields: fields }),
    )
    expect(mocks.collectFarmMeasureInputs).toHaveBeenCalledWith(
      expect.objectContaining({ b_ids: ["field-1", "field-2"], b_year: 2026 }),
    )
    expect(mocks.getMeasureApplicabilityForFields).toHaveBeenCalledOnce()
    expect(mocks.getMeasureAdviceForFields).toHaveBeenCalledOnce()
    // The nitrogen balance page's default: total nitrogen
    expect(mocks.getNitrogenBalanceForFarm).toHaveBeenCalledWith(
      expect.not.objectContaining({ useEffectiveNitrogen: true }),
    )
    expect(mocks.getOrganicMatterBalanceForFarm).toHaveBeenCalledWith(
      expect.objectContaining({ b_id_farm: "farm-1" }),
    )
  })

  it("joins a warm-up of the same farm and year that is still running", async () => {
    const first = warmFarmCalculations(args)
    const second = warmFarmCalculations(args)
    expect(second).toBe(first)
    await Promise.all([first, second])
    expect(mocks.getFields).toHaveBeenCalledOnce()

    // Another year is a separate warm-up, and a finished warm-up can run again
    await warmFarmCalculations({ ...args, calendar: "2025" })
    await warmFarmCalculations(args)
    expect(mocks.getFields).toHaveBeenCalledTimes(3)
  })

  it("skips the norms for a year without norms", async () => {
    await warmFarmCalculations({ ...args, calendar: "2024" })
    expect(mocks.collectFarmNormsContext).not.toHaveBeenCalled()
    expect(mocks.getIndicatorsForFarm).toHaveBeenCalledOnce()
  })

  it("does nothing for a farm without fields", async () => {
    mocks.getFields.mockResolvedValue([])
    await warmFarmCalculations(args)
    expect(mocks.startFarmNutrientAdviceCalculation).not.toHaveBeenCalled()
    expect(mocks.getIndicatorsForFarm).not.toHaveBeenCalled()
  })

  it("reports a failing step, runs the next steps and never rejects", async () => {
    mocks.getIndicatorsForFarm.mockRejectedValue(new Error("NMI API unavailable"))
    await expect(warmFarmCalculations(args)).resolves.toBeUndefined()
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      { scope: "farm-warmup", step: "bln3-scores" },
      expect.anything(),
    )
    expect(mocks.getMeasureAdviceForFields).toHaveBeenCalledOnce()
  })

  it("reports a failed read of the farm data for the nutrient advice, not a missing crop", async () => {
    mocks.startFarmNutrientAdviceCalculation.mockReturnValue([
      Promise.resolve({ error: { code: "no_cultivation", message: "No cultivation" } }),
    ])
    await warmFarmCalculations(args)
    expect(mocks.reportError).not.toHaveBeenCalled()

    mocks.startFarmNutrientAdviceCalculation.mockReturnValue([
      Promise.resolve({ error: { code: "farm_data_unavailable", message: "Connection lost" } }),
      Promise.resolve({ error: { code: "farm_data_unavailable", message: "Connection lost" } }),
    ])
    await warmFarmCalculations(args)
    expect(mocks.reportError).toHaveBeenCalledOnce()
    expect(mocks.reportError).toHaveBeenCalledWith(
      new Error("Connection lost"),
      { scope: "farm-warmup", step: "nutrient-advice" },
      expect.anything(),
    )
  })

  it("reports a failure to read the fields and never rejects", async () => {
    mocks.getFields.mockRejectedValue(new Error("Permission denied"))
    await expect(warmFarmCalculations(args)).resolves.toBeUndefined()
    expect(mocks.reportError).toHaveBeenCalledOnce()
  })
})
