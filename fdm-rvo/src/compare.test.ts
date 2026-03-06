import { describe, it, expect } from "vitest"
import { compareFields } from "./compare"
import { RvoImportReviewStatus, type RvoField } from "./types"

describe("compareFields", () => {
    const calendar = 2025

    // Helper to create a basic local field
    const createLocalField = (overrides: Partial<any> = {}): any => ({
        b_id: "local-1",
        b_id_source: "rvo-1",
        b_name: "Field 1",
        b_geometry: {
            type: "Polygon",
            coordinates: [
                [
                    [0, 0],
                    [0, 10],
                    [10, 10],
                    [10, 0],
                    [0, 0],
                ],
            ],
        },
        b_start: new Date("2024-01-01"),
        b_end: undefined,
        cultivations: [],
        ...overrides,
    })

    // Helper to create a basic RVO field
    const createRvoField = (overrides: any = {}): RvoField => {
        const { geometry, ...props } = overrides
        return {
            type: "Feature",
            geometry: geometry || {
                type: "Polygon",
                coordinates: [
                    [
                        [0, 0],
                        [0, 10],
                        [10, 10],
                        [10, 0],
                        [0, 0],
                    ],
                ],
            },
            properties: {
                CropFieldID: "rvo-1",
                CropFieldVersion: "1",
                CropFieldDesignator: "Field 1",
                BeginDate: "2024-01-01",
                EndDate: undefined,
                Country: "NL",
                CropTypeCode: "101",
                UseTitleCode: "01",
                ...props,
            },
        }
    }

    describe("Tier 1: ID Match", () => {
        it("should MATCH fields with same ID and identical properties", () => {
            const local = createLocalField()
            const rvo = createRvoField()

            const result = compareFields([local], [rvo], calendar)

            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.MATCH)
            expect(result[0].diffs).toHaveLength(0)
            expect(result[0].localField).toBe(local)
            expect(result[0].rvoField).toBe(rvo)
        })

        it("should detect CONFLICT when name differs", () => {
            const local = createLocalField({ b_name: "Old Name" })
            const rvo = createRvoField({ CropFieldDesignator: "New Name" })

            const result = compareFields([local], [rvo], calendar)

            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.CONFLICT)
            expect(result[0].diffs).toContain("b_name")
        })

        it("should detect CONFLICT when start date differs", () => {
            const local = createLocalField({ b_start: new Date("2023-01-01") })
            const rvo = createRvoField({ BeginDate: "2024-01-01" })

            const result = compareFields([local], [rvo], calendar)

            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.CONFLICT)
            expect(result[0].diffs).toContain("b_start")
        })

        it("should detect CONFLICT when end date differs", () => {
            const local = createLocalField({ b_end: undefined })
            const rvo = createRvoField({ EndDate: "2025-12-31" })

            const result = compareFields([local], [rvo], calendar)

            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.CONFLICT)
            expect(result[0].diffs).toContain("b_end")
        })

        it("should detect CONFLICT when geometry differs significantly", () => {
            const local = createLocalField()
            const rvo = createRvoField({
                geometry: {
                    type: "Polygon",
                    coordinates: [
                        [
                            [0, 0],
                            [0, 5],
                            [5, 5],
                            [5, 0],
                            [0, 0],
                        ],
                    ], // Quarter the size
                },
            })

            const result = compareFields([local], [rvo], calendar)

            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.CONFLICT)
            expect(result[0].diffs).toContain("b_geometry")
        })

        it("should detect CONFLICT when cultivation differs", () => {
            const local = createLocalField({
                cultivations: [
                    {
                        b_lu_catalogue: "nl_101",
                        b_lu: "cult-1",
                        b_lu_name: "Grass",
                        b_lu_start: new Date(`${calendar}-01-01`),
                        b_lu_end: new Date(`${calendar}-12-31`),
                    },
                ],
            })
            const rvo = createRvoField({
                CropTypeCode: "202", // Different crop code
            })

            const result = compareFields([local], [rvo], calendar)

            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.CONFLICT)
            expect(result[0].diffs).toContain("b_lu_catalogue")
        })
    })

    describe("Tier 2: Spatial Match", () => {
        it("should MATCH fields with different IDs but high spatial overlap (IoU > 0.99)", () => {
            const local = createLocalField({ b_id_source: "old-id" })
            const rvo = createRvoField({ CropFieldID: "new-id" })

            const result = compareFields([local], [rvo], calendar)

            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.MATCH)
            expect(result[0].localField).toBe(local)
            expect(result[0].rvoField).toBe(rvo)
        })

        it("should NOT match fields with low spatial overlap", () => {
            const local = createLocalField({ b_id_source: "local-only" })
            // Shifted geometry, no overlap
            const rvo = createRvoField({
                CropFieldID: "remote-only",
                geometry: {
                    type: "Polygon",
                    coordinates: [
                        [
                            [100, 100],
                            [100, 110],
                            [110, 110],
                            [110, 100],
                            [100, 100],
                        ],
                    ],
                },
            })

            const result = compareFields([local], [rvo], calendar)

            expect(result).toHaveLength(2)
            const expired = result.find(
                (r) => r.status === RvoImportReviewStatus.EXPIRED_LOCAL,
            )
            const newRemote = result.find(
                (r) => r.status === RvoImportReviewStatus.NEW_REMOTE,
            )

            expect(expired).toBeDefined()
            expect(newRemote).toBeDefined()
        })
    })

    describe("Orphaned Fields (Status determination)", () => {
        it("should identify a field as NEW_LOCAL if it started in the import year", () => {
            const local = createLocalField({
                b_start: new Date("2025-01-01"),
                b_id_source: "local-only",
            })
            const result = compareFields([local], [], calendar)
            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.NEW_LOCAL)
        })

        it("should identify a field as EXPIRED_LOCAL if it started before import year and has no end date", () => {
            const local = createLocalField({
                b_start: new Date("2024-01-01"),
                b_id_source: "local-only",
            })
            const result = compareFields([local], [], calendar)
            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.EXPIRED_LOCAL)
        })

        it("should identify a field as EXPIRED_LOCAL if it started before import year and ends IN the import year", () => {
            const local = createLocalField({
                b_start: new Date("2024-01-01"),
                b_end: new Date("2025-06-01"),
                b_id_source: "local-only",
            })
            const result = compareFields([local], [], calendar)
            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.EXPIRED_LOCAL)
        })

        it("should IGNORE a field if it ends BEFORE the import year", () => {
            const local = createLocalField({
                b_start: new Date("2024-01-01"),
                b_end: new Date("2024-12-31"),
                b_id_source: "local-only",
            })
            const result = compareFields([local], [], calendar)
            expect(result).toHaveLength(0)
        })
    })

    describe("New Remote Fields", () => {
        it("should identify NEW_REMOTE fields", () => {
            const rvo = createRvoField({ CropFieldID: "new-remote" })
            const result = compareFields([], [rvo], calendar)

            expect(result).toHaveLength(1)
            expect(result[0].status).toBe(RvoImportReviewStatus.NEW_REMOTE)
            expect(result[0].rvoField).toBe(rvo)
        })
    })
})

