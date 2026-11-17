import type { FdmType } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const core = vi.hoisted(() => ({
  getCultivationsForFarm: vi.fn(),
  getFertilizerApplicationsForFarm: vi.fn(),
  getCurrentSoilDataForFarm: vi.fn(),
  getFertilizers: vi.fn(),
}))
// The cached function has a `many` method; here it requests each input with the single mock,
// through the `limit` option like the real one
const advice = vi.hoisted(() => {
  const getNutrientAdvice = Object.assign(vi.fn(), {
    many: vi.fn(
      (
        fdm: unknown,
        inputs: unknown[],
        options?: { limit?: <T>(task: () => Promise<T>) => Promise<T> },
      ) =>
        inputs.map((input) =>
          options?.limit
            ? options.limit(() => getNutrientAdvice(fdm, input))
            : getNutrientAdvice(fdm, input),
        ),
    ),
  })
  return { getNutrientAdvice }
})
const suggestion = vi.hoisted(() => ({ getCultivationSuggestion: vi.fn() }))

vi.mock("@nmi-agro/fdm-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...core,
}))
vi.mock("./index", () => advice)
vi.mock("../other/cultivation-suggestion", () => suggestion)

const { findMainCultivation, getFarmNutrientAdviceRows, startFarmNutrientAdviceRows } =
  await import("./farm")

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

