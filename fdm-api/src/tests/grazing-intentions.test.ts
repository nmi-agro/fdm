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

const baseIntention = {
    b_id_farm: "farm-1",
    b_grazing_intention_year: 2024,
    b_grazing_intention: true,
}

describe("GET /farms/:b_id_farm/grazing-intentions", () => {
    beforeEach(validKey)

    it("returns 200 with paginated grazing intentions", async () => {
        const app = makeApp({
            getGrazingIntentions: vi.fn().mockResolvedValue([baseIntention]),
        })
        const res = await app.request("/farms/farm-1/grazing-intentions", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(200)
        expect((await res.json()).data[0].b_grazing_intention_year).toBe(2024)
    })

    it("returns 403 when principal lacks access", async () => {
        const app = makeApp({
            getGrazingIntentions: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/farms/farm-1/grazing-intentions", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })
})

describe("PUT /farms/:b_id_farm/grazing-intentions/:year", () => {
    beforeEach(validKey)

    it("returns 200 with the saved grazing intention", async () => {
        const app = makeApp({
            setGrazingIntention: vi.fn().mockResolvedValue(undefined),
        })
        const res = await app.request("/farms/farm-1/grazing-intentions/2024", {
            method: "PUT",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({ b_grazing_intention: true }),
        })
        expect(res.status).toBe(200)
        expect((await res.json()).b_grazing_intention).toBe(true)
    })

    it("returns 415 without Content-Type: application/json", async () => {
        const app = makeApp()
        const res = await app.request("/farms/farm-1/grazing-intentions/2024", {
            method: "PUT",
            headers: { "x-api-key": "valid" },
            body: "{}",
        })
        expect(res.status).toBe(415)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({
            setGrazingIntention: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/farms/farm-1/grazing-intentions/2024", {
            method: "PUT",
            headers: {
                "x-api-key": "valid",
                "content-type": "application/json",
            },
            body: JSON.stringify({ b_grazing_intention: true }),
        })
        expect(res.status).toBe(403)
    })
})

describe("DELETE /farms/:b_id_farm/grazing-intentions/:year", () => {
    beforeEach(validKey)

    it("returns 204 on success", async () => {
        const app = makeApp({
            removeGrazingIntention: vi.fn().mockResolvedValue(undefined),
        })
        const res = await app.request("/farms/farm-1/grazing-intentions/2024", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(204)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({
            removeGrazingIntention: vi
                .fn()
                .mockRejectedValue(new Error("Permission denied")),
        })
        const res = await app.request("/farms/farm-1/grazing-intentions/2024", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })
})
