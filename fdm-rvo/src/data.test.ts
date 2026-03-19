import { describe, it, expect, vi } from "vitest"
import { fetchRvoFields } from "./data"
import type { RvoClient } from "@nmi-agro/rvo-connector"

// A simple square polygon used as test geometry
const POLYGON_A = {
    type: "Polygon",
    coordinates: [
        [
            [5.0, 52.0],
            [5.0, 52.01],
            [5.01, 52.01],
            [5.01, 52.0],
            [5.0, 52.0],
        ],
    ],
}

// A nearly identical polygon (same field, minor floating point difference)
const POLYGON_A_SIMILAR = {
    type: "Polygon",
    coordinates: [
        [
            [5.0001, 52.0001],
            [5.0001, 52.0099],
            [5.0099, 52.0099],
            [5.0099, 52.0001],
            [5.0001, 52.0001],
        ],
    ],
}

// A completely different polygon (no overlap)
const POLYGON_B = {
    type: "Polygon",
    coordinates: [
        [
            [6.0, 53.0],
            [6.0, 53.01],
            [6.01, 53.01],
            [6.01, 53.0],
            [6.0, 53.0],
        ],
    ],
}

describe("fetchRvoFields", () => {
    it("should merge mestData via spatial IoU join (Tier 2)", async () => {
        const mockFeatures = [
            {
                type: "Feature",
                geometry: POLYGON_A,
                properties: {
                    CropFieldID: "123",
                    CropFieldVersion: "1",
                    CropFieldDesignator: "Field A",
                    BeginDate: "2024-01-01",
                    Country: "NL",
                    CropTypeCode: "101",
                    UseTitleCode: "01",
                },
            },
        ]

        const mockMestFeatures = [
            {
                type: "Feature",
                geometry: POLYGON_A_SIMILAR,
                properties: {
                    MESTFieldid: "mest-1",
                    Bufferstrook: true,
                    Regelingsgebied: "Yes",
                },
            },
        ]

        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({
                features: mockFeatures,
            }),
            opvragenRegelingspercelenMest: vi.fn().mockResolvedValue({
                features: mockMestFeatures,
            }),
        } as unknown as RvoClient

        const result = await fetchRvoFields(mockClient, "2024", "12345678")

        expect(mockClient.opvragenBedrijfspercelen).toHaveBeenCalledWith({
            periodBeginDate: "2024-01-01",
            periodEndDate: "2024-12-31",
            farmId: "12345678",
            outputFormat: "geojson",
        })
        expect(mockClient.opvragenRegelingspercelenMest).toHaveBeenCalledWith({
            periodBeginDate: "2024-01-01",
            periodEndDate: "2024-12-31",
            farmId: "12345678",
            outputFormat: "geojson",
        })
        expect(result).toHaveLength(1)
        expect(result[0].properties.CropFieldID).toBe("123")
        expect(result[0].properties.mestData).toMatchObject({
            MESTFieldid: "mest-1",
            Bufferstrook: true,
            Regelingsgebied: "Yes",
        })
    })

    it("should merge mestData via designator match + IoU check (Tier 1)", async () => {
        const mockFeatures = [
            {
                type: "Feature",
                geometry: POLYGON_A,
                properties: {
                    CropFieldID: "123",
                    CropFieldVersion: "1",
                    CropFieldDesignator: "My Field",
                    BeginDate: "2024-01-01",
                    Country: "NL",
                    CropTypeCode: "101",
                    UseTitleCode: "01",
                },
            },
        ]

        const mockMestFeatures = [
            {
                type: "Feature",
                geometry: POLYGON_A_SIMILAR,
                properties: {
                    MESTFieldid: "mest-1",
                    Fielddesignator: "My Field",
                    Grondsoort: "1",
                },
            },
        ]

        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({ features: mockFeatures }),
            opvragenRegelingspercelenMest: vi.fn().mockResolvedValue({ features: mockMestFeatures }),
        } as unknown as RvoClient

        const result = await fetchRvoFields(mockClient, "2024", "12345678")
        expect(result[0].properties.mestData).toMatchObject({ MESTFieldid: "mest-1", Fielddesignator: "My Field" })
    })

    it("should not merge mestData if geometries do not overlap sufficiently", async () => {
        const mockFeatures = [
            {
                type: "Feature",
                geometry: POLYGON_A,
                properties: {
                    CropFieldID: "123",
                    CropFieldVersion: "1",
                    CropFieldDesignator: "Field A",
                    BeginDate: "2024-01-01",
                    Country: "NL",
                    CropTypeCode: "101",
                    UseTitleCode: "01",
                },
            },
        ]

        const mockMestFeatures = [
            {
                type: "Feature",
                geometry: POLYGON_B,
                properties: {
                    MESTFieldid: "mest-2",
                    Bufferstrook: false,
                },
            },
        ]

        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({ features: mockFeatures }),
            opvragenRegelingspercelenMest: vi.fn().mockResolvedValue({ features: mockMestFeatures }),
        } as unknown as RvoClient

        const result = await fetchRvoFields(mockClient, "2024", "12345678")
        expect(result[0].properties.mestData).toBeUndefined()
    })

    it("should return empty array if no features found", async () => {
        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({
                features: [],
            }),
            opvragenRegelingspercelenMest: vi.fn().mockResolvedValue({
                features: [],
            }),
        } as unknown as RvoClient

        const result = await fetchRvoFields(mockClient, "2024", "12345678")
        expect(result).toEqual([])
    })

    it("should return empty array if response is malformed (no features array)", async () => {
        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({
                somethingElse: [],
            }),
            opvragenRegelingspercelenMest: vi.fn().mockResolvedValue({
                features: [],
            }),
        } as unknown as RvoClient

        const result = await fetchRvoFields(mockClient, "2024", "12345678")
        expect(result).toEqual([])
    })

    it("should throw error if validation fails", async () => {
        const mockFeatures = [
            {
                type: "Feature",
                // Missing required properties
                properties: {
                    CropFieldID: "123",
                },
            },
        ]

        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({
                features: mockFeatures,
            }),
            opvragenRegelingspercelenMest: vi.fn().mockResolvedValue({
                features: [],
            }),
        } as unknown as RvoClient

        await expect(
            fetchRvoFields(mockClient, "2024", "12345678"),
        ).rejects.toThrow()
    })
})

