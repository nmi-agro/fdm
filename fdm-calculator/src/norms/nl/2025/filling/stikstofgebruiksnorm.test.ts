import type {
    Cultivation,
    Fertilizer,
    FertilizerApplication,
} from "@nmi-agro/fdm-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getRegion } from "../value/stikstofgebruiksnorm"
import type { RegionKey } from "../value/types"
import {
    calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
    getWorkingCoefficient,
    isBouwland,
} from "./stikstofgebruiksnorm"
import type { NL2025NormsFillingInput } from "./types"

// Mock getRegion
vi.mock("../value/stikstofgebruiksnorm", () => ({
    getRegion: vi.fn(),
}))

describe("isBouwland", () => {
    it("should return true if cultivation is not in non-bouwland codes", () => {
        const cultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date("2025-01-01"),
                b_lu_catalogue: "nl_2014", // A generic bouwland code
            },
        ] as unknown as Cultivation[]
        const applicationDate = new Date("2025-06-15")
        expect(
            isBouwland(
                cultivations as unknown as Cultivation[],
                applicationDate,
            ),
        ).toBe(true)
    })

    it("should return false if cultivation is in non-bouwland codes", () => {
        const cultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date("2025-01-01"),
                b_lu_catalogue: "nl_265", // Grasland
            },
        ] as unknown as Cultivation[]
        const applicationDate = new Date("2025-06-15")
        expect(
            isBouwland(
                cultivations as unknown as Cultivation[],
                applicationDate,
            ),
        ).toBe(false)
    })

    it("should return false if no active cultivation exists", () => {
        const cultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date("2024-01-01"),
                b_lu_end: new Date("2024-12-31"),
                b_lu_catalogue: "nl_2014",
            },
        ] as unknown as Cultivation[]
        const applicationDate = new Date("2025-06-15")
        expect(
            isBouwland(
                cultivations as unknown as Cultivation[],
                applicationDate,
            ),
        ).toBe(false)
    })

    it("should return true for a cultivation spanning the application date", () => {
        const cultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date("2025-01-01"),
                b_lu_catalogue: "nl_2014",
            },
        ] as unknown as Cultivation[]
        const applicationDate = new Date("2025-07-01")
        expect(
            isBouwland(
                cultivations as unknown as Cultivation[],
                applicationDate,
            ),
        ).toBe(true)
    })

    it("should return false for a cultivation ending before the application date", () => {
        const cultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date("2025-01-01"),
                b_lu_end: new Date("2025-06-01"),
                b_lu_catalogue: "nl_2014",
            },
        ] as unknown as Cultivation[]
        const applicationDate = new Date("2025-07-01")
        expect(
            isBouwland(
                cultivations as unknown as Cultivation[],
                applicationDate,
            ),
        ).toBe(false)
    })

    it("should return false for a cultivation starting after the application date", () => {
        const cultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date("2025-08-01"),
                b_lu_end: new Date("2025-12-31"),
                b_lu_catalogue: "nl_2014",
            },
        ] as unknown as Cultivation[]
        const applicationDate = new Date("2025-07-01")
        expect(
            isBouwland(
                cultivations as unknown as Cultivation[],
                applicationDate,
            ),
        ).toBe(false)
    })
})

