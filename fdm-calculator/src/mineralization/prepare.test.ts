import { describe, expect, it } from "vitest"
import {
  type MineralizationApplication,
  type MineralizationCultivation,
  type MineralizationFertilizer,
  type MineralizationFieldData,
  type MineralizationHarvest,
  mapApplicationMethod,
  prepareMineralizationInput,
  restrictToMainCultivation,
} from "./prepare"

const YEAR = 2026
const TODAY = new Date("2026-06-01T10:00:00Z")

/** Midnight in Europe/Amsterdam during summer time (UTC+2). */
function summerDate(date: string): Date {
  return new Date(`${date}T00:00:00+02:00`)
}

/** Midnight in Europe/Amsterdam during winter time (UTC+1). */
function winterDate(date: string): Date {
  return new Date(`${date}T00:00:00+01:00`)
}

function cultivation(overrides: Partial<MineralizationCultivation>): MineralizationCultivation {
  return {
    b_lu: "lu_main",
    b_lu_catalogue: "nl_2014",
    b_lu_name: "Aardappelen",
    b_lu_croprotation: "potato",
    b_lu_harvestable: "once",
    b_lu_start: summerDate("2026-04-15"),
    b_lu_end: null,
    m_cropresidue: null,
    ...overrides,
  }
}

function harvest(id: string, date: Date, yieldKg?: number): MineralizationHarvest {
  return {
    b_id_harvesting: id,
    b_lu_harvest_date: date,
    harvestable: {
      harvestable_analyses: [{ b_lu_yield: yieldKg ?? null, b_lu_n_harvestable: null }],
    },
  }
}

const mineralFertilizer: MineralizationFertilizer = {
  p_id: "fert_kas",
  p_type: "mineral",
  p_n_rt: 270,
  p_n_if: 270,
  p_n_of: 0,
  p_om: null,
  p_no3_rt: null,
  p_nh4_rt: null,
  p_s_rt: null,
}

const slurry: MineralizationFertilizer = {
  p_id: "fert_slurry",
  p_type: "manure",
  p_n_rt: 4.5,
  p_n_if: 2.5,
  p_n_of: 2,
  p_om: 70,
  p_no3_rt: null,
  p_nh4_rt: null,
  p_s_rt: null,
}

function fieldData(overrides: Partial<MineralizationFieldData> = {}): MineralizationFieldData {
  return {
    field: { b_id: "field_1", b_name: "Perceel 1", b_centroid: [5.6, 52.0], b_bufferstrip: false },
    soil: [
      {
        parameter: "a_som_loi",
        value: 3.1,
        a_source: "lab_a",
        b_sampling_date: winterDate("2026-02-01"),
      },
      {
        parameter: "a_clay_mi",
        value: 6,
        a_source: "lab_a",
        b_sampling_date: winterDate("2026-02-01"),
      },
      {
        parameter: "a_p_al",
        value: 40,
        a_source: "lab_a",
        b_sampling_date: winterDate("2026-02-01"),
      },
    ],
    cultivations: [cultivation({})],
    harvests: new Map([["lu_main", [harvest("h1", summerDate("2026-09-20"), 45000)]]]),
    applications: [],
    fertilizers: new Map([
      [mineralFertilizer.p_id, mineralFertilizer],
      [slurry.p_id, slurry],
    ]),
    ...overrides,
  }
}

