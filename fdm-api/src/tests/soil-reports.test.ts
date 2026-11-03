import { SoilReaderError } from "@nmi-agro/fdm-calculator"
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
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n")
const TOKEN_PATTERN = /^[0-9a-f-]{36}$/

function validKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
  })
}

const extracted = {
  filename: "rapport.pdf",
  b_name: "Achter de schuur",
  a_source: "nl-rva-l122",
  a_som_loi: 3.4,
  b_soil_type: "dekzand",
  b_sampling_date: new Date(2026, 2, 15, 12),
  a_depth_upper: 0,
  a_depth_lower: 30,
  location: { type: "Point", coordinates: [5.4, 52.2] },
  b_sampling_geometry: null,
  b_sampling_geometry_zone: null,
}

const savedAnalysis = {
  a_id: "a-1",
  a_date: new Date("2026-03-20"),
  a_source: "nl-rva-l122",
  b_id_sampling: "s-1",
  a_depth_upper: 0,
  a_depth_lower: 30,
  b_sampling_date: new Date("2026-03-15"),
  a_file_path: null,
}

function setup(overrides: Partial<FdmApiServices> = {}) {
  const storage = createMemoryStorage()
  const services = {
    getNmiApiKey: () => "key",
    extractSoilAnalysesFromPdfs: vi.fn().mockResolvedValue([extracted]),
    addSoilAnalysis: vi.fn().mockResolvedValue("a-1"),
    updateSoilAnalysis: vi.fn().mockResolvedValue(undefined),
    getSoilAnalysis: vi.fn().mockResolvedValue(savedAnalysis),
    ...overrides,
  }
  const app = createFdmApi(mockFdm, mockAuth, { ...config, storage }, services as any)
  return { app, storage, services }
}

function pdfForm(...files: Uint8Array[]) {
  const form = new FormData()
  files.forEach((bytes, index) => form.append("files", new Blob([bytes]), `report-${index}.pdf`))
  return form
}

describe("POST /soil-analyses/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("reads the analyses and keeps each report under an upload token", async () => {
    const { app, storage, services } = setup()
    const res = await app.request("/soil-analyses/extract", {
      method: "POST",
      headers,
      body: pdfForm(PDF, PDF),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      filename: "rapport.pdf",
      b_name: "Achter de schuur",
      a_source: "nl-rva-l122",
      a_som_loi: 3.4,
      b_soiltype_agr: "dekzand",
      b_sampling_date: "2026-03-15",
      a_depth_lower: 30,
      location: [5.4, 52.2],
    })
    expect(body[0].upload_token).toMatch(TOKEN_PATTERN)
    expect(body[0].upload_token).not.toBe(body[1].upload_token)
    expect(storage.keys()).toEqual([
      `soil_analysis/pending/user-1/${body[0].upload_token}.pdf`,
      `soil_analysis/pending/user-1/${body[1].upload_token}.pdf`,
    ])
    expect(services.extractSoilAnalysesFromPdfs).toHaveBeenCalledTimes(2)
  })

  it("gives every analysis of a report its own token and copy of the report", async () => {
    const { app, storage } = setup({
      extractSoilAnalysesFromPdfs: vi.fn().mockResolvedValue([extracted, extracted]),
    })
    const res = await app.request("/soil-analyses/extract", {
      method: "POST",
      headers,
      body: pdfForm(PDF),
    })
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].upload_token).not.toBe(body[1].upload_token)
    expect(storage.keys()).toHaveLength(2)
  })

  it("rejects a file that is not a PDF with 415", async () => {
    const { app, services } = setup()
    const res = await app.request("/soil-analyses/extract", {
      method: "POST",
      headers,
      body: pdfForm(new Uint8Array([1, 2, 3])),
    })
    expect(res.status).toBe(415)
    expect(services.extractSoilAnalysesFromPdfs).not.toHaveBeenCalled()
  })

  it("returns 502 when the reading service fails", async () => {
    const { app } = setup({
      extractSoilAnalysesFromPdfs: vi.fn().mockRejectedValue(new SoilReaderError("down", 500)),
    })
    const res = await app.request("/soil-analyses/extract", {
      method: "POST",
      headers,
      body: pdfForm(PDF),
    })
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain("down")
  })

  it("returns 503 without an NMI API key", async () => {
    const { app } = setup({ getNmiApiKey: () => undefined })
    const res = await app.request("/soil-analyses/extract", {
      method: "POST",
      headers,
      body: pdfForm(PDF),
    })
    expect(res.status).toBe(503)
  })

  it("returns 400 without files", async () => {
    const { app } = setup()
    const res = await app.request("/soil-analyses/extract", {
      method: "POST",
      headers,
      body: new FormData(),
    })
    expect(res.status).toBe(400)
  })
})

