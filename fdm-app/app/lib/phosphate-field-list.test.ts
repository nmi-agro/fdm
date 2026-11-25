import { describe, expect, it } from "vitest"
import {
  isPhosphateFieldListChange,
  readPhosphateFieldListState,
  writePhosphateFieldListState,
} from "./phosphate-field-list"

describe("readPhosphateFieldListState", () => {
  it("reads the filter and sorting from the URL", () => {
    expect(
      readPhosphateFieldListState(new URLSearchParams("verdict=adjust&sort=area:desc")),
    ).toEqual({ filter: "adjust", sort: { key: "area", dir: "desc" } })
  })

  it("falls back to all fields, most urgent first, for missing or unknown values", () => {
    const fallback = { filter: "all", sort: { key: "verdict", dir: "asc" } }
    expect(readPhosphateFieldListState(new URLSearchParams())).toEqual(fallback)
    expect(readPhosphateFieldListState(new URLSearchParams("verdict=x&sort=area:up"))).toEqual(
      fallback,
    )
  })
})

describe("writePhosphateFieldListState", () => {
  it("leaves the defaults out and keeps other parameters", () => {
    const next = writePhosphateFieldListState(new URLSearchParams("farmIds=a&verdict=good"), {
      filter: "all",
      sort: { key: "verdict", dir: "asc" },
    })
    expect(next.toString()).toBe("farmIds=a")
  })

  it("writes a filter and a sorting that differ from the defaults", () => {
    const next = writePhosphateFieldListState(new URLSearchParams(), {
      filter: "attention",
      sort: { key: "saldo", dir: "desc" },
    })
    expect(next.get("verdict")).toBe("attention")
    expect(next.get("sort")).toBe("saldo:desc")
  })
})

describe("isPhosphateFieldListChange", () => {
  const page = "https://app.test/farm/f1/2025/balance/phosphate"

  it("is true when only the filter or sorting changes", () => {
    expect(isPhosphateFieldListChange(new URL(page), new URL(`${page}?sort=area:desc`))).toBe(true)
    expect(
      isPhosphateFieldListChange(
        new URL(`${page}?verdict=good`),
        new URL(`${page}?verdict=adjust`),
      ),
    ).toBe(true)
  })

  it("is false for another page, another parameter or the same URL", () => {
    expect(isPhosphateFieldListChange(new URL(page), new URL(`${page}/f1?sort=area:desc`))).toBe(
      false,
    )
    expect(isPhosphateFieldListChange(new URL(page), new URL(`${page}?farmIds=a`))).toBe(false)
    expect(isPhosphateFieldListChange(new URL(page), new URL(page))).toBe(false)
  })
})
