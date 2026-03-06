import * as fdmCore from "@nmi-agro/fdm-core"
import { describe, expect, it, vi } from "vitest"
import { collectInputForOrganicMatterBalance } from "./input"

vi.mock("@nmi-agro/fdm-core", async () => {
    const original = await vi.importActual("@nmi-agro/fdm-core")
    return {
        ...original,
        getFields: vi.fn(),
        getField: vi.fn(),
        getCultivations: vi.fn(),
        getHarvests: vi.fn(),
        getSoilAnalyses: vi.fn(),
        getFertilizerApplications: vi.fn(),
        getFertilizers: vi.fn(),
        getCultivationsFromCatalogue: vi.fn(),
    }
})

describe("collectInputForOrganicMatterBalance", () => {
    const mockFdm: any = {
        transaction: (callback: any) => callback(mockFdm),
    }
    const principal_id = "test-principal"
    const b_id_farm = "test-farm"
    const timeframe = {
        start: new Date("2023-01-01"),
        end: new Date("2023-12-31"),
    }

    it("should collect input for all fields in a farm", async () => {
        const mockFields = [{ b_id: "field1" }, { b_id: "field2" }]
        vi.spyOn(fdmCore, "getFields").mockResolvedValue(mockFields as any)
        vi.spyOn(fdmCore, "getCultivations").mockResolvedValue([])
        vi.spyOn(fdmCore, "getHarvests").mockResolvedValue([])
        vi.spyOn(fdmCore, "getSoilAnalyses").mockResolvedValue([])
        vi.spyOn(fdmCore, "getFertilizerApplications").mockResolvedValue([])
        vi.spyOn(fdmCore, "getFertilizers").mockResolvedValue([])
        vi.spyOn(fdmCore, "getCultivationsFromCatalogue").mockResolvedValue([])

        const result = await collectInputForOrganicMatterBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        expect(fdmCore.getFields).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )
        expect(result.fields).toHaveLength(2)
        expect(result.fields[0].field.b_id).toBe("field1")
    })

    it("should collect input for a single specified field", async () => {
        const mockField = { b_id: "field1" }
        vi.spyOn(fdmCore, "getField").mockResolvedValue(mockField as any)
        vi.spyOn(fdmCore, "getCultivations").mockResolvedValue([])
        vi.spyOn(fdmCore, "getHarvests").mockResolvedValue([])
        vi.spyOn(fdmCore, "getSoilAnalyses").mockResolvedValue([])
        vi.spyOn(fdmCore, "getFertilizerApplications").mockResolvedValue([])
        vi.spyOn(fdmCore, "getFertilizers").mockResolvedValue([])
        vi.spyOn(fdmCore, "getCultivationsFromCatalogue").mockResolvedValue([])

        const result = await collectInputForOrganicMatterBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
            "field1",
        )

        expect(fdmCore.getField).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            "field1",
        )
        expect(result.fields).toHaveLength(1)
        expect(result.fields[0].field.b_id).toBe("field1")
    })

    it("should throw an error if a specified field is not found", async () => {
        // @ts-expect-error
        vi.spyOn(fdmCore, "getField").mockResolvedValue(null)

        await expect(
            collectInputForOrganicMatterBalance(
                mockFdm,
                principal_id,
                b_id_farm,
                timeframe,
                "non-existent-field",
            ),
        ).rejects.toThrow("Field not found: non-existent-field")
    })

    it("should correctly structure the output", async () => {
        const mockField = { b_id: "field1" }
        const mockCultivation = { b_lu: "cult1" }
        const mockFertilizer = { p_id_catalogue: "fert1" }
        vi.spyOn(fdmCore, "getFields").mockResolvedValue([mockField] as any)
        vi.spyOn(fdmCore, "getCultivations").mockResolvedValue([
            mockCultivation,
        ] as any)
        vi.spyOn(fdmCore, "getFertilizers").mockResolvedValue([
            mockFertilizer,
        ] as any)
        vi.spyOn(fdmCore, "getCultivationsFromCatalogue").mockResolvedValue([
            mockCultivation,
        ] as any)
        vi.spyOn(fdmCore, "getHarvests").mockResolvedValue([])
        vi.spyOn(fdmCore, "getSoilAnalyses").mockResolvedValue([])
        vi.spyOn(fdmCore, "getFertilizerApplications").mockResolvedValue([])

        const result = await collectInputForOrganicMatterBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        expect(result).toHaveProperty("fields")
        expect(result).toHaveProperty("fertilizerDetails")
        expect(result).toHaveProperty("cultivationDetails")
        expect(result).toHaveProperty("timeFrame")
        expect(result.fertilizerDetails[0].p_id_catalogue).toBe("fert1")
    })
})
