import type { Field } from "@nmi-agro/fdm-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as GeoTiff from "../../../../shared/geotiff"
import {
    calculateNL2025StikstofGebruiksNorm,
    getRegion,
    isFieldInNVGebied,
} from "./stikstofgebruiksnorm"
import type {
    NitrogenStandard,
    NL2025NormsInput,
    NL2025NormsInputForCultivation,
} from "./types"

vi.mock("../../../../shared/geotiff", async (importActual) => {
    const actual =
        await importActual<typeof import("../../../../shared/geotiff")>()
    return {
        ...actual,
        getGeoTiffValue: vi.fn(actual.getGeoTiffValue),
    }
})

describe("stikstofgebruiksnorm helpers", () => {
    it("should correctly identify a field in an NV Gebied", async () => {
        const centroidInNV: [number, number] = [5.654709, 51.987605]
        // Known point in NV Gebied
        const result = await isFieldInNVGebied(centroidInNV)
        expect(result).toBe(true)
    })

    it("should correctly identify a field not in an NV Gebied", async () => {
        const centroidOutsideNV: [number, number] = [5.1, 52.1] // Known point outside NV Gebied
        const result = await isFieldInNVGebied(centroidOutsideNV)
        expect(result).toBe(false)
    })

    it("should correctly identify a field not in an NV Gebied, but with single array response (see #205)", async () => {
        const centroidOutsideNV: [number, number] = [
            5.5527872994244785, 52.92595151470198,
        ] // Known point outside NV Gebied
        const result = await isFieldInNVGebied(centroidOutsideNV)
        expect(result).toBe(false)
    })

    it("should correctly identify the region for a field", async () => {
        const centroidInKlei: [number, number] = [5.64188724, 51.977587] // Known point in Klei
        const region = await getRegion(centroidInKlei)
        expect(region).toBe("klei")
    })
})

import * as StikstofData from "./stikstofgebruiksnorm-data"

