import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"
import { updateCustomFertilizer } from "../operations/fertilizers"

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

const baseCatalogue = {
  p_id_catalogue: "cat-1",
  p_source: "rvo",
  p_name_nl: "Drijfmest",
  p_name_en: "Slurry",
  p_description: null,
  p_app_method_options: ["injecteren"],
  p_app_amount_unit: "m3/ha",
  p_dm: null,
  p_density: 1,
  p_om: null,
  p_a: null,
  p_hc: null,
  p_eom: null,
  p_eoc: null,
  p_c_rt: null,
  p_c_of: null,
  p_c_if: null,
  p_c_fr: null,
  p_cn_of: null,
  p_n_rt: null,
  p_n_if: null,
  p_n_of: null,
  p_n_wc: null,
  p_no3_rt: null,
  p_nh4_rt: null,
  p_p_rt: null,
  p_k_rt: null,
  p_mg_rt: null,
  p_ca_rt: null,
  p_ne: null,
  p_s_rt: null,
  p_s_wc: null,
  p_cu_rt: null,
  p_zn_rt: null,
  p_na_rt: null,
  p_si_rt: null,
  p_b_rt: null,
  p_mn_rt: null,
  p_ni_rt: null,
  p_fe_rt: null,
  p_mo_rt: null,
  p_co_rt: null,
  p_as_rt: null,
  p_cd_rt: null,
  p_cr_rt: null,
  p_cr_vi: null,
  p_pb_rt: null,
  p_hg_rt: null,
  p_cl_rt: null,
  p_ef_nh3: null,
  p_type: "manure",
  p_type_rvo: null,
}

const baseFertilizer = {
  ...baseCatalogue,
  p_id: "fert-1",
  p_date_acquiring: new Date("2024-02-01"),
  p_picking_date: new Date("2024-02-02T00:00:00Z"),
  p_app_amount: 100,
}

describe("GET /farms/:b_id_farm/fertilizers", () => {
  beforeEach(validKey)

  it("returns 200 with paginated fertilizers", async () => {
    const app = makeApp({
      getFertilizers: vi.fn().mockResolvedValue([baseFertilizer]),
    })
    const res = await app.request("/farms/farm-1/fertilizers", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data[0].p_id).toBe("fert-1")
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getFertilizers: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/fertilizers", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("POST /farms/:b_id_farm/fertilizers", () => {
  beforeEach(validKey)

  it("returns 201 with the created fertilizer", async () => {
    const app = makeApp({
      addFertilizer: vi.fn().mockResolvedValue("fert-new"),
      getFertilizer: vi.fn().mockResolvedValue({ ...baseFertilizer, p_id: "fert-new" }),
    })
    const res = await app.request("/farms/farm-1/fertilizers", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_id_catalogue: "cat-1",
        p_acquiring_amount: 100,
        p_acquiring_date: "2024-02-01",
      }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).p_id).toBe("fert-new")
  })

  it("returns 415 without Content-Type: application/json", async () => {
    const app = makeApp()
    const res = await app.request("/farms/farm-1/fertilizers", {
      method: "POST",
      headers: { "x-api-key": "valid" },
      body: "{}",
    })
    expect(res.status).toBe(415)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      addFertilizer: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/fertilizers", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_id_catalogue: "cat-1",
        p_acquiring_amount: 100,
        p_acquiring_date: "2024-02-01",
      }),
    })
    expect(res.status).toBe(403)
  })
})

