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

/** Mimics fdm-core: the range error wrapped by `handleError` as the `cause`. */
function outOfRangeError() {
  const cause = new Error("Applied amount must be greater than 0 and at most 100000 kg/ha")
  cause.name = "AppAmountOutOfRangeError"
  return new Error("Exception for addFertilizerApplication", { cause })
}

const baseApplication = {
  p_id: "fert-1",
  p_id_catalogue: "cat-1",
  p_name_nl: "Drijfmest",
  p_app_amount: 40,
  p_app_amount_unit: "m3/ha",
  p_app_amount_display: 40,
  p_app_method: "injecteren",
  p_app_date: new Date("2024-03-01"),
  p_app_id: "app-1",
}

describe("GET /fields/:b_id/fertilizer-applications", () => {
  beforeEach(validKey)

  it("returns 200 with paginated fertilizer applications", async () => {
    const app = makeApp({
      getFertilizerApplications: vi.fn().mockResolvedValue([baseApplication]),
    })
    const res = await app.request("/fields/field-1/fertilizer-applications", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data[0].p_app_id).toBe("app-1")
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getFertilizerApplications: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fields/field-1/fertilizer-applications", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("POST /fields/:b_id/fertilizer-applications", () => {
  beforeEach(validKey)

  it("returns 201 with the created fertilizer application", async () => {
    const app = makeApp({
      addFertilizerApplication: vi.fn().mockResolvedValue("app-new"),
      getFertilizerApplication: vi
        .fn()
        .mockResolvedValue({ ...baseApplication, p_app_id: "app-new" }),
    })
    const res = await app.request("/fields/field-1/fertilizer-applications", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_id: "fert-1",
        p_app_amount_display: 40,
        p_app_method: "injecteren",
        p_app_date: "2024-03-01",
      }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).p_app_id).toBe("app-new")
  })

  it("returns 415 without Content-Type: application/json", async () => {
    const app = makeApp()
    const res = await app.request("/fields/field-1/fertilizer-applications", {
      method: "POST",
      headers: { "x-api-key": "valid" },
      body: "{}",
    })
    expect(res.status).toBe(415)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      addFertilizerApplication: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fields/field-1/fertilizer-applications", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_id: "fert-1",
        p_app_amount_display: 40,
        p_app_method: "injecteren",
        p_app_date: "2024-03-01",
      }),
    })
    expect(res.status).toBe(403)
  })

  it.each([0, -5])("returns 400 for an amount of %s", async (amount) => {
    const addFertilizerApplication = vi.fn()
    const app = makeApp({ addFertilizerApplication })
    const res = await app.request("/fields/field-1/fertilizer-applications", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_id: "fert-1",
        p_app_amount_display: amount,
        p_app_method: "injecteren",
        p_app_date: "2024-03-01",
      }),
    })
    expect(res.status).toBe(400)
    expect(addFertilizerApplication).not.toHaveBeenCalled()
  })

  it("returns 422 when the amount converts to more than 100,000 kg/ha", async () => {
    const app = makeApp({
      addFertilizerApplication: vi.fn().mockRejectedValue(outOfRangeError()),
    })
    const res = await app.request("/fields/field-1/fertilizer-applications", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_id: "fert-1",
        p_app_amount_display: 200,
        p_app_method: "injecteren",
        p_app_date: "2024-03-01",
      }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.type).toBe("https://test.example.com/problems/unprocessable-entity")
  })
})

describe("GET /fertilizer-applications/:p_app_id", () => {
  beforeEach(validKey)

  it("returns 200 with the fertilizer application", async () => {
    const app = makeApp({
      getFertilizerApplication: vi.fn().mockResolvedValue(baseApplication),
    })
    const res = await app.request("/fertilizer-applications/app-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
    expect((await res.json()).p_app_date).toBe("2024-03-01")
  })

  it("returns 404 when the fertilizer application does not exist", async () => {
    const app = makeApp({
      getFertilizerApplication: vi.fn().mockResolvedValue(null),
    })
    const res = await app.request("/fertilizer-applications/missing", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 403 when principal lacks access", async () => {
    const app = makeApp({
      getFertilizerApplication: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fertilizer-applications/app-1", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("PATCH /fertilizer-applications/:p_app_id", () => {
  beforeEach(validKey)

  it("returns 200 with the updated fertilizer application", async () => {
    const app = makeApp({
      getFertilizerApplication: vi
        .fn()
        .mockResolvedValueOnce(baseApplication)
        .mockResolvedValueOnce({
          ...baseApplication,
          p_app_amount_display: 45,
          p_app_amount: 45,
        }),
      updateFertilizerApplication: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/fertilizer-applications/app-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_app_amount_display: 45 }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).p_app_amount_display).toBe(45)
  })

  it("returns 400 when the body is empty", async () => {
    const app = makeApp()
    const res = await app.request("/fertilizer-applications/app-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 when the fertilizer application does not exist", async () => {
    const app = makeApp({
      getFertilizerApplication: vi.fn().mockResolvedValue(null),
    })
    const res = await app.request("/fertilizer-applications/missing", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_app_amount_display: 45 }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      getFertilizerApplication: vi.fn().mockResolvedValue(baseApplication),
      updateFertilizerApplication: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fertilizer-applications/app-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_app_amount_display: 45 }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 422 when the amount is out of range after conversion", async () => {
    const app = makeApp({
      getFertilizerApplication: vi.fn().mockResolvedValue(baseApplication),
      updateFertilizerApplication: vi.fn().mockRejectedValue(outOfRangeError()),
    })
    const res = await app.request("/fertilizer-applications/app-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_app_amount_display: 5000 }),
    })
    expect(res.status).toBe(422)
    expect(res.headers.get("content-type")).toContain("application/problem+json")
  })

  it("keeps the stored amount when only the date changes", async () => {
    const updateFertilizerApplication = vi.fn().mockResolvedValue(undefined)
    const app = makeApp({
      getFertilizerApplication: vi.fn().mockResolvedValue(baseApplication),
      updateFertilizerApplication,
    })
    const res = await app.request("/fertilizer-applications/app-1", {
      method: "PATCH",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_app_date: "2024-04-01" }),
    })
    expect(res.status).toBe(200)
    expect(updateFertilizerApplication.mock.calls[0][4]).toBeNull()
  })
})

describe("DELETE /fertilizer-applications/:p_app_id", () => {
  beforeEach(validKey)

  it("returns 204 on success", async () => {
    const app = makeApp({
      removeFertilizerApplication: vi.fn().mockResolvedValue(undefined),
    })
    const res = await app.request("/fertilizer-applications/app-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(204)
  })

  it("returns 403 when principal lacks permission", async () => {
    const app = makeApp({
      removeFertilizerApplication: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fertilizer-applications/app-1", {
      method: "DELETE",
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(403)
  })
})
