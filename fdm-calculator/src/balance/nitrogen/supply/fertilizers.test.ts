import { Decimal } from "decimal.js"
import { describe, expect, it } from "vitest"
import type { FertilizerDetail, FieldInput } from "../types"
import { calculateNitrogenSupplyByFertilizers } from "./fertilizers"

describe("calculateNitrogenSupplyByFertilizers", () => {
    it("should return 0 if no fertilizer applications are provided", () => {
        const fertilizerApplications: FieldInput["fertilizerApplications"] = []
        const fertilizerDetailsMap = new Map<string, FertilizerDetail>()

        const result = calculateNitrogenSupplyByFertilizers(
            fertilizerApplications,
            fertilizerDetailsMap,
        )

        expect(result.total.equals(new Decimal(0))).toBe(true)
        expect(result.mineral.total.equals(new Decimal(0))).toBe(true)
        expect(result.manure.total.equals(new Decimal(0))).toBe(true)
        expect(result.compost.total.equals(new Decimal(0))).toBe(true)
        expect(result.other.total.equals(new Decimal(0))).toBe(true)
        expect(result.mineral.applications).toEqual([])
        expect(result.manure.applications).toEqual([])
        expect(result.compost.applications).toEqual([])
        expect(result.other.applications).toEqual([])
    })

    it("should calculate nitrogen supply from all fertilizer types", () => {
        const fertilizerApplications: FieldInput["fertilizerApplications"] = [
            {
                b_id: "field1",
                p_id_catalogue: "mineral1",
                p_app_amount: 1000,
                p_app_id: "app1",
                p_id: "mineral1", // Added p_id
                p_name_nl: null,
                p_app_method: null,
                p_app_date: new Date("2025-03-15"),
            },
            {
                b_id: "field1",
                p_id_catalogue: "manure1",
                p_app_amount: 500,
                p_app_id: "app2",
                p_id: "manure1", // Added p_id
                p_name_nl: null,
                p_app_method: null,
                p_app_date: new Date("2025-03-15"),
            },
            {
                b_id: "field1",
                p_id_catalogue: "compost1",
                p_app_amount: 250,
                p_app_id: "app3",
                p_id: "compost1", // Added p_id
                p_name_nl: null,
                p_app_method: null,
                p_app_date: new Date("2025-03-15"),
            },
            {
                b_id: "field1",
                p_id_catalogue: "other1",
                p_app_amount: 100,
                p_app_id: "app4",
                p_id: "other1", // Added p_id
                p_name_nl: null,
                p_app_method: null,
                p_app_date: new Date("2025-03-15"),
            },
        ]

        const fertilizerDetailsMap = new Map<string, FertilizerDetail>([
            [
                "mineral1",
                {
                    p_id_catalogue: "mineral1", // Changed from p_id_catalogue
                    p_n_rt: 20,
                    p_no3_rt: 0,
                    p_nh4_rt: 0,
                    p_s_rt: 0,
                    p_ef_nh3: 0,
                    p_type: "mineral",
                } as const,
            ],
            [
                "manure1",
                {
                    p_id_catalogue: "manure1", // Changed from p_id_catalogue
                    p_n_rt: 15,
                    p_no3_rt: 0,
                    p_nh4_rt: 0,
                    p_s_rt: 0,
                    p_ef_nh3: 0,
                    p_type: "manure",
                } as const,
            ],
            [
                "compost1",
                {
                    p_id_catalogue: "compost1", // Changed from p_id_catalogue
                    p_n_rt: 10,
                    p_no3_rt: 0,
                    p_nh4_rt: 0,
                    p_s_rt: 0,
                    p_ef_nh3: 0,
                    p_type: "compost",
                } as const,
            ],
            [
                "other1",
                {
                    p_id_catalogue: "other1", // Changed from p_id_catalogue
                    p_n_rt: 10,
                    p_no3_rt: 0,
                    p_nh4_rt: 0,
                    p_s_rt: 0,
                    p_ef_nh3: 0,
                    p_type: null, // Changed from "other" to null
                } as const,
            ],
        ])

        const result = calculateNitrogenSupplyByFertilizers(
            fertilizerApplications,
            fertilizerDetailsMap,
        )

        expect(result.total.equals(new Decimal(31))).toBe(true)
        expect(result.mineral.total.equals(new Decimal(20))).toBe(true)
        expect(result.manure.total.equals(new Decimal(7.5))).toBe(true)
        expect(result.compost.total.equals(new Decimal(2.5))).toBe(true)
        expect(result.other.total.equals(new Decimal(1))).toBe(true)
    })

    it("should handle missing fertilizer details gracefully", () => {
        const fertilizerApplications: FieldInput["fertilizerApplications"] = [
            {
                b_id: "field1",
                p_id_catalogue: "mineral1",
                p_app_amount: 1000,
                p_app_id: "app1",
                p_id: "mineral1", // Added p_id
                p_name_nl: null,
                p_app_method: null,
                p_app_date: new Date("2025-03-15"),
            },
            {
                b_id: "field1",
                p_id_catalogue: "missing",
                p_app_amount: 500,
                p_app_id: "app2",
                p_id: "missing", // Added p_id
                p_name_nl: null,
                p_app_method: null,
                p_app_date: new Date("2025-03-15"),
            },
        ]

        const fertilizerDetailsMap = new Map<string, FertilizerDetail>([
            [
                "mineral1",
                {
                    p_id_catalogue: "mineral1", // Changed from p_id_catalogue
                    p_n_rt: 20,
                    p_no3_rt: 0,
                    p_nh4_rt: 0,
                    p_s_rt: 0,
                    p_ef_nh3: 0,
                    p_type: "mineral",
                } as const,
            ],
        ])

        expect(() =>
            calculateNitrogenSupplyByFertilizers(
                fertilizerApplications,
                fertilizerDetailsMap,
            ),
        ).toThrow("Fertilizer application app2 has no fertilizerDetails")
    })

    it("should throw an error if any sub-function throws an error", () => {
        const fertilizerApplications: FieldInput["fertilizerApplications"] = [
            {
                b_id: "field1",
                p_id_catalogue: "mineral1",
                p_app_amount: 1000,
                p_app_id: "app1",
                p_id: "mineral1", // Added p_id
                p_name_nl: null,
                p_app_method: null,
                p_app_date: new Date("2025-03-15"),
            },
        ]

        const fertilizerDetailsMap = new Map<string, FertilizerDetail>()

        expect(() =>
            calculateNitrogenSupplyByFertilizers(
                fertilizerApplications,
                fertilizerDetailsMap,
            ),
        ).toThrow("Fertilizer application app1 has no fertilizerDetails")
    })
})
