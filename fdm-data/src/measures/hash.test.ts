import { describe, expect, it } from "vitest"
import type { CatalogueMeasureItem } from "./d"
import { hashMeasure } from "./hash"

const baseMeasure: CatalogueMeasureItem = {
    m_id: "bln_BM1",
    m_source: "bln",
    m_name: "Toedienen compost",
    m_description: "Toevoeging van compost verbetert de bodemstructuur.",
    m_summary: "Compost toedienen",
    m_source_url: "https://example.com/BM1",
    m_conflicts: ["bln_BM2"],
}

describe("hashMeasure", () => {
    it("should generate a hash string", async () => {
        const hash = await hashMeasure({ ...baseMeasure })
        expect(hash).toBeDefined()
        expect(typeof hash).toBe("string")
        expect(hash.length).toBeGreaterThan(0)
    })

    it("should generate the same hash for identical items", async () => {
        const hash1 = await hashMeasure({ ...baseMeasure })
        const hash2 = await hashMeasure({ ...baseMeasure })
        expect(hash1).toBe(hash2)
    })

    it("should generate different hashes for different items", async () => {
        const hash1 = await hashMeasure({ ...baseMeasure })
        const hash2 = await hashMeasure({ ...baseMeasure, m_name: "Updated name" })
        expect(hash1).not.toBe(hash2)
    })

    it("should be stable even when hash field is pre-set to null", async () => {
        const item1 = { ...baseMeasure, hash: null }
        const item2 = { ...baseMeasure }
        const hash1 = await hashMeasure(item1)
        const hash2 = await hashMeasure(item2)
        expect(hash1).toBe(hash2)
    })

    it("should detect changes in m_conflicts array", async () => {
        const hash1 = await hashMeasure({ ...baseMeasure, m_conflicts: ["bln_BM2"] })
        const hash2 = await hashMeasure({ ...baseMeasure, m_conflicts: ["bln_BM3"] })
        expect(hash1).not.toBe(hash2)
    })
})
