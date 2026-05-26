/**
 * Tests for the rate-limit middleware:
 * - No double-counting on overlapping middleware patterns
 * - Core behavior: headers and 429 enforcement
 * - Bucket selection by HTTP method
 * - Path coverage for all distinct middleware registrations
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFdmApi } from "../index"
import type { FdmApiServices } from "../index"
import { RATE_LIMITS } from "../rate-limit"

const config = { appName: "Test App", appUrl: "https://test.example.com" }

function makeMocks(count = 1) {
    const lastRequest = Date.now() - 30_000

    const mockFdm = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ count, lastRequest }]),
    } as any

    const mockAuth = {
        api: {
            verifyApiKey: vi.fn().mockResolvedValue({
                valid: true,
                error: null,
                key: { id: "key-1", referenceId: "user-1", name: "Test key" },
            }),
        },
    } as any

    return { mockFdm, mockAuth }
}

function makeApp(
    mockFdm: any,
    mockAuth: any,
    services: Partial<FdmApiServices> = {},
) {
    return createFdmApi(mockFdm, mockAuth, config, services)
}

// ---------------------------------------------------------------------------
// Regression: no double-counting on overlapping middleware patterns
// ---------------------------------------------------------------------------
describe("rate-limit: no double-counting on overlapping middleware patterns", () => {
    let mockFdm: any
    let mockAuth: any

    beforeEach(() => {
        ;({ mockFdm, mockAuth } = makeMocks())
    })

    it("GET /farms/:id/fields increments rate limit exactly once", async () => {
        const app = makeApp(mockFdm, mockAuth, {
            getFields: vi.fn().mockResolvedValue([]),
        })
        const res = await app.request("/farms/farm-1/fields", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(200)
        expect(mockFdm.insert).toHaveBeenCalledTimes(1)
    })

    it("GET /farms/:id/grazing-intentions increments rate limit exactly once", async () => {
        const app = makeApp(mockFdm, mockAuth, {
            getGrazingIntentions: vi.fn().mockResolvedValue([]),
        })
        const res = await app.request("/farms/farm-1/grazing-intentions", {
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(200)
        expect(mockFdm.insert).toHaveBeenCalledTimes(1)
    })

    it("DELETE /farms/:id/grazing-intentions/:year increments rate limit exactly once", async () => {
        const app = makeApp(mockFdm, mockAuth, {
            removeGrazingIntention: vi.fn().mockResolvedValue(undefined),
        })
        const res = await app.request("/farms/farm-1/grazing-intentions/2024", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(res.status).toBe(204)
        expect(mockFdm.insert).toHaveBeenCalledTimes(1)
    })

    it("POST /farms/:id/fields (write bucket) increments rate limit exactly once", async () => {
        // Rate-limit middleware runs before body validation, so even a 4xx response
        // confirms the counter was incremented the correct number of times.
        const app = makeApp(mockFdm, mockAuth, {
            addField: vi.fn().mockResolvedValue("new-field-id"),
            getField: vi.fn().mockResolvedValue({
                b_id: "new-field-id",
                b_name: "Test Field",
                b_id_farm: "farm-1",
                b_id_source: null,
                b_geometry: null,
                b_centroid: [5.2, 52.1],
                b_area: 1.0,
                b_perimeter: 400.0,
                b_bufferstrip: false,
                b_start: new Date("2024-01-01T00:00:00Z"),
                b_end: null,
                b_acquiring_method: "unknown",
            }),
        })
        await app.request("/farms/farm-1/fields", {
            method: "POST",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({
                b_name: "Test Field",
                b_acquiring_method: "unknown",
                b_start: "2024-01-01",
                b_geometry: {
                    type: "Polygon",
                    coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
                },
            }),
        })
        expect(mockFdm.insert).toHaveBeenCalledTimes(1)
    })
})

// ---------------------------------------------------------------------------
// Group A: Core middleware behavior (headers and 429 enforcement)
// ---------------------------------------------------------------------------
describe("rate-limit: core middleware behavior", () => {
    it("sets RateLimit-Limit header to the bucket limit", async () => {
        const { mockFdm, mockAuth } = makeMocks(1)
        const app = makeApp(mockFdm, mockAuth, {
            getFarms: vi.fn().mockResolvedValue([]),
        })
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        expect(res.headers.get("RateLimit-Limit")).toBe(String(RATE_LIMITS.general))
    })

    it("sets RateLimit-Remaining to limit minus current count", async () => {
        const { mockFdm, mockAuth } = makeMocks(5)
        const app = makeApp(mockFdm, mockAuth, {
            getFarms: vi.fn().mockResolvedValue([]),
        })
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        expect(res.headers.get("RateLimit-Remaining")).toBe(
            String(RATE_LIMITS.general - 5),
        )
    })

    it("sets RateLimit-Reset to a non-negative number of seconds", async () => {
        const { mockFdm, mockAuth } = makeMocks(1)
        const app = makeApp(mockFdm, mockAuth, {
            getFarms: vi.fn().mockResolvedValue([]),
        })
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        const reset = Number(res.headers.get("RateLimit-Reset"))
        expect(reset).toBeGreaterThanOrEqual(0)
    })

    it("returns 429 when the request count exceeds the limit", async () => {
        const { mockFdm, mockAuth } = makeMocks(RATE_LIMITS.general + 1)
        const app = makeApp(mockFdm, mockAuth)
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(429)
    })

    it("sets RateLimit-Remaining: 0 on 429 response", async () => {
        const { mockFdm, mockAuth } = makeMocks(RATE_LIMITS.general + 1)
        const app = makeApp(mockFdm, mockAuth)
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        expect(res.headers.get("RateLimit-Remaining")).toBe("0")
    })

    it("sets Retry-After header on 429 response", async () => {
        const { mockFdm, mockAuth } = makeMocks(RATE_LIMITS.general + 1)
        const app = makeApp(mockFdm, mockAuth)
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        const retryAfter = Number(res.headers.get("Retry-After"))
        expect(retryAfter).toBeGreaterThan(0)
    })

    it("429 body has type containing rate-limit-exceeded", async () => {
        const { mockFdm, mockAuth } = makeMocks(RATE_LIMITS.general + 1)
        const app = makeApp(mockFdm, mockAuth)
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        const body = await res.json()
        expect(body.type).toContain("rate-limit-exceeded")
    })

    it("write bucket limit applies for POST requests", async () => {
        const { mockFdm, mockAuth } = makeMocks(RATE_LIMITS.write + 1)
        const app = makeApp(mockFdm, mockAuth)
        const res = await app.request("/farms", {
            method: "POST",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({ b_name_farm: "Test" }),
        })
        expect(res.status).toBe(429)
        expect(res.headers.get("RateLimit-Limit")).toBe(String(RATE_LIMITS.write))
    })
})

// ---------------------------------------------------------------------------
// Group B: Bucket selection by HTTP method
// ---------------------------------------------------------------------------
describe("rate-limit: bucket selection by HTTP method", () => {
    it("GET requests use the general bucket", async () => {
        const { mockFdm, mockAuth } = makeMocks()
        const app = makeApp(mockFdm, mockAuth, {
            getFarms: vi.fn().mockResolvedValue([]),
        })
        await app.request("/farms", { headers: { "x-api-key": "valid" } })
        expect(mockFdm.values).toHaveBeenCalledWith(
            expect.objectContaining({ key: "fdm-api:key-1:general" }),
        )
    })

    it("POST requests use the write bucket", async () => {
        const { mockFdm, mockAuth } = makeMocks()
        const app = makeApp(mockFdm, mockAuth)
        await app.request("/farms", {
            method: "POST",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: JSON.stringify({ b_name_farm: "Test" }),
        })
        expect(mockFdm.values).toHaveBeenCalledWith(
            expect.objectContaining({ key: "fdm-api:key-1:write" }),
        )
    })

    it("DELETE requests use the write bucket", async () => {
        const { mockFdm, mockAuth } = makeMocks()
        const app = makeApp(mockFdm, mockAuth, {
            removeFarm: vi.fn().mockResolvedValue(undefined),
        })
        await app.request("/farms/farm-1", {
            method: "DELETE",
            headers: { "x-api-key": "valid" },
        })
        expect(mockFdm.values).toHaveBeenCalledWith(
            expect.objectContaining({ key: "fdm-api:key-1:write" }),
        )
    })

    it("GET /farms/:id/calculations/* uses the calc bucket", async () => {
        const { mockFdm, mockAuth } = makeMocks()
        const app = makeApp(mockFdm, mockAuth)
        await app.request(
            "/farms/farm-1/calculations/nitrogen-balance?start=2024-01-01&end=2024-12-31",
            { headers: { "x-api-key": "valid" } },
        )
        expect(mockFdm.values).toHaveBeenCalledWith(
            expect.objectContaining({ key: "fdm-api:key-1:calc" }),
        )
    })

    it("GET /fields/:id/calculations/* uses the calc bucket", async () => {
        const { mockFdm, mockAuth } = makeMocks()
        const app = makeApp(mockFdm, mockAuth)
        await app.request(
            "/fields/field-1/calculations/nitrogen-balance?start=2024-01-01&end=2024-12-31",
            { headers: { "x-api-key": "valid" } },
        )
        expect(mockFdm.values).toHaveBeenCalledWith(
            expect.objectContaining({ key: "fdm-api:key-1:calc" }),
        )
    })
})

// ---------------------------------------------------------------------------
// Group C: Path coverage — all distinct middleware registrations apply rate-limiting
// ---------------------------------------------------------------------------
describe("rate-limit: all rate-limited paths call the DB exactly once", () => {
    const paths: Array<[string, string]> = [
        ["GET /farms", "/farms"],
        ["GET /farms/:id", "/farms/farm-1"],
        ["GET /fields/:id", "/fields/field-1"],
        ["GET /cultivations", "/cultivations"],
        ["GET /cultivations/:id", "/cultivations/cult-1"],
        ["GET /harvests", "/harvests"],
        ["GET /harvests/:id", "/harvests/harvest-1"],
        ["GET /fertilizers/:id", "/fertilizers/fert-1"],
        ["GET /fertilizer-applications/:id", "/fertilizer-applications/app-1"],
        ["GET /measures", "/measures"],
        ["GET /organic-certifications", "/organic-certifications"],
        ["GET /derogations", "/derogations"],
        ["GET /soil-analyses", "/soil-analyses"],

    ]

    for (const [name, path] of paths) {
        it(`${name} is rate-limited (insert called once)`, async () => {
            const { mockFdm, mockAuth } = makeMocks()
            const app = makeApp(mockFdm, mockAuth)
            await app.request(path, { headers: { "x-api-key": "valid" } })
            expect(mockFdm.insert).toHaveBeenCalledTimes(1)
        })
    }
})

