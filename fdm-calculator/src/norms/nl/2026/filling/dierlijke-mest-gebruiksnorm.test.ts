import type { Fertilizer, FertilizerApplication } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import { calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./dierlijke-mest-gebruiksnorm"
import type { NL2026NormsFillingInput } from "./types"

describe("calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm", () => {
    const mockFertilizers = [
        {
            p_id: "1",
            p_id_catalogue: "1",
            p_type_rvo: "11",
            p_n_rt: 0.5,
        },
        {
            p_id: "2",
            p_id_catalogue: "2",
            p_type_rvo: "12",
        },
        {
            p_id: "3",
            p_id_catalogue: "3",
            p_type_rvo: "200", // Not in table11Mestcodes
        },
        {
            p_id: "4",
            p_id_catalogue: "4",
            // No p_type_rvo
        },
        {
            p_id: "5",
            p_id_catalogue: "5",
            p_type_rvo: "115", // Not relevant for nitrates directive
        },
    ] as unknown as Fertilizer[]

    const mockApplications = [
        {
            p_app_id: "app1",
            p_id: "app1",
            p_id_catalogue: "1",
            p_app_amount: 10000,
        },
        {
            p_app_id: "app2",
            p_id: "app2",
            p_id_catalogue: "2",
            p_app_amount: 20000,
        },
    ] as unknown as FertilizerApplication[]

    it("should calculate the norm filling for a single application", () => {
        const result =
            calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(
                {
                    applications: [mockApplications[0]],
                    fertilizers: mockFertilizers,
                    cultivations: [],
                    has_organic_certification: false,
                    has_grazing_intention: false,
                    fosfaatgebruiksnorm: 0,
                    b_centroid: [0, 0],
                } as NL2026NormsFillingInput,
            )

        expect(result.normFilling).toBe(5)
        expect(result.applicationFilling).toEqual([
            {
                p_app_id: "app1",
                normFilling: 5,
            },
        ])
    })

    it("should calculate the norm filling for multiple applications", () => {
        const result =
            calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(
                {
                    applications: mockApplications,
                    fertilizers: mockFertilizers,
                    cultivations: [],
                    has_organic_certification: false,
                    has_grazing_intention: false,
                    fosfaatgebruiksnorm: 0,
                    b_centroid: [0, 0],
                } as NL2026NormsFillingInput,
            )

        expect(result.normFilling).toBe(85) // 5 + 80
        expect(result.applicationFilling).toEqual([
            {
                p_app_id: "app1",
                normFilling: 5,
            },
            {
                p_app_id: "app2",
                normFilling: 80,
            },
        ])
    })

    it("should return zero filling for fertilizers not relevant to the nitrates directive", () => {
        const result =
            calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(
                {
                    applications: [
                        {
                            p_app_id: "app3",
                            p_id: "app3",
                            p_id_catalogue: "5",
                            p_app_amount: 10,
                        } as unknown as FertilizerApplication,
                    ],
                    fertilizers: mockFertilizers,
                    cultivations: [],
                    has_organic_certification: false,
                    has_grazing_intention: false,
                    fosfaatgebruiksnorm: 0,
                    b_centroid: [0, 0],
                } as NL2026NormsFillingInput,
            )

        expect(result.normFilling).toBe(0)
        expect(result.applicationFilling).toEqual([
            {
                p_app_id: "app3",
                normFilling: 0,
            },
        ])
    })

    it("should throw an error if a fertilizer is not found", () => {
        expect(() =>
            calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(
                {
                    applications: [
                        {
                            p_app_id: "app4",
                            p_id: "app4",
                            p_id_catalogue: "999",
                            p_app_amount: 10,
                        } as unknown as FertilizerApplication,
                    ],
                    fertilizers: mockFertilizers,
                    cultivations: [],
                    has_organic_certification: false,
                    has_grazing_intention: false,
                    fosfaatgebruiksnorm: 0,
                    b_centroid: [0, 0],
                } as NL2026NormsFillingInput,
            ),
        ).toThrow("Fertilizer 999 not found for application app4")
    })

    it("should throw an error if a fertilizer has no p_type_rvo", () => {
        expect(() =>
            calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(
                {
                    applications: [
                        {
                            p_app_id: "app5",
                            p_id: "app5",
                            p_id_catalogue: "4",
                            p_app_amount: 10,
                        } as unknown as FertilizerApplication,
                    ],
                    fertilizers: mockFertilizers,
                    cultivations: [],
                    has_organic_certification: false,
                    has_grazing_intention: false,
                    fosfaatgebruiksnorm: 0,
                    b_centroid: [0, 0],
                } as NL2026NormsFillingInput,
            ),
        ).toThrow("Fertilizer 4 has no p_type_rvo")
    })

    it("should throw an error if a fertilizer has an unknown p_type_rvo", () => {
        expect(() =>
            calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(
                {
                    applications: [
                        {
                            p_app_id: "app6",
                            p_id: "app6",
                            p_id_catalogue: "3",
                            p_app_amount: 10,
                        } as unknown as FertilizerApplication,
                    ],
                    fertilizers: mockFertilizers,
                    cultivations: [],
                    has_organic_certification: false,
                    has_grazing_intention: false,
                    fosfaatgebruiksnorm: 0,
                    b_centroid: [0, 0],
                } as NL2026NormsFillingInput,
            ),
        ).toThrow("Fertilizer 3 has unknown p_type_rvo 200")
    })

    it("should return zero filling when no applications are provided", () => {
        const result =
            calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(
                {
                    applications: [],
                    fertilizers: mockFertilizers,
                    cultivations: [],
                    has_organic_certification: false,
                    has_grazing_intention: false,
                    fosfaatgebruiksnorm: 0,
                    b_centroid: [0, 0],
                } as NL2026NormsFillingInput,
            )

        expect(result.normFilling).toBe(0)
        expect(result.applicationFilling).toEqual([])
    })
})
