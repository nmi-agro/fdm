// Reverse proxy for PostHog under /ingest, so analytics requests are first-party.
//
// Plain JavaScript, so `server.js` can mount it as Express middleware in front of the React Router
// handler. Analytics traffic (events, session recordings, feature flags) then skips the
// compression middleware and the React Router request handling. The `/ingest/*` route uses the
// same function, for `react-router dev`, which does not run `server.js`.

import { pipeline, Readable } from "node:stream"

/** Requests with a larger body are refused. */
const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10 MB

/** A request to PostHog that takes longer is aborted. */
const TIMEOUT_MS = 60_000

/** Headers that apply to one connection only and are never forwarded, in either direction. */
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-connection",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]

/**
 * Removes the hop-by-hop headers, including every header that `Connection` names, in place.
 *
 * @param {Headers} headers - The headers to clean.
 */
function removeHopByHopHeaders(headers) {
  const nominated = (headers.get("connection") ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
  for (const name of [...HOP_BY_HOP_HEADERS, ...nominated]) headers.delete(name)
}

/** Thrown while streaming a request body that turns out to exceed {@link MAX_BODY_SIZE}. */
class BodyTooLargeError extends Error {}

/**
 * Passes a request body through while counting its bytes, so a body without a (truthful)
 * `Content-Length` header is also limited to {@link MAX_BODY_SIZE}.
 *
 * @param {ReadableStream | AsyncIterable<Uint8Array>} source - The request body.
 * @returns {{ body: AsyncGenerator<Uint8Array>, tooLarge: Promise<boolean> }} The same chunks,
 *   until the limit is exceeded, and a promise that settles once the body has been read: `true`
 *   when it was too large.
 */
function limitBodySize(source) {
  /** @type {(tooLarge: boolean) => void} */
  let settle = () => {}
  const tooLarge = new Promise((resolve) => {
    settle = resolve
  })
  async function* chunks() {
    let total = 0
    try {
      for await (const chunk of source) {
        total += chunk.byteLength
        if (total > MAX_BODY_SIZE) {
          settle(true)
          throw new BodyTooLargeError("Request too large")
        }
        yield chunk
      }
    } finally {
      // No effect when the body was too large: a promise settles only once
      settle(false)
    }
  }
  return { body: chunks(), tooLarge }
}

/**
 * Returns the response body as a stream that calls `onEnd` once the body is complete, fails or is
 * cancelled, so the request timeout also covers the transfer of the body.
 *
 * @param {ReadableStream<Uint8Array>} body - The response body of PostHog.
 * @param {() => void} onEnd - Called once when the body has ended.
 * @returns {ReadableStream<Uint8Array>}
 */
function onBodyEnd(body, onEnd) {
  const reader = body.getReader()
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          onEnd()
          controller.close()
        } else {
          controller.enqueue(value)
        }
      } catch (error) {
        onEnd()
        controller.error(error)
      }
    },
    cancel(reason) {
      onEnd()
      return reader.cancel(reason)
    },
  })
}

/**
 * Forwards a request under `/ingest` to PostHog.
 *
 * Static assets (`/ingest/static/*`) go to the PostHog assets host, everything else to the API
 * host. Cookies, authorization and hop-by-hop headers (also those that `Connection` names) are
 * not forwarded, in either direction; the client IP is passed on as `x-real-ip`. A body larger
 * than 10 MB is refused with 413, also when it has no `Content-Length`. The 60 s timeout covers
 * the whole exchange, including the response body.
 *
 * @param {object} request - The incoming request.
 * @param {string} request.method - The HTTP method.
 * @param {URL} request.url - The full URL of the request, with the `/ingest` prefix.
 * @param {Headers} request.headers - The request headers.
 * @param {ReadableStream | AsyncIterable<Uint8Array> | null} request.body - The request body.
 * @param {string} posthogHost - The PostHog API host, such as `https://eu.i.posthog.com`.
 * @returns {Promise<Response>} The response of PostHog, or a 413, 503 or 504 response.
 */
