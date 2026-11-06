import { describe, expect, it } from "vitest"
import type {
  SeasonPlanCropRotation,
  SeasonPlanCultivation,
  SeasonPlanData,
  SeasonPlanField,
  SeasonPlanMeasure,
  SeasonPlanRules,
} from "./season-plan.types"
import { startOfDayInFdmTimeZone } from "./date"
import {
  buildSeasonPlanProposal,
  classifyField,
  detectRotationCycle,
  evaluateSeasonPlanProgress,
  findSeasonPlanRules,
  getCatchCrops,
  getFieldStatus,
  getMainCultivationHistory,
  getRotationWarnings,
  getYearInFdmTimeZone,
  getYearTimeframe,
  groupMeasures,
  isFieldActiveInYear,
  isHarvestExpected,
  resolveSeasonPlanRules,
  resolveSeasonPlanTargetFromData,
  SEASON_PLAN_STEPS,
  shiftDateToYear,
} from "./season-plan-rules"

// Synthetic fixtures only.
const day = (year: number, month: number, d: number) => startOfDayInFdmTimeZone(year, month, d)

let counter = 0
function cultivation(
  b_id: string,
  b_lu_catalogue: string,
  b_lu_croprotation: SeasonPlanCropRotation | null,
  b_lu_start: Date | null,
  b_lu_end: Date | null,
  b_lu_harvestable: SeasonPlanCultivation["b_lu_harvestable"] = "once",
): SeasonPlanCultivation {
  counter++
  return {
    b_lu: `lu_${counter}`,
    b_id,
    b_lu_catalogue,
    b_lu_name: b_lu_catalogue,
    b_lu_croprotation,
    b_lu_harvestable,
    b_lu_start,
    b_lu_end,
  }
}

/** A main cultivation from 1 April to 15 September of a year. */
function arable(
  b_id: string,
  b_lu_catalogue: string,
  rotation: SeasonPlanCropRotation,
  year: number,
) {
  return cultivation(b_id, b_lu_catalogue, rotation, day(year, 4, 1), day(year, 9, 15))
}

function field(
  b_id: string,
  b_start: Date,
  b_end: Date | null = null,
  bufferstrip = false,
): SeasonPlanField {
  return { b_id, b_name: `Perceel ${b_id}`, b_start, b_end, b_bufferstrip: bufferstrip }
}

function emptyData(fields: SeasonPlanField[]): SeasonPlanData {
  return {
    fields,
    cultivations: new Map(),
    fertilizerApplications: new Map(),
    harvests: new Map(),
    measures: new Map(),
  }
}

function measure(
  b_id_measure: string,
  m_id: string,
  m_start: Date | null,
  m_end: Date | null,
): SeasonPlanMeasure {
  return { b_id_measure, b_id: "f1", m_id, m_name: m_id, m_start, m_end }
}

const rules = resolveSeasonPlanRules(2027)

describe("resolveSeasonPlanRules", () => {
  const registry: SeasonPlanRules[] = [
    { ...rules, rulesYear: 2025, historyYears: 6 },
    { ...rules, rulesYear: 2027, historyYears: 4 },
  ]

  it("uses the entry of the target year", () => {
    const resolved = resolveSeasonPlanRules(2027, registry)
    expect(resolved.rulesYear).toBe(2027)
    expect(resolved.historyYears).toBe(4)
    expect(resolved.provisional).toBe(false)
  })

  it("falls back to the newest older entry and marks it provisional", () => {
    const resolved = resolveSeasonPlanRules(2026, registry)
    expect(resolved.rulesYear).toBe(2025)
    expect(resolved.provisional).toBe(true)
    expect(resolveSeasonPlanRules(2030, registry).rulesYear).toBe(2027)
  })

  it("throws when no entry applies", () => {
    expect(() => resolveSeasonPlanRules(2020, registry)).toThrow()
    expect(findSeasonPlanRules(2020, registry)).toBeNull()
  })

  it("has rules for 2027 based on the current rules", () => {
    expect(rules.rulesYear).toBe(2025)
    expect(rules.provisional).toBe(true)
  })
})

