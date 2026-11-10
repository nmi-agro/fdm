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

function validKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
  })
}

function makeApp(services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, {
    countFieldsOfFarms: async () => ({}),
    ...services,
  })
}

const baseSoilAnalysis = {
  a_id: "sa-1",
  a_date: new Date("2023-05-01"),
  a_source: "Lab NL",
  b_id_sampling: "samp-1",
  a_depth_upper: 0,
  a_depth_lower: 30,
  b_sampling_date: new Date("2023-04-28"),
  a_ph_cc: 6.2,
  a_som_loi: 3.5,
  a_al_ox: null,
  a_c_of: null,
  a_ca_co: null,
  a_ca_co_po: null,
  a_caco3_if: null,
  a_cec_co: null,
  a_clay_mi: 18.0,
  a_cn_fr: null,
  a_com_fr: null,
  a_cu_cc: null,
  a_density_sa: null,
  a_fe_ox: null,
  a_k_cc: null,
  a_k_co: null,
  a_k_co_po: null,
  a_mg_cc: null,
  a_mg_co: null,
  a_mg_co_po: null,
  a_n_pmn: null,
  a_n_rt: null,
  a_nh4_cc: null,
  a_nmin_cc: null,
  a_no3_cc: null,
  a_p_al: null,
  a_p_cc: null,
  a_p_ox: null,
  a_p_rt: null,
  a_p_sg: null,
  a_p_wa: null,
  a_s_rt: null,
  a_sand_mi: null,
  a_silt_mi: null,
  a_zn_cc: null,
  b_gwl_class: null,
  b_soiltype_agr: "clay",
}

const samplingPoints = {
  type: "MultiPoint",
  coordinates: [
    [5.002, 52.002],
    [5.003, 52.003],
  ],
}

const samplingZone = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [5.0, 52.0],
        [5.005, 52.0],
        [5.005, 52.005],
        [5.0, 52.005],
        [5.0, 52.0],
      ],
    ],
  ],
}

const currentSoilDataItem = {
  parameter: "a_p_al",
  value: 30,
  is_aggregated: true,
  coverage: 1,
  has_coverage_warning: false,
  sources: [
    {
      a_id: "sa-1",
      a_source: "Lab NL",
      b_sampling_date: new Date("2023-04-28"),
      a_depth_upper: 0,
      a_depth_lower: 30,
      value: 40,
      area_fraction: 0.5,
    },
    {
      a_id: "sa-2",
      a_source: "Lab NL",
      b_sampling_date: new Date("2023-04-20"),
      a_depth_upper: 0,
      a_depth_lower: 30,
      value: 20,
      area_fraction: 0.5,
    },
  ],
}

// ---------------------------------------------------------------------------
// GET /fields/:b_id/soil-analyses
// ---------------------------------------------------------------------------
describe("GET /fields/:b_id/soil-analyses", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with paginated list", async () => {
    const app = makeApp({
      getSoilAnalyses: vi.fn().mockResolvedValue([baseSoilAnalysis]),
    })
    const res = await app.request("/fields/field-1/soil-analyses", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].a_id).toBe("sa-1")
    expect(body.total).toBe(1)
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getSoilAnalyses: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fields/field-1/soil-analyses", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })

  it("serialises dates as YYYY-MM-DD strings", async () => {
    const app = makeApp({
      getSoilAnalyses: vi.fn().mockResolvedValue([baseSoilAnalysis]),
    })
    const res = await app.request("/fields/field-1/soil-analyses", {
      headers: { "x-api-key": "valid" },
    })
    const body = await res.json()
    expect(body.data[0].a_date).toBe("2023-05-01")
    expect(body.data[0].b_sampling_date).toBe("2023-04-28")
  })
})