describe("calculateNL2025StikstofGebruiksNorm", () => {
    it("should return the correct norm for grasland (beweiden)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571],
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265",
                    b_lu_start: new Date(2025, 0, 1), // Current year cultivation
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(345)
        expect(result.normSource).toEqual("Grasland (beweiden).")
    })

    it("should return the correct norm for grasland (volledig maaien)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571],
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265",
                    b_lu_start: new Date(2025, 0, 1), // Current year cultivation
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(385)
        expect(result.normSource).toEqual("Grasland (volledig maaien).")
    })

    it("should return 0 for buffer strips", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571],
                b_bufferstrip: true,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265",
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(0)
        expect(result.normSource).toEqual("Bufferstrook: geen plaatsingsruimte")
    })

    it("should return the correct norm for potatoes", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571],
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2015", // Pootaardappel
                    b_lu_variety: "Adora",
                    b_lu_start: new Date(2025, 0, 1), // Current year cultivation
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(140)
        expect(result.normSource).toEqual(
            "Akkerbouwgewas, pootaardappelen (hoge norm).",
        )
    })

    it("should apply 0 korting if winterteelt is present in zand_nwc region (hoofdteelt 2025)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: true },
            field: {
                b_id: "1",
                b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265", // Grasland (is_winterteelt: true)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)

        // The base norm for Grasland in zand_nwc is 200 in nv-gebied.
        expect(result.normValue).toBe(200)
        expect(result.normSource).toEqual("Grasland (beweiden).")
    })

    it("should apply 0 korting if Tijdelijk grasland is present in zand_nwc region", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_266", // Tijdelijk grasland
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)

        // Tijdelijk grasland "van 1 jan tot minstens 15 mei" -> 90 (zand_nwc standard), 72 (zand_nwc nv_area)
        // Should have no korting applied
        expect(result.normValue).toBe(72)
        expect(result.normSource).toContain("Tijdelijk grasland.")
    })

    it("should apply 0 korting if vanggewas is present (sown <= Oct 1st)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
                    b_lu_start: new Date(2024, 9, 1), // Oct 1st, 2024
                    b_lu_end: new Date(2025, 1, 31),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        // The base norm for Vruchtgewassen in zand_nwc is 108. With vanggewas sown <= Oct 1st, korting should be 0.
        expect(result.normValue).toBe(108)
        expect(result.normSource).toEqual(
            "Vruchtgewassen, Landbouwstambonen, rijp zaad. Geen korting: vanggewas gezaaid uiterlijk 1 oktober",
        )
    })

    it("should apply 5 korting if vanggewas is present (sown Oct 2nd - Oct 14th)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
                    b_lu_start: new Date(2024, 9, 5), // Oct 5th, 2024
                    b_lu_end: new Date(2025, 1, 31),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Oct 2-14, korting should be 5.
        expect(result.normValue).toBe(103) // 108 - 5
        expect(result.normSource).toEqual(
            "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 5kg N/ha, vanggewas gezaaid tussen 2 t/m 14 oktober",
        )
    })

    it("should apply 10 korting if vanggewas is present (sown Oct 15th - Oct 31st)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
                    b_lu_start: new Date(2024, 9, 20), // Oct 20th, 2024
                    b_lu_end: new Date(2025, 1, 31),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Oct 15-31, korting should be 10.
        expect(result.normValue).toBe(98) // 108 - 10
        expect(result.normSource).toEqual(
            "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 10kg N/ha, vanggewas gezaaid tussen 15 t/m 31 oktober",
        )
    })

    it("should apply 20 korting if vanggewas is present (sown Nov 1st or later)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_428", // Gele mosterd (is_vanggewas: true)
                    b_lu_start: new Date(2024, 10, 1), // Nov 1st, 2024
                    b_lu_end: new Date(2025, 1, 31),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With vanggewas sown Nov 1st+, korting should be 20.
        expect(result.normValue).toBe(88) // 108 - 20
        expect(result.normSource).toEqual(
            "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 20kg N/ha, vanggewas gezaaid op of na 1 november",
        )
    })

    it("should apply 20 korting if no winterteelt or vanggewas is present in zand_nwc region", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.656346970245633, 51.987872886419524], // This centroid is in 'zand_nwc'
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_234", // Zomertarwe (not winterteelt or vanggewas)
                    b_lu_start: new Date(2024, 5, 1),
                    b_lu_end: new Date(2024, 8, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        // The base norm for Vruchtgewassen in zand_nwc in nv-gebied is 108. With no exception, korting should be 20.
        expect(result.normValue).toBe(88) // 108 - 20
        expect(result.normSource).toEqual(
            "Vruchtgewassen, Landbouwstambonen, rijp zaad. Korting: 20kg N/ha: geen vanggewas of winterteelt",
        )
    })

    it("should not apply korting if region is not sandy or loess, even without winterteelt/vanggewas", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.648307588666836, 51.96484772224782], // This centroid is in 'klei'
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2751", // Vruchtgewassen (2025 hoofdteelt)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_234", // Zomertarwe (not winterteelt or vanggewas)
                    b_lu_start: new Date(2024, 5, 1),
                    b_lu_end: new Date(2025, 1, 31),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        // The base norm for Vruchtgewassen in klei is 135. Korting should not apply in non-sandy/loess regions.
        expect(result.normValue).toBe(135)
        expect(result.normSource).toEqual(
            "Vruchtgewassen, Landbouwstambonen, rijp zaad.",
        )
    })

    it("should return the correct norm for Gras voor industriële verwerking (eerste jaar)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking
                    b_lu_start: new Date(2025, 0, 1), // Current year cultivation
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(30)
        expect(result.normSource).toEqual(
            "Akkerbouwgewassen, Gras voor industriële verwerking (inzaai in september en eerste jaar).",
        )
    })

    it("should return the correct norm for Gras voor industriële verwerking (volgende jaren)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking (current year)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_3805", // Gras voor industriële verwerking (previous year)
                    b_lu_start: new Date(2024, 0, 1),
                    b_lu_end: new Date(2024, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(310)
        expect(result.normSource).toEqual(
            "Akkerbouwgewassen, Gras voor industriële verwerking (inzaai voor 15 mei en volgende jaren).",
        )
    })

    it("should return the correct norm for Graszaad, Engels raaigras (1e jaars)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras
                    b_lu_start: new Date(2025, 0, 1), // Current year cultivation
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(165)
        expect(result.normSource).toEqual(
            "Akkerbouwgewassen, Graszaad, Engels raaigras (1e jaars).",
        )
    })

    it("should return the correct norm for Graszaad, Engels raaigras (overjarig)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras (current year)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_6750", // Graszaad, Engels raaigras (previous year)
                    b_lu_start: new Date(2024, 0, 1),
                    b_lu_end: new Date(2024, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(200)
        expect(result.normSource).toEqual(
            "Akkerbouwgewassen, Graszaad, Engels raaigras (overjarig).",
        )
    })

    it("should return the correct norm for Akkerbouwgewassen, Roodzwenkgras (1e jaars)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras
                    b_lu_start: new Date(2025, 0, 1), // Current year cultivation
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(85)
        expect(result.normSource).toEqual(
            "Akkerbouwgewassen, Roodzwenkgras (1e jaars).",
        )
    })

    it("should return the correct norm for Akkerbouwgewassen, Roodzwenkgras (overjarig)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras (current year)
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_6784", // Akkerbouwgewassen, Roodzwenkgras (previous year)
                    b_lu_start: new Date(2024, 0, 1),
                    b_lu_end: new Date(2024, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(115)
        expect(result.normSource).toEqual(
            "Akkerbouwgewassen, Roodzwenkgras (overjarig).",
        )
    })

    it("should return the correct norm for Winterui (1e jaars)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_1932", // Winterui, 1e jaars
                    b_lu_start: new Date(2025, 0, 1), // Current year cultivation
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(170)
        expect(result.normSource).toEqual(
            "Akkerbouwgewassen, Ui overig, zaaiui of winterui. (1e jaars).",
        )
    })

    it("should return the correct norm for Winterui (2e jaars)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_1933", // Winterui, 2e jaars
                    b_lu_start: new Date(2025, 0, 1), // Current year cultivation
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(170)
        expect(result.normSource).toEqual(
            "Akkerbouwgewassen, Ui overig, zaaiui of winterui. (2e jaars).",
        )
    })

    it("should return the correct norm for Bladgewassen, Spinazie (1e teelt)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2773", // Bladgewassen, Spinazie
                    b_lu_start: new Date(2025, 4, 15), // May 15th, 2025 (hoofdteelt)
                    b_lu_end: new Date(2025, 6, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(260)
        expect(result.normSource).toEqual("Bladgewassen, Spinazie (1e teelt).")
    })

    it("should return the correct norm for Bladgewassen, Slasoorten (1e teelt)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2767", // Bladgewassen, Slasoorten
                    b_lu_start: new Date(2025, 4, 15), // May 15th, 2025 (hoofdteelt)
                    b_lu_end: new Date(2025, 6, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(180)
        expect(result.normSource).toEqual(
            "Bladgewassen, Slasoorten (1e teelt).",
        )
    })

    it("should return the correct norm for Bladgewassen, Andijvie eerste teelt volgteelt (1e teelt)", async () => {
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: [5.6279889, 51.975571], // Klei region
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2708", // Bladgewassen, Andijvie eerste teelt volgteelt
                    b_lu_start: new Date(2025, 4, 15), // May 15th, 2025 (hoofdteelt)
                    b_lu_end: new Date(2025, 6, 1),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normValue).toBe(180)
        expect(result.normSource).toEqual(
            "Bladgewassen, Andijvie eerste teelt volgteelt (1e teelt).",
        )
    })

    describe("Tijdelijk grasland time-based matching", () => {
        const kleiCentroid: [number, number] = [5.6279889, 51.975571] // Klei region

        it("should select the highest norm (longest period) for full-year temporary grassland", async () => {
            // Matches "van 1 jan tot minstens 15 okt" -> 310 (Klei)
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: { b_id: "1", b_centroid: kleiCentroid } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_266", // Tijdelijk grasland
                        b_lu_start: new Date(2025, 0, 1), // Jan 1
                        b_lu_end: new Date(2025, 11, 31), // Dec 31
                    } as Partial<NL2025NormsInputForCultivation>,
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            expect(result.normValue).toBe(310) // Klei standard for "van 1 jan tot minstens 15 okt"
        })

        it("should select the correct norm for a period ending in May (tot minstens 15 mei)", async () => {
            // Matches "van 1 jan tot minstens 15 mei" -> 110 (Klei)
            // Should NOT match "tot minstens 15 augustus"
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: { b_id: "1", b_centroid: kleiCentroid } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_266", // Tijdelijk grasland
                        b_lu_start: new Date(2025, 0, 1), // Jan 1
                        b_lu_end: new Date(2025, 4, 20), // May 20
                    } as Partial<NL2025NormsInputForCultivation>,
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            expect(result.normValue).toBe(110) // Klei standard for "van 1 jan tot minstens 15 mei"
        })

        it("should select the correct norm for a late sown crop (vanaf 15 oktober)", async () => {
            // Matches "vanaf 15 oktober" -> 0 (Klei)
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: { b_id: "1", b_centroid: kleiCentroid } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_266", // Tijdelijk grasland
                        b_lu_start: new Date(2025, 9, 20), // Oct 20
                        b_lu_end: new Date(2025, 11, 31), // Dec 31
                    } as Partial<NL2025NormsInputForCultivation>,
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            expect(result.normValue).toBe(0) // Klei standard for "vanaf 15 oktober"
        })

        it("should handle start dates from previous year correctly (van 1 januari)", async () => {
            // Started in 2024, still present in 2025 until Aug 20.
            // Matches "van 1 jan tot minstens 15 aug" -> 250 (Klei)
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: { b_id: "1", b_centroid: kleiCentroid } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_266", // Tijdelijk grasland
                        b_lu_start: new Date(2024, 8, 1), // Sept 1, 2024
                        b_lu_end: new Date(2025, 7, 20), // Aug 20, 2025
                    } as Partial<NL2025NormsInputForCultivation>,
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            expect(result.normValue).toBe(250) // Klei standard for "van 1 jan tot minstens 15 aug"
        })

        it("should select the correct norm for a summer crop (vanaf 15 april tot minstens 15 oktober)", async () => {
            // Matches "vanaf 15 april tot minstens 15 oktober" -> 310 (Klei)
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: { b_id: "1", b_centroid: kleiCentroid } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_266", // Tijdelijk grasland
                        b_lu_start: new Date(2025, 3, 20), // April 20
                        b_lu_end: new Date(2025, 9, 20), // Oct 20
                    } as Partial<NL2025NormsInputForCultivation>,
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            expect(result.normValue).toBe(310)
        })

        it("should handle explicit zero values for period days/months (regression test for falsy bug)", async () => {
            // Mock data with explicit zero in period_start_month or period_start_day
            const mockData: NitrogenStandard[] = [
                {
                    b_lu_catalogue_match: ["nl_zero_test"],
                    cultivation_rvo_table2: "Zero Test Crop",
                    norms: {
                        klei: { standard: 100, nv_area: 80 },
                        loess: { standard: 100, nv_area: 80 },
                        veen: { standard: 100, nv_area: 80 },
                        zand_nwc: { standard: 100, nv_area: 80 },
                        zand_zuid: { standard: 100, nv_area: 80 },
                    },
                    sub_types: [
                        {
                            omschrijving: "zero_period",
                            // Use explicit zero values that would fail with !! check
                            period_start_month: 0 as any, 
                            period_start_day: 0 as any,
                            period_end_month: 12,
                            period_end_day: 31,
                            norms: {
                                klei: { standard: 200, nv_area: 160 },
                                loess: { standard: 200, nv_area: 160 },
                                veen: { standard: 200, nv_area: 160 },
                                zand_nwc: { standard: 200, nv_area: 160 },
                                zand_zuid: { standard: 200, nv_area: 160 },
                            },
                        },
                    ],
                } as any,
            ]

            const spy = vi.spyOn(StikstofData, "nitrogenStandardsData", "get").mockReturnValue(mockData as any)

            const mockInput: NL2025NormsInput = {
                farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
                field: { b_id: "1", b_centroid: kleiCentroid } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_zero_test",
                        b_lu_start: new Date(2025, 0, 1),
                        b_lu_end: new Date(2025, 11, 31),
                    } as Partial<NL2025NormsInputForCultivation>,
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            
            // Should match the 200 norm from the sub_type with zero-valued periods
            expect(result.normValue).toBe(200)
            expect(result.normSource).toContain("Zero Test Crop")

            spy.mockRestore()
        })
    })
})

