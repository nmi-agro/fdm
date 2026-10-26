import { describe, expect, it } from "vitest"
import type { MineralizationApplication } from "./prepare"
import type { DynaV2Request } from "./types"
import {
  applyScenarioToRequest,
  diffScenario,
  getMineralizationScenarioSchema,
  type MineralizationScenario,
  type ScenarioFertilizer,
} from "./scenario"

const kas: ScenarioFertilizer = {
  p_id: "fert_kas",
  p_type: "mineral",
  p_n_rt: 270,
  p_n_if: 270,
  p_n_of: 0,
  p_om: null,
  p_no3_rt: null,
  p_nh4_rt: null,
  p_s_rt: null,
  p_app_amount_unit: "kg/ha",
  p_density: null,
}

const slurry: ScenarioFertilizer = {
  p_id: "fert_slurry",
  p_type: "manure",
  p_n_rt: 4.5,
  p_n_if: 2.5,
  p_n_of: 2,
  p_om: 70,
  p_no3_rt: null,
  p_nh4_rt: null,
  p_s_rt: null,
  p_app_amount_unit: "m3/ha",
  p_density: 1.01,
}

const fertilizers = new Map([
  [kas.p_id, kas],
  [slurry.p_id, slurry],
])

const request: DynaV2Request = {
  field: { a_lat: 52, a_lon: 5.6 },
  cultivations: [
    { b_lu: "nl_2014", b_lu_id: "lu_main", b_lu_start: "2026-04-15", b_lu_end: "2026-09-20" },
  ],
  harvests: [
    { b_lu_id: "lu_main", b_date_harvest: "2026-09-20", b_lu_yield: 45000, m_cropresidue: true },
  ],
  fertilizer_applications: [
    {
      p_id: "fert_kas",
      p_app_amount: 300,
      p_date_fertilization: "2026-05-01",
      p_app_method: "broadcasting",
    },
  ],
  fertilizer_properties: [{ p_id: "fert_kas", p_type_mineral: true, p_n_rt: 270 }],
}

