import { describe, expect, it } from "vitest"
import { combineFarmMeasureSummaries, type FarmMeasureSummary } from "./farm-measures"

const summary = (
  b_id_farm: string,
  measures: { m_id: string; start: string | null; fieldCount: number }[],
  area: number,
): FarmMeasureSummary =>
  ({
    b_id_farm,
    eligibleFields: [{ b_id: `${b_id_farm}-f1` }, { b_id: `${b_id_farm}-f2` }],
    measures: measures.map((m) => ({
      m_id: m.m_id,
      m_name: m.m_id === "m-1" ? "Bufferstrook" : "Akkerrand",
      m_start: m.start ? new Date(m.start) : null,
      m_end: null,
      fieldCount: m.fieldCount,
    })),
    mainCultivations: [
      { b_lu_catalogue: "nl_265", b_lu_name: "Grasland", b_lu_croprotation: "grass", b_area: area },
    ],
  }) as unknown as FarmMeasureSummary

describe("combineFarmMeasureSummaries", () => {
  it("combines measures and main cultivations of several farms", () => {
    const result = combineFarmMeasureSummaries([
      summary("a", [{ m_id: "m-1", start: "2026-03-01", fieldCount: 2 }], 4),
      summary(
        "b",
        [
          { m_id: "m-1", start: "2026-02-01", fieldCount: 1 },
          { m_id: "m-2", start: null, fieldCount: 1 },
        ],
        6,
      ),
    ])
    expect(result.eligibleFieldCount).toBe(4)
    expect(result.measures.map((m) => m.m_id)).toEqual(["m-2", "m-1"])
    expect(result.measures[1]).toMatchObject({
      b_id_farms: ["a", "b"],
      fieldCount: 3,
      m_start: new Date("2026-02-01"),
    })
    expect(result.mainCultivations).toEqual([
      { b_lu_catalogue: "nl_265", b_lu_name: "Grasland", b_lu_croprotation: "grass", b_area: 10 },
    ])
  })
})
