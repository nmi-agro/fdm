import { describe, expect, it, vi } from "vitest"

// The status is a pure function; the module's database instance is not needed
vi.mock("~/lib/fdm.server", () => ({ fdm: {} }))

const { herdGrazingStatus } = await import("./herd-cards.server")

const day = (date: string) => `${date}T00:00:00.000Z`

describe("herdGrazingStatus", () => {
  it("grazes all day on a grazing of one day", () => {
    const grazing = {
      l_grazing_start: day("2026-06-15"),
      l_grazing_end: day("2026-06-15"),
      b_name: "Huiskavel",
    }
    expect(herdGrazingStatus([grazing], "2026-06-15")).toEqual({
      type: "grazing_now",
      fieldName: "Huiskavel",
    })
  })

  it("grazes on the last day of a longer grazing", () => {
    expect(
      herdGrazingStatus(
        [{ l_grazing_start: day("2026-06-10"), l_grazing_end: day("2026-06-15") }],
        "2026-06-15",
      ).type,
    ).toBe("grazing_now")
    // A record without an end covers its first day only
    expect(
      herdGrazingStatus([{ l_grazing_start: day("2026-06-01"), l_grazing_end: null }], "2026-06-15")
        .type,
    ).toBe("idle")
  })

  it("shows the next planned grazing after an ended one", () => {
    expect(
      herdGrazingStatus(
        [
          { l_grazing_start: day("2026-06-14"), l_grazing_end: day("2026-06-14") },
          { l_grazing_start: day("2026-07-03"), l_grazing_end: day("2026-07-04") },
          { l_grazing_start: day("2026-06-20"), l_grazing_end: day("2026-06-20") },
        ],
        "2026-06-15",
      ),
    ).toEqual({ type: "planned", dateStr: "20 jun." })
  })

  it("is idle without a current or planned grazing", () => {
    expect(
      herdGrazingStatus(
        [{ l_grazing_start: day("2026-06-14"), l_grazing_end: day("2026-06-14") }],
        "2026-06-15",
      ),
    ).toEqual({ type: "idle" })
  })
})
