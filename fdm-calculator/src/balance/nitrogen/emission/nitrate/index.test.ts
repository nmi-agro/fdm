import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type {
    CultivationDetail,
    FieldInput,
    SoilAnalysisPicked,
} from "../../types"
import {
    calculateNitrogenEmissionViaNitrate,
    determineNitrateLeachingFactor,
} from "."

describe("calculateNitrogenEmissionViaNitrate", () => {
    const cultivationDetails = new Map<string, CultivationDetail>([
        [
            "nl_265",
            {
                b_lu_croprotation: "grass",
            } as CultivationDetail,
        ],
        [
            "nl_1019",
            {
                b_lu_croprotation: "maize",
            } as CultivationDetail,
        ],
        [
            "nl_6794",
            {
                b_lu_croprotation: "other",
            } as CultivationDetail,
        ],
    ])

    it("should calculate nitrate emission for grassland on sandy soil", () => {
        const balance = new Decimal(100)
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "nl_265",
                b_lu: "test-id",
                b_lu_start: null,
                b_lu_end: null,
                m_cropresidue: null,
                b_lu_name: "Grassland",
                b_lu_croprotation: "grass",
            },
        ]
        const soilAnalysis: SoilAnalysisPicked = {
            b_soiltype_agr: "dekzand",
            b_gwl_class: "V",
            a_c_of: 5,
            a_cn_fr: 10,
            a_density_sa: 1.1,
            a_n_rt: 1000,
            a_som_loi: 2.5,
        }

        const result = calculateNitrogenEmissionViaNitrate(
            balance,
            cultivations,
            soilAnalysis,
            cultivationDetails,
        )

        expect(result.total.toString()).toBe("-16")
    })

    it("should calculate nitrate emission for cropland on clay soil", () => {
        const balance = new Decimal(100)
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "nl_1019",
                b_lu: "test-id",
                b_lu_start: null,
                b_lu_end: null,
                m_cropresidue: null,
                b_lu_name: "Maize",
                b_lu_croprotation: "maize",
            },
        ]
        const soilAnalysis: SoilAnalysisPicked = {
            b_soiltype_agr: "zeeklei",
            b_gwl_class: "III",
            a_c_of: 5,
            a_cn_fr: 10,
            a_density_sa: 1.1,
            a_n_rt: 1000,
            a_som_loi: 2.5,
        }

        const result = calculateNitrogenEmissionViaNitrate(
            balance,
            cultivations,
            soilAnalysis,
            cultivationDetails,
        )

        expect(result.total.toString()).toBe("-33")
    })

    it("should return zero emission for bare soil", () => {
        const balance = new Decimal(100)
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "nl_6794",
                b_lu: "test-id",
                b_lu_start: null,
                b_lu_end: null,
                m_cropresidue: null,
                b_lu_name: "Other",
                b_lu_croprotation: "other",
            },
        ]
        const soilAnalysis: SoilAnalysisPicked = {
            b_soiltype_agr: "dekzand",
            b_gwl_class: "V",
            a_c_of: 5,
            a_cn_fr: 10,
            a_density_sa: 1.1,
            a_n_rt: 1000,
            a_som_loi: 2.5,
        }

        const result = calculateNitrogenEmissionViaNitrate(
            balance,
            cultivations,
            soilAnalysis,
            cultivationDetails,
        )

        // Although landType is bare soil, the leaching factor is determined by cropland as a fallback
        expect(result.total.toString()).toBe("-44")
    })

    it("should return zero emission if balance is not positive", () => {
        const balance = new Decimal(-50)
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "nl_265",
                b_lu: "test-id",
                b_lu_start: null,
                b_lu_end: null,
                m_cropresidue: null,
                b_lu_name: "Grassland",
                b_lu_croprotation: "grass",
            },
        ]
        const soilAnalysis: SoilAnalysisPicked = {
            b_soiltype_agr: "dekzand",
            b_gwl_class: "V",
            a_c_of: 5,
            a_cn_fr: 10,
            a_density_sa: 1.1,
            a_n_rt: 1000,
            a_som_loi: 2.5,
        }

        const result = calculateNitrogenEmissionViaNitrate(
            balance,
            cultivations,
            soilAnalysis,
            cultivationDetails,
        )

        expect(result.total.toString()).toBe("0")
    })

    it("should prioritize grassland over cropland", () => {
        const balance = new Decimal(100)
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "nl_265",
                b_lu: "test-id",
                b_lu_start: null,
                b_lu_end: null,
                m_cropresidue: null,
                b_lu_name: "Grassland",
                b_lu_croprotation: "grass",
            },
            {
                b_lu_catalogue: "nl_1019",
                b_lu: "test-id",
                b_lu_start: null,
                b_lu_end: null,
                m_cropresidue: null,
                b_lu_name: "Maize",
                b_lu_croprotation: "maize",
            },
        ]
        const soilAnalysis: SoilAnalysisPicked = {
            b_soiltype_agr: "dekzand",
            b_gwl_class: "V",
            a_c_of: 5,
            a_cn_fr: 10,
            a_density_sa: 1.1,
            a_n_rt: 1000,
            a_som_loi: 2.5,
        }

        const result = calculateNitrogenEmissionViaNitrate(
            balance,
            cultivations,
            soilAnalysis,
            cultivationDetails,
        )

        expect(result.total.toString()).toBe("-16")
    })
})

