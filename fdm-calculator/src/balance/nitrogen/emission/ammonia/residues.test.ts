import { Decimal } from "decimal.js"
import { describe, expect, it } from "vitest"
import type { CultivationDetail, FieldInput } from "../../types"
import { calculateNitrogenEmissionViaAmmoniaByResidues } from "./residues"

describe("calculateNitrogenEmissionViaAmmoniaByResidues", () => {
    it("should return 0 if no cultivations are provided", () => {
        const cultivations: FieldInput["cultivations"] = []
        const harvests: FieldInput["harvests"] = []
        const cultivationDetailsMap = new Map<string, CultivationDetail>()

        const result = calculateNitrogenEmissionViaAmmoniaByResidues(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.equals(new Decimal(0))).toBe(true)
        expect(result.cultivations).toEqual([])
    })

    it("should calculate nitrogen volatilization for a single cultivation with no harvests", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: true,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = []
        const cultivationDetailsMap = new Map<string, CultivationDetail>([
            [
                "catalogue1",
                {
                    b_lu_catalogue: "catalogue1",
                    b_lu_croprotation: "cereal",
                    b_lu_yield: 1000,
                    b_lu_n_harvestable: 20,
                    b_lu_hi: 0.4,
                    b_lu_n_residue: 14,
                    b_n_fixation: 0,
                },
            ],
        ])

        const result = calculateNitrogenEmissionViaAmmoniaByResidues(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        //Check for approximation due to floating point
        expect(result.total.toNumber()).toBeCloseTo(-0.0672, 2)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: expect.any(Decimal) },
        ])
    })

    it("should calculate nitrogen volatilization for a single cultivation with harvests", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: true,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = [
            {
                b_id_harvesting: "harvest1",
                b_lu: "cultivation1",
                b_lu_harvest_date: new Date(),
                harvestable: {
                    b_id_harvestable: "harvestable1",
                    harvestable_analyses: [
                        {
                            b_lu_yield: 1000,
                            b_lu_n_harvestable: 20,
                            b_id_harvestable_analysis: "",
                            b_lu_yield_fresh: null,
                            b_lu_yield_bruto: null,
                            b_lu_tarra: null,
                            b_lu_dm: null,
                            b_lu_moist: null,
                            b_lu_uww: null,
                            b_lu_cp: null,
                            b_lu_n_residue: null,
                            b_lu_p_harvestable: null,
                            b_lu_p_residue: null,
                            b_lu_k_harvestable: null,
                            b_lu_k_residue: null,
                        },
                    ],
                },
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
                    b_lu_n_residue: 14,
                    b_n_fixation: 0,
                },
            ],
        ])

        const result = calculateNitrogenEmissionViaAmmoniaByResidues(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        //Check for approximation due to floating point
        expect(result.total.toNumber()).toBeCloseTo(-0.0672, 2)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: expect.any(Decimal) },
        ])
    })

    it("should handle missing cultivation details and throw an error", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: true,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = []
        const cultivationDetailsMap = new Map<string, CultivationDetail>()

        expect(() =>
            calculateNitrogenEmissionViaAmmoniaByResidues(
                cultivations,
                harvests,
                cultivationDetailsMap,
            ),
        ).toThrowError(
            "Cultivation cultivation1 has no corresponding cultivation in cultivationDetails",
        )
    })

    it("should handle cases with no crop residues", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: false,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = []
        const cultivationDetailsMap = new Map<string, CultivationDetail>([
            [
                "catalogue1",
                {
                    b_lu_catalogue: "catalogue1",
                    b_lu_croprotation: "cereal",
                    b_lu_yield: 1000,
                    b_lu_n_harvestable: 20,
                    b_lu_hi: 0.4,
                    b_lu_n_residue: 14,
                    b_n_fixation: 0,
                },
            ],
        ])

        const result = calculateNitrogenEmissionViaAmmoniaByResidues(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.equals(new Decimal(0))).toBe(true)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: new Decimal(0) },
        ])
    })
    it("should handle null m_cropresidue as false", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: null, // null residue handling
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = []
        const cultivationDetailsMap = new Map<string, CultivationDetail>([
            [
                "catalogue1",
                {
                    b_lu_catalogue: "catalogue1",
                    b_lu_croprotation: "cereal",
                    b_lu_yield: 1000,
                    b_lu_n_harvestable: 20,
                    b_lu_hi: 0.4,
                    b_lu_n_residue: 14,
                    b_n_fixation: 0,
                },
            ],
        ])

        const result = calculateNitrogenEmissionViaAmmoniaByResidues(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.equals(new Decimal(0))).toBe(true)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: new Decimal(0) },
        ])
    })

    it("should handle empty harvestableAnalyses array", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: true,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = [
            {
                b_id_harvesting: "harvest1",
                b_lu: "cultivation1",
                b_lu_harvest_date: new Date(),
                harvestable: {
                    b_id_harvestable: "harvestable1",
                    harvestable_analyses: [], // Empty array
                },
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
                    b_lu_n_residue: 14,
                    b_n_fixation: 0,
                },
            ],
        ])

        const result = calculateNitrogenEmissionViaAmmoniaByResidues(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBeCloseTo(-0.0672, 1)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: expect.any(Decimal) },
        ])
    })

    it("should return 0 when b_lu_hi is 0", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: true,
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = [
            {
                b_id_harvesting: "harvest1",
                b_lu: "cultivation1",
                b_lu_harvest_date: new Date(),
                harvestable: {
                    b_id_harvestable: "harvestable1",
                    harvestable_analyses: [
                        {
                            b_lu_yield: 1000,
                            b_lu_n_harvestable: 20,
                        } as any,
                    ],
                },
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
                    b_lu_hi: 0,
                    b_lu_n_residue: 14,
                    b_n_fixation: 0,
                },
            ],
        ])

        const result = calculateNitrogenEmissionViaAmmoniaByResidues(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        //Check for approximation due to floating point
        expect(result.total.equals(new Decimal(0))).toBe(true)
        expect(result.cultivations).toEqual([
            { id: "cultivation1", value: new Decimal(0) },
        ])
    })
})
