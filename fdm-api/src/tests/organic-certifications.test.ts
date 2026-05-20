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

const baseCertification = {
    b_id_organic: "organic-1",
    b_organic_traces: "NL-BIO-01.528-0002967.2025.001",
    b_organic_skal: "026281",
    b_organic_issued: new Date("2024-01-01"),
    b_organic_expires: new Date("2025-01-01"),
}

describe("GET /farms/:b_id_farm/organic-certifications", () => {
    beforeEach(validKey)

    it("returns 200 with paginated certifications", async () => {
        const app = makeApp({ listOrganicCertifications: vi.fn().mockResolvedValue([baseCertification]) })
        const res = await app.request("/farms/farm-1/organic-certifications", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(200)
        expect((await res.json()).data[0].b_id_organic).toBe("organic-1")
    })

    it("returns 403 when principal lacks access", async () => {
        const app = makeApp({ listOrganicCertifications: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/farms/farm-1/organic-certifications", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(403)
    })
})

describe("POST /farms/:b_id_farm/organic-certifications", () => {
    beforeEach(validKey)

    it("returns 201 with the created certification", async () => {
        const app = makeApp({
            addOrganicCertification: vi.fn().mockResolvedValue("organic-new"),
            getOrganicCertification: vi.fn().mockResolvedValue({ ...baseCertification, b_id_organic: "organic-new" }),
        })
        const res = await app.request("/farms/farm-1/organic-certifications", {
            method: "POST",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({
                b_organic_traces: baseCertification.b_organic_traces,
                b_organic_skal: baseCertification.b_organic_skal,
                b_organic_issued: "2024-01-01",
                b_organic_expires: "2025-01-01",
            }),
        })
        expect(res.status).toBe(201)
        expect((await res.json()).b_id_organic).toBe("organic-new")
    })

    it("returns 415 without Content-Type: application/json", async () => {
        const app = makeApp()
        const res = await app.request("/farms/farm-1/organic-certifications", {
            method: "POST",
            headers: { "x-api-key": "valid" },
            body: "{}",
        })
        expect(res.status).toBe(415)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({ addOrganicCertification: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/farms/farm-1/organic-certifications", {
            method: "POST",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({
                b_organic_issued: "2024-01-01",
                b_organic_expires: "2025-01-01",
            }),
        })
        expect(res.status).toBe(403)
    })
})

describe("GET /organic-certifications/:b_id_organic", () => {
    beforeEach(validKey)

    it("returns 200 with the certification", async () => {
        const app = makeApp({ getOrganicCertification: vi.fn().mockResolvedValue(baseCertification) })
        const res = await app.request("/organic-certifications/organic-1", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(200)
        expect((await res.json()).b_organic_issued).toBe("2024-01-01")
    })

    it("returns 404 when the certification does not exist", async () => {
        const app = makeApp({ getOrganicCertification: vi.fn().mockResolvedValue(undefined) })
        const res = await app.request("/organic-certifications/missing", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(404)
    })

    it("returns 403 when principal lacks access", async () => {
        const app = makeApp({ getOrganicCertification: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/organic-certifications/organic-1", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(403)
    })
})

describe("DELETE /organic-certifications/:b_id_organic", () => {
    beforeEach(validKey)

    it("returns 204 on success", async () => {
        const app = makeApp({ removeOrganicCertification: vi.fn().mockResolvedValue(undefined) })
        const res = await app.request("/organic-certifications/organic-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(204)
    })

    it("returns 403 when principal lacks permission", async () => {
        const app = makeApp({ removeOrganicCertification: vi.fn().mockRejectedValue(new Error("Permission denied")) })
        const res = await app.request("/organic-certifications/organic-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(403)
    })
})
