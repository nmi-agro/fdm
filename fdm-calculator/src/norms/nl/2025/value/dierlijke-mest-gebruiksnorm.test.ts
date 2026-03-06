import { describe, expect, it } from "vitest"
import {
    calculateNL2025DierlijkeMestGebruiksNorm,
    isFieldInDerogatieVrijeZone,
} from "./dierlijke-mest-gebruiksnorm"
import type { NL2025NormsInput } from "./types"

describe("calculateNL2025DierlijkeMestGebruiksNorm", () => {
    it("should return the default norm value", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.641351453912945, 51.97755938887036],
                b_bufferstrip: false,
            },
            cultivations: [],
            soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
        }
        const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
        expect(result.normValue).toBe(170)
        expect(result.normSource).toBe("Standaard - geen derogatie")
    })

    it("should return the default norm value with derogation", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.641351453912945, 51.97755938887036],
                b_bufferstrip: false,
            },
            cultivations: [],
            soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
        }
        const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
        expect(result.normValue).toBe(200)
        expect(result.normSource).toBe("Derogatie")
    })

    it("should return the adjusted norm value for derogation in NV-gebied", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.654759168118452, 51.987887874110555],
                b_bufferstrip: false,
            },
            cultivations: [],
            soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
        }
        const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
        expect(result.normValue).toBe(190)
        expect(result.normSource).toBe("Derogatie - NV Gebied")
    })

    it("should return the default norm value without derogation in NV-gebied", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.654759168118452, 51.987887874110555],
                b_bufferstrip: false,
            },
            cultivations: [],
            soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
        }
        const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
        expect(result.normValue).toBe(170)
        expect(result.normSource).toBe("Standaard - geen derogatie")
    })

    it("should return the adjusted norm value for derogation in Grondwaterbeschermingsgebied", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [6.397701151566514, 52.56657210653102],
                b_bufferstrip: false,
            },
            cultivations: [],
            soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
        }
        const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
        expect(result.normValue).toBe(170)
        expect(result.normSource).toBe(
            "Derogatie - Grondwaterbeschermingsgebied",
        )
    })

    it("should return the default norm value for derogation outside Grondwaterbeschermingsgebied and inside NV-gebied, but with single array response (see #205)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.058131582583726, 52.50733333508596],
                b_bufferstrip: false,
            },
            cultivations: [],
            soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
        }
        const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
        expect(result.normValue).toBe(190)
        expect(result.normSource).toBe("Derogatie - NV Gebied")
    })

    it("should return the adjusted norm value for derogation in Natura 2000 gebied", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.804910408558418, 52.04532099948795], // Coordinates within a Natura 2000 area (Veluwe)
                b_bufferstrip: false,
            },
            cultivations: [],
            soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
        }
        const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
        expect(result.normValue).toBe(170)
        expect(result.normSource).toBe("Derogatie - Natura2000 Gebied")
    })

    it("should return 0 for buffer strips", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: true, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.641351453912945, 51.97755938887036],
                b_bufferstrip: true,
            },
            cultivations: [],
            soilAnalysis: { a_p_cc: 0, a_p_al: 0 },
        }
        const result = await calculateNL2025DierlijkeMestGebruiksNorm(mockInput)
        expect(result.normValue).toBe(0)
        expect(result.normSource).toBe("Bufferstrook: geen plaatsingsruimte")
    })

    describe("isFieldInDerogatieVrijeZone", () => {
        it("should return true for a location inside the derogatie-vrije zone", async () => {
            const locationInside: [number, number] = [
                5.698110435483986, 51.967321021267445,
            ]
            await expect(
                isFieldInDerogatieVrijeZone(locationInside),
            ).resolves.toBe(true)
        })

        it("should return false for a location outside the derogatie-vrije zone", async () => {
            const locationOutside: [number, number] = [
                5.642031564776303, 51.9733216807388,
            ]
            await expect(
                isFieldInDerogatieVrijeZone(locationOutside),
            ).resolves.toBe(false)
        })
    })
})
