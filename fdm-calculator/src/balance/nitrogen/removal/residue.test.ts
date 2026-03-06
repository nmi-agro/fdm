import { Decimal } from "decimal.js"
import { describe, expect, it } from "vitest"
import type { CultivationDetail, FieldInput } from "../types"
import { calculateNitrogenRemovalByResidue } from "./residue"

describe("calculateNitrogenRemovalByResidue", () => {
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
                b_n_fixation: 0,
            },
        ],
        [
            "catalogue2",
            {
                b_lu_catalogue: "catalogue2",
                b_lu_croprotation: "other",
                b_lu_yield: 1000,
                b_lu_n_harvestable: 20,
                b_lu_hi: 0,
                b_lu_n_residue: 2,
                b_n_fixation: 0,
            },
        ],
    ])

    it("should return 0 if no crop residues are left", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: false, // No residue left
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = []

        const result = calculateNitrogenRemovalByResidue(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result).toEqual({
            total: new Decimal(0),
            cultivations: [{ id: "cultivation1", value: new Decimal(0) }],
        })
    })

    it("should calculate nitrogen removal for a single harvest", () => {
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

        const result = calculateNitrogenRemovalByResidue(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBeCloseTo(-3) //Approximation due to floating point
        expect(result.cultivations[0].value.toNumber()).toBeCloseTo(-3) //Approximation due to floating point
    })

    it("should calculate nitrogen removal for multiple harvests, averaging yields", () => {
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
                        {
                            b_lu_yield: 1200,
                            b_lu_n_harvestable: 22,
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

        const result = calculateNitrogenRemovalByResidue(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBeCloseTo(-3) //Approximation due to floating point
        expect(result.cultivations[0].value.toNumber()).toBeCloseTo(-3) //Approximation due to floating point
    })

    it("should handle missing harvest data using cultivation defaults", () => {
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
        const harvests: FieldInput["harvests"] = [] // No harvest data

        const result = calculateNitrogenRemovalByResidue(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBeCloseTo(-3) //Approximation due to floating point
        expect(result.cultivations[0].value.toNumber()).toBeCloseTo(-3) //Approximation due to floating point
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
        const cultivationDetailsMap = new Map() // Missing details

        expect(() =>
            calculateNitrogenRemovalByResidue(
                cultivations,
                harvests,
                cultivationDetailsMap,
            ),
        ).toThrowError(
            "Cultivation cultivation1 has no corresponding cultivation in cultivationDetails",
        )
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

        const result = calculateNitrogenRemovalByResidue(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result).toEqual({
            total: new Decimal(0),
            cultivations: [{ id: "cultivation1", value: new Decimal(0) }],
        })
    })

    it("should handle empty harvestable_analyses array", () => {
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

        const result = calculateNitrogenRemovalByResidue(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBeCloseTo(-3) //Approximation due to floating point
        expect(result.cultivations[0].value.toNumber()).toBeCloseTo(-3) //Approximation due to floating point
    })

    it("should return 0 if b_lu_hi is 0", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue2",
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                m_cropresidue: true,
                b_lu_name: "test",
                b_lu_croprotation: null,
            },
        ]
        const harvests: FieldInput["harvests"] = []

        const result = calculateNitrogenRemovalByResidue(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result).toEqual({
            total: new Decimal(0),
            cultivations: [{ id: "cultivation1", value: new Decimal(0) }],
        })
    })
})
