import type { FdmType } from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"

const core = vi.hoisted(() => ({
  getFields: vi.fn(),
  getMeasuresForFarm: vi.fn(),
  getCultivationsForFarm: vi.fn(),
}))

vi.mock("@nmi-agro/fdm-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...core,
}))

const { combineFarmMeasureSummaries, getFarmMeasureSummary } = await import("./farm-measures")

const fdm = {} as FdmType
const timeframe = { start: new Date("2026-01-01"), end: new Date("2026-12-31") }

const cultivation = (b_lu_catalogue: string, b_lu_croprotation: string | null) => ({
  b_lu: `lu-${b_lu_catalogue}`,
  b_lu_catalogue,
  b_lu_name: b_lu_catalogue,
  b_lu_croprotation,
  b_lu_start: new Date("2026-03-01"),
  b_lu_end: new Date("2026-10-01"),
})

const measure = (m_id: string, start: string | null, end: string | null) => ({
  m_id,
  m_name: m_id,
  m_start: start ? new Date(start) : null,
  m_end: end ? new Date(end) : null,
})

describe("getFarmMeasureSummary", () => {
  it("summarizes the measures and main cultivations of the eligible fields", async () => {
    core.getFields.mockResolvedValue([
      { b_id: "f1", b_area: 2, b_bufferstrip: false },
      { b_id: "f2", b_area: null, b_bufferstrip: false },
      { b_id: "f3", b_area: 1, b_bufferstrip: false },
      { b_id: "buffer", b_area: 1, b_bufferstrip: true },
      { b_id: "f4", b_area: 1, b_bufferstrip: false },
    ])
    core.getCultivationsForFarm.mockResolvedValue(
      new Map([
        ["f1", [cultivation("nl_265", "grass")]],
        ["f2", [cultivation("nl_265", "grass")]],
        ["f3", [cultivation("nl_233", null)]],
        // f4 has no cultivation: it counts, but has no main cultivation.
      ]),
    )
    core.getMeasuresForFarm.mockResolvedValue(
      new Map([
        ["f1", [measure("m-1", "2026-03-01", "2026-09-01"), measure("m-2", null, null)]],
        ["f2", [measure("m-1", "2026-02-01", "2026-10-01")]],
        [
          "f3",
          [measure("m-1", "2026-04-01", "2026-08-01"), measure("m-2", "2026-01-01", "2026-02-01")],
        ],
        ["buffer", [measure("m-3", null, null)]],
      ]),
    )

    const summary = await getFarmMeasureSummary(fdm, "p1", "farm-1", timeframe, 2026)

    expect(summary.eligibleFields.map((field) => field.b_id)).toEqual(["f1", "f2", "f3", "f4"])
    expect(summary.measures.find((m) => m.m_id === "m-1")).toMatchObject({
      fieldCount: 3,
      m_start: new Date("2026-02-01"),
      m_end: new Date("2026-10-01"),
    })
    expect(summary.measures.find((m) => m.m_id === "m-2")).toMatchObject({
      fieldCount: 2,
      m_start: null,
      m_end: null,
    })
    expect(summary.measures.some((m) => m.m_id === "m-3")).toBe(false)
    expect(summary.mainCultivations).toEqual([
      { b_lu_catalogue: "nl_265", b_lu_name: "nl_265", b_lu_croprotation: "grass", b_area: 2 },
      { b_lu_catalogue: "nl_233", b_lu_name: "nl_233", b_lu_croprotation: null, b_area: 1 },
    ])
  })
})

describe("combineFarmMeasureSummaries edge cases", () => {
  const summary = (b_id_farm: string, start: string | null, end: string | null) =>
    ({
      b_id_farm,
      eligibleFields: [],
      measures: [{ ...measure("m-1", start, end), fieldCount: 1 }],
      mainCultivations: [],
    }) as never

  it("keeps the earliest start and latest end, and counts each farm once", () => {
    const result = combineFarmMeasureSummaries([
      summary("a", "2026-03-01", "2026-09-01"),
      summary("b", "2026-02-01", "2026-10-01"),
      summary("a", "2026-04-01", "2026-08-01"),
    ])
    expect(result.measures[0]).toMatchObject({
      b_id_farms: ["a", "b"],
      fieldCount: 3,
      m_start: new Date("2026-02-01"),
      m_end: new Date("2026-10-01"),
    })
  })

  it("uses null when a farm has no start or end date", () => {
    const withNull = combineFarmMeasureSummaries([
      summary("a", "2026-03-01", "2026-09-01"),
      summary("b", null, null),
    ])
    expect(withNull.measures[0]).toMatchObject({ m_start: null, m_end: null })
    const onlyNull = combineFarmMeasureSummaries([summary("a", null, null)])
    expect(onlyNull.measures[0]).toMatchObject({ m_start: null, m_end: null })
  })
})