describe("dates", () => {
  it("returns the year in Europe/Amsterdam", () => {
    expect(getYearInFdmTimeZone(new Date("2026-12-31T23:30:00Z"))).toBe(2027)
    expect(getYearInFdmTimeZone(new Date("2026-12-31T22:30:00Z"))).toBe(2026)
  })

  it("returns the timeframe of a year in Europe/Amsterdam", () => {
    const { start, end } = getYearTimeframe(2027)
    expect(start.toISOString()).toBe("2026-12-31T23:00:00.000Z")
    expect(end.toISOString()).toBe("2027-12-31T22:59:59.999Z")
  })

  it("moves a date to another year keeping date and time of day", () => {
    const date = new Date("2026-03-15T09:30:00Z") // 10:30 in Amsterdam (CET)
    expect(shiftDateToYear(date, 2027).toISOString()).toBe("2027-03-15T09:30:00.000Z")
    // Summer time
    expect(shiftDateToYear(new Date("2026-06-01T08:00:00Z"), 2027).toISOString()).toBe(
      "2027-06-01T08:00:00.000Z",
    )
  })

  it("moves 29 February to 28 February in a non-leap year", () => {
    const date = day(2028, 2, 29)
    expect(shiftDateToYear(date, 2029).getTime()).toBe(day(2029, 2, 28).getTime())
    expect(shiftDateToYear(date, 2032).getTime()).toBe(day(2032, 2, 29).getTime())
  })
})

describe("field status", () => {
  it("treats a field without end date as active in later years", () => {
    expect(isFieldActiveInYear(field("f1", day(2020, 1, 1)), 2027)).toBe(true)
    expect(getFieldStatus(field("f1", day(2020, 1, 1)), 2027)).toBe("kept")
  })

  it("marks a field ending on 31 December or 1 January as dropped for the next year", () => {
    expect(getFieldStatus(field("f1", day(2020, 1, 1), day(2026, 12, 31)), 2027)).toBe("dropped")
    expect(getFieldStatus(field("f1", day(2020, 1, 1), day(2027, 1, 1)), 2027)).toBe("dropped")
  })

  it("marks a field starting in the target year as new", () => {
    expect(getFieldStatus(field("f1", day(2027, 1, 1)), 2027)).toBe("new")
  })

  it("returns null for a field outside both years", () => {
    expect(getFieldStatus(field("f1", day(2020, 1, 1), day(2024, 12, 31)), 2027)).toBeNull()
    expect(getFieldStatus(field("f1", day(2028, 1, 1)), 2027)).toBeNull()
  })
})

describe("history and rotation", () => {
  it("uses the hoofdteelt, not cultivations that only overlap the year", () => {
    const winterWheat = cultivation("f1", "wheat", "cereal", day(2026, 10, 15), day(2027, 8, 1))
    const catchCrop = cultivation("f1", "mustard", "catchcrop", day(2026, 8, 15), day(2027, 2, 15))
    const history = getMainCultivationHistory([winterWheat, catchCrop], 2026, 2027)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ year: 2027, b_lu_catalogue: "wheat" })
  })

  it("detects a 4-year rotation", () => {
    const crops: [string, SeasonPlanCropRotation][] = [
      ["potato", "potato"],
      ["wheat", "cereal"],
      ["beet", "sugarbeet"],
      ["onion", "other"],
    ]
    const cultivations = [2021, 2022, 2023, 2024, 2025, 2026].map((year, i) =>
      arable("f1", crops[i % 4][0], crops[i % 4][1], year),
    )
    const history = getMainCultivationHistory(cultivations, 2021, 2026)
    expect(detectRotationCycle(history, 2027, [3, 4, 5])).toBe(4)
    const classified = classifyField(cultivations, history, 2027, rules)
    expect(classified).toEqual({ fieldType: "rotation", rotationCycle: 4, sourceYear: 2023 })
  })

  it("does not detect a cycle for a monoculture or too short history", () => {
    const maize = [2024, 2025, 2026].map((year) => arable("f1", "maize", "maize", year))
    const history = getMainCultivationHistory(maize, 2021, 2026)
    expect(detectRotationCycle(history, 2027, [3, 4, 5])).toBeNull()
    expect(classifyField(maize, history, 2027, rules)).toEqual({
      fieldType: "permanent",
      rotationCycle: null,
      sourceYear: 2026,
    })
    const short = getMainCultivationHistory([arable("f1", "wheat", "cereal", 2026)], 2021, 2026)
    expect(detectRotationCycle(short, 2027, [3, 4, 5])).toBeNull()
  })

  it("classifies continuing grassland as permanent", () => {
    const grass = cultivation("f1", "grass", "grass", day(2015, 1, 1), null, "multiple")
    const history = getMainCultivationHistory([grass], 2021, 2026)
    expect(classifyField([grass], history, 2027, rules)).toEqual({
      fieldType: "permanent",
      rotationCycle: null,
      sourceYear: 2026,
    })
  })

  it("classifies a field without history as new", () => {
    expect(classifyField([], [], 2027, rules)).toEqual({
      fieldType: "new",
      rotationCycle: null,
      sourceYear: null,
    })
  })

  it("warns when a crop category returns too soon", () => {
    const history = getMainCultivationHistory(
      [arable("f1", "potato", "potato", 2025), arable("f1", "wheat", "cereal", 2026)],
      2021,
      2026,
    )
    expect(getRotationWarnings(history, 2027, "potato", rules)).toEqual([
      { b_lu_croprotation: "potato", minYearsBetween: 3, lastYear: 2025 },
    ])
    expect(getRotationWarnings(history, 2028, "potato", rules)).toEqual([])
    expect(getRotationWarnings(history, 2027, "grass", rules)).toEqual([])
  })
})

