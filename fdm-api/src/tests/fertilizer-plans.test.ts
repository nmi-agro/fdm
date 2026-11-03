import { createMemoryStorage } from "@nmi-agro/fdm-storage"
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

const plan = {
  p_id_plan: "plan-1",
  b_id_farm: "farm-1",
  p_plan_year: 2026,
  p_plan_file_path: "bemestingsplan/plan-1.pdf",
  p_plan_hash: "hash",
  p_plan_date: new Date("2026-02-01T10:00:00Z"),
}

function setup(overrides: Partial<FdmApiServices> = {}, withStorage = true) {
  const storage = createMemoryStorage()
  const statusChecker = vi.fn().mockResolvedValue("fresh")
  const services = {
    getFertilizerPlans: vi.fn().mockResolvedValue([plan]),
    getFertilizerPlan: vi.fn().mockResolvedValue(plan),
    establishFertilizerPlan: vi.fn().mockResolvedValue("plan-1"),
    removeFertilizerPlanWithFile: vi.fn().mockResolvedValue(undefined),
    createFertilizerPlanStatusChecker: vi.fn().mockReturnValue(statusChecker),
    getNmiApiKey: () => "key",
    ...(withStorage ? {} : { getStorage: () => undefined }),
    ...overrides,
  }
  const app = createFdmApi(
    mockFdm,
    mockAuth,
    { ...config, ...(withStorage ? { storage } : {}), reportBranding: { name: "Test App" } },
    services as any,
  )
  return { app, storage, services, statusChecker }
}

describe("fertilizer plans", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("lists the plans of a farm with their status", async () => {
    const { app, services } = setup()
    const res = await app.request("/farms/farm-1/fertilizer-plans?year=2026", { headers })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        p_id_plan: "plan-1",
        b_id_farm: "farm-1",
        p_plan_year: 2026,
        p_plan_date: "2026-02-01",
        status: "fresh",
      },
    ])
    expect(services.getFertilizerPlans).toHaveBeenCalledWith(mockFdm, "user-1", "farm-1", 2026)
  })

  it("generates a plan with the storage, NMI key and branding", async () => {
    const { app, services, storage } = setup()
    const res = await app.request("/farms/farm-1/fertilizer-plans", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    })
    expect(res.status).toBe(201)
    expect(res.headers.get("location")).toContain("/fertilizer-plans/plan-1")
    expect(services.establishFertilizerPlan).toHaveBeenCalledWith({
      fdm: mockFdm,
      principal_id: "user-1",
      b_id_farm: "farm-1",
      year: 2026,
      storage,
      nmiApiKey: "key",
      branding: { name: "Test App" },
    })
  })

  it("returns 503 when generating without storage", async () => {
    const { app, services } = setup({}, false)
    const res = await app.request("/farms/farm-1/fertilizer-plans", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    })
    expect(res.status).toBe(503)
    expect(services.establishFertilizerPlan).not.toHaveBeenCalled()
  })

  it("returns 400 without a year", async () => {
    const { app } = setup()
    const res = await app.request("/farms/farm-1/fertilizer-plans", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("returns 403 without write access", async () => {
    const { app } = setup({
      establishFertilizerPlan: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/fertilizer-plans", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    })
    expect(res.status).toBe(403)
  })

  it("returns a plan with an expired status", async () => {
    const { app, statusChecker } = setup()
    statusChecker.mockResolvedValue("expired")
    const res = await app.request("/fertilizer-plans/plan-1", { headers })
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe("expired")
  })

  it("downloads the PDF", async () => {
    const { app, storage } = setup()
    await storage.upload(plan.p_plan_file_path, Buffer.from("%PDF-1.7"), "application/pdf")
    const res = await app.request("/fertilizer-plans/plan-1/pdf", { headers })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(await res.text()).toBe("%PDF-1.7")
  })

  it("returns 404 when the PDF file is missing", async () => {
    const { app } = setup()
    const res = await app.request("/fertilizer-plans/plan-1/pdf", { headers })
    expect(res.status).toBe(404)
  })

  it("deletes a plan and its PDF", async () => {
    const { app, services, storage } = setup()
    const res = await app.request("/fertilizer-plans/plan-1", { method: "DELETE", headers })
    expect(res.status).toBe(204)
    expect(services.removeFertilizerPlanWithFile).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      plan,
      storage,
    )
  })

  it("returns 404 for an unknown plan", async () => {
    const { app } = setup({
      getFertilizerPlan: vi.fn().mockRejectedValue(
        new Error("Exception for getFertilizerPlan", {
          cause: new Error("Fertilizer plan not found"),
        }),
      ),
    })
    const res = await app.request("/fertilizer-plans/missing", { headers })
    expect(res.status).toBe(404)
  })

  it("returns 500 when the PDF cannot be downloaded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const app = createFdmApi(mockFdm, mockAuth, config, {
      getStorage: () => ({
        ...createMemoryStorage(),
        download: vi.fn().mockRejectedValue(new Error("storage down")),
      }),
      getFertilizerPlan: vi.fn().mockResolvedValue(plan),
    } as any)
    const res = await app.request("/fertilizer-plans/plan-1/pdf", { headers })
    expect(res.status).toBe(500)
  })

  it("logs a PDF that could not be deleted, and returns 503 without storage", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { app } = setup({
      removeFertilizerPlanWithFile: vi.fn().mockResolvedValue(new Error("storage down")),
    })
    const res = await app.request("/fertilizer-plans/plan-1", { method: "DELETE", headers })
    expect(res.status).toBe(204)
    expect(warn).toHaveBeenCalled()

    const withoutStorage = setup({}, false)
    const res2 = await withoutStorage.app.request("/fertilizer-plans/plan-1", {
      method: "DELETE",
      headers,
    })
    expect(res2.status).toBe(503)
    expect(withoutStorage.services.removeFertilizerPlanWithFile).not.toHaveBeenCalled()
  })

  it("returns 403 when the plan is not accessible", async () => {
    const { app } = setup({
      getFertilizerPlan: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/fertilizer-plans/plan-1", { headers })
    expect(res.status).toBe(403)
  })

  it("returns 401 without an API key", async () => {
    const { app } = setup()
    const res = await app.request("/fertilizer-plans/plan-1")
    expect(res.status).toBe(401)
  })
})

