import type { FdmType } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const core = vi.hoisted(() => ({
  getCultivationsForFarm: vi.fn(),
  getFertilizerApplicationsForFarm: vi.fn(),
  getCurrentSoilDataForFarm: vi.fn(),
  getFertilizers: vi.fn(),
}))
const advice = vi.hoisted(() => ({ getNutrientAdvice: vi.fn() }))
const suggestion = vi.hoisted(() => ({ getCultivationSuggestion: vi.fn() }))

vi.mock("@nmi-agro/fdm-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...core,
}))
vi.mock("./index", () => advice)
vi.mock("../other/cultivation-suggestion", () => suggestion)

const { getFarmNutrientAdviceRows } = await import("./farm")

const fdm = {} as FdmType
const timeframe = { start: new Date("2026-01-01"), end: new Date("2026-12-31") }

function field(b_id: string) {
  return {
    b_id,
    b_name: `Field ${b_id}`,
    b_area: 2,
    b_centroid: [5.6, 52] as [number, number],
    b_bufferstrip: false,
  }
}

const mainCultivation = {
  b_lu: "lu-1",
  b_lu_catalogue: "nl_2014",
  b_lu_name: "Potato",
  b_lu_croprotation: "potato",
  b_lu_start: new Date("2026-04-01"),
  b_lu_end: new Date("2026-09-30"),
}

function input(fields: ReturnType<typeof field>[]) {
  return {
    fdm,
    principal_id: "p1",
    b_id_farm: "farm-1",
    year: 2026,
    timeframe,
    fields,
    nmiApiKey: "key",
  }
}

describe("getFarmNutrientAdviceRows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    core.getCultivationsForFarm.mockResolvedValue(new Map([["f1", [mainCultivation]]]))
    core.getFertilizerApplicationsForFarm.mockResolvedValue(new Map())
    core.getCurrentSoilDataForFarm.mockResolvedValue(new Map())
    core.getFertilizers.mockResolvedValue([])
    advice.getNutrientAdvice.mockResolvedValue({ d_n_req: 120, d_p_req: 60 })
  })

  it("returns advice, dose and remaining advice per nutrient", async () => {
    const [row] = await getFarmNutrientAdviceRows(input([field("f1")]))

    expect(row?.error).toBeUndefined()
    expect(row?.mainCultivation?.b_lu_catalogue).toBe("nl_2014")
    expect(row?.values.N).toEqual({ advice: 120, dose: 0, remaining: 120 })
    expect(row?.values.P).toEqual({ advice: 60, dose: 0, remaining: 60 })
    expect(advice.getNutrientAdvice).toHaveBeenCalledWith(
      fdm,
      expect.objectContaining({ b_lu_catalogue: "nl_2014", nmiApiKey: "key" }),
    )
  })

  it("reports a field without cultivation as an error row", async () => {
    const [row] = await getFarmNutrientAdviceRows(input([field("f2")]))
    expect(row?.error?.code).toBe("no_cultivation")
    expect(row?.values).toEqual({})
  })

  it("adds a suggestion when there is no main cultivation", async () => {
    core.getCultivationsForFarm.mockResolvedValue(
      new Map([
        [
          "f1",
          [
            {
              ...mainCultivation,
              b_lu_start: new Date("2026-08-01"),
              b_lu_end: new Date("2026-10-01"),
            },
          ],
        ],
      ]),
    )
    suggestion.getCultivationSuggestion.mockResolvedValue({ b_lu_catalogue: "nl_265" })

    const [row] = await getFarmNutrientAdviceRows(input([field("f1")]))
    expect(row?.error?.code).toBe("no_main_cultivation")
    expect(row?.cultivationSuggestion).toEqual({ b_lu_catalogue: "nl_265" })
  })

  it("keeps other fields when the advice of one field fails", async () => {
    core.getCultivationsForFarm.mockResolvedValue(
      new Map([
        ["f1", [mainCultivation]],
        ["f2", [mainCultivation]],
      ]),
    )
    advice.getNutrientAdvice
      .mockRejectedValueOnce(new Error("Request to NMI API failed with status 500"))
      .mockResolvedValueOnce({ d_n_req: 80 })

    const rows = await getFarmNutrientAdviceRows(input([field("f1"), field("f2")]))
    expect(rows.map((r) => r.error?.code)).toEqual(["advice_failed", undefined])
    expect(rows[0]?.error?.message).toContain("NMI API")
  })

  it("marks every field when the farm data cannot be read", async () => {
    core.getFertilizers.mockRejectedValue(new Error("Permission denied"))
    const rows = await getFarmNutrientAdviceRows(input([field("f1"), field("f2")]))
    expect(rows.map((r) => r.error?.code)).toEqual([
      "farm_data_unavailable",
      "farm_data_unavailable",
    ])
  })

  it("returns no rows for a farm without fields", async () => {
    expect(await getFarmNutrientAdviceRows(input([]))).toEqual([])
  })
})
