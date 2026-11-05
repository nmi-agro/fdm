import type { FdmType } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const estimates = vi.hoisted(() => ({ getSoilParameterEstimates: vi.fn() }))
const core = vi.hoisted(() => ({ addSoilAnalysis: vi.fn() }))

vi.mock("./index", () => estimates)
vi.mock("@nmi-agro/fdm-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...core,
}))

const { addSoilParameterEstimatesToField, getSoilParameterEstimatesForGeometry } =
  await import("./field")

const fdm = {} as FdmType
const square = {
  type: "Polygon" as const,
  coordinates: [
    [
      [5, 52],
      [6, 52],
      [6, 53],
      [5, 53],
      [5, 52],
    ],
  ],
}

describe("soil estimates for a geometry", () => {
  beforeEach(() => vi.clearAllMocks())

  it("requests the estimates for the centroid", async () => {
    estimates.getSoilParameterEstimates.mockResolvedValue({ a_som_loi: 3 })
    await getSoilParameterEstimatesForGeometry(fdm, square, "key")
    expect(estimates.getSoilParameterEstimates).toHaveBeenCalledWith(fdm, {
      a_lat: 52.5,
      a_lon: 5.5,
      nmiApiKey: "key",
    })
  })

  it("adds the estimates to a field as an nl-other-nmi analysis", async () => {
    estimates.getSoilParameterEstimates.mockResolvedValue({
      a_som_loi: 3,
      a_depth_upper: 0,
      a_depth_lower: 25,
    })
    core.addSoilAnalysis.mockResolvedValue("a-1")
    expect(await addSoilParameterEstimatesToField(fdm, "p1", "f1", square, "key")).toBe("a-1")
    expect(core.addSoilAnalysis).toHaveBeenCalledWith(
      fdm,
      "p1",
      undefined,
      "nl-other-nmi",
      "f1",
      25,
      undefined,
      expect.objectContaining({ a_som_loi: 3 }),
      0,
    )
  })

  it("uses a depth of 30 cm when the estimates have none", async () => {
    estimates.getSoilParameterEstimates.mockResolvedValue({ a_som_loi: 3, a_depth_upper: 0 })
    await addSoilParameterEstimatesToField(fdm, "p1", "f1", square, "key")
    expect(core.addSoilAnalysis.mock.calls[0]?.[5]).toBe(30)
  })
})