const sandCentroid: [number, number] = [5.656346970245633, 51.987872886419524] // zand_nwc
const clayCentroid: [number, number] = [5.64188724, 51.977587] // klei

describe("calculateNL2025StikstofGebruiksNorm - Korting Logic", () => {
    describe("Grassland Renewal (Gras-na-Gras) - 50 kg N/ha", () => {
        it("should apply 50 discount on Sand (June 1 - Aug 31)", async () => {
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: {
                    b_id: "1",
                    b_centroid: sandCentroid,
                } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 0, 1),
                        b_lu_end: new Date(2025, 5, 15), // June 15
                    },
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 5, 16),
                        b_lu_end: new Date(2025, 11, 31),
                    },
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            // Expect korting of 50. Base might be 320 (zand_nwc, maaien).
            // 320 - 50 = 270.
            expect(result.normSource).toContain(
                "Korting: 50kg N/ha: graslandvernieuwing",
            )
        })

        it("should apply 50 discount on Clay (Derogation + NV: June 1 - Aug 31)", async () => {
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: true,
                    has_grazing_intention: false,
                },
                field: {
                    b_id: "1",
                    b_centroid: clayCentroid, // Assume Non-NV
                } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 0, 1),
                        b_lu_end: new Date(2025, 8, 1), // Sep 1
                    },
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 8, 2),
                        b_lu_end: new Date(2025, 11, 31),
                    },
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            // Derogation + Non-NV allows up to Sep 15. Sep 1 is valid.
            expect(result.normSource).toContain(
                "Korting: 50kg N/ha: graslandvernieuwing",
            )
        })

        it("should throw error for invalid renewal date on Sand", async () => {
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: {
                    b_id: "1",
                    b_centroid: sandCentroid,
                } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 0, 1),
                        b_lu_end: new Date(2025, 4, 15), // May 15 (Too early)
                    },
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 4, 16),
                        b_lu_end: new Date(2025, 11, 31),
                    },
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            await expect(
                calculateNL2025StikstofGebruiksNorm(mockInput),
            ).rejects.toThrow(
                "Graslandvernieuwing op zand- en lössgrond is alleen toegestaan tussen 1 juni en 31 augustus.",
            )
        })
    })

    describe("Grassland Destruction (Gras-naar-Bouwland) - 65 kg N/ha", () => {
        it("should apply 65 discount on Sand (Maize, Feb 1 - May 10)", async () => {
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: {
                    b_id: "1",
                    b_centroid: sandCentroid,
                } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 0, 1),
                        b_lu_end: new Date(2025, 1, 15), // Feb 15
                    },
                    {
                        b_lu_catalogue: "nl_259", // Maize (Snijmais)
                        b_lu_start: new Date(2025, 1, 16),
                        b_lu_end: new Date(2025, 9, 1),
                    },
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            expect(result.normSource).toContain(
                "Korting: 65kg N/ha: graslandvernietiging",
            )
        })

        it("should apply 65 discount on Clay (Consumption Potato, Feb 1 - May 31)", async () => {
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: {
                    b_id: "1",
                    b_centroid: clayCentroid,
                } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 0, 1),
                        b_lu_end: new Date(2025, 3, 15), // April 15
                    },
                    {
                        b_lu_catalogue: "nl_2014", // Consumption Potato
                        b_lu_variety: "Agria", // Low norm
                        b_lu_start: new Date(2025, 3, 16),
                        b_lu_end: new Date(2025, 9, 1),
                    },
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            expect(result.normSource).toContain(
                "Korting: 65kg N/ha: graslandvernietiging",
            )
        })

        it("should NOT apply discount for Seed Potatoes", async () => {
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: {
                    b_id: "1",
                    b_centroid: sandCentroid,
                } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 0, 1),
                        b_lu_end: new Date(2025, 1, 15), // Feb 15
                    },
                    {
                        b_lu_catalogue: "nl_2015", // Seed Potato
                        b_lu_variety: "Adora",
                        b_lu_start: new Date(2025, 1, 16),
                        b_lu_end: new Date(2025, 9, 1),
                    },
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
            expect(result.normSource).not.toContain("graslandvernietiging")
        })

        it("should throw error for invalid destruction date on Sand", async () => {
            const mockInput: NL2025NormsInput = {
                farm: {
                    is_derogatie_bedrijf: false,
                    has_grazing_intention: false,
                },
                field: {
                    b_id: "1",
                    b_centroid: sandCentroid,
                } as Field,
                cultivations: [
                    {
                        b_lu_catalogue: "nl_265", // Grass
                        b_lu_start: new Date(2025, 0, 1),
                        b_lu_end: new Date(2025, 5, 1), // June 1 (Too late)
                    },
                    {
                        b_lu_catalogue: "nl_259", // Maize
                        b_lu_start: new Date(2025, 5, 2),
                        b_lu_end: new Date(2025, 9, 1),
                    },
                ] as NL2025NormsInputForCultivation[],
                soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
            }

            await expect(
                calculateNL2025StikstofGebruiksNorm(mockInput),
            ).rejects.toThrow(
                "Graslandvernietiging op zand- en lössgrond is alleen toegestaan tussen 1 februari en 10 mei.",
            )
        })
    })
})

