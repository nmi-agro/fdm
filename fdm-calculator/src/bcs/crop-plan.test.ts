import { describe, expect, it } from "vitest"
import { deriveCropPlanFractions } from "./crop-plan"

function makeCultivation(
    catalogue: string,
    croprotation: string | null,
    startYear: number,
    endYear = startYear,
) {
    return {
        b_lu_catalogue: catalogue,
        b_lu_croprotation: croprotation,
        b_lu_start: new Date(`${startYear}-03-01`),
        b_lu_end: new Date(`${endYear}-10-31`),
    }
}

describe("deriveCropPlanFractions", () => {
    describe("edge cases", () => {
        it("returns all zeros for empty cultivations", () => {
            const result = deriveCropPlanFractions([], 2024)
            expect(result.d_cp_starch).toBe(0)
            expect(result.d_cp_potato).toBe(0)
            expect(result.d_cp_sugarbeet).toBe(0)
            expect(result.d_cp_grass).toBe(0)
            expect(result.d_cp_mais).toBe(0)
            expect(result.b_lu_is_clover).toBe(false)
            expect(result.om_crop_category).toBe("akkerbouw")
        })

        it("returns all zeros when b_lu_start is missing", () => {
            const result = deriveCropPlanFractions(
                [
                    {
                        b_lu_catalogue: "abc",
                        b_lu_croprotation: "grass",
                        b_lu_start: null,
                    },
                ],
                2024,
            )
            expect(result.d_cp_grass).toBe(0)
        })

        it("ignores cultivations after bcsYear", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("abc", "grass", 2025)],
                2024,
            )
            expect(result.d_cp_grass).toBe(0)
        })

        it("returns all zeros when no rotation type is mapped", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("abc", "unknown_type", 2024)],
                2024,
            )
            expect(result.d_cp_starch).toBe(0)
            expect(result.d_cp_grass).toBe(0)
        })
    })

    describe("single-year rotation types", () => {
        it("counts 'starch' into d_cp_starch", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", "starch", 2024)],
                2024,
            )
            expect(result.d_cp_starch).toBe(1)
            expect(result.om_crop_category).toBe("akkerbouw")
        })

        it("counts 'potato' into d_cp_potato", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", "potato", 2024)],
                2024,
            )
            expect(result.d_cp_potato).toBe(1)
        })

        it("counts 'sugarbeet' into d_cp_sugarbeet", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", "sugarbeet", 2024)],
                2024,
            )
            expect(result.d_cp_sugarbeet).toBe(1)
        })

        it("counts 'grass' into d_cp_grass and sets om_crop_category='grasland'", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", "grass", 2024)],
                2024,
            )
            expect(result.d_cp_grass).toBe(1)
            expect(result.om_crop_category).toBe("grasland")
            expect(result.b_lu_is_clover).toBe(false)
        })

        it("counts 'clover' into d_cp_grass and sets om_crop_category='grasland' and b_lu_is_clover=true", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", "clover", 2024)],
                2024,
            )
            expect(result.d_cp_grass).toBe(1)
            expect(result.om_crop_category).toBe("grasland")
            expect(result.b_lu_is_clover).toBe(true)
        })

        it("counts 'alfalfa' into d_cp_grass and sets om_crop_category='grasland'", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", "alfalfa", 2024)],
                2024,
            )
            expect(result.d_cp_grass).toBe(1)
            expect(result.om_crop_category).toBe("grasland")
            expect(result.b_lu_is_clover).toBe(false)
        })

        it("counts 'maize' into d_cp_mais and sets om_crop_category='mais'", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", "maize", 2024)],
                2024,
            )
            expect(result.d_cp_mais).toBe(1)
            expect(result.om_crop_category).toBe("mais")
        })

        it("counts 'nature' into d_cp_grass and sets om_crop_category='natuur'", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", "nature", 2024)],
                2024,
            )
            expect(result.d_cp_grass).toBe(1)
            expect(result.om_crop_category).toBe("natuur")
        })

        it("sets om_crop_category='akkerbouw' for unknown rotation in bcsYear", () => {
            const result = deriveCropPlanFractions(
                [makeCultivation("c1", null, 2024)],
                2024,
            )
            expect(result.om_crop_category).toBe("akkerbouw")
        })
    })

    describe("multi-year fractions", () => {
        it("calculates d_cp_grass as fraction over 4 years (2 grass years = 0.5)", () => {
            const cultivations = [
                makeCultivation("c1", "grass", 2021),
                makeCultivation("c2", "grass", 2022),
                makeCultivation("c3", "starch", 2023),
                makeCultivation("c4", "starch", 2024),
            ]
            const result = deriveCropPlanFractions(cultivations, 2024)
            expect(result.d_cp_grass).toBeCloseTo(0.5)
            expect(result.d_cp_starch).toBeCloseTo(0.5)
        })

        it("uses the bcsYear rotation for om_crop_category, not the majority", () => {
            // 3 years starch, 1 year grass (bcsYear) → still grasland because last year is grass
            const cultivations = [
                makeCultivation("c1", "starch", 2022),
                makeCultivation("c2", "starch", 2023),
                makeCultivation("c3", "starch", 2023), // same year, same catalogue counts once
                makeCultivation("c4", "grass", 2024),
            ]
            const result = deriveCropPlanFractions(cultivations, 2024)
            expect(result.om_crop_category).toBe("grasland")
        })

        it("b_lu_is_clover reflects bcsYear rotation, not previous years", () => {
            const cultivations = [
                makeCultivation("c1", "clover", 2022),
                makeCultivation("c2", "clover", 2023),
                makeCultivation("c3", "grass", 2024),
            ]
            const result = deriveCropPlanFractions(cultivations, 2024)
            expect(result.b_lu_is_clover).toBe(false)
            expect(result.d_cp_grass).toBeCloseTo(1) // all 3 years count as grass bucket
        })

        it("ignores years after bcsYear when computing fractions", () => {
            const cultivations = [
                makeCultivation("c1", "grass", 2022),
                makeCultivation("c2", "grass", 2023),
                makeCultivation("c3", "starch", 2025), // future year
            ]
            const result = deriveCropPlanFractions(cultivations, 2024)
            expect(result.d_cp_grass).toBeCloseTo(1) // only 2022+2023 count
            expect(result.d_cp_starch).toBe(0)
        })

        it("deduplicates years (same year multiple cultivations uses main crop logic)", () => {
            // Both 2024 cultivations — only one year counted in totalYears
            const cultivations = [
                makeCultivation("c1", "grass", 2024),
                makeCultivation("c2", "starch", 2024),
            ]
            const result = deriveCropPlanFractions(cultivations, 2024)
            // Only 1 year total; findHoofdteelt picks the main crop
            expect(result.d_cp_grass + result.d_cp_starch).toBeCloseTo(1)
        })
    })
})