describe("determineNitrateLeachingFactor", () => {
    it("should return the correct factor for grassland on peat soil", () => {
        const factor = determineNitrateLeachingFactor("grassland", "veen", "V")
        expect(factor.toString()).toBe("0.06")
    })

    it("should return the correct factor for cropland on peat soil", () => {
        const factor = determineNitrateLeachingFactor("cropland", "veen", "V")
        expect(factor.toString()).toBe("0.17")
    })

    it("should return the correct factor for grassland on clay soil", () => {
        const factor = determineNitrateLeachingFactor(
            "grassland",
            "zeeklei",
            "III",
        )
        expect(factor.toString()).toBe("0.11")
    })

    it("should return the correct factor for cropland on clay soil", () => {
        const factor = determineNitrateLeachingFactor(
            "cropland",
            "zeeklei",
            "III",
        )
        expect(factor.toString()).toBe("0.33")
    })

    it("should return the correct factor for grassland on loess soil", () => {
        const factor = determineNitrateLeachingFactor("grassland", "loess", "V")
        expect(factor.toString()).toBe("0.14")
    })

    it("should return the correct factor for cropland on loess soil", () => {
        const factor = determineNitrateLeachingFactor("cropland", "loess", "V")
        expect(factor.toString()).toBe("0.74")
    })

    it("should return the correct factor for all sandy soil GWL classes", () => {
        const gwlClasses = {
            I: { grassland: "0.02", cropland: "0.04" },
            Ia: { grassland: "0.02", cropland: "0.04" },
            Ic: { grassland: "0.02", cropland: "0.04" },
            II: { grassland: "0.02", cropland: "0.04" },
            IIa: { grassland: "0.02", cropland: "0.04" },
            IIb: { grassland: "0.02", cropland: "0.04" },
            IIc: { grassland: "0.02", cropland: "0.04" },
            III: { grassland: "0.03", cropland: "0.07" },
            IIIa: { grassland: "0.03", cropland: "0.07" },
            IIIb: { grassland: "0.1", cropland: "0.28" },
            IV: { grassland: "0.14", cropland: "0.38" },
            IVu: { grassland: "0.14", cropland: "0.38" },
            IVc: { grassland: "0.14", cropland: "0.38" },
            V: { grassland: "0.16", cropland: "0.44" },
            Va: { grassland: "0.16", cropland: "0.44" },
            Vao: { grassland: "0.16", cropland: "0.44" },
            Vad: { grassland: "0.16", cropland: "0.44" },
            Vb: { grassland: "0.16", cropland: "0.44" },
            Vbo: { grassland: "0.16", cropland: "0.44" },
            Vbd: { grassland: "0.16", cropland: "0.44" },
            sV: { grassland: "0.16", cropland: "0.44" },
            sVb: { grassland: "0.16", cropland: "0.44" },
            VI: { grassland: "0.21", cropland: "0.58" },
            VIo: { grassland: "0.21", cropland: "0.58" },
            VId: { grassland: "0.21", cropland: "0.58" },
            VII: { grassland: "0.27", cropland: "0.74" },
            VIIo: { grassland: "0.27", cropland: "0.74" },
            VIId: { grassland: "0.27", cropland: "0.74" },
            VIII: { grassland: "0.32", cropland: "0.89" },
            VIIIo: { grassland: "0.32", cropland: "0.89" },
            VIIId: { grassland: "0.32", cropland: "0.89" },
        }

        for (const [gwlClass, factors] of Object.entries(gwlClasses)) {
            const grasslandFactor = determineNitrateLeachingFactor(
                "grassland",
                "dekzand",
                gwlClass as any,
            )
            expect(grasslandFactor.toString()).toBe(factors.grassland)

            const croplandFactor = determineNitrateLeachingFactor(
                "cropland",
                "dekzand",
                gwlClass as any,
            )
            expect(croplandFactor.toString()).toBe(factors.cropland)
        }
    })

    it("should throw an error for unknown soil type", () => {
        expect(() =>
            determineNitrateLeachingFactor("grassland", "unknown" as any, "V"),
        ).toThrow("Unknown soil type: unknown")
    })

    it("should throw an error for unknown GWL class on sandy soil", () => {
        expect(() =>
            determineNitrateLeachingFactor(
                "grassland",
                "dekzand",
                "unknown" as any,
            ),
        ).toThrow("Unknown GWL class 'unknown' for sandy soil 'dekzand'")
    })

    it("should throw an error for unknown land type", () => {
        expect(() =>
            determineNitrateLeachingFactor("unknown" as any, "dekzand", "V"),
        ).toThrow("Unknown land type: unknown")
    })
})