describe("GET /fertilizers/:p_id", () => {
  beforeEach(validKey)

  it("returns 200 with the fertilizer", async () => {
    const app = makeApp({
      getFertilizer: vi.fn().mockResolvedValue(baseFertilizer),
    })
    const res = await app.request("/fertilizers/fert-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    expect((await res.json()).p_date_acquiring).toBe("2024-02-01")
  })

  it("returns 404 when the fertilizer does not exist", async () => {
    const app = makeApp({
      getFertilizer: vi.fn().mockResolvedValue({ ...baseFertilizer, p_id: undefined }),
    })
    const res = await app.request("/fertilizers/missing", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 403 when the caller lacks permission", async () => {
    const app = makeApp({
      getFertilizer: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fertilizers/fert-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("DELETE /fertilizers/:p_id", () => {
  beforeEach(validKey)

  it("returns 204 on success", async () => {
    const app = makeApp({
      removeFertilizer: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/fertilizers/fert-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(204)
  })

  it("returns 403 when the caller lacks permission", async () => {
    const app = makeApp({
      removeFertilizer: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fertilizers/fert-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("POST /farms/:b_id_farm/fertilizers/custom", () => {
  beforeEach(() => vi.clearAllMocks())

  const customFertilizer = { ...baseFertilizer, p_source: "farm-1", p_type_rvo: "11" }

  function services() {
    return {
      getFertilizers: vi.fn().mockResolvedValue([{ p_type_rvo: "11", p_type: "manure" }]),
      addFertilizerToCatalogue: vi.fn().mockResolvedValue("cat-custom"),
      addFertilizer: vi.fn().mockResolvedValue("p-custom"),
      getFertilizer: vi.fn().mockResolvedValue({ ...customFertilizer, p_id: "p-custom" }),
    }
  }

  it("creates and acquires a custom fertilizer", async () => {
    validKey()
    const s = services()
    const app = makeApp(s)
    const res = await app.request("/farms/farm-1/fertilizers/custom", {
      method: "POST",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({
        p_name_nl: "Eigen drijfmest",
        p_type_rvo: "11",
        p_n_rt: 4.2,
        p_acquiring_amount: 1000,
        p_acquiring_date: "2026-03-01",
      }),
    })
    expect(res.status).toBe(201)
    expect(res.headers.get("location")).toContain("/fertilizers/p-custom")
    const properties = s.addFertilizerToCatalogue.mock.calls[0]?.[3]
    expect(properties).toMatchObject({
      p_name_nl: "Eigen drijfmest",
      p_n_rt: 4.2,
      p_p_rt: null,
      p_type: "manure",
      p_app_amount_unit: "kg/ha",
    })
    expect(s.addFertilizer).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "cat-custom",
      "farm-1",
      1000,
      new Date("2026-03-01"),
    )
  })

  it("uses the given p_type and unit", async () => {
    validKey()
    const s = services()
    const app = makeApp(s)
    await app.request("/farms/farm-1/fertilizers/custom", {
      method: "POST",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({
        p_name_nl: "Kunstmest",
        p_type: "mineral",
        p_app_amount_unit: "l/ha",
      }),
    })
    expect(s.getFertilizers).not.toHaveBeenCalled()
    expect(s.addFertilizerToCatalogue.mock.calls[0]?.[3]).toMatchObject({
      p_type: "mineral",
      p_app_amount_unit: "l/ha",
    })
  })

  it("returns 400 without a name", async () => {
    validKey()
    const app = makeApp(services())
    const res = await app.request("/farms/farm-1/fertilizers/custom", {
      method: "POST",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({ p_n_rt: 4 }),
    })
    expect(res.status).toBe(400)
    expect(res.headers.get("content-type")).toContain("application/problem+json")
  })

  it("returns 403 without write access", async () => {
    validKey()
    const s = services()
    s.addFertilizerToCatalogue.mockRejectedValue(new Error("Permission denied"))
    const app = makeApp(s)
    const res = await app.request("/farms/farm-1/fertilizers/custom", {
      method: "POST",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({ p_name_nl: "X" }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 401 without an API key", async () => {
    const app = makeApp(services())
    const res = await app.request("/farms/farm-1/fertilizers/custom", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p_name_nl: "X" }),
    })
    expect(res.status).toBe(401)
  })
})

describe("PATCH /fertilizers/:p_id", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates a custom fertilizer", async () => {
    validKey()
    const getFertilizer = vi
      .fn()
      .mockResolvedValueOnce({ ...baseFertilizer, p_id: "p-1", p_source: "farm-1" })
      .mockResolvedValueOnce({ ...baseFertilizer, p_id: "p-1", p_source: "farm-1", p_n_rt: 5 })
    const updateFertilizerFromCatalogue = vi.fn().mockResolvedValue(undefined)
    const app = makeApp({ getFertilizer, updateFertilizerFromCatalogue })
    const res = await app.request("/fertilizers/p-1", {
      method: "PATCH",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({ p_n_rt: 5 }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).p_n_rt).toBe(5)
    expect(updateFertilizerFromCatalogue).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "farm-1",
      "cat-1",
      { p_n_rt: 5 },
    )
  })

  it("returns 422 for a fertilizer from a standard catalogue", async () => {
    validKey()
    const getFertilizer = vi
      .fn()
      .mockResolvedValue({ ...baseFertilizer, p_id: "p-1", p_source: "baat" })
    const updateFertilizerFromCatalogue = vi.fn()
    const app = makeApp({ getFertilizer, updateFertilizerFromCatalogue })
    const res = await app.request("/fertilizers/p-1", {
      method: "PATCH",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({ p_n_rt: 5 }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).type).toContain("unprocessable-entity")
    expect(updateFertilizerFromCatalogue).not.toHaveBeenCalled()
  })

  it("returns 404 for a missing fertilizer", async () => {
    validKey()
    const app = makeApp({ getFertilizer: vi.fn().mockResolvedValue(undefined) })
    const res = await app.request("/fertilizers/missing", {
      method: "PATCH",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({ p_n_rt: 5 }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 400 for an empty body", async () => {
    validKey()
    const app = makeApp({ getFertilizer: vi.fn() })
    const res = await app.request("/fertilizers/p-1", {
      method: "PATCH",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe("Fertilizer mutations — edge cases", () => {
  beforeEach(validKey)

  it("POST returns 500 when the acquired fertilizer cannot be retrieved", async () => {
    const app = makeApp({
      addFertilizer: vi.fn().mockResolvedValue("fert-new"),
      getFertilizer: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/farms/farm-1/fertilizers", {
      method: "POST",
      headers: { "x-api-key": "valid", "content-type": "application/json" },
      body: JSON.stringify({ p_id_catalogue: "cat-1" }),
    })
    expect(res.status).toBe(500)
    expect((await res.json()).type).toMatch(/\/problems\/internal-error$/)
  })

  it("the updateCustomFertilizer input requires at least one property besides p_id", () => {
    expect(updateCustomFertilizer.input.safeParse({ p_id: "p-1" }).success).toBe(false)
    expect(updateCustomFertilizer.input.safeParse({ p_id: "p-1", p_n_rt: 5 }).success).toBe(true)
  })
})