describe("measures", () => {
  it("groups ongoing, expiring and ended measures", () => {
    const groups = groupMeasures(
      [
        measure("m1", "bln_A", day(2024, 1, 1), null),
        measure("m2", "bln_B", day(2024, 1, 1), day(2026, 12, 31)),
        measure("m3", "bln_C", day(2023, 1, 1), day(2024, 12, 31)),
        measure("m4", "bln_D", day(2025, 1, 1), day(2027, 1, 1)), // ends on 31 December 2026
      ],
      2027,
    )
    expect(groups.ongoing.map((m) => m.b_id_measure)).toEqual(["m1"])
    expect(groups.expiring.map((m) => m.b_id_measure)).toEqual(["m2", "m4"])
    expect(groups.ended.map((m) => m.b_id_measure)).toEqual(["m3"])
  })

  it("does not list a measure as expiring when it was renewed", () => {
    const groups = groupMeasures(
      [
        measure("m1", "bln_A", day(2024, 1, 1), day(2026, 12, 31)),
        measure("m2", "bln_A", day(2027, 1, 1), null),
      ],
      2027,
    )
    expect(groups.expiring).toEqual([])
    expect(groups.ongoing.map((m) => m.b_id_measure)).toEqual(["m2"])
  })
})

describe("catch crops and harvests", () => {
  it("finds catch crops after the main cultivation, including undersown ones", () => {
    const main = arable("f1", "maize", "maize", 2027)
    const after = cultivation("f1", "rye", "catchcrop", day(2027, 9, 20), day(2028, 2, 15))
    const undersown = cultivation("f1", "grass_under", "catchcrop", day(2027, 6, 1), null)
    const previousYear = cultivation(
      "f1",
      "mustard",
      "catchcrop",
      day(2026, 9, 1),
      day(2027, 2, 15),
    )
    const found = getCatchCrops([main, after, undersown, previousYear], main, 2027, rules)
    expect(found.map((c) => c.b_lu)).toEqual([after.b_lu, undersown.b_lu])
  })

  it("expects a harvest only when the crop is harvested in the year", () => {
    expect(isHarvestExpected(arable("f1", "wheat", "cereal", 2027), 2027)).toBe(true)
    expect(
      isHarvestExpected(
        cultivation("f1", "grass", "grass", day(2015, 1, 1), null, "multiple"),
        2027,
      ),
    ).toBe(true)
    expect(
      isHarvestExpected(
        cultivation("f1", "x", "other", day(2027, 4, 1), day(2027, 9, 1), "none"),
        2027,
      ),
    ).toBe(false)
    expect(
      isHarvestExpected(
        cultivation("f1", "x", "other", day(2027, 4, 1), day(2028, 9, 1), "once"),
        2027,
      ),
    ).toBe(false)
  })
})

