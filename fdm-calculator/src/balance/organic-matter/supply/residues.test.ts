import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type {
    CultivationDetail,
    FieldInput,
    OrganicMatterBalanceInput,
} from "../types"
import { calculateOrganicMatterSupplyByResidues } from "./residues"

describe("calculateOrganicMatterSupplyByResidues", () => {
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
            "wheat",
            {
                b_lu_catalogue: "wheat",
                b_lu_croprotation: "cereal",
                b_lu_eom: null,
                b_lu_eom_residue: 500,
            },
        ],
        [
            "no-residue-eom",
            {
                b_lu_catalogue: "no-residue-eom",
                b_lu_croprotation: "other",
                b_lu_eom: 100,
                b_lu_eom_residue: null,
            },
        ],
    ])

    const timeFrame: OrganicMatterBalanceInput["timeFrame"] = {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
    }

    it("should calculate EOM supply from residues if left on field and within timeframe", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cult1",
                b_lu_catalogue: "maize",
                m_cropresidue: true,
                b_lu_end: new Date("2023-10-15"),
            },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByResidues(
            cultivations,
            cultivationDetailsMap,
            timeFrame,
        )

        expect(result.total.toNumber()).toBe(800)
        expect(result.cultivations[0]).toEqual({
            id: "cult1",
            value: new Decimal(800),
        })
    })

    it("should calculate EOM supply from residues if m_cropresidue is undefined (standard practice)", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cult1",
                b_lu_catalogue: "maize",
                m_cropresidue: null, // null residue handling (represents undefined in UI)
                b_lu_end: new Date("2023-10-15"),
                b_lu_name: "test",
                b_lu_start: new Date("2023-05-01"),
            },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByResidues(
            cultivations,
            cultivationDetailsMap,
            timeFrame,
        )

        expect(result.total.toNumber()).toBe(800)
        expect(result.cultivations[0]).toEqual({
            id: "cult1",
            value: new Decimal(800),
        })
    })

    it("should return zero if m_cropresidue is false", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cult1",
                b_lu_catalogue: "maize",
                m_cropresidue: false, // Residues removed
                b_lu_end: new Date("2023-10-15"),
            },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByResidues(
            cultivations,
            cultivationDetailsMap,
            timeFrame,
        )

        expect(result.total.toNumber()).toBe(0)
    })

    it("should return zero if termination date is outside the timeframe", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cult1",
                b_lu_catalogue: "maize",
                m_cropresidue: true,
                b_lu_end: new Date("2024-01-10"), // Outside timeframe
            },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByResidues(
            cultivations,
            cultivationDetailsMap,
            timeFrame,
        )

        expect(result.total.toNumber()).toBe(0)
    })

    it("should sum EOM from multiple qualifying residues", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cult1",
                b_lu_catalogue: "maize",
                m_cropresidue: true,
                b_lu_end: new Date("2023-10-15"),
            },
            {
                b_lu: "cult2",
                b_lu_catalogue: "wheat",
                m_cropresidue: true,
                b_lu_end: new Date("2023-08-01"),
            },
            {
                b_lu: "cult3",
                b_lu_catalogue: "maize",
                m_cropresidue: false, // Should be ignored
                b_lu_end: new Date("2023-11-01"),
            },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByResidues(
            cultivations,
            cultivationDetailsMap,
            timeFrame,
        )

        expect(result.total.toNumber()).toBe(1300) // 800 from maize + 500 from wheat
        expect(result.cultivations).toHaveLength(2)
    })

    it("should return zero if b_lu_eom_residue is null", () => {
        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: "cult1",
                b_lu_catalogue: "no-residue-eom",
                m_cropresidue: true,
                b_lu_end: new Date("2023-10-15"),
            },
        ] as FieldInput["cultivations"]

        const result = calculateOrganicMatterSupplyByResidues(
            cultivations,
            cultivationDetailsMap,
            timeFrame,
        )

        expect(result.total.toNumber()).toBe(0)
    })
})
