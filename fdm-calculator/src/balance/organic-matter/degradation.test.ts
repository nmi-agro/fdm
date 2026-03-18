import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import { calculateOrganicMatterDegradation } from "./degradation"
import type { CultivationDetail, FieldInput, SoilAnalysisPicked } from "./types"

describe("calculateOrganicMatterDegradation", () => {
    const mockTimeFrame = {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"), // 1 year
    }

    const mockCultivationDetailsMap = new Map<string, CultivationDetail>([
        [
            "grass",
            {
                b_lu_catalogue: "grass",
                b_lu_croprotation: "grass",
                b_lu_eom: 1000,
                b_lu_eom_residue: 200,
            },
        ],
        [
            "maize",
            {
                b_lu_catalogue: "maize",
                b_lu_croprotation: "maize",
                b_lu_eom: 400,
                b_lu_eom_residue: 800,
            },
        ],
    ])

    it("should calculate degradation correctly for grassland", () => {
        const soilAnalysis: SoilAnalysisPicked = {
            a_som_loi: 4, // %
            a_density_sa: 1.2, // g/cm³
            b_soiltype_agr: "duinzand",
        }
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "grass",
                // other properties are not relevant for this test
            },
        ] as FieldInput["cultivations"]

        const degradation = calculateOrganicMatterDegradation(
            soilAnalysis,
            cultivations,
            mockCultivationDetailsMap,
            mockTimeFrame,
        )

        expect(degradation.total).toBeInstanceOf(Decimal)
        expect(degradation.total.toNumber()).toBeLessThan(0)
    })

    it("should calculate degradation correctly for arable land", () => {
        const soilAnalysis: SoilAnalysisPicked = {
            a_som_loi: 2.5,
            a_density_sa: 1.5,
            b_soiltype_agr: null,
        }
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "maize",
            },
        ] as FieldInput["cultivations"]

        const degradation = calculateOrganicMatterDegradation(
            soilAnalysis,
            cultivations,
            mockCultivationDetailsMap,
            mockTimeFrame,
        )

        expect(degradation.total).toBeInstanceOf(Decimal)
        expect(degradation.total.toNumber()).toBeLessThan(0)
    })

    it("should return 0 degradation if formula result is negative", () => {
        // This would happen with a very high SOM, which is unlikely but good to test the floor.
        const soilAnalysis: SoilAnalysisPicked = {
            a_som_loi: 100, // unrealistically high
            a_density_sa: 1.5,
            b_soiltype_agr: null,
        }
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "maize",
            },
        ] as FieldInput["cultivations"]

        const degradation = calculateOrganicMatterDegradation(
            soilAnalysis,
            cultivations,
            mockCultivationDetailsMap,
            mockTimeFrame,
        )

        expect(degradation.total.isZero()).toBe(true)
    })

    it("should cap the annual degradation at 3500 kg/ha", () => {
        const soilAnalysis: SoilAnalysisPicked = {
            a_som_loi: 45,
            a_density_sa: 1.0,
            b_soiltype_agr: null,
        }
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "maize", // Arable
            },
        ] as FieldInput["cultivations"]

        const degradation = calculateOrganicMatterDegradation(
            soilAnalysis,
            cultivations,
            mockCultivationDetailsMap,
            mockTimeFrame,
        )

        expect(degradation.total.toNumber()).toBe(-3500)
    })

    it("should handle multiple years correctly", () => {
        const multiYearTimeFrame = {
            start: new Date("2021-01-01"),
            end: new Date("2023-12-31"), // 3 years
        }
        const soilAnalysis: SoilAnalysisPicked = {
            a_som_loi: 3,
            a_density_sa: 1.4,
            b_soiltype_agr: null,
        }
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu_catalogue: "maize",
            },
        ] as FieldInput["cultivations"]

        const degradationSingleYear = calculateOrganicMatterDegradation(
            soilAnalysis,
            cultivations,
            mockCultivationDetailsMap,
            mockTimeFrame,
        )
        const degradationMultiYear = calculateOrganicMatterDegradation(
            soilAnalysis,
            cultivations,
            mockCultivationDetailsMap,
            multiYearTimeFrame,
        )

        // Expect degradation over 3 years to be 3 times the degradation of 1 year.
        expect(degradationMultiYear.total.toNumber()).toBeCloseTo(
            degradationSingleYear.total.toNumber() * 3,
            0,
        )
    })
})
