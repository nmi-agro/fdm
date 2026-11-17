import { SoilReaderError } from "@nmi-agro/fdm-calculator"
import { createMemoryStorage } from "@nmi-agro/fdm-storage"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"

const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
const mockFdm: any = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockFdm)),
}
const config = { appName: "Test App", appUrl: "https://test.example.com" }
const headers = { "x-api-key": "valid" }
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n")

function validKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
  })
}

const square = {
  type: "Polygon",
  coordinates: [
    [
      [5.39, 52.19],
      [5.41, 52.19],
      [5.41, 52.21],
      [5.39, 52.21],
      [5.39, 52.19],
    ],
  ],
}

const fields = [
  { b_id: "f-1", b_name: "Achter de schuur", b_start: null, b_end: null, b_geometry: square },
  { b_id: "f-2", b_name: "Voor", b_start: null, b_end: null, b_geometry: null },
]

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
    getFields: vi.fn().mockResolvedValue(fields),
    extractSoilAnalysesFromPdfs: vi.fn().mockResolvedValue([extracted]),
    addSoilAnalysis: vi.fn().mockResolvedValue("a-1"),
    getSoilAnalysis: vi.fn().mockResolvedValue(savedAnalysis),
    ...overrides,
  }
  const app = createFdmApi(mockFdm, mockAuth, { ...config, storage }, services as any)
  return { app, storage, services }
}

function pdfForm(files: Uint8Array[], extra: Record<string, string> = {}) {
  const form = new FormData()
  files.forEach((bytes, index) => form.append("files", new Blob([bytes]), `report-${index}.pdf`))
  for (const [key, value] of Object.entries(extra)) form.append(key, value)
  return form
}

const analysis = (overrides: Record<string, unknown> = {}) => ({
  file_index: 0,
  b_id: "f-1",
  a_date: "2026-03-20",
  a_source: "nl-rva-l122",
  a_depth_lower: 30,
  b_sampling_date: "2026-03-15",
  a_som_loi: 3.4,
  ...overrides,
})

describe("POST /farms/:b_id_farm/soil-analyses/import/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  const compare = (app: ReturnType<typeof setup>["app"], files: Uint8Array[]) =>
    app.request("/farms/farm-1/soil-analyses/import/compare", {
      method: "POST",
      headers,
      body: pdfForm(files),
    })

  it("reads the reports and suggests the field of each analysis, without saving", async () => {
    const { app, storage, services } = setup()
    const res = await compare(app, [PDF, PDF])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.items[0]).toMatchObject({
      item_id: "0.0",
      file_index: 0,
      filename: "report-0.pdf",
      suggested_b_id: "f-1",
      match_reason: "location-and-name",
      a_source: "nl-rva-l122",
      a_som_loi: 3.4,
      b_soiltype_agr: "dekzand",
      b_sampling_date: "2026-03-15",
    })
    expect(body.items[1].item_id).toBe("1.0")
    expect(storage.keys()).toEqual([])
    expect(services.extractSoilAnalysesFromPdfs).toHaveBeenCalledTimes(2)
  })

  it("rejects a file that is not a PDF with 415", async () => {
    const { app, services } = setup()
    const res = await compare(app, [new Uint8Array([1, 2, 3])])
    expect(res.status).toBe(415)
    expect(services.extractSoilAnalysesFromPdfs).not.toHaveBeenCalled()
  })

  it("does not read the reports without access to the farm", async () => {
    const { app, services } = setup({
      getFields: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await compare(app, [PDF])
    expect(res.status).toBe(403)
    expect(services.extractSoilAnalysesFromPdfs).not.toHaveBeenCalled()
  })

  it("returns 502 when the reading service fails, without its details", async () => {
    const { app } = setup({
      extractSoilAnalysesFromPdfs: vi.fn().mockRejectedValue(new SoilReaderError("down", 500)),
    })
    const res = await compare(app, [PDF])
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain("down")
  })

  it("returns 503 without an NMI API key", async () => {
    const { app } = setup({ getNmiApiKey: () => undefined })
    const res = await compare(app, [PDF])
    expect(res.status).toBe(503)
  })

  it("returns 413 for a report above 5 MB", async () => {
    const { app } = setup()
    const big = new Uint8Array(5 * 1024 * 1024 + 10)
    big.set(PDF)
    const res = await compare(app, [big])
    expect(res.status).toBe(413)
  })

  it("returns 500 when reading fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { app } = setup({
      extractSoilAnalysesFromPdfs: vi.fn().mockRejectedValue(new Error("boom")),
    })
    const res = await compare(app, [PDF])
    expect(res.status).toBe(500)
  })

  it("returns 400 without files", async () => {
    const { app } = setup()
    const res = await app.request("/farms/farm-1/soil-analyses/import/compare", {
      method: "POST",
      headers,
      body: new FormData(),
    })
    expect(res.status).toBe(400)
  })
})

