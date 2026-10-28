import { FdmType } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFdmApi, FdmApiServices } from "../index"
import { CatalogueServices } from "../routes/catalogues"

// ---------------------------------------------------------------------------
// Shared test setup
// ---------------------------------------------------------------------------
const mockAuth = {
  api: { verifyApiKey: vi.fn() },
} as any

const mockFdm = {
  transaction<T>(handler: (tx: FdmType) => Promise<T>) {
    return handler(this)
  },
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any

function mockServices() {
  return {
    getCultivationsFromCatalogues: vi.fn(),
    getFertilizersFromCatalogues: vi.fn(),
    getMeasuresFromCatalogue: vi.fn(),
    enableCultivationCatalogue: vi.fn(),
    enableFertilizerCatalogue: vi.fn(),
    enableMeasureCatalogue: vi.fn(),
    getEnabledCultivationCatalogues: vi.fn(),
    getEnabledFertilizerCatalogues: vi.fn(),
    getEnabledMeasureCatalogues: vi.fn(),
  } satisfies CatalogueServices
}
type MockServices = ReturnType<typeof mockServices>

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

describe("Catalogues - unauthenticated", () => {
  it("returns 401 for GET /catalogues without key", async () => {
    const app = makeApp()
    const res = await app.request(`/catalogues`)
    expect(res.status).toBe(401)
  })

  it("returns 401 for GET /farms/{b_id_farm}/catalogues/cultivation/items?source={source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/items?source=brp`)
    expect(res.status).toBe(401)
  })

  it("returns 401 for GET /farms/{b_id_farm}/catalogues/fertilizer/items?source={source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/items?source=baat`)
    expect(res.status).toBe(401)
  })

  it("returns 401 for GET /farms/{b_id_farm}/catalogues/measure/items?source={source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/measure/items?source=bln`)
    expect(res.status).toBe(401)
  })
})

describe("Catalogues - list available catalogues", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 200 for GET /catalogues", async () => {
    const app = makeApp()
    const res = await app.request(`/catalogues`, { headers: { "x-api-key": "valid-key" } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(
      expect.objectContaining({
        cultivation: expect.anything(),
        fertilizer: expect.anything(),
        measure: expect.anything(),
      }),
    )
  })
})

describe("Catalogues - list farm catalogues", () => {
  let services: MockServices
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    services = mockServices()
    app = makeApp(services)
    validKey()
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/cultivation", async () => {
    services.getEnabledCultivationCatalogues.mockResolvedValueOnce(["brp"])
    const res = await app.request(`/farms/farm-1/catalogues/cultivation`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(["brp"])
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/fertilizer", async () => {
    services.getEnabledFertilizerCatalogues.mockResolvedValueOnce(["baat", "farm-1"])
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(["baat", "farm-1"])
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/measure", async () => {
    services.getEnabledMeasureCatalogues.mockResolvedValueOnce(["bln"])
    const res = await app.request(`/farms/farm-1/catalogues/measure`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(["bln"])
  })
})

