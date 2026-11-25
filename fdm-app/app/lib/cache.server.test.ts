import type { EntryContext } from "react-router"
import { describe, expect, it } from "vitest"
import { applyCacheControlHeaders, getCacheControlHeaders } from "./cache.server"

/** Returns the Cache-Control header that a document request to `path` gets. */
function cacheControlFor(path: string, method = "GET"): string | null {
  const request = new Request(`https://example.com${path}`, { method })
  return getCacheControlHeaders(request, {} as EntryContext).get("Cache-Control")
}

describe("getCacheControlHeaders", () => {
  it.each(["/manual", "/manual/bemestingsplan", "/manual/background/stikstof"])(
    "lets the browser keep the manual page %s for at most an hour",
    (path) => {
      expect(cacheControlFor(path)).toBe("private, max-age=3600")
    },
  )

  it.each(["/signin", "/signin/check-your-email", "/signin/verify", "/privacy"])(
    "revalidates the public page %s on every request",
    (path) => {
      expect(cacheControlFor(path)).toBe("no-cache")
    },
  )

  it.each([
    "/",
    "/welcome",
    "/about",
    "/about/whats-new",
    "/organization",
    "/organization/demo/members",
    "/support",
    "/user",
    "/user/api-keys",
    "/farm",
    "/farm/abc123/2026/field",
  ])("keeps the signed-in page %s private and revalidates it on every request", (path) => {
    expect(cacheControlFor(path)).toBe("private, no-cache")
  })

  it("does not treat a look-alike path as a public section", () => {
    expect(cacheControlFor("/signinx")).toBe("private, no-cache")
  })

  it.each(["/assets/missing-abc123.js", "/api/unknown"])(
    "does not cache the 404 page for the missing path %s",
    (path) => {
      expect(cacheControlFor(path)).toBe("private, no-cache")
    },
  )

  it.each(["POST", "PUT", "DELETE"])(
    "never stores the response to a %s on a farm page",
    (method) => {
      expect(cacheControlFor("/farm/abc123/2026/field", method)).toBe(
        "no-store, no-cache, must-revalidate",
      )
    },
  )

  it("gives a HEAD request on a farm page the same header as a GET", () => {
    expect(cacheControlFor("/farm/abc123/2026/field", "HEAD")).toBe("private, no-cache")
  })
})

describe("applyCacheControlHeaders", () => {
  it("replaces the Cache-Control that a route set with a single value", () => {
    const responseHeaders = new Headers({ "Cache-Control": "public, max-age=600" })
    applyCacheControlHeaders(
      new Request("https://example.com/manual"),
      {} as EntryContext,
      responseHeaders,
    )
    expect(responseHeaders.get("Cache-Control")).toBe("private, max-age=3600")
  })

  it("keeps the other response headers", () => {
    const responseHeaders = new Headers({ "Set-Cookie": "toast-session=e30%3D; Path=/" })
    applyCacheControlHeaders(
      new Request("https://example.com/signin"),
      {} as EntryContext,
      responseHeaders,
    )
    expect(responseHeaders.get("Set-Cookie")).toBe("toast-session=e30%3D; Path=/")
    expect(responseHeaders.get("Cache-Control")).toBe("no-cache")
  })
})
