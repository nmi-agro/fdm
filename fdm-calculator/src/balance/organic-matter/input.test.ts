import * as fdmCore from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectInputForOrganicMatterBalance } from "./input"
import type { OrganicMatterBalanceInput } from "./types"

function mockedFdmCore() {
    return [
        "getFields",
        "getField",
        "getCultivationsForFarm",
        "getHarvests",
        "getHarvestsForCultivations",
        "getSoilAnalyses",
        "getCultivations",
        "getSoilAnalysesForFarm",
        "getFertilizerApplications",
        "getFertilizerApplicationsForFarm",
        "getFertilizers",
        "getCultivationsFromCatalogue",
    ] as const
}

vi.mock("@nmi-agro/fdm-core", async () => {
    const original = await vi.importActual("@nmi-agro/fdm-core")
    return mockedFdmCore().reduce(
        (acc, name) => {
            acc[name] = vi.fn()
            return acc
        },
        { ...original },
    )
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

    beforeEach(() =>
        mockedFdmCore().forEach((name) => {
            vi.spyOn(fdmCore, name).mockReset()
        }),
    )

    it("should collect input for all fields in a farm", async () => {
        const mockFields = [{ b_id: "field1" }, { b_id: "field2" }]
        vi.spyOn(fdmCore, "getFields").mockResolvedValue(mockFields as any)
        vi.spyOn(fdmCore, "getCultivationsForFarm").mockResolvedValue({})
        vi.spyOn(fdmCore, "getHarvestsForCultivations").mockResolvedValue({})
        vi.spyOn(fdmCore, "getSoilAnalysesForFarm").mockResolvedValue({})
        vi.spyOn(fdmCore, "getFertilizerApplicationsForFarm").mockResolvedValue(
            {},
        )
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

    it("should handle empty arrays from core functions correctly", async () => {
        vi.spyOn(fdmCore, "getFields").mockResolvedValue([])
        vi.spyOn(fdmCore, "getFertilizers").mockResolvedValue([])
        vi.spyOn(fdmCore, "getCultivationsFromCatalogue").mockResolvedValue([])

        const result = await collectInputForOrganicMatterBalance(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )

        const expectedResult: OrganicMatterBalanceInput = {
            fields: [],
            fertilizerDetails: [],
            cultivationDetails: [],
            timeFrame: timeframe,
        }

        expect(result).toEqual(expectedResult)
        expect(fdmCore.getFields).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
            timeframe,
        )
        expect(fdmCore.getFertilizers).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
        )
        expect(fdmCore.getCultivationsFromCatalogue).toHaveBeenCalledWith(
            mockFdm,
            principal_id,
            b_id_farm,
        )
        // Ensure other calls that depend on fields are not made
        expect(fdmCore.getCultivationsForFarm).not.toHaveBeenCalled()
        expect(fdmCore.getHarvestsForCultivations).not.toHaveBeenCalled()
        expect(fdmCore.getSoilAnalysesForFarm).not.toHaveBeenCalled()
        expect(fdmCore.getFertilizerApplicationsForFarm).not.toHaveBeenCalled()
    })

    it("should correctly structure the output", async () => {
        const mockField = { b_id: "field1" }
        const mockCultivation = { b_lu: "cult1" }
        const mockFertilizer = { p_id_catalogue: "fert1" }
        vi.spyOn(fdmCore, "getFields").mockResolvedValue([mockField] as any)
        vi.spyOn(fdmCore, "getCultivationsForFarm").mockResolvedValue({
            field1: [mockCultivation],
        } as any)
        vi.spyOn(fdmCore, "getFertilizers").mockResolvedValue([
            mockFertilizer,
        ] as any)
        vi.spyOn(fdmCore, "getCultivationsFromCatalogue").mockResolvedValue([
            mockCultivation,
        ] as any)
        vi.spyOn(fdmCore, "getHarvestsForCultivations").mockResolvedValue({})
        vi.spyOn(fdmCore, "getSoilAnalysesForFarm").mockResolvedValue({})
        vi.spyOn(fdmCore, "getFertilizerApplicationsForFarm").mockResolvedValue(
            {},
        )

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