/** A farm with a kept arable field (f1), kept grassland (f2), a dropped field (f3) and a new field (f4). */
function farm2026() {
  const data = emptyData([
    field("f1", day(2020, 1, 1)),
    field("f2", day(2020, 1, 1)),
    field("f3", day(2020, 1, 1), day(2026, 12, 31)),
    field("f4", day(2027, 1, 1)),
  ])
  const grass = cultivation("f2", "grass", "grass", day(2015, 1, 1), null, "multiple")
  data.cultivations.set("f1", [arable("f1", "potato", "potato", 2026)])
  data.cultivations.set("f2", [grass])
  data.cultivations.set("f3", [arable("f3", "wheat", "cereal", 2026)])
  data.fertilizerApplications.set("f1", [
    { p_app_id: "a1", p_id: "p1", p_app_date: day(2026, 3, 20) },
  ])
  data.fertilizerApplications.set("f2", [
    { p_app_id: "a2", p_id: "p2", p_app_date: day(2026, 2, 20) },
  ])
  return { data, grass }
}

describe("evaluateSeasonPlanProgress", () => {
  it("starts with all data-dependent steps open", () => {
    const { data, grass } = farm2026()
    const progress = evaluateSeasonPlanProgress(data, 2027)
    const step = (name: string) => progress.steps.find((s) => s.step === name)
    expect(progress.steps.map((s) => s.step)).toEqual([...SEASON_PLAN_STEPS])
    expect(progress.started).toBe(true) // f3 dropped, f4 new
    expect(progress.complete).toBe(false)
    expect(progress.firstIncompleteStep).toBe("cultivations")
    expect(step("start")?.done).toBe(true)
    expect(step("fields")?.done).toBe(true)
    expect(step("cultivations")?.pending).toEqual(["f1", "f4"])
    expect(step("fertilizers")?.pending).toEqual(["f1", "f2", "f4"])
    expect(step("harvests")?.pending).toEqual([grass.b_lu])
    expect(progress.fieldStatus.get("f3")).toBe("dropped")
    expect(progress.fieldStatus.get("f4")).toBe("new")
    expect(progress.provisional).toBe(true)
  })

  it("is complete once every blocking item is recorded", () => {
    const { data, grass } = farm2026()
    const wheat = arable("f1", "wheat", "cereal", 2027)
    const maize = arable("f4", "maize", "maize", 2027)
    data.cultivations.get("f1")?.push(wheat)
    data.cultivations.set("f4", [maize])
    for (const b_id of ["f1", "f2", "f4"]) {
      const list = data.fertilizerApplications.get(b_id) ?? []
      list.push({ p_app_id: `${b_id}-2027`, p_id: "p1", p_app_date: day(2027, 3, 1) })
      data.fertilizerApplications.set(b_id, list)
    }
    for (const c of [wheat, maize, grass]) {
      data.harvests.set(c.b_lu, [
        { b_id_harvesting: `h-${c.b_lu}`, b_lu: c.b_lu, b_lu_harvest_date: day(2027, 8, 1) },
      ])
    }
    const progress = evaluateSeasonPlanProgress(data, 2027)
    expect(progress.firstIncompleteStep).toBeNull()
    expect(progress.complete).toBe(true)
    // Arable fields without catch crop are notices, not blocking
    expect(progress.steps.find((s) => s.step === "catch_crops")?.notices).toEqual(["f1", "f4"])
  })

  it("blocks on a required catch crop", () => {
    const { data } = farm2026()
    data.cultivations.get("f1")?.push(arable("f1", "maize", "maize", 2027))
    const required = evaluateSeasonPlanProgress(data, 2027, {
      isCatchCropRequired: (b_id) => b_id === "f1",
    })
    expect(required.steps.find((s) => s.step === "catch_crops")?.pending).toEqual(["f1"])

    data.cultivations
      .get("f1")
      ?.push(cultivation("f1", "rye", "catchcrop", day(2027, 9, 20), day(2028, 2, 15)))
    const recorded = evaluateSeasonPlanProgress(data, 2027, {
      isCatchCropRequired: (b_id) => b_id === "f1",
    })
    expect(recorded.steps.find((s) => s.step === "catch_crops")?.done).toBe(true)
  })

  it("does not ask for fertilizers on buffer strips, nature or fields without applications before", () => {
    const data = emptyData([
      field("b1", day(2020, 1, 1), null, true),
      field("n1", day(2020, 1, 1)),
      field("u1", day(2020, 1, 1)),
    ])
    data.fertilizerApplications.set("b1", [
      { p_app_id: "x", p_id: "p", p_app_date: day(2026, 3, 1) },
    ])
    data.fertilizerApplications.set("n1", [
      { p_app_id: "y", p_id: "p", p_app_date: day(2026, 3, 1) },
    ])
    data.cultivations.set("n1", [
      cultivation("n1", "nature", "nature", day(2015, 1, 1), null, "none"),
    ])
    const progress = evaluateSeasonPlanProgress(data, 2027)
    expect(progress.steps.find((s) => s.step === "fertilizers")?.pending).toEqual([])
  })

  it("lists expired measures that were not renewed as notices", () => {
    const { data } = farm2026()
    data.measures.set("f1", [measure("m1", "bln_A", day(2024, 1, 1), day(2026, 12, 31))])
    const progress = evaluateSeasonPlanProgress(data, 2027)
    const step = progress.steps.find((s) => s.step === "measures")
    expect(step?.done).toBe(true)
    expect(step?.notices).toEqual(["m1"])
  })

  it("is not started for a farm without changes or data in the target year", () => {
    const data = emptyData([field("f1", day(2020, 1, 1))])
    data.cultivations.set("f1", [arable("f1", "wheat", "cereal", 2026)])
    expect(evaluateSeasonPlanProgress(data, 2027).started).toBe(false)
  })
})

