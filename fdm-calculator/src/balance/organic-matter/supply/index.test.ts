import Decimal from "decimal.js"
import { describe, expect, it, vi } from "vitest"
import type {
  CultivationDetail,
  FertilizerDetail,
  FieldInput,
  OrganicMatterBalanceInput,
} from "../types"
import * as cultivations from "./cultivation"
import * as fertilizers from "./fertilizers"
import { calculateOrganicMatterSupply } from "./index"
import * as residues from "./residues"

vi.mock("./fertilizers")
vi.mock("./cultivation")
vi.mock("./residues")

describe("calculateOrganicMatterSupply", () => {
  const timeFrame: OrganicMatterBalanceInput["timeFrame"] = {
    start: new Date("2023-01-01"),
    end: new Date("2023-12-31"),
  }
  const mockCultivations: FieldInput["cultivations"] = []
  const mockFertilizerApplications: FieldInput["fertilizerApplications"] = []
  const mockCultivationDetailsMap = new Map<string, CultivationDetail>()
  const mockFertilizerDetailsMap = new Map<string, FertilizerDetail>()

  it("should sum the supply from all sources", () => {
    vi.spyOn(fertilizers, "calculateOrganicMatterSupplyByFertilizers").mockReturnValue({
      total: new Decimal(100),
      manure: { total: new Decimal(100), applications: [] },
      compost: { total: new Decimal(0), applications: [] },
      other: { total: new Decimal(0), applications: [] },
    })
    vi.spyOn(cultivations, "calculateOrganicMatterSupplyByCultivations").mockReturnValue({
      total: new Decimal(200),
      cultivations: [],
    })
    vi.spyOn(residues, "calculateOrganicMatterSupplyByResidues").mockReturnValue({
      total: new Decimal(50),
      cultivations: [],
    })

    const result = calculateOrganicMatterSupply(
      mockCultivations,
      mockFertilizerApplications,
      mockCultivationDetailsMap,
      mockFertilizerDetailsMap,
      timeFrame,
    )

    expect(result.total.toNumber()).toBe(350)
    expect(result.fertilizers.total.toNumber()).toBe(100)
    expect(result.cultivations.total.toNumber()).toBe(200)
    expect(result.residues.total.toNumber()).toBe(50)
  })

  it("should handle zero supply from all sources", () => {
    vi.spyOn(fertilizers, "calculateOrganicMatterSupplyByFertilizers").mockReturnValue({
      total: new Decimal(0),
      manure: { total: new Decimal(0), applications: [] },
      compost: { total: new Decimal(0), applications: [] },
      other: { total: new Decimal(0), applications: [] },
    })
    vi.spyOn(cultivations, "calculateOrganicMatterSupplyByCultivations").mockReturnValue({
      total: new Decimal(0),
      cultivations: [],
    })
    vi.spyOn(residues, "calculateOrganicMatterSupplyByResidues").mockReturnValue({
      total: new Decimal(0),
      cultivations: [],
    })

    const result = calculateOrganicMatterSupply(
      mockCultivations,
      mockFertilizerApplications,
      mockCultivationDetailsMap,
      mockFertilizerDetailsMap,
      timeFrame,
    )

    expect(result.total.toNumber()).toBe(0)
  })

  it("should re-throw errors from sub-calculations", () => {
    vi.spyOn(fertilizers, "calculateOrganicMatterSupplyByFertilizers").mockImplementation(() => {
      throw new Error("Fertilizer calculation failed")
    })

    expect(() =>
      calculateOrganicMatterSupply(
        mockCultivations,
        mockFertilizerApplications,
        mockCultivationDetailsMap,
        mockFertilizerDetailsMap,
        timeFrame,
      ),
    ).toThrow("Failed to calculate organic matter supply: Fertilizer calculation failed")
  })
})
