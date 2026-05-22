/**
 * Tests for the createApiKeyAuth middleware (src/auth.ts).
 *
 * Covers behaviors not already tested by existing route tests:
 * - OPTIONS bypass
 * - Skip-listed path bypass
 * - Error message forwarding from verifyApiKey
 * - Principal context populated correctly (verified via rate-limit key)
 * - key.name = null results in null keyName (no crash)
 */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { createFdmApi } from "../index"
import type { FdmApiServices } from "../index"

const config = { appName: "Test App", appUrl: "https://test.example.com" }

const mockFdm = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any

function makeApp(mockAuth: any, services: Partial<FdmApiServices> = {}) {
    return createFdmApi(mockFdm, mockAuth, config, services)
}

function validAuth(overrides: { id?: string; referenceId?: string; name?: string | null } = {}) {
    return {
        api: {
            verifyApiKey: vi.fn().mockResolvedValue({
                valid: true,
                error: null,
                key: {
                    id: overrides.id ?? "key-1",
                    referenceId: overrides.referenceId ?? "user-1",
                    name: overrides.name !== undefined ? overrides.name : "Test key",
                },
            }),
        },
    } as any
}

// ---------------------------------------------------------------------------
// OPTIONS bypass
// ---------------------------------------------------------------------------
describe("createApiKeyAuth: OPTIONS bypass", () => {
    it("does not call verifyApiKey for OPTIONS requests", async () => {
        const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
        const app = makeApp(mockAuth)
        await app.request("/farms", { method: "OPTIONS" })
        expect(mockAuth.api.verifyApiKey).not.toHaveBeenCalled()
    })

    it("OPTIONS request is not rejected with 401", async () => {
        const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
        const app = makeApp(mockAuth)
        const res = await app.request("/farms", { method: "OPTIONS" })
        expect(res.status).not.toBe(401)
    })
})

// ---------------------------------------------------------------------------
// Skip-listed paths bypass
// ---------------------------------------------------------------------------
describe("createApiKeyAuth: skip-listed paths bypass", () => {
    it("GET /openapi.json does not call verifyApiKey", async () => {
        const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
        const app = makeApp(mockAuth)
        await app.request("/openapi.json")
        expect(mockAuth.api.verifyApiKey).not.toHaveBeenCalled()
    })

    it("GET /openapi.json returns 200 without an API key", async () => {
        const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
        const app = makeApp(mockAuth)
        const res = await app.request("/openapi.json")
        expect(res.status).toBe(200)
    })
})

// ---------------------------------------------------------------------------
// Error message forwarding
// ---------------------------------------------------------------------------
describe("createApiKeyAuth: error message from verifyApiKey", () => {
    it("forwards a custom error message from the auth provider in the 401 body", async () => {
        const mockAuth = {
            api: {
                verifyApiKey: vi.fn().mockResolvedValue({
                    valid: false,
                    error: { message: "API key has been revoked by the account owner." },
                    key: null,
                }),
            },
        } as any
        const app = makeApp(mockAuth)
        const res = await app.request("/farms", {
            headers: { "x-api-key": "revoked-key" },
        })
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body.detail).toBe("API key has been revoked by the account owner.")
    })

    it("falls back to a default message when error.message is not a string", async () => {
        const mockAuth = {
            api: {
                verifyApiKey: vi.fn().mockResolvedValue({
                    valid: false,
                    error: { message: 42 },
                    key: null,
                }),
            },
        } as any
        const app = makeApp(mockAuth)
        const res = await app.request("/farms", {
            headers: { "x-api-key": "bad-key" },
        })
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(typeof body.detail).toBe("string")
        expect(body.detail.length).toBeGreaterThan(0)
    })
})

// ---------------------------------------------------------------------------
// Principal context
// ---------------------------------------------------------------------------
describe("createApiKeyAuth: principal context fields", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFdm.insert.mockReturnThis()
        mockFdm.values.mockReturnThis()
        mockFdm.onConflictDoUpdate.mockReturnThis()
        mockFdm.returning.mockResolvedValue([{ count: 1, lastRequest: Date.now() }])
    })

    it("uses apiKeyId from the verified key as the rate-limit key segment", async () => {
        const mockAuth = validAuth({ id: "my-special-key-id" })
        const app = makeApp(mockAuth, { getFarms: vi.fn().mockResolvedValue([]) })
        await app.request("/farms", { headers: { "x-api-key": "valid" } })
        expect(mockFdm.values).toHaveBeenCalledWith(
            expect.objectContaining({ key: "fdm-api:my-special-key-id:general" }),
        )
    })

    it("works correctly when key.name is null", async () => {
        const mockAuth = validAuth({ name: null })
        const app = makeApp(mockAuth, { getFarms: vi.fn().mockResolvedValue([]) })
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(200)
    })

    it("works correctly when key.name is undefined (treated as null)", async () => {
        const mockAuth = {
            api: {
                verifyApiKey: vi.fn().mockResolvedValue({
                    valid: true,
                    error: null,
                    key: { id: "key-1", referenceId: "user-1" },
                }),
            },
        } as any
        const app = makeApp(mockAuth, { getFarms: vi.fn().mockResolvedValue([]) })
        const res = await app.request("/farms", { headers: { "x-api-key": "valid" } })
        expect(res.status).toBe(200)
    })
})