describe("POST /farms/:b_id_farm/soil-analyses/import/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  const apply = (app: ReturnType<typeof setup>["app"], analyses: unknown, files = [PDF]) =>
    app.request("/farms/farm-1/soil-analyses/import/apply", {
      method: "POST",
      headers,
      body: pdfForm(files, { analyses: JSON.stringify(analyses) }),
    })

  it("saves each analysis with its own copy of the report, in one transaction", async () => {
    const addSoilAnalysis = vi.fn().mockResolvedValueOnce("a-1").mockResolvedValueOnce("a-2")
    const { app, storage, services } = setup({ addSoilAnalysis })
    const res = await apply(app, [analysis(), analysis({ b_id: "f-2", a_som_loi: 2.1 })])
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      created: [
        { a_id: "a-1", b_id: "f-1", file_index: 0 },
        { a_id: "a-2", b_id: "f-2", file_index: 0 },
      ],
    })
    expect(mockFdm.transaction).toHaveBeenCalledTimes(1)
    const paths = storage.keys()
    expect(paths).toHaveLength(2)
    expect(addSoilAnalysis.mock.calls[0]?.[7]).toMatchObject({
      a_som_loi: 3.4,
      a_file_path: paths[0],
    })
    expect(addSoilAnalysis.mock.calls[1]?.[7]).toMatchObject({
      a_som_loi: 2.1,
      a_file_path: paths[1],
    })
    expect(services.extractSoilAnalysesFromPdfs).not.toHaveBeenCalled()
  })

  it("removes the stored reports when saving fails", async () => {
    const { app, storage } = setup({
      addSoilAnalysis: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await apply(app, [analysis()])
    expect(res.status).toBe(403)
    expect(storage.keys()).toEqual([])
  })

  it("rejects a field that is not part of the farm", async () => {
    const { app, services } = setup()
    const res = await apply(app, [analysis({ b_id: "other-farm-field" })])
    expect(res.status).toBe(422)
    expect(services.addSoilAnalysis).not.toHaveBeenCalled()
  })

  it("rejects a file_index without a file", async () => {
    const { app } = setup()
    const res = await apply(app, [analysis({ file_index: 3 })])
    expect(res.status).toBe(422)
  })

  it("returns 400 for analyses that are not valid", async () => {
    const { app } = setup()
    const res = await apply(app, [{ file_index: 0, b_id: "f-1" }])
    expect(res.status).toBe(400)
  })

  it("accepts one analyses field per analysis, as a JSON object", async () => {
    const addSoilAnalysis = vi.fn().mockResolvedValueOnce("a-1").mockResolvedValueOnce("a-2")
    const { app } = setup({ addSoilAnalysis })
    const form = pdfForm([PDF])
    form.append("analyses", JSON.stringify(analysis()))
    form.append("analyses", JSON.stringify(analysis({ b_id: "f-2" })))
    const res = await app.request("/farms/farm-1/soil-analyses/import/apply", {
      method: "POST",
      headers,
      body: form,
    })
    expect(res.status).toBe(201)
    expect((await res.json()).created).toHaveLength(2)
  })

  it("accepts an item of the compare step with b_id and a_date added", async () => {
    const { app, services } = setup()
    const compareItem = {
      item_id: "0.0",
      file_index: 0,
      filename: "report-0.pdf",
      suggested_b_id: "f-1",
      match_reason: "location",
      name_conflict_b_id: null,
      b_name: "Achter de schuur",
      a_source: "nl-rva-l122",
      b_sampling_date: "2026-03-15",
      a_depth_upper: 0,
      a_depth_lower: 30,
      a_som_loi: 3.4,
      a_clay_mi: null,
      b_sampling_geometry: null,
      b_sampling_geometry_zone: null,
    }
    const res = await apply(app, [{ ...compareItem, b_id: "f-1", a_date: "2026-03-20" }])
    expect(res.status).toBe(201)
    expect(services.addSoilAnalysis).toHaveBeenCalledTimes(1)
  })

  it("lists the missing fields of an analysis", async () => {
    const { app } = setup()
    const res = await apply(app, [{ file_index: 0, a_source: "nl-rva-l122" }])
    expect(res.status).toBe(400)
    const paths = (await res.json()).errors.map((issue: { path: unknown[] }) =>
      issue.path.join("."),
    )
    expect(paths).toEqual(expect.arrayContaining(["0.b_id", "0.a_date"]))
  })

  it("returns 400 when analyses is not JSON", async () => {
    const { app } = setup()
    const res = await app.request("/farms/farm-1/soil-analyses/import/apply", {
      method: "POST",
      headers,
      body: pdfForm([PDF], { analyses: "{not json" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 503 without file storage", async () => {
    const app = createFdmApi(mockFdm, mockAuth, config, {
      getStorage: () => undefined,
      getFields: vi.fn().mockResolvedValue(fields),
    } as any)
    const res = await apply(app, [analysis()])
    expect(res.status).toBe(503)
  })

  it("links each analysis to the report of its file_index", async () => {
    const addSoilAnalysis = vi.fn().mockResolvedValueOnce("a-1").mockResolvedValueOnce("a-2")
    const { app, storage } = setup({ addSoilAnalysis })
    const res = await apply(app, [analysis(), analysis({ file_index: 1, b_id: "f-2" })], [PDF, PDF])
    expect(res.status).toBe(201)
    expect(storage.keys()).toHaveLength(2)
  })

  it("returns 401 without an API key", async () => {
    const { app } = setup()
    const res = await app.request("/farms/farm-1/soil-analyses/import/apply", {
      method: "POST",
      body: pdfForm([PDF], { analyses: "[]" }),
    })
    expect(res.status).toBe(401)
  })
})

describe("the lab report of a soil analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("is deleted with the analysis, together with its photos", async () => {
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

  it("can be downloaded", async () => {
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

  it("returns 404 for an unknown analysis or a missing file, and 503 without storage", async () => {
    const unknown = setup({ getSoilAnalysis: vi.fn().mockResolvedValue(undefined) })
    expect((await unknown.app.request("/soil-analyses/x/document", { headers })).status).toBe(404)

    const missing = setup({
      getSoilAnalysis: vi
        .fn()
        .mockResolvedValue({ ...savedAnalysis, a_file_path: "soil_analysis/a-1.pdf" }),
    })
    expect((await missing.app.request("/soil-analyses/a-1/document", { headers })).status).toBe(404)

    const noStorage = createFdmApi(mockFdm, mockAuth, config, {
      getStorage: () => undefined,
    } as any)
    expect((await noStorage.request("/soil-analyses/a-1/document", { headers })).status).toBe(503)
  })

  it("returns 500 when the report cannot be downloaded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const app = createFdmApi(mockFdm, mockAuth, config, {
      getStorage: () => ({
        ...createMemoryStorage(),
        download: vi.fn().mockRejectedValue(new Error("storage down")),
      }),
      getSoilAnalysis: vi
        .fn()
        .mockResolvedValue({ ...savedAnalysis, a_file_path: "soil_analysis/a-1.pdf" }),
    } as any)
    const res = await app.request("/soil-analyses/a-1/document", { headers })
    expect(res.status).toBe(500)
  })

  it("is still deleted when a file cannot be removed, or without storage", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const removeSoilAnalysis = vi.fn().mockResolvedValue(undefined)
    const base = {
      getSoilAnalysis: vi
        .fn()
        .mockResolvedValue({ ...savedAnalysis, a_file_path: "soil_analysis/a-1.pdf" }),
      getSoilImages: vi.fn().mockResolvedValue([]),
      removeSoilAnalysis,
    }
    const failing = createFdmApi(mockFdm, mockAuth, config, {
      ...base,
      getStorage: () => ({
        ...createMemoryStorage(),
        delete: vi.fn().mockRejectedValue(new Error("storage down")),
      }),
    } as any)
    expect(
      (await failing.request("/soil-analyses/a-1", { method: "DELETE", headers })).status,
    ).toBe(204)
    expect(warn).toHaveBeenCalled()

    const noStorage = createFdmApi(mockFdm, mockAuth, config, {
      ...base,
      getStorage: () => undefined,
    } as any)
    expect(
      (await noStorage.request("/soil-analyses/a-1", { method: "DELETE", headers })).status,
    ).toBe(204)
    expect(removeSoilAnalysis).toHaveBeenCalledTimes(2)
  })

  it("is reported as has_document on the analysis", async () => {
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
