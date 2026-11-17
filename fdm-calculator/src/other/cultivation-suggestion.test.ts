import type { FdmType } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const core = vi.hoisted(() => ({ getDefaultDatesOfCultivation: vi.fn() }))
const data = vi.hoisted(() => ({ getCultivationCatalogue: vi.fn() }))
const estimates = vi.hoisted(() => ({ getSoilParameterEstimates: vi.fn() }))
const estimatesInput = vi.hoisted(() => ({ collectInputForSoilParameterEstimates: vi.fn() }))

vi.mock("@nmi-agro/fdm-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...core,
}))
vi.mock("@nmi-agro/fdm-data", () => data)
vi.mock("../estimates/index", () => estimates)
vi.mock("../estimates/input", () => estimatesInput)

const { getCultivationSuggestion, getCultivationSuggestionResult } =
  await import("./cultivation-suggestion")

const fdm = {} as FdmType
const call = (key: string | undefined = "key", year: number | string = 2026) =>
  getCultivationSuggestionResult(fdm, "p1", "farm-1", "f1", year, key)

describe("cultivation suggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    estimatesInput.collectInputForSoilParameterEstimates.mockResolvedValue({ a_lat: 52, a_lon: 5 })
    estimates.getSoilParameterEstimates.mockResolvedValue({
      cultivations: [{ year: 2026, b_lu_brp: 265 }],
    })
    data.getCultivationCatalogue.mockResolvedValue([
      { b_lu_catalogue: "nl_265", b_lu_name: "Grasland" },
    ])
    core.getDefaultDatesOfCultivation.mockResolvedValue({
      b_lu_start: new Date("2026-01-01"),
      b_lu_end: undefined,
    })
  })

  it("suggests the BRP crop of the year with its default dates", async () => {
    expect(await call("key", "2026")).toEqual({
      status: "suggested",
      suggestion: {
        b_lu_catalogue: "nl_265",
        b_lu_name: "Grasland",
        b_lu_start: new Date("2026-01-01"),
        b_lu_end: undefined,
      },
    })
    expect(core.getDefaultDatesOfCultivation).toHaveBeenCalledWith(
      fdm,
      "p1",
      "farm-1",
      "nl_265",
      2026,
    )
  })

  it("is not configured without an NMI API key", async () => {
    expect(
      await getCultivationSuggestionResult(fdm, "p1", "farm-1", "f1", 2026, undefined),
    ).toEqual({ status: "not_configured" })
  })

  it("has no estimate without a crop for the year or in the catalogue", async () => {
    expect(await call("key", 2025)).toEqual({ status: "no_estimate" })
    data.getCultivationCatalogue.mockResolvedValue([])
    expect(await call()).toEqual({ status: "no_estimate" })
  })

  it("is unavailable when the lookup fails", async () => {
    estimates.getSoilParameterEstimates.mockRejectedValue(new Error("down"))
    expect(await call()).toEqual({ status: "unavailable" })
  })

  it("returns only the suggestion, or undefined", async () => {
    const suggestion = await getCultivationSuggestion(fdm, "p1", "farm-1", "f1", 2026, "key")
    expect(suggestion?.b_lu_catalogue).toBe("nl_265")
    expect(
      await getCultivationSuggestion(fdm, "p1", "farm-1", "f1", 2026, undefined),
    ).toBeUndefined()
  })
})
