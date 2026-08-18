import { describe, expect, it } from "vitest"
import { calculateGrazingMetrics } from "./calculate-grazing-metrics"
import type { GrazingMetricsInput } from "./types"

describe("calculateGrazingMetrics", () => {
  it("should calculate distinct weidedagen and prevent double counting across fields on the same day", () => {
    const input: GrazingMetricsInput = {
      year: 2026,
      today: new Date("2026-06-01T23:59:59.999Z"),
      herds: [
        { l_id_herd: "herd-1", l_herd_name: "Melkkoeien", l_id_category: "rvo_100", l_lsu: 1.0, count: 80 },
      ],
      fields: [
        { b_id: "f1", b_name: "De Hoek", b_area: 4.0, isGrassland: true },
        { b_id: "f2", b_name: "Achter Huis", b_area: 3.5, isGrassland: true },
        { b_id: "f3", b_name: "Bij de Weg", b_area: 2.5, isGrassland: true },
      ],
      grazings: [
        // On 2026-05-10, herd-1 grazed on f1, f2, and f3 concurrently (e.g. block grazing)
        {
          l_id_grazing: "g1",
          l_id_herd: "herd-1",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-10T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-10T23:59:59.999Z"),
          l_grazing_hours: 8,
        },
        {
          l_id_grazing: "g2",
          l_id_herd: "herd-1",
          b_id: "f2",
          l_grazing_start: new Date("2026-05-10T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-10T23:59:59.999Z"),
          l_grazing_hours: 6,
        },
        {
          l_id_grazing: "g3",
          l_id_herd: "herd-1",
          b_id: "f3",
          l_grazing_start: new Date("2026-05-10T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-10T23:59:59.999Z"),
          l_grazing_hours: 4,
        },
        // Another 3 days
        {
          l_id_grazing: "g4",
          l_id_herd: "herd-1",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-11T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-13T23:59:59.999Z"),
          l_grazing_hours: 8,
        },
      ],
    }

    const result = calculateGrazingMetrics(input)
    // 2026-05-10 counts as 1 distinct day + 11, 12, 13 = 4 total days
    expect(result.weidedagen.total).toBe(4)
    expect(result.weidedagen.perHerd["herd-1"].total).toBe(4)

    // Hours on May 10 should be max(8, 6, 4) = 8.
    // Days 11, 12, 13 are 8 hours each -> Total 32 hours, avg 8.0
    expect(result.weideUren.totalHours).toBe(32)
    expect(result.weideUren.averageHoursPerDay).toBe(8.0)
  })

  it("should pool all rvo_100 herds together for Weidemelk 120x6 compliance", () => {
    const input: GrazingMetricsInput = {
      year: 2026,
      today: new Date("2026-10-01T23:59:59.999Z"),
      herds: [
        { l_id_herd: "herd-group-a", l_herd_name: "Melkkoeien A", l_id_category: "rvo_100", l_lsu: 1.0, count: 50 },
        { l_id_herd: "herd-group-b", l_herd_name: "Melkkoeien B", l_id_category: "rvo_100", l_lsu: 1.0, count: 40 },
        { l_id_herd: "herd-jongvee", l_herd_name: "Jongvee", l_id_category: "rvo_101", l_lsu: 0.23, count: 20 },
      ],
      fields: [{ b_id: "f1", b_name: "Weide", b_area: 10.0, isGrassland: true }],
      grazings: [
        // 5 days with group A >= 6 hours
        {
          l_id_grazing: "ga",
          l_id_herd: "herd-group-a",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-01T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-05T23:59:59.999Z"),
          l_grazing_hours: 8,
        },
        // 5 distinct days with group B >= 6 hours
        {
          l_id_grazing: "gb",
          l_id_herd: "herd-group-b",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-06T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-10T23:59:59.999Z"),
          l_grazing_hours: 7,
        },
        // 2 days with group A < 6 hours (does NOT qualify for Weidemelk)
        {
          l_id_grazing: "ga-short",
          l_id_herd: "herd-group-a",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-11T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-12T23:59:59.999Z"),
          l_grazing_hours: 4,
        },
        // Jongvee grazing (category rvo_101) - should not count towards Weidemelk
        {
          l_id_grazing: "gj",
          l_id_herd: "herd-jongvee",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-15T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-20T23:59:59.999Z"),
          l_grazing_hours: 10,
        },
      ],
    }

    const result = calculateGrazingMetrics(input)
    // 5 days (May 1-5) + 5 days (May 6-10) = 10 qualifying days
    expect(result.weidemelk.qualifyingDays).toBe(10)
    expect(result.weidemelk.isMet).toBe(false)
    expect(result.weidemelk.marginDays).toBe(-110)
  })

  it("should separate realised and future planned periods without adding planned to realised", () => {
    const today = new Date("2026-05-15T12:00:00.000Z")
    const input: GrazingMetricsInput = {
      year: 2026,
      today,
      herds: [{ l_id_herd: "h1", l_herd_name: "Melkkoeien", l_id_category: "rvo_100", count: 60 }],
      fields: [{ b_id: "f1", b_name: "Field 1", b_area: 5.0, isGrassland: true }],
      grazings: [
        // Past / realised: May 1 to May 5 (5 days)
        {
          l_id_grazing: "g-past",
          l_id_herd: "h1",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-01T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-05T23:59:59.999Z"),
          l_grazing_hours: 8,
        },
        // Future / planned: June 1 to June 10 (10 days)
        {
          l_id_grazing: "g-future",
          l_id_herd: "h1",
          b_id: "f1",
          l_grazing_start: new Date("2026-06-01T00:00:00.000Z"),
          l_grazing_end: new Date("2026-06-10T23:59:59.999Z"),
          l_grazing_hours: 8,
        },
      ],
    }

    const result = calculateGrazingMetrics(input)
    expect(result.weidedagen.total).toBe(5)
    expect(result.weidedagen.planned).toBe(10)
    expect(result.weidemelk.qualifyingDays).toBe(5)
    expect(result.weidemelk.plannedQualifyingDays).toBe(10)
  })

  it("should calculate beweidingsplatform, veebezetting and identify overgrazing (<14 rest days)", () => {
    const input: GrazingMetricsInput = {
      year: 2026,
      today: new Date("2026-07-01T00:00:00.000Z"),
      herds: [
        { l_id_herd: "h1", l_herd_name: "Melkkoeien", l_id_category: "rvo_100", l_lsu: 1.0, count: 96 },
      ],
      fields: [
        { b_id: "f1", b_name: "De Hoek", b_area: 4.2, isGrassland: true },
        { b_id: "f2", b_name: "Achter Huis", b_area: 3.8, isGrassland: true },
        { b_id: "f3", b_name: "Akker Maïs", b_area: 5.0, isGrassland: false },
      ],
      grazings: [
        // First grazing on f1: May 1 - May 4
        {
          l_id_grazing: "g1",
          l_id_herd: "h1",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-01T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-04T23:59:59.999Z"),
          l_grazing_hours: 8,
          l_grazing_type: "full",
        },
        // Second grazing on f1: May 12 - May 15 (7 days rest after May 4 -> overgrazing alert!)
        {
          l_id_grazing: "g2",
          l_id_herd: "h1",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-12T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-15T23:59:59.999Z"),
          l_grazing_hours: 8,
          l_grazing_type: "full",
        },
        // Grazing on f2 with partial area
        {
          l_id_grazing: "g3",
          l_id_herd: "h1",
          b_id: "f2",
          l_grazing_start: new Date("2026-05-20T00:00:00.000Z"),
          l_grazing_end: new Date("2026-05-24T23:59:59.999Z"),
          l_grazing_hours: 8,
          l_grazing_type: "partial",
          l_grazing_area: 2.0,
        },
      ],
      harvests: [
        // Mowing on f1 on June 5 (21 days after May 15 -> compliant rest)
        {
          b_id: "f1",
          b_harvest_date: new Date("2026-06-05T10:00:00.000Z"),
        },
      ],
    }

    const result = calculateGrazingMetrics(input)

    // Platform: f1 full (4.2 ha) + f2 partial (2.0 ha) = 6.2 ha
    expect(result.beweidingsplatform.areaHa).toBe(6.2)
    expect(result.beweidingsplatform.fieldCount).toBe(2)

    // Stocking density: 96 GVE / 6.2 ha = 15.5 GVE/ha (intensief)
    expect(result.veebezetting.totalGve).toBe(96.0)
    expect(result.veebezetting.platformGvePerHa).toBe(15.5)
    expect(result.veebezetting.platformStockingCategory).toBe("intensief")

    // Overgrazing alerts: f1 had rest from May 4 to May 12 = 7 days (< 14)
    expect(result.overbeweidingAlerts.length).toBe(1)
    expect(result.overbeweidingAlerts[0].b_id).toBe("f1")
    expect(result.overbeweidingAlerts[0].restDays).toBe(7)
  })

  it("should identify incomplete records where grazing hours are missing", () => {
    const input: GrazingMetricsInput = {
      year: 2026,
      today: new Date("2026-06-01T00:00:00.000Z"),
      herds: [{ l_id_herd: "h1", l_herd_name: "Melkkoeien", count: 50 }],
      fields: [{ b_id: "f1", b_name: "Field 1", b_area: 4.0, isGrassland: true }],
      grazings: [
        {
          l_id_grazing: "g-complete",
          l_id_herd: "h1",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-01T00:00:00.000Z"),
          l_grazing_hours: 8,
        },
        {
          l_id_grazing: "g-missing-hours",
          l_id_herd: "h1",
          b_id: "f1",
          l_grazing_start: new Date("2026-05-05T00:00:00.000Z"),
          l_grazing_hours: null,
        },
      ],
    }

    const result = calculateGrazingMetrics(input)
    expect(result.incompleteRecords.count).toBe(1)
    expect(result.incompleteRecords.grazingIds).toContain("g-missing-hours")
  })
})
