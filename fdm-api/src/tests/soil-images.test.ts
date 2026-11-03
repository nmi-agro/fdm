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

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
])

function validKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
  })
}

const annotation = {
  a_id_annotation: "an-1",
  a_id_image: "img-1",
  a_image_annotation_type: "pin",
  a_image_annotation_coordinates: JSON.stringify({ x: 10, y: 20 }),
  a_image_annotation: "Regenworm",
  a_image_annotation_bcs: "a_ew_bcs",
  a_image_annotation_order: 0,
}

const image = {
  a_id_image: "img-1",
  b_id_sampling: "s-1",
  a_image_path: "soil_image/img-1.png",
  a_image_type: "profile",
  a_image_order: 0,
  a_image_caption: "Profiel",
  annotations: [annotation],
}

function setup(overrides: Partial<FdmApiServices> = {}) {
  const storage = createMemoryStorage()
  const services = {
    getSoilAnalysis: vi.fn().mockResolvedValue({ a_id: "a-1", b_id_sampling: "s-1" }),
    getSoilImages: vi.fn().mockResolvedValue([image]),
    getSoilImage: vi.fn().mockResolvedValue(image),
    addSoilImage: vi.fn(async (_fdm, _p, _s, input, onUpload) => {
      await onUpload?.(input.a_image_path)
      return "img-1"
    }),
    removeSoilImage: vi.fn(async (_fdm, _p, _id, onDelete) => {
      await onDelete?.(image.a_image_path)
    }),
    addSoilImageAnnotation: vi.fn().mockResolvedValue("an-1"),
    getSoilImageAnnotation: vi.fn().mockResolvedValue(annotation),
    updateSoilImageAnnotation: vi.fn().mockResolvedValue(undefined),
    removeSoilImageAnnotation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  const app = createFdmApi(mockFdm, mockAuth, { ...config, storage }, services as any)
  return { app, storage, services }
}

function uploadForm(bytes: Uint8Array, extra: Record<string, string> = {}) {
  const form = new FormData()
  form.append("file", new Blob([bytes]), "photo.png")
  for (const [key, value] of Object.entries(extra)) form.append(key, value)
  return form
}

describe("soil images", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("lists the photos of a soil analysis with parsed annotation coordinates", async () => {
    const { app } = setup()
    const res = await app.request("/soil-analyses/a-1/images", { headers })
    expect(res.status).toBe(200)
    const [first] = await res.json()
    expect(first.a_id_image).toBe("img-1")
    expect(first.annotations[0].a_image_annotation_coordinates).toEqual({ x: 10, y: 20 })
    expect(first).not.toHaveProperty("a_image_path")
  })

  it("returns 404 for an unknown soil analysis", async () => {
    const { app } = setup({ getSoilAnalysis: vi.fn().mockResolvedValue(undefined) })
    const res = await app.request("/soil-analyses/missing/images", { headers })
    expect(res.status).toBe(404)
  })

  it("uploads a photo and stores its file", async () => {
    const { app, storage, services } = setup()
    const res = await app.request("/soil-analyses/a-1/images", {
      method: "POST",
      headers,
      body: uploadForm(PNG, { a_image_type: "roots", a_image_order: "2" }),
    })
    expect(res.status).toBe(201)
    const [key] = storage.keys()
    expect(key).toMatch(/^soil_image\/.+\.png$/)
    expect(services.addSoilImage.mock.calls[0]?.[3]).toMatchObject({
      a_image_path: key,
      a_image_type: "roots",
      a_image_order: 2,
    })
  })

  it("rejects a file that is not an image with 415", async () => {
    const { app, storage } = setup()
    const res = await app.request("/soil-analyses/a-1/images", {
      method: "POST",
      headers,
      body: uploadForm(new TextEncoder().encode("%PDF-1.7 not an image")),
    })
    expect(res.status).toBe(415)
    expect(storage.keys()).toEqual([])
  })

  it("returns 400 without a file", async () => {
    const { app } = setup()
    const form = new FormData()
    form.append("a_image_caption", "zonder foto")
    const res = await app.request("/soil-analyses/a-1/images", {
      method: "POST",
      headers,
      body: form,
    })
    expect(res.status).toBe(400)
  })

  it("returns 503 when no storage is configured", async () => {
    const app = createFdmApi(mockFdm, mockAuth, config, {
      getStorage: () => undefined,
      getSoilAnalysis: vi.fn().mockResolvedValue({ a_id: "a-1", b_id_sampling: "s-1" }),
    })
    const res = await app.request("/soil-analyses/a-1/images", {
      method: "POST",
      headers,
      body: uploadForm(PNG),
    })
    expect(res.status).toBe(503)
  })

  it("downloads the photo file", async () => {
    const { app, storage } = setup()
    await storage.upload(image.a_image_path, Buffer.from(PNG), "image/png")
    const res = await app.request("/soil-images/img-1", { headers })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
  })

  it("returns 404 for an unknown photo", async () => {
    const { app } = setup({ getSoilImage: vi.fn().mockResolvedValue(undefined) })
    const res = await app.request("/soil-images/missing", { headers })
    expect(res.status).toBe(404)
  })

  it("returns 403 without read access to the field", async () => {
    const { app } = setup({
      getSoilImage: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/soil-images/img-1", { headers })
    expect(res.status).toBe(403)
  })

  it("deletes a photo and its file", async () => {
    const { app, storage } = setup()
    await storage.upload(image.a_image_path, Buffer.from(PNG), "image/png")
    const res = await app.request("/soil-images/img-1", { method: "DELETE", headers })
    expect(res.status).toBe(204)
    expect(storage.keys()).toEqual([])
  })

  it("adds an annotation", async () => {
    const { app, services } = setup()
    const res = await app.request("/soil-images/img-1/annotations", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        a_image_annotation_type: "circle",
        a_image_annotation_coordinates: { cx: 50, cy: 50, r: 10 },
        a_image_annotation_bcs: "a_rd_bcs",
      }),
    })
    expect(res.status).toBe(201)
    expect(services.addSoilImageAnnotation.mock.calls[0]?.[3]).toMatchObject({
      a_image_annotation_coordinates: { cx: 50, cy: 50, r: 10 },
    })
  })

  it("rejects coordinates outside the image", async () => {
    const { app } = setup()
    const res = await app.request("/soil-images/img-1/annotations", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        a_image_annotation_type: "pin",
        a_image_annotation_coordinates: { x: 150, y: 20 },
      }),
    })
    expect(res.status).toBe(400)
  })

  it("updates an annotation", async () => {
    const { app, services } = setup()
    const res = await app.request("/soil-image-annotations/an-1", {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ a_image_annotation: "Veel regenwormen" }),
    })
    expect(res.status).toBe(200)
    expect(services.updateSoilImageAnnotation).toHaveBeenCalledWith(mockFdm, "user-1", "an-1", {
      a_image_annotation: "Veel regenwormen",
    })
  })

  it("returns 404 when updating or deleting an unknown annotation", async () => {
    const { app, services } = setup({
      getSoilImageAnnotation: vi.fn().mockResolvedValue(undefined),
    })
    const patch = await app.request("/soil-image-annotations/missing", {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ a_image_annotation: "x" }),
    })
    const del = await app.request("/soil-image-annotations/missing", { method: "DELETE", headers })
    expect(patch.status).toBe(404)
    expect(del.status).toBe(404)
    expect(services.updateSoilImageAnnotation).not.toHaveBeenCalled()
    expect(services.removeSoilImageAnnotation).not.toHaveBeenCalled()
  })

  it("returns 404 when the photo file is missing and 500 on other storage errors", async () => {
    const { app } = setup()
    const missing = await app.request("/soil-images/img-1", { headers })
    expect(missing.status).toBe(404)

    vi.spyOn(console, "error").mockImplementation(() => {})
    const failing = createFdmApi(mockFdm, mockAuth, config, {
      getStorage: () => ({
        ...createMemoryStorage(),
        download: vi.fn().mockRejectedValue(new Error("storage down")),
      }),
      getSoilImage: vi.fn().mockResolvedValue(image),
    } as any)
    const res = await failing.request("/soil-images/img-1", { headers })
    expect(res.status).toBe(500)
  })

  it("deletes a photo even when its file cannot be deleted, or without storage", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const removeSoilImage = vi.fn().mockResolvedValue(undefined)
    const failing = createFdmApi(mockFdm, mockAuth, config, {
      getStorage: () => ({
        ...createMemoryStorage(),
        delete: vi.fn().mockRejectedValue(new Error("storage down")),
      }),
      getSoilImage: vi.fn().mockResolvedValue(image),
      removeSoilImage,
    } as any)
    const res = await failing.request("/soil-images/img-1", { method: "DELETE", headers })
    expect(res.status).toBe(204)
    expect(warn).toHaveBeenCalled()

    const withoutStorage = createFdmApi(mockFdm, mockAuth, config, {
      getStorage: () => undefined,
      getSoilImage: vi.fn().mockResolvedValue(image),
      removeSoilImage,
    } as any)
    const res2 = await withoutStorage.request("/soil-images/img-1", { method: "DELETE", headers })
    expect(res2.status).toBe(204)
    expect(removeSoilImage).toHaveBeenCalledTimes(2)
  })

  it("deletes an annotation", async () => {
    const { app, services } = setup()
    const res = await app.request("/soil-image-annotations/an-1", { method: "DELETE", headers })
    expect(res.status).toBe(204)
    expect(services.removeSoilImageAnnotation).toHaveBeenCalledWith(mockFdm, "user-1", "an-1")
  })

  it("returns stored coordinates as-is, and null when they are not valid JSON", async () => {
    const { app } = setup({
      getSoilImages: vi.fn().mockResolvedValue([
        {
          ...image,
          annotations: [
            { ...annotation, a_image_annotation_coordinates: { x: 1, y: 2 } },
            { ...annotation, a_id_annotation: "an-2", a_image_annotation_coordinates: "{broken" },
          ],
        },
      ]),
    })
    const res = await app.request("/soil-analyses/a-1/images", { headers })
    expect(res.status).toBe(200)
    const [first] = await res.json()
    expect(first.annotations.map((a: any) => a.a_image_annotation_coordinates)).toEqual([
      { x: 1, y: 2 },
      null,
    ])
  })

  it("returns 401 without an API key", async () => {
    const { app } = setup()
    const res = await app.request("/soil-images/img-1")
    expect(res.status).toBe(401)
  })
})