describe("getWorkingCoefficient", () => {
    it("should return default details if p_type_rvo is null or undefined", () => {
        const result = getWorkingCoefficient(
            null,
            "zand_nwc",
            true,
            true,
            new Date(),
            false,
        )
        expect(result.p_n_wcl).toBe(1.0)
        expect(result.description).toBe("Kunstmest")
        expect(result.subTypeDescription).toBeUndefined()
    })

    it("should return default details if p_type_rvo is not found in table9", () => {
        const result = getWorkingCoefficient(
            "999",
            "zand_nwc",
            true,
            true,
            new Date(),
            false,
        )
        expect(result.p_n_wcl).toBe(1.0)
        expect(result.description).toBe("Kunstmest")
        expect(result.subTypeDescription).toBeUndefined()
    })

    // Drijfmest van graasdieren op het eigen bedrijf geproduceerd
    describe("Drijfmest van graasdieren op het eigen bedrijf geproduceerd (onFarmProduced: true)", () => {
        const p_type_rvo = "14" // Drijfmest rundvee
        const soilType: RegionKey = "zand_nwc"
        const isBouwland = false // Grasland
        const fertilizerOnFarmProduced = true // Explicitly true for on-farm produced

        it("should return 0.45 for on-farm produced drijfmest with grazing intention", () => {
            const b_grazing_intention = true
            const applicationDate = new Date("2025-06-15")
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.45)
            expect(result.description).toBe(
                "Drijfmest van graasdieren op het eigen bedrijf geproduceerd",
            )
            expect(result.subTypeDescription).toBe("Op bedrijf met beweiding")
        })

        it("should return 0.60 for on-farm produced drijfmest without grazing intention", () => {
            const b_grazing_intention = false
            const applicationDate = new Date("2025-06-15")
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.6)
            expect(result.description).toBe(
                "Drijfmest van graasdieren op het eigen bedrijf geproduceerd",
            )
            expect(result.subTypeDescription).toBe(
                "Op bedrijf zonder beweiding",
            )
        })
    })

    // Drijfmest van graasdieren aangevoerd
    it("should return 0.60 for aangevoerd drijfmest (onFarmProduced: false)", () => {
        const p_type_rvo = "14" // Drijfmest rundvee
        const soilType: RegionKey = "zand_nwc"
        const b_grazing_intention = true
        const isBouwland = false
        const applicationDate = new Date("2025-06-15")
        const fertilizerOnFarmProduced = false // Explicitly false for aangevoerd
        const result = getWorkingCoefficient(
            p_type_rvo,
            soilType,
            b_grazing_intention,
            isBouwland,
            applicationDate,
            fertilizerOnFarmProduced,
        )
        expect(result.p_n_wcl).toBe(0.6)
        expect(result.description).toBe("Drijfmest van graasdieren aangevoerd")
        expect(result.subTypeDescription).toBeUndefined()
    })

    // Drijfmest van varkens
    describe("Drijfmest van varkens", () => {
        const p_type_rvo = "46" // Drijfmest fokzeugen
        const b_grazing_intention = false
        const isBouwland = true
        const applicationDate = new Date("2025-06-15")
        const fertilizerOnFarmProduced = false // Explicitly false for aangevoerd

        it("should return 0.60 for klei en veen soil", () => {
            const soilType: RegionKey = "klei"
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.6)
            expect(result.description).toBe("Drijfmest van varkens")
            expect(result.subTypeDescription).toBe("Op klei en veen")
        })

        it("should return 0.80 for zand en löss soil", () => {
            const soilType: RegionKey = "zand_nwc"
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.8)
            expect(result.description).toBe("Drijfmest van varkens")
            expect(result.subTypeDescription).toBe("Op zand en löss")
        })
    })

    // Dunnen fractie na mestbewerking en gier
    it("should return 0.80 for dunne fractie", () => {
        const p_type_rvo = "12" // Filtraat na mestscheiding
        const soilType: RegionKey = "zand_nwc"
        const b_grazing_intention = false
        const isBouwland = true
        const applicationDate = new Date("2025-06-15")
        const fertilizerOnFarmProduced = false // Explicitly false for aangevoerd
        const result = getWorkingCoefficient(
            p_type_rvo,
            soilType,
            b_grazing_intention,
            isBouwland,
            applicationDate,
            fertilizerOnFarmProduced,
        )
        expect(result.p_n_wcl).toBe(0.8)
        expect(result.description).toBe(
            "Dunne fractie na mestbewerking en gier",
        )
        expect(result.subTypeDescription).toBeUndefined()
    })

    // Vaste mest van graasdieren op het eigen bedrijf geproduceerd
    describe("Vaste mest van graasdieren op het eigen bedrijf geproduceerd (onFarmProduced: true)", () => {
        const p_type_rvo = "10" // Vaste mest rundvee
        const fertilizerOnFarmProduced = true
        const b_grazing_intention = false
        const isBouwland = true
        const soilType: RegionKey = "klei"

        it("should return 0.30 for bouwland on klei/veen from Sep 1 to Jan 31", () => {
            const applicationDate = new Date("2025-10-15") // October
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.3)
            expect(result.description).toBe(
                "Vaste mest van graasdieren op het eigen bedrijf geproduceerd",
            )
            expect(result.subTypeDescription).toBe(
                "Op bouwland op klei en veen, van 1 september t/m 31 januari",
            )
        })

        it("should return 0.45 for overige toepassingen on bedrijf met beweiding (outside Sep-Jan period)", () => {
            const applicationDate = new Date("2025-03-15") // March
            const b_grazing_intention_true = true
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention_true,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.45)
            expect(result.description).toBe(
                "Vaste mest van graasdieren op het eigen bedrijf geproduceerd",
            )
            expect(result.subTypeDescription).toBe(
                "Overige toepassingen op bedrijf met beweiding",
            )
        })

        it("should return 0.60 for overige toepassingen on bedrijf zonder beweiding (outside Sep-Jan period)", () => {
            const applicationDate = new Date("2025-03-15") // March
            const b_grazing_intention_false = false
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention_false,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.6)
            expect(result.description).toBe(
                "Vaste mest van graasdieren op het eigen bedrijf geproduceerd",
            )
            expect(result.subTypeDescription).toBe(
                "Overige toepassingen op bedrijf zonder beweiding",
            )
        })
    })

    // Vaste mest van graasdieren aangevoerd
    it("should return 0.40 for aangevoerd vaste mest (onFarmProduced: false) overige toepassingen", () => {
        const p_type_rvo = "10" // Vaste mest rundvee
        const soilType: RegionKey = "zand_nwc"
        const b_grazing_intention = false
        const isBouwland = true
        const applicationDate = new Date("2025-06-15")
        const fertilizerOnFarmProduced = false // Explicitly false for aangevoerd
        const result = getWorkingCoefficient(
            p_type_rvo,
            soilType,
            b_grazing_intention,
            isBouwland,
            applicationDate,
            fertilizerOnFarmProduced,
        )
        expect(result.p_n_wcl).toBe(0.4)
        expect(result.description).toBe("Vaste mest van graasdieren aangevoerd")
        expect(result.subTypeDescription).toBe("Overige toepassingen")
    })

    // Vaste mest van varkens, pluimvee en nertsen
    it("should return 0.55 for vaste mest van varkens, pluimvee en nertsen", () => {
        const p_type_rvo = "40" // Varkens, vaste mest
        const soilType: RegionKey = "zand_nwc"
        const b_grazing_intention = false
        const isBouwland = true
        const applicationDate = new Date("2025-06-15")
        const fertilizerOnFarmProduced = false // Explicitly false for aangevoerd
        const result = getWorkingCoefficient(
            p_type_rvo,
            soilType,
            b_grazing_intention,
            isBouwland,
            applicationDate,
            fertilizerOnFarmProduced,
        )
        expect(result.p_n_wcl).toBe(0.55)
        expect(result.description).toBe(
            "Vaste mest van varkens, pluimvee en nertsen",
        )
        expect(result.subTypeDescription).toBeUndefined()
    })

    // Vaste mest van overige diersoorten
    describe("Vaste mest van overige diersoorten", () => {
        const p_type_rvo = "104" // Cavia, vaste mest
        const soilType: RegionKey = "klei"
        const b_grazing_intention = false
        const isBouwland = true
        const fertilizerOnFarmProduced = false // Explicitly false for aangevoerd

        it("should return 0.30 for bouwland on klei/veen from Sep 1 to Jan 31", () => {
            const applicationDate = new Date("2025-11-01") // November
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.3)
            expect(result.description).toBe(
                "Vaste mest van overige diersoorten",
            )
            expect(result.subTypeDescription).toBe(
                "Op bouwland op klei en veen, van 1 september t/m 31 januari",
            )
        })

        it("should return 0.40 for overige toepassingen (outside Sep-Jan period)", () => {
            const applicationDate = new Date("2025-04-01") // April
            const result = getWorkingCoefficient(
                p_type_rvo,
                soilType,
                b_grazing_intention,
                isBouwland,
                applicationDate,
                fertilizerOnFarmProduced,
            )
            expect(result.p_n_wcl).toBe(0.4)
            expect(result.description).toBe(
                "Vaste mest van overige diersoorten",
            )
            expect(result.subTypeDescription).toBe("Overige toepassingen")
        })
    })

    // Overig (top-level entries)
    it("should return 0.10 for Compost", () => {
        const result = getWorkingCoefficient(
            "111",
            "zand_nwc",
            false,
            true,
            new Date(),
            false,
        )
        expect(result.p_n_wcl).toBe(0.1)
        expect(result.description).toBe("Compost")
        expect(result.subTypeDescription).toBeUndefined()
    })

    it("should return 0.25 for Champost", () => {
        const result = getWorkingCoefficient(
            "110",
            "zand_nwc",
            false,
            true,
            new Date(),
            false,
        )
        expect(result.p_n_wcl).toBe(0.25)
        expect(result.description).toBe("Champost")
        expect(result.subTypeDescription).toBeUndefined()
    })

    it("should return 0.40 for Zuiveringsslib", () => {
        const result = getWorkingCoefficient(
            "114",
            "zand_nwc",
            false,
            true,
            new Date(),
            false,
        )
        expect(result.p_n_wcl).toBe(0.4)
        expect(result.description).toBe("Zuiveringsslib")
        expect(result.subTypeDescription).toBeUndefined()
    })

    it("should return 0.50 for Overige organische meststoffen", () => {
        const result = getWorkingCoefficient(
            "116",
            "zand_nwc",
            false,
            true,
            new Date(),
            false,
        )
        expect(result.p_n_wcl).toBe(0.5)
        expect(result.description).toBe("Overige organische meststoffen")
        expect(result.subTypeDescription).toBeUndefined()
    })

    it("should return 1.0 for Kunstmest", () => {
        const result = getWorkingCoefficient(
            "115",
            "zand_nwc",
            false,
            true,
            new Date(),
            false,
        )
        expect(result.p_n_wcl).toBe(1.0)
        expect(result.description).toBe("Kunstmest")
        expect(result.subTypeDescription).toBeUndefined()
    })

    it("should return 1.0 for Mineralenconcentraat", () => {
        const result = getWorkingCoefficient(
            "120",
            "zand_nwc",
            false,
            true,
            new Date(),
            false,
        )
        expect(result.p_n_wcl).toBe(1.0)
        expect(result.description).toBe("Mineralenconcentraat")
        expect(result.subTypeDescription).toBeUndefined()
    })
})

