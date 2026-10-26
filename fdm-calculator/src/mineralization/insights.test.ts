import { describe, expect, it } from "vitest"
import type { MineralizationEvent } from "./prepare"
import type { DynaV2DailyPoint, DynaV2Result } from "./types"
import type { WeatherForecast } from "./weather"
import { deriveMineralizationInsights, determineSeasonPhase } from "./insights"

const TODAY = new Date("2026-06-01T10:00:00Z")

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Builds a daily series from `start` for `days` days with the given functions of the day index.
 */
function series(
  start: string,
  days: number,
  fn: (i: number) => { b_nw: number; b_n_uptake: number; b_no3_leach?: number },
): DynaV2DailyPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const v = fn(i)
    return {
      b_date_calculation: addDays(start, i),
      b_nw: v.b_nw,
      b_n_uptake: v.b_n_uptake,
      b_no3_leach: v.b_no3_leach ?? 0,
      b_n_available: v.b_nw - v.b_n_uptake,
    }
  })
}

const balance = {
  b_nw: 0,
  b_n_uptake: 0,
  b_n_fertilizer_mineral: 0,
  b_n_fertilizer_organic: 0,
  b_n_fertilizer_preceeding: 0,
  b_n_greenmanure: 0,
}

function result(points: DynaV2DailyPoint[]): DynaV2Result {
  return { series: points, balance }
}

const base = {
  events: [] as MineralizationEvent[],
  forecast: null as WeatherForecast | null,
  year: 2026,
  today: TODAY,
  mainStart: "2026-04-01",
  mainHarvest: "2026-09-01",
}

describe("determineSeasonPhase", () => {
  const args = { today: TODAY, mainStart: "2026-04-01", mainHarvest: "2026-09-01" }

  it("returns evaluation for past years and planning for future years", () => {
    expect(determineSeasonPhase({ ...args, year: 2025 })).toBe("evaluation")
    expect(determineSeasonPhase({ ...args, year: 2027 })).toBe("planning")
  })

  it("returns planning before the main crop starts", () => {
    expect(determineSeasonPhase({ ...args, year: 2026, mainStart: "2026-07-01" })).toBe("planning")
  })

  it("returns growing between start and harvest", () => {
    expect(determineSeasonPhase({ ...args, year: 2026 })).toBe("growing")
  })

  it("returns evaluation after the harvest", () => {
    expect(determineSeasonPhase({ ...args, year: 2026, mainHarvest: "2026-05-01" })).toBe(
      "evaluation",
    )
  })
})

