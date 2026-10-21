import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFdmApi, FdmApiServices } from "../index"
import { CATALOGUE_SOURCES, CatalogueServices } from "../routes/catalogues"

// ---------------------------------------------------------------------------
// Shared test setup
// ---------------------------------------------------------------------------
const mockAuth = {
  api: { verifyApiKey: vi.fn() },
} as any

const mockFdm = {
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
    disableCultivationCatalogue: vi.fn(),
    enableFertilizerCatalogue: vi.fn(),
    disableFertilizerCatalogue: vi.fn(),
    enableMeasureCatalogue: vi.fn(),
    disableMeasureCatalogue: vi.fn(),
    getEnabledCultivationCatalogues: vi.fn(),
    getEnabledFertilizerCatalogues: vi.fn(),
    getEnabledMeasureCatalogues: vi.fn(),
  } satisfies CatalogueServices
}

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

  it("returns 401 for GET /farms/{b_id_farm}/catalogues/cultivation/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`)
    expect(res.status).toBe(401)
  })

  it("returns 401 for GET /farms/{b_id_farm}/catalogues/fertilizer/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`)
    expect(res.status).toBe(401)
  })

  it("returns 401 for GET /farms/{b_id_farm}/catalogues/measure/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`)
    expect(res.status).toBe(401)
  })

  it("returns 401 for POST /farms/{b_id_farm}/catalogues/cultivation/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`, {
      method: "post",
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 for POST /farms/{b_id_farm}/catalogues/fertilizer/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`, {
      method: "post",
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 for POST /farms/{b_id_farm}/catalogues/measure/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`, {
      method: "post",
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 for DELETE /farms/{b_id_farm}/catalogues/cultivation/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`, {
      method: "delete",
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 for DELETE /farms/{b_id_farm}/catalogues/fertilizer/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`, {
      method: "delete",
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 for DELETE /farms/{b_id_farm}/catalogues/measure/{source} without key", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`, {
      method: "delete",
    })
    expect(res.status).toBe(401)
  })
})

