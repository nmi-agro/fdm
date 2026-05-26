import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFdmApi } from "../index"
import type { FdmApiServices } from "../index"

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

const baseMeasure = {
    b_id_measure: "measure-1",
    m_id: "bm-1",
    b_id: "field-1",
    m_start: new Date("2024-01-01"),
    m_end: new Date("2024-06-01T00:00:00Z"),
    m_name: "Bufferstrook",
    m_summary: "Summary",
    m_conflicts: ["bm-2"],
}

describe("GET /fields/:b_id/measures", () => {
    beforeEach(validKey)

    it("returns 200 with paginated measures", async () => {
        const app = makeApp({ getMeasures: vi.fn().mockResolvedValue([baseMeasure]) })
        const res = await app.request("/fields/field-1/measures", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(200)
        expect((await res.json()).data[0].b_id_measure).toBe("measure-1")
    })

    it("returns 403 when principal lacks access", async () => {
        const app = makeApp({ getMeasures: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/fields/field-1/measures", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(403)
    })
})

describe("POST /fields/:b_id/measures", () => {
    beforeEach(validKey)

    it("returns 201 with the created measure", async () => {
        const app = makeApp({
            addMeasure: vi.fn().mockResolvedValue("measure-new"),
            getMeasure: vi.fn().mockResolvedValue({ ...baseMeasure, b_id_measure: "measure-new" }),
        })
        const res = await app.request("/fields/field-1/measures", {
            method: "POST",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({ m_id: "bm-1", m_start: "2024-01-01" }),
        })
        expect(res.status).toBe(201)
        expect((await res.json()).b_id_measure).toBe("measure-new")
    })

    it("returns 415 without Content-Type: application/json", async () => {
        const app = makeApp()
        const res = await app.request("/fields/field-1/measures", {
            method: "POST",
            headers: { "x-api-key": "valid" },
            body: "{}",
        })
        expect(res.status).toBe(415)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({ addMeasure: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/fields/field-1/measures", {
            method: "POST",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({ m_id: "bm-1", m_start: "2024-01-01" }),
        })
        expect(res.status).toBe(403)
    })
})

describe("GET /measures/:b_id_measure", () => {
    beforeEach(validKey)

    it("returns 200 with the measure", async () => {
        const app = makeApp({ getMeasure: vi.fn().mockResolvedValue(baseMeasure) })
        const res = await app.request("/measures/measure-1", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(200)
        expect((await res.json()).m_start).toBe("2024-01-01")
    })

    it("returns 404 when the measure does not exist", async () => {
        const app = makeApp({ getMeasure: vi.fn().mockResolvedValue({ ...baseMeasure, b_id_measure: undefined }) })
        const res = await app.request("/measures/missing", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(404)
    })

    it("returns 403 when principal lacks access", async () => {
        const app = makeApp({ getMeasure: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/measures/measure-1", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(403)
    })
})

describe("PATCH /measures/:b_id_measure", () => {
    beforeEach(validKey)

    it("returns 200 with the updated measure", async () => {
        const app = makeApp({
            updateMeasure: vi.fn().mockResolvedValue(undefined),
            getMeasure: vi.fn().mockResolvedValue({ ...baseMeasure, m_end: null }),
        })
        const res = await app.request("/measures/measure-1", {
            method: "PATCH",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({ m_end: null }),
        })
        expect(res.status).toBe(200)
        expect((await res.json()).m_end).toBeNull()
    })

    it("returns 400 when the body is empty", async () => {
        const app = makeApp()
        const res = await app.request("/measures/measure-1", {
            method: "PATCH",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({}),
        })
        expect(res.status).toBe(400)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({ updateMeasure: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/measures/measure-1", {
            method: "PATCH",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({ m_end: null }),
        })
        expect(res.status).toBe(403)
    })
})

describe("DELETE /measures/:b_id_measure", () => {
    beforeEach(validKey)

    it("returns 204 on success", async () => {
        const app = makeApp({ removeMeasure: vi.fn().mockResolvedValue(undefined) })
        const res = await app.request("/measures/measure-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(204)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({ removeMeasure: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/measures/measure-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })
})
