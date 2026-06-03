import { describe, expect, it } from "vitest"
import {
    BCS_INDICATORS,
    calculateBcs,
    deriveBcsLabContext,
    deriveOmBcs,
    derivePhBcs,
    getBcsScoreColor,
    getBcsScoreLabel,
} from "./index"

// D_BCS = 2*CC + 3*(RD + SC + EW + SS + pH + OM) + 1*GS - 2*P - 1*(C + RT)
// I_BCS = clamp(D_BCS / 40, 0, 1)

describe("calculateBcs", () => {
    describe("with all scores at zero", () => {
        it("returns zero for all fields", () => {
            const result = calculateBcs({
                a_ss_bcs: 0, a_sc_bcs: 0, a_rd_bcs: 0, a_ew_bcs: 0,
                a_cc_bcs: 0, a_gs_bcs: 0, a_p_bcs: 0, a_c_bcs: 0, a_rt_bcs: 0,
            })
            expect(result.d_bcs).toBe(0)
            expect(result.i_bcs).toBe(0)
        })
    })

    describe("with no scores provided", () => {
        it("treats missing values as 0", () => {
            const result = calculateBcs({})
            expect(result.d_bcs).toBe(0)
            expect(result.i_bcs).toBe(0)
        })
        it("treats null values as 0", () => {
            expect(calculateBcs({ a_ss_bcs: null, a_p_bcs: null }).d_bcs).toBe(0)
        })
    })

    describe("positive field indicators", () => {
        it("adds weight 3 for SS (bodemstructuur)", () => {
            expect(calculateBcs({ a_ss_bcs: 2 }).d_bcs).toBe(6)
        })
        it("adds weight 3 for SC (verdichting)", () => {
            expect(calculateBcs({ a_sc_bcs: 2 }).d_bcs).toBe(6)
        })
        it("adds weight 3 for RD (beworteling)", () => {
            expect(calculateBcs({ a_rd_bcs: 2 }).d_bcs).toBe(6)
        })
        it("adds weight 3 for EW (regenwormen)", () => {
            expect(calculateBcs({ a_ew_bcs: 2 }).d_bcs).toBe(6)
        })
        it("adds weight 2 for CC (gewasbedekking)", () => {
            expect(calculateBcs({ a_cc_bcs: 2 }).d_bcs).toBe(4)
        })
        it("adds weight 1 for GS (gekleurde vlekken)", () => {
            expect(calculateBcs({ a_gs_bcs: 2 }).d_bcs).toBe(2)
        })
    })

    describe("lab-derived indicators (a_ph_bcs, a_som_bcs via labContext)", () => {
        // dekzand + no potatoes/sugarbeet/grass/mais → phOptimum ~5.4 for a_som_loi=2
        // a_ph_cc = 5.4 → delta = 0 → derivePhBcs(0) = 2
        it("adds weight 3 for pH BCS (a_ph_bcs=2 at optimum pH, no OM context)", () => {
            const result = calculateBcs({}, {
                a_ph_cc: 5.4,
                a_som_loi: 2,
                b_soiltype_agr: "dekzand",
            })
            expect(result.a_ph_bcs).toBe(2)
            expect(result.a_som_bcs).toBeNull()
            expect(result.d_bcs).toBe(6)
        })
        // akkerbouw/zand: thresholds low=3.0, high=4.8 → a_som_loi=4.0 → score 1
        it("adds weight 3 for OM BCS (a_som_bcs=1, no pH context)", () => {
            const result = calculateBcs({}, {
                a_som_loi: 4.0,
                om_crop_category: "akkerbouw",
                om_soiltype_n: "zand",
            })
            expect(result.a_som_bcs).toBe(1)
            expect(result.a_ph_bcs).toBeNull()
            expect(result.d_bcs).toBe(3)
        })
        it("returns null for both when no labContext is provided", () => {
            const result = calculateBcs({ a_ss_bcs: 2 })
            expect(result.a_ph_bcs).toBeNull()
            expect(result.a_som_bcs).toBeNull()
        })
        it("skips pH BCS for clay soil when a_clay_mi is missing", () => {
            const result = calculateBcs({}, {
                a_ph_cc: 6.0,
                a_som_loi: 2,
                b_soiltype_agr: "zeeklei",
                a_clay_mi: null,
            })
            expect(result.a_ph_bcs).toBeNull()
        })
        it("derives pH BCS for clay soil when a_clay_mi is provided", () => {
            const result = calculateBcs({}, {
                a_ph_cc: 6.7,
                a_som_loi: 1,
                b_soiltype_agr: "zeeklei",
                a_clay_mi: 4,
            })
            expect(result.a_ph_bcs).toBe(2)
        })
    })

    describe("negative indicators", () => {
        it("subtracts weight 2 for P (plasvorming)", () => {
            expect(calculateBcs({ a_ss_bcs: 2, a_p_bcs: 2 }).d_bcs).toBe(2)
        })
        it("subtracts weight 1 for C (scheuren)", () => {
            expect(calculateBcs({ a_ss_bcs: 2, a_c_bcs: 2 }).d_bcs).toBe(4)
        })
        it("subtracts weight 1 for RT (spoorvorming)", () => {
            expect(calculateBcs({ a_ss_bcs: 2, a_rt_bcs: 2 }).d_bcs).toBe(4)
        })
        it("floors d_bcs at 0 when negatives exceed positives", () => {
            const result = calculateBcs({ a_p_bcs: 2, a_c_bcs: 2, a_rt_bcs: 2 })
            expect(result.d_bcs).toBe(0)
            expect(result.i_bcs).toBe(0)
        })
    })

    describe("d_bcs_max", () => {
        it("is always 40 (official normalizer)", () => {
            expect(calculateBcs({}).d_bcs_max).toBe(40)
            expect(calculateBcs({ a_ss_bcs: 2 }).d_bcs_max).toBe(40)
            expect(calculateBcs({}, { a_ph_cc: 5.4, a_som_loi: 2, b_soiltype_agr: "dekzand" }).d_bcs_max).toBe(40)
        })
        it("reaches max field score of 30 without lab scores (i_bcs = 0.75)", () => {
            const result = calculateBcs({
                a_ss_bcs: 2, a_sc_bcs: 2, a_rd_bcs: 2, a_ew_bcs: 2,
                a_cc_bcs: 2, a_gs_bcs: 2, a_p_bcs: 0, a_c_bcs: 0, a_rt_bcs: 0,
            })
            expect(result.d_bcs).toBe(30)
            expect(result.i_bcs).toBeCloseTo(0.75)
        })
        it("caps i_bcs at 1.0 when all 11 indicators at max (d_bcs = 42)", () => {
            // akkerbouw/zand: a_som_loi=5.0 → a_som_bcs=2 (> high=4.8)
            // dekzand + a_ph_cc=5.4 + a_som_loi=5.0 → phOptimum ~5.2 → delta≈0 → a_ph_bcs=2
            const result = calculateBcs(
                { a_ss_bcs: 2, a_sc_bcs: 2, a_rd_bcs: 2, a_ew_bcs: 2, a_cc_bcs: 2, a_gs_bcs: 2 },
                {
                    a_ph_cc: 5.4,
                    a_som_loi: 5.0,
                    b_soiltype_agr: "dekzand",
                    om_crop_category: "akkerbouw",
                    om_soiltype_n: "zand",
                },
            )
            expect(result.a_ph_bcs).toBe(2)
            expect(result.a_som_bcs).toBe(2)
            expect(result.d_bcs).toBe(42)
            expect(result.i_bcs).toBe(1.0)
        })
    })

    describe("i_bcs normalization", () => {
        it("gives i_bcs = 0.5 for d_bcs = 20", () => {
            const result = calculateBcs({ a_ss_bcs: 2, a_sc_bcs: 2, a_rd_bcs: 2, a_cc_bcs: 1 })
            expect(result.d_bcs).toBe(20)
            expect(result.i_bcs).toBe(0.5)
        })
    })
})

