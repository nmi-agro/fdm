import type { EntryContext } from "react-router"
import { describe, expect, it } from "vitest"
import { getCacheControlHeaders } from "./cache.server"

/** Returns the Cache-Control header that a document request to `path` gets. */
function cacheControlFor(path: string, method = "GET"): string | null {
  const request = new Request(`https://example.com${path}`, { method })
  return getCacheControlHeaders(request, {} as EntryContext).get("Cache-Control")
}

describe("getCacheControlHeaders", () => {
  it("caches static assets for a year", () => {
    expect(cacheControlFor("/assets/root-abc123.js")).toBe(
      "public, max-age=31536000, stale-while-revalidate=86400",
    )
  })

  it.each(["/api/farms", "/health"])("never stores %s", (path) => {
    expect(cacheControlFor(path)).toBe("no-store, no-cache, must-revalidate")
  })

  it.each(["/manual", "/manual/bemestingsplan", "/manual/background/stikstof"])(
    "caches the manual page %s for at most an hour",
    (path) => {
      expect(cacheControlFor(path)).toBe("public, max-age=3600")
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

  it.each(["POST", "PUT", "DELETE"])(
    "never stores the response to a %s on a farm page",
    (method) => {
      expect(cacheControlFor("/farm/abc123/2026/field", method)).toBe(
        "no-store, no-cache, must-revalidate",
      )
    },
  )
})