describe("Catalogues - list catalogue items", () => {
  let services: MockServices
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    services = mockServices()
    app = makeApp(services)
    validKey()
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/cultivation/items without source", async () => {
    const brp = [{ b_lu_catalogue: "nl_test" }]
    services.getEnabledCultivationCatalogues.mockResolvedValueOnce(["brp"])
    services.getCultivationsFromCatalogues.mockResolvedValueOnce(brp)
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/items`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ data: brp, limit: 50, offset: 0, total: 1 })
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/cultivation/items?source={source}", async () => {
    const brp = [{ b_lu_catalogue: "nl_test" }]
    services.getEnabledCultivationCatalogues.mockResolvedValueOnce(["brp"])
    services.getCultivationsFromCatalogues.mockResolvedValueOnce(brp)
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/items?source=brp`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ data: brp, limit: 50, offset: 0, total: 1 })
  })

  it("applies limit and offset for GET /farms/{b_id_farm}/catalogues/cultivation/items?source={source}", async () => {
    const brp = [{ b_lu_catalogue: "a" }, { b_lu_catalogue: "b" }, { b_lu_catalogue: "c" }]
    services.getEnabledCultivationCatalogues.mockResolvedValueOnce(["brp"])
    services.getCultivationsFromCatalogues.mockResolvedValueOnce(brp)
    const res = await app.request(
      `/farms/farm-1/catalogues/cultivation/items?source=brp&limit=1&offset=1`,
      {
        headers: { "x-api-key": "valid-key" },
      },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ data: [brp[1]], limit: 1, offset: 1, total: 3 })
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/fertilizer/items without source", async () => {
    const baat = [{ p_id_catalogue: "BAAT001" }]
    services.getEnabledFertilizerCatalogues.mockResolvedValueOnce(["baat", "farm-1"])
    services.getFertilizersFromCatalogues.mockResolvedValueOnce(baat)
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/items`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ data: baat, limit: 50, offset: 0, total: 1 })
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/fertilizer/items?source={source}", async () => {
    const baat = [{ p_id_catalogue: "BAAT001" }]
    services.getEnabledFertilizerCatalogues.mockResolvedValueOnce(["baat", "farm-1"])
    services.getFertilizersFromCatalogues.mockResolvedValueOnce(baat)
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/items?source=baat`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ data: baat, limit: 50, offset: 0, total: 1 })
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/measure/items without source", async () => {
    const bln = [{ m_id: "bln_BM100", m_source: "bln" }]
    services.getEnabledMeasureCatalogues.mockResolvedValueOnce(["bln"])
    services.getMeasuresFromCatalogue.mockResolvedValueOnce(bln)
    const res = await app.request(`/farms/farm-1/catalogues/measure/items`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ data: bln, limit: 50, offset: 0, total: 1 })
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/measure/items?source=bln", async () => {
    const bln = [{ m_id: "bln_BM100", m_source: "bln" }]
    services.getEnabledMeasureCatalogues.mockResolvedValueOnce(["bln"])
    services.getMeasuresFromCatalogue.mockResolvedValueOnce(bln)
    const res = await app.request(`/farms/farm-1/catalogues/measure/items?source=bln`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ data: bln, limit: 50, offset: 0, total: 1 })
  })

  it("returns no measures for GET /farms/{b_id_farm}/catalogues/measure/items?source=anlb", async () => {
    services.getEnabledMeasureCatalogues.mockResolvedValueOnce(["anlb"])
    services.getMeasuresFromCatalogue.mockResolvedValueOnce([])
    const res = await app.request(`/farms/farm-1/catalogues/measure/items?source=anlb`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ data: [], limit: 50, offset: 0, total: 0 })
    expect(services.getMeasuresFromCatalogue).not.toHaveBeenCalled()
  })

  it("returns 404 for GET /farms/{b_id_farm}/catalogues/cultivation/items?source={source}", async () => {
    const brp = [{ b_lu_catalogue: "nl_test" }]
    services.getEnabledCultivationCatalogues.mockResolvedValueOnce([])
    services.getCultivationsFromCatalogues.mockResolvedValueOnce(brp)
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/items?source=brp`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 404 for GET /farms/{b_id_farm}/catalogues/fertilizer/items?source={source}", async () => {
    const baat = [{ p_id_catalogue: "BAAT001" }]
    services.getEnabledFertilizerCatalogues.mockResolvedValueOnce(["farm-1"])
    services.getFertilizersFromCatalogues.mockResolvedValueOnce(baat)
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/items?source=baat`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 404 for GET /farms/{b_id_farm}/catalogues/measure/items?source=bln", async () => {
    const bln = [{ m_id: "bln_BM100" }]
    services.getEnabledMeasureCatalogues.mockResolvedValueOnce([])
    services.getMeasuresFromCatalogue.mockResolvedValueOnce(bln)
    const res = await app.request(`/farms/farm-1/catalogues/measure/items?source=bln`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(404)
  })
})
