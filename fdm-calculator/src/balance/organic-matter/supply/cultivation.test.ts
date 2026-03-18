import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type { CultivationDetail, FieldInput } from "../types"
import { calculateOrganicMatterSupplyByCultivations } from "./cultivation"

describe("calculateOrganicMatterSupplyByCultivations", () => {
    const cultivationDetailsMap = new Map<string, CultivationDetail>([
        [
            "maize",
            {
                b_lu_catalogue: "maize",
                b_lu_croprotation: "maize",
                b_lu_eom: 400,
                b_lu_eom_residue: 800,
            },
        ],
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
            "wheat",
            {
                b_lu_catalogue: "wheat",
                b_lu_croprotation: "cereal",
                b_lu_eom: null, // No direct EOM supply from wheat cultivation itself
                b_lu_eom_residue: 500,
            },
        ],
    ])

    it("should calculate EOM supply for a single cultivation", () => {
        const cultivations: FieldInput["cultivations"] = [
            { b_lu: "cult1", b_lu_catalogue: "maize" },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByCultivations(
            cultivations,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBe(400)
        expect(result.cultivations).toHaveLength(1)
        expect(result.cultivations[0]).toEqual({
            id: "cult1",
            value: new Decimal(400),
        })
    })

    it("should sum the EOM supply from multiple cultivations", () => {
        const cultivations: FieldInput["cultivations"] = [
            { b_lu: "cult1", b_lu_catalogue: "maize" },
            { b_lu: "cult2", b_lu_catalogue: "grass" },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByCultivations(
            cultivations,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBe(1400) // 400 from maize + 1000 from grass
        expect(result.cultivations).toHaveLength(2)
    })

    it("should return zero if cultivations have no b_lu_eom value", () => {
        const cultivations: FieldInput["cultivations"] = [
            { b_lu: "cult1", b_lu_catalogue: "wheat" },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByCultivations(
            cultivations,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBe(0)
        expect(result.cultivations).toHaveLength(0)
    })

    it("should return zero for an empty list of cultivations", () => {
        const cultivations: FieldInput["cultivations"] = []
        const result = calculateOrganicMatterSupplyByCultivations(
            cultivations,
            cultivationDetailsMap,
        )
        expect(result.total.toNumber()).toBe(0)
    })

    it("should handle cultivations not found in the details map", () => {
        const cultivations: FieldInput["cultivations"] = [
            { b_lu: "cult1", b_lu_catalogue: "non-existent" },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByCultivations(
            cultivations,
            cultivationDetailsMap,
        )

        expect(result.total.toNumber()).toBe(0)
    })
})
