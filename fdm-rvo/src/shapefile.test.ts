import { geometry } from "@turf/helpers"
import type { Geometry, Polygon } from "geojson"
import proj4 from "proj4"
import * as shpjs from "shpjs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    convertShapefileFeatureIntoRvoField,
    getRvoFieldsFromShapefile,
} from "./shapefile"

vi.mock("shpjs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("shpjs")>()
    return {
        ...actual,
        combine: vi.fn(actual.combine),
        parseShp: vi.fn(actual.parseShp),
        parseDbf: vi.fn(actual.parseDbf),
    }
})

const createMockGeometry = () =>
    geometry("Polygon", [
        [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
        ],
    ])

const MOCK_PROPERTIES = {
    // Relevant
    SECTORID: "test_b_id_source", // b_id_source
    NAAM: "   Field 1 ", // b_name
    BEGINDAT: 1704067200000, // b_start
    EINDDAT: 1706659200000, // b_end
    GEWASCODE: "02", // b_lu_catalogue[1]
    TITEL: "Geliberaliseerde pacht, 6 jaar of korter", // b_acquiring_method

    // Irrelevant
    SECTORVER: 1,
    NEN3610ID: "unique",
    VOLGNR: 1,
    GEWASOMSCH: "Krokus, bloembollen en -knollen",
    TITELOMSCH: "Purchased by the test farm",
}

describe("getRvoFieldsFromShapefile", () => {
    beforeEach(async () => {
        vi.resetAllMocks()
    })

    it("should get RvoField objects from Shapefile", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([createMockGeometry()])
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([MOCK_PROPERTIES])

        const parsed = await getRvoFieldsFromShapefile(
            new File([], "shapefile.shp"),
            undefined,
            new File([], "shapefile.dbf"),
            undefined,
        )

        expect(parsed).toHaveLength(1)
    })

    it("should project field geometry", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([createMockGeometry()])
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([MOCK_PROPERTIES])

        const parsed = await getRvoFieldsFromShapefile(
            new File([], "shapefile.shp"),
            undefined,
            new File([], "shapefile.dbf"),
            // Identity transform
            new File(["EPSG:3785"], "shapefile.prj"),
        )

        const projector = proj4("EPSG:3785", "EPSG:4326")
        const expectedCoords = [
            createMockGeometry().coordinates[0].map((coord) =>
                projector.forward(coord),
            ),
        ]

        expect(parsed).toHaveLength(1)

        expect((parsed[0].geometry as Geometry).type).toBe("Polygon")
        expect((parsed[0].geometry as Polygon).coordinates).toStrictEqual(
            expectedCoords,
        )
    })

    it("should throw an error with invalid geometry", async () => {
        vi.mocked(shpjs.parseShp).mockRejectedValueOnce(
            new Error("Failed to parse shp"),
        )

        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([])

        await expect(
            getRvoFieldsFromShapefile(
                new File([], "invalid.shp"),
                undefined,
                new File([], "invalid.dbf"),
                new File([], "invalid.prj"),
            ),
        ).rejects.toThrow("Shapefile is not valid")
    })

    it("should throw an error with invalid attributes", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([])

        vi.mocked(shpjs.parseDbf).mockRejectedValueOnce(
            new Error("Failed to parse shp"),
        )

        await expect(
            getRvoFieldsFromShapefile(
                new File([], "invalid.shp"),
                undefined,
                new File([], "invalid.dbf"),
                new File([], "invalid.prj"),
            ),
        ).rejects.toThrow("Shapefile is not valid")
    })

    it("should throw an error with no fields", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([])
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([])

        await expect(
            getRvoFieldsFromShapefile(
                new File([], "invalid.shp"),
                undefined,
                new File([], "invalid.shx"),
                new File([], "invalid.prj"),
            ),
        ).rejects.toThrow("Shapefile does not contain any fields")
    })

    it("should handle multi-polygon geometry", async () => {
        try {
            const MOCK_MULTIPOLYGON = geometry("MultiPolygon", [
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0],
                    ],
                    [
                        [1, 0],
                        [2, 0],
                        [2, 1],
                        [1, 1],
                        [1, 0],
                    ],
                ],
            ])

            vi.mocked(shpjs.parseShp).mockResolvedValueOnce([MOCK_MULTIPOLYGON])
            vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([MOCK_PROPERTIES])

            const parsed = await getRvoFieldsFromShapefile(
                new File([], "shapefile.shp"),
                undefined,
                new File([], "shapefile.dbf"),
                undefined,
            )

            expect(parsed).toHaveLength(1)

            expect((parsed[0].geometry as Geometry).type).toBe("MultiPolygon")
            expect((parsed[0].geometry as Polygon).coordinates).toStrictEqual(
                MOCK_MULTIPOLYGON.coordinates,
            )
        } catch (e) {
            console.error(e)
            throw e
        }
    })

    it("should handle not-supported geometry", async () => {
        const MOCK_UNSUPPORTED_GEOMETRY = geometry("Point", [0, 0])
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([
            MOCK_UNSUPPORTED_GEOMETRY,
        ])
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([MOCK_PROPERTIES])

        await expect(
            getRvoFieldsFromShapefile(
                new File([], "shapefile.shp"),
                undefined,
                new File([], "shapefile.dbf"),
                undefined,
            ),
        ).rejects.toThrow("Shapefile is not valid")
    })

    it("should accept array buffers and strings", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([createMockGeometry()])
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([MOCK_PROPERTIES])

        await expect(
            getRvoFieldsFromShapefile(
                new ArrayBuffer(),
                new ArrayBuffer(),
                new ArrayBuffer(),
                "EPSG:3785",
            ),
        ).resolves.toBeDefined()
    })
})

describe("convertShapefileFeatureIntoRvoField", () => {
    beforeEach(async () => {
        vi.resetAllMocks()
    })

    it("should map the data fields correctly", () => {
        const parsed = convertShapefileFeatureIntoRvoField({
            type: "Feature",
            geometry: createMockGeometry(),
            properties: MOCK_PROPERTIES,
        })

        expect(parsed.properties.CropFieldID).toBe("test_b_id_source")
        expect(parsed.properties.CropFieldDesignator).toBe("Field 1")
        expect(new Date(parsed.properties.BeginDate).getTime()).toBe(
            1704067200000,
        )
        expect(new Date(parsed.properties.EndDate ?? "").getTime()).toBe(
            1706659200000,
        )
        expect(parsed.properties.CropTypeCode).toBe("02")
        expect(parsed.properties.UseTitleCode).toBe(
            "Geliberaliseerde pacht, 6 jaar of korter",
        )
    })

    it("should trim NAAM", () => {
        const parsed = convertShapefileFeatureIntoRvoField({
            type: "Feature",
            geometry: createMockGeometry(),
            properties: { ...MOCK_PROPERTIES, NAAM: "     Test Name  " },
        })

        expect(parsed.properties.CropFieldDesignator).toBe("Test Name")
    })

    it("should handle null ending date", () => {
        const parsed = convertShapefileFeatureIntoRvoField({
            type: "Feature",
            geometry: createMockGeometry(),
            properties: { ...MOCK_PROPERTIES, EINDDAT: 253402297199 },
        })

        expect(parsed.properties.EndDate).toBeUndefined()
    })

    it("should throw an error if there are missing but required properties", () => {
        const { NAAM, ...otherProps } = MOCK_PROPERTIES

        expect(() =>
            convertShapefileFeatureIntoRvoField({
                type: "Feature",
                geometry: createMockGeometry(),
                properties: otherProps,
            }),
        ).toThrow("Field does not have the required attributes")
    })
})
