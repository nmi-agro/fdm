import { describe, expect, it } from "vitest"
import type { Bln3Score } from "./types"
import {
  getBestVariantIds,
  getFieldOpportunityCandidates,
  getMeasureFamilyId,
  getTopOpportunitiesForField,
} from "./postprocessing"

type OpportunityParams = Parameters<typeof getFieldOpportunityCandidates>[0]

const fieldParams = (): OpportunityParams => ({
  advice: {
    indicator_advice: [
      {
        indicator: "C_N",
        measures: [
          { m_id: "bln_BM56c", measure_impact: 0.3 },
          { m_id: "bln_BM56b", measure_impact: 0.2 },
          { m_id: "bln_BM239", measure_impact: 0.1 },
        ],
      },
    ],
  },
  score: {
    indicators: [
      { indicator_id: "C_N", status: 1, target: 2, index: 0.3, impact: 0, score: 0.3 },
      { indicator_id: "C_P", status: 1, target: 2, index: 0.5, impact: 0, score: 0.5 },
      { indicator_id: "P_DS", status: 1, target: 2, index: 0.9, impact: 0, score: 0.9 },
    ],
  },
  applicability: Object.fromEntries(
    ["bln_BM56b", "bln_BM56c", "bln_BM239"].map((id) => [
      id,
      { applicability: "applicable", message: "" },
    ]),
  ),
  activeMeasureIds: new Set(),
})

describe("measure family IDs", () => {
  it.each([
    ["bln_BM0a", "bln_BM0"],
    ["bln_BM239z", "bln_BM239"],
    ["bln_A12b", "bln_A12"],
    ["bln_BM56", "bln_BM56"],
    ["bln_BM56B", "bln_BM56B"],
    ["bln_BM56ab", "bln_BM56ab"],
    ["bln_bm56b", "bln_bm56b"],
    ["bln_BMb", "bln_BMb"],
    ["bln_56b", "bln_56b"],
    ["other_BM56b", "other_BM56b"],
    ["prefix_bln_BM56b", "prefix_bln_BM56b"],
    ["bln_BM56b_extra", "bln_BM56b_extra"],
    ["", ""],
  ])("maps %j to %j without grouping unrelated IDs", (id, family) => {
    expect(getMeasureFamilyId(id)).toBe(family)
  })
})

describe("best measure variants", () => {
  it("returns no winners for an empty map", () => {
    expect(getBestVariantIds(new Map())).toEqual(new Set())
  })

  it.each([
    ["bln_BM56a", "bln_BM56b", "bln_BM56c"],
    ["bln_BM56c", "bln_BM56b", "bln_BM56a"],
    ["bln_BM56b", "bln_BM56a", "bln_BM56c"],
  ])("breaks equal-impact ties independently of insertion order: %s, %s, %s", (...ids) => {
    expect(getBestVariantIds(new Map(ids.map((id) => [id, 0.2])))).toEqual(new Set(["bln_BM56a"]))
  })

  it("chooses by impact within each family without collapsing sources or numeric IDs", () => {
    const impacts = new Map([
      ["bln_BM56b", 0.8],
      ["bln_BM56c", 0.2],
      ["bln_BM57b", 0.1],
      ["bln_BM57c", 0.4],
      ["other_BM56b", 0.5],
      ["other_BM56c", 0.6],
      ["bln_BM560b", 0.3],
    ])
    const before = [...impacts]

    expect(getBestVariantIds(impacts)).toEqual(
      new Set(["bln_BM56b", "bln_BM57c", "other_BM56b", "other_BM56c", "bln_BM560b"]),
    )
    expect([...impacts]).toEqual(before)
  })

  it("selects zero and negative impacts by their numeric value", () => {
    expect(
      getBestVariantIds(
        new Map([
          ["bln_BM56b", -0.1],
          ["bln_BM56c", 0],
          ["bln_BM57b", -0.4],
          ["bln_BM57c", -0.2],
        ]),
      ),
    ).toEqual(new Set(["bln_BM56c", "bln_BM57c"]))
  })
})

