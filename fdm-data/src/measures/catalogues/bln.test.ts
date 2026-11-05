import { afterEach, describe, expect, it, vi } from "vitest"
import { getCatalogueBln } from "./bln"

// Synthetic measure in the shape of the NMI API response
const apiMeasure = {
  m_id: "BM9",
  m_source: "BBWP",
  m_name: "Testmaatregel",
  m_summary: "Korte samenvatting",
  m_description: "Lange beschrijving",
  m_source_url: "https://example.com/BM9",
  m_id_bln: "BM9",
  m_id_bbwp: "B121",
  m_id_ecoregeling24: "3a",
  m_effect_costs: 1,
  m_impacts_score: ["S_GW_NLEA", "S_NUT_N"],
  m_applicability: [
    { variable: "M_STAGE_APPLICABILITY", values: ["field"] },
    { variable: "B_LU_BBWP", values: ["gras_permanent"] },
  ],
  m_conflicts: ["BM2", "BM10"],
  m_effect_type: "classed",
  m_effect_size: [
    {
      comment: "Base effects",
      conditions: [],
      impacts: [{ key: "S_GW_NLEA", value: 0.9 }],
    },
    {
      comment: "Low P",
      conditions: [{ variable: "A_P_AL", max: 18 }],
      impacts: [{ key: "S_NUT_N", value: 0.05 }],
    },
  ],
}

function mockApi(measures: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { measures } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  )
}

describe("getCatalogueBln", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("should map all fields of the API to the catalogue item", async () => {
    mockApi([apiMeasure])
    const [item] = await getCatalogueBln("test-key")

    expect(item.m_id).toBe("bln_BM9")
    expect(item.m_source).toBe("bln")
    expect(item.m_origin).toBe("BBWP")
    expect(item.m_conflicts).toEqual(["bln_BM2", "bln_BM10"])
    expect(item.m_stage_applicability).toBe("field")
    expect(item.m_effect_costs).toBe(1)
    expect(item.m_effect_type).toBe("classed")
    expect(item.m_impacts_score).toEqual(["S_GW_NLEA", "S_NUT_N"])
    expect(item.m_applicability).toEqual(apiMeasure.m_applicability)
    expect(item.m_effect_size).toEqual(apiMeasure.m_effect_size)
    expect(item.m_external_ids).toEqual({ bbwp: "B121", ecoregeling24: "3a" })
  })

  it("should use null for missing or invalid optional fields", async () => {
    mockApi([{ m_id: "BM1", m_name: "Minimaal", m_effect_costs: "hoog", m_id_bbwp: null }])
    const [item] = await getCatalogueBln("test-key")

    expect(item.m_effect_costs).toBeNull()
    expect(item.m_effect_type).toBeNull()
    expect(item.m_impacts_score).toBeNull()
    expect(item.m_applicability).toBeNull()
    expect(item.m_effect_size).toBeNull()
    expect(item.m_origin).toBeNull()
    expect(item.m_external_ids).toBeNull()
    expect(item.m_conflicts).toBeNull()
    expect(item.m_stage_applicability).toBeNull()
  })

  it("should skip measures without an ID or name", async () => {
    mockApi([apiMeasure, { m_id: "", m_name: "Zonder ID" }, { m_id: "BM3", m_name: " " }])
    const items = await getCatalogueBln("test-key")
    expect(items.map((item) => item.m_id)).toEqual(["bln_BM9"])
  })
})