describe("applyScenarioToRequest", () => {
  it("replaces the fertilizer applications and converts amounts to kg/ha", () => {
    const scenario: MineralizationScenario = {
      fertilizerApplications: [
        {
          p_app_id: "app_1",
          p_id: "fert_kas",
          p_app_amount_display: 300,
          p_app_method: "broadcasting",
          p_app_date: "2026-05-04",
        },
        {
          p_id: "fert_slurry",
          p_app_amount_display: 30,
          p_app_method: "slotted coulter",
          p_app_date: "2026-04-01",
        },
      ],
    }
    const result = applyScenarioToRequest({
      request,
      scenario,
      fertilizers,
      mainB_lu: "lu_main",
      mainHarvestable: "once",
      mainHarvestcat: "HC031",
    })
    expect(result.fertilizer_applications).toEqual([
      {
        p_id: "fert_slurry",
        p_app_amount: 30300,
        p_date_fertilization: "2026-04-01",
        p_app_method: "slotted coulter",
      },
      {
        p_id: "fert_kas",
        p_app_amount: 300,
        p_date_fertilization: "2026-05-04",
        p_app_method: "broadcasting",
      },
    ])
    expect(result.fertilizer_properties?.map((p) => p.p_id).sort()).toEqual([
      "fert_kas",
      "fert_slurry",
    ])
    expect(result.cultivations).toEqual(request.cultivations)
  })

  it("removes fertilizer keys when the scenario has no applications", () => {
    const result = applyScenarioToRequest({
      request,
      scenario: { fertilizerApplications: [] },
      fertilizers,
      mainB_lu: "lu_main",
      mainHarvestable: "once",
      mainHarvestcat: "HC031",
    })
    expect(result.fertilizer_applications).toBeUndefined()
    expect(result.fertilizer_properties).toBeUndefined()
  })

  it("moves the harvest and the end of a crop harvested once", () => {
    const result = applyScenarioToRequest({
      request,
      scenario: {
        fertilizerApplications: [],
        harvests: [
          {
            b_id_harvesting: "h1",
            b_date_harvest: "2026-09-25",
            parameters: { b_lu_yield: 50000, b_lu_cp: 75 },
          },
        ],
      },
      fertilizers,
      mainB_lu: "lu_main",
      mainHarvestable: "once",
      mainHarvestcat: "HC031",
      mainHarvestIds: ["h1"],
    })
    expect(result.harvests).toEqual([
      {
        b_lu_id: "lu_main",
        b_date_harvest: "2026-09-25",
        b_lu_yield: 50000,
        b_lu_n_harvestable: 12,
        m_cropresidue: true,
      },
    ])
    expect(result.cultivations?.[0].b_lu_end).toBe("2026-09-25")
  })

  describe("grassland with multiple cuts", () => {
    const grass: DynaV2Request = {
      ...request,
      cultivations: [
        { b_lu: "nl_265", b_lu_id: "lu_main", b_lu_start: "2026-01-01", b_lu_end: "2026-12-31" },
      ],
      harvests: [
        {
          b_lu_id: "lu_main",
          b_date_harvest: "2026-05-10",
          b_lu_yield: 3500,
          b_lu_n_harvestable: 32,
          m_cropresidue: false,
        },
        {
          b_lu_id: "lu_main",
          b_date_harvest: "2026-06-20",
          b_lu_yield: 3000,
          b_lu_n_harvestable: 30,
          m_cropresidue: false,
        },
      ],
    }
    const apply = (harvests: MineralizationScenario["harvests"]) =>
      applyScenarioToRequest({
        request: grass,
        scenario: { fertilizerApplications: [], harvests },
        fertilizers,
        mainB_lu: "lu_main",
        mainHarvestable: "multiple",
        mainHarvestcat: "HC020",
        mainHarvestIds: ["h1", "h2"],
      })

    it("converts the yield and crude protein of each cut", () => {
      const result = apply([
        {
          b_id_harvesting: "h1",
          b_date_harvest: "2026-05-15",
          parameters: { b_lu_yield: 3500, b_lu_cp: 200 },
        },
        {
          b_id_harvesting: "h2",
          b_date_harvest: "2026-06-25",
          parameters: { b_lu_yield: 2800, b_lu_cp: 150 },
        },
      ])
      expect(result.harvests).toEqual([
        {
          b_lu_id: "lu_main",
          b_date_harvest: "2026-05-15",
          b_lu_yield: 3500,
          b_lu_n_harvestable: 32,
          m_cropresidue: false,
        },
        {
          b_lu_id: "lu_main",
          b_date_harvest: "2026-06-25",
          b_lu_yield: 2800,
          b_lu_n_harvestable: 24,
          m_cropresidue: false,
        },
      ])
      expect(result.cultivations?.[0].b_lu_end).toBe("2026-12-31")
    })

    it("keeps the stored values of a cut with incomplete parameters", () => {
      const result = apply([
        { b_id_harvesting: "h2", b_date_harvest: "2026-06-22", parameters: { b_lu_yield: 2000 } },
      ])
      expect(result.harvests).toEqual([
        {
          b_lu_id: "lu_main",
          b_date_harvest: "2026-06-22",
          b_lu_yield: 3000,
          b_lu_n_harvestable: 30,
          m_cropresidue: false,
        },
      ])
    })

    it("adds and removes cuts, in date order", () => {
      const result = apply([
        { b_date_harvest: "2026-08-01", parameters: { b_lu_yield: 2500, b_lu_cp: 175 } },
        { b_date_harvest: "2026-09-15" },
        { b_id_harvesting: "h1", b_date_harvest: "2026-05-10" },
      ])
      expect(result.harvests).toEqual([
        {
          b_lu_id: "lu_main",
          b_date_harvest: "2026-05-10",
          b_lu_yield: 3500,
          b_lu_n_harvestable: 32,
          m_cropresidue: false,
        },
        {
          b_lu_id: "lu_main",
          b_date_harvest: "2026-08-01",
          b_lu_yield: 2500,
          b_lu_n_harvestable: 28,
          m_cropresidue: false,
        },
        { b_lu_id: "lu_main", b_date_harvest: "2026-09-15", m_cropresidue: false },
      ])
    })
  })

  it("throws for an unknown fertilizer", () => {
    expect(() =>
      applyScenarioToRequest({
        request,
        scenario: {
          fertilizerApplications: [
            {
              p_id: "fert_missing",
              p_app_amount_display: 1,
              p_app_method: "broadcasting",
              p_app_date: "2026-05-01",
            },
          ],
        },
        fertilizers,
        mainB_lu: "lu_main",
        mainHarvestable: "once",
        mainHarvestcat: "HC031",
      }),
    ).toThrow("Onbekende meststof")
  })
})

