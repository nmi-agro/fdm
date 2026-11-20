import type { AddressInfo } from "node:net"
import express from "express"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createPosthogProxyMiddleware, proxyToPosthog } from "./posthog-proxy.server"

const POSTHOG_HOST = "https://eu.i.posthog.com"
const realFetch = globalThis.fetch

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Replaces fetch with a fake PostHog that records the request and answers with `response`. */
function stubPosthog(response: Response) {
  const calls: { url: string; init: RequestInit; body: string }[] = []
  vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
    const body = init.body ? await new Response(init.body as BodyInit).text() : ""
    calls.push({ url: url.toString(), init, body })
    return response
  })
  return calls
}

describe("proxyToPosthog", () => {
  it("forwards a request to the PostHog API without cookies", async () => {
    const calls = stubPosthog(new Response("ok", { status: 200 }))

    const response = await proxyToPosthog(
      {
        method: "POST",
        url: new URL("http://localhost/ingest/i/v0/e/?ver=1"),
        headers: new Headers({
          cookie: "session=secret",
          "x-forwarded-for": "203.0.113.1, 10.0.0.1",
          "content-type": "application/json",
        }),
        body: new Response('{"event":"test"}').body,
      },
      POSTHOG_HOST,
    )

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe("https://eu.i.posthog.com/i/v0/e/?ver=1")
    expect(calls[0].body).toBe('{"event":"test"}')
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get("cookie")).toBeNull()
    expect(headers.get("x-real-ip")).toBe("203.0.113.1")
  })

  it("sends static assets to the assets host", async () => {
    const calls = stubPosthog(new Response("js"))
    await proxyToPosthog(
      {
        method: "GET",
        url: new URL("http://localhost/ingest/static/array.js"),
        headers: new Headers(),
        body: null,
      },
      POSTHOG_HOST,
    )
    expect(calls[0].url).toBe("https://eu-assets.i.posthog.com/static/array.js")
  })

  it("refuses a body that is too large", async () => {
    const calls = stubPosthog(new Response("ok"))
    const response = await proxyToPosthog(
      {
        method: "POST",
        url: new URL("http://localhost/ingest/s/"),
        headers: new Headers({ "content-length": String(11 * 1024 * 1024) }),
        body: null,
      },
      POSTHOG_HOST,
    )
    expect(response.status).toBe(413)
    expect(calls).toHaveLength(0)
  })

  it("answers 503 when PostHog cannot be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed")
    })
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const response = await proxyToPosthog(
      {
        method: "GET",
        url: new URL("http://localhost/ingest/flags/"),
        headers: new Headers(),
        body: null,
      },
      POSTHOG_HOST,
    )
    expect(response.status).toBe(503)
  })
})

describe("createPosthogProxyMiddleware", () => {
  it("proxies an Express request with its body and returns the PostHog response", async () => {
    const calls = stubPosthog(
      new Response('{"status":1}', {
        status: 200,
        headers: { "content-type": "application/json", "content-encoding": "gzip" },
      }),
    )
    const app = express()
    app.use("/ingest", createPosthogProxyMiddleware(POSTHOG_HOST))
    const server = app.listen(0)
    try {
      const { port } = server.address() as AddressInfo
      const response = await realFetch(`http://127.0.0.1:${port}/ingest/s/?compression=none`, {
        method: "POST",
        headers: { "content-type": "text/plain", cookie: "session=secret" },
        body: "recording",
      })

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('{"status":1}')
      expect(response.headers.get("content-encoding")).toBeNull()
      expect(calls[0].url).toBe("https://eu.i.posthog.com/s/?compression=none")
      expect(calls[0].body).toBe("recording")
      expect(new Headers(calls[0].init.headers).get("cookie")).toBeNull()
    } finally {
      server.close()
    }
  })
})
