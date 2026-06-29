import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"

// ---------------------------------------------------------------------------
// Shared test setup
// ---------------------------------------------------------------------------
const mockAuth = {
  api: {
    verifyApiKey: vi.fn(),
  },
} as any

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
    key: {
      id: "key-1",
      referenceId: "user-1",
      name: "Test key",
    },
  })
}

function invalidKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: false,
    error: { message: "Invalid API key" },
    key: null,
  })
}

function makeApp(services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, services)
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
describe("API authentication", () => {
  it("returns 401 when no API key is provided", async () => {
    const app = makeApp()
    const res = await app.request("/farms")
    expect(res.status).toBe(401)
    expect(res.headers.get("content-type")).toContain("application/problem+json")
    const body = await res.json()
    expect(body.status).toBe(401)
    expect(body.type).toContain("/problems/unauthorized")
  })

  it("returns 401 when API key is invalid", async () => {
    invalidKey()
    const app = makeApp()
    const res = await app.request("/farms", {
      headers: { "x-api-key": "bad-key" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 when both X-API-Key and Authorization are provided", async () => {
    const app = makeApp()
    const res = await app.request("/farms", {
      headers: {
        "x-api-key": "some-key",
        authorization: "Bearer some-key",
      },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.type).toContain("ambiguous-api-key")
  })

  it("returns 200 when authenticated via Bearer token", async () => {
    validKey()
    const app = makeApp({ getFarms: vi.fn().mockResolvedValue([]) })
    const res = await app.request("/farms", {
      headers: { authorization: "Bearer valid-key" },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// GET /farms
// ---------------------------------------------------------------------------
describe("GET /farms", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with paginated farm list", async () => {
    const mockFarms = [
      {
        b_id_farm: "farm-1",
        b_name_farm: "Farm One",
        b_businessid_farm: null,
        b_address_farm: null,
        b_postalcode_farm: null,
        roles: [],
      },
      {
        b_id_farm: "farm-2",
        b_name_farm: "Farm Two",
        b_businessid_farm: null,
        b_address_farm: null,
        b_postalcode_farm: null,
        roles: [],
      },
    ]
    const app = makeApp({ getFarms: vi.fn().mockResolvedValue(mockFarms) })
    const res = await app.request("/farms", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.limit).toBe(50)
    expect(body.offset).toBe(0)
    expect(body.data[0].b_id_farm).toBe("farm-1")
  })

  it("applies pagination with limit and offset", async () => {
    const mockFarms = Array.from({ length: 10 }, (_, i) => ({
      b_id_farm: `farm-${i}`,
      b_name_farm: `Farm ${i}`,
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
      roles: [],
    }))
    const app = makeApp({ getFarms: vi.fn().mockResolvedValue(mockFarms) })
    const res = await app.request("/farms?limit=3&offset=2", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
    expect(body.data[0].b_id_farm).toBe("farm-2")
    expect(body.total).toBe(10)
  })

  it("returns 403 when principal has no farm access", async () => {
    const permErr = new Error("Permission denied")
    const app = makeApp({ getFarms: vi.fn().mockRejectedValue(permErr) })
    const res = await app.request("/farms", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.type).toContain("forbidden")
  })

  it("returns 403 for wrapped permission error", async () => {
    const wrapped = new Error("Principal does not have permission to perform this action")
    const app = makeApp({ getFarms: vi.fn().mockRejectedValue(wrapped) })
    const res = await app.request("/farms", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })

  it("response shape uses FDM-native field names", async () => {
    const farm = {
      b_id_farm: "f1",
      b_name_farm: "Boerderij",
      b_businessid_farm: "BN01",
      b_address_farm: "Straat 1",
      b_postalcode_farm: "1234AB",
      roles: [],
    }
    const app = makeApp({ getFarms: vi.fn().mockResolvedValue([farm]) })
    const res = await app.request("/farms", {
      headers: { "x-api-key": "valid" },
    })
    const body = await res.json()
    const item = body.data[0]
    expect(item).toHaveProperty("b_id_farm")
    expect(item).toHaveProperty("b_name_farm")
    expect(item).toHaveProperty("b_businessid_farm")
    expect(item).toHaveProperty("b_address_farm")
    expect(item).toHaveProperty("b_postalcode_farm")
    // Must NOT have roles (internal field)
    expect(item).not.toHaveProperty("roles")
  })
})

// ---------------------------------------------------------------------------
// GET /farms/:b_id_farm
// ---------------------------------------------------------------------------
describe("GET /farms/:b_id_farm", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with the farm", async () => {
    const farm = {
      b_id_farm: "farm-1",
      b_name_farm: "My Farm",
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
      b_id_principal: "user-1",
      b_id_principal_owner: "user-1",
      roles: [],
    }
    const app = makeApp({ getFarm: vi.fn().mockResolvedValue(farm) })
    const res = await app.request("/farms/farm-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.b_id_farm).toBe("farm-1")
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-x", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })

  it("returns 404 when farm does not exist", async () => {
    const app = makeApp({
      getFarm: vi.fn().mockResolvedValue({
        b_id_principal: "u",
        b_id_principal_owner: "u",
        roles: [],
      }),
    })
    const res = await app.request("/farms/missing", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// POST /farms
// ---------------------------------------------------------------------------
describe("POST /farms", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 201 with the created farm", async () => {
    const newFarm = {
      b_id_farm: "farm-new",
      b_name_farm: "New Farm",
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
      roles: [],
    }
    const app = makeApp({
      addFarm: vi.fn().mockResolvedValue("farm-new"),
      getFarm: vi.fn().mockResolvedValue(newFarm),
    })
    const res = await app.request("/farms", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_name_farm: "New Farm" }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.b_id_farm).toBe("farm-new")
    expect(body.b_name_farm).toBe("New Farm")
    expect(res.headers.get("location")).toContain("/farms/farm-new")
  })

  it("returns 400 with invalid JSON body", async () => {
    const app = makeApp()
    const res = await app.request("/farms", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: "{ not valid json }",
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.type).toContain("validation-failed")
    expect(body.detail).toContain("invalid JSON")
  })

  it("returns 400 when b_name_farm is null", async () => {
    const app = makeApp()
    const res = await app.request("/farms", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_name_farm: null }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.type).toContain("validation-failed")
  })

  it("returns 415 without Content-Type: application/json", async () => {
    const app = makeApp()
    const res = await app.request("/farms", {
      method: "POST",
      headers: { "x-api-key": "valid" },
      body: "{}",
    })
    expect(res.status).toBe(415)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      addFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_name_farm: "Farm" }),
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// PATCH /farms/:b_id_farm
// ---------------------------------------------------------------------------
describe("PATCH /farms/:b_id_farm", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 with the updated farm", async () => {
    const existing = {
      b_id_farm: "farm-1",
      b_name_farm: "Old",
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
      roles: [],
    }
    const updated = {
      b_id_farm: "farm-1",
      b_name_farm: "New",
      b_businessid_farm: null,
      b_address_farm: null,
      b_postalcode_farm: null,
    }
    const app = makeApp({
      getFarm: vi.fn().mockResolvedValue(existing),
      updateFarm: vi.fn().mockResolvedValue(updated),
    })
    const res = await app.request("/farms/farm-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_name_farm: "New" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.b_name_farm).toBe("New")
  })

  it("returns 400 when body is empty", async () => {
    const app = makeApp({ getFarm: vi.fn(), updateFarm: vi.fn() })
    const res = await app.request("/farms/farm-1", {
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

  it("returns 404 when farm not found", async () => {
    const app = makeApp({
      getFarm: vi.fn().mockResolvedValue({ b_id_principal: "u", roles: [] }),
      updateFarm: vi.fn(),
    })
    const res = await app.request("/farms/missing", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_name_farm: "X" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      getFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
      updateFarm: vi.fn(),
    })
    const res = await app.request("/farms/farm-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ b_name_farm: "X" }),
    })
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// DELETE /farms/:b_id_farm
// ---------------------------------------------------------------------------
describe("DELETE /farms/:b_id_farm", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 204 on success", async () => {
    const app = makeApp({
      removeFarm: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/farms/farm-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(204)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      removeFarm: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})