describe("prepareMineralizationInput", () => {
  it("excludes buffer strips", () => {
    const data = fieldData({
      field: { b_id: "f", b_name: null, b_centroid: [5.6, 52], b_bufferstrip: true },
    })
    expect(prepareMineralizationInput(data, YEAR, TODAY)).toEqual({
      status: "excluded",
      reason: "bufferstrip",
    })
  })

  it("excludes fields whose main cultivation is a landscape element", () => {
    const data = fieldData({
      cultivations: [
        cultivation({
          b_lu_catalogue: "nl_2638",
          b_lu_croprotation: "nature",
          b_lu_harvestable: "none",
          b_lu_start: winterDate("2020-01-01"),
        }),
      ],
    })
    expect(prepareMineralizationInput(data, YEAR, TODAY)).toEqual({
      status: "excluded",
      reason: "landscape_element",
    })
  })

  it("returns missing_location when the field has no centroid", () => {
    const data = fieldData({
      field: { b_id: "f", b_name: null, b_centroid: null, b_bufferstrip: false },
    })
    expect(prepareMineralizationInput(data, YEAR, TODAY).status).toBe("missing_location")
  })

  it("returns no_cultivation when no cultivation overlaps the year", () => {
    const data = fieldData({
      cultivations: [
        cultivation({ b_lu_start: summerDate("2024-04-15"), b_lu_end: summerDate("2024-09-20") }),
      ],
    })
    expect(prepareMineralizationInput(data, YEAR, TODAY).status).toBe("no_cultivation")
  })

  it("returns missing_harvest when the main cultivation has no harvest in the year", () => {
    const data = fieldData({
      harvests: new Map([["lu_main", [harvest("h0", summerDate("2025-09-20"))]]]),
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    expect(result.status).toBe("missing_harvest")
    if (result.status === "missing_harvest") {
      expect(result.mainCultivation.b_lu).toBe("lu_main")
    }
  })

  it("includes catch crops sown after the main crop but not those before it", () => {
    const data = fieldData({
      cultivations: [
        cultivation({}),
        cultivation({
          b_lu: "lu_before",
          b_lu_catalogue: "nl_427",
          b_lu_name: "Groenbemester",
          b_lu_croprotation: "catchcrop",
          b_lu_start: summerDate("2025-09-25"),
          b_lu_end: winterDate("2026-03-01"),
        }),
        cultivation({
          b_lu: "lu_after",
          b_lu_catalogue: "nl_427",
          b_lu_name: "Groenbemester",
          b_lu_croprotation: "catchcrop",
          b_lu_start: summerDate("2026-09-25"),
          b_lu_end: null,
        }),
      ],
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.request.cultivations?.map((c) => c.b_lu_id)).toEqual(["lu_main", "lu_after"])
    expect(result.usedInput.cultivations.map((c) => c.role)).toEqual(["main", "after"])
  })

  it("orders the cultivations after the main crop and marks their end within the year", () => {
    const data = fieldData({
      cultivations: [
        cultivation({}),
        cultivation({
          b_lu: "lu_late",
          b_lu_catalogue: "nl_427",
          b_lu_name: "Gele mosterd",
          b_lu_croprotation: "catchcrop",
          b_lu_harvestable: "none",
          b_lu_start: summerDate("2026-10-15"),
          b_lu_end: null,
        }),
        cultivation({
          b_lu: "lu_early",
          b_lu_catalogue: "nl_427",
          b_lu_name: "Groenbemester",
          b_lu_croprotation: "catchcrop",
          b_lu_harvestable: "none",
          b_lu_start: summerDate("2026-09-25"),
          b_lu_end: winterDate("2026-11-15"),
        }),
      ],
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    if (result.status !== "ready") throw new Error("not ready")
    expect(result.request.cultivations?.map((c) => c.b_lu_id)).toEqual([
      "lu_main",
      "lu_early",
      "lu_late",
    ])
    expect(result.request.cultivations?.[1]?.b_lu_end).toBe("2026-11-15")
    expect(result.request.cultivations?.[2]?.b_lu_end).toBe("2026-12-31")
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "cultivation_end", date: "2026-11-15", b_lu: "lu_early" }),
    )
  })

  it("keeps the sowing date of winter crops and ends crops harvested once at the harvest", () => {
    const data = fieldData({
      cultivations: [
        cultivation({
          b_lu_catalogue: "nl_233",
          b_lu_name: "Wintertarwe",
          b_lu_croprotation: "cereal",
          b_lu_start: summerDate("2025-10-15"),
          b_lu_end: null,
        }),
        cultivation({
          b_lu: "lu_after",
          b_lu_catalogue: "nl_427",
          b_lu_croprotation: "catchcrop",
          b_lu_harvestable: "once",
          b_lu_start: summerDate("2026-08-20"),
          b_lu_end: winterDate("2027-03-01"),
        }),
      ],
      harvests: new Map([["lu_main", [harvest("h1", summerDate("2026-08-01"), 9000)]]]),
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.request.cultivations).toEqual([
      { b_lu: "nl_233", b_lu_id: "lu_main", b_lu_start: "2025-10-15", b_lu_end: "2026-08-01" },
      { b_lu: "nl_427", b_lu_id: "lu_after", b_lu_start: "2026-08-20", b_lu_end: "2026-12-31" },
    ])
  })

  it("starts multi-year grassland on 1 January and keeps it until the end of the year", () => {
    const data = fieldData({
      cultivations: [
        cultivation({
          b_lu: "lu_grass",
          b_lu_catalogue: "nl_265",
          b_lu_name: "Grasland",
          b_lu_croprotation: "grass",
          b_lu_harvestable: "multiple",
          b_lu_start: winterDate("2018-01-01"),
          b_lu_end: null,
        }),
      ],
      harvests: new Map([
        [
          "lu_grass",
          [
            harvest("h1", summerDate("2026-05-10"), 3500),
            harvest("h2", summerDate("2026-06-20"), 3000),
            harvest("h3", summerDate("2026-08-15")),
          ],
        ],
      ]),
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.request.cultivations?.[0]).toEqual({
      b_lu: "nl_265",
      b_lu_id: "lu_grass",
      b_lu_start: "2026-01-01",
      b_lu_end: "2026-12-31",
    })
    expect(result.request.harvests).toEqual([
      { b_lu_id: "lu_grass", b_date_harvest: "2026-05-10", b_lu_yield: 3500 },
      { b_lu_id: "lu_grass", b_date_harvest: "2026-06-20", b_lu_yield: 3000 },
      { b_lu_id: "lu_grass", b_date_harvest: "2026-08-15" },
    ])
    expect(result.usedInput.omittedHarvests).toEqual([])
  })

  it("sends at most 6 harvests per cultivation and lists the others", () => {
    const dates = [
      "2026-04-20",
      "2026-05-25",
      "2026-06-25",
      "2026-07-25",
      "2026-08-25",
      "2026-09-20",
      "2026-10-10",
      "2026-10-20",
    ]
    const data = fieldData({
      cultivations: [
        cultivation({
          b_lu: "lu_grass",
          b_lu_catalogue: "nl_265",
          b_lu_name: "Grasland",
          b_lu_croprotation: "grass",
          b_lu_harvestable: "multiple",
          b_lu_start: winterDate("2018-01-01"),
          b_lu_end: null,
        }),
      ],
      // Unsorted on purpose: the first 6 by date are sent
      harvests: new Map([
        ["lu_grass", [...dates].reverse().map((date, i) => harvest(`h${i}`, summerDate(date)))],
      ]),
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.request.harvests?.map((h) => h.b_date_harvest)).toEqual(dates.slice(0, 6))
    expect(result.usedInput.harvests.map((h) => h.date)).toEqual(dates.slice(0, 6))
    expect(result.usedInput.omittedHarvests).toEqual([
      { b_lu: "lu_grass", date: "2026-10-10" },
      { b_lu: "lu_grass", date: "2026-10-20" },
    ])
    expect(result.events.filter((e) => e.type === "harvest")).toHaveLength(6)
  })

  it("marks harvests after today as planned", () => {
    const data = fieldData({
      cultivations: [
        cultivation({
          b_lu_harvestable: "multiple",
          b_lu_croprotation: "grass",
          b_lu_catalogue: "nl_265",
        }),
      ],
      harvests: new Map([
        [
          "lu_main",
          [harvest("h1", summerDate("2026-05-01")), harvest("h2", summerDate("2026-08-15"))],
        ],
      ]),
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.usedInput.harvests.map((h) => [h.date, h.planned])).toEqual([
      ["2026-05-01", false],
      ["2026-08-15", true],
    ])
  })

  it("keeps Europe/Amsterdam calendar dates", () => {
    const data = fieldData({
      applications: [
        {
          p_app_id: "app_1",
          p_id: "fert_kas",
          p_name_nl: "KAS",
          p_app_amount: 300,
          p_app_amount_display: 300,
          p_app_amount_unit: "kg/ha",
          p_app_method: "broadcasting",
          p_app_date: new Date("2025-12-31T23:30:00Z"),
        },
      ],
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.request.fertilizer_applications?.[0].p_date_fertilization).toBe("2026-01-01")
  })

  it("sends the stored amount in kg/ha and the fertilizer composition", () => {
    const data = fieldData({
      applications: [
        {
          p_app_id: "app_1",
          p_id: "fert_slurry",
          p_name_nl: "Rundveedrijfmest",
          p_app_amount: 30000,
          p_app_amount_display: 30,
          p_app_amount_unit: "m3/ha",
          p_app_method: null,
          p_app_date: summerDate("2026-04-01"),
        },
      ],
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.request.fertilizer_applications).toEqual([
      {
        p_id: "fert_slurry",
        p_app_amount: 30000,
        p_date_fertilization: "2026-04-01",
        p_app_method: "broadcasting",
      },
    ])
    expect(result.request.fertilizer_properties).toEqual([
      { p_id: "fert_slurry", p_type_mineral: false, p_n_rt: 4.5, p_n_if: 2.5, p_n_of: 2, p_om: 70 },
    ])
    expect(result.events.find((e) => e.type === "fertilizer")).toMatchObject({
      date: "2026-04-01",
      fertilizerKind: "organic",
      amount: 30,
      unit: "m3/ha",
      planned: false,
    })
  })

  it("marks mineral fertilizers", () => {
    const data = fieldData({
      applications: [
        {
          p_app_id: "app_1",
          p_id: "fert_kas",
          p_name_nl: "KAS",
          p_app_amount: 300,
          p_app_amount_display: 300,
          p_app_amount_unit: "kg/ha",
          p_app_method: "broadcasting",
          p_app_date: summerDate("2026-06-10"),
        },
      ],
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    if (result.status !== "ready") throw new Error("not ready")
    expect(result.request.fertilizer_properties?.[0].p_type_mineral).toBe(true)
    expect(result.usedInput.fertilizerApplications[0]).toMatchObject({ kind: "mineral" })
    expect(result.events.find((e) => e.type === "fertilizer")?.planned).toBe(true)
  })

  it("skips applications with an unknown fertilizer", () => {
    const data = fieldData({
      applications: [
        {
          p_app_id: "app_unknown",
          p_id: "fert_missing",
          p_name_nl: null,
          p_app_amount: 100,
          p_app_amount_display: 100,
          p_app_amount_unit: "kg/ha",
          p_app_method: "broadcasting",
          p_app_date: summerDate("2026-04-01"),
        },
      ],
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    if (result.status !== "ready") throw new Error("not ready")
    expect(result.request.fertilizer_applications).toBeUndefined()
    expect(result.usedInput.skippedApplications).toEqual([
      { p_app_id: "app_unknown", reason: "unknown_fertilizer" },
    ])
  })

  it("only sends soil parameters that are present and lists the missing ones", () => {
    const result = prepareMineralizationInput(fieldData(), YEAR, TODAY)
    if (result.status !== "ready") throw new Error("not ready")
    expect(result.request.soil_analysis).toEqual({ a_som_loi: 3.1, a_clay_mi: 6 })
    expect(result.usedInput.soil).toEqual([
      { parameter: "a_som_loi", value: 3.1, source: "lab_a", date: "2026-02-01" },
      { parameter: "a_clay_mi", value: 6, source: "lab_a", date: "2026-02-01" },
    ])
    expect(result.usedInput.missingSoilParameters).toContain("a_silt_mi")
    expect(result.usedInput.missingSoilParameters).not.toContain("a_som_loi")
    expect(result.usedInput.location).toEqual({ a_lat: 52, a_lon: 5.6 })
  })

  it("only sends groundwater levels as a pair", () => {
    const data = fieldData({
      soil: [
        ...fieldData().soil,
        {
          // Not (yet) a stored soil parameter; the guard protects the request once it is mapped
          parameter: "b_gwl_glg" as MineralizationFieldData["soil"][number]["parameter"],
          value: 120,
          a_source: "lab_a",
          b_sampling_date: winterDate("2026-02-01"),
        },
      ],
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    if (result.status !== "ready") throw new Error("not ready")
    expect(result.request.soil_analysis).toEqual({ a_som_loi: 3.1, a_clay_mi: 6 })
  })

  it("sends the applications of the year in date order", () => {
    const application = (p_app_id: string, date: string): MineralizationApplication => ({
      p_app_id,
      p_id: "fert_kas",
      p_name_nl: "KAS",
      p_app_amount: 200,
      p_app_amount_display: 200,
      p_app_amount_unit: "kg/ha",
      p_app_method: "broadcasting",
      p_app_date: summerDate(date),
    })
    const data = fieldData({
      applications: [
        application("app_june", "2026-06-10"),
        application("app_april", "2026-04-20"),
        application("app_last_year", "2025-08-01"),
      ],
    })
    const result = prepareMineralizationInput(data, YEAR, TODAY)
    if (result.status !== "ready") throw new Error("not ready")
    expect(result.request.fertilizer_applications?.map((a) => a.p_date_fertilization)).toEqual([
      "2026-04-20",
      "2026-06-10",
    ])
    expect(result.usedInput.fertilizerApplications.map((a) => a.p_app_id)).toEqual([
      "app_april",
      "app_june",
    ])
  })

  it("adds sowing and harvest events", () => {
    const result = prepareMineralizationInput(fieldData(), YEAR, TODAY)
    if (result.status !== "ready") throw new Error("not ready")
    expect(result.events.map((e) => [e.type, e.date, e.planned])).toEqual([
      ["sowing", "2026-04-15", false],
      ["harvest", "2026-09-20", true],
    ])
  })
})

describe("restrictToMainCultivation", () => {
  it("keeps only the main cultivation and its harvests", () => {
    const restricted = restrictToMainCultivation(
      {
        field: { a_lat: 52, a_lon: 5.6 },
        cultivations: [
          { b_lu: "nl_2014", b_lu_id: "a", b_lu_start: "2026-04-15", b_lu_end: "2026-09-20" },
          { b_lu: "nl_427", b_lu_id: "b", b_lu_start: "2026-09-25", b_lu_end: "2026-12-31" },
        ],
        harvests: [
          { b_lu_id: "a", b_date_harvest: "2026-09-20" },
          { b_lu_id: "b", b_date_harvest: "2026-12-31" },
        ],
      },
      "a",
    )
    expect(restricted.cultivations?.map((c) => c.b_lu_id)).toEqual(["a"])
    expect(restricted.harvests?.map((h) => h.b_lu_id)).toEqual(["a"])
  })
})

describe("mapApplicationMethod", () => {
  it("keeps supported methods and falls back to broadcasting", () => {
    expect(mapApplicationMethod("injection")).toBe("injection")
    expect(mapApplicationMethod(null)).toBe("broadcasting")
    expect(mapApplicationMethod("unknown")).toBe("broadcasting")
  })
})
