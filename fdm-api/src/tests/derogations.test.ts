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

function makeApp(services: Partial<FdmApiServices> = {}) {
    return createFdmApi(mockFdm, mockAuth, config, services)
}

const baseDerogation = {
    b_id_derogation: "derogation-1",
    b_id_farm: "farm-1",
    b_derogation_year: 2024,
}

describe("GET /farms/:b_id_farm/derogations", () => {
    beforeEach(validKey)

    it("returns 200 with paginated derogations", async () => {
        const app = makeApp({
            listDerogations: vi.fn().mockResolvedValue([baseDerogation]),
        })
        const res = await app.request("/farms/farm-1/derogations", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(200)
        expect((await res.json()).data[0].b_id_derogation).toBe("derogation-1")
    })

    it("returns 403 when principal lacks access", async () => {
        const app = makeApp({
            listDerogations: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/farms/farm-1/derogations", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })
})

describe("POST /farms/:b_id_farm/derogations", () => {
    beforeEach(validKey)

    it("returns 201 with the created derogation", async () => {
        const app = makeApp({
            addDerogation: vi.fn().mockResolvedValue("derogation-new"),
        })
        const res = await app.request("/farms/farm-1/derogations", {
            method: "POST",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({ b_derogation_year: 2024 }),
        })
        expect(res.status).toBe(201)
        expect((await res.json()).b_id_derogation).toBe("derogation-new")
    })

    it("returns 415 without Content-Type: application/json", async () => {
        const app = makeApp()
        const res = await app.request("/farms/farm-1/derogations", {
            method: "POST",
            headers: { "x-api-key": "valid" },
            body: "{}",
        })
        expect(res.status).toBe(415)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({
            addDerogation: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/farms/farm-1/derogations", {
            method: "POST",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({ b_derogation_year: 2024 }),
        })
        expect(res.status).toBe(403)
    })
})

describe("DELETE /derogations/:b_id_derogation", () => {
    beforeEach(validKey)

    it("returns 204 on success", async () => {
        const app = makeApp({
            removeDerogation: vi.fn().mockResolvedValue(undefined),
        })
        const res = await app.request("/derogations/derogation-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(204)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({
            removeDerogation: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/derogations/derogation-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })
})