describe("calculateNL2025StikstofGebruiksNorm - Additional Korting Edge Cases", () => {
    afterEach(() => {
        vi.mocked(GeoTiff.getGeoTiffValue).mockClear()
    })

    // Helper to mock Region and NV status
    const setupMock = (regionCode: number, nvCode: number) => {
        vi.mocked(GeoTiff.getGeoTiffValue).mockImplementation(
            async (url: string) => {
                if (url.includes("grondsoorten")) return regionCode // 1=Klei, 4=Zand
                if (url.includes("nv.tiff")) return nvCode // 1=NV, 0=Non-NV
                return 0
            },
        )
    }

    const sandCentroid: [number, number] = [
        5.656346970245633, 51.987872886419524,
    ]

    it("should apply 20 korting if vanggewas is removed before Feb 1st", async () => {
        setupMock(4, 0) // Sand, Non-NV
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: sandCentroid,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2751", // Vruchtgewassen
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_428", // Gele mosterd (vanggewas)
                    b_lu_start: new Date(2024, 9, 1), // Oct 1
                    b_lu_end: new Date(2025, 0, 15), // Jan 15 (Removed before Feb 1)
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normSource).toContain(
            "Korting: 20kg N/ha: vanggewas staat niet tot 1 februari",
        )
    })

    it("should apply 20 korting if vanggewas is sown too early (before July 15)", async () => {
        setupMock(4, 0) // Sand, Non-NV
        const mockInput: NL2025NormsInput = {
            farm: { is_derogatie_bedrijf: false, has_grazing_intention: false },
            field: {
                b_id: "1",
                b_centroid: sandCentroid,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_2751", // Vruchtgewassen
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 5, 1),
                } as Partial<NL2025NormsInputForCultivation>,
                {
                    b_lu_catalogue: "nl_428", // Gele mosterd
                    b_lu_start: new Date(2024, 6, 10), // July 10 (Too early)
                    b_lu_end: new Date(2025, 1, 15),
                } as Partial<NL2025NormsInputForCultivation>,
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normSource).toContain(
            "Korting: 20kg N/ha: geen vanggewas of winterteelt",
        )
    })

    it("should apply 50 discount for Graslandvernieuwing on Clay (No Derogation) - Valid Date (Feb 10)", async () => {
        setupMock(1, 0) // Clay, Non-NV
        const mockInput: NL2025NormsInput = {
            farm: {
                is_derogatie_bedrijf: false,
                has_grazing_intention: false,
            },
            field: {
                b_id: "1",
                b_centroid: sandCentroid,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 1, 10), // Feb 10
                },
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 1, 11),
                    b_lu_end: new Date(2025, 11, 31),
                },
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normSource).toContain(
            "Korting: 50kg N/ha: graslandvernieuwing",
        )
    })

    it("should throw error for Graslandvernieuwing on Clay (No Derogation) - Invalid Date (Jan 20)", async () => {
        setupMock(1, 0) // Clay, Non-NV
        const mockInput: NL2025NormsInput = {
            farm: {
                is_derogatie_bedrijf: false,
                has_grazing_intention: false,
            },
            field: {
                b_id: "1",
                b_centroid: sandCentroid,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 0, 20), // Jan 20 (Too early, starts Feb 1)
                },
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 0, 21),
                    b_lu_end: new Date(2025, 11, 31),
                },
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        await expect(
            calculateNL2025StikstofGebruiksNorm(mockInput),
        ).rejects.toThrow(
            "Graslandvernieuwing op klei- en veengrond (geen derogatie) is alleen toegestaan tussen 1 februari en 15 september.",
        )
    })

    it("should apply 50 discount for Graslandvernieuwing on Clay (Derogation + NV) - Valid Date (Aug 15)", async () => {
        setupMock(1, 1) // Clay, NV
        const mockInput: NL2025NormsInput = {
            farm: {
                is_derogatie_bedrijf: true,
                has_grazing_intention: false,
            },
            field: {
                b_id: "1",
                b_centroid: sandCentroid,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 7, 15), // Aug 15
                },
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 7, 16),
                    b_lu_end: new Date(2025, 11, 31),
                },
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normSource).toContain(
            "Korting: 50kg N/ha: graslandvernieuwing",
        )
    })

    it("should throw error for Graslandvernieuwing on Clay (Derogation + NV) - Invalid Date (Sep 10)", async () => {
        setupMock(1, 1) // Clay, NV
        const mockInput: NL2025NormsInput = {
            farm: {
                is_derogatie_bedrijf: true,
                has_grazing_intention: false,
            },
            field: {
                b_id: "1",
                b_centroid: sandCentroid,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 8, 10), // Sep 10 (Too late, ends Aug 31)
                },
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 8, 11),
                    b_lu_end: new Date(2025, 11, 31),
                },
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        await expect(
            calculateNL2025StikstofGebruiksNorm(mockInput),
        ).rejects.toThrow(
            "Graslandvernieuwing op klei- en veengrond (derogatie + NV-gebied) is alleen toegestaan tussen 1 juni en 31 augustus.",
        )
    })

    it("should apply 65 discount for Graslandvernietiging on Clay (NV) - Valid Date (Mar 10)", async () => {
        setupMock(1, 1) // Clay, NV
        const mockInput: NL2025NormsInput = {
            farm: {
                is_derogatie_bedrijf: false,
                has_grazing_intention: false,
            },
            field: {
                b_id: "1",
                b_centroid: sandCentroid,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 2, 10), // Mar 10
                },
                {
                    b_lu_catalogue: "nl_259", // Maize (as example of relevant crop)
                    b_lu_start: new Date(2025, 2, 11),
                    b_lu_end: new Date(2025, 9, 1),
                },
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        const result = await calculateNL2025StikstofGebruiksNorm(mockInput)
        expect(result.normSource).toContain(
            "Korting: 65kg N/ha: graslandvernietiging",
        )
    })

    it("should throw error for Graslandvernietiging on Clay (NV) - Invalid Date (Mar 20)", async () => {
        setupMock(1, 1) // Clay, NV
        const mockInput: NL2025NormsInput = {
            farm: {
                is_derogatie_bedrijf: false,
                has_grazing_intention: false,
            },
            field: {
                b_id: "1",
                b_centroid: sandCentroid,
            } as Field,
            cultivations: [
                {
                    b_lu_catalogue: "nl_265", // Grass
                    b_lu_start: new Date(2025, 0, 1),
                    b_lu_end: new Date(2025, 2, 20), // Mar 20 (Too late, ends Mar 15)
                },
                {
                    b_lu_catalogue: "nl_259", // Maize
                    b_lu_start: new Date(2025, 2, 21),
                    b_lu_end: new Date(2025, 9, 1),
                },
            ] as NL2025NormsInputForCultivation[],
            soilAnalysis: { a_p_al: 20, a_p_cc: 0.9 },
        }

        await expect(
            calculateNL2025StikstofGebruiksNorm(mockInput),
        ).rejects.toThrow(
            "Graslandvernietiging op klei- en veengrond (NV-gebied) is alleen toegestaan tussen 1 februari en 15 maart.",
        )
    })
})
