import { describe, expect, it } from "vitest"
import type {
    CultivationDetail,
    FieldInput,
    NitrogenBalanceInput,
    SoilAnalysisPicked,
} from "../types"
import { calculateNitrogenSupplyBySoilMineralization } from "./mineralization"

describe("calculateNitrogenSupplyBySoilMineralization", () => {
    const mockCultivationDetails = new Map<string, CultivationDetail>([
        [
            "1",
            {
                b_lu_catalogue: "1",
                b_lu_croprotation: "grass",
                b_lu_yield: null,
                b_lu_hi: null,
                b_lu_n_harvestable: null,
                b_lu_n_residue: null,
                b_n_fixation: null,
            } as const,
        ],
        [
            "2",
            {
                b_lu_catalogue: "2",
                b_lu_croprotation: "grass",
                b_lu_yield: null,
                b_lu_hi: null,
                b_lu_n_harvestable: null,
                b_lu_n_residue: null,
                b_n_fixation: null,
            } as const,
        ],
        [
            "3",
            {
                b_lu_catalogue: "3",
                b_lu_croprotation: "maize",
                b_lu_yield: null,
                b_lu_hi: null,
                b_lu_n_harvestable: null,
                b_lu_n_residue: null,
                b_n_fixation: null,
            } as const,
        ],
    ])

    const mockSoilAnalysis: SoilAnalysisPicked = {
        b_soiltype_agr: "zand",
        a_c_of: null,
        a_cn_fr: null,
        a_density_sa: null,
        a_n_rt: null,
        a_som_loi: null,
        b_gwl_class: null,
    }

    it("should return zero for non-grassland cultivation", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "c1",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: new Date("2023-12-31"),
                b_lu_catalogue: "3",
                m_cropresidue: false,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "grass",
            },
        ]
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2023-12-31"),
        }

        const result = calculateNitrogenSupplyBySoilMineralization(
            cultivations,
            mockSoilAnalysis,
            mockCultivationDetails,
            timeFrame,
        )

        expect(result.total.toNumber()).toBe(0)
    })

    it("should calculate mineralization for grassland on veen soil", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "c1",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: new Date("2023-12-31"),
                b_lu_catalogue: "1",
                m_cropresidue: false,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "grass",
            },
        ]
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2023-12-31"),
        }
        const soilAnalysis: SoilAnalysisPicked = {
            ...mockSoilAnalysis,
            b_soiltype_agr: "veen",
        }

        const result = calculateNitrogenSupplyBySoilMineralization(
            cultivations,
            soilAnalysis,
            mockCultivationDetails,
            timeFrame,
        )

        expect(result.total.toNumber()).toBeCloseTo(160, 0)
    })

    it("should calculate mineralization for dalgrond soil", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "c1",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: new Date("2023-12-31"),
                b_lu_catalogue: "1",
                m_cropresidue: false,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "grass",
            },
        ]
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2023-12-31"),
        }
        const soilAnalysis: SoilAnalysisPicked = {
            ...mockSoilAnalysis,
            b_soiltype_agr: "dalgrond",
        }

        const result = calculateNitrogenSupplyBySoilMineralization(
            cultivations,
            soilAnalysis,
            mockCultivationDetails,
            timeFrame,
        )

        expect(result.total.toNumber()).toBeCloseTo(20, 0)
    })

    it("should return mineralization for arable land for grassland not in the May 15 - July 15 window", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "c1",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: new Date("2023-05-14"),
                b_lu_catalogue: "1",
                m_cropresidue: false,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "grass",
            },
        ]
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2023-12-31"),
        }
        const soilAnalysis: SoilAnalysisPicked = {
            ...mockSoilAnalysis,
            b_soiltype_agr: "veen",
        }

        const result = calculateNitrogenSupplyBySoilMineralization(
            cultivations,
            soilAnalysis,
            mockCultivationDetails,
            timeFrame,
        )

        expect(result.total.toNumber()).toBeCloseTo(20, 0)
    })

    it("should handle null cultivation end date", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "c1",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: null,
                b_lu_catalogue: "1",
                m_cropresidue: false,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "grass",
            },
        ]
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2023-12-31"),
        }
        const soilAnalysis: SoilAnalysisPicked = {
            ...mockSoilAnalysis,
            b_soiltype_agr: "veen",
        }

        const result = calculateNitrogenSupplyBySoilMineralization(
            cultivations,
            soilAnalysis,
            mockCultivationDetails,
            timeFrame,
        )

        expect(result.total.toNumber()).toBeCloseTo(160, 0)
    })

    it("should calculate mineralization for a partial year", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "c1",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: new Date("2023-12-31"),
                b_lu_catalogue: "1",
                m_cropresidue: false,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "grass",
            },
        ]
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2023-06-30"),
        }
        const soilAnalysis: SoilAnalysisPicked = {
            ...mockSoilAnalysis,
            b_soiltype_agr: "veen",
        }

        const result = calculateNitrogenSupplyBySoilMineralization(
            cultivations,
            soilAnalysis,
            mockCultivationDetails,
            timeFrame,
        )

        expect(result.total.toNumber()).toBeCloseTo(78.9, 1)
    })

    it("should calculate mineralization over multiple years", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "c1",
                b_lu_start: new Date("2023-01-01"),
                b_lu_end: new Date("2024-12-31"),
                b_lu_catalogue: "1",
                m_cropresidue: false,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "grass",
            },
        ]
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2024-12-31"),
        }
        const soilAnalysis: SoilAnalysisPicked = {
            ...mockSoilAnalysis,
            b_soiltype_agr: "veen",
        }

        const result = calculateNitrogenSupplyBySoilMineralization(
            cultivations,
            soilAnalysis,
            mockCultivationDetails,
            timeFrame,
        )

        expect(result.total.toNumber()).toBeCloseTo(320, 0)
    })
})