export async function proxyToPosthog({ method, url, headers: requestHeaders, body }, posthogHost) {
  const contentLength = requestHeaders.get("content-length")
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return new Response("Request too large", { status: 413 })
  }

  const apiHost = posthogHost.replace("https://", "")
  const assetHost = apiHost.replace(/^([a-z]{2})\./, "$1-assets.")
  const hostname = url.pathname.startsWith("/ingest/static/") ? assetHost : apiHost

  // Only the path and the query come from the request; the origin is always PostHog's. The path
  // starts with "/" after the prefix is removed, so it can never change the host.
  const path = url.pathname.replace(/^\/ingest(?=\/|$)/, "") || "/"
  const targetUrl = new URL(`https://${hostname}${path.startsWith("/") ? path : `/${path}`}`)
  targetUrl.search = url.search

  const headers = new Headers(requestHeaders)
  headers.set("host", hostname)
  const xForwardedFor = requestHeaders.get("x-forwarded-for")
  if (xForwardedFor) {
    headers.set("x-real-ip", xForwardedFor.split(",")[0].trim())
  }
  removeHopByHopHeaders(headers)
  for (const name of ["accept-encoding", "authorization", "cookie", "expect"]) {
    headers.delete(name)
  }
  const hasBody = body !== null && method !== "GET" && method !== "HEAD"
  // Let fetch determine the length of a streamed body
  if (hasBody) headers.delete("content-length")

  // The timeout covers the whole exchange, including the transfer of the response body
  const controller = new AbortController()
  const upload = hasBody ? limitBodySize(body) : null
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(targetUrl, {
      method,
      headers,
      body: upload ? upload.body : undefined,
      signal: controller.signal,
      duplex: "half",
    })
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof BodyTooLargeError || error?.cause instanceof BodyTooLargeError) {
      return new Response("Request too large", { status: 413 })
    }
    if (error instanceof Error && error.name === "AbortError") {
      console.error("PostHog proxy timeout after 60s")
      return new Response("PostHog proxy timeout", {
        status: 504,
        statusText: "Gateway Timeout",
      })
    }
    console.error("PostHog proxy error:", error)
    return new Response("Service unavailable", {
      status: 503,
      statusText: "PostHog proxy error",
    })
  }

  // PostHog may answer before it has read the whole upload. Wait until the body has been read, so
  // an upload that turns out too large is still answered with 413 instead of PostHog's response.
  if (upload) {
    /** @type {Promise<"timeout">} */
    const timedOut = new Promise((resolve) => {
      if (controller.signal.aborted) resolve("timeout")
      controller.signal.addEventListener("abort", () => resolve("timeout"), { once: true })
    })
    const outcome = await Promise.race([
      upload.tooLarge.then((tooLarge) => (tooLarge ? "too-large" : "read")),
      timedOut,
    ])
    if (outcome !== "read") {
      clearTimeout(timeoutId)
      response.body?.cancel().catch(() => undefined)
      if (outcome === "too-large") return new Response("Request too large", { status: 413 })
      console.error("PostHog proxy timeout after 60s")
      return new Response("PostHog proxy timeout", { status: 504, statusText: "Gateway Timeout" })
    }
  }

  const responseHeaders = new Headers(response.headers)
  removeHopByHopHeaders(responseHeaders)
  responseHeaders.delete("content-encoding")
  responseHeaders.delete("content-length")
  if (!response.body) clearTimeout(timeoutId)
  return new Response(
    response.body ? onBodyEnd(response.body, () => clearTimeout(timeoutId)) : null,
    {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    },
  )
}

/**
 * Creates Express middleware that forwards every request it receives to PostHog. Mount it on
 * `/ingest` before the compression middleware and the React Router handler.
 *
 * @param {string} posthogHost - The PostHog API host, such as `https://eu.i.posthog.com`.
 * @returns {(req: import("express").Request, res: import("express").Response) => Promise<void>}
 */
export function createPosthogProxyMiddleware(posthogHost) {
  return async (req, res) => {
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers)) {
      if (value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item)
    }
    // Only the path and query of the URL are used, so the request's Host header is not needed
    const url = new URL(req.originalUrl, "http://localhost")

    const response = await proxyToPosthog(
      { method: req.method, url, headers, body: req },
      posthogHost,
    )

    res.status(response.status)
    if (response.statusText) res.statusMessage = response.statusText
    response.headers.forEach((value, name) => {
      // `set-cookie` may hold several values, which `forEach` joins
      if (name !== "set-cookie") res.setHeader(name, value)
    })
    const cookies = response.headers.getSetCookie()
    if (cookies.length > 0) res.setHeader("set-cookie", cookies)

    if (!response.body) {
      res.end()
      return
    }
    // `pipeline` also destroys the upstream body when the browser disconnects early
    pipeline(Readable.fromWeb(response.body), res, (error) => {
      if (error && error.code !== "ERR_STREAM_PREMATURE_CLOSE") {
        console.error("PostHog proxy response error:", error)
      }
    })
  }
}