describe("resolveSeasonPlanTargetFromData", () => {
  it("returns the current year while its plan is incomplete", () => {
    const data = emptyData([field("f1", day(2020, 1, 1))])
    data.cultivations.set("f1", [arable("f1", "wheat", "cereal", 2025)])
    expect(resolveSeasonPlanTargetFromData(data, 2026)).toEqual({
      targetYear: 2026,
      complete: false,
      availableYears: [2026, 2027],
    })
  })

  it("returns the next year when the current year is complete", () => {
    const data = emptyData([field("f1", day(2020, 1, 1))])
    const wheat = arable("f1", "wheat", "cereal", 2026)
    data.cultivations.set("f1", [arable("f1", "beet", "sugarbeet", 2025), wheat])
    data.harvests.set(wheat.b_lu, [
      { b_id_harvesting: "h", b_lu: wheat.b_lu, b_lu_harvest_date: day(2026, 8, 1) },
    ])
    const target = resolveSeasonPlanTargetFromData(data, 2026)
    expect(target?.targetYear).toBe(2027)
    expect(target?.complete).toBe(false)
  })

  it("keeps the wizard accessible when everything is complete", () => {
    const data = emptyData([field("f1", day(2020, 1, 1))])
    data.cultivations.set("f1", [
      cultivation("f1", "nature", "nature", day(2015, 1, 1), null, "none"),
    ])
    expect(resolveSeasonPlanTargetFromData(data, 2026)).toEqual({
      targetYear: 2027,
      complete: true,
      availableYears: [2026, 2027],
    })
  })

  it("skips years before the first rules year", () => {
    const data = emptyData([field("f1", day(2020, 1, 1))])
    data.cultivations.set("f1", [arable("f1", "wheat", "cereal", 2023)])
    expect(resolveSeasonPlanTargetFromData(data, 2023)).toBeNull()
    expect(resolveSeasonPlanTargetFromData(data, 2024)?.availableYears).toEqual([2025])
  })

  it("returns null for a farm without history", () => {
    expect(
      resolveSeasonPlanTargetFromData(emptyData([field("f1", day(2026, 1, 1))]), 2026),
    ).toBeNull()
  })
})