// ---------------------------------------------------------------------------
// POST /fields/:b_id/soil-analyses
// ---------------------------------------------------------------------------
describe("POST /fields/:b_id/soil-analyses", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 201 with the created soil analysis", async () => {
    const app = makeApp({
      addSoilAnalysis: vi.fn().mockResolvedValue("sa-new"),
      getSoilAnalysis: vi.fn().mockResolvedValue({ ...baseSoilAnalysis, a_id: "sa-new" }),
    })
    const res = await app.request("/fields/field-1/soil-analyses", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        a_date: "2023-05-01",
        a_source: "Lab NL",
        a_depth_lower: 30,
        b_sampling_date: "2023-04-28",
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.a_id).toBe("sa-new")
    expect(res.headers.get("location")).toContain("/soil-analyses/sa-new")
  })

  it("returns 415 without Content-Type: application/json", async () => {
    const app = makeApp()
    const res = await app.request("/fields/field-1/soil-analyses", {
      method: "POST",
      headers: { "x-api-key": "valid" },
      body: "{}",
    })
    expect(res.status).toBe(415)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      addSoilAnalysis: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fields/field-1/soil-analyses", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        a_date: "2023-05-01",
        a_source: "Lab NL",
        a_depth_lower: 30,
        b_sampling_date: "2023-04-28",
      }),
    })
    expect(res.status).toBe(403)
  })

  it("passes the sampling geometries to the service and returns them", async () => {
    const addSoilAnalysis = vi.fn().mockResolvedValue("sa-new")
    const app = makeApp({
      addSoilAnalysis,
      getSoilAnalysis: vi.fn().mockResolvedValue({
        ...baseSoilAnalysis,
        a_id: "sa-new",
        b_sampling_geometry: samplingPoints,
        b_sampling_geometry_zone: samplingZone,
      }),
    })
    const res = await app.request("/fields/field-1/soil-analyses", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        a_date: "2023-05-01",
        a_source: "Lab NL",
        a_depth_lower: 30,
        b_sampling_date: "2023-04-28",
        b_sampling_geometry: samplingPoints,
        b_sampling_geometry_zone: samplingZone,
      }),
    })
    expect(res.status).toBe(201)
    expect(addSoilAnalysis.mock.calls[0][7]).toMatchObject({
      b_sampling_geometry: samplingPoints,
      b_sampling_geometry_zone: samplingZone,
    })
    const body = await res.json()
    expect(body.b_sampling_geometry).toEqual(samplingPoints)
    expect(body.b_sampling_geometry_zone).toEqual(samplingZone)
  })

  it("returns 400 when a sampling geometry has the wrong type", async () => {
    const app = makeApp()
    const res = await app.request("/fields/field-1/soil-analyses", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        a_date: "2023-05-01",
        a_source: "Lab NL",
        a_depth_lower: 30,
        b_sampling_date: "2023-04-28",
        b_sampling_geometry_zone: samplingPoints,
      }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 422 when a sampling geometry is outside WGS84 or empty", async () => {
    const app = makeApp()
    const post = (geometries: Record<string, unknown>) =>
      app.request("/fields/field-1/soil-analyses", {
        method: "POST",
        headers: {
          "x-api-key": "valid",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          a_date: "2023-05-01",
          a_source: "Lab NL",
          a_depth_lower: 30,
          b_sampling_date: "2023-04-28",
          ...geometries,
        }),
      })

    const outside = await post({
      b_sampling_geometry: { type: "MultiPoint", coordinates: [[181, 52]] },
    })
    expect(outside.status).toBe(422)
    const empty = await post({
      b_sampling_geometry_zone: { type: "MultiPolygon", coordinates: [] },
    })
    expect(empty.status).toBe(422)
    const emptyPolygon = await post({
      b_sampling_geometry_zone: {
        type: "MultiPolygon",
        coordinates: [
          [],
          [
            [
              [5, 52],
              [5.1, 52],
              [5.1, 52.1],
              [5, 52],
            ],
          ],
        ],
      },
    })
    expect(emptyPolygon.status).toBe(422)
    const shortRing = await post({
      b_sampling_geometry_zone: {
        type: "Polygon",
        coordinates: [
          [
            [5, 52],
            [5.1, 52],
            [5, 52],
          ],
        ],
      },
    })
    expect(shortRing.status).toBe(422)
    const openRing = await post({
      b_sampling_geometry_zone: {
        type: "Polygon",
        coordinates: [
          [
            [5, 52],
            [5.1, 52],
            [5.1, 52.1],
            [5, 52.1],
          ],
        ],
      },
    })
    expect(openRing.status).toBe(422)
  })

  it("returns 400 when required fields are missing", async () => {
    const app = makeApp()
    const res = await app.request("/fields/field-1/soil-analyses", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ a_date: "2023-05-01" }), // missing a_source, a_depth_lower, b_sampling_date
    })
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// GET /soil-analyses/:a_id
// ---------------------------------------------------------------------------
describe("GET /soil-analyses/:a_id", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with the soil analysis", async () => {
    const app = makeApp({
      getSoilAnalysis: vi.fn().mockResolvedValue(baseSoilAnalysis),
    })
    const res = await app.request("/soil-analyses/sa-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.a_id).toBe("sa-1")
    expect(body.a_source).toBe("Lab NL")
    expect(body.a_ph_cc).toBe(6.2)
  })

  it("returns 404 when soil analysis does not exist", async () => {
    const app = makeApp({
      getSoilAnalysis: vi.fn().mockResolvedValue({ ...baseSoilAnalysis, a_id: undefined }),
    })
    const res = await app.request("/soil-analyses/missing", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getSoilAnalysis: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/soil-analyses/sa-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// PATCH /soil-analyses/:a_id
// ---------------------------------------------------------------------------
describe("PATCH /soil-analyses/:a_id", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with the updated soil analysis", async () => {
    const updated = { ...baseSoilAnalysis, a_ph_cc: 6.8 }
    const app = makeApp({
      updateSoilAnalysis: vi.fn().mockResolvedValue(undefined),
      getSoilAnalysis: vi.fn().mockResolvedValue(updated),
    })
    const res = await app.request("/soil-analyses/sa-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ a_ph_cc: 6.8 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.a_ph_cc).toBe(6.8)
  })

  it("returns 400 when body is empty", async () => {
    const app = makeApp({
      updateSoilAnalysis: vi.fn(),
      getSoilAnalysis: vi.fn(),
    })
    const res = await app.request("/soil-analyses/sa-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.type).toContain("validation-failed")
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      updateSoilAnalysis: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/soil-analyses/sa-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ a_ph_cc: 6.8 }),
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// DELETE /soil-analyses/:a_id
// ---------------------------------------------------------------------------
describe("DELETE /soil-analyses/:a_id", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 204 on success", async () => {
    const app = makeApp({
      getSoilAnalysis: vi.fn().mockResolvedValue({ ...baseSoilAnalysis, b_id_sampling: null }),
      removeSoilAnalysis: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/soil-analyses/sa-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(204)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      getSoilAnalysis: vi.fn().mockRejectedValue(new Error("Permission denied")),
      removeSoilAnalysis: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/soil-analyses/sa-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /farms/:b_id_farm/soil-analyses
// ---------------------------------------------------------------------------
describe("GET /farms/:b_id_farm/soil-analyses", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with paginated list", async () => {
    const app = makeApp({
      getSoilAnalysesForFarm: vi.fn().mockResolvedValue(new Map([["field-1", [baseSoilAnalysis]]])),
    })
    const res = await app.request("/farms/farm-1/soil-analyses", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data[0].a_id).toBe("sa-1")
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getSoilAnalysesForFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/soil-analyses", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /fields/:b_id/current-soil-data
// ---------------------------------------------------------------------------
describe("GET /fields/:b_id/current-soil-data", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with current soil data", async () => {
    const app = makeApp({
      getCurrentSoilData: vi.fn().mockResolvedValue([currentSoilDataItem]),
    })
    const res = await app.request("/fields/field-1/current-soil-data", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].parameter).toBe("a_p_al")
    expect(body[0].value).toBe(30)
    expect(body[0].is_aggregated).toBe(true)
    expect(body[0].sources).toEqual([
      {
        a_id: "sa-1",
        a_source: "Lab NL",
        b_sampling_date: "2023-04-28",
        a_depth_upper: 0,
        a_depth_lower: 30,
        value: 40,
        area_fraction: 0.5,
      },
      {
        a_id: "sa-2",
        a_source: "Lab NL",
        b_sampling_date: "2023-04-20",
        a_depth_upper: 0,
        a_depth_lower: 30,
        value: 20,
        area_fraction: 0.5,
      },
    ])
  })

  it("returns 404 when no current soil data exists", async () => {
    const app = makeApp({
      getCurrentSoilData: vi.fn().mockResolvedValue([]),
    })
    const res = await app.request("/fields/field-1/current-soil-data", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getCurrentSoilData: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fields/field-1/current-soil-data", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /fields/:b_id/current-soil-data/zones
// ---------------------------------------------------------------------------
describe("GET /fields/:b_id/current-soil-data/zones", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with the current soil data per zone", async () => {
    const app = makeApp({
      getCurrentSoilDataPerZone: vi.fn().mockResolvedValue([
        {
          b_sampling_geometry_zone: samplingZone,
          b_area: 1.72,
          a_ids: ["sa-1"],
          data: [
            {
              ...currentSoilDataItem,
              value: 40,
              is_aggregated: false,
              coverage: null,
              sources: [{ ...currentSoilDataItem.sources[0], area_fraction: 1 }],
            },
          ],
        },
      ]),
    })
    const res = await app.request("/fields/field-1/current-soil-data/zones", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].b_sampling_geometry_zone).toEqual(samplingZone)
    expect(body[0].a_ids).toEqual(["sa-1"])
    expect(body[0].data[0].sources[0].b_sampling_date).toBe("2023-04-28")
  })

  it("returns 404 when no current soil data exists", async () => {
    const app = makeApp({
      getCurrentSoilDataPerZone: vi.fn().mockResolvedValue([]),
    })
    const res = await app.request("/fields/field-1/current-soil-data/zones", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 401 without an API key", async () => {
    const app = makeApp()
    const res = await app.request("/fields/field-1/current-soil-data/zones")
    expect(res.status).toBe(401)
  })
})

describe("soil condition score (BCS) parameters", () => {
  beforeEach(() => {
    validKey()
  })

  it("accepts BCS scores when creating an analysis and returns them", async () => {
    const addSoilAnalysis = vi.fn().mockResolvedValue("sa-bcs")
    const app = makeApp({
      addSoilAnalysis,
      getSoilAnalysis: vi
        .fn()
        .mockResolvedValue({ ...baseSoilAnalysis, a_id: "sa-bcs", a_ss_bcs: 2, a_p_bcs: 0 }),
    })
    const res = await app.request("/fields/field-1/soil-analyses", {
      method: "POST",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({
        a_date: "2026-05-01",
        a_source: "nl-other-nmi",
        a_depth_lower: 30,
        b_sampling_date: "2026-05-01",
        a_ss_bcs: 2,
        a_p_bcs: 0,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.a_ss_bcs).toBe(2)
    expect(body.a_p_bcs).toBe(0)
    expect(body.a_rt_bcs).toBeNull()
    const analysisData = addSoilAnalysis.mock.calls[0]?.[7]
    expect(analysisData).toMatchObject({ a_ss_bcs: 2, a_p_bcs: 0 })
  })
})

// ---------------------------------------------------------------------------
// Ordering, partial updates and records that cannot be read back
// ---------------------------------------------------------------------------
describe("Soil analyses — ordering, partial updates and missing records", () => {
  beforeEach(() => {
    validKey()
  })

  const jsonHeaders = { "x-api-key": "valid", "content-type": "application/json" }

  it("GET /farms/:b_id_farm/soil-analyses orders analyses with the same date by a_id", async () => {
    const app = makeApp({
      getSoilAnalysesForFarm: vi.fn().mockResolvedValue(
        new Map([
          [
            "field-1",
            [
              { ...baseSoilAnalysis, a_id: "sa-c", a_date: new Date("2023-05-01") },
              { ...baseSoilAnalysis, a_id: "sa-a", a_date: new Date("2023-05-01") },
            ],
          ],
          ["field-2", [{ ...baseSoilAnalysis, a_id: "sa-b", a_date: new Date("2022-03-01") }]],
        ]),
      ),
    })
    const res = await app.request("/farms/farm-1/soil-analyses", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((a: { a_id: string }) => a.a_id)).toEqual(["sa-b", "sa-a", "sa-c"])
  })

  it("POST returns 500 when the created soil analysis cannot be retrieved", async () => {
    const app = makeApp({
      addSoilAnalysis: vi.fn().mockResolvedValue("sa-new"),
      getSoilAnalysis: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/fields/field-1/soil-analyses", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        a_date: "2023-05-01",
        a_source: "Lab NL",
        a_depth_lower: 30,
        b_sampling_date: "2023-04-28",
      }),
    })
    expect(res.status).toBe(500)
    expect((await res.json()).type).toMatch(/\/problems\/internal-error$/)
  })

  it("PATCH passes a new date and source on to the service", async () => {
    const updateSoilAnalysis = vi.fn().mockResolvedValue(undefined)
    const app = makeApp({
      updateSoilAnalysis,
      getSoilAnalysis: vi.fn().mockResolvedValue({
        ...baseSoilAnalysis,
        a_date: new Date("2023-06-01"),
        a_source: "Lab BE",
      }),
    })
    const res = await app.request("/soil-analyses/sa-1", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ a_date: "2023-06-01", a_source: "Lab BE" }),
    })
    expect(res.status).toBe(200)
    expect(updateSoilAnalysis.mock.calls[0][3]).toEqual({
      a_date: new Date("2023-06-01"),
      a_source: "Lab BE",
    })
    const body = await res.json()
    expect(body.a_date).toBe("2023-06-01")
    expect(body.a_source).toBe("Lab BE")
  })

  it("PATCH returns 404 when the soil analysis does not exist", async () => {
    const app = makeApp({
      updateSoilAnalysis: vi.fn().mockResolvedValue(undefined),
      getSoilAnalysis: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/soil-analyses/sa-x", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ a_ph_cc: 6.8 }),
    })
    expect(res.status).toBe(404)
    expect((await res.json()).type).toMatch(/\/problems\/not-found$/)
  })
})
