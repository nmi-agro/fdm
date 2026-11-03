import { describe, expect, it } from "vitest"
import type { SoilParameters } from "./soil.types"
import {
  type AggregationAnalysis,
  aggregateParameter,
  clusterZones,
  hasOverlappingZones,
  selectContributingAnalyses,
  type ZoneAreas,
} from "./soil-aggregation"

/** Builds an analysis; zone analyses are identified by a non-null zone name. */
function analysis(
  a_id: string,
  date: string | null,
  values: Partial<Record<SoilParameters, unknown>>,
  has_zone = true,
): AggregationAnalysis {
  return {
    a_id,
    a_source: "other",
    b_sampling_date: date ? new Date(date) : null,
    a_depth_upper: 0,
    a_depth_lower: 30,
    has_zone,
    values,
  }
}

/**
 * Synthetic layout: a field of 100 m² split into a west zone (W, 50 m²) and an east zone (E, 50 m²).
 * Analyses whose id starts with "W" or "E" lie in that zone. "S" is a small zone within W (10 m²).
 */
function areas(fieldArea = 100): ZoneAreas {
  const zoneOf = (a_id: string) => a_id[0]
  const zoneArea: Record<string, number> = { W: 50, E: 50, S: 10 }
  const zone_area = new Map<string, number>()
  const ids = ["W1", "W2", "W3", "E1", "E2", "S1"]
  for (const id of ids) zone_area.set(id, zoneArea[zoneOf(id)])
  return {
    field_area: fieldArea,
    zone_area,
    intersection: (a, b) => {
      const za = zoneOf(a)
      const zb = zoneOf(b)
      if (za === zb) return zoneArea[za]
      if ((za === "S" && zb === "W") || (za === "W" && zb === "S")) return zoneArea.S
      return 0
    },
  }
}

function aggregate(
  parameter: SoilParameters,
  analyses: AggregationAnalysis[],
  zoneAreas = areas(),
) {
  const selected = selectContributingAnalyses(parameter, analyses, zoneAreas)
  const effective = new Map(selected.map((a) => [a.a_id, zoneAreas.zone_area.get(a.a_id) ?? 0]))
  return aggregateParameter(parameter, selected, effective, zoneAreas.field_area)
}

