import { describe, expect, it } from "vitest"
import { getFieldExclusionReason } from "./field-exclusion"

describe("getFieldExclusionReason", () => {
  it("returns bufferstrip for buffer strips, also when the cultivation is a landscape element", () => {
    expect(getFieldExclusionReason({ b_bufferstrip: true, b_lu_catalogue: "nl_2638" })).toBe(
      "bufferstrip",
    )
  })

  it.each(["nl_343", "nl_794", "nl_795", "nl_2628", "nl_6801", "nl_2638"])(
    "returns landscape_element for %s",
    (b_lu_catalogue) => {
      expect(getFieldExclusionReason({ b_lu_catalogue, b_lu_croprotation: "other" })).toBe(
        "landscape_element",
      )
    },
  )

  it("returns nature for nature cultivations that are not landscape elements", () => {
    expect(
      getFieldExclusionReason({ b_lu_catalogue: "nl_6798", b_lu_croprotation: "nature" }),
    ).toBe("nature")
  })

  it("returns null for productive fields", () => {
    expect(
      getFieldExclusionReason({ b_lu_catalogue: "nl_233", b_lu_croprotation: "cereal" }),
    ).toBeNull()
  })
})