describe("linking and downloading the lab report", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  const createBody = (upload_token?: string) =>
    JSON.stringify({
      a_date: "2026-03-20",
      a_source: "nl-rva-l122",
      a_depth_lower: 30,
      b_sampling_date: "2026-03-15",
      a_som_loi: 3.4,
      ...(upload_token ? { upload_token } : {}),
    })

  it("stores the uploaded report with the new analysis", async () => {
    const { app, storage, services } = setup()
    const token = "5f0c8a52-3b9e-4d0e-9a51-2c6f1e7d8b90"
    await storage.upload(
      `soil_analysis/pending/user-1/${token}.pdf`,
      Buffer.from(PDF),
      "application/pdf",
    )

    const res = await app.request("/fields/f-1/soil-analyses", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: createBody(token),
    })
    expect(res.status).toBe(201)
    const [key] = storage.keys()
    expect(key).toMatch(/^soil_analysis\/[0-9a-f-]{36}\.pdf$/)
    // The key of the report is saved with the analysis in one insert.
    expect(services.addSoilAnalysis.mock.calls[0]?.[7]).toMatchObject({ a_file_path: key })

    // The token can be used only once.
    const again = await app.request("/fields/f-1/soil-analyses", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: createBody(token),
    })
    expect(again.status).toBe(422)
  })

  it("removes the claimed report when the analysis cannot be saved", async () => {
    const { app, storage } = setup({
      addSoilAnalysis: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const token = "5f0c8a52-3b9e-4d0e-9a51-2c6f1e7d8b90"
    await storage.upload(
      `soil_analysis/pending/user-1/${token}.pdf`,
      Buffer.from(PDF),
      "application/pdf",
    )
    const res = await app.request("/fields/f-1/soil-analyses", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: createBody(token),
    })
    expect(res.status).toBe(403)
    expect(storage.keys()).toEqual([])
  })

  it("deletes the report and photos of a deleted analysis", async () => {
    const removeSoilAnalysis = vi.fn().mockResolvedValue(undefined)
    const { app, storage } = setup({
      getSoilAnalysis: vi
        .fn()
        .mockResolvedValue({ ...savedAnalysis, a_file_path: "soil_analysis/a-1.pdf" }),
      getSoilImages: vi.fn().mockResolvedValue([{ a_image_path: "soil_image/p-1.jpg" }]),
      removeSoilAnalysis,
    })
    await storage.upload("soil_analysis/a-1.pdf", Buffer.from(PDF), "application/pdf")
    await storage.upload("soil_image/p-1.jpg", Buffer.from("x"), "image/jpeg")
    await storage.upload("soil_image/other.jpg", Buffer.from("x"), "image/jpeg")
    const res = await app.request("/soil-analyses/a-1", { method: "DELETE", headers })
    expect(res.status).toBe(204)
    expect(removeSoilAnalysis).toHaveBeenCalled()
    expect(storage.keys()).toEqual(["soil_image/other.jpg"])
  })

  it("does not create the analysis for an unknown token", async () => {
    const { app, services } = setup()
    const res = await app.request("/fields/f-1/soil-analyses", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: createBody("5f0c8a52-3b9e-4d0e-9a51-2c6f1e7d8b90"),
    })
    expect(res.status).toBe(422)
    expect(services.addSoilAnalysis).not.toHaveBeenCalled()
  })

  it("does not accept a token of another user", async () => {
    const { app, storage, services } = setup()
    const token = "5f0c8a52-3b9e-4d0e-9a51-2c6f1e7d8b90"
    await storage.upload(
      `soil_analysis/pending/user-2/${token}.pdf`,
      Buffer.from(PDF),
      "application/pdf",
    )
    const res = await app.request("/fields/f-1/soil-analyses", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: createBody(token),
    })
    expect(res.status).toBe(422)
    expect(services.addSoilAnalysis).not.toHaveBeenCalled()
  })

  it("downloads the stored report", async () => {
    const { app, storage } = setup({
      getSoilAnalysis: vi
        .fn()
        .mockResolvedValue({ ...savedAnalysis, a_file_path: "soil_analysis/a-1.pdf" }),
    })
    await storage.upload("soil_analysis/a-1.pdf", Buffer.from(PDF), "application/pdf")
    const res = await app.request("/soil-analyses/a-1/document", { headers })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("content-disposition")).toContain("soil-analysis-a-1.pdf")
  })

  it("returns 404 when the analysis has no report", async () => {
    const { app } = setup()
    const res = await app.request("/soil-analyses/a-1/document", { headers })
    expect(res.status).toBe(404)
  })

  it("reports has_document on the analysis", async () => {
    const { app } = setup({
      getSoilAnalysis: vi
        .fn()
        .mockResolvedValue({ ...savedAnalysis, a_file_path: "soil_analysis/a-1.pdf" }),
    })
    const res = await app.request("/soil-analyses/a-1", { headers })
    const body = await res.json()
    expect(body.has_document).toBe(true)
    expect(body).not.toHaveProperty("a_file_path")
  })
})
