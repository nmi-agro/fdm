import { describe, expect, it, test } from "vitest"
import { parseShapefileGeometry } from "./shapefile"

describe("parseShapefileGeometry", () => {
    it("should throw an error for an invalid shapefile", async () => {
        const shp = new File([new Uint8Array()], "invalid.shp")
        expect(parseShapefileGeometry(shp)).rejects.toThrow(
            "Shapefile is not valid",
        )
    })

    it("should return an empty feature collection on empty glob", async () => {
        const bounds = (
            minX: number,
            minY: number,
            maxX: number,
            maxY: number,
        ) => new Uint32Array(new Float64Array([minX, minY, maxX, maxY]).buffer) // 16 words
        const data = new Uint32Array([
            0x0a270000, // magic number
            0,
            0,
            0,
            0,
            0,
            50 << 24, // file length in big endian, only the header
            0,
            5, // each feature is a polygon
            ...bounds(5, 50, 7, 55), // bounding box
            ...bounds(0, 0, 0, 0), // third and fourth dimension bounds
        ])
        const shp = new File([data], "empty.shp")
        expect(await parseShapefileGeometry(shp)).toHaveLength(0)
    })
})

describe("", () => {
    it("should throw an error for an invalid dbf file", async () => {
        const dbf = new File([new Uint8Array()], "invalid.dbf")
        expect(parseShapefileGeometry(dbf)).rejects.toThrow(
            "Shapefile is not valid",
        )
    })

    it("should map the data fields correctly", async () => {})
})