describe("soil aggregation", () => {
  it("uses the latest whole-field analysis when no zones exist", () => {
    const analyses = [
      analysis("F2", "2024-03-01", { a_p_al: 30 }, false),
      analysis("F1", "2020-03-01", { a_p_al: 20, a_som_loi: 3 }, false),
    ]
    const p = aggregate("a_p_al", analyses)
    expect(p?.value).toBe(30)
    expect(p?.is_aggregated).toBe(false)
    expect(p?.sources.map((s) => s.a_id)).toEqual(["F2"])
    expect(aggregate("a_som_loi", analyses)?.sources[0].a_id).toBe("F1")
  })

  it("takes the area-weighted mean of two zones without mixing them", () => {
    const analyses = [
      analysis("W1", "2024-03-10", { a_p_al: 40 }),
      analysis("E1", "2024-03-01", { a_p_al: 20 }),
    ]
    const p = aggregate("a_p_al", analyses, {
      ...areas(),
      zone_area: new Map([
        ["W1", 75],
        ["E1", 25],
      ]),
    })
    expect(p?.value).toBeCloseTo(35)
    expect(p?.is_aggregated).toBe(true)
    expect(p?.coverage).toBe(1)
    expect(p?.has_coverage_warning).toBe(false)
    expect(p?.sources.map((s) => [s.a_id, s.area_fraction])).toEqual([
      ["W1", 0.75],
      ["E1", 0.25],
    ])
  })

  it("keeps P, K and SOM of the same zone when a newer partial Nmin analysis exists", () => {
    const analyses = [
      analysis("W2", "2024-03-05", { a_nmin_cc: 50 }),
      analysis("W1", "2024-03-01", { a_p_al: 40, a_som_loi: 4 }),
      analysis("E1", "2024-03-01", { a_p_al: 20, a_som_loi: 2 }),
    ]
    expect(aggregate("a_p_al", analyses)?.value).toBeCloseTo(30)
    expect(aggregate("a_som_loi", analyses)?.value).toBeCloseTo(3)
    const nmin = aggregate("a_nmin_cc", analyses)
    expect(nmin?.value).toBe(50)
    expect(nmin?.has_coverage_warning).toBe(true)
  })

  it("lets a newer zone analysis replace an older analysis of the same zone", () => {
    const analyses = [
      analysis("W2", "2024-03-20", { a_p_al: 60 }),
      analysis("E1", "2024-03-10", { a_p_al: 20 }),
      analysis("W1", "2024-03-01", { a_p_al: 40 }),
    ]
    const p = aggregate("a_p_al", analyses)
    expect(p?.sources.map((s) => s.a_id)).toEqual(["W2", "E1"])
    expect(p?.value).toBeCloseTo(40)
  })

  it("lets a newer whole-field analysis replace the zones only for the parameters it contains", () => {
    const analyses = [
      analysis("F1", "2025-03-01", { a_p_al: 25, a_k_cc: 100 }, false),
      analysis("W1", "2024-03-01", { a_p_al: 40, a_k_cc: 200, a_som_loi: 4 }),
      analysis("E1", "2024-03-01", { a_p_al: 20, a_k_cc: 300, a_som_loi: 2 }),
    ]
    expect(aggregate("a_p_al", analyses)?.value).toBe(25)
    expect(aggregate("a_k_cc", analyses)?.sources).toHaveLength(1)
    expect(aggregate("a_som_loi", analyses)?.value).toBeCloseTo(3)
    expect(aggregate("a_som_loi", analyses)?.is_aggregated).toBe(true)
  })

  it("does not let a newer whole-field Nmin-only analysis replace zone values for P, K and SOM", () => {
    const analyses = [
      analysis("F1", "2025-02-01", { a_nmin_cc: 40 }, false),
      analysis("W1", "2024-03-01", { a_p_al: 40, a_k_cc: 200, a_som_loi: 4 }),
      analysis("E1", "2024-03-01", { a_p_al: 20, a_k_cc: 300, a_som_loi: 2 }),
    ]
    expect(aggregate("a_nmin_cc", analyses)?.value).toBe(40)
    expect(aggregate("a_p_al", analyses)?.value).toBeCloseTo(30)
    expect(aggregate("a_k_cc", analyses)?.value).toBeCloseTo(250)
    expect(aggregate("a_som_loi", analyses)?.value).toBeCloseTo(3)
  })

  it("leaves another zone intact when it was sampled within one month", () => {
    const analyses = [
      analysis("W1", "2024-03-31", { a_p_al: 40 }),
      analysis("E1", "2024-02-29", { a_p_al: 20 }),
    ]
    const p = aggregate("a_p_al", analyses)
    expect(p?.sources.map((s) => s.a_id)).toEqual(["W1", "E1"])
  })

  it("does not combine zones sampled more than one month apart", () => {
    const analyses = [
      analysis("W1", "2024-03-31", { a_p_al: 40 }),
      analysis("E1", "2024-02-28", { a_p_al: 20 }),
    ]
    const p = aggregate("a_p_al", analyses)
    expect(p?.value).toBe(40)
    expect(p?.is_aggregated).toBe(false)
    expect(p?.coverage).toBe(0.5)
    expect(p?.has_coverage_warning).toBe(true)
  })

  it("ignores an older whole-field analysis when the newest analysis has a zone", () => {
    const analyses = [
      analysis("W1", "2024-03-01", { a_p_al: 40 }),
      analysis("F1", "2024-02-20", { a_p_al: 10 }, false),
      analysis("E1", "2024-02-15", { a_p_al: 20 }),
    ]
    const p = aggregate("a_p_al", analyses)
    expect(p?.sources.map((s) => s.a_id)).toEqual(["W1"])
    expect(p?.has_coverage_warning).toBe(true)
  })

  it("takes the categorical value with the largest area", () => {
    const analyses = [
      analysis("W1", "2024-03-10", { b_soiltype_agr: "dekzand" }),
      analysis("E1", "2024-03-01", { b_soiltype_agr: "zeeklei" }),
    ]
    const zoneAreas = {
      ...areas(),
      zone_area: new Map([
        ["W1", 30],
        ["E1", 70],
      ]),
    }
    expect(aggregate("b_soiltype_agr", analyses, zoneAreas)?.value).toBe("zeeklei")
  })

  it("drops an older small zone that lies within a newer zone", () => {
    const analyses = [
      analysis("W1", "2024-03-10", { a_p_al: 40 }),
      analysis("S1", "2024-03-01", { a_p_al: 99 }),
    ]
    const selected = selectContributingAnalyses("a_p_al", analyses, areas())
    expect(selected.map((a) => a.a_id)).toEqual(["W1"])
  })

  it("keeps an older larger zone that only partly lies within a newer zone", () => {
    const analyses = [
      analysis("S1", "2024-03-10", { a_p_al: 99 }),
      analysis("W1", "2024-03-01", { a_p_al: 40 }),
    ]
    const zoneAreas = areas()
    const selected = selectContributingAnalyses("a_p_al", analyses, zoneAreas)
    expect(selected.map((a) => a.a_id)).toEqual(["S1", "W1"])
    expect(hasOverlappingZones(selected, zoneAreas)).toBe(true)
  })

  it("clusters analyses with strongly overlapping zones", () => {
    const analyses = [
      analysis("W2", "2024-03-10", {}),
      analysis("E1", "2024-03-05", {}),
      analysis("F1", "2024-01-01", {}, false),
      analysis("W1", "2023-03-01", {}),
    ]
    const zones = clusterZones(analyses, areas())
    expect(zones.map((z) => z.map((a) => a.a_id))).toEqual([["W2", "W1"], ["E1"], ["F1"]])
  })
})
