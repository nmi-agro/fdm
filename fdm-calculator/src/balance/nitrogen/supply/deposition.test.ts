import type { Field } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import { getFdmPublicDataUrl } from "../../../shared/public-data-url"
import type { FieldInput, NitrogenBalanceInput } from "../types"
import { calculateAllFieldsNitrogenSupplyByDeposition } from "./deposition"

describe("calculateAllFieldsNitrogenSupplyByDeposition", () => {
    const fdmPublicDataUrl = getFdmPublicDataUrl()

    it("should calculate nitrogen deposition correctly for a single field", async () => {
        const field: FieldInput = {
            field: {
                b_centroid: [5.0, 52.0],
                b_area: 100000,
                b_id: "test_field_1",
                b_start: new Date("2025-01-01"),
                b_end: new Date("2025-12-31"),
                b_bufferstrip: false,
            },
            cultivations: [],
            harvests: [],
            soilAnalyses: [],
            fertilizerApplications: [],
            depositionSupply: { total: new Decimal(0) },
        }
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2025-01-01"),
            end: new Date("2025-12-31"),
        }

        const resultMap = await calculateAllFieldsNitrogenSupplyByDeposition(
            [field.field as unknown as Field],
            timeFrame,
            fdmPublicDataUrl,
        )

        const result = resultMap.get("test_field_1")
        expect(result).toBeDefined()
        expect(result?.total.toNumber()).toBeCloseTo(19.572)
    })

    it("should handle different timeframes correctly", async () => {
        const field: FieldInput = {
            field: {
                b_centroid: [5.0, 52.0],
                b_area: 100000,
                b_id: "test_field_1",
                b_start: new Date("2023-01-01"),
                b_end: new Date("2023-12-31"),
                b_bufferstrip: false,
            },
            cultivations: [],
            harvests: [],
            soilAnalyses: [],
            fertilizerApplications: [],
            depositionSupply: { total: new Decimal(0) },
        }

        // Test with a full year
        let timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2024-01-01"),
        }
        let resultMap = await calculateAllFieldsNitrogenSupplyByDeposition(
            [field.field as unknown as Field],
            timeFrame,
            fdmPublicDataUrl,
        )
        let result = resultMap.get("test_field_1")
        expect(result).toBeDefined()
        expect(result?.total.toNumber()).toBeCloseTo(19.572)

        // Test with half a year
        timeFrame = {
            start: new Date("2023-01-01"),
            end: new Date("2023-07-01"),
        }
        resultMap = await calculateAllFieldsNitrogenSupplyByDeposition(
            [field.field as unknown as Field],
            timeFrame,
            fdmPublicDataUrl,
        )
        result = resultMap.get("test_field_1")
        expect(result).toBeDefined()
        expect(result?.total.toNumber()).toBeCloseTo(9.7592)
    })

    it("should provide zero if outside bounding box", async () => {
        const field: FieldInput = {
            field: {
                b_centroid: [50.0, 12.0],
                b_area: 100000,
                b_id: "test_field_1",
                b_start: new Date("2023-01-01"),
                b_end: new Date("2023-12-31"),
                b_bufferstrip: false,
            },
            cultivations: [],
            harvests: [],
            soilAnalyses: [],
            fertilizerApplications: [],
            depositionSupply: { total: new Decimal(0) },
        }
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2023-01-01"),
            end: new Date("2023-12-31"),
        }

        const resultMap = await calculateAllFieldsNitrogenSupplyByDeposition(
            [field.field as unknown as Field],
            timeFrame,
            fdmPublicDataUrl,
        )

        const result = resultMap.get("test_field_1")
        expect(result).toBeDefined()
        expect(result?.total.toNumber()).toBeCloseTo(0)
    })

    it("should handle multiple fields correctly", async () => {
        const fields: FieldInput[] = [
            {
                field: {
                    b_centroid: [5.0, 52.0],
                    b_area: 100000,
                    b_id: "field_1",
                    b_start: new Date("2025-01-01"),
                    b_end: new Date("2025-12-31"),
                    b_bufferstrip: false,
                },
                cultivations: [],
                harvests: [],
                soilAnalyses: [],
                fertilizerApplications: [],
                depositionSupply: { total: new Decimal(0) },
            },
            {
                field: {
                    b_centroid: [6.0, 51.5],
                    b_area: 100000,
                    b_id: "field_2",
                    b_start: new Date("2025-01-01"),
                    b_end: new Date("2025-12-31"),
                    b_bufferstrip: false,
                },
                cultivations: [],
                harvests: [],
                soilAnalyses: [],
                fertilizerApplications: [],
                depositionSupply: { total: new Decimal(0) },
            },
        ]
        const timeFrame: NitrogenBalanceInput["timeFrame"] = {
            start: new Date("2025-01-01"),
            end: new Date("2025-12-31"),
        }

        const resultMap = await calculateAllFieldsNitrogenSupplyByDeposition(
            fields.map((f) => f.field as unknown as Field),
            timeFrame,
            fdmPublicDataUrl,
        )

        const result1 = resultMap.get("field_1")
        expect(result1).toBeDefined()
        expect(result1?.total.toNumber()).toBeCloseTo(19.572)

        const result2 = resultMap.get("field_2")
        expect(result2).toBeDefined()
        expect(result2?.total.toNumber()).toBeCloseTo(27.707)
    })
})
