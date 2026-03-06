import { describe, it, expect, vi } from "vitest"
import { fetchRvoFields } from "./data"
import type { RvoClient } from "@nmi-agro/rvo-connector"

describe("fetchRvoFields", () => {
    it("should fetch and validate fields successfully", async () => {
        const mockFeatures = [
            {
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [] },
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

        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({
                features: mockFeatures,
            }),
        } as unknown as RvoClient

        const result = await fetchRvoFields(mockClient, "2024", "12345678")

        expect(mockClient.opvragenBedrijfspercelen).toHaveBeenCalledWith({
            periodBeginDate: "2024-01-01",
            periodEndDate: "2024-12-31",
            farmId: "12345678",
            outputFormat: "geojson",
        })
        expect(result).toHaveLength(1)
        expect(result[0].properties.CropFieldID).toBe("123")
    })

    it("should return empty array if no features found", async () => {
        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({
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
        } as unknown as RvoClient

        const result = await fetchRvoFields(mockClient, "2024", "12345678")
        expect(result).toEqual([])
    })

    it("should throw error if validation fails", async () => {
        const mockFeatures = [
            {
                type: "Feature",
                // Missing properties
                properties: {
                    CropFieldID: "123",
                },
            },
        ]

        const mockClient = {
            opvragenBedrijfspercelen: vi.fn().mockResolvedValue({
                features: mockFeatures,
            }),
        } as unknown as RvoClient

        await expect(
            fetchRvoFields(mockClient, "2024", "12345678"),
        ).rejects.toThrow()
    })
})