describe("deriveMineralizationInsights", () => {
  it("signals an expected N shortage while the crop is still taking up nitrogen", () => {
    // Available N (162 - 2i) is 40 on 1 June (day 61) and drops by 2 kg/day; uptake keeps rising
    const points = series("2026-04-01", 150, (i) => ({ b_nw: 162 + i, b_n_uptake: 3 * i }))
    const insights = deriveMineralizationInsights({ ...base, result: result(points) })
    const shortage = insights.signals.find((s) => s.type === "n_shortage")
    expect(shortage).toBeDefined()
    if (shortage?.type === "n_shortage") {
      expect(shortage.date >= "2026-06-01").toBe(true)
      expect(shortage.date <= "2026-06-15").toBe(true)
      expect(shortage.availableN).toBeLessThan(20)
    }
  })

  it("does not signal a shortage when uptake has stopped", () => {
    const points = series("2026-04-01", 150, () => ({ b_nw: 100, b_n_uptake: 95 }))
    const insights = deriveMineralizationInsights({ ...base, result: result(points) })
    expect(insights.signals.some((s) => s.type === "n_shortage")).toBe(false)
  })

  it("signals high leaching", () => {
    const points = series("2026-04-01", 150, (i) => ({
      b_nw: 200,
      b_n_uptake: 50,
      b_no3_leach: i === 149 ? 35 : 0,
    }))
    const insights = deriveMineralizationInsights({ ...base, result: result(points) })
    expect(insights.signals).toContainEqual({ type: "high_leaching", leachingKgHa: 35 })
  })

  it("signals residual nitrogen at harvest", () => {
    const points = series("2026-04-01", 180, () => ({ b_nw: 200, b_n_uptake: 140 }))
    const insights = deriveMineralizationInsights({ ...base, result: result(points) })
    expect(insights.signals).toContainEqual({
      type: "residual_n",
      date: "2026-09-01",
      availableN: 60,
    })
    expect(insights.improvementPoints).toContain(
      "Na de oogst bleef 60 kg N/ha beschikbaar; een vanggewas kan uitspoeling beperken.",
    )
  })

  it("signals rain around a planned fertilizer application", () => {
    const points = series("2026-04-01", 150, () => ({ b_nw: 200, b_n_uptake: 100 }))
    const forecast: WeatherForecast = {
      notifications: [],
      days: Array.from({ length: 14 }, (_, i) => {
        const date = addDays("2026-06-01", i)
        return {
          date,
          w_temp_min_day: 10,
          w_temp_max_day: 20,
          w_temp_mean_day: 15,
          w_prec_sum_day: date === "2026-06-04" || date === "2026-06-06" ? 6 : 0,
          w_et_ref_day: 2,
          w_icon: 1,
        }
      }),
    }
    const events: MineralizationEvent[] = [
      { date: "2026-06-05", type: "fertilizer", label: "KAS", planned: true, p_app_id: "app_1" },
      { date: "2026-06-05", type: "fertilizer", label: "KAS", planned: false, p_app_id: "app_0" },
    ]
    const insights = deriveMineralizationInsights({
      ...base,
      result: result(points),
      forecast,
      events,
    })
    expect(insights.signals.filter((s) => s.type === "rain_near_event")).toEqual([
      {
        type: "rain_near_event",
        eventDate: "2026-06-05",
        eventType: "fertilizer",
        rainMm: 12,
        p_app_id: "app_1",
      },
    ])
  })

  it("names the cultivation of a harvest with rain around it", () => {
    const points = series("2026-04-01", 150, () => ({ b_nw: 200, b_n_uptake: 100 }))
    const forecast: WeatherForecast = {
      notifications: [],
      days: Array.from({ length: 14 }, (_, i) => ({
        date: addDays("2026-06-01", i),
        w_temp_min_day: 10,
        w_temp_max_day: 20,
        w_temp_mean_day: 15,
        w_prec_sum_day: 6,
        w_et_ref_day: 2,
        w_icon: 1,
      })),
    }
    const insights = deriveMineralizationInsights({
      ...base,
      result: result(points),
      forecast,
      events: [
        { date: "2026-06-05", type: "harvest", label: "Gras", planned: true, b_lu: "lu_grass" },
      ],
    })
    expect(insights.signals.find((s) => s.type === "rain_near_event")).toMatchObject({
      eventType: "harvest",
      b_lu: "lu_grass",
    })
  })

  it("computes KPIs", () => {
    const points = series("2026-04-01", 184, (i) => ({
      b_nw: 100 + i,
      b_n_uptake: i,
      b_no3_leach: i / 10,
    }))
    const insights = deriveMineralizationInsights({ ...base, result: result(points) })
    // 1 June is day 61, 1 October is day 183
    expect(insights.kpis.availableNNow).toBe(100)
    expect(insights.kpis.uptakeToDate).toBe(61)
    expect(insights.kpis.totalUptake).toBe(183)
    expect(insights.kpis.totalLeaching).toBeCloseTo(18.3)
    expect(insights.kpis.residualNAtHarvest).toBe(100)
    expect(insights.kpis.nUseEfficiency).toBe(0.65)
    expect(insights.defaultPhase).toBe("growing")
  })

  it("has no current values outside the selected year", () => {
    const points = series("2027-04-01", 100, (i) => ({ b_nw: 100 + i, b_n_uptake: i }))
    const insights = deriveMineralizationInsights({
      ...base,
      year: 2027,
      mainStart: "2027-04-01",
      mainHarvest: "2027-07-01",
      result: result(points),
    })
    expect(insights.kpis.availableNNow).toBeNull()
    expect(insights.kpis.uptakeToDate).toBe(0)
  })

  it("returns no efficiency when no nitrogen became available", () => {
    const points = series("2026-04-01", 10, () => ({ b_nw: 0, b_n_uptake: 0 }))
    const insights = deriveMineralizationInsights({ ...base, result: result(points) })
    expect(insights.kpis.nUseEfficiency).toBeNull()
  })

  it("points out applications in periods with little uptake", () => {
    const points = series("2026-03-01", 200, (i) => ({
      b_nw: 200 + i,
      b_n_uptake: i < 40 ? 0 : (i - 40) * 2,
    }))
    const events: MineralizationEvent[] = [
      { date: "2026-03-05", type: "fertilizer", label: "Drijfmest", planned: false },
      { date: "2026-05-01", type: "fertilizer", label: "KAS", planned: false },
    ]
    const insights = deriveMineralizationInsights({ ...base, result: result(points), events })
    expect(insights.improvementPoints).toContain(
      "De gift van 5 maart viel in een periode met weinig opname.",
    )
    expect(insights.improvementPoints).not.toContain(
      "De gift van 1 mei viel in een periode met weinig opname.",
    )
  })
})