describe("report branding and file storage from the configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  const generate = (app: ReturnType<typeof createFdmApi>) =>
    app.request("/farms/farm-1/fertilizer-plans", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    })

  it("uses a branding function, or the app name without branding", async () => {
    const establishFertilizerPlan = vi.fn().mockResolvedValue("plan-1")
    const services = {
      establishFertilizerPlan,
      getFertilizerPlan: vi.fn().mockResolvedValue(plan),
      getNmiApiKey: () => "key",
    } as any
    const storage = createMemoryStorage()
    const withFunction = createFdmApi(
      mockFdm,
      mockAuth,
      { ...config, storage, reportBranding: async () => ({ name: "Merk" }) },
      services,
    )
    expect((await generate(withFunction)).status).toBe(201)
    expect(establishFertilizerPlan.mock.calls[0]?.[0].branding).toEqual({ name: "Merk" })

    const withoutBranding = createFdmApi(mockFdm, mockAuth, { ...config, storage }, services)
    expect((await generate(withoutBranding)).status).toBe(201)
    expect(establishFertilizerPlan.mock.calls[1]?.[0].branding).toEqual({ name: "Test App" })
  })

  it("uses Google Cloud Storage only when a bucket is configured", async () => {
    const establishFertilizerPlan = vi.fn().mockResolvedValue("plan-1")
    const services = {
      establishFertilizerPlan,
      getFertilizerPlan: vi.fn().mockResolvedValue(plan),
      getNmiApiKey: () => "key",
    } as any
    try {
      vi.stubEnv("GCS_BUCKET_NAME", "")
      const withoutBucket = createFdmApi(mockFdm, mockAuth, config, services)
      expect((await generate(withoutBucket)).status).toBe(503)

      vi.stubEnv("GCS_BUCKET_NAME", "test-bucket")
      const withBucket = createFdmApi(mockFdm, mockAuth, config, services)
      expect((await generate(withBucket)).status).toBe(201)
      expect(establishFertilizerPlan.mock.calls[0]?.[0].storage).toMatchObject({
        upload: expect.any(Function),
        download: expect.any(Function),
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
