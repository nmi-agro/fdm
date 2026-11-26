import { describe, expect, it } from "vitest"
import { classifyManualEntry } from "./analytics"

describe("classifyManualEntry", () => {
  const origin = "https://app.example.org"

  it("recognises navigation within the manual", () => {
    expect(classifyManualEntry(`${origin}/manual/bouwplan`, origin)).toBe("manual")
    expect(classifyManualEntry(`${origin}/manual`, origin)).toBe("manual")
  })

  it("recognises help opened from the app", () => {
    expect(classifyManualEntry(`${origin}/farm/abc/2026/rotation`, origin)).toBe("app")
    expect(classifyManualEntry(`${origin}/manualx`, origin)).toBe("app")
  })

  it("recognises other sites and missing referrers", () => {
    expect(classifyManualEntry("https://www.google.com/", origin)).toBe("external")
    expect(classifyManualEntry("", origin)).toBe("direct")
    expect(classifyManualEntry("not a url", origin)).toBe("direct")
  })
})
