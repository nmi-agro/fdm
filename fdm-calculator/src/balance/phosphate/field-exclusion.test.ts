import { describe, expect, it } from "vitest"
import { getPhosphateFieldExclusion } from "./field"

const timeFrame = { start: new Date("2026-01-01"), end: new Date("2026-12-31") }

function input(
  cultivations: { b_lu_catalogue: string; b_lu_croprotation: string }[],
  b_bufferstrip = false,
) {
  return {
    field: { b_id: "f1", b_area: 1, b_bufferstrip },
    cultivations: cultivations.map((c, i) => ({
      b_lu: `lu${i}`,
      b_lu_name: c.b_lu_catalogue,
      m_cropresidue: null,
      b_lu_start: new Date("2025-01-01"),
      b_lu_end: null,
      ...c,
    })),
  } as unknown as Parameters<typeof getPhosphateFieldExclusion>[0]
}

describe("getPhosphateFieldExclusion", () => {
  it("should exclude buffer strips", () => {
    expect(
      getPhosphateFieldExclusion(
        input([{ b_lu_catalogue: "nl_265", b_lu_croprotation: "grass" }], true),
        timeFrame,
      ),
    ).toBe("bufferstrip")
  })

  it("should exclude a field whose main cultivation is a nature cultivation", () => {
    expect(
      getPhosphateFieldExclusion(
        input([{ b_lu_catalogue: "nl_6798", b_lu_croprotation: "nature" }]),
        timeFrame,
      ),
    ).toBe("nature")
  })

  it("should exclude a field whose main cultivation is a landscape element", () => {
    expect(
      getPhosphateFieldExclusion(
        input([{ b_lu_catalogue: "nl_2617", b_lu_croprotation: "other" }]),
        timeFrame,
      ),
    ).toBe("landscape_element")
  })

  it("should include a field with an agricultural main cultivation", () => {
    expect(
      getPhosphateFieldExclusion(
        input([{ b_lu_catalogue: "nl_265", b_lu_croprotation: "grass" }]),
        timeFrame,
      ),
    ).toBeNull()
  })
})
