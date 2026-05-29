import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"

const mockAuth = { api: { verifyApiKey: vi.fn() } } as any

const mockFdm = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi
        .fn()
        .mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any

const config = { appName: "Test App", appUrl: "https://test.example.com" }

function validKey() {
    mockAuth.api.verifyApiKey.mockResolvedValue({
        valid: true,
        error: null,
        key: { id: "key-1", referenceId: "user-1", name: "Test key" },
    })
}

const baseField = {
    b_id: "field-1",
    b_name: "Perceel Noord",
    b_id_farm: "farm-1",
    b_id_source: null,
    b_geometry: null,
    b_centroid: [5.2, 52.1] as [number, number],
    b_area: 3.5,
    b_perimeter: 840.2,
    b_bufferstrip: false,
    b_start: new Date("2023-01-01T00:00:00Z"),
    b_end: null,
    b_acquiring_method: "unknown",
}

function makeApp(services: Partial<FdmApiServices> = {}) {
    return createFdmApi(mockFdm, mockAuth, config, services)
}

// ---------------------------------------------------------------------------
// GET /farms/:b_id_farm/fields
// ---------------------------------------------------------------------------
describe("GET /farms/:b_id_farm/fields", () => {
    beforeEach(() => {
        validKey()
    })

    it("returns 200 with paginated field list", async () => {
        const app = makeApp({
            getFields: vi.fn().mockResolvedValue([baseField]),
        })
        const res = await app.request("/farms/farm-1/fields", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data).toHaveLength(1)
        expect(body.total).toBe(1)
        expect(body.data[0].b_id).toBe("field-1")
    })

    it("serialises Date as YYYY-MM-DD string", async () => {
        const app = makeApp({
            getFields: vi.fn().mockResolvedValue([baseField]),
        })
        const res = await app.request("/farms/farm-1/fields", {
            headers: { "x-api-key": "valid" },
        })
        const body = await res.json()
        expect(body.data[0].b_start).toBe("2023-01-01")
        expect(body.data[0].b_end).toBeNull()
    })

    it("returns 403 when principal lacks farm access", async () => {
        const app = makeApp({
            getFields: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/farms/farm-1/fields", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })

    it("applies pagination", async () => {
        const fields = Array.from({ length: 5 }, (_, i) => ({
            ...baseField,
            b_id: `f-${i}`,
        }))
        const app = makeApp({ getFields: vi.fn().mockResolvedValue(fields) })
        const res = await app.request("/farms/farm-1/fields?limit=2&offset=1", {
            headers: { "x-api-key": "valid" },
        })
        const body = await res.json()
        expect(body.data).toHaveLength(2)
        expect(body.data[0].b_id).toBe("f-1")
        expect(body.total).toBe(5)
    })

    it("response has FDM-native field names", async () => {
        const app = makeApp({
            getFields: vi.fn().mockResolvedValue([baseField]),
        })
        const res = await app.request("/farms/farm-1/fields", {
            headers: { "x-api-key": "valid" },
        })
        const body = await res.json()
        const item = body.data[0]
        expect(item).toHaveProperty("b_id")
        expect(item).toHaveProperty("b_name")
        expect(item).toHaveProperty("b_id_farm")
        expect(item).toHaveProperty("b_geometry")
        expect(item).toHaveProperty("b_centroid")
        expect(item).toHaveProperty("b_area")
        expect(item).toHaveProperty("b_acquiring_method")
    })
})

// ---------------------------------------------------------------------------
// GET /fields/:b_id
// ---------------------------------------------------------------------------
describe("GET /fields/:b_id", () => {
    beforeEach(() => {
        validKey()
    })

    it("returns 200 with the field", async () => {
        const app = makeApp({ getField: vi.fn().mockResolvedValue(baseField) })
        const res = await app.request("/fields/field-1", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.b_id).toBe("field-1")
        expect(body.b_name).toBe("Perceel Noord")
    })

    it("returns 403 when principal lacks access", async () => {
        const app = makeApp({
            getField: vi.fn().mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/fields/field-1", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })

    it("returns 404 when field does not exist", async () => {
        const app = makeApp({
            getField: vi
                .fn()
                .mockResolvedValue({ ...baseField, b_id: undefined }),
        })
        const res = await app.request("/fields/missing", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(404)
    })

    it("serialises dates correctly", async () => {
        const field = {
            ...baseField,
            b_start: new Date("2024-03-15T08:00:00Z"),
            b_end: new Date("2024-12-01T00:00:00Z"),
        }
        const app = makeApp({ getField: vi.fn().mockResolvedValue(field) })
        const res = await app.request("/fields/field-1", {
            headers: { "x-api-key": "valid" },
        })
        const body = await res.json()
        expect(body.b_start).toBe("2024-03-15")
        expect(body.b_end).toBe("2024-12-01")
    })
})

// ---------------------------------------------------------------------------
// POST /farms/:b_id_farm/fields
// ---------------------------------------------------------------------------
describe("POST /farms/:b_id_farm/fields", () => {
    beforeEach(() => {
        validKey()
    })

    const validGeometry = {
        type: "Polygon",
        coordinates: [
            [
                [5.0, 52.0],
                [5.1, 52.0],
                [5.1, 52.1],
                [5.0, 52.1],
                [5.0, 52.0],
            ],
        ],
    }

    it("returns 201 with the created field", async () => {
        const app = makeApp({
            addField: vi.fn().mockResolvedValue("field-new"),
            getField: vi
                .fn()
                .mockResolvedValue({ ...baseField, b_id: "field-new" }),
        })
        const res = await app.request("/farms/farm-1/fields", {
            method: "POST",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                b_name: "Nieuw perceel",
                b_geometry: validGeometry,
                b_start: "2024-01-01",
                b_acquiring_method: "purchase",
            }),
        })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.b_id).toBe("field-new")
        expect(res.headers.get("location")).toContain("/fields/field-new")
    })

    it("returns 422 when GeoJSON has too many coordinates", async () => {
        const tooManyCoords = Array.from({ length: 10_001 }, (_, i) => [
            i * 0.0001,
            52.0,
        ])
        tooManyCoords.push(tooManyCoords[0])
        const geometry = { type: "Polygon", coordinates: [tooManyCoords] }
        const app = makeApp({ addField: vi.fn(), getField: vi.fn() })
        const res = await app.request("/farms/farm-1/fields", {
            method: "POST",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                b_name: "Too big",
                b_geometry: geometry,
                b_start: "2024-01-01",
                b_acquiring_method: "purchase",
            }),
        })
        expect(res.status).toBe(422)
    })

    it("returns 415 without Content-Type: application/json", async () => {
        const app = makeApp()
        const res = await app.request("/farms/farm-1/fields", {
            method: "POST",
            headers: { "x-api-key": "valid" },
            body: "{}",
        })
        expect(res.status).toBe(415)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({
            addField: vi.fn().mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/farms/farm-1/fields", {
            method: "POST",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                b_name: "Perceel",
                b_geometry: validGeometry,
                b_start: "2024-01-01",
                b_acquiring_method: "purchase",
            }),
        })
        expect(res.status).toBe(403)
    })
})

// ---------------------------------------------------------------------------
// DELETE /fields/:b_id
// ---------------------------------------------------------------------------
describe("DELETE /fields/:b_id", () => {
    beforeEach(() => {
        validKey()
    })

    it("returns 204 on success", async () => {
        const app = makeApp({
            removeField: vi.fn().mockResolvedValue(undefined),
        })
        const res = await app.request("/fields/field-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(204)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({
            removeField: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/fields/field-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })
})

// ---------------------------------------------------------------------------
// PATCH /fields/:b_id
// ---------------------------------------------------------------------------
describe("PATCH /fields/:b_id", () => {
    beforeEach(() => {
        validKey()
    })

    it("returns 200 with the updated field", async () => {
        const app = makeApp({
            getField: vi.fn().mockResolvedValue(baseField),
            updateField: vi
                .fn()
                .mockResolvedValue({ ...baseField, b_name: "Perceel Zuid" }),
        })
        const res = await app.request("/fields/field-1", {
            method: "PATCH",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({ b_name: "Perceel Zuid" }),
        })
        expect(res.status).toBe(200)
        expect((await res.json()).b_name).toBe("Perceel Zuid")
    })

    it("returns 400 when the body is empty", async () => {
        const app = makeApp()
        const res = await app.request("/fields/field-1", {
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
            getField: vi.fn().mockResolvedValue(baseField),
            updateField: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/fields/field-1", {
            method: "PATCH",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({ b_name: "Perceel Zuid" }),
        })
        expect(res.status).toBe(403)
    })
})
