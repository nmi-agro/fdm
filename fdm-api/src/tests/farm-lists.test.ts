import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"

const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
const mockFdm = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any
const config = { appName: "Test App", appUrl: "https://test.example.com" }
const headers = { "x-api-key": "valid" }

function validKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
  })
}

function makeApp(services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, services)
}

const application = (p_app_id: string, date: string) => ({
  p_id: "p-1",
  p_id_catalogue: "cat-1",
  p_name_nl: "Drijfmest",
  p_app_amount: 30000,
  p_app_amount_unit: "m3/ha",
  p_app_amount_display: 30,
  p_app_method: "injection",
  p_app_date: new Date(date),
  p_app_id,
})

const harvest = (b_id_harvesting: string, b_lu: string, date: string) => ({
  b_id_harvesting,
  b_lu,
  b_lu_harvest_date: new Date(date),
  harvestable: { harvestable_analyses: [] },
})

const measure = (b_id_measure: string, b_id: string, start: string) => ({
  b_id_measure,
  b_id,
  m_id: "m-1",
  m_name: "Bufferstrook",
  m_summary: null,
  m_description: null,
  m_source_url: null,
  m_conflicts: null,
  m_start: new Date(start),
  m_end: null,
})

const soilItem = (parameter: string, value: number | null) => ({
  parameter,
  value,
  is_aggregated: false,
  coverage: 1,
  has_coverage_warning: false,
  sources: [
    {
      a_id: `a-${parameter}`,
      a_source: "nl-other-lab",
      b_sampling_date: new Date("2025-03-01"),
      a_depth_upper: 0,
      a_depth_lower: 30,
      value,
      area_fraction: 1,
    },
  ],
})

describe("GET /farms/:b_id_farm/fertilizer-applications", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("returns the applications of all fields with their field ID, sorted by date", async () => {
    const getFertilizerApplicationsForFarm = vi.fn().mockResolvedValue(
      new Map([
        ["f2", [application("app-2", "2026-04-01")]],
        ["f1", [application("app-1", "2026-03-01")]],
      ]),
    )
    const app = makeApp({ getFertilizerApplicationsForFarm })
    const res = await app.request(
      "/farms/farm-1/fertilizer-applications?from=2026-01-01&to=2026-12-31",
      { headers },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((item: any) => [item.p_app_id, item.b_id])).toEqual([
      ["app-1", "f1"],
      ["app-2", "f2"],
    ])
    expect(body.data[0].p_app_date).toBe("2026-03-01")
    expect(getFertilizerApplicationsForFarm.mock.calls[0]?.[3]).toEqual({
      start: expect.any(Date),
      end: expect.any(Date),
    })
  })

  it("sorts applications on the same date by their ID", async () => {
    const getFertilizerApplicationsForFarm = vi.fn().mockResolvedValue(
      new Map([
        ["f1", [application("app-b", "2026-03-01")]],
        ["f2", [application("app-a", "2026-03-01")]],
      ]),
    )
    const app = makeApp({ getFertilizerApplicationsForFarm })
    const res = await app.request("/farms/farm-1/fertilizer-applications", { headers })
    const body = await res.json()
    expect(body.data.map((item: any) => item.p_app_id)).toEqual(["app-a", "app-b"])
  })

  it("returns 403 without read access", async () => {
    const app = makeApp({
      getFertilizerApplicationsForFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/fertilizer-applications", { headers })
    expect(res.status).toBe(403)
    expect(res.headers.get("content-type")).toContain("application/problem+json")
  })

  it("returns 401 without an API key", async () => {
    const app = makeApp({ getFertilizerApplicationsForFarm: vi.fn() })
    const res = await app.request("/farms/farm-1/fertilizer-applications")
    expect(res.status).toBe(401)
  })

  it("returns 400 for an invalid limit", async () => {
    const app = makeApp({ getFertilizerApplicationsForFarm: vi.fn() })
    const res = await app.request("/farms/farm-1/fertilizer-applications?limit=0", { headers })
    expect(res.status).toBe(400)
  })
})

describe("GET /farms/:b_id_farm/harvests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("returns the harvests of all cultivations, sorted by date and paginated", async () => {
    const getHarvestsForFarm = vi.fn().mockResolvedValue(
      new Map([
        ["lu-1", [harvest("h-2", "lu-1", "2026-09-01")]],
        ["lu-2", [harvest("h-1", "lu-2", "2026-07-01"), harvest("h-3", "lu-2", "2026-10-01")]],
      ]),
    )
    const app = makeApp({ getHarvestsForFarm })
    const res = await app.request("/farms/farm-1/harvests?limit=2", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((item: any) => item.b_id_harvesting)).toEqual(["h-1", "h-2"])
    expect(body.pagination?.total ?? body.total).toBe(3)
  })

  it("sorts harvests on the same date by their ID", async () => {
    const getHarvestsForFarm = vi.fn().mockResolvedValue(
      new Map([
        ["lu-1", [harvest("h-b", "lu-1", "2026-09-01")]],
        ["lu-2", [harvest("h-a", "lu-2", "2026-09-01")]],
      ]),
    )
    const app = makeApp({ getHarvestsForFarm })
    const res = await app.request("/farms/farm-1/harvests", { headers })
    const body = await res.json()
    expect(body.data.map((item: any) => item.b_id_harvesting)).toEqual(["h-a", "h-b"])
  })

  it("returns 403 without read access", async () => {
    const app = makeApp({
      getHarvestsForFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/harvests", { headers })
    expect(res.status).toBe(403)
  })
})

