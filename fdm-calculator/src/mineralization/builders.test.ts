import { describe, expect, it } from "vitest"
import { buildDynaRequest } from "./builders"
import type { Timeframe } from "@nmi-agro/fdm-core"

const baseField = { b_id: "field-1", b_centroid: [5.0, 52.0] as [number, number], b_area: 5 }
const soilData = { a_som_loi: 3.5, b_soiltype_agr: "clay" }
const timeframe2025: Timeframe = {
    start: new Date("2025-01-01"),
    end: new Date("2025-12-31"),
}

describe("buildDynaRequest – rotation building", () => {
    it("includes a cultivation that started in the requested year", () => {
        const cultivations = [
            {
                b_lu: "cult-1",
                b_lu_catalogue: "bwt",
                b_lu_start: new Date("2025-03-01"),
                b_lu_end: new Date("2025-10-01"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
        ]
        const result = buildDynaRequest(baseField, soilData, cultivations, [], "arable", timeframe2025)
        const rotation = (result.field as Record<string, unknown>).rotation as { year: number; b_lu: string }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].year).toBe(2025)
        expect(rotation[0].b_lu).toBe("bwt")
    })

    it("includes a cultivation that started in a prior year but is still active in the requested year", () => {
        const cultivations = [
            {
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-04-01"),
                b_lu_end: new Date("2025-11-30"),
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const result = buildDynaRequest(baseField, soilData, cultivations, [], "dairy", timeframe2025)
        const rotation = (result.field as Record<string, unknown>).rotation as { year: number; b_lu: string }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].year).toBe(2025)
        expect(rotation[0].b_lu).toBe("grs")
    })

    it("includes a cultivation with no end date started before the requested year", () => {
        const cultivations = [
            {
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: null,
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const result = buildDynaRequest(baseField, soilData, cultivations, [], "dairy", timeframe2025)
        const rotation = (result.field as Record<string, unknown>).rotation as { year: number; b_lu: string }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].b_lu).toBe("grs")
    })

    it("excludes a cultivation that ended before the requested year", () => {
        const cultivations = [
            {
                b_lu_catalogue: "bwt",
                b_lu_start: new Date("2023-03-01"),
                b_lu_end: new Date("2023-10-01"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
        ]
        const result = buildDynaRequest(baseField, soilData, cultivations, [], "arable", timeframe2025)
        const rotation = (result.field as Record<string, unknown>).rotation as unknown[]
        // Falls back to the empty fallback entry (no b_lu)
        expect(rotation).toHaveLength(1)
        expect((rotation[0] as Record<string, unknown>).b_lu).toBeUndefined()
    })

    it("only produces a single rotation entry for the requested year even when cultivations span multiple years", () => {
        const cultivations = [
            {
                b_lu_catalogue: "bwt",
                b_lu_start: new Date("2024-03-01"),
                b_lu_end: new Date("2024-10-01"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
            {
                b_lu_catalogue: "uib",
                b_lu_start: new Date("2025-04-01"),
                b_lu_end: new Date("2025-09-15"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
        ]
        const result = buildDynaRequest(baseField, soilData, cultivations, [], "arable", timeframe2025)
        const rotation = (result.field as Record<string, unknown>).rotation as { year: number; b_lu: string }[]
        // Only 2025 entry is produced — 2024 cultivation is excluded (ended before 2025)
        expect(rotation).toHaveLength(1)
        expect(rotation[0].year).toBe(2025)
        expect(rotation[0].b_lu).toBe("uib")
    })

    it("uses May 15th rule to pick main crop for a multi-year cultivation overlapping with a short crop in the same year", () => {
        // Grass started 2024, still active May 15 2025 → chosen as main crop
        // Catch crop starts after May 15 and becomes green manure
        const cultivations = [
            {
                b_lu: "cult-grs",
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-04-01"),
                b_lu_end: new Date("2025-09-30"),
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
            {
                b_lu: "cult-cc",
                b_lu_catalogue: "phc",
                b_lu_start: new Date("2025-10-01"),
                b_lu_end: new Date("2025-12-01"),
                b_lu_croprotation: "catchcrop",
                m_cropresidue: null,
            },
        ]
        const result = buildDynaRequest(baseField, soilData, cultivations, [], "dairy", timeframe2025)
        const rotation = (result.field as Record<string, unknown>).rotation as { year: number; b_lu: string; b_lu_green?: string }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].b_lu).toBe("grs")
        expect(rotation[0].b_lu_green).toBe("phc")
    })
})

describe("buildDynaRequest – harvests", () => {
    it("uses actual harvest records from harvestsByBlu when provided", () => {
        const cultivations = [
            {
                b_lu: "cult-grass",
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-10-15"),
                b_lu_end: null,
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const harvestsByBlu = new Map([
            [
                "cult-grass",
                [
                    { b_lu_harvest_date: new Date("2025-05-10"), b_lu_yield: 3200 },
                    { b_lu_harvest_date: new Date("2025-07-01"), b_lu_yield: 2800 },
                    { b_lu_harvest_date: new Date("2025-09-15"), b_lu_yield: 2600 },
                ],
            ],
        ])
        const result = buildDynaRequest(
            baseField, soilData, cultivations, [], "dairy", timeframe2025,
            undefined, harvestsByBlu,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as { harvests: { b_date_harvest: string; b_lu_yield: number }[] }[]
        expect(rotation).toHaveLength(1)
        expect(rotation[0].harvests).toHaveLength(3)
        expect(rotation[0].harvests[0].b_date_harvest).toBe("2025-05-10")
        expect(rotation[0].harvests[0].b_lu_yield).toBe(3200)
        expect(rotation[0].harvests[2].b_date_harvest).toBe("2025-09-15")
    })

    it("falls back to b_lu_end harvest when no harvest records are in the map", () => {
        const cultivations = [
            {
                b_lu: "cult-wheat",
                b_lu_catalogue: "bwt",
                b_lu_start: new Date("2025-03-01"),
                b_lu_end: new Date("2025-08-15"),
                b_lu_croprotation: "main",
                m_cropresidue: false,
            },
        ]
        const result = buildDynaRequest(
            baseField, soilData, cultivations, [], "arable", timeframe2025,
            [{ b_lu_catalogue: "bwt", b_lu_yield: 1800 }],
            new Map(),
        )
        const rotation = (result.field as Record<string, unknown>).rotation as { harvests: { b_date_harvest: string; b_lu_yield?: number }[] }[]
        expect(rotation[0].harvests).toHaveLength(1)
        expect(rotation[0].harvests[0].b_date_harvest).toBe("2025-08-15")
        expect(rotation[0].harvests[0].b_lu_yield).toBe(1800)
    })

    it("uses catalogue yield as fallback when harvest record has no yield", () => {
        const cultivations = [
            {
                b_lu: "cult-grass",
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-10-15"),
                b_lu_end: null,
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const harvestsByBlu = new Map([
            [
                "cult-grass",
                [{ b_lu_harvest_date: new Date("2025-05-10"), b_lu_yield: null }],
            ],
        ])
        const result = buildDynaRequest(
            baseField, soilData, cultivations, [], "dairy", timeframe2025,
            [{ b_lu_catalogue: "grs", b_lu_yield: 1838 }],
            harvestsByBlu,
        )
        const rotation = (result.field as Record<string, unknown>).rotation as { harvests: { b_date_harvest: string; b_lu_yield?: number }[] }[]
        expect(rotation[0].harvests[0].b_lu_yield).toBe(1838)
    })

    it("produces empty harvests when no records and no end date (ongoing cultivation)", () => {
        const cultivations = [
            {
                b_lu: "cult-grass",
                b_lu_catalogue: "grs",
                b_lu_start: new Date("2024-10-15"),
                b_lu_end: null,
                b_lu_croprotation: "main",
                m_cropresidue: null,
            },
        ]
        const result = buildDynaRequest(baseField, soilData, cultivations, [], "dairy", timeframe2025)
        const rotation = (result.field as Record<string, unknown>).rotation as { harvests: unknown[] }[]
        expect(rotation[0].harvests).toHaveLength(0)
    })
})