describe("derivePhBcs (via OBIC logistic ind_ph)", () => {
    it("returns 2 when D_PH_DELTA = 0 (pH at optimum)", () => {
        expect(derivePhBcs(0)).toBe(2)
    })
    it("returns 2 for small delta (< ~0.23)", () => {
        expect(derivePhBcs(0.1)).toBe(2)
        expect(derivePhBcs(0.2)).toBe(2)
    })
    it("returns 1 for moderate delta (~0.23–0.43)", () => {
        expect(derivePhBcs(0.3)).toBe(1)
    })
    it("returns 0 for large delta (>= ~0.43)", () => {
        expect(derivePhBcs(0.5)).toBe(0)
        expect(derivePhBcs(1.0)).toBe(0)
        expect(derivePhBcs(2.0)).toBe(0)
    })
})

describe("deriveOmBcs (OBIC crop x soiltype lookup)", () => {
    describe("natuur always returns 2", () => {
        it("returns 2 regardless of a_som_loi", () => {
            expect(deriveOmBcs(0.5, "natuur", "zand")).toBe(2)
            expect(deriveOmBcs(100, "natuur", "klei")).toBe(2)
        })
    })

    describe("akkerbouw / klei (low=2.2, high=3.8)", () => {
        it("returns 0 below threshold", () => {
            expect(deriveOmBcs(2.0, "akkerbouw", "klei")).toBe(0)
        })
        it("returns 1 in range", () => {
            expect(deriveOmBcs(3.0, "akkerbouw", "klei")).toBe(1)
        })
        it("returns 2 above threshold", () => {
            expect(deriveOmBcs(4.0, "akkerbouw", "klei")).toBe(2)
        })
    })

    describe("akkerbouw / zand (low=3.0, high=4.8)", () => {
        it("returns 0 below threshold", () => {
            expect(deriveOmBcs(2.5, "akkerbouw", "zand")).toBe(0)
        })
        it("returns 1 in range", () => {
            expect(deriveOmBcs(4.0, "akkerbouw", "zand")).toBe(1)
        })
        it("returns 2 above threshold", () => {
            expect(deriveOmBcs(5.0, "akkerbouw", "zand")).toBe(2)
        })
    })

    describe("grasland / veen (low=15.5, high=28.6)", () => {
        it("returns 0 below threshold", () => {
            expect(deriveOmBcs(10, "grasland", "veen")).toBe(0)
        })
        it("returns 1 in range", () => {
            expect(deriveOmBcs(20, "grasland", "veen")).toBe(1)
        })
        it("returns 2 above threshold", () => {
            expect(deriveOmBcs(30, "grasland", "veen")).toBe(2)
        })
    })

    describe("mais / loess (low=2.6, high=3.4)", () => {
        it("returns 0 below threshold", () => {
            expect(deriveOmBcs(2.0, "mais", "loess")).toBe(0)
        })
        it("returns 1 in range", () => {
            expect(deriveOmBcs(3.0, "mais", "loess")).toBe(1)
        })
        it("returns 2 above threshold", () => {
            expect(deriveOmBcs(3.5, "mais", "loess")).toBe(2)
        })
    })
})