describe("GET /farms/:b_id_farm/measures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("returns the measures of all fields, sorted by start date", async () => {
    const getMeasuresForFarm = vi.fn().mockResolvedValue(
      new Map([
        ["f1", [measure("bm-2", "f1", "2026-05-01")]],
        ["f2", [measure("bm-1", "f2", "2026-02-01")]],
      ]),
    )
    const app = makeApp({ getMeasuresForFarm })
    const res = await app.request("/farms/farm-1/measures", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((item: any) => [item.b_id_measure, item.b_id])).toEqual([
      ["bm-1", "f2"],
      ["bm-2", "f1"],
    ])
  })

  it("sorts measures with the same or no start date by their ID", async () => {
    const getMeasuresForFarm = vi.fn().mockResolvedValue(
      new Map([
        [
          "f1",
          [
            measure("bm-3", "f1", "2026-05-01"),
            { ...measure("bm-9", "f1", "2026-01-01"), m_start: null },
          ],
        ],
        ["f2", [measure("bm-2", "f2", "2026-05-01")]],
      ]),
    )
    const app = makeApp({ getMeasuresForFarm })
    const res = await app.request("/farms/farm-1/measures", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((item: any) => item.b_id_measure)).toEqual(["bm-9", "bm-2", "bm-3"])
  })

  it("returns 401 without an API key", async () => {
    const app = makeApp({ getMeasuresForFarm: vi.fn() })
    const res = await app.request("/farms/farm-1/measures")
    expect(res.status).toBe(401)
  })
})

describe("GET /farms/:b_id_farm/current-soil-data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("returns the current soil data per field, with the calculated NLV", async () => {
    const getCurrentSoilDataForFarm = vi.fn().mockResolvedValue(
      new Map([
        ["f1", [soilItem("a_som_loi", 3), soilItem("a_clay_mi", 20), soilItem("a_cn_fr", 10)]],
        ["f2", []],
      ]),
    )
    const app = makeApp({ getCurrentSoilDataForFarm })
    const res = await app.request("/farms/farm-1/current-soil-data", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((field: any) => field.b_id)).toEqual(["f1", "f2"])
    const nlv = body.data[0].items.find((item: any) => item.parameter === "d_n_supply_base")
    expect(typeof nlv.value).toBe("number")
    expect(nlv.coverage).toBeNull()
    expect(nlv.sources[0].a_source).toBe("calculated")
    expect(body.data[1].items).toEqual([])
  })

  it("returns 403 without read access", async () => {
    const app = makeApp({
      getCurrentSoilDataForFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/current-soil-data", { headers })
    expect(res.status).toBe(403)
  })
})

describe("GET /fields/:b_id/current-soil-data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("adds the calculated NLV when no analysis has one", async () => {
    const app = makeApp({
      getCurrentSoilData: vi
        .fn()
        .mockResolvedValue([
          soilItem("a_som_loi", 3),
          soilItem("a_clay_mi", 20),
          soilItem("a_cn_fr", 10),
        ]),
    })
    const res = await app.request("/fields/f1/current-soil-data", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.some((item: any) => item.parameter === "d_n_supply_base")).toBe(true)
  })

  it("keeps a measured NLV", async () => {
    const app = makeApp({
      getCurrentSoilData: vi
        .fn()
        .mockResolvedValue([soilItem("a_som_loi", 3), soilItem("d_n_supply_base", 99)]),
    })
    const res = await app.request("/fields/f1/current-soil-data", { headers })
    const body = await res.json()
    const nlv = body.filter((item: any) => item.parameter === "d_n_supply_base")
    expect(nlv).toHaveLength(1)
    expect(nlv[0].value).toBe(99)
  })
})
