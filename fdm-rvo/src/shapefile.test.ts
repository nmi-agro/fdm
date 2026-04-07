import { geometry } from "@turf/helpers"
import type { Geometry, Polygon } from "geojson"
import proj4 from "proj4"
import * as shpjs from "shpjs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getRvoFieldsFromShapefile } from "./shapefile"

vi.mock("shpjs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("shpjs")>()
    return {
        ...actual,
        combine: vi.fn(actual.combine),
        parseShp: vi.fn(actual.parseShp),
        parseDbf: vi.fn(actual.parseDbf),
    }
})

describe("getRvoFieldsFromShapefile", () => {
    beforeEach(async () => {
        vi.resetAllMocks()
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
            new Error("Failed to parse dbf"),
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
        SECTORVER: "1.0.0",
        NEN3610ID: "unique",
        VOLGNR: 1,
        GEWASOMSCH: "Krokus, bloembollen en -knollen",
        TITELOMSCH: "Purchased by the test farm",
    }

    it("should map the data fields correctly", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([createMockGeometry()])
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([MOCK_PROPERTIES])

        const parsed = await getRvoFieldsFromShapefile(
            new File([], "shapefile.shp"),
            undefined,
            new File([], "shapefile.dbf"),
            undefined,
        )

        expect(parsed).toHaveLength(1)

        expect(parsed[0].properties.CropFieldID).toBe("test_b_id_source")
        expect(parsed[0].properties.CropFieldDesignator).toBe("Field 1")
        expect(new Date(parsed[0].properties.BeginDate).getTime()).toBe(
            1704067200000,
        )
        expect(new Date(parsed[0].properties.EndDate ?? "").getTime()).toBe(
            1706659200000,
        )
        expect(parsed[0].properties.CropTypeCode).toBe("02")
        expect(parsed[0].properties.UseTitleCode).toBe(
            "Geliberaliseerde pacht, 6 jaar of korter",
        )
    })

    it("should handle null ending date", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([createMockGeometry()])
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([
            { ...MOCK_PROPERTIES, EINDDAT: 253402297199 },
        ])

        const parsed = await getRvoFieldsFromShapefile(
            new File([], "shapefile.shp"),
            undefined,
            new File([], "shapefile.dbf"),
            undefined,
        )

        expect(parsed).toHaveLength(1)
        expect(parsed[0].properties.EndDate).toBeUndefined()
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

    it("should throw an error if there are missing but required properties", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([createMockGeometry()])
        const { NAAM, ...otherProps } = MOCK_PROPERTIES
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([otherProps])

        await expect(
            getRvoFieldsFromShapefile(
                new File([], "shapefile.shp"),
                undefined,
                new File([], "shapefile.dbf"),
                new File(["EPSG:4326"], "shapefile.prj"),
            ),
        ).rejects.toThrow("Field does not have the required attributes")
    })

    it("should throw an error if the shapefile does not match the attributes file", async () => {
        vi.mocked(shpjs.parseShp).mockResolvedValueOnce([
            createMockGeometry(),
            createMockGeometry(),
        ])
        vi.mocked(shpjs.parseDbf).mockResolvedValueOnce([MOCK_PROPERTIES])

        await expect(
            getRvoFieldsFromShapefile(
                new File([], "shapefile.shp"),
                undefined,
                new File([], "shapefile.dbf"),
                new File(["EPSG:4326"], "shapefile.prj"),
            ),
        ).rejects.toThrow("Field does not have the required attributes")
    })
})
