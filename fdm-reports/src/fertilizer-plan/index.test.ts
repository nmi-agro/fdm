import type { FdmType } from "@nmi-agro/fdm-core"
import { createMemoryStorage } from "@nmi-agro/fdm-storage"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FertilizerPlanData } from "./types"

const core = vi.hoisted(() => ({
  addFertilizerPlan: vi.fn(),
  removeFertilizerPlan: vi.fn(),
}))
const data = vi.hoisted(() => ({
  collectFertilizerPlanInput: vi.fn(),
  computeFertilizerPlanData: vi.fn(),
  getFertilizerPlanInputHash: vi.fn(),
}))

vi.mock("@nmi-agro/fdm-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...core,
}))
vi.mock("./data", () => data)

const {
  createFertilizerPlanStatusChecker,
  establishFertilizerPlan,
  removeFertilizerPlanWithFile,
  renderFertilizerPlanPdf,
} = await import("./index")

const fdm = {} as FdmType

const planData: FertilizerPlanData = {
  generatedAt: "2026-03-01T10:00:00.000Z",
  config: { name: "FDM" },
  farm: { name: "Test farm" },
  year: "2026",
  totalArea: 10,
  productiveArea: 10,
  norms: { nitrogen: 2300, manure: 1700, phosphate: 600 },
  normsFilling: { nitrogen: 1000, manure: 800, phosphate: 300 },
  totalAdvice: { d_n_req: 2000, d_p_req: 500, d_k_req: 900, d_c_req: 0 },
  plannedUsage: { p_dose_n: 1200, p_dose_nw: 900, p_dose_p: 300, p_dose_k: 800, p_dose_eoc: 0 },
  fields: [],
}

describe("renderFertilizerPlanPdf", () => {
  it("renders a PDF", async () => {
    const pdf = await renderFertilizerPlanPdf(planData)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  }, 30_000)
})

describe("establishFertilizerPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    data.collectFertilizerPlanInput.mockResolvedValue({ year: 2026 })
    data.getFertilizerPlanInputHash.mockReturnValue("hash-1")
    data.computeFertilizerPlanData.mockResolvedValue(planData)
  })

  const input = (storage = createMemoryStorage()) => ({
    fdm,
    principal_id: "p1",
    b_id_farm: "farm-1",
    year: 2026,
    storage,
    nmiApiKey: "key",
    branding: { name: "FDM" },
  })

  it("uploads the PDF before saving the plan with its key and hash", async () => {
    core.addFertilizerPlan.mockResolvedValue("plan-1")
    const storage = createMemoryStorage()

    const p_id_plan = await establishFertilizerPlan(input(storage))

    expect(p_id_plan).toBe("plan-1")
    const [key] = storage.keys()
    expect(key).toMatch(/^bemestingsplan\/.+\.pdf$/)
    expect(core.addFertilizerPlan).toHaveBeenCalledWith(
      fdm,
      "p1",
      "farm-1",
      2026,
      key,
      "hash-1",
      expect.any(Date),
    )
    expect(data.computeFertilizerPlanData).toHaveBeenCalledWith(
      fdm,
      { year: 2026 },
      {
        nmiApiKey: "key",
        branding: { name: "FDM" },
      },
    )
  }, 30_000)

  it("deletes the PDF when the plan cannot be saved", async () => {
    core.addFertilizerPlan.mockRejectedValue(new Error("Permission denied"))
    const storage = createMemoryStorage()

    await expect(establishFertilizerPlan(input(storage))).rejects.toThrow("Permission denied")
    expect(storage.keys()).toEqual([])
  }, 30_000)

  it("saves no plan when the upload fails", async () => {
    const storage = createMemoryStorage()
    storage.upload = vi.fn().mockRejectedValue(new Error("Storage down"))

    await expect(establishFertilizerPlan(input(storage))).rejects.toThrow("Storage down")
    expect(core.addFertilizerPlan).not.toHaveBeenCalled()
  }, 30_000)
})

describe("removeFertilizerPlanWithFile", () => {
  it("removes the plan and its PDF", async () => {
    const storage = createMemoryStorage()
    await storage.upload("bemestingsplan/a.pdf", Buffer.from("x"), "application/pdf")

    const error = await removeFertilizerPlanWithFile(
      fdm,
      "p1",
      { p_id_plan: "plan-1", p_plan_file_path: "bemestingsplan/a.pdf" },
      storage,
    )

    expect(error).toBeUndefined()
    expect(core.removeFertilizerPlan).toHaveBeenCalledWith(fdm, "p1", "plan-1")
    expect(storage.keys()).toEqual([])
  })

  it("returns the storage error instead of throwing", async () => {
    const storage = createMemoryStorage()
    storage.delete = vi.fn().mockRejectedValue(new Error("Storage down"))
    const error = await removeFertilizerPlanWithFile(
      fdm,
      "p1",
      { p_id_plan: "plan-1", p_plan_file_path: "bemestingsplan/a.pdf" },
      storage,
    )
    expect(error).toBeInstanceOf(Error)
  })
})

describe("createFertilizerPlanStatusChecker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    data.collectFertilizerPlanInput.mockImplementation(async (_f, _p, _b, year: number) => ({
      year,
    }))
    data.getFertilizerPlanInputHash.mockImplementation(
      (input: { year: number }) => `hash-${input.year}`,
    )
  })

  it("compares the stored hash with the current input, once per year", async () => {
    const check = createFertilizerPlanStatusChecker(fdm, "p1", "farm-1")

    const statuses = await Promise.all([
      check({ p_plan_year: 2025, p_plan_hash: "hash-2025" }),
      check({ p_plan_year: 2025, p_plan_hash: "old" }),
      check({ p_plan_year: 2026, p_plan_hash: "hash-2026" }),
    ])

    expect(statuses).toEqual(["fresh", "expired", "fresh"])
    expect(data.collectFertilizerPlanInput).toHaveBeenCalledTimes(2)
  })

  it("reports unknown when the input cannot be collected", async () => {
    data.collectFertilizerPlanInput.mockRejectedValue(new Error("Permission denied"))
    const check = createFertilizerPlanStatusChecker(fdm, "p1", "farm-1")
    expect(await check({ p_plan_year: 2026, p_plan_hash: "x" })).toBe("unknown")
  })
})
