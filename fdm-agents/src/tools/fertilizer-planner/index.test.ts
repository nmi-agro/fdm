import { describe, expect, it } from "vitest"
import { getMainCultivation, createFertilizerPlannerTools } from "./index"

describe("fertilizer-planner tools", () => {
    describe("getMainCultivation", () => {
        const cultivations = [
            {
                b_lu_catalogue: "crop-1",
                b_lu_name: "Crop 1",
                b_lu_start: "2025-01-01",
                b_lu_end: "2025-06-01",
            },
            {
                b_lu_catalogue: "crop-2",
                b_lu_name: "Crop 2",
                b_lu_start: "2025-06-02",
                b_lu_end: "2025-12-31",
            },
        ]

        it("should pick the cultivation active on May 15th", () => {
            const result = getMainCultivation(cultivations, "2025")
            expect(result?.b_lu_catalogue).toBe("crop-1")
        })

        it("should handle cultivations with no end date", () => {
            const openCultivations = [
                {
                    b_lu_catalogue: "open-crop",
                    b_lu_name: "Open Crop",
                    b_lu_start: "2025-01-01",
                    b_lu_end: null,
                }
            ]
            const result = getMainCultivation(openCultivations, "2025")
            expect(result?.b_lu_catalogue).toBe("open-crop")
        })

        it("should pick the latest cultivation if multiple are active (overlap)", () => {
            const overlapping = [
                {
                    b_lu_catalogue: "older",
                    b_lu_start: "2025-01-01",
                    b_lu_end: "2025-12-31",
                },
                {
                    b_lu_catalogue: "newer",
                    b_lu_start: "2025-05-01",
                    b_lu_end: "2025-06-01",
                }
            ]
            const result = getMainCultivation(overlapping, "2025")
            expect(result?.b_lu_catalogue).toBe("newer")
        })

        it("should return undefined if no cultivation is active on May 15th", () => {
            const lateCultivations = [
                {
                    b_lu_catalogue: "late-crop",
                    b_lu_start: "2025-06-01",
                    b_lu_end: "2025-12-31",
                }
            ]
            const result = getMainCultivation(lateCultivations, "2025")
            expect(result).toBeUndefined()
        })
    })

    describe("createFertilizerPlannerTools", () => {
        it("should return the correct set of 5 tools", () => {
            const mockFdm = {} as any
            const tools = createFertilizerPlannerTools(mockFdm)
            expect(tools).toHaveLength(5)
            
            const names = tools.map(t => t.name)
            expect(names).toContain("getFarmFields")
            expect(names).toContain("getFarmNutrientAdvice")
            expect(names).toContain("getFarmLegalNorms")
            expect(names).toContain("searchFertilizers")
            expect(names).toContain("simulateFarmPlan")
        })
    })
})
