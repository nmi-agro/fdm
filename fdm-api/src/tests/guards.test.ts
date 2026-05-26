/**
 * Tests for request guard middleware and GeoJSON coordinate validator (src/guards.ts):
 * - requestGuard: content-type enforcement and body size limit
 * - assertGeoJsonCoordinates: coordinate count validation (unit)
 */
import { describe, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { createFdmApi } from "../index"
import { requestGuard, assertGeoJsonCoordinates } from "../guards"
import { createErrorHandler } from "../error"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal Hono app that only applies requestGuard + the error handler.
 * Routes respond 200 so we can verify the guard passed through.
 */
function makeGuardApp() {
    const app = new Hono()
    app.onError(createErrorHandler("https://test.example.com"))
    app.use("*", requestGuard)
    app.all("*", (c) => c.text("ok", 200))
    return app
}

// ---------------------------------------------------------------------------
// requestGuard: GET / DELETE pass through without Content-Type check
// ---------------------------------------------------------------------------
describe("requestGuard: read methods bypass content-type check", () => {
    it("GET request without Content-Type passes through (200)", async () => {
        const app = makeGuardApp()
        const res = await app.request("/any-path", { method: "GET" })
        expect(res.status).toBe(200)
    })

    it("DELETE request without Content-Type passes through (200)", async () => {
        const app = makeGuardApp()
        const res = await app.request("/any-path", { method: "DELETE" })
        expect(res.status).toBe(200)
    })
})

// ---------------------------------------------------------------------------
// requestGuard: write methods enforce application/json
// ---------------------------------------------------------------------------
describe("requestGuard: write methods enforce application/json Content-Type", () => {
    it("POST without Content-Type header returns 415", async () => {
        const app = makeGuardApp()
        const res = await app.request("/any-path", {
            method: "POST",
            body: "{}",
        })
        expect(res.status).toBe(415)
        const body = await res.json()
        expect(body.type).toContain("unsupported-media-type")
    })

    it("PUT without Content-Type header returns 415", async () => {
        const app = makeGuardApp()
        const res = await app.request("/any-path", {
            method: "PUT",
            body: "{}",
        })
        expect(res.status).toBe(415)
    })

    it("PATCH without Content-Type header returns 415", async () => {
        const app = makeGuardApp()
        const res = await app.request("/any-path", {
            method: "PATCH",
            body: "{}",
        })
        expect(res.status).toBe(415)
    })

    it("POST with Content-Type: text/plain returns 415", async () => {
        const app = makeGuardApp()
        const res = await app.request("/any-path", {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: "hello",
        })
        expect(res.status).toBe(415)
    })

    it("POST with Content-Type: application/json passes (200)", async () => {
        const app = makeGuardApp()
        const res = await app.request("/any-path", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
        })
        expect(res.status).toBe(200)
    })

    it("POST with Content-Type: application/json; charset=utf-8 passes (semicolon handling)", async () => {
        const app = makeGuardApp()
        const res = await app.request("/any-path", {
            method: "POST",
            headers: { "content-type": "application/json; charset=utf-8" },
            body: "{}",
        })
        expect(res.status).toBe(200)
    })
})

// ---------------------------------------------------------------------------
// requestGuard: body size limit
// ---------------------------------------------------------------------------
describe("requestGuard: body size limit", () => {
    it("POST with body exceeding 5 MB returns 413 payload-too-large", async () => {
        const mockAuth = {
            api: {
                verifyApiKey: vi.fn().mockResolvedValue({
                    valid: true,
                    error: null,
                    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
                }),
            },
        } as any
        const mockFdm = {
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            onConflictDoUpdate: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
        } as any
        const app = createFdmApi(mockFdm, mockAuth, {
            appName: "Test App",
            appUrl: "https://test.example.com",
        })
        const largeBody = JSON.stringify({ data: "x".repeat(5 * 1024 * 1024 + 1) })
        const res = await app.request("/farms", {
            method: "POST",
            headers: { "x-api-key": "valid", "content-type": "application/json" },
            body: largeBody,
        })
        expect(res.status).toBe(413)
        const body = await res.json()
        expect(body.type).toContain("payload-too-large")
    })
})

// ---------------------------------------------------------------------------
// assertGeoJsonCoordinates (unit)
// ---------------------------------------------------------------------------
describe("assertGeoJsonCoordinates", () => {
    function makePolygon(coordCount: number): object {
        const coords = Array.from({ length: coordCount }, (_, i) => [i * 0.001, 0])
        return {
            type: "Polygon",
            coordinates: [coords],
        }
    }

    it("does not throw for a polygon with fewer than 10,000 coordinates", () => {
        expect(() => assertGeoJsonCoordinates(makePolygon(9_999))).not.toThrow()
    })

    it("does not throw for a polygon with exactly 10,000 coordinates", () => {
        expect(() => assertGeoJsonCoordinates(makePolygon(10_000))).not.toThrow()
    })

    it("throws ApiError 422 for a polygon with 10,001 coordinates", () => {
        expect(() => assertGeoJsonCoordinates(makePolygon(10_001))).toThrow()
        try {
            assertGeoJsonCoordinates(makePolygon(10_001))
        } catch (err: any) {
            expect(err.status).toBe(422)
            expect(err.slug).toBe("unprocessable-entity")
        }
    })

    it("counts coordinates across all sub-geometries in a GeometryCollection", () => {
        const collection = {
            type: "GeometryCollection",
            geometries: [makePolygon(6_000), makePolygon(5_000)],
        }
        expect(() => assertGeoJsonCoordinates(collection)).toThrow()
        try {
            assertGeoJsonCoordinates(collection)
        } catch (err: any) {
            expect(err.status).toBe(422)
        }
    })

    it("does not throw for a GeometryCollection within the limit", () => {
        const collection = {
            type: "GeometryCollection",
            geometries: [makePolygon(5_000), makePolygon(4_999)],
        }
        expect(() => assertGeoJsonCoordinates(collection)).not.toThrow()
    })

    it("does not throw for null geometry", () => {
        expect(() => assertGeoJsonCoordinates(null)).not.toThrow()
    })

    it("does not throw for undefined geometry", () => {
        expect(() => assertGeoJsonCoordinates(undefined)).not.toThrow()
    })

    it("does not throw for a non-object (string) geometry", () => {
        expect(() => assertGeoJsonCoordinates("not a geometry")).not.toThrow()
    })

    it("does not throw for an empty object", () => {
        expect(() => assertGeoJsonCoordinates({})).not.toThrow()
    })

    it("does not throw for a geometry with no coordinates property", () => {
        expect(() => assertGeoJsonCoordinates({ type: "Point" })).not.toThrow()
    })
})
