import { describe, expect, it, vi } from "vitest"

// Mock server-only modules so the pure functions can be tested in isolation
vi.mock("~/lib/fdm.server", () => ({ fdm: {} }))
vi.mock("~/integrations/nmi.server", () => ({ getNmiApiKey: () => undefined }))

import {
    assessDataCompleteness,
    buildNSupplyRequest,
    generateInsights,
    NmiApiError,
    type DataCompleteness,
    type NSupplyResult,
} from "./mineralisatie.server"

// ─── assessDataCompleteness ───────────────────────────────────────────────────

describe("assessDataCompleteness", () => {
    describe("MINIP method", () => {
        it("returns score 100 when all required and optional params are present", () => {
            const soilData = {
                a_som_loi: 3.5,
                a_clay_mi: 18,
                a_silt_mi: 22,
                a_sand_mi: 60,
                b_soiltype_agr: "zand",
            }
            const result = assessDataCompleteness(soilData, "minip")
            expect(result.score).toBe(100)
            expect(result.missing).toHaveLength(0)
            expect(result.estimated).toHaveLength(0)
        })

        it("returns score 80 when all required but no optional params present", () => {
            const soilData = {
                a_som_loi: 3.5,
                a_clay_mi: 18,
                a_silt_mi: 22,
            }
            const result = assessDataCompleteness(soilData, "minip")
            expect(result.score).toBe(80)
            expect(result.missing).toHaveLength(0)
            expect(result.estimated).toEqual(
                expect.arrayContaining(["a_sand_mi", "b_soiltype_agr"]),
            )
        })

        it("returns low score when required params are missing", () => {
            const soilData = {
                a_clay_mi: 18,
                // a_som_loi and a_silt_mi missing
            }
            const result = assessDataCompleteness(soilData, "minip")
            expect(result.missing).toContain("a_som_loi")
            expect(result.missing).toContain("a_silt_mi")
            expect(result.score).toBeLessThan(40)
        })

        it("includes available params with their values", () => {
            const soilData = { a_som_loi: 4.2, a_clay_mi: 20, a_silt_mi: 15 }
            const result = assessDataCompleteness(soilData, "minip")
            expect(result.available).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ param: "a_som_loi", value: 4.2 }),
                    expect.objectContaining({ param: "a_clay_mi", value: 20 }),
                ]),
            )
        })
    })

    describe("PMN method", () => {
        it("requires a_n_pmn and a_clay_mi", () => {
            const soilData = { a_clay_mi: 15 }
            const result = assessDataCompleteness(soilData, "pmn")
            expect(result.missing).toContain("a_n_pmn")
            expect(result.score).toBeLessThan(50)
        })

        it("full score with n_pmn and clay plus optionals", () => {
            const soilData = {
                a_n_pmn: 42,
                a_clay_mi: 15,
                a_sand_mi: 70,
                b_soiltype_agr: "zand",
            }
            const result = assessDataCompleteness(soilData, "pmn")
            expect(result.score).toBe(100)
        })
    })

    describe("Century method", () => {
        it("requires a_c_of, a_cn_fr, a_clay_mi, a_silt_mi", () => {
            const soilData = {}
            const result = assessDataCompleteness(soilData, "century")
            expect(result.missing).toEqual(
                expect.arrayContaining([
                    "a_c_of",
                    "a_cn_fr",
                    "a_clay_mi",
                    "a_silt_mi",
                ]),
            )
            expect(result.score).toBe(0)
        })
    })
})

// ─── buildNSupplyRequest ──────────────────────────────────────────────────────

