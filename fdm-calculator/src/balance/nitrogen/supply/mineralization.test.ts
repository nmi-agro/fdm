import { describe, expect, it } from "vitest"
import type {
  CultivationDetail,
  FieldInput,
  NitrogenBalanceInput,
  SoilAnalysisPicked,
} from "../types"
import {
  calculateNitrogenSupplyBySoilMineralization,
  calculateNitrogenSupplyBySoilMineralizationUsingMinip,
} from "./mineralization"

describe("calculateNitrogenSupplyBySoilMineralization", () => {
  const mockCultivationDetails = new Map<string, CultivationDetail>([
    [
      "1",
      {
        b_lu_catalogue: "1",
        b_lu_croprotation: "grass",
        b_lu_yield: null,
        b_lu_hi: null,
        b_lu_n_harvestable: null,
        b_lu_n_residue: null,
        b_n_fixation: null,
      } as const,
    ],
    [
      "2",
      {
        b_lu_catalogue: "2",
        b_lu_croprotation: "grass",
        b_lu_yield: null,
        b_lu_hi: null,
        b_lu_n_harvestable: null,
        b_lu_n_residue: null,
        b_n_fixation: null,
      } as const,
    ],
    [
      "3",
      {
        b_lu_catalogue: "3",
        b_lu_croprotation: "maize",
        b_lu_yield: null,
        b_lu_hi: null,
        b_lu_n_harvestable: null,
        b_lu_n_residue: null,
        b_n_fixation: null,
      } as const,
    ],
  ])

  const mockSoilAnalysis: SoilAnalysisPicked = {
    b_soiltype_agr: "zand",
    a_c_of: null,
    a_cn_fr: null,
    a_density_sa: null,
    a_n_rt: null,
    a_som_loi: null,
    b_gwl_class: null,
  }

  it("should return zero for non-grassland cultivation", () => {
    const cultivations: FieldInput["cultivations"] = [
      {
        b_lu: "c1",
        b_lu_start: new Date("2023-01-01"),
        b_lu_end: new Date("2023-12-31"),
        b_lu_catalogue: "3",
        m_cropresidue: false,
        b_lu_name: "Cultivation 1",
        b_lu_croprotation: "grass",
      },
    ]
    const timeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-01-01"),
      end: new Date("2023-12-31"),
    }

    const result = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      mockSoilAnalysis,
      mockCultivationDetails,
      timeFrame,
    )

    expect(result.total.toNumber()).toBe(0)
  })

  it("should use MINIP instead of the default values when useMinip is true", () => {
    const cultivations: FieldInput["cultivations"] = [
      {
        b_lu: "c1",
        b_lu_start: new Date("2023-01-01"),
        b_lu_end: new Date("2023-12-31"),
        b_lu_catalogue: "3",
        m_cropresidue: false,
        b_lu_name: "Cultivation 1",
        b_lu_croprotation: "maize",
      },
    ]
    const timeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-01-01"),
      end: new Date("2023-07-02"), // 182 days
    }
    const soilAnalysis: SoilAnalysisPicked = {
      ...mockSoilAnalysis,
      b_soiltype_agr: "dekzand",
      a_c_of: 20,
      a_cn_fr: 10,
      a_density_sa: 1.2,
    }

    const defaults = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      soilAnalysis,
      mockCultivationDetails,
      timeFrame,
    )
    expect(defaults.total.toNumber()).toBe(0)

    const minip = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      soilAnalysis,
      mockCultivationDetails,
      timeFrame,
      true,
    )
    const yearly = calculateNitrogenSupplyBySoilMineralizationUsingMinip(20, 10, 1.2)
    expect(yearly.toNumber()).toBeCloseTo(97, 0)
    expect(minip.total.toNumber()).toBeCloseTo(yearly.times(182).dividedBy(365).toNumber(), 6)
  })

  it("should throw when useMinip is true and soil parameters are missing", () => {
    expect(() =>
      calculateNitrogenSupplyBySoilMineralization(
        [],
        mockSoilAnalysis,
        mockCultivationDetails,
        { start: new Date("2023-01-01"), end: new Date("2023-12-31") },
        true,
      ),
    ).toThrow("No a_c_of value found")
  })

  it("should not require MINIP soil parameters when the timeframe is empty", () => {
    const emptyTimeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-06-01"),
      end: new Date("2023-06-01"),
    }
    const result = calculateNitrogenSupplyBySoilMineralization(
      [],
      mockSoilAnalysis, // No a_c_of, a_cn_fr or a_density_sa
      mockCultivationDetails,
      emptyTimeFrame,
      true,
    )
    expect(result.total.toNumber()).toBe(0)
    expect(result.years).toEqual([])
  })

  it("should calculate mineralization for grassland on veen soil", () => {
    const cultivations: FieldInput["cultivations"] = [
      {
        b_lu: "c1",
        b_lu_start: new Date("2023-01-01"),
        b_lu_end: new Date("2023-12-31"),
        b_lu_catalogue: "1",
        m_cropresidue: false,
        b_lu_name: "Cultivation 1",
        b_lu_croprotation: "grass",
      },
    ]
    const timeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-01-01"),
      end: new Date("2023-12-31"),
    }
    const soilAnalysis: SoilAnalysisPicked = {
      ...mockSoilAnalysis,
      b_soiltype_agr: "veen",
    }

    const result = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      soilAnalysis,
      mockCultivationDetails,
      timeFrame,
    )

    expect(result.total.toNumber()).toBeCloseTo(160, 0)
  })

  it("should calculate mineralization for dalgrond soil", () => {
    const cultivations: FieldInput["cultivations"] = [
      {
        b_lu: "c1",
        b_lu_start: new Date("2023-01-01"),
        b_lu_end: new Date("2023-12-31"),
        b_lu_catalogue: "1",
        m_cropresidue: false,
        b_lu_name: "Cultivation 1",
        b_lu_croprotation: "grass",
      },
    ]
    const timeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-01-01"),
      end: new Date("2023-12-31"),
    }
    const soilAnalysis: SoilAnalysisPicked = {
      ...mockSoilAnalysis,
      b_soiltype_agr: "dalgrond",
    }

    const result = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      soilAnalysis,
      mockCultivationDetails,
      timeFrame,
    )

    expect(result.total.toNumber()).toBeCloseTo(20, 0)
  })

  it("should return mineralization for arable land for grassland not in the May 15 - July 15 window", () => {
    const cultivations: FieldInput["cultivations"] = [
      {
        b_lu: "c1",
        b_lu_start: new Date("2023-01-01"),
        b_lu_end: new Date("2023-05-14"),
        b_lu_catalogue: "1",
        m_cropresidue: false,
        b_lu_name: "Cultivation 1",
        b_lu_croprotation: "grass",
      },
    ]
    const timeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-01-01"),
      end: new Date("2023-12-31"),
    }
    const soilAnalysis: SoilAnalysisPicked = {
      ...mockSoilAnalysis,
      b_soiltype_agr: "veen",
    }

    const result = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      soilAnalysis,
      mockCultivationDetails,
      timeFrame,
    )

    expect(result.total.toNumber()).toBeCloseTo(20, 0)
  })

  it("should handle null cultivation end date", () => {
    const cultivations: FieldInput["cultivations"] = [
      {
        b_lu: "c1",
        b_lu_start: new Date("2023-01-01"),
        b_lu_end: null,
        b_lu_catalogue: "1",
        m_cropresidue: false,
        b_lu_name: "Cultivation 1",
        b_lu_croprotation: "grass",
      },
    ]
    const timeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-01-01"),
      end: new Date("2023-12-31"),
    }
    const soilAnalysis: SoilAnalysisPicked = {
      ...mockSoilAnalysis,
      b_soiltype_agr: "veen",
    }

    const result = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      soilAnalysis,
      mockCultivationDetails,
      timeFrame,
    )

    expect(result.total.toNumber()).toBeCloseTo(160, 0)
  })

  it("should calculate mineralization for a partial year", () => {
    const cultivations: FieldInput["cultivations"] = [
      {
        b_lu: "c1",
        b_lu_start: new Date("2023-01-01"),
        b_lu_end: new Date("2023-12-31"),
        b_lu_catalogue: "1",
        m_cropresidue: false,
        b_lu_name: "Cultivation 1",
        b_lu_croprotation: "grass",
      },
    ]
    const timeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-01-01"),
      end: new Date("2023-06-30"),
    }
    const soilAnalysis: SoilAnalysisPicked = {
      ...mockSoilAnalysis,
      b_soiltype_agr: "veen",
    }

    const result = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      soilAnalysis,
      mockCultivationDetails,
      timeFrame,
    )

    expect(result.total.toNumber()).toBeCloseTo(78.9, 1)
  })

  it("should calculate mineralization over multiple years", () => {
    const cultivations: FieldInput["cultivations"] = [
      {
        b_lu: "c1",
        b_lu_start: new Date("2023-01-01"),
        b_lu_end: new Date("2024-12-31"),
        b_lu_catalogue: "1",
        m_cropresidue: false,
        b_lu_name: "Cultivation 1",
        b_lu_croprotation: "grass",
      },
    ]
    const timeFrame: NitrogenBalanceInput["timeFrame"] = {
      start: new Date("2023-01-01"),
      end: new Date("2024-12-31"),
    }
    const soilAnalysis: SoilAnalysisPicked = {
      ...mockSoilAnalysis,
      b_soiltype_agr: "veen",
    }

    const result = calculateNitrogenSupplyBySoilMineralization(
      cultivations,
      soilAnalysis,
      mockCultivationDetails,
      timeFrame,
    )

    expect(result.total.toNumber()).toBeCloseTo(320, 0)
  })
})

describe("calculateNitrogenSupplyBySoilMineralizationUsingMinip", () => {
  it("should return the yearly MINIP mineralization for known soil parameters", () => {
    expect(
      calculateNitrogenSupplyBySoilMineralizationUsingMinip(20, 10, 1.2).toNumber(),
    ).toBeCloseTo(97.239835025751, 8)
    expect(
      calculateNitrogenSupplyBySoilMineralizationUsingMinip(35, 12, 1.1).toNumber(),
    ).toBeCloseTo(116.991676515357, 8)
    expect(
      calculateNitrogenSupplyBySoilMineralizationUsingMinip(8, 9, 1.45).toNumber(),
    ).toBeCloseTo(54.83246252841, 8)
  })
})
