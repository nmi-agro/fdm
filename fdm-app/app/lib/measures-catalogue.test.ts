import type { MeasureCatalogue } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import type { FieldMeasureEntry } from "./farm-measures"
import {
  buildCatalogueRows,
  type CatalogueFilters,
  countRecommendedFieldsByIndicator,
  countStatusesByMeasure,
  filterCatalogueRows,
  formatMeasurePeriod,
  getAddMeasurePath,
  getMeasureCataloguePath,
  getMeasureCode,
  getMeasureRelations,
  getMeasuresCataloguePath,
  isStatusUnavailable,
  readSearchParam,
  type StatusCounts,
} from "./measures-catalogue"

/** A synthetic catalogue measure. */
function measure(m_id: string, overrides: Partial<MeasureCatalogue> = {}): MeasureCatalogue {
  return {
    m_id,
    m_source: "bln",
    m_name: m_id,
    m_description: null,
    m_summary: null,
    m_source_url: null,
    m_conflicts: null,
    m_status: "active",
    ...overrides,
  }
}

const NO_FILTERS: CatalogueFilters = {
  query: "",
  sortMode: "name",
  status: "all",
  effectType: "all",
  costLevel: "all",
  theme: "all",
}

function counts(partial: Partial<StatusCounts>): StatusCounts {
  return { applied: 0, recommended: 0, applicable: 0, ...partial }
}

describe("measures catalogue paths", () => {
  it("builds the catalogue and detail paths", () => {
    expect(getMeasuresCataloguePath("farm1", "2026")).toBe("/farm/farm1/2026/measures/catalogue")
    expect(getMeasureCataloguePath("farm1", "2026", "bln_BM7")).toBe(
      "/farm/farm1/2026/measures/catalogue/bln_BM7",
    )
  })

  it("opens the add dialog on a measure without fields", () => {
    expect(getAddMeasurePath("farm1", "2026", "bln_BM7")).toBe(
      "/farm/farm1/2026/measures?openMeasure=bln_BM7",
    )
  })

  it("preselects fields in the add dialog", () => {
    const path = getAddMeasurePath("farm1", "2026", "bln_BM7", ["f1", "f2"])
    const params = new URL(path, "https://example.org").searchParams
    expect(params.get("openMeasure")).toBe("bln_BM7")
    expect(params.get("fields")).toBe("f1,f2")
  })
})

describe("getMeasureCode", () => {
  it("removes the source prefix", () => {
    expect(getMeasureCode("bln_BM7")).toBe("BM7")
    expect(getMeasureCode("other_X1")).toBe("other_X1")
  })
})

describe("readSearchParam", () => {
  const params = new URLSearchParams("sorteer=code&status=unknown")

  it("returns an allowed value", () => {
    expect(readSearchParam(params, "sorteer", ["name", "code"], "name")).toBe("code")
  })

  it("falls back for an unknown or missing value", () => {
    expect(readSearchParam(params, "status", ["all", "applied"], "all")).toBe("all")
    expect(readSearchParam(params, "thema", ["all"], "all")).toBe("all")
  })
})

describe("isStatusUnavailable", () => {
  const availability = { recommendationsAvailable: false, applicabilityAvailable: true }

  it("is unavailable when the request for that status failed", () => {
    expect(isStatusUnavailable("recommended", availability)).toBe(true)
    expect(isStatusUnavailable("applicable", availability)).toBe(false)
    expect(
      isStatusUnavailable("applicable", { ...availability, applicabilityAvailable: false }),
    ).toBe(true)
  })

  it("is always available for applied measures", () => {
    expect(
      isStatusUnavailable("applied", {
        recommendationsAvailable: false,
        applicabilityAvailable: false,
      }),
    ).toBe(false)
  })
})