describe.each([
  ["getFieldOpportunityCandidates", getFieldOpportunityCandidates],
  ["getTopOpportunitiesForField", getTopOpportunitiesForField],
] as const)("%s eligibility", (_name, select) => {
  it.each([null, { indicators: [] }] satisfies (Bln3Score | null)[])(
    "returns no opportunities without scored indicators: %j",
    (score) => {
      expect(select({ ...fieldParams(), score })).toEqual([])
    },
  )

  it("returns no opportunities for empty advice", () => {
    expect(select({ ...fieldParams(), advice: { indicator_advice: [] } })).toEqual([])
  })

  it.each(["inapplicable", "not yet applicable"] as const)(
    "falls back to an eligible sibling when the highest-impact variant is %s",
    (applicability) => {
      const params = fieldParams()
      params.applicability.bln_BM56c = { applicability, message: "Not eligible" }
      expect(select(params).map((o) => o.m_id)).toEqual(["bln_BM56b", "bln_BM239"])
    },
  )

  it("does not infer applicability from an eligible sibling", () => {
    const params = fieldParams()
    delete params.applicability.bln_BM56c
    expect(select(params).map((o) => o.m_id)).toEqual(["bln_BM56b", "bln_BM239"])
    expect(select({ ...params, applicability: {} })).toEqual([])
  })

  it.each(["bln_BM56", "bln_BM56b", "bln_BM56z"])(
    "excludes every variant of the active family identified by %s",
    (activeId) => {
      expect(
        select({ ...fieldParams(), activeMeasureIds: new Set([activeId]) }).map((o) => o.m_id),
      ).toEqual(["bln_BM239"])
    },
  )

  it("excludes an active standalone measure without excluding other families", () => {
    const result = select({ ...fieldParams(), activeMeasureIds: new Set(["bln_BM239"]) })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((o) => getMeasureFamilyId(o.m_id) === "bln_BM56")).toBe(true)
  })

  it.each(["other_BM56b", "bln_BM560b"])(
    "does not let the unrelated active measure %s block a family",
    (activeId) => {
      expect(select({ ...fieldParams(), activeMeasureIds: new Set([activeId]) })).toEqual(
        select(fieldParams()),
      )
    },
  )

  it("excludes green and unscored indicators before comparing variants", () => {
    const params = fieldParams()
    params.advice.indicator_advice.push(
      { indicator: "P_DS", measures: [{ m_id: "bln_BM56b", measure_impact: 10 }] },
      { indicator: "UNKNOWN", measures: [{ m_id: "bln_BM56b", measure_impact: 20 }] },
    )
    expect(select(params)).toEqual(select(fieldParams()))
  })

  it.each([
    [0.694, true],
    [0.695, false],
    [0.7, false],
  ])("uses the displayed green threshold for score %s", (value, eligible) => {
    const params = fieldParams()
    params.score = {
      indicators: [
        { indicator_id: "C_N", status: 1, target: 2, index: value, impact: 0, score: value },
      ],
    }
    expect(select(params).length > 0).toBe(eligible)
  })

  it("keeps the inputs unchanged across repeated selections", () => {
    const params = fieldParams()
    params.advice.indicator_advice.push({
      indicator: "C_P",
      measures: [{ m_id: "bln_BM56c", measure_impact: 0.1 }],
    })
    const before = structuredClone(params)
    const result = select(params)
    expect(select(params)).toEqual(result)
    expect(params).toEqual(before)
  })
})

describe("variant impact aggregation", () => {
  it("includes negative impacts and preserves indicator details when ranking families", () => {
    const params = fieldParams()
    params.advice.indicator_advice.push({
      indicator: "C_P",
      measures: [{ m_id: "bln_BM56c", measure_impact: -0.2 }],
    })

    expect(getFieldOpportunityCandidates(params)).toEqual([
      {
        m_id: "bln_BM56b",
        aggregateImpact: 0.2,
        indicatorImpacts: [{ indicator_id: "C_N", measure_impact: 0.2 }],
      },
      {
        m_id: "bln_BM56c",
        aggregateImpact: 0.1,
        indicatorImpacts: [
          { indicator_id: "C_N", measure_impact: 0.3 },
          { indicator_id: "C_P", measure_impact: -0.2 },
        ],
      },
      {
        m_id: "bln_BM239",
        aggregateImpact: 0.1,
        indicatorImpacts: [{ indicator_id: "C_N", measure_impact: 0.1 }],
      },
    ])
    expect(getTopOpportunitiesForField(params).map((o) => o.m_id)).toEqual([
      "bln_BM56b",
      "bln_BM239",
    ])
  })

  it("breaks decimal-sum ties by suffix rather than floating-point rounding", () => {
    const params = fieldParams()
    params.advice.indicator_advice[0].measures = [
      { m_id: "bln_BM56c", measure_impact: 0.1 },
      { m_id: "bln_BM56b", measure_impact: 0.3 },
    ]
    params.advice.indicator_advice.push({
      indicator: "C_P",
      measures: [{ m_id: "bln_BM56c", measure_impact: 0.2 }],
    })

    expect(getTopOpportunitiesForField(params)).toEqual([
      {
        m_id: "bln_BM56b",
        aggregateImpact: 0.3,
        indicatorImpacts: [{ indicator_id: "C_N", measure_impact: 0.3 }],
      },
    ])
  })

  it("retains losing field variants whose combined impact wins across the farm", () => {
    const fields = [
      [0.5, 0.49],
      [0.5, 0.49],
      [0.01, 0.4],
    ].map(([b, c]) => {
      const params = fieldParams()
      params.advice.indicator_advice[0].measures = [
        { m_id: "bln_BM56b", measure_impact: b },
        { m_id: "bln_BM56c", measure_impact: c },
      ]
      return params
    })

    expect(fields.map((params) => getTopOpportunitiesForField(params).map((o) => o.m_id))).toEqual([
      ["bln_BM56b"],
      ["bln_BM56b"],
      ["bln_BM56c"],
    ])
    const candidatesByField = fields.map(getFieldOpportunityCandidates)
    expect(candidatesByField.map((candidates) => candidates.map((o) => o.m_id).sort())).toEqual([
      ["bln_BM56b", "bln_BM56c"],
      ["bln_BM56b", "bln_BM56c"],
      ["bln_BM56b", "bln_BM56c"],
    ])
    const totalFor = (id: string) =>
      candidatesByField
        .flat()
        .filter((o) => o.m_id === id)
        .reduce((sum, o) => sum + o.aggregateImpact, 0)
    expect(totalFor("bln_BM56b")).toBeCloseTo(1.01)
    expect(totalFor("bln_BM56c")).toBeCloseTo(1.38)
    expect(
      getBestVariantIds(
        new Map([
          ["bln_BM56b", totalFor("bln_BM56b")],
          ["bln_BM56c", totalFor("bln_BM56c")],
        ]),
      ),
    ).toEqual(new Set(["bln_BM56c"]))
  })
})