describe("getBcsScoreColor", () => {
    it("returns 'red' for d_bcs < 10 (slecht)", () => {
        expect(getBcsScoreColor(0)).toBe("red")
        expect(getBcsScoreColor(9)).toBe("red")
    })
    it("returns 'orange' for 10 <= d_bcs < 20 (onvoldoende)", () => {
        expect(getBcsScoreColor(10)).toBe("orange")
        expect(getBcsScoreColor(19)).toBe("orange")
    })
    it("returns 'yellow' for 20 <= d_bcs < 30 (matig)", () => {
        expect(getBcsScoreColor(20)).toBe("yellow")
        expect(getBcsScoreColor(29)).toBe("yellow")
    })
    it("returns 'green' for 30 <= d_bcs < 40 (goed)", () => {
        expect(getBcsScoreColor(30)).toBe("green")
        expect(getBcsScoreColor(39)).toBe("green")
    })
    it("returns 'emerald' for d_bcs >= 40 (zeer goed)", () => {
        expect(getBcsScoreColor(40)).toBe("emerald")
        expect(getBcsScoreColor(42)).toBe("emerald")
    })
})

describe("getBcsScoreLabel", () => {
    it("returns 'Slecht' for d_bcs < 10", () => {
        expect(getBcsScoreLabel(0)).toBe("Slecht")
        expect(getBcsScoreLabel(9)).toBe("Slecht")
    })
    it("returns 'Onvoldoende' for 10 <= d_bcs < 20", () => {
        expect(getBcsScoreLabel(10)).toBe("Onvoldoende")
        expect(getBcsScoreLabel(19)).toBe("Onvoldoende")
    })
    it("returns 'Matig' for 20 <= d_bcs < 30", () => {
        expect(getBcsScoreLabel(20)).toBe("Matig")
        expect(getBcsScoreLabel(29)).toBe("Matig")
    })
    it("returns 'Goed' for 30 <= d_bcs < 40", () => {
        expect(getBcsScoreLabel(30)).toBe("Goed")
        expect(getBcsScoreLabel(39)).toBe("Goed")
    })
    it("returns 'Zeer goed' for d_bcs >= 40", () => {
        expect(getBcsScoreLabel(40)).toBe("Zeer goed")
        expect(getBcsScoreLabel(42)).toBe("Zeer goed")
    })
})

describe("BCS_INDICATORS", () => {
    it("has exactly 11 indicators", () => {
        expect(BCS_INDICATORS).toHaveLength(11)
    })
    it("has 8 positive indicators", () => {
        expect(BCS_INDICATORS.filter((i) => i.direction === "positive")).toHaveLength(8)
    })
    it("has 3 negative indicators", () => {
        expect(BCS_INDICATORS.filter((i) => i.direction === "negative")).toHaveLength(3)
    })
    it("has 9 field indicators and 2 lab indicators", () => {
        expect(BCS_INDICATORS.filter((i) => i.source === "field")).toHaveLength(9)
        expect(BCS_INDICATORS.filter((i) => i.source === "lab")).toHaveLength(2)
    })
    it("each indicator has a unique key", () => {
        const keys = BCS_INDICATORS.map((i) => i.key)
        expect(new Set(keys).size).toBe(BCS_INDICATORS.length)
    })
    it("negative indicators have weight 1 or 2", () => {
        for (const ind of BCS_INDICATORS.filter((i) => i.direction === "negative")) {
            expect(ind.weight).toBeGreaterThanOrEqual(1)
            expect(ind.weight).toBeLessThanOrEqual(2)
        }
    })
})

