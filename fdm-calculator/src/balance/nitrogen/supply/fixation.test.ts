import { Decimal } from "decimal.js"
import { describe, expect, it } from "vitest"
import type { CultivationDetail, FieldInput } from "../types"
import { calculateNitrogenFixation } from "./fixation"

describe("calculateNitrogenFixation", () => {
    it("should return 0 if no cultivations are provided", () => {
        const cultivations: FieldInput["cultivations"] = []
        const cultivationDetailsMap = new Map<string, CultivationDetail>()

        const result = calculateNitrogenFixation(
            cultivations,
            cultivationDetailsMap,
        )

        expect(result.total.equals(new Decimal(0))).toBe(true)
        expect(result.cultivations).toEqual([])
    })

    it("should calculate nitrogen fixation for a single cultivation", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                m_cropresidue: false,
                b_lu_start: null,
                b_lu_end: null,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]

        const cultivationDetailsMap = new Map<string, CultivationDetail>([
            [
                "catalogue1",
                {
                    b_lu_catalogue: "catalogue1",
                    b_lu_croprotation: "cereal",
                    b_lu_yield: 1000,
                    b_lu_n_harvestable: 20,
                    b_lu_hi: 0.4,
                    b_lu_n_residue: 2,
                    b_n_fixation: 50, // kg N/ha
                } as const,
            ],
        ])

        const result = calculateNitrogenFixation(
            cultivations,
            cultivationDetailsMap,
        )

        expect(result.total.equals(new Decimal(50))).toBe(true)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: new Decimal(50) },
        ])
    })

    it("should calculate nitrogen fixation for multiple cultivations", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                m_cropresidue: true,
                b_lu_start: null,
                b_lu_end: null,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
            {
                b_lu: "cultivation2",
                b_lu_catalogue: "catalogue2",
                m_cropresidue: false,
                b_lu_start: null,
                b_lu_end: null,
                b_lu_name: "Cultivation 2",
                b_lu_croprotation: "other",
            },
        ]

        const cultivationDetailsMap = new Map<string, CultivationDetail>([
            [
                "catalogue1",
                {
                    b_lu_catalogue: "catalogue1",
                    b_lu_croprotation: "cereal",
                    b_lu_yield: 1000,
                    b_lu_n_harvestable: 20,
                    b_lu_hi: 0.4,
                    b_lu_n_residue: 2,
                    b_n_fixation: 50, // kg N/ha
                } as const,
            ],
            [
                "catalogue2",
                {
                    b_lu_catalogue: "catalogue2",
                    b_lu_croprotation: "other", // Changed from "legume"
                    b_lu_yield: 1200,
                    b_lu_n_harvestable: 22,
                    b_lu_hi: 0.5,
                    b_lu_n_residue: 3,
                    b_n_fixation: 75, // kg N/ha
                } as const,
            ],
        ])

        const result = calculateNitrogenFixation(
            cultivations,
            cultivationDetailsMap,
        )

        expect(result.total.equals(new Decimal(125))).toBe(true)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: new Decimal(50) },
            { id: "cultivation2", value: new Decimal(75) },
        ])
    })

    it("should handle cultivations with no or undefined fixation values", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                m_cropresidue: true,
                b_lu_start: null,
                b_lu_end: null,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
            {
                b_lu: "cultivation2",
                b_lu_catalogue: "catalogue2",
                m_cropresidue: false,
                b_lu_start: null,
                b_lu_end: null,
                b_lu_name: "Cultivation 2",
                b_lu_croprotation: "other",
            },
        ]

        const cultivationDetailsMap = new Map<string, CultivationDetail>([
            [
                "catalogue1",
                {
                    b_lu_catalogue: "catalogue1",
                    b_lu_croprotation: "cereal",
                    b_lu_yield: 1000,
                    b_lu_n_harvestable: 20,
                    b_lu_hi: 0.4,
                    b_lu_n_residue: 2,
                    b_n_fixation: 50, // kg N/ha
                } as const,
            ],
            [
                "catalogue2",
                {
                    b_lu_catalogue: "catalogue2",
                    b_lu_croprotation: "grass",
                    b_lu_yield: 1200,
                    b_lu_n_harvestable: 22,
                    b_lu_hi: 0.5,
                    b_lu_n_residue: 3,
                    b_n_fixation: null,
                } as const,
            ],
        ])

        const result = calculateNitrogenFixation(
            cultivations,
            cultivationDetailsMap,
        )

        expect(result.total.equals(new Decimal(50))).toBe(true)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: new Decimal(50) },
            { id: "cultivation2", value: new Decimal(0) },
        ])
    })

    it("should throw an error if a cultivation has no details", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                m_cropresidue: true,
                b_lu_start: null,
                b_lu_end: null,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]

        const cultivationDetailsMap = new Map<string, CultivationDetail>()

        expect(() =>
            calculateNitrogenFixation(cultivations, cultivationDetailsMap),
        ).toThrowError(
            "Cultivation cultivation1 has no corresponding cultivation in cultivationDetails",
        )
    })
})