describe("getMineralizationScenarioSchema", () => {
  const schema = getMineralizationScenarioSchema(2026)

  it("accepts a valid scenario", () => {
    expect(
      schema.safeParse({
        fertilizerApplications: [
          {
            p_id: "fert_kas",
            p_app_amount_display: 300,
            p_app_method: "broadcasting",
            p_app_date: "2026-05-01",
          },
        ],
        harvests: [
          { b_date_harvest: "2026-09-01", parameters: { b_lu_yield: 12000, b_lu_cp: 80 } },
        ],
      }).success,
    ).toBe(true)
  })

  it("accepts any number of harvests at least 10 days apart", () => {
    const harvests = Array.from({ length: 8 }, (_, i) => ({
      b_date_harvest: new Date(Date.UTC(2026, 3, 1 + i * 21)).toISOString().slice(0, 10),
    }))
    expect(schema.safeParse({ fertilizerApplications: [], harvests }).success).toBe(true)
  })

  it("rejects harvests less than 10 days apart", () => {
    const result = schema.safeParse({
      fertilizerApplications: [],
      // Unsorted on purpose
      harvests: [{ b_date_harvest: "2026-06-05" }, { b_date_harvest: "2026-06-01" }],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      "Tussen twee oogsten moeten minimaal 10 dagen zitten.",
    )
  })

  it("rejects a scenario without harvests", () => {
    expect(schema.safeParse({ fertilizerApplications: [], harvests: [] }).success).toBe(false)
  })

  it("rejects applications outside the year", () => {
    expect(
      schema.safeParse({
        fertilizerApplications: [
          {
            p_id: "fert_kas",
            p_app_amount_display: 300,
            p_app_method: "broadcasting",
            p_app_date: "2025-12-31",
          },
        ],
      }).success,
    ).toBe(false)
  })

  it("rejects negative amounts and invalid dates", () => {
    const application = {
      p_id: "fert_kas",
      p_app_amount_display: -1,
      p_app_method: "broadcasting",
      p_app_date: "2026-05-01",
    }
    expect(schema.safeParse({ fertilizerApplications: [application] }).success).toBe(false)
    expect(
      schema.safeParse({
        fertilizerApplications: [
          { ...application, p_app_amount_display: 1, p_app_date: "1-5-2026" },
        ],
      }).success,
    ).toBe(false)
  })
})

describe("diffScenario", () => {
  const current: MineralizationApplication[] = [
    {
      p_app_id: "app_same",
      p_id: "fert_kas",
      p_name_nl: "KAS",
      p_app_amount: 300,
      p_app_amount_display: 300,
      p_app_amount_unit: "kg/ha",
      p_app_method: "broadcasting",
      p_app_date: new Date("2026-05-01T00:00:00+02:00"),
    },
    {
      p_app_id: "app_moved",
      p_id: "fert_kas",
      p_name_nl: "KAS",
      p_app_amount: 200,
      p_app_amount_display: 200,
      p_app_amount_unit: "kg/ha",
      p_app_method: "broadcasting",
      p_app_date: new Date("2026-06-01T00:00:00+02:00"),
    },
    {
      p_app_id: "app_removed",
      p_id: "fert_kas",
      p_name_nl: "KAS",
      p_app_amount: 100,
      p_app_amount_display: 100,
      p_app_amount_unit: "kg/ha",
      p_app_method: "broadcasting",
      p_app_date: new Date("2026-07-01T00:00:00+02:00"),
    },
  ]

  const scenario: MineralizationScenario = {
    fertilizerApplications: [
      {
        p_app_id: "app_same",
        p_id: "fert_kas",
        p_app_amount_display: 300,
        p_app_method: "broadcasting",
        p_app_date: "2026-05-01",
      },
      {
        p_app_id: "app_moved",
        p_id: "fert_kas",
        p_app_amount_display: 200,
        p_app_method: "broadcasting",
        p_app_date: "2026-06-04",
      },
      {
        p_id: "fert_slurry",
        p_app_amount_display: 30,
        p_app_method: "slotted coulter",
        p_app_date: "2026-04-01",
      },
    ],
  }

  it("classifies added, changed and removed applications", () => {
    const diff = diffScenario(current, [], scenario)
    expect(diff.add.map((a) => a.p_id)).toEqual(["fert_slurry"])
    expect(diff.update.map((a) => [a.p_app_id, a.p_app_date])).toEqual([
      ["app_moved", "2026-06-04"],
    ])
    expect(diff.remove).toEqual(["app_removed"])
    expect(diff.harvests).toEqual({ add: [], update: [], remove: [] })
  })

  it("only removes and updates applications the scenario was built from", () => {
    const withNullMethod: MineralizationApplication[] = [
      ...current,
      {
        p_app_id: "app_skipped",
        p_id: "fert_unknown",
        p_name_nl: null,
        p_app_amount: 50,
        p_app_amount_display: 50,
        p_app_amount_unit: "kg/ha",
        p_app_method: null,
        p_app_date: new Date("2026-04-01T00:00:00+02:00"),
      },
      {
        p_app_id: "app_null_method",
        p_id: "fert_kas",
        p_name_nl: "KAS",
        p_app_amount: 150,
        p_app_amount_display: 150,
        p_app_amount_unit: "kg/ha",
        p_app_method: null,
        p_app_date: new Date("2026-08-01T00:00:00+02:00"),
      },
    ]
    const base: MineralizationScenario = {
      fertilizerApplications: [
        ...scenario.fertilizerApplications.slice(0, 1),
        {
          p_app_id: "app_moved",
          p_id: "fert_kas",
          p_app_amount_display: 200,
          p_app_method: "broadcasting",
          p_app_date: "2026-06-01",
        },
        {
          p_app_id: "app_null_method",
          p_id: "fert_kas",
          p_app_amount_display: 150,
          p_app_method: "broadcasting",
          p_app_date: "2026-08-01",
        },
      ],
    }
    const edited: MineralizationScenario = {
      fertilizerApplications: [
        base.fertilizerApplications[0],
        { ...base.fertilizerApplications[1], p_app_date: "2026-06-04" },
        base.fertilizerApplications[2],
      ],
    }
    const diff = diffScenario(withNullMethod, [], edited, base)
    expect(diff.remove).toEqual([])
    expect(diff.update.map((a) => a.p_app_id)).toEqual(["app_moved"])
    expect(diff.add).toEqual([])
  })

  it("adds an application whose id is no longer in the plan", () => {
    const withDeleted: MineralizationScenario = {
      fertilizerApplications: [
        {
          p_app_id: "app_deleted_meanwhile",
          p_id: "fert_kas",
          p_app_amount_display: 150,
          p_app_method: "broadcasting",
          p_app_date: "2026-05-15",
        },
      ],
    }
    const diff = diffScenario(current, [], withDeleted)
    expect(diff.add.map((a) => a.p_app_id)).toEqual(["app_deleted_meanwhile"])
    expect(diff.update).toEqual([])
  })

  it("updates an existing harvest or adds a new one", () => {
    const withHarvest = {
      ...scenario,
      harvests: [{ b_id_harvesting: "h1", b_date_harvest: "2026-09-25" }],
    }
    expect(
      diffScenario(
        current,
        [{ b_id_harvesting: "h1", b_date_harvest: "2026-09-20", parameters: {} }],
        withHarvest,
      ).harvests,
    ).toEqual({
      add: [],
      update: [{ b_id_harvesting: "h1", b_date_harvest: "2026-09-25" }],
      remove: [],
    })
    expect(diffScenario(current, [], withHarvest).harvests).toEqual({
      add: [{ b_date_harvest: "2026-09-25" }],
      update: [],
      remove: [],
    })
    expect(
      diffScenario(
        current,
        [{ b_id_harvesting: "h1", b_date_harvest: "2026-09-25", parameters: {} }],
        withHarvest,
      ).harvests,
    ).toEqual({ add: [], update: [], remove: [] })
  })

  it("adds, changes and removes cuts, but only cuts the scenario was built from", () => {
    const stored = { b_lu_yield: 3500, b_lu_cp: 200 }
    const currentCuts = [
      { b_id_harvesting: "h1", b_date_harvest: "2026-05-10", parameters: stored },
      { b_id_harvesting: "h2", b_date_harvest: "2026-06-20", parameters: stored },
      { b_id_harvesting: "h3", b_date_harvest: "2026-08-01", parameters: stored },
      // Not shown in the scenario, e.g. a cut that is too close to the previous one
      { b_id_harvesting: "h4", b_date_harvest: "2026-08-05", parameters: stored },
    ]
    const base: MineralizationScenario = {
      fertilizerApplications: [],
      harvests: [
        { b_id_harvesting: "h1", b_date_harvest: "2026-05-10", parameters: stored },
        { b_id_harvesting: "h2", b_date_harvest: "2026-06-20", parameters: stored },
        { b_id_harvesting: "h3", b_date_harvest: "2026-08-01", parameters: stored },
      ],
    }
    const edited: MineralizationScenario = {
      fertilizerApplications: [],
      harvests: [
        { b_id_harvesting: "h1", b_date_harvest: "2026-05-14", parameters: stored },
        {
          b_id_harvesting: "h2",
          b_date_harvest: "2026-06-20",
          parameters: { b_lu_yield: 2900, b_lu_cp: 180 },
        },
        { b_date_harvest: "2026-09-15", parameters: { b_lu_yield: 2000, b_lu_cp: 170 } },
      ],
    }
    expect(diffScenario([], currentCuts, edited, base).harvests).toEqual({
      add: [{ b_date_harvest: "2026-09-15", parameters: { b_lu_yield: 2000, b_lu_cp: 170 } }],
      update: [
        // Only the date changed, so the parameters are left as stored
        { b_id_harvesting: "h1", b_date_harvest: "2026-05-14" },
        {
          b_id_harvesting: "h2",
          b_date_harvest: "2026-06-20",
          parameters: { b_lu_yield: 2900, b_lu_cp: 180 },
        },
      ],
      remove: ["h3"],
    })
  })
})
