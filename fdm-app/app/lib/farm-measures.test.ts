import { describe, expect, it } from "vitest"
import { type FieldMeasureStatusSources, mergeFieldMeasureStatus } from "./farm-measures"

const fieldNames = new Map<string, string | null>([
  ["f1", "Zuidakker"],
  ["f2", "Achterweide"],
  ["f3", null],
])

function merge(sources: Partial<FieldMeasureStatusSources>) {
  return mergeFieldMeasureStatus({
    fieldNames,
    measuresMap: new Map(),
    opportunitiesByField: {},
    applicabilityByField: {},
    ...sources,
  })
}

describe("mergeFieldMeasureStatus", () => {
  it("returns no measures without any source", () => {
    expect(merge({}).size).toBe(0)
  })

  it("lets applied win over recommended, and recommended over applicable", () => {
    const start = new Date("2026-03-01")
    const result = merge({
      measuresMap: new Map([["f1", [{ m_id: "bln_BM1", m_start: start, m_end: null }]]]),
      opportunitiesByField: {
        f1: [{ m_id: "bln_BM1", indicatorImpacts: [] }],
        f2: [{ m_id: "bln_BM1", indicatorImpacts: [] }],
      },
      applicabilityByField: {
        f1: { bln_BM1: { applicability: "applicable" } },
        f2: { bln_BM1: { applicability: "applicable" } },
        f3: { bln_BM1: { applicability: "applicable" } },
      },
    })

    expect(result.get("bln_BM1")).toEqual([
      {
        b_id: "f1",
        b_name: "Zuidakker",
        status: "applied",
        m_start: start,
        m_end: null,
      },
      { b_id: "f2", b_name: "Achterweide", status: "recommended", indicatorIds: [] },
      { b_id: "f3", b_name: null, status: "applicable" },
    ])
  })

  it("lists the improved indicators of a recommendation from largest to smallest", () => {
    const result = merge({
      opportunitiesByField: {
        f1: [
          {
            m_id: "bln_BM2",
            indicatorImpacts: [
              { indicator_id: "NUT_N", measure_impact: 0.2 },
              { indicator_id: "CR_CSEQ", measure_impact: 0.6 },
              { indicator_id: "NUT_P", measure_impact: 0 },
              { indicator_id: "GW_NLEA", measure_impact: -0.1 },
            ],
          },
        ],
      },
    })

    expect(result.get("bln_BM2")?.[0].indicatorIds).toEqual(["CR_CSEQ", "NUT_N"])
  })

  it("only counts measures that are applicable, and skips fields without applicability", () => {
    const result = merge({
      applicabilityByField: {
        f1: {
          bln_BM3: { applicability: "applicable" },
          bln_BM4: { applicability: "inapplicable" },
        },
        f2: null,
      },
    })

    expect([...result.keys()]).toEqual(["bln_BM3"])
    expect(result.get("bln_BM3")).toEqual([
      { b_id: "f1", b_name: "Zuidakker", status: "applicable" },
    ])
  })

  it("orders fields with the same status by name", () => {
    const result = merge({
      applicabilityByField: {
        f1: { bln_BM5: { applicability: "applicable" } },
        f2: { bln_BM5: { applicability: "applicable" } },
        f3: { bln_BM5: { applicability: "applicable" } },
      },
    })

    expect(result.get("bln_BM5")?.map((entry) => entry.b_id)).toEqual(["f3", "f2", "f1"])
  })

  it("keeps a field without a known name", () => {
    const result = merge({
      measuresMap: new Map([["unknown", [{ m_id: "bln_BM6", m_start: null, m_end: null }]]]),
    })

    expect(result.get("bln_BM6")?.[0]).toMatchObject({ b_id: "unknown", b_name: null })
  })
})
