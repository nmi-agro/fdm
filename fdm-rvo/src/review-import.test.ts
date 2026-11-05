import type { FdmType } from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const core = vi.hoisted(() => ({
  getFields: vi.fn(),
  getCultivationsForFarm: vi.fn(),
  getCultivationsFromCatalogue: vi.fn(),
}))
const shapefile = vi.hoisted(() => ({
  getRvoFieldsFromShapefile: vi.fn(),
  validateShapefileYear: vi.fn(),
}))

vi.mock("@nmi-agro/fdm-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...core,
}))
vi.mock("./shapefile", () => shapefile)

const { reviewShapefileImport, ShapefileReadError } = await import("./review")

const fdm = {} as FdmType
const files = { shp: new Blob(), shx: new Blob(), dbf: new Blob(), prj: new Blob() }

const multiPolygon = {
  type: "MultiPolygon" as const,
  coordinates: [
    [
      [
        [5.0, 52.0],
        [5.001, 52.0],
        [5.001, 52.001],
        [5.0, 52.001],
        [5.0, 52.0],
      ],
    ],
  ],
}

const rvoField = {
  type: "Feature",
  geometry: multiPolygon,
  properties: {
    CropFieldID: "rvo-1",
    CropFieldVersion: "1",
    CropFieldDesignator: "Nieuw",
    BeginDate: "2026-01-01",
    Country: "NL",
    CropTypeCode: "265",
    UseTitleCode: "01",
  },
}

describe("reviewShapefileImport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    core.getFields.mockResolvedValue([])
    core.getCultivationsForFarm.mockResolvedValue(new Map())
    core.getCultivationsFromCatalogue.mockResolvedValue([])
    shapefile.validateShapefileYear.mockReturnValue({ valid: true })
  })

  it("compares the shapefile with the farm and returns the items and their hash", async () => {
    shapefile.getRvoFieldsFromShapefile.mockResolvedValue([structuredClone(rvoField)])
    const review = await reviewShapefileImport(fdm, "p1", "farm-1", files, 2026)
    expect(review.valid).toBe(true)
    if (!review.valid) return
    expect(review.items).toHaveLength(1)
    expect(review.items[0]?.status).toBe("NEW_REMOTE")
    // A MultiPolygon field gets a buffer strip estimate too.
    expect(review.items[0]?.rvoField?.properties.mestData?.IndBufferstrook).toMatch(/^[JN]$/)
    expect(review.review_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(core.getFields).toHaveBeenCalledWith(fdm, "p1", "farm-1")
  })

  it("includes the local fields with their cultivations", async () => {
    shapefile.getRvoFieldsFromShapefile.mockResolvedValue([])
    core.getFields.mockResolvedValue([
      { b_id: "b-1", b_name: "Oud", b_geometry: multiPolygon, b_start: new Date("2020-01-01") },
      { b_id: "b-2", b_name: "Ander", b_geometry: multiPolygon, b_start: new Date("2020-01-01") },
    ])
    core.getCultivationsForFarm.mockResolvedValue(new Map([["b-1", []]]))
    const review = await reviewShapefileImport(fdm, "p1", "farm-1", files, 2026)
    if (!review.valid) throw new Error("expected a valid review")
    expect(review.items.map((item) => item.localField?.b_id).sort()).toEqual(["b-1", "b-2"])
  })

  it("suggests the year when the shapefile has fields that start later", async () => {
    shapefile.getRvoFieldsFromShapefile.mockResolvedValue([rvoField])
    shapefile.validateShapefileYear.mockReturnValue({ valid: false, maxYear: 2027 })
    expect(await reviewShapefileImport(fdm, "p1", "farm-1", files, 2026)).toEqual({
      valid: false,
      suggestedYear: 2027,
    })
    expect(core.getFields).not.toHaveBeenCalled()
  })

  it("throws ShapefileReadError when the files cannot be read", async () => {
    shapefile.getRvoFieldsFromShapefile.mockRejectedValue(new Error("corrupt"))
    const error = await reviewShapefileImport(fdm, "p1", "farm-1", files, 2026).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ShapefileReadError)
    expect((error as Error).cause).toBeInstanceOf(Error)
  })
})