describe("calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm", () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it("should calculate norm filling correctly for a single application with known nitrogen content", async () => {
        const applications = [
            {
                p_app_id: "app1",
                p_id: "app1", // Added p_id
                p_app_date: new Date("2025-05-01"),
                p_app_amount: 1000,
                p_id_catalogue: "fert1",
            },
        ] as unknown as FertilizerApplication[]
        const fertilizers = [
            {
                p_id: "fert1",
                p_id_catalogue: "fert1",
                p_n_rt: 5, // 5 kg N per ton
                p_type_rvo: "115", // Kunstmest (working coefficient 1.0)
            },
        ] as unknown as Fertilizer[]
        const b_centroid: [number, number] = [0, 0]
        const has_grazing_intention = false
        const cultivations = [] as unknown as Cultivation[]

        const result =
            await calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm(
                {
                    applications,
                    fertilizers,
                    b_centroid,
                    has_grazing_intention,
                    cultivations,
                    has_organic_certification: false, // Default value for tests
                    fosfaatgebruiksnorm: 0, // Default value for tests
                } as NL2025NormsFillingInput,
            )

        // Expected: 1000 kg * 5 kg/ton * 1.0 (100%) / 1000 = 5
        expect(result.normFilling).toBeCloseTo(5)
        expect(result.applicationFilling[0].normFilling).toBeCloseTo(5)
        expect(result.applicationFilling[0].normFillingDetails).toBe(
            "Werkingscoëfficiënt: 100% - Kunstmest",
        )
    })

    it("should calculate norm filling correctly for multiple applications", async () => {
        const applications = [
            {
                p_app_id: "app1",
                p_id: "app1",
                p_app_date: new Date("2025-05-01"),
                p_app_amount: 1000,
                p_id_catalogue: "fert1",
            },
            {
                p_app_id: "app2",
                p_id: "app2",
                p_app_date: new Date("2025-03-15"),
                p_app_amount: 500,
                p_id_catalogue: "fert2",
            },
        ] as unknown as FertilizerApplication[]
        const fertilizers = [
            {
                p_id: "fert1",
                p_id_catalogue: "fert1",
                p_n_rt: 5, // 5 kg N per ton
                p_type_rvo: "115", // Kunstmest (working coefficient 1.0)
            },
            {
                p_id: "fert2",
                p_id_catalogue: "fert2",
                p_n_rt: 10, // 10 kg N per ton
                p_type_rvo: "111", // Compost (working coefficient 0.1)
            },
        ] as unknown as Fertilizer[]
        const b_centroid: [number, number] = [0, 0]
        const has_grazing_intention = false
        const cultivations = [] as unknown as Cultivation[]

        const result =
            await calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm(
                {
                    applications,
                    fertilizers,
                    b_centroid,
                    has_grazing_intention,
                    cultivations,
                    has_organic_certification: false, // Default value for tests
                    fosfaatgebruiksnorm: 0, // Default value for tests
                } as NL2025NormsFillingInput,
            )

        // App1: 1000 * 5 * 1.0 / 1000 = 5
        // App2: 500 * 10 * 0.1 / 1000 = 0.5
        // Total: 5.5
        expect(result.normFilling).toBeCloseTo(5.5)
        expect(result.applicationFilling[0].normFilling).toBeCloseTo(5)
        expect(result.applicationFilling[0].normFillingDetails).toBe(
            "Werkingscoëfficiënt: 100% - Kunstmest",
        )
        expect(result.applicationFilling[1].normFilling).toBeCloseTo(0.5)
        expect(result.applicationFilling[1].normFillingDetails).toBe(
            "Werkingscoëfficiënt: 10% - Compost",
        )
    })

    it("should use table11Mestcodes for nitrogen content if p_n_rt is 0", async () => {
        const applications = [
            {
                p_app_id: "app1",
                p_id: "app1",
                p_app_date: new Date("2025-05-01"),
                p_app_amount: 1000,
                p_id_catalogue: "fert1",
            },
        ] as unknown as FertilizerApplication[]
        const fertilizers = [
            {
                p_id: "fert1",
                p_id_catalogue: "fert1",
                p_n_rt: 0, // Nitrogen content not directly known
                p_type_rvo: "14", // Drijfmest rundvee (Table 11: 4.0 kg N/ton)
            },
        ] as unknown as Fertilizer[]
        const b_centroid: [number, number] = [0, 0]
        const has_grazing_intention = true // Drijfmest graasdieren, met beweiding -> 0.45
        const cultivations = [] as unknown as Cultivation[]

        const result =
            await calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm(
                {
                    applications,
                    fertilizers,
                    b_centroid,
                    has_grazing_intention,
                    cultivations,
                    has_organic_certification: false, // Default value for tests
                    fosfaatgebruiksnorm: 0, // Default value for tests
                } as NL2025NormsFillingInput,
            )

        // Expected: 1000 * 4.0 (from Table 11) * 0.45 (from Table 9) / 1000 = 1.8
        expect(result.normFilling).toBeCloseTo(1.8)
        expect(result.applicationFilling[0].normFilling).toBeCloseTo(1.8)
        expect(result.applicationFilling[0].normFillingDetails).toBe(
            "Werkingscoëfficiënt: 45% - Drijfmest van graasdieren op het eigen bedrijf geproduceerd - Op bedrijf met beweiding",
        )
    })

    it("should throw an error if fertilizer cannot be found", async () => {
        const applications = [
            {
                p_app_id: "app1",
                p_id: "app1",
                p_app_date: new Date("2025-05-01"),
                p_app_amount: 1000,
                p_id_catalogue: "nonExistentFert",
            },
        ] as unknown as FertilizerApplication[]
        const fertilizers = [] as unknown as Fertilizer[] // Empty fertilizers array
        const b_centroid: [number, number] = [0, 0]
        const has_grazing_intention = false
        const cultivations = [] as unknown as Cultivation[]

        await expect(
            calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm({
                applications,
                fertilizers,
                b_centroid,
                has_grazing_intention,
                cultivations,
                has_organic_certification: false, // Default value for tests
                fosfaatgebruiksnorm: 0, // Default value for tests
            } as NL2025NormsFillingInput),
        ).rejects.toThrow(
            "Fertilizer nonExistentFert not found for application app1",
        )
    })

    it("should treat onFarmProduced as false when has_grazing_intention is false for drijfmest", async () => {
        vi.mocked(getRegion).mockResolvedValue("zand_nwc")
        const applications = [
            {
                p_app_id: "app1",
                p_id: "app1",
                p_app_date: new Date("2025-05-01"),
                p_app_amount: 1000,
                p_id_catalogue: "fert1",
            },
        ] as unknown as FertilizerApplication[]
        const fertilizers = [
            {
                p_id: "fert1",
                p_id_catalogue: "fert1",
                p_n_rt: 0, // Nitrogen content not directly known
                p_type_rvo: "14", // Drijfmest rundvee (Table 11: 4.0 kg N/ton)
            },
        ] as unknown as Fertilizer[]
        const b_centroid: [number, number] = [0, 0]
        const has_grazing_intention = false // No grazing intention, so onFarmProduced should be false
        const cultivations = [] as unknown as Cultivation[]

        const result =
            await calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm(
                {
                    applications,
                    fertilizers,
                    b_centroid,
                    has_grazing_intention,
                    cultivations,
                    has_organic_certification: false,
                    fosfaatgebruiksnorm: 0,
                } as NL2025NormsFillingInput,
            )

        // For p_type_rvo "14" (Drijfmest rundvee), if onFarmProduced is false,
        // it falls into "Drijfmest van graasdieren aangevoerd" which has p_n_wcl of 0.60.
        // Expected: 1000 * 4.0 (from Table 11) * 0.60 (from Table 9) / 1000 = 2.4
        expect(result.normFilling).toBeCloseTo(2.4)
        expect(result.applicationFilling[0].normFilling).toBeCloseTo(2.4)
        expect(result.applicationFilling[0].normFillingDetails).toBe(
            "Werkingscoëfficiënt: 60% - Drijfmest van graasdieren aangevoerd",
        )
    })

    it("should correctly apply bouwland logic for working coefficient", async () => {
        vi.mocked(getRegion).mockResolvedValue("klei") // Soil type for bouwland rule
        const applications = [
            {
                p_app_id: "app1",
                p_id: "app1",
                b_id: "field1",
                p_app_date: new Date("2025-10-15"), // Sep 1 to Jan 31 period
                p_app_amount: 1000,
                p_id_catalogue: "fert1",
            },
        ] as unknown as FertilizerApplication[]
        const fertilizers = [
            {
                p_id: "fert1",
                p_id_catalogue: "fert1",
                p_n_rt: 10, // 10 kg N per ton
                p_type_rvo: "10",
            },
        ] as unknown as Fertilizer[]
        const b_centroid: [number, number] = [0, 0]
        const has_grazing_intention = false
        const cultivations = [
            {
                b_lu: "cult1",
                b_lu_start: new Date("2025-01-01"),
                b_lu_end: new Date("2025-12-31"),
                b_lu_catalogue: "nl_2014", // Bouwland
            },
        ] as unknown as Cultivation[]

        const result =
            await calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm(
                {
                    applications,
                    fertilizers,
                    b_centroid,
                    has_grazing_intention,
                    cultivations,
                    has_organic_certification: false, // Default value for tests
                    fosfaatgebruiksnorm: 0, // Default value for tests
                } as NL2025NormsFillingInput,
            )

        // For p_type_rvo "10" (Vaste mest rundvee), onFarmProduced: true in table9.
        // Since has_grazing_intention is false, onFarmProduced will be false in the main function.
        // For "bouwland op klei en veen, van 1 september t/m 31 januari", p_n_wcl is 0.3.
        // Expected: 1000 * 10 * 0.3 / 1000 = 3
        expect(result.normFilling).toBeCloseTo(3)
        expect(result.applicationFilling[0].normFilling).toBeCloseTo(3)
        expect(result.applicationFilling[0].normFillingDetails).toBe(
            "Werkingscoëfficiënt: 30% - Vaste mest van graasdieren aangevoerd - Op bouwland op klei en veen, van 1 september t/m 31 januari",
        )
    })
})