describe("countStatusesByMeasure", () => {
  it("counts the fields per status for each measure", () => {
    const fieldsByMeasure = new Map<string, FieldMeasureEntry[]>([
      [
        "bln_BM1",
        [
          { b_id: "f1", b_name: "A", status: "applied" },
          { b_id: "f2", b_name: "B", status: "recommended" },
          { b_id: "f3", b_name: "C", status: "recommended" },
        ],
      ],
      ["bln_BM2", [{ b_id: "f1", b_name: "A", status: "applicable" }]],
    ])

    expect(countStatusesByMeasure(fieldsByMeasure)).toEqual({
      bln_BM1: counts({ applied: 1, recommended: 2 }),
      bln_BM2: counts({ applicable: 1 }),
    })
  })
})

describe("buildCatalogueRows", () => {
  it("adds the code and the ecosystem services of the affected indicators", () => {
    const [row] = buildCatalogueRows([
      measure("bln_BM1", { m_impacts_score: ["S_NUT_N", "S_NUT_P", "S_CR_CSEQ", "S_UNKNOWN"] }),
    ])

    expect(row.code).toBe("BM1")
    expect(row.ecosysteemdiensten).toEqual(["Klimaat", "Nutriëntenkringloop"])
  })
})

describe("filterCatalogueRows", () => {
  const rows = buildCatalogueRows([
    measure("bln_BM10", {
      m_name: "Vanggewas telen",
      m_summary: "Een groenbemester na de hoofdteelt",
      m_effect_type: "qual",
      m_effect_costs: 0,
      m_impacts_score: ["S_NUT_N"],
    }),
    measure("bln_BM2", {
      m_name: "Compost toedienen",
      m_effect_type: "classed",
      m_effect_costs: 1,
      m_impacts_score: ["S_CR_CSEQ"],
    }),
    measure("bln_BM9", {
      m_name: "Bufferstrook aanleggen",
      m_effect_type: "classed",
      m_effect_costs: 2,
    }),
    measure("bln_BM3", { m_name: "Oude maatregel", m_status: "inactive" }),
  ])
  const countsByMeasure = {
    bln_BM10: counts({ recommended: 1, applicable: 3 }),
    bln_BM2: counts({ recommended: 1, applicable: 5 }),
    bln_BM9: counts({ applied: 2 }),
  }
  const ids = (result: { m_id: string }[]) => result.map((row) => row.m_id)

  it("sorts by name and hides inactive measures that are not applied", () => {
    expect(ids(filterCatalogueRows(rows, NO_FILTERS, undefined))).toEqual([
      "bln_BM9",
      "bln_BM2",
      "bln_BM10",
    ])
  })

  it("shows an inactive measure that the farm still applies", () => {
    const result = filterCatalogueRows(rows, NO_FILTERS, {
      ...countsByMeasure,
      bln_BM3: counts({ applied: 1 }),
    })
    expect(ids(result)).toContain("bln_BM3")
  })

  it("sorts by code numerically", () => {
    expect(ids(filterCatalogueRows(rows, { ...NO_FILTERS, sortMode: "code" }, undefined))).toEqual([
      "bln_BM2",
      "bln_BM9",
      "bln_BM10",
    ])
  })

  it("sorts by recommendations, then applicability, once the counts are loaded", () => {
    const filters: CatalogueFilters = { ...NO_FILTERS, sortMode: "recommended" }
    expect(ids(filterCatalogueRows(rows, filters, countsByMeasure))).toEqual([
      "bln_BM2",
      "bln_BM10",
      "bln_BM9",
    ])
    // Without counts the list stays alphabetical
    expect(ids(filterCatalogueRows(rows, filters, undefined))).toEqual([
      "bln_BM9",
      "bln_BM2",
      "bln_BM10",
    ])
  })

  it("filters by status only once the counts are loaded", () => {
    const filters: CatalogueFilters = { ...NO_FILTERS, status: "applied" }
    expect(ids(filterCatalogueRows(rows, filters, countsByMeasure))).toEqual(["bln_BM9"])
    expect(filterCatalogueRows(rows, filters, undefined)).toHaveLength(3)
  })

  it("filters by effect type, cost level and ecosystem service", () => {
    expect(
      ids(filterCatalogueRows(rows, { ...NO_FILTERS, effectType: "classed" }, undefined)),
    ).toEqual(["bln_BM9", "bln_BM2"])
    expect(ids(filterCatalogueRows(rows, { ...NO_FILTERS, costLevel: "0" }, undefined))).toEqual([
      "bln_BM10",
    ])
    expect(ids(filterCatalogueRows(rows, { ...NO_FILTERS, theme: "Klimaat" }, undefined))).toEqual([
      "bln_BM2",
    ])
  })

  it("searches name, code and summary, and keeps the sort order", () => {
    expect(ids(filterCatalogueRows(rows, { ...NO_FILTERS, query: "compost" }, undefined))).toEqual([
      "bln_BM2",
    ])
    expect(ids(filterCatalogueRows(rows, { ...NO_FILTERS, query: "BM10" }, undefined))).toEqual([
      "bln_BM10",
    ])
    expect(
      ids(filterCatalogueRows(rows, { ...NO_FILTERS, query: "groenbemester" }, undefined)),
    ).toEqual(["bln_BM10"])
    expect(filterCatalogueRows(rows, { ...NO_FILTERS, query: "   " }, undefined)).toHaveLength(3)
    expect(filterCatalogueRows(rows, { ...NO_FILTERS, query: "xyzxyz" }, undefined)).toEqual([])
  })
})

