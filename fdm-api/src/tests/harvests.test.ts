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

const baseHarvest = {
  b_id_harvesting: "harvest-1",
  b_lu_harvest_date: new Date("2024-08-15"),
  b_lu: "cult-1",
  harvestable: {
    b_id_harvestable: "harvestable-1",
    harvestable_analyses: [
      {
        b_id_harvestable_analysis: "analysis-1",
        b_lu_yield: 12000,
        b_lu_yield_fresh: 15000,
        b_lu_yield_bruto: 15500,
        b_lu_tarra: 3,
        b_lu_dm: 450,
        b_lu_moist: 550,
        b_lu_uww: 320,
        b_lu_cp: 120,
        b_lu_n_harvestable: 15,
        b_lu_n_residue: 5,
        b_lu_p_harvestable: 7,
        b_lu_p_residue: 2,
        b_lu_k_harvestable: 10,
        b_lu_k_residue: 3,
      },
    ],
  },
}

describe("GET /cultivations/:b_lu/harvests", () => {
  beforeEach(validKey)

  it("returns 200 with paginated harvests", async () => {
    const app = makeApp({
      getHarvests: vi.fn().mockResolvedValue([baseHarvest]),
    })
    const res = await app.request("/cultivations/cult-1/harvests", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data[0].b_id_harvesting).toBe("harvest-1")
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getHarvests: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/cultivations/cult-1/harvests", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("POST /cultivations/:b_lu/harvests", () => {
  beforeEach(validKey)

  it("returns 201 with the created harvest", async () => {
    const app = makeApp({
      addHarvest: vi.fn().mockResolvedValue("harvest-new"),
      getHarvest: vi.fn().mockResolvedValue({
        ...baseHarvest,
        b_id_harvesting: "harvest-new",
      }),
    })
    const res = await app.request("/cultivations/cult-1/harvests", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        b_lu_harvest_date: "2024-08-15",
        b_lu_yield: 12000,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.b_id_harvesting).toBe("harvest-new")
    expect(res.headers.get("location")).toContain("/harvests/harvest-new")
  })

  it("returns 415 without Content-Type: application/json", async () => {
    const app = makeApp()
    const res = await app.request("/cultivations/cult-1/harvests", {
      method: "POST",
      headers: { "x-api-key": "valid" },
      body: "{}",
    })
    expect(res.status).toBe(415)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      addHarvest: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/cultivations/cult-1/harvests", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_lu_harvest_date: "2024-08-15" }),
    })
    expect(res.status).toBe(403)
  })
})

describe("GET /harvests/:b_id_harvesting", () => {
  beforeEach(validKey)

  it("returns 200 with the harvest", async () => {
    const app = makeApp({
      getHarvest: vi.fn().mockResolvedValue(baseHarvest),
    })
    const res = await app.request("/harvests/harvest-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.b_lu_harvest_date).toBe("2024-08-15")
  })

  it("returns 404 when the harvest does not exist", async () => {
    const app = makeApp({
      getHarvest: vi.fn().mockResolvedValue({
        ...baseHarvest,
        b_id_harvesting: undefined,
      }),
    })
    const res = await app.request("/harvests/missing", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getHarvest: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/harvests/harvest-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("PATCH /harvests/:b_id_harvesting", () => {
  beforeEach(validKey)

  it("returns 200 with the updated harvest", async () => {
    const app = makeApp({
      updateHarvest: vi.fn().mockResolvedValue(undefined),
      getHarvest: vi.fn().mockResolvedValue({
        ...baseHarvest,
        b_lu_harvest_date: new Date("2024-08-20"),
      }),
    })
    const res = await app.request("/harvests/harvest-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        b_lu_harvest_date: "2024-08-20",
        b_lu_yield: 12500,
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.b_lu_harvest_date).toBe("2024-08-20")
  })

  it("returns 400 when the body is empty", async () => {
    const app = makeApp()
    const res = await app.request("/harvests/harvest-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      updateHarvest: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/harvests/harvest-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_lu_harvest_date: "2024-08-20" }),
    })
    expect(res.status).toBe(403)
  })
})

describe("DELETE /harvests/:b_id_harvesting", () => {
  beforeEach(validKey)

  it("returns 204 on success", async () => {
    const app = makeApp({
      removeHarvest: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/harvests/harvest-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(204)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      removeHarvest: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/harvests/harvest-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("GET /cultivations/:b_lu/harvest-parameters", () => {
  const headers = { "x-api-key": "valid" }
  const cultivation = {
    b_lu: "lu-1",
    b_id: "f1",
    b_lu_catalogue: "nl_2014",
    b_lu_harvestcat: "HC040",
    b_lu_harvestable: "once",
    b_lu_croprotation: "potato",
  }
  const catalogue = [
    { b_lu_catalogue: "nl_2014", b_lu_harvestcat: "HC040", b_lu_yield: 12000, b_lu_dm: 220 },
  ]

  function services(overrides: Record<string, unknown> = {}) {
    return {
      getCultivation: vi.fn().mockResolvedValue(cultivation),
      getField: vi.fn().mockResolvedValue({ b_id: "f1", b_id_farm: "farm-1" }),
      getCultivationsFromCatalogue: vi.fn().mockResolvedValue(catalogue),
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("returns the required parameters and their defaults", async () => {
    const s = services()
    const app = makeApp(s as any)
    const res = await app.request("/cultivations/lu-1/harvest-parameters", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.parameters).toEqual([
      "b_lu_yield_bruto",
      "b_lu_tarra",
      "b_lu_dm",
      "b_lu_n_harvestable",
    ])
    expect(body.defaults.b_lu_tarra).toBe(5)
    // Only required parameters get a default; a value the catalogue lacks is omitted.
    for (const key of Object.keys(body.defaults)) expect(body.parameters).toContain(key)
    expect(body.defaults.b_lu_dm).toBe(220)
    expect(s.getCultivationsFromCatalogue).toHaveBeenCalledWith(mockFdm, "user-1", "farm-1")
  })

  it("allows multiple harvests only for grassland", async () => {
    const app = makeApp(
      services({
        getCultivation: vi.fn().mockResolvedValue({
          ...cultivation,
          b_lu_harvestable: "multiple",
          b_lu_croprotation: "maize",
        }),
      }) as any,
    )
    const res = await app.request("/cultivations/lu-1/harvest-parameters", { headers })
    expect((await res.json()).b_lu_harvestable).toBe("once")
  })

  it("returns no parameters for a crop that is not harvested", async () => {
    const app = makeApp(
      services({
        getCultivation: vi.fn().mockResolvedValue({ ...cultivation, b_lu_harvestable: "none" }),
      }) as any,
    )
    const res = await app.request("/cultivations/lu-1/harvest-parameters", { headers })
    const body = await res.json()
    expect(body.parameters).toEqual([])
    expect(body.defaults).toEqual({})
  })

  it("returns 404 for a missing cultivation", async () => {
    const app = makeApp(services({ getCultivation: vi.fn().mockResolvedValue(undefined) }) as any)
    const res = await app.request("/cultivations/missing/harvest-parameters", { headers })
    expect(res.status).toBe(404)
  })

  it("returns 403 without read access", async () => {
    const app = makeApp(
      services({
        getCultivation: vi.fn().mockRejectedValue(new Error("Permission denied")),
      }) as any,
    )
    const res = await app.request("/cultivations/lu-1/harvest-parameters", { headers })
    expect(res.status).toBe(403)
  })

  it("returns 401 without an API key", async () => {
    const app = makeApp(services() as any)
    const res = await app.request("/cultivations/lu-1/harvest-parameters")
    expect(res.status).toBe(401)
  })
})
