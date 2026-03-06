import { describe, expect, it } from "vitest"
import { calculateNL2026FosfaatGebruiksNorm } from "./fosfaatgebruiksnorm"
import type { NL2026NormsInput, NL2026NormsInputForCultivation } from "./types"

describe("calculateNL2026FosfaatGebruiksNorm", () => {
    it("should return the correct norm for grasland", async () => {
        const mockInput: NL2026NormsInput = {
            farm: { has_grazing_intention: true },
            field: {
                b_id: "1",
                b_centroid: [5.0, 52.0],
                b_bufferstrip: false,
            },
            cultivations: [
                {
                    b_lu_catalogue: "nl_265",
                } as Partial<NL2026NormsInputForCultivation>,
            ] as NL2026NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }
        const result = await calculateNL2026FosfaatGebruiksNorm(mockInput)
        expect(result.normValue).toBe(120)
        expect(result.normSource).toContain("Grasland")
    })

    it("should return the correct norm for bouwland", async () => {
        const mockInput: NL2026NormsInput = {
            farm: { has_grazing_intention: true },
            field: {
                b_id: "1",
                b_centroid: [5.0, 52.0],
                b_bufferstrip: false,
            },
            cultivations: [
                {
                    b_lu_catalogue: "nl_101",
                } as Partial<NL2026NormsInputForCultivation>,
            ] as NL2026NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }
        const result = await calculateNL2026FosfaatGebruiksNorm(mockInput)
        expect(result.normValue).toBe(120)
        expect(result.normSource).toContain("Bouwland")
    })

    it("should return 0 for buffer strips", async () => {
        const mockInput: NL2026NormsInput = {
            farm: { has_grazing_intention: true },
            field: {
                b_id: "1",
                b_centroid: [5.0, 52.0],
                b_bufferstrip: true,
            },
            cultivations: [
                {
                    b_lu_catalogue: "nl_101",
                } as Partial<NL2026NormsInputForCultivation>,
            ] as NL2026NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }
        const result = await calculateNL2026FosfaatGebruiksNorm(mockInput)
        expect(result.normValue).toBe(0)
        expect(result.normSource).toBe("Bufferstrook: geen plaatsingsruimte")
    })
})
