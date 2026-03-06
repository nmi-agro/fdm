import { Decimal } from "decimal.js"
import { describe, expect, it } from "vitest"
import type { CultivationDetail, FieldInput } from "../types"
import { calculateNitrogenRemovalByHarvests } from "./harvest"

describe("calculateNitrogenRemovalByHarvests", () => {
    it("should calculate nitrogen removal for a single harvest with one analysis", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                m_cropresidue: true,
                b_lu_start: null,
                b_lu_end: null,
                b_lu_name: "test",
                b_lu_croprotation: null,
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
        const cultivationDetailsMap: Map<string, CultivationDetail> = new Map([
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
        ])

        const result = calculateNitrogenRemovalByHarvests(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result).toEqual({
            total: new Decimal(-20),
            harvests: [{ id: "harvest1", value: new Decimal(-20) }],
        })
    })

    it("should calculate nitrogen removal for multiple harvests with multiple analyses", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                // b_lu_start: new Date(),
                m_cropresidue: true,
                b_lu_start: null,
                b_lu_end: null,
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
            {
                b_id_harvesting: "harvest2",
                b_lu: "cultivation1",
                b_lu_harvest_date: new Date(),
                harvestable: {
                    b_id_harvestable: "harvestable2",
                    harvestable_analyses: [
                        {
                            b_lu_yield: 1100,
                            b_lu_n_harvestable: 21,
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
        const cultivationDetailsMap: Map<string, CultivationDetail> = new Map([
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
        ])

        const result = calculateNitrogenRemovalByHarvests(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result).toEqual({
            total: new Decimal(-46.3),
            harvests: [
                { id: "harvest1", value: new Decimal(-23.2) },
                { id: "harvest2", value: new Decimal(-23.1) },
            ],
        })
    })

    it("should handle missing yield and nitrogen in harvest analysis using cultivation defaults", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                // b_lu_start: new Date(),
                m_cropresidue: true,
                b_lu_start: null,
                b_lu_end: null,
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
                            b_id_harvestable_analysis: "",
                            b_lu_yield: null,
                            b_lu_yield_fresh: null,
                            b_lu_yield_bruto: null,
                            b_lu_tarra: null,
                            b_lu_dm: null,
                            b_lu_moist: null,
                            b_lu_uww: null,
                            b_lu_cp: null,
                            b_lu_n_harvestable: null,
                            b_lu_n_residue: null,
                            b_lu_p_harvestable: null,
                            b_lu_p_residue: null,
                            b_lu_k_harvestable: null,
                            b_lu_k_residue: null,
                        },
                    ], // Missing yield and nitrogen
                },
            },
        ]
        const cultivationDetailsMap: Map<string, CultivationDetail> = new Map([
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
        ])

        const result = calculateNitrogenRemovalByHarvests(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result).toEqual({
            total: new Decimal(-20),
            harvests: [{ id: "harvest1", value: new Decimal(-20) }],
        })
    })

    it("should throw an error if a harvest has no corresponding cultivation", () => {
        const cultivations: FieldInput["cultivations"] = []
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
        const cultivationDetailsMap = new Map()

        expect(() =>
            calculateNitrogenRemovalByHarvests(
                cultivations,
                harvests,
                cultivationDetailsMap,
            ),
        ).toThrowError(
            "Harvest harvest1: cultivation with b_lu 'cultivation1' is missing b_lu_catalogue",
        )
    })

    it("should throw an error if a cultivation has no details", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                // b_lu_start: new Date(),
                m_cropresidue: true,
                b_lu_start: null,
                b_lu_end: null,
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
        const cultivationDetailsMap = new Map()

        expect(() =>
            calculateNitrogenRemovalByHarvests(
                cultivations,
                harvests,
                cultivationDetailsMap,
            ),
        ).toThrowError(
            "Cultivation catalogue1 has no corresponding cultivation in cultivationDetails",
        )
    })
})