describe("Catalogues - bad request", () => {
  beforeEach(() => {
    validKey()
  })

  it("returns 415 for POST /farms/{b_id_farm}/catalogues/cultivation/{source} with media type", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`, {
      method: "post",
      headers: { "Content-Type": "application/json", "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(415)
  })

  it("returns 415 for POST /farms/{b_id_farm}/catalogues/fertilizer/{source} with media type", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`, {
      method: "post",
      headers: { "Content-Type": "application/json", "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(415)
  })

  it("returns 415 for POST /farms/{b_id_farm}/catalogues/measure/{source} with media type", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`, {
      method: "post",
      headers: { "Content-Type": "application/json", "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(415)
  })

  it("returns 415 for DELETE /farms/{b_id_farm}/catalogues/cultivation/{source} with media type", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`, {
      method: "delete",
      headers: { "Content-Type": "application/json", "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(415)
  })

  it("returns 415 for DELETE /farms/{b_id_farm}/catalogues/fertilizer/{source} with media type", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`, {
      method: "delete",
      headers: { "Content-Type": "application/json", "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(415)
  })

  it("returns 415 for DELETE /farms/{b_id_farm}/catalogues/measure/{source} with media type", async () => {
    const app = makeApp()
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`, {
      method: "delete",
      headers: { "Content-Type": "application/json", "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(415)
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
  let services: ReturnType<typeof mockServices>
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
  let services: ReturnType<typeof mockServices>
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    services = mockServices()
    app = makeApp(services)
    validKey()
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/cultivation/{source}", async () => {
    const brp = [{ b_lu_catalogue: "nl_test" }]
    services.getEnabledCultivationCatalogues.mockResolvedValueOnce(["brp"])
    services.getCultivationsFromCatalogues.mockResolvedValueOnce(brp)
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(brp)
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/fertilizer/{source}", async () => {
    const baat = [{ p_id_catalogue: "BAAT001" }]
    services.getEnabledFertilizerCatalogues.mockResolvedValueOnce(["baat", "farm-1"])
    services.getFertilizersFromCatalogues.mockResolvedValueOnce(baat)
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(baat)
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/measure/bln", async () => {
    const bln = [{ m_id: "bln_BM100" }]
    services.getEnabledMeasureCatalogues.mockResolvedValueOnce(["bln"])
    services.getMeasuresFromCatalogue.mockResolvedValueOnce(bln)
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(bln)
  })

  it("returns 200 for GET /farms/{b_id_farm}/catalogues/measure/anlb", async () => {
    const anlb = [{ m_id: "anlb_12a" }]
    services.getEnabledMeasureCatalogues.mockResolvedValueOnce(["anlb"])
    services.getMeasuresFromCatalogue.mockResolvedValueOnce(anlb)
    const res = await app.request(`/farms/farm-1/catalogues/measure/anlb`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it("returns 404 for GET /farms/{b_id_farm}/catalogues/cultivation/{source}", async () => {
    const brp = [{ b_lu_catalogue: "nl_test" }]
    services.getEnabledCultivationCatalogues.mockResolvedValueOnce([])
    services.getCultivationsFromCatalogues.mockResolvedValueOnce(brp)
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 404 for GET /farms/{b_id_farm}/catalogues/fertilizer/{source}", async () => {
    const baat = [{ p_id_catalogue: "BAAT001" }]
    services.getEnabledFertilizerCatalogues.mockResolvedValueOnce(["farm-1"])
    services.getFertilizersFromCatalogues.mockResolvedValueOnce(baat)
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(404)
  })

  it("returns 404 for GET /farms/{b_id_farm}/catalogues/measure/bln", async () => {
    const bln = [{ m_id: "bln_BM100" }]
    services.getEnabledMeasureCatalogues.mockResolvedValueOnce([])
    services.getMeasuresFromCatalogue.mockResolvedValueOnce(bln)
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`, {
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(404)
  })
})

describe("Catalogues - enable", () => {
  let services: CatalogueServices
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    services = mockServices()
    app = makeApp(services)
    validKey()
  })

  it("returns 201 for POST /farms/{b_id_farm}/catalogues/cultivation/{source} with media type", async () => {
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`, {
      method: "post",
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(201)
    expect(services.enableCultivationCatalogue).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "farm-1",
      "brp",
    )
  })

  it("returns 201 for POST /farms/{b_id_farm}/catalogues/fertilizer/{source} with media type", async () => {
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`, {
      method: "post",
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(201)
    expect(services.enableFertilizerCatalogue).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "farm-1",
      "baat",
    )
  })

  it("returns 201 for POST /farms/{b_id_farm}/catalogues/measure/{source} with media type", async () => {
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`, {
      method: "post",
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(201)
    expect(services.enableMeasureCatalogue).toHaveBeenCalledWith(mockFdm, "user-1", "farm-1", "bln")
  })
})

describe("Catalogues - disable", () => {
  let services: CatalogueServices
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    services = mockServices()
    app = makeApp(services)
    validKey()
  })

  it("returns 204 for DELETE /farms/{b_id_farm}/catalogues/cultivation/{source} with media type", async () => {
    const res = await app.request(`/farms/farm-1/catalogues/cultivation/brp`, {
      method: "delete",
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(204)
    expect(services.disableCultivationCatalogue).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "farm-1",
      "brp",
    )
  })

  it("returns 204 for DELETE /farms/{b_id_farm}/catalogues/fertilizer/{source} with media type", async () => {
    const res = await app.request(`/farms/farm-1/catalogues/fertilizer/baat`, {
      method: "delete",
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(204)
    expect(services.disableFertilizerCatalogue).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "farm-1",
      "baat",
    )
  })

  it("returns 204 for DELETE /farms/{b_id_farm}/catalogues/measure/{source} with media type", async () => {
    const res = await app.request(`/farms/farm-1/catalogues/measure/bln`, {
      method: "delete",
      headers: { "x-api-key": "valid-key" },
    })
    expect(res.status).toBe(204)
    expect(services.disableMeasureCatalogue).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "farm-1",
      "bln",
    )
  })
})
