// Reverse proxy for PostHog under /ingest, so analytics requests are first-party.
//
// Plain JavaScript, so `server.js` can mount it as Express middleware in front of the React Router
// handler. Analytics traffic (events, session recordings, feature flags) then skips the
// compression middleware and the React Router request handling. The `/ingest/*` route uses the
// same function, for `react-router dev`, which does not run `server.js`.

import { Readable } from "node:stream"

/** Requests with a larger body are refused. */
const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10 MB

/** A request to PostHog that takes longer is aborted. */
const TIMEOUT_MS = 60_000

/** Response headers that apply to one connection only and are not passed on. */
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
])

/**
 * Forwards a request under `/ingest` to PostHog.
 *
 * Static assets (`/ingest/static/*`) go to the PostHog assets host, everything else to the API
 * host. Cookies, authorization and other hop-specific headers are not forwarded; the client IP
 * is passed on as `x-real-ip`.
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
  for (const name of [
    "accept-encoding",
    "proxy-authorization",
    "authorization",
    "cookie",
    "upgrade",
    // Hop-by-hop headers of the incoming connection, which fetch does not accept
    "connection",
    "keep-alive",
    "transfer-encoding",
    "expect",
  ]) {
    headers.delete(name)
  }
  const hasBody = body !== null && method !== "GET" && method !== "HEAD"
  // Let fetch determine the length of a streamed body
  if (hasBody) headers.delete("content-length")

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? body : undefined,
      signal: controller.signal,
      duplex: "half",
    })
  } catch (error) {
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
  } finally {
    clearTimeout(timeoutId)
  }

  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete("content-encoding")
  responseHeaders.delete("content-length")
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
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
      // `set-cookie` may hold several values, which `forEach` joins. Hop-by-hop headers describe
      // the connection to PostHog, not the one to the browser.
      if (name === "set-cookie" || HOP_BY_HOP_HEADERS.has(name) || name.startsWith("proxy-")) return
      res.setHeader(name, value)
    })
    const cookies = response.headers.getSetCookie()
    if (cookies.length > 0) res.setHeader("set-cookie", cookies)

    if (!response.body) {
      res.end()
      return
    }
    Readable.fromWeb(response.body)
      .on("error", (error) => {
        console.error("PostHog proxy response error:", error)
        res.destroy(error)
      })
      .pipe(res)
  }
}
