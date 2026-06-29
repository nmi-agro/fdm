/**
 * Tests for error handling utilities (src/error.ts):
 * - ApiError class (unit)
 * - createErrorHandler (integration via minimal Hono app)
 * - createNotFoundHandler (integration)
 */

import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError, createErrorHandler, createNotFoundHandler } from "../error"

const APP_URL = "https://test.example.com"

function makeTestApp() {
  const app = new Hono()
  app.onError(createErrorHandler(APP_URL))
  app.notFound(createNotFoundHandler(APP_URL))

  app.get("/api-error", () => {
    throw new ApiError(422, "unprocessable-entity", "Bad input.")
  })
  app.get("/api-error-with-extras", () => {
    throw new ApiError(409, "conflict", "Conflict!", {
      conflicting_id: "abc-123",
    })
  })
  app.get("/permission-denied", () => {
    throw new Error("Permission denied")
  })
  app.get("/permission-denied-wrapped", () => {
    const cause = new Error("Permission denied")
    throw new Error("Outer error", { cause })
  })
  app.get("/permission-denied-message-variant", () => {
    throw new Error("Principal does not have permission to perform this action")
  })
  app.get("/http-exception-400", () => {
    throw new HTTPException(400, {
      message: "Malformed JSON in request body",
    })
  })
  app.get("/unknown-error", () => {
    throw new Error("Something totally unexpected")
  })

  return app
}

// ---------------------------------------------------------------------------
// ApiError class (unit)
// ---------------------------------------------------------------------------
describe("ApiError", () => {
  it("stores status, slug, and message as instance properties", () => {
    const err = new ApiError(404, "not-found", "Resource missing.")
    expect(err.status).toBe(404)
    expect(err.slug).toBe("not-found")
    expect(err.message).toBe("Resource missing.")
  })

  it("stores optional extras", () => {
    const err = new ApiError(409, "conflict", "Duplicate.", { id: "x" })
    expect(err.extras).toEqual({ id: "x" })
  })

  it("has name === ApiError", () => {
    const err = new ApiError(400, "validation-failed", "Bad.")
    expect(err.name).toBe("ApiError")
  })

  it("is an instance of Error", () => {
    const err = new ApiError(500, "internal-error", "Oops.")
    expect(err).toBeInstanceOf(Error)
  })

  it("extras is undefined when not provided", () => {
    const err = new ApiError(400, "validation-failed", "Bad.")
    expect(err.extras).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// createErrorHandler (integration)
// ---------------------------------------------------------------------------
describe("createErrorHandler", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("maps ApiError to the correct HTTP status and problem+json body", async () => {
    const app = makeTestApp()
    const res = await app.request("/api-error")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.type).toBe(`${APP_URL}/problems/unprocessable-entity`)
    expect(body.detail).toBe("Bad input.")
    expect(body.status).toBe(422)
  })

  it("response Content-Type is application/problem+json for ApiError", async () => {
    const app = makeTestApp()
    const res = await app.request("/api-error")
    expect(res.headers.get("content-type")).toContain("application/problem+json")
  })

  it("includes instance equal to the request path in the body", async () => {
    const app = makeTestApp()
    const res = await app.request("/api-error")
    const body = await res.json()
    expect(body.instance).toBe("/api-error")
  })

  it("includes a non-empty error_id in the body", async () => {
    const app = makeTestApp()
    const res = await app.request("/api-error")
    const body = await res.json()
    expect(typeof body.error_id).toBe("string")
    expect(body.error_id.length).toBeGreaterThan(0)
  })

  it("merges ApiError extras into the response body", async () => {
    const app = makeTestApp()
    const res = await app.request("/api-error-with-extras")
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.conflicting_id).toBe("abc-123")
  })

  it("maps known permission-denied message to 403 forbidden", async () => {
    const app = makeTestApp()
    const res = await app.request("/permission-denied")
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.type).toContain("forbidden")
  })

  it("maps nested cause with permission-denied message to 403", async () => {
    const app = makeTestApp()
    const res = await app.request("/permission-denied-wrapped")
    expect(res.status).toBe(403)
  })

  it("maps the alternate permission-denied message to 403", async () => {
    const app = makeTestApp()
    const res = await app.request("/permission-denied-message-variant")
    expect(res.status).toBe(403)
  })

  it("maps a 400 HTTPException (malformed JSON) to 400 validation-failed", async () => {
    const app = makeTestApp()
    const res = await app.request("/http-exception-400")
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.type).toContain("validation-failed")
  })

  it("maps unknown errors to 500 internal-error", async () => {
    const app = makeTestApp()
    const res = await app.request("/unknown-error")
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.type).toContain("internal-error")
  })

  it("logs unhandled errors to console.error", async () => {
    const app = makeTestApp()
    await app.request("/unknown-error")
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// createNotFoundHandler (integration)
// ---------------------------------------------------------------------------
describe("createNotFoundHandler", () => {
  it("returns 404 for an unmatched path", async () => {
    const app = makeTestApp()
    const res = await app.request("/does-not-exist")
    expect(res.status).toBe(404)
  })

  it("response body has type containing not-found", async () => {
    const app = makeTestApp()
    const res = await app.request("/does-not-exist")
    const body = await res.json()
    expect(body.type).toContain("not-found")
  })

  it("response body detail includes the requested path", async () => {
    const app = makeTestApp()
    const res = await app.request("/does-not-exist")
    const body = await res.json()
    expect(body.detail).toContain("/does-not-exist")
  })

  it("response Content-Type is application/problem+json", async () => {
    const app = makeTestApp()
    const res = await app.request("/does-not-exist")
    expect(res.headers.get("content-type")).toContain("application/problem+json")
  })
})

// ---------------------------------------------------------------------------
// Malformed JSON via the full API (regression for the 500 -> 400 fix)
// ---------------------------------------------------------------------------
describe("createErrorHandler: malformed JSON via full API", () => {
  it("returns 400 validation-failed for a POST with malformed JSON body", async () => {
    const { createFdmApi } = await import("../index")
    const mockFdm = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
    } as any
    const mockAuth = {
      api: {
        verifyApiKey: vi.fn().mockResolvedValue({
          valid: true,
          error: null,
          key: {
            id: "key-1",
            referenceId: "user-1",
            name: "Test key",
          },
        }),
      },
    } as any
    const app = createFdmApi(mockFdm, mockAuth, {
      appName: "Test App",
      appUrl: "https://test.example.com",
    })
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await app.request("/farms", {
      method: "POST",
      headers: {
        "x-api-key": "valid",
        "content-type": "application/json",
      },
      body: "{ not valid json }",
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.type).toContain("validation-failed")
    consoleErrorSpy.mockRestore()
  })
})
