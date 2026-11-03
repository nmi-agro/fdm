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

const square = {
  type: "Polygon",
  coordinates: [
    [
      [5.0, 52.0],
      [5.001, 52.0],
      [5.001, 52.001],
      [5.0, 52.001],
      [5.0, 52.0],
    ],
  ],
}

const newRemote = {
  status: "NEW_REMOTE",
  rvoField: {
    type: "Feature",
    geometry: square,
    properties: {
      CropFieldID: "rvo-1",
      CropFieldVersion: "1",
      CropFieldDesignator: "Nieuw perceel",
      BeginDate: "2026-01-01",
      Country: "NL",
      CropTypeCode: "265",
      UseTitleCode: "01",
      mestData: { IndBufferstrook: "N" },
    },
  },
  diffs: [],
}

const newLocal = {
  status: "NEW_LOCAL",
  localField: {
    b_id: "b-1",
    b_name: "Oud perceel",
    b_geometry: square,
    b_area: 0.8,
    b_start: new Date("2020-01-01"),
    b_end: null,
    b_acquiring_method: "nl_01",
    b_bufferstrip: false,
  },
  diffs: [],
}

function setup(overrides: Partial<FdmApiServices> = {}) {
  const services = {
    reviewShapefileImport: vi
      .fn()
      .mockResolvedValue({ valid: true, items: [newRemote, newLocal], review_hash: "hash-1" }),
    applyRvoImport: vi.fn().mockResolvedValue({
      created: [{ b_id: "b-new", b_geometry: square }],
      updated: [],
      closed: [],
      removed: [],
    }),
    addSoilParameterEstimatesToField: vi.fn().mockResolvedValue("a-1"),
    getNmiApiKey: () => "key",
    ...overrides,
  }
  return { app: createFdmApi(mockFdm, mockAuth, config, services as any), services }
}

function shapefileForm(extra: Record<string, string> = {}) {
  const form = new FormData()
  for (const ext of ["shp", "shx", "dbf", "prj"]) {
    form.append(ext, new Blob([new Uint8Array([1, 2, 3])]), `export.${ext}`)
  }
  form.append("year", "2026")
  for (const [key, value] of Object.entries(extra)) form.append(key, value)
  return form
}

describe("POST /farms/:b_id_farm/fields/import/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("returns the review items with their allowed actions", async () => {
    const { app, services } = setup()
    const res = await app.request("/farms/farm-1/fields/import/compare", {
      method: "POST",
      headers,
      body: shapefileForm(),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.review_hash).toBe("hash-1")
    expect(body.items[0]).toMatchObject({
      item_id: "rvo-1",
      status: "NEW_REMOTE",
      allowed_actions: ["ADD_REMOTE", "IGNORE"],
      local_field: null,
      remote_field: {
        b_id_source: "rvo-1",
        b_name: "Nieuw perceel",
        b_lu_catalogue: "nl_265",
        b_start: "2026-01-01",
        b_acquiring_method: "nl_01",
      },
    })
    expect(body.items[1]).toMatchObject({
      item_id: "b-1",
      status: "NEW_LOCAL",
      local_field: { b_id: "b-1", b_name: "Oud perceel" },
      remote_field: null,
    })
    expect(services.reviewShapefileImport.mock.calls[0]?.[4]).toBe(2026)
  })

  it("returns 422 with the suggested year", async () => {
    const { app } = setup({
      reviewShapefileImport: vi.fn().mockResolvedValue({ valid: false, suggestedYear: 2027 }),
    })
    const res = await app.request("/farms/farm-1/fields/import/compare", {
      method: "POST",
      headers,
      body: shapefileForm(),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).suggested_year).toBe(2027)
  })

  it("returns 400 when a file is missing", async () => {
    const { app } = setup()
    const form = new FormData()
    form.append("shp", new Blob([new Uint8Array([1])]), "export.shp")
    form.append("year", "2026")
    const res = await app.request("/farms/farm-1/fields/import/compare", {
      method: "POST",
      headers,
      body: form,
    })
    expect(res.status).toBe(400)
  })

  it("returns 403 without access to the farm", async () => {
    const { app } = setup({
      reviewShapefileImport: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farms/farm-1/fields/import/compare", {
      method: "POST",
      headers,
      body: shapefileForm(),
    })
    expect(res.status).toBe(403)
  })
})

describe("POST /farms/:b_id_farm/fields/import/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  const apply = (app: ReturnType<typeof setup>["app"], extra: Record<string, string>) =>
    app.request("/farms/farm-1/fields/import/apply", {
      method: "POST",
      headers,
      body: shapefileForm(extra),
    })

  it("applies the choices, including per-field values, and adds soil estimates", async () => {
    const { app, services } = setup()
    const res = await apply(app, {
      review_hash: "hash-1",
      choices: JSON.stringify({
        "rvo-1": {
          action: "ADD_REMOTE",
          values: { b_name: "Achter de schuur", b_bufferstrip: true },
        },
        "b-1": { action: "REMOVE_LOCAL" },
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: ["b-new"], updated: [], closed: [], removed: [] })
    const plan = services.applyRvoImport.mock.calls[0]?.[3]
    expect(plan.fieldsToAdd[0]).toMatchObject({
      b_name: "Achter de schuur",
      b_bufferstrip: true,
      b_lu_catalogue: "nl_265",
    })
    expect(plan.fieldsToRemove).toEqual(["b-1"])
    expect(services.addSoilParameterEstimatesToField).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "b-new",
      square,
      "key",
    )
  })

  it("uses default_action for items without a choice", async () => {
    const { app, services } = setup()
    await apply(app, { default_action: "ADD_REMOTE" })
    const plan = services.applyRvoImport.mock.calls[0]?.[3]
    expect(plan.fieldsToAdd).toHaveLength(1)
    expect(plan.fieldsToRemove).toEqual([])
  })

  it("returns 409 with the new review when the farm changed", async () => {
    const { app, services } = setup()
    const res = await apply(app, { review_hash: "old-hash", choices: "{}" })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.review.review_hash).toBe("hash-1")
    expect(services.applyRvoImport).not.toHaveBeenCalled()
  })

  it("returns 409 for a choice on an item that no longer exists", async () => {
    const { app } = setup()
    const res = await apply(app, { choices: JSON.stringify({ gone: { action: "IGNORE" } }) })
    expect(res.status).toBe(409)
    expect((await res.json()).item_ids).toEqual(["gone"])
  })

  it("returns 422 for an action that does not fit the status", async () => {
    const { app, services } = setup()
    const res = await apply(app, {
      choices: JSON.stringify({ "b-1": { action: "UPDATE_FROM_REMOTE" } }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).item_ids).toEqual(["b-1"])
    expect(services.applyRvoImport).not.toHaveBeenCalled()
  })

  it("returns 400 for choices that are not JSON", async () => {
    const { app } = setup()
    const res = await apply(app, { choices: "not json" })
    expect(res.status).toBe(400)
  })

  it("returns 401 without an API key", async () => {
    const { app } = setup()
    const res = await app.request("/farms/farm-1/fields/import/apply", {
      method: "POST",
      body: shapefileForm(),
    })
    expect(res.status).toBe(401)
  })
})
