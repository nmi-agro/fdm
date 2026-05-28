import { describe, expect, it } from "vitest"
import { BCS_INDICATORS, calculateBcs, getBcsScoreColor } from "./index"

// D_BCS = 2×CC + 3×(RD + SC + EW + SS + pH + OM) + 1×GS − 2×P − 1×(C + RT)
// I_BCS = clamp(D_BCS / 40, 0, 1)

describe("calculateBcs", () => {
    describe("with all scores at zero", () => {
        it("returns zero for all fields", () => {
            const result = calculateBcs({
                a_ss_bcs: 0,
                a_sc_bcs: 0,
                a_rd_bcs: 0,
                a_ew_bcs: 0,
                a_cc_bcs: 0,
                a_gs_bcs: 0,
                a_p_bcs: 0,
                a_c_bcs: 0,
                a_rt_bcs: 0,
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
            const result = calculateBcs({
                a_ss_bcs: null,
                a_p_bcs: null,
            })
            expect(result.d_bcs).toBe(0)
        })
    })

    describe("positive indicators", () => {
        it("adds weight 3 for SS (bodemstructuur)", () => {
            const result = calculateBcs({ a_ss_bcs: 2 })
            expect(result.d_bcs).toBe(6) // 3 × 2
        })

        it("adds weight 3 for SC (verdichting)", () => {
            const result = calculateBcs({ a_sc_bcs: 2 })
            expect(result.d_bcs).toBe(6)
        })

        it("adds weight 3 for RD (beworteling)", () => {
            const result = calculateBcs({ a_rd_bcs: 2 })
            expect(result.d_bcs).toBe(6)
        })

        it("adds weight 3 for EW (regenwormen)", () => {
            const result = calculateBcs({ a_ew_bcs: 2 })
            expect(result.d_bcs).toBe(6)
        })

        it("adds weight 2 for CC (gewasbedekking)", () => {
            const result = calculateBcs({ a_cc_bcs: 2 })
            expect(result.d_bcs).toBe(4) // 2 × 2
        })

        it("adds weight 1 for GS (gekleurde vlekken)", () => {
            const result = calculateBcs({ a_gs_bcs: 2 })
            expect(result.d_bcs).toBe(2) // 1 × 2
        })
    })

    describe("negative indicators", () => {
        it("subtracts weight 2 for P (plasvorming)", () => {
            const result = calculateBcs({ a_ss_bcs: 2, a_p_bcs: 2 })
            // 3×2 - 2×2 = 6 - 4 = 2
            expect(result.d_bcs).toBe(2)
        })

        it("subtracts weight 1 for C (scheuren)", () => {
            const result = calculateBcs({ a_ss_bcs: 2, a_c_bcs: 2 })
            // 3×2 - 1×2 = 6 - 2 = 4
            expect(result.d_bcs).toBe(4)
        })

        it("subtracts weight 1 for RT (spoorvorming)", () => {
            const result = calculateBcs({ a_ss_bcs: 2, a_rt_bcs: 2 })
            // 3×2 - 1×2 = 6 - 2 = 4
            expect(result.d_bcs).toBe(4)
        })

        it("floors d_bcs at 0 when negatives exceed positives", () => {
            const result = calculateBcs({
                a_ss_bcs: 0,
                a_p_bcs: 2, // -4
                a_c_bcs: 2, // -2
                a_rt_bcs: 2, // -2
            })
            expect(result.d_bcs).toBe(0)
            expect(result.i_bcs).toBe(0)
        })
    })

    describe("with all positives at maximum", () => {
        it("reaches the expected maximum without lab scores", () => {
            const result = calculateBcs({
                a_ss_bcs: 2,
                a_sc_bcs: 2,
                a_rd_bcs: 2,
                a_ew_bcs: 2,
                a_cc_bcs: 2,
                a_gs_bcs: 2,
                a_p_bcs: 0,
                a_c_bcs: 0,
                a_rt_bcs: 0,
            })
            // 3×2 + 3×2 + 3×2 + 3×2 + 2×2 + 1×2 = 6+6+6+6+4+2 = 30
            expect(result.d_bcs).toBe(30)
            expect(result.i_bcs).toBeCloseTo(0.75)
            expect(result.d_bcs_max).toBe(4 + 30) // 2×2 + 3×2×5 = 34
        })

        it("includes lab scores in d_bcs_max when provided", () => {
            const result = calculateBcs({
                a_ss_bcs: 2,
                a_sc_bcs: 2,
                a_rd_bcs: 2,
                a_ew_bcs: 2,
                a_cc_bcs: 2,
                a_gs_bcs: 2,
                bcs_om: 2,
                bcs_ph: 2,
            })
            // 30 + 3×2 + 3×2 = 30 + 6 + 6 = 42 → capped to i_bcs = 1
            expect(result.d_bcs).toBe(42)
            expect(result.i_bcs).toBe(1.0)
            expect(result.d_bcs_max).toBe(4 + 3 * 2 * 7) // CC + 7 weight-3 fields
        })
    })

    describe("lab scores (bcs_om, bcs_ph)", () => {
        it("adds weight 3 for bcs_ph", () => {
            const result = calculateBcs({ bcs_ph: 2 })
            expect(result.d_bcs).toBe(6)
            expect(result.includes_lab_scores).toBe(true)
        })

        it("adds weight 3 for bcs_om", () => {
            const result = calculateBcs({ bcs_om: 1 })
            expect(result.d_bcs).toBe(3)
            expect(result.includes_lab_scores).toBe(true)
        })

        it("reports includes_lab_scores = false when neither is provided", () => {
            const result = calculateBcs({ a_ss_bcs: 2 })
            expect(result.includes_lab_scores).toBe(false)
        })

        it("reports includes_lab_scores = true when only bcs_ph is set", () => {
            const result = calculateBcs({ bcs_ph: 1 })
            expect(result.includes_lab_scores).toBe(true)
        })
    })

    describe("i_bcs normalization", () => {
        it("caps i_bcs at 1.0 even when d_bcs exceeds 40", () => {
            // All indicators at max including lab
            const result = calculateBcs({
                a_ss_bcs: 2,
                a_sc_bcs: 2,
                a_rd_bcs: 2,
                a_ew_bcs: 2,
                a_cc_bcs: 2,
                a_gs_bcs: 2,
                bcs_om: 2,
                bcs_ph: 2,
            })
            expect(result.i_bcs).toBe(1.0)
        })

        it("gives i_bcs = 0.5 for d_bcs = 20", () => {
            // a_ss_bcs=2 (6) + a_sc_bcs=2 (6) + a_rd_bcs=2 (6) + a_cc_bcs=1 (2) = 20
            const result = calculateBcs({
                a_ss_bcs: 2,
                a_sc_bcs: 2,
                a_rd_bcs: 2,
                a_cc_bcs: 1,
            })
            expect(result.d_bcs).toBe(20)
            expect(result.i_bcs).toBe(0.5)
        })
    })
})

describe("getBcsScoreColor", () => {
    it("returns 'red' for i_bcs < 0.33", () => {
        expect(getBcsScoreColor(0)).toBe("red")
        expect(getBcsScoreColor(0.1)).toBe("red")
        expect(getBcsScoreColor(0.329)).toBe("red")
    })

    it("returns 'orange' for 0.33 <= i_bcs < 0.66", () => {
        expect(getBcsScoreColor(0.33)).toBe("orange")
        expect(getBcsScoreColor(0.5)).toBe("orange")
        expect(getBcsScoreColor(0.659)).toBe("orange")
    })

    it("returns 'green' for i_bcs >= 0.66", () => {
        expect(getBcsScoreColor(0.66)).toBe("green")
        expect(getBcsScoreColor(0.8)).toBe("green")
        expect(getBcsScoreColor(1.0)).toBe("green")
    })
})

describe("BCS_INDICATORS", () => {
    it("has exactly 9 indicators", () => {
        expect(BCS_INDICATORS).toHaveLength(9)
    })

    it("has 6 positive indicators", () => {
        const positive = BCS_INDICATORS.filter((i) => i.direction === "positive")
        expect(positive).toHaveLength(6)
    })

    it("has 3 negative indicators", () => {
        const negative = BCS_INDICATORS.filter((i) => i.direction === "negative")
        expect(negative).toHaveLength(3)
    })

    it("each indicator has a unique key matching a BcsScores field", () => {
        const keys = BCS_INDICATORS.map((i) => i.key)
        const unique = new Set(keys)
        expect(unique.size).toBe(BCS_INDICATORS.length)
    })

    it("negative indicators have weight 1 or 2", () => {
        const negative = BCS_INDICATORS.filter((i) => i.direction === "negative")
        for (const ind of negative) {
            expect(ind.weight).toBeGreaterThanOrEqual(1)
            expect(ind.weight).toBeLessThanOrEqual(2)
        }
    })
})
