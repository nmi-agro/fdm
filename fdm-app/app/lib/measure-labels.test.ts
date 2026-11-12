import { describe, expect, it } from "vitest"
import {
  formatConditions,
  formatEffectRange,
  getConditionValueLabel,
  getConditionVariableLabel,
  getEffectRanges,
  getEffectTypeInfo,
  getImpactedIndicators,
  getMeasureCostLevel,
  getMeasureReferences,
} from "./measure-labels"

describe("getMeasureCostLevel", () => {
  it("returns the level for a known cost value", () => {
    expect(getMeasureCostLevel(0)?.label).toBe("Laag")
    expect(getMeasureCostLevel(2)?.long).toBe("Hoge kosten")
  })

  it("returns null for unknown or missing costs", () => {
    expect(getMeasureCostLevel(null)).toBeNull()
    expect(getMeasureCostLevel(undefined)).toBeNull()
    expect(getMeasureCostLevel(5)).toBeNull()
  })
})

describe("getEffectTypeInfo", () => {
  it("returns the label of a known effect type", () => {
    expect(getEffectTypeInfo("classed")).toMatchObject({
      value: "classed",
      label: "Hangt af van perceel",
    })
  })

  it("falls back to the code for an unknown effect type", () => {
    expect(getEffectTypeInfo("new_type")).toEqual({
      value: "new_type",
      label: "new_type",
      description: "",
    })
  })

  it("returns null without an effect type", () => {
    expect(getEffectTypeInfo(null)).toBeNull()
    expect(getEffectTypeInfo("")).toBeNull()
  })
})

describe("getEffectRanges and formatEffectRange", () => {
  const effectSize = [
    {
      comment: "Base effects",
      conditions: [],
      impacts: [
        { key: "S_NUT_N", value: 0.5 },
        { key: "S_CR_CSEQ", value: 1 },
      ],
    },
    {
      comment: "On clay",
      conditions: [{ variable: "B_SOILTYPE_SCCAT4", values: ["klei"] }],
      impacts: [
        { key: "S_NUT_N", value: 0.05 },
        { key: "S_NUT_N", value: Number.NaN },
      ],
    },
  ]

  it("collects the lowest and highest value per score variable", () => {
    const ranges = getEffectRanges(effectSize)
    expect(ranges.get("S_NUT_N")).toEqual({ min: 0.05, max: 0.5 })
    expect(ranges.get("S_CR_CSEQ")).toEqual({ min: 1, max: 1 })
  })

  it("returns no ranges without effect sizes", () => {
    expect(getEffectRanges(null).size).toBe(0)
  })

  it("formats a single value, a range and a missing range", () => {
    expect(formatEffectRange({ min: 0.9, max: 0.9 })).toBe("0,9")
    expect(formatEffectRange({ min: 0.05, max: 1 })).toBe("0,05 – 1")
    expect(formatEffectRange(null)).toBe("—")
  })
})

describe("getImpactedIndicators", () => {
  it("translates, deduplicates and sorts the indicators by ecosystem service", () => {
    const indicators = getImpactedIndicators(
      ["S_NUT_N", "S_CR_CSEQ", "S_NUT_N", "S_UNKNOWN"],
      [{ comment: null, conditions: [], impacts: [{ key: "S_NUT_N", value: 0.5 }] }],
    )

    expect(indicators.map((indicator) => indicator.id)).toEqual(["CR_CSEQ", "NUT_N", "UNKNOWN"])
    expect(indicators[1]).toEqual({
      id: "NUT_N",
      name: "Stikstofbenutting",
      ecosysteemdienst: "Nutriëntenkringloop",
      effectRange: { min: 0.5, max: 0.5 },
    })
    expect(indicators[2]).toEqual({
      id: "UNKNOWN",
      name: "UNKNOWN",
      ecosysteemdienst: null,
      effectRange: null,
    })
  })

  it("returns no indicators without score variables", () => {
    expect(getImpactedIndicators(null)).toEqual([])
  })
})

describe("condition labels", () => {
  it("translates known variables and falls back to the code", () => {
    expect(getConditionVariableLabel("B_SOILTYPE_SCCAT4")).toBe("Grondsoort")
    expect(getConditionVariableLabel("B_NEW")).toBe("B_NEW")
  })

  it("translates values of each type", () => {
    expect(getConditionValueLabel("M_DRAIN", true)).toBe("Ja")
    expect(getConditionValueLabel("M_DRAIN", false)).toBe("Nee")
    expect(getConditionValueLabel("A_P_AL", 1500)).toBe("1.500")
    expect(getConditionValueLabel("B_SOILTYPE_SCCAT4", "loess")).toBe("Löss")
    expect(getConditionValueLabel("B_SOILTYPE_SCCAT4", "new_value")).toBe("new value")
  })
})

describe("formatConditions", () => {
  it("describes values and bounds, and leaves out hidden variables", () => {
    const conditions = formatConditions([
      { variable: "M_STAGE_APPLICABILITY", values: ["field"] },
      { variable: "B_SOILTYPE_SCCAT4", values: ["zand", "klei"] },
      { variable: "A_P_AL", min: 18, max: 50 },
      { variable: "A_P_CC", min: 0.8 },
      { variable: "B_LU_N_RESIDUE", max: 18 },
      { variable: "M_DRAIN", values: [] },
    ])

    expect(conditions).toEqual([
      { variable: "B_SOILTYPE_SCCAT4", label: "Grondsoort", value: "Zand, Klei" },
      { variable: "A_P_AL", label: "Fosfaattoestand (P-AL)", value: "tussen 18 en 50" },
      { variable: "A_P_CC", label: "Plantbeschikbaar fosfaat (P-CaCl2)", value: "ten minste 0,8" },
      { variable: "B_LU_N_RESIDUE", label: "Stikstof in gewasresten", value: "ten hoogste 18" },
      { variable: "M_DRAIN", label: "Buisdrainage", value: "—" },
    ])
  })

  it("returns no rows without conditions", () => {
    expect(formatConditions(undefined)).toEqual([])
  })
})

describe("getMeasureReferences", () => {
  it("lists the external IDs followed by the source link", () => {
    expect(
      getMeasureReferences({ bbwp: "B121", other: "X1" }, "https://example.org/measure"),
    ).toEqual([
      { key: "bbwp", label: "BBWP", value: "B121", href: null },
      { key: "other", label: "other", value: "X1", href: null },
      { key: "source", label: "", value: "Bekijk bron", href: "https://example.org/measure" },
    ])
  })

  it("returns no references without IDs or source", () => {
    expect(getMeasureReferences(null, null)).toEqual([])
  })
})
