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

const baseCultivation = {
  b_lu: "cult-1",
  b_lu_catalogue: "cat-001",
  b_lu_source: "BRP",
  b_lu_name: "Wintergraan",
  b_lu_name_en: "Winter cereal",
  b_lu_hcat3: "GRAIN",
  b_lu_hcat3_name: "Granen",
  b_lu_croprotation: true,
  b_lu_eom: 0.5,
  b_lu_eom_residue: 0.1,
  b_lu_harvestcat: "MAIN",
  b_lu_harvestable: true,
  b_lu_variety: null,
  b_lu_start: new Date("2023-10-01"),
  b_lu_end: new Date("2024-07-01T00:00:00Z"),
  m_cropresidue: false,
  b_id: "field-1",
}

// ---------------------------------------------------------------------------
// GET /fields/:b_id/cultivations
// ---------------------------------------------------------------------------
describe("GET /fields/:b_id/cultivations", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with paginated cultivation list", async () => {
    const app = makeApp({
      getCultivations: vi.fn().mockResolvedValue([baseCultivation]),
    })
    const res = await app.request("/fields/field-1/cultivations", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].b_lu).toBe("cult-1")
    expect(body.total).toBe(1)
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getCultivations: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fields/field-1/cultivations", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })

  it("serialises dates as YYYY-MM-DD strings", async () => {
    const app = makeApp({
      getCultivations: vi.fn().mockResolvedValue([baseCultivation]),
    })
    const res = await app.request("/fields/field-1/cultivations", {
      headers: { "x-api-key": "valid" },
    })
    const body = await res.json()
    expect(body.data[0].b_lu_start).toBe("2023-10-01")
    expect(body.data[0].b_lu_end).toBe("2024-07-01")
  })
})

// ---------------------------------------------------------------------------
// POST /fields/:b_id/cultivations
// ---------------------------------------------------------------------------
describe("POST /fields/:b_id/cultivations", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 201 with the created cultivation", async () => {
    const app = makeApp({
      addCultivation: vi.fn().mockResolvedValue("cult-new"),
      getCultivation: vi.fn().mockResolvedValue({ ...baseCultivation, b_lu: "cult-new" }),
    })
    const res = await app.request("/fields/field-1/cultivations", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        b_lu_catalogue: "cat-001",
        b_lu_start: "2023-10-01",
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.b_lu).toBe("cult-new")
    expect(res.headers.get("location")).toContain("/cultivations/cult-new")
  })

  it("returns 415 without Content-Type: application/json", async () => {
    const app = makeApp()
    const res = await app.request("/fields/field-1/cultivations", {
      method: "POST",
      headers: { "x-api-key": "valid" },
      body: "{}",
    })
    expect(res.status).toBe(415)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      addCultivation: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fields/field-1/cultivations", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        b_lu_catalogue: "cat-001",
        b_lu_start: "2023-10-01",
      }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 400 when required fields are missing", async () => {
    const app = makeApp()
    const res = await app.request("/fields/field-1/cultivations", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_lu_start: "2023-10-01" }), // missing b_lu_catalogue
    })
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// GET /cultivations/:b_lu
// ---------------------------------------------------------------------------
describe("GET /cultivations/:b_lu", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with the cultivation", async () => {
    const app = makeApp({
      getCultivation: vi.fn().mockResolvedValue(baseCultivation),
    })
    const res = await app.request("/cultivations/cult-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.b_lu).toBe("cult-1")
    expect(body.b_lu_name).toBe("Wintergraan")
  })

  it("returns 404 when cultivation does not exist", async () => {
    const app = makeApp({
      getCultivation: vi.fn().mockResolvedValue({ ...baseCultivation, b_lu: undefined }),
    })
    const res = await app.request("/cultivations/missing", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getCultivation: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/cultivations/cult-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// DELETE /cultivations/:b_lu
// ---------------------------------------------------------------------------
describe("DELETE /cultivations/:b_lu", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 204 on success", async () => {
    const app = makeApp({
      removeCultivation: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/cultivations/cult-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(204)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      removeCultivation: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/cultivations/cult-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /farms/:b_id_farm/cultivations
// ---------------------------------------------------------------------------
describe("GET /farms/:b_id_farm/cultivations", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with paginated cultivation list", async () => {
    const app = makeApp({
      getCultivationsForFarm: vi.fn().mockResolvedValue(new Map([["field-1", [baseCultivation]]])),
    })
    const res = await app.request("/farms/farm-1/cultivations", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data[0].b_lu).toBe("cult-1")
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getCultivationsForFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/cultivations", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// PATCH /cultivations/:b_lu
// ---------------------------------------------------------------------------
describe("PATCH /cultivations/:b_lu", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with the updated cultivation", async () => {
    const app = makeApp({
      updateCultivation: vi.fn().mockResolvedValue(undefined),
      getCultivation: vi.fn().mockResolvedValue({ ...baseCultivation, m_cropresidue: true }),
    })
    const res = await app.request("/cultivations/cult-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ m_cropresidue: true }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).m_cropresidue).toBe(true)
  })

  it("returns 400 when the body is empty", async () => {
    const app = makeApp()
    const res = await app.request("/cultivations/cult-1", {
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
      updateCultivation: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/cultivations/cult-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ m_cropresidue: true }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 400 when b_lu_start is moved after the persisted b_lu_end", async () => {
    // Persisted end is 2024-07-01; new start 2024-12-01 is after it.
    const app = makeApp({
      getCultivation: vi.fn().mockResolvedValue(baseCultivation),
      updateCultivation: vi.fn(),
    })
    const res = await app.request("/cultivations/cult-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_lu_start: "2024-12-01" }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.detail).toContain("b_lu_start must not be after b_lu_end")
  })

  it("returns 200 when b_lu_start is moved but the persisted b_lu_end is null", async () => {
    // No end date persisted — any start is valid.
    const app = makeApp({
      getCultivation: vi.fn().mockResolvedValue({ ...baseCultivation, b_lu_end: null }),
      updateCultivation: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/cultivations/cult-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_lu_start: "2099-01-01" }),
    })
    expect(res.status).toBe(200)
  })

  it("does not trigger start-after-end check when b_lu_end is explicitly nulled", async () => {
    // Both b_lu_start and b_lu_end=null provided — end is being cleared, no conflict possible.
    const getCultivation = vi.fn().mockResolvedValue({ ...baseCultivation, m_cropresidue: false })
    const app = makeApp({
      getCultivation,
      updateCultivation: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/cultivations/cult-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_lu_start: "2024-12-01", b_lu_end: null }),
    })
    expect(res.status).toBe(200)
  })
})
