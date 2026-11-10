import { describe, expect, it } from "vitest"
import {
  getSafeRedirect,
  getSearchParams,
  isOfOrigin,
  maskSecretsDeep,
  maskUrlSecrets,
  modifySearchParams,
  normalizePage,
  stripDataSuffix,
  stripDataSuffixFromAddress,
} from "./url-utils"

describe("modifySearchParams", () => {
  it("keeps the format of the input", () => {
    const add = (p: URLSearchParams) => p.set("a", "1")
    expect(modifySearchParams("/farm?b=2", add)).toBe("/farm?b=2&a=1")
    expect(modifySearchParams("farm", add)).toBe("farm?a=1")
    expect(modifySearchParams("https://example.com/farm#top", add)).toBe(
      "https://example.com/farm?a=1#top",
    )
  })
})

describe("getSearchParams", () => {
  it("returns the search params of a path or URL", () => {
    expect(getSearchParams("/farm?year=2025").get("year")).toBe("2025")
    expect(getSearchParams("https://example.com/?q=x").get("q")).toBe("x")
  })

  it("returns empty params for an empty string", () => {
    expect([...getSearchParams("").keys()]).toEqual([])
  })
})

describe("maskUrlSecrets", () => {
  it("masks long opaque path segments and secret query values", () => {
    expect(maskUrlSecrets("/organization/invitations/AbCdEf1234567890XyZ12/respond")).toBe(
      "/organization/invitations/:token/respond",
    )
    expect(maskUrlSecrets("/signin/verify?code=123456&redirectTo=/farm")).toBe(
      "/signin/verify?code=:token&redirectTo=/farm",
    )
  })

  it("leaves readable route segments alone", () => {
    const path = "/farm/create/fields/soil-analysis-bulk-upload"
    expect(maskUrlSecrets(path)).toBe(path)
  })

  it("masks a token followed by React Router's .data suffix", () => {
    expect(maskUrlSecrets("/invitations/AbCdEf1234567890XyZ12.data")).toBe(
      "/invitations/:token.data",
    )
  })
})

describe("maskSecretsDeep", () => {
  it("masks strings in nested arrays and plain objects", () => {
    const masked = maskSecretsDeep({
      url: "/x?token=abc",
      list: ["/y?secret=def", 3],
      nested: { message: "visited /z?code=999" },
    })
    expect(masked).toEqual({
      url: "/x?token=:token",
      list: ["/y?secret=:token", 3],
      nested: { message: "visited /z?code=:token" },
    })
  })

  it("returns class instances unchanged", () => {
    const date = new Date(0)
    expect(maskSecretsDeep({ date }).date).toBe(date)
  })
})

describe("normalizePage", () => {
  it("replaces ids, years, coordinates and organization slugs", () => {
    expect(normalizePage("/farm/bcdfghjkmnpqrtwz/2025/atlas/fields/5.66,51.97")).toBe(
      "/farm/:id/:year/atlas/fields/:centroid",
    )
    expect(normalizePage("/organization/my-coop/farms")).toBe("/organization/:slug/farms")
    expect(normalizePage("/organization/new")).toBe("/organization/new")
  })

  it("drops the query string and hash", () => {
    expect(normalizePage("/farm?x=1#y")).toBe("/farm")
  })
})

describe("isOfOrigin", () => {
  const origin = "https://app.example.com"

  it("accepts same-origin URLs and relative paths", () => {
    expect(isOfOrigin("/farm", origin)).toBe(true)
    expect(isOfOrigin("farm/1", origin)).toBe(true)
    expect(isOfOrigin("https://app.example.com/farm", origin)).toBe(true)
  })

  it("rejects other origins, protocol-relative and non-HTTP URLs", () => {
    expect(isOfOrigin("https://evil.example.com/", origin)).toBe(false)
    expect(isOfOrigin("//evil.example.com", origin)).toBe(false)
    expect(isOfOrigin("/\\evil.example.com", origin)).toBe(false)
    expect(isOfOrigin("javascript:alert(1)", origin)).toBe(false)
  })
})

describe("getSafeRedirect", () => {
  it("returns a root-relative path for safe input", () => {
    expect(getSafeRedirect("/farm/abc?x=1#y")).toBe("/farm/abc?x=1#y")
  })

  it("falls back to /farm for missing or foreign input", () => {
    expect(getSafeRedirect(null)).toBe("/farm")
    expect(getSafeRedirect(undefined)).toBe("/farm")
    expect(getSafeRedirect("https://evil.example.com")).toBe("/farm")
    expect(getSafeRedirect("//evil.example.com")).toBe("/farm")
    expect(getSafeRedirect("/\\evil.example.com")).toBe("/farm")
  })
})

describe("stripDataSuffix", () => {
  it("removes React Router's .data suffixes", () => {
    expect(stripDataSuffix("/farm/abc/fertilizers.data")).toBe("/farm/abc/fertilizers")
    expect(stripDataSuffix("/_.data")).toBe("/")
    expect(stripDataSuffix("/farm")).toBe("/farm")
  })

  it("keeps the query string and hash of a full address", () => {
    expect(stripDataSuffixFromAddress("/farm/abc.data?a=1#top")).toBe("/farm/abc?a=1#top")
    expect(stripDataSuffixFromAddress("/farm/abc.data")).toBe("/farm/abc")
  })
})
