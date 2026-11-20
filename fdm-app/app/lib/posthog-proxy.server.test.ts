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
    const body = init.body ? await readBody(init.body) : ""
    calls.push({ url: url.toString(), init, body })
    return response
  })
  return calls
}

/** Reads a request body that is either a regular body or an async iterable of chunks. */
async function readBody(body: unknown): Promise<string> {
  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    const chunks: Uint8Array[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk)
    return Buffer.concat(chunks).toString()
  }
  return new Response(body as BodyInit).text()
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

  it("always sends the request to the PostHog host, whatever the path or Host header", async () => {
    const calls = stubPosthog(new Response("ok"))
    await proxyToPosthog(
      {
        method: "GET",
        url: new URL("http://attacker.example//evil.example/path?x=1"),
        headers: new Headers({ host: "attacker.example" }),
        body: null,
      },
      POSTHOG_HOST,
    )
    const target = new URL(calls[0].url)
    expect(target.origin).toBe("https://eu.i.posthog.com")
    expect(new Headers(calls[0].init.headers).get("host")).toBe("eu.i.posthog.com")
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

  it("refuses a streamed body without Content-Length that grows too large", async () => {
    stubPosthog(new Response("ok"))
    const chunk = new Uint8Array(1024 * 1024)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 11; i++) controller.enqueue(chunk)
        controller.close()
      },
    })
    const response = await proxyToPosthog(
      { method: "POST", url: new URL("http://localhost/ingest/s/"), headers: new Headers(), body },
      POSTHOG_HOST,
    )
    expect(response.status).toBe(413)
  })

  it("answers 413 when PostHog answers before an upload turns out too large", async () => {
    // PostHog sends its response at once and reads the upload in the background
    vi.stubGlobal("fetch", async (_url: URL, init: RequestInit) => {
      void readBody(init.body).catch(() => undefined)
      return new Response("ok", { status: 200 })
    })
    const chunk = new Uint8Array(1024 * 1024)
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let i = 0; i < 11; i++) {
          await new Promise((resolve) => setTimeout(resolve, 5))
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })
    const response = await proxyToPosthog(
      { method: "POST", url: new URL("http://localhost/ingest/s/"), headers: new Headers(), body },
      POSTHOG_HOST,
    )
    expect(response.status).toBe(413)
  })

  it("does not forward hop-by-hop headers or headers that Connection names", async () => {
    const calls = stubPosthog(
      new Response("ok", {
        headers: { connection: "x-upstream-hop", "x-upstream-hop": "1", "x-kept": "1" },
      }),
    )
    const response = await proxyToPosthog(
      {
        method: "GET",
        url: new URL("http://localhost/ingest/flags/"),
        headers: new Headers({ connection: "x-hop", "x-hop": "local", "keep-alive": "5" }),
        body: null,
      },
      POSTHOG_HOST,
    )
    const forwarded = new Headers(calls[0].init.headers)
    expect(forwarded.get("x-hop")).toBeNull()
    expect(forwarded.get("connection")).toBeNull()
    expect(forwarded.get("keep-alive")).toBeNull()
    expect(response.headers.get("x-upstream-hop")).toBeNull()
    expect(response.headers.get("connection")).toBeNull()
    expect(response.headers.get("x-kept")).toBe("1")
  })

  it("keeps the timeout active while the response body is transferred", async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal("fetch", async (_url: URL, init: RequestInit) => {
        // Headers arrive at once, but the body never ends until the request is aborted
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            init.signal?.addEventListener("abort", () =>
              controller.error(new DOMException("aborted", "AbortError")),
            )
          },
        })
        return new Response(body)
      })
      const response = await proxyToPosthog(
        {
          method: "GET",
          url: new URL("http://localhost/ingest/static/array.js"),
          headers: new Headers(),
          body: null,
        },
        POSTHOG_HOST,
      )
      const bodyFails = expect(response.text()).rejects.toThrow()
      await vi.advanceTimersByTimeAsync(60_000)
      await bodyFails
    } finally {
      vi.useRealTimers()
    }
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
  it("cancels the PostHog response when the browser disconnects", async () => {
    let cancelled = false
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("first chunk"))
      },
      cancel() {
        cancelled = true
      },
    })
    stubPosthog(new Response(upstream, { status: 200 }))
    const app = express()
    app.use("/ingest", createPosthogProxyMiddleware(POSTHOG_HOST))
    const server = app.listen(0)
    try {
      const { port } = server.address() as AddressInfo
      const controller = new AbortController()
      const response = await realFetch(`http://127.0.0.1:${port}/ingest/static/array.js`, {
        signal: controller.signal,
      })
      const reader = response.body!.getReader()
      await reader.read()
      controller.abort()
      await vi.waitFor(() => expect(cancelled).toBe(true))
    } finally {
      server.close()
    }
  })

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