describe("buildSeasonPlanProposal", () => {
  it("proposes per field and lists dropped fields", () => {
    const { data } = farm2026()
    data.measures.set("f3", [measure("m3", "bln_A", day(2024, 1, 1), null)])
    const proposal = buildSeasonPlanProposal(data, 2027)
    expect(proposal.droppedFields.map((f) => f.b_id)).toEqual(["f3"])
    expect(proposal.droppedFields[0].measures.expiring).toEqual([])

    const f2 = proposal.fields.find((f) => f.b_id === "f2")
    expect(f2).toMatchObject({ fieldType: "permanent", sourceYear: 2026, status: "kept" })
    expect(f2?.suggested?.b_lu_catalogue).toBe("grass")
    expect(f2?.fertilizerTemplate?.applications).toEqual([
      { p_app_id: "a2", p_id: "p2", p_app_date: day(2027, 2, 20) },
    ])

    const f4 = proposal.fields.find((f) => f.b_id === "f4")
    expect(f4).toMatchObject({ fieldType: "new", status: "new", sourceYear: null, suggested: null })
    expect(f4?.fertilizerTemplate).toBeNull()
  })

  it("proposes the crop of the rotation cycle with its fertilizer template", () => {
    const data = emptyData([field("f1", day(2015, 1, 1))])
    const crops: [string, SeasonPlanCropRotation][] = [
      ["potato", "potato"],
      ["wheat", "cereal"],
      ["beet", "sugarbeet"],
    ]
    data.cultivations.set(
      "f1",
      [2021, 2022, 2023, 2024, 2025, 2026].map((year, i) =>
        arable("f1", crops[i % 3][0], crops[i % 3][1], year),
      ),
    )
    data.fertilizerApplications.set("f1", [
      { p_app_id: "pot24", p_id: "p1", p_app_date: day(2024, 4, 1) },
      { p_app_id: "wh25", p_id: "p2", p_app_date: day(2025, 3, 1) },
    ])
    const proposal = buildSeasonPlanProposal(data, 2027)
    const f1 = proposal.fields[0]
    expect(f1).toMatchObject({ fieldType: "rotation", rotationCycle: 3, sourceYear: 2024 })
    expect(f1.suggested?.b_lu_catalogue).toBe("potato")
    expect(f1.rotationWarnings).toEqual([])
    expect(f1.fertilizerTemplate).toMatchObject({
      b_id: "f1",
      year: 2024,
      b_lu_catalogue: "potato",
    })
    expect(f1.fertilizerTemplate?.applications.map((a) => a.p_app_id)).toEqual(["pot24"])
  })

  it("follows the source year chosen by the user and copies from another field when needed", () => {
    const data = emptyData([field("f1", day(2015, 1, 1)), field("f2", day(2015, 1, 1))])
    data.cultivations.set("f1", [
      arable("f1", "wheat", "cereal", 2024),
      arable("f1", "beet", "sugarbeet", 2025),
      arable("f1", "onion", "other", 2026),
    ])
    data.cultivations.set("f2", [arable("f2", "wheat", "cereal", 2026)])
    data.fertilizerApplications.set("f2", [
      { p_app_id: "w26", p_id: "p1", p_app_date: day(2026, 3, 1) },
    ])
    const proposal = buildSeasonPlanProposal(data, 2027, new Map([["f1", 2024]]))
    const f1 = proposal.fields.find((f) => f.b_id === "f1")
    expect(f1?.sourceYear).toBe(2024)
    expect(f1?.availableSourceYears).toEqual([2024, 2025, 2026])
    expect(f1?.suggested?.b_lu_catalogue).toBe("wheat")
    expect(f1?.fertilizerTemplate).toMatchObject({ b_id: "f2", year: 2026 })

    // An unknown source year is ignored
    const ignored = buildSeasonPlanProposal(data, 2027, new Map([["f1", 2010]]))
    expect(ignored.fields.find((f) => f.b_id === "f1")?.sourceYear).toBe(2026)
  })

  it("shows the main cultivation already recorded for the target year", () => {
    const data = emptyData([field("f1", day(2015, 1, 1))])
    data.cultivations.set("f1", [
      arable("f1", "potato", "potato", 2026),
      arable("f1", "potato", "potato", 2027),
    ])
    const f1 = buildSeasonPlanProposal(data, 2027).fields[0]
    expect(f1.current?.b_lu_catalogue).toBe("potato")
    expect(f1.rotationWarnings).toEqual([
      { b_lu_croprotation: "potato", minYearsBetween: 3, lastYear: 2026 },
    ])
  })
})
