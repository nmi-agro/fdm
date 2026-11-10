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
import { getAuditContext } from "@nmi-agro/fdm-core"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import type { ApiEnv } from "../types"
import { type ApiKeyAuthOptions, createApiKeyAuth } from "../auth"
import { createErrorHandler } from "../error"
import { createFdmApi } from "../index"

const config = { appName: "Test App", appUrl: "https://test.example.com" }

const mockFdm = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any

function makeApp(mockAuth: any, services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, {
    countFieldsOfFarms: async () => ({}),
    ...services,
  })
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
// Ambiguous API key (both headers present)
// ---------------------------------------------------------------------------
describe("createApiKeyAuth: ambiguous-api-key", () => {
  it("returns 400 when both X-API-Key and Authorization: Bearer are provided", async () => {
    const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
    const app = makeApp(mockAuth)
    const res = await app.request("/farms", {
      headers: {
        "x-api-key": "key-abc",
        authorization: "Bearer token-xyz",
      },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.type).toContain("ambiguous-api-key")
    expect(mockAuth.api.verifyApiKey).not.toHaveBeenCalled()
  })

  it("returns 400 when both X-API-Key and a non-Bearer Authorization header are provided", async () => {
    const mockAuth = { api: { verifyApiKey: vi.fn() } } as any
    const app = makeApp(mockAuth)
    const res = await app.request("/farms", {
      headers: {
        "x-api-key": "key-abc",
        authorization: "Basic dXNlcjpwYXNz",
      },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.type).toContain("ambiguous-api-key")
    expect(mockAuth.api.verifyApiKey).not.toHaveBeenCalled()
  })
})

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
          error: {
            message: "API key has been revoked by the account owner.",
          },
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
    const app = makeApp(mockAuth, {
      getFarms: vi.fn().mockResolvedValue([]),
    })
    await app.request("/farms", { headers: { "x-api-key": "valid" } })
    expect(mockFdm.values).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "fdm-api:my-special-key-id:general",
      }),
    )
  })

  it("works correctly when key.name is null", async () => {
    const mockAuth = validAuth({ name: null })
    const app = makeApp(mockAuth, {
      getFarms: vi.fn().mockResolvedValue([]),
    })
    const res = await app.request("/farms", {
      headers: { "x-api-key": "valid" },
    })
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
    const app = makeApp(mockAuth, {
      getFarms: vi.fn().mockResolvedValue([]),
    })
    const res = await app.request("/farms", {
      headers: { "x-api-key": "valid" },
    })
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Options: audit channel and WWW-Authenticate challenge
// ---------------------------------------------------------------------------
describe("createApiKeyAuth: options", () => {
  function makeAuthApp(mockAuth: any, options?: ApiKeyAuthOptions) {
    const app = new Hono<ApiEnv>()
    app.onError(createErrorHandler(config.appUrl))
    app.use("*", createApiKeyAuth(mockAuth, [], options))
    app.get("/whoami", (c) =>
      c.json({ channel: c.get("principal").channel, audit: getAuditContext() }),
    )
    return app
  }

  it("uses channel api and no WWW-Authenticate header by default", async () => {
    const app = makeAuthApp(validAuth({ id: "key-9" }))
    const res = await app.request("/whoami", { headers: { "x-api-key": "k" } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      channel: "api",
      audit: { channel: "api", credential_id: "key-9" },
    })

    const unauthorized = await app.request("/whoami")
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.headers.get("www-authenticate")).toBeNull()
  })

  it("records the configured channel on the principal and the audit context", async () => {
    const app = makeAuthApp(validAuth({ id: "key-9" }), { channel: "mcp" })
    const res = await app.request("/whoami", { headers: { authorization: "Bearer k" } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      channel: "mcp",
      audit: { channel: "mcp", credential_id: "key-9" },
    })
  })

  it("sends the configured WWW-Authenticate challenge with a missing key", async () => {
    const app = makeAuthApp(validAuth(), { wwwAuthenticate: 'Bearer realm="Test App"' })
    const res = await app.request("/whoami")
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toBe('Bearer realm="Test App"')
    expect(res.headers.get("content-type")).toContain("application/problem+json")
  })

  it("sends the configured WWW-Authenticate challenge with an invalid key", async () => {
    const mockAuth = {
      api: { verifyApiKey: vi.fn().mockResolvedValue({ valid: false, error: null, key: null }) },
    } as any
    const app = makeAuthApp(mockAuth, { wwwAuthenticate: 'Bearer realm="Test App"' })
    const res = await app.request("/whoami", { headers: { "x-api-key": "wrong" } })
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toBe('Bearer realm="Test App"')
  })

  it("does not send a challenge for an ambiguous key", async () => {
    const app = makeAuthApp(validAuth(), { wwwAuthenticate: 'Bearer realm="Test App"' })
    const res = await app.request("/whoami", {
      headers: { "x-api-key": "a", authorization: "Bearer b" },
    })
    expect(res.status).toBe(400)
    expect(res.headers.get("www-authenticate")).toBeNull()
  })
})
