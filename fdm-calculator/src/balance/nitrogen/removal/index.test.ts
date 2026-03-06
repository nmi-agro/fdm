import { describe, expect, it } from "vitest"
import type { CultivationDetail, FieldInput, NitrogenRemoval } from "../types"
import { calculateNitrogenRemoval } from "."

describe("calculateNitrogenRemoval", () => {
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
            } as const,
        ],
    ])

    it("should calculate total nitrogen removal from harvests and residues", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                m_cropresidue: true,
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
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

        const result: NitrogenRemoval = calculateNitrogenRemoval(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBeCloseTo(-23) // -20 from harvest + -3 from residue
        expect(result.harvests.total.toNumber()).toBeCloseTo(-20)
        expect(result.residues.total.toNumber()).toBeCloseTo(-3)
    })

    it("should handle cases with no harvests or residues", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cultivation1",
                b_lu_catalogue: "catalogue1",
                m_cropresidue: false,
                b_lu_start: new Date("2022-01-01"),
                b_lu_end: new Date("2022-12-31"),
                b_lu_name: "Cultivation 1",
                b_lu_croprotation: "cereal",
            },
        ]
        const harvests: FieldInput["harvests"] = []

        const result: NitrogenRemoval = calculateNitrogenRemoval(
            cultivations,
            harvests,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBe(0)
        expect(result.harvests.total.toNumber()).toBe(0)
        expect(result.residues.total.toNumber()).toBe(0)
    })
})
