import type { FdmType } from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"
import { calculateOrganicMatterBalance } from "./index"
import type {
    CultivationDetail,
    FertilizerDetail,
    FieldInput,
    OrganicMatterBalanceInput,
} from "./types"

// Mock FdmType
const mockFdm = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    // biome-ignore lint/suspicious/noThenProperty: Simulate cache miss
    then: vi.fn((resolve) =>
        resolve ? Promise.resolve(resolve([])) : Promise.resolve([]),
    ),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
} as unknown as FdmType

/**
 * Utility function to generate mock data for performance testing.
 * This function creates a specified number of fields with realistic, but simplified,
 * associated data for cultivations, fertilizer applications, and soil analyses.
 *
 * @param numberOfFields - The number of fields to generate.
 * @returns A OrganicMatterBalanceInput object with dynamically generated data.
 */
function generateMockData(numberOfFields: number): OrganicMatterBalanceInput {
    const fields: FieldInput[] = []
    const fertilizerDetails: FertilizerDetail[] = [
        {
            p_id_catalogue: "fert-cat-1",
            p_eom: 100, // 100 kg EOM/ton (simplified unit)
            p_type: "manure",
        },
        {
            p_id_catalogue: "fert-cat-2",
            p_eom: 500, // 500 kg EOM/ton
            p_type: "compost",
        },
    ]
    const cultivationDetails: CultivationDetail[] = [
        {
            b_lu_catalogue: "cat-cult-1",
            b_lu_croprotation: "maize",
            b_lu_eom: 1500,
            b_lu_eom_residue: 200,
        },
        {
            b_lu_catalogue: "cat-cult-2",
            b_lu_croprotation: "grass",
            b_lu_eom: 800,
            b_lu_eom_residue: 100,
        },
    ]

    for (let i = 0; i < numberOfFields; i++) {
        const fieldId = `field-${i}`
        const fieldStart = new Date(2023, 0, 1)
        const fieldEnd = new Date(2023, 11, 31)

        const field: FieldInput["field"] = {
            b_id: fieldId,
            b_centroid: [
                Math.random() * 10 + 4, // Random longitude between 4 and 14
                Math.random() * 5 + 50, // Random latitude between 50 and 55
            ],
            b_area: Math.floor(Math.random() * 50 + 10), // Random area between 10 and 60
            b_start: fieldStart,
            b_end: fieldEnd,
            b_bufferstrip: false,
        }

        const cultivations: FieldInput["cultivations"] = [
            {
                b_lu: `cult-${fieldId}-1`,
                b_lu_catalogue: "cat-cult-1",
                m_cropresidue: true,
                b_lu_start: new Date(2023, 3, 1),
                b_lu_end: new Date(2023, 8, 1),
                b_lu_name: "Mock Cultivation",
            },
        ]

        const soilAnalyses: FieldInput["soilAnalyses"] = [
            {
                a_id: `sa-${fieldId}-1`,
                b_sampling_date: new Date(2023, 2, 1),
                a_som_loi: Math.random() * 2 + 3, // 3-5%
                a_density_sa: Math.random() * 0.5 + 1.2, // 1.2-1.7
                b_soiltype_agr: "zand",
            },
        ]

        const fertilizerApplications: FieldInput["fertilizerApplications"] = [
            {
                b_id: fieldId,
                p_app_id: `fa-${fieldId}-1`,
                // Randomly pick one of the available fertilizer catalogue IDs
                p_id_catalogue: "fert-cat-1",
                p_app_amount: Math.floor(Math.random() * 20 + 10), // 10-30 tons
                p_app_date: new Date(2023, 4, 1),
                p_app_method: "broadcasting",
                p_name_nl: "Mock Fertilizer",
                p_id: `mock-fert-${i}`,
            },
        ]

        fields.push({
            field,
            cultivations,
            soilAnalyses,
            fertilizerApplications,
        })
    }

    return {
        fields,
        fertilizerDetails,
        cultivationDetails,
        timeFrame: {
            start: new Date(2023, 0, 1),
            end: new Date(2023, 11, 31),
        },
    }
}

describe("Organic Matter Balance Performance", () => {
    // This test is designed to measure the performance of the organic matter balance calculation
    // for a large number of fields.
    // The timeout is set to 30 seconds (30000 ms).
    it("should calculate organic matter balance for a large farm (~300 fields) within 30 seconds", async () => {
        const numberOfFields = 300
        const mockInput = generateMockData(numberOfFields)

        // Measure execution time
        const startTime = process.hrtime.bigint()

        const result = await calculateOrganicMatterBalance(mockFdm, mockInput)

        const endTime = process.hrtime.bigint()
        const durationMs = Number(endTime - startTime) / 1_000_000

        console.log(
            `Calculated organic matter balance for ${numberOfFields} fields in ${durationMs.toFixed(2)} ms`,
        )

        expect(result).toBeDefined()
        expect(result.fields.length).toBe(numberOfFields)
        expect(typeof result.balance).toBe("number")
        expect(typeof result.supply).toBe("number")
        expect(typeof result.degradation).toBe("number")

        // Assert that the calculation completed within the desired timeout
        expect(durationMs).toBeLessThan(30000) // 30 seconds
    }, 35000) // Set Vitest timeout slightly higher than the expected test duration
})
