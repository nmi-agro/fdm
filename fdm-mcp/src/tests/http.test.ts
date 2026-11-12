/**
 * Tests for the HTTP layer of the MCP endpoint: authentication, the Origin check, methods,
 * CORS and the service endpoints.
 */
import { describe, expect, it, vi } from "vitest"
import { connect, makeApp } from "./helpers"

const listTools = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
const postHeaders = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
}

describe("authentication", () => {
  it("returns 401 with a WWW-Authenticate challenge without an API key", async () => {
    const { app, auth } = makeApp()
    const res = await app.request("/mcp", { method: "POST", headers: postHeaders, body: listTools })
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toBe('Bearer realm="Test App"')
    expect(res.headers.get("content-type")).toContain("application/problem+json")
    expect(auth.api.verifyApiKey).not.toHaveBeenCalled()
  })

  it("refuses a request without an API key before it reads the body", async () => {
    const { app } = makeApp()
    // Larger than the body limit: with the key check first, the answer is 401 and not 413.
    const res = await app.request("/mcp", {
      method: "POST",
      headers: postHeaders,
      body: "x".repeat(6 * 1024 * 1024),
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 with a WWW-Authenticate challenge for an invalid API key", async () => {
    const auth = {
      api: { verifyApiKey: vi.fn().mockResolvedValue({ valid: false, error: null, key: null }) },
    }
    const { app } = makeApp({}, { auth })
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { ...postHeaders, "x-api-key": "wrong" },
      body: listTools,
    })
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toBe('Bearer realm="Test App"')
  })

  it("returns 400 when both X-API-Key and Authorization are sent", async () => {
    const { app } = makeApp()
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { ...postHeaders, "x-api-key": "a", authorization: "Bearer b" },
      body: listTools,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).type).toContain("ambiguous-api-key")
  })

  it.each([
    ["X-API-Key", { "x-api-key": "key" }],
    ["Authorization: Bearer", { authorization: "Bearer key" }],
  ])("accepts the API key as %s", async (_name, headers) => {
    const { app } = makeApp()
    const client = await connect(app, { headers })
    const { tools } = await client.listTools()
    expect(tools.length).toBeGreaterThan(0)
    await client.close()
  })
})

describe("Origin check", () => {
  it("accepts requests without an Origin header", async () => {
    const { app } = makeApp()
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { ...postHeaders, "x-api-key": "key" },
      body: listTools,
    })
    expect(res.status).not.toBe(403)
  })

  it("refuses a web page origin that is not allowed", async () => {
    const { app } = makeApp({}, { config: { allowedOrigins: ["https://app.example.com"] } })
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { ...postHeaders, "x-api-key": "key", origin: "https://evil.example" },
      body: listTools,
    })
    expect(res.status).toBe(403)
  })

  it("accepts an allowed origin", async () => {
    const { app } = makeApp({}, { config: { allowedOrigins: ["https://app.example.com"] } })
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { ...postHeaders, "x-api-key": "key", origin: "https://app.example.com" },
      body: listTools,
    })
    expect(res.status).not.toBe(403)
  })

  it("only accepts localhost origins when no origins are configured", async () => {
    const { app } = makeApp()
    const refused = await app.request("/mcp", {
      method: "POST",
      headers: { ...postHeaders, "x-api-key": "key", origin: "https://app.example.com" },
      body: listTools,
    })
    expect(refused.status).toBe(403)
    const accepted = await app.request("/mcp", {
      method: "POST",
      headers: { ...postHeaders, "x-api-key": "key", origin: "http://localhost:6274" },
      body: listTools,
    })
    expect(accepted.status).not.toBe(403)
  })
})

describe("methods and endpoints", () => {
  it("answers GET on the MCP endpoint with 405, as a stateless server", async () => {
    const { app } = makeApp()
    const res = await app.request("/mcp", {
      headers: { "x-api-key": "key", accept: "text/event-stream" },
    })
    expect(res.status).toBe(405)
  })

  it("answers a body that is not JSON with a JSON-RPC parse error", async () => {
    const { app } = makeApp()
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { ...postHeaders, "x-api-key": "key" },
      body: "{not json",
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe(-32700)
  })

  it.each([
    ["POST", "/register"],
    ["GET", "/authorize"],
    ["POST", "/token"],
    ["GET", "/.well-known/oauth-authorization-server"],
    ["GET", "/.well-known/oauth-protected-resource/mcp"],
  ])("tells a client that tries OAuth (%s %s) to use an API key", async (method, path) => {
    const { app } = makeApp()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const res = await app.request(path, { method })
    // Clients probe on every connection, so the answer is not logged.
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
    expect(res.status).toBe(404)
    expect(res.headers.get("content-type")).toContain("application/problem+json")
    expect((await res.json()).detail).toContain("X-API-Key")
  })

  it("serves the health check and server info without an API key", async () => {
    const { app } = makeApp()
    expect((await app.request("/health")).status).toBe(200)
    const info = await app.request("/")
    expect(info.status).toBe(200)
    expect(await info.json()).toMatchObject({ name: "Test App", endpoint: "/mcp" })
  })

  it("accepts the MCP headers in a CORS preflight", async () => {
    const { app } = makeApp({}, { config: { allowedOrigins: ["https://app.example.com"] } })
    const res = await app.request("/mcp", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "mcp-method,mcp-name,mcp-protocol-version,x-api-key",
      },
    })
    expect(res.status).toBe(204)
    const allowed = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase()
    for (const header of ["mcp-method", "mcp-name", "mcp-protocol-version", "x-api-key"]) {
      expect(allowed).toContain(header)
    }
  })
})
