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
  return createFdmApi(mockFdm, mockAuth, config, services)
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
      getCurrentSoilData: vi.fn().mockResolvedValue([
        {
          parameter: "a_ph_cc",
          value: 6.2,
          a_id: "sa-1",
          b_sampling_date: new Date("2023-04-28"),
          a_depth_upper: 0,
          a_depth_lower: 30,
          a_source: "Lab NL",
        },
      ]),
    })
    const res = await app.request("/fields/field-1/current-soil-data", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    expect((await res.json())[0].parameter).toBe("a_ph_cc")
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
