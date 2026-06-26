import { describe, expect, it } from "vitest"
import {
    GeometryType,
    parseGeometry,
    parseHexToGeometry,
} from "./schema-custom-types"

// WKB hex for a simple square MultiPolygon (1 polygon, 1 ring, 5 points)
// Little-endian, no SRID
// Polygon ring: (0,0) → (1,0) → (1,1) → (0,1) → (0,0)
const MULTIPOLYGON_HEX =
    "010600000001000000" + // header: LE, type=6, numPolygons=1
    "0103000000" + //         polygon header: LE, type=3
    "01000000" + //           numRings=1
    "05000000" + //           numPoints=5
    "0000000000000000" +
    "0000000000000000" + // (0,0)
    "000000000000F03F" +
    "0000000000000000" + // (1,0)
    "000000000000F03F" +
    "000000000000F03F" + // (1,1)
    "0000000000000000" +
    "000000000000F03F" + // (0,1)
    "0000000000000000" +
    "0000000000000000" //  (0,0) close

describe("parseHexToGeometry", () => {
    it("parses a MultiPolygon WKB hex string", () => {
        const result = parseHexToGeometry(MULTIPOLYGON_HEX)
        expect(result).toEqual({
            type: "MultiPolygon",
            coordinates: [
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0],
                    ],
                ],
            ],
        })
    })

    it("throws when the MultiPolygon buffer is too small for numPolygons", () => {
        // Only 5 bytes: byte order + type — no room for numPolygons
        const hex = "0106000000"
        let caughtError: unknown
        try {
            parseHexToGeometry(hex)
        } catch (e) {
            caughtError = e
        }
        expect(caughtError).toBeInstanceOf(Error)
        expect(
            (caughtError as Error & { cause?: Error }).cause?.message,
        ).toContain("Buffer too small to read MultiPolygon")
    })

    it("throws when the buffer is too small to read the nested Polygon header", () => {
        // 9 bytes: header(5) + numPolygons(4) — no room for polygon byte-order + type
        const hex = "010600000001000000"
        let caughtError: unknown
        try {
            parseHexToGeometry(hex)
        } catch (e) {
            caughtError = e
        }
        expect(caughtError).toBeInstanceOf(Error)
        expect(
            (caughtError as Error & { cause?: Error }).cause?.message,
        ).toContain("Buffer too small to read nested Polygon")
    })

    it("throws when the nested geometry type is not Polygon", () => {
        // 14 bytes: header(5) + numPolygons(4) + polygon_byte_order(1) + polygon_type(4)
        // polygon_type = 01000000 = 1 (Point), not 3 (Polygon)
        const hex = "0106000000010000000101000000"
        let caughtError: unknown
        try {
            parseHexToGeometry(hex)
        } catch (e) {
            caughtError = e
        }
        expect(caughtError).toBeInstanceOf(Error)
        expect(
            (caughtError as Error & { cause?: Error }).cause?.message,
        ).toContain("Expected nested Polygon")
    })
})

describe("parseGeometry", () => {
    it("throws for unsupported geometry types", () => {
        const buf = new ArrayBuffer(4)
        const view = new DataView(buf)
        expect(() =>
            parseGeometry(view, true, GeometryType.GeometryCollection, 0),
        ).toThrow("Unsupported geometry type")
    })
})
