import Decimal from "decimal.js"
import { describe, expect, it, vi } from "vitest"
import * as shared from "../shared/soil"
import * as degradation from "./degradation"
import {
    calculateOrganicMatterBalanceField,
    calculateOrganicMatterBalancesFieldToFarm,
} from "./index"
import * as supply from "./supply"
import type {
    FieldInput,
    OrganicMatterBalanceFieldNumeric,
    OrganicMatterBalanceFieldResultNumeric,
    OrganicMatterBalanceInput,
} from "./types"

vi.mock("./supply")
vi.mock("./degradation")
vi.mock("../shared/soil")

describe("Organic Matter Balance Calculation", () => {
    const timeFrame: OrganicMatterBalanceInput["timeFrame"] = {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
    }
    const mockField: FieldInput["field"] = {
        b_id: "field1",
        b_area: 10,
        b_bufferstrip: false,
    } as FieldInput["field"]
    const mockCultivations: FieldInput["cultivations"] = []
    const mockFertilizerApplications: FieldInput["fertilizerApplications"] = []
    const mockSoilAnalyses: FieldInput["soilAnalyses"] = []

    describe("calculateOrganicMatterBalanceField", () => {
        it("should calculate balance as supply - degradation", () => {
            vi.spyOn(supply, "calculateOrganicMatterSupply").mockReturnValue({
                total: new Decimal(500),
            } as any)
            vi.spyOn(
                degradation,
                "calculateOrganicMatterDegradation",
            ).mockReturnValue({
                total: new Decimal(-200),
            })
            vi.spyOn(shared, "combineSoilAnalyses").mockReturnValue({} as any)

            const result = calculateOrganicMatterBalanceField({
                fieldInput: {
                    field: mockField,
                    cultivations: mockCultivations,
                    fertilizerApplications: mockFertilizerApplications,
                    soilAnalyses: mockSoilAnalyses,
                },
                fertilizerDetails: [],
                cultivationDetails: [],
                timeFrame,
            })

            expect(result.balance).toBe(300)
            expect(result.supply.total).toBe(500)
            expect(result.degradation.total).toBe(-200)
        })

        it("should return zero balance for buffer strips", () => {
            const result = calculateOrganicMatterBalanceField({
                fieldInput: {
                    field: { ...mockField, b_bufferstrip: true },
                    cultivations: mockCultivations,
                    fertilizerApplications: mockFertilizerApplications,
                    soilAnalyses: mockSoilAnalyses,
                },
                fertilizerDetails: [],
                cultivationDetails: [],
                timeFrame,
            })

            expect(result.balance).toBe(0)
            expect(result.supply.total).toBe(0)
            expect(result.degradation.total).toBe(0)
        })
    })

    describe("calculateOrganicMatterBalancesFieldToFarm", () => {
        it("should aggregate field results to a weighted farm average", () => {
            const results: OrganicMatterBalanceFieldResultNumeric[] = [
                {
                    b_id: "field1",
                    b_area: 10,
                    b_bufferstrip: false,
                    balance: {
                        supply: { total: 500 },
                        degradation: { total: -200 },
                        balance: 300,
                    } as OrganicMatterBalanceFieldNumeric,
                },
                {
                    b_id: "field2",
                    b_area: 5,
                    b_bufferstrip: false,
                    balance: {
                        supply: { total: 400 },
                        degradation: { total: -300 },
                        balance: 100,
                    } as OrganicMatterBalanceFieldNumeric,
                },
            ]

            const farmBalance = calculateOrganicMatterBalancesFieldToFarm(
                results,
                false,
                [],
            )

            // Total Supply = (500*10 + 400*5) / (10+5) = 7000 / 15 = 466.67 -> 467
            // Total Degradation = ((-200)*10 + (-300)*5) / (10+5) = -3500 / 15 = -233.33 -> -233
            // Total Balance = 466.67 + (-233.33) = 233.34 -> 233 (supply + degradation, since degradation is negative)
            expect(farmBalance.supply).toBe(467)
            expect(farmBalance.degradation).toBe(-233)
            expect(farmBalance.balance).toBe(233)
        })

        it("should handle cases with calculation errors", () => {
            const results: OrganicMatterBalanceFieldResultNumeric[] = [
                {
                    b_id: "field1",
                    b_area: 10,
                    b_bufferstrip: false,
                    balance: {
                        balance: 300,
                        supply: { total: 500 },
                        degradation: { total: -200 },
                    } as OrganicMatterBalanceFieldNumeric,
                },
                {
                    b_id: "field2",
                    b_area: 5,
                    errorMessage: "Failed",
                    b_bufferstrip: false,
                },
            ]
            const farmBalance = calculateOrganicMatterBalancesFieldToFarm(
                results,
                true,
                ["Error"],
            )
            expect(farmBalance.hasErrors).toBe(true)
            expect(farmBalance.fieldErrorMessages).toEqual(["Error"])
            // Check that only the successful field is aggregated
            expect(farmBalance.supply).toBeCloseTo(500)
            expect(farmBalance.degradation).toBeCloseTo(-200)
            expect(farmBalance.balance).toBeCloseTo(300)
        })

        it("should ignore buffer strips in farm-level aggregation", () => {
            const results: OrganicMatterBalanceFieldResultNumeric[] = [
                {
                    b_id: "field1",
                    b_area: 10,
                    b_bufferstrip: false,
                    balance: {
                        supply: { total: 500 },
                        degradation: { total: -200 },
                        balance: 300,
                    } as OrganicMatterBalanceFieldNumeric,
                },
                {
                    b_id: "buffer1",
                    b_area: 100,
                    b_bufferstrip: true,
                    balance: {
                        supply: { total: 0 },
                        degradation: { total: 0 },
                        balance: 0,
                    } as OrganicMatterBalanceFieldNumeric,
                },
            ]

            const farmBalance = calculateOrganicMatterBalancesFieldToFarm(
                results,
                false,
                [],
            )

            // Should match field1 values exactly
            expect(farmBalance.supply).toBe(500)
            expect(farmBalance.degradation).toBe(-200)
            expect(farmBalance.balance).toBe(300)
        })
    })
})