describe("buildNSupplyRequest", () => {
    const baseField = {
        b_centroid: [5.1234, 52.5678] as [number, number],
    }
    const baseSoilData = {
        a_som_loi: 3.5,
        a_clay_mi: 18,
        a_silt_mi: 22,
    }
    const baseCultivations = [{ b_lu_catalogue: "nl_233" }]
    const baseTimeframe = {
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31"),
    }

    it("maps centroid to a_lat and a_lon", () => {
        const req = buildNSupplyRequest(
            baseField,
            baseSoilData,
            baseCultivations,
            "minip",
            baseTimeframe,
        )
        expect(req.a_lon).toBe(5.1234)
        expect(req.a_lat).toBe(52.5678)
    })

    it("strips nl_ prefix from b_lu_catalogue and converts to number", () => {
        const req = buildNSupplyRequest(
            baseField,
            baseSoilData,
            baseCultivations,
            "minip",
            baseTimeframe,
        )
        expect(req.b_lu_brp).toBe(233)
    })

    it("sets d_n_supply_method from method argument", () => {
        for (const method of ["minip", "pmn", "century"] as const) {
            const req = buildNSupplyRequest(
                baseField,
                baseSoilData,
                baseCultivations,
                method,
                baseTimeframe,
            )
            expect(req.d_n_supply_method).toBe(method)
        }
    })

    it("includes timeframe dates when provided", () => {
        const req = buildNSupplyRequest(
            baseField,
            baseSoilData,
            baseCultivations,
            "minip",
            baseTimeframe,
        )
        expect(req.d_start).toBe("2024-01-01")
        expect(req.d_end).toBe("2024-12-31")
    })

    it("uses default depth 0.3 when a_depth_lower is absent", () => {
        const req = buildNSupplyRequest(
            baseField,
            baseSoilData,
            baseCultivations,
            "minip",
            baseTimeframe,
        )
        expect(req.a_depth).toBe(0.3)
    })

    it("uses a_depth_lower from soilData when present", () => {
        const req = buildNSupplyRequest(
            baseField,
            { ...baseSoilData, a_depth_lower: 25 },
            baseCultivations,
            "minip",
            baseTimeframe,
        )
        expect(req.a_depth).toBe(25)
    })

    it("omits undefined soil params", () => {
        const req = buildNSupplyRequest(
            baseField,
            { a_som_loi: 3.5 }, // only som_loi
            baseCultivations,
            "minip",
            baseTimeframe,
        )
        expect(req.a_clay_mi).toBeUndefined()
        expect(req.a_n_pmn).toBeUndefined()
    })

    it("handles missing centroid gracefully", () => {
        const req = buildNSupplyRequest(
            { b_centroid: null },
            baseSoilData,
            baseCultivations,
            "minip",
            baseTimeframe,
        )
        expect(req.a_lat).toBeUndefined()
        expect(req.a_lon).toBeUndefined()
    })

    it("handles BRP code without nl_ prefix", () => {
        const req = buildNSupplyRequest(
            baseField,
            baseSoilData,
            [{ b_lu_catalogue: "233" }],
            "minip",
            baseTimeframe,
        )
        expect(req.b_lu_brp).toBe(233)
    })

    it("skips non-numeric BRP codes", () => {
        const req = buildNSupplyRequest(
            baseField,
            baseSoilData,
            [{ b_lu_catalogue: "nl_abc" }],
            "minip",
            baseTimeframe,
        )
        expect(req.b_lu_brp).toBeUndefined()
    })
})

// ─── generateInsights ─────────────────────────────────────────────────────────

describe("generateInsights", () => {
    function makeResult(
        totalAnnualN: number,
        score = 90,
    ): NSupplyResult {
        const data = Array.from({ length: 365 }, (_, i) => ({
            doy: i + 1,
            d_n_supply_actual: (totalAnnualN / 365) * (i + 1),
        }))
        const completeness: DataCompleteness = {
            available: [],
            missing: [],
            estimated: [],
            score,
        }
        return {
            b_id: "field-1",
            b_name: "Testperceel",
            method: "minip",
            data,
            totalAnnualN,
            completeness,
        }
    }

    it("generates high-N insight when field is 120%+ above farm average", () => {
        const result = makeResult(180)
        const insights = generateInsights(result, 120, 100)
        expect(insights.some((i) => i.includes("hoger dan het bedrijfsgemiddelde"))).toBe(true)
        expect(insights.some((i) => i.includes("kunstmestgift te verlagen"))).toBe(true)
    })

    it("generates low-N insight when field is below 80% of farm average", () => {
        const result = makeResult(80)
        const insights = generateInsights(result, 120, 100)
        expect(insights.some((i) => i.includes("laag N-leverend vermogen"))).toBe(true)
    })

    it("generates completeness warning when score < 70", () => {
        const result = makeResult(120, 50)
        const insights = generateInsights(result, 120, 100)
        expect(insights.some((i) => i.includes("Betrouwbaarheid beperkt"))).toBe(true)
        expect(insights.some((i) => i.includes("50%"))).toBe(true)
    })

    it("generates season progress insight with kg values", () => {
        const result = makeResult(200)
        const insights = generateInsights(result, 200, 180)
        const progressInsight = insights.find((i) => i.includes("gemineraliseerd"))
        expect(progressInsight).toBeDefined()
        expect(progressInsight).toMatch(/kg N\/ha/)
    })

    it("returns no farm-comparison insight when farmAvg is undefined", () => {
        const result = makeResult(200)
        const insights = generateInsights(result, undefined, 100)
        expect(insights.some((i) => i.includes("bedrijfsgemiddelde"))).toBe(false)
    })
})

// ─── NmiApiError ─────────────────────────────────────────────────────────────

describe("NmiApiError", () => {
    it("sets status and message correctly", () => {
        const err = new NmiApiError(422, "Onvoldoende gegevens")
        expect(err.status).toBe(422)
        expect(err.message).toBe("Onvoldoende gegevens")
        expect(err.name).toBe("NmiApiError")
        expect(err).toBeInstanceOf(Error)
    })
})
