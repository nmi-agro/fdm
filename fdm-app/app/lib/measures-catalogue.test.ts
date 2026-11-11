import { describe, expect, it } from "vitest"
import {
  getAddMeasurePath,
  getMeasureCataloguePath,
  getMeasuresCataloguePath,
} from "./measures-catalogue"

describe("measures catalogue paths", () => {
  it("builds the catalogue and detail paths", () => {
    expect(getMeasuresCataloguePath("farm1", "2026")).toBe("/farm/farm1/2026/measures/catalogue")
    expect(getMeasureCataloguePath("farm1", "2026", "bln_BM7")).toBe(
      "/farm/farm1/2026/measures/catalogue/bln_BM7",
    )
  })

  it("opens the add dialog on a measure without fields", () => {
    expect(getAddMeasurePath("farm1", "2026", "bln_BM7")).toBe(
      "/farm/farm1/2026/measures?openMeasure=bln_BM7",
    )
  })

  it("preselects fields in the add dialog", () => {
    const path = getAddMeasurePath("farm1", "2026", "bln_BM7", ["f1", "f2"])
    const params = new URL(path, "https://example.org").searchParams
    expect(params.get("openMeasure")).toBe("bln_BM7")
    expect(params.get("fields")).toBe("f1,f2")
  })
})