describe("farm nutrient advice edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    core.getCultivationsForFarm.mockResolvedValue(new Map([["f1", [mainCultivation]]]))
    core.getFertilizerApplicationsForFarm.mockResolvedValue(new Map())
    core.getCurrentSoilDataForFarm.mockResolvedValue(new Map())
    core.getFertilizers.mockResolvedValue([])
    advice.getNutrientAdvice.mockResolvedValue({ d_n_req: 120 })
  })

  it("finds no main cultivation in an empty list", () => {
    expect(findMainCultivation([], 2026)).toBeUndefined()
  })

  it("requests the advice of all fields at once with the given concurrency", async () => {
    core.getCultivationsForFarm.mockResolvedValue(
      new Map(["f1", "f2", "f3"].map((b_id) => [b_id, [mainCultivation]])),
    )
    const rows = await Promise.all(
      startFarmNutrientAdviceRows({
        ...input([field("f1"), field("f2"), field("f3")]),
        concurrency: 1,
      }),
    )
    expect(rows).toHaveLength(3)
    // One cache lookup for all fields; the limit of requests is applied by `many`
    expect(advice.getNutrientAdvice.many).toHaveBeenCalledTimes(1)
    expect(advice.getNutrientAdvice.many).toHaveBeenCalledWith(
      fdm,
      [
        expect.objectContaining({ b_lu_catalogue: "nl_2014" }),
        expect.objectContaining({ b_lu_catalogue: "nl_2014" }),
        expect.objectContaining({ b_lu_catalogue: "nl_2014" }),
      ],
      { limit: expect.any(Function) },
    )
  })

  it("runs one cultivation suggestion at a time with a concurrency of 1", async () => {
    const lateCultivation = {
      ...mainCultivation,
      b_lu_start: new Date("2026-08-01"),
      b_lu_end: new Date("2026-10-01"),
    }
    core.getCultivationsForFarm.mockResolvedValue(
      new Map(["f1", "f2", "f3"].map((b_id) => [b_id, [lateCultivation]])),
    )
    let running = 0
    let maxRunning = 0
    suggestion.getCultivationSuggestion.mockImplementation(async () => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise((resolve) => setTimeout(resolve, 1))
      running--
      return { b_lu_catalogue: "nl_265" }
    })
    const rows = await Promise.all(
      startFarmNutrientAdviceRows({
        ...input([field("f1"), field("f2"), field("f3")]),
        concurrency: 1,
      }),
    )
    expect(rows.map((row) => row.error?.code)).toEqual([
      "no_main_cultivation",
      "no_main_cultivation",
      "no_main_cultivation",
    ])
    expect(maxRunning).toBe(1)
  })

  it("shares one limit between cultivation suggestions and advice requests", async () => {
    const lateCultivation = {
      ...mainCultivation,
      b_lu_start: new Date("2026-08-01"),
      b_lu_end: new Date("2026-10-01"),
    }
    core.getCultivationsForFarm.mockResolvedValue(
      new Map([
        ["f1", [mainCultivation]],
        ["f2", [lateCultivation]],
        ["f3", [mainCultivation]],
        ["f4", [lateCultivation]],
      ]),
    )
    let running = 0
    let maxRunning = 0
    const track = async <T>(value: T) => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      return value
    }
    advice.getNutrientAdvice.mockImplementation(() => track({ d_n_req: 1 }))
    suggestion.getCultivationSuggestion.mockImplementation(() =>
      track({ b_lu_catalogue: "nl_265" }),
    )

    const rows = await Promise.all(
      startFarmNutrientAdviceRows({
        ...input(["f1", "f2", "f3", "f4"].map(field)),
        concurrency: 2,
      }),
    )

    expect(rows.map((row) => row.error?.code)).toEqual([
      undefined,
      "no_main_cultivation",
      undefined,
      "no_main_cultivation",
    ])
    expect(maxRunning).toBe(2)
  })

  it("shows a cached advice without waiting for the advice of another field", async () => {
    core.getCultivationsForFarm.mockResolvedValue(
      new Map([
        ["f1", [mainCultivation]],
        ["f2", [mainCultivation]],
      ]),
    )
    let releaseSlowAdvice: (value: unknown) => void = () => undefined
    advice.getNutrientAdvice
      .mockReturnValueOnce(new Promise((resolve) => (releaseSlowAdvice = resolve)))
      .mockResolvedValueOnce({ d_n_req: 80 })

    const [slow, fast] = startFarmNutrientAdviceRows(input([field("f1"), field("f2")]))
    await expect(fast).resolves.toMatchObject({ b_id: "f2", values: { N: { advice: 80 } } })
    releaseSlowAdvice({ d_n_req: 10 })
    await expect(slow).resolves.toMatchObject({ b_id: "f1", values: { N: { advice: 10 } } })
  })

  it("reports a field whose dose cannot be calculated without requesting its advice", async () => {
    core.getFertilizerApplicationsForFarm.mockResolvedValue(
      new Map([["f1", [{ p_id: "unknown-fertilizer", p_app_amount: 100 }]]]),
    )
    const [row] = await getFarmNutrientAdviceRows(input([field("f1")]))
    expect(row?.error?.code).toBe("advice_failed")
    expect(row?.mainCultivation?.b_lu_catalogue).toBe("nl_2014")
    expect(advice.getNutrientAdvice).not.toHaveBeenCalled()
  })

  it("uses 0 ha for a field without area and keeps an unknown crop rotation", async () => {
    core.getCultivationsForFarm.mockResolvedValue(
      new Map([["f1", [{ ...mainCultivation, b_lu_croprotation: undefined }]]]),
    )
    const [row] = await getFarmNutrientAdviceRows(
      input([{ ...field("f1"), b_area: null as unknown as number }]),
    )
    expect(row?.b_area).toBe(0)
    expect(row?.mainCultivation?.b_lu_croprotation).toBeNull()
  })

  it("reports 0 ha for an error row of a field without area", async () => {
    const [row] = await getFarmNutrientAdviceRows(
      input([{ ...field("f9"), b_area: null as unknown as number }]),
    )
    expect(row).toMatchObject({ b_area: 0, error: { code: "no_cultivation" } })
  })

  it("describes an error that is not an Error", async () => {
    core.getFertilizers.mockRejectedValue("database unavailable")
    const [row] = await getFarmNutrientAdviceRows(input([field("f1")]))
    expect(row?.error).toEqual({ code: "farm_data_unavailable", message: "database unavailable" })
  })

  it("reports a field whose calculation fails outside the advice", async () => {
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
    suggestion.getCultivationSuggestion.mockRejectedValue(new Error("unexpected"))
    const [row] = await getFarmNutrientAdviceRows(input([field("f1")]))
    expect(row?.error).toEqual({ code: "advice_failed", message: "unexpected" })
  })
})