describe("getMeasureRelations", () => {
  const catalogue = [
    measure("bln_BM56b", { m_conflicts: ["bln_BM1", "bln_BM2", "bln_BM99"] }),
    measure("bln_BM56c", { m_name: "Variant c" }),
    measure("bln_BM56a", { m_name: "Variant a", m_status: "inactive" }),
    measure("bln_BM1", { m_name: "Actief" }),
    measure("bln_BM2", { m_name: "Vervallen", m_status: "inactive" }),
  ]

  it("lists active conflicts and the other variants of the family", () => {
    expect(getMeasureRelations(catalogue[0], catalogue)).toEqual({
      conflicts: [{ m_id: "bln_BM1", m_name: "Actief", inactive: false }],
      variants: [
        { m_id: "bln_BM56a", m_name: "Variant a", inactive: true },
        { m_id: "bln_BM56c", m_name: "Variant c", inactive: false },
      ],
    })
  })

  it("returns nothing for a measure without conflicts or variants", () => {
    expect(getMeasureRelations(catalogue[3], catalogue)).toEqual({ conflicts: [], variants: [] })
  })
})

describe("formatMeasurePeriod", () => {
  it("formats a closed period, an ongoing period and an unknown start", () => {
    expect(formatMeasurePeriod(new Date(2026, 2, 1), new Date(2026, 9, 31))).toBe(
      "1-3-2026 – 31-10-2026",
    )
    expect(formatMeasurePeriod("2026-03-01T12:00:00", null)).toBe("1-3-2026 – doorlopend")
    expect(formatMeasurePeriod(undefined, undefined)).toBe("? – doorlopend")
  })
})

describe("countRecommendedFieldsByIndicator", () => {
  it("counts the recommended fields per improved indicator", () => {
    const result = countRecommendedFieldsByIndicator([
      { b_id: "f1", b_name: "A", status: "recommended", indicatorIds: ["NUT_N", "CR_CSEQ"] },
      { b_id: "f2", b_name: "B", status: "recommended", indicatorIds: ["NUT_N"] },
      { b_id: "f3", b_name: "C", status: "recommended" },
      { b_id: "f4", b_name: "D", status: "applied", indicatorIds: ["NUT_N"] },
    ])

    expect(Object.fromEntries(result)).toEqual({ NUT_N: 2, CR_CSEQ: 1 })
  })
})