describe("deriveBcsLabContext", () => {
    const noCultivations: never[] = []

    describe("mapOmSoilType — soil type to om_soiltype_n mapping", () => {
        const soilTypeCases: Array<[string, "zand" | "klei" | "loess" | "veen" | undefined]> = [
            ["dekzand", "zand"],
            ["dalgrond", "zand"],
            ["duinzand", "zand"],
            ["zeeklei", "klei"],
            ["rivierklei", "klei"],
            ["maasklei", "klei"],
            ["moerige_klei", "klei"],
            ["loess", "loess"],
            ["veen", "veen"],
        ]
        for (const [soiltype, expected] of soilTypeCases) {
            it(`maps '${soiltype}' → '${expected}'`, () => {
                const ctx = deriveBcsLabContext(
                    { b_soiltype_agr: soiltype, a_ph_cc: null, a_som_loi: null },
                    noCultivations,
                    2024,
                )
                expect(ctx.om_soiltype_n).toBe(expected)
            })
        }

        it("maps unknown soil type → undefined", () => {
            const ctx = deriveBcsLabContext(
                { b_soiltype_agr: "unknown_type", a_ph_cc: null, a_som_loi: null },
                noCultivations,
                2024,
            )
            expect(ctx.om_soiltype_n).toBeUndefined()
        })

        it("maps null soil type → undefined", () => {
            const ctx = deriveBcsLabContext(
                { b_soiltype_agr: null, a_ph_cc: null, a_som_loi: null },
                noCultivations,
                2024,
            )
            expect(ctx.om_soiltype_n).toBeUndefined()
        })
    })

    describe("with soil data and no cultivations", () => {
        it("passes through a_ph_cc, a_som_loi, a_clay_mi", () => {
            const ctx = deriveBcsLabContext(
                { a_ph_cc: 5.8, a_som_loi: 3.2, a_clay_mi: 12, b_soiltype_agr: "zeeklei" },
                noCultivations,
                2024,
            )
            expect(ctx.a_ph_cc).toBe(5.8)
            expect(ctx.a_som_loi).toBe(3.2)
            expect(ctx.a_clay_mi).toBe(12)
            expect(ctx.b_soiltype_agr).toBe("zeeklei")
        })

        it("sets all d_cp_* to 0 and b_lu_is_clover=false when no cultivations", () => {
            const ctx = deriveBcsLabContext(
                { b_soiltype_agr: "dekzand" },
                noCultivations,
                2024,
            )
            expect(ctx.d_cp_starch).toBe(0)
            expect(ctx.d_cp_potato).toBe(0)
            expect(ctx.d_cp_sugarbeet).toBe(0)
            expect(ctx.d_cp_grass).toBe(0)
            expect(ctx.d_cp_mais).toBe(0)
            expect(ctx.b_lu_is_clover).toBe(false)
            expect(ctx.om_crop_category).toBe("akkerbouw")
        })

        it("propagates null values as null", () => {
            const ctx = deriveBcsLabContext(
                { a_ph_cc: null, a_som_loi: null, a_clay_mi: null, b_soiltype_agr: null },
                noCultivations,
                2024,
            )
            expect(ctx.a_ph_cc).toBeNull()
            expect(ctx.a_som_loi).toBeNull()
            expect(ctx.a_clay_mi).toBeNull()
            expect(ctx.b_soiltype_agr).toBeNull()
        })
    })

    describe("with cultivations", () => {
        it("derives crop plan fractions from cultivations", () => {
            const cultivations = [
                {
                    b_lu_catalogue: "c1",
                    b_lu_croprotation: "grass",
                    b_lu_start: new Date("2022-03-01"),
                    b_lu_end: new Date("2022-10-31"),
                },
                {
                    b_lu_catalogue: "c1",
                    b_lu_croprotation: "grass",
                    b_lu_start: new Date("2023-03-01"),
                    b_lu_end: new Date("2023-10-31"),
                },
                {
                    b_lu_catalogue: "c2",
                    b_lu_croprotation: "maize",
                    b_lu_start: new Date("2024-03-01"),
                    b_lu_end: new Date("2024-10-31"),
                },
            ]
            const ctx = deriveBcsLabContext(
                { b_soiltype_agr: "dekzand", a_som_loi: 4.0 },
                cultivations,
                2024,
            )
            expect(ctx.d_cp_grass).toBeCloseTo(2 / 3)
            expect(ctx.d_cp_mais).toBeCloseTo(1 / 3)
            expect(ctx.om_crop_category).toBe("mais") // bcsYear = 2024 → maize
        })
    })
})