describe("compareFields Edge Cases", () => {
    const calendar = 2025

    const createLocalField = (overrides: Partial<any> = {}): any => ({
        b_id: "local-1",
        b_id_source: "rvo-1",
        b_name: "Field 1",
        b_geometry: {
            type: "Polygon",
            coordinates: [
                [
                    [0, 0],
                    [0, 10],
                    [10, 10],
                    [10, 0],
                    [0, 0],
                ],
            ],
        },
        b_start: new Date("2024-01-01"),
        b_end: undefined,
        cultivations: [],
        ...overrides,
    })

    const createRvoField = (overrides: any = {}): RvoField => {
        const { geometry, ...props } = overrides
        return {
            type: "Feature",
            geometry: geometry || {
                type: "Polygon",
                coordinates: [
                    [
                        [0, 0],
                        [0, 10],
                        [10, 10],
                        [10, 0],
                        [0, 0],
                    ],
                ],
            },
            properties: {
                CropFieldID: "rvo-1",
                CropFieldVersion: "1",
                CropFieldDesignator: "Field 1",
                BeginDate: "2024-01-01",
                Country: "NL",
                CropTypeCode: "101",
                UseTitleCode: "01",
                ...props,
            },
        }
    }

    it("should handle IoU calculation when polygons touch (area 0)", () => {
        // Two squares touching at x=10.
        // S1: 0,0 to 10,10
        // S2: 10,0 to 20,10
        // BBoxes: 0,0,10,10 and 10,0,20,10. Overlap at x=10 line.

        const local = createLocalField({
            b_geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [0, 0],
                        [0, 10],
                        [10, 10],
                        [10, 0],
                        [0, 0],
                    ],
                ],
            },
        })
        const rvo = createRvoField({
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [10, 0],
                        [10, 10],
                        [20, 10],
                        [20, 0],
                        [10, 0],
                    ],
                ],
            },
        })
        local.b_id_source = "id1"
        rvo.properties.CropFieldID = "id2"

        const result = compareFields([local], [rvo], calendar)
        // IoU should be 0 (intersection area is 0)
        expect(result).toHaveLength(2)
    })

    it("should use cultivation catalogue name when code exists", () => {
        const local = createLocalField()
        const rvo = createRvoField({ CropTypeCode: "101" })

        const catalogue = [
            {
                b_lu_catalogue: "nl_101",
                b_lu_name: "Official Grass Name",
            },
        ] as any

        const result = compareFields([local], [rvo], calendar, catalogue)

        expect(result).toHaveLength(1)
        // Should match (if everything else matches)
        // Check rvoCultivationInfo name
        expect(result[0].rvoCultivation?.b_lu_name).toBe("Official Grass Name")
    })

    it("should use cultivation catalogue name for NEW_REMOTE when code exists", () => {
        const rvo = createRvoField({ CropFieldID: "new", CropTypeCode: "101" })
        const catalogue = [
            {
                b_lu_catalogue: "nl_101",
                b_lu_name: "Official Grass Name",
            },
        ] as any

        const result = compareFields([], [rvo], calendar, catalogue)

        expect(result).toHaveLength(1)
        expect(result[0].status).toBe(RvoImportReviewStatus.NEW_REMOTE)
        expect(result[0].rvoCultivation?.b_lu_name).toBe("Official Grass Name")
    })

    it("should handle missing RVO CropTypeCode", () => {
        const local = createLocalField()
        const rvo = createRvoField({ CropTypeCode: "" }) // Empty string -> falsy

        const result = compareFields([local], [rvo], calendar)
        expect(result).toHaveLength(1)
        expect(result[0].status).toBe(RvoImportReviewStatus.MATCH)
        // Check if logic handles undefined rvoCultivationInfo
        expect(result[0].rvoCultivation).toBeUndefined()
    })

    it("should handle RVO cultivation lookup failure (unknown code)", () => {
        const local = createLocalField()
        const rvo = createRvoField({ CropTypeCode: "999" }) // Unknown code

        const result = compareFields([local], [rvo], calendar, []) // Empty catalogue

        expect(result).toHaveLength(1)
        // rvoCultivationInfo should use code as name
        expect(result[0].rvoCultivation?.b_lu_name).toBe("nl_999")
    })

    it("should handle NEW_REMOTE with unknown crop code", () => {
        const rvo = createRvoField({ CropFieldID: "new", CropTypeCode: "999" })
        const result = compareFields([], [rvo], calendar, [])

        expect(result).toHaveLength(1)
        expect(result[0].status).toBe(RvoImportReviewStatus.NEW_REMOTE)
        expect(result[0].rvoCultivation?.b_lu_name).toBe("nl_999")
    })
})
