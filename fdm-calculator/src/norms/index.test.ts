import type { CurrentSoilData, FdmType, Field } from "@nmi-agro/fdm-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  NL2026FarmFdmCoreOperations,
  NL2026SingleFdmCoreOperations,
} from "./nl/2026/value/input"
import { aggregateNormFillingsToFarmLevel, aggregateNormsToFarmLevel } from "./farm"
import {
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  createUncachedFunctionsForFertilizerApplicationFilling,
} from "./index"
import { calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2025/filling/dierlijke-mest-gebruiksnorm"
import { getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2025/filling/dierlijke-mest-gebruiksnorm-cache"
import { calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2025/filling/fosfaatgebruiksnorm"
import { getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2025/filling/fosfaatgebruiksnorm-cache"
import { collectNL2025InputForFertilizerApplicationFilling } from "./nl/2025/filling/input"
import {
  calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2025/filling/stikstofgebruiksnorm-cache"
import { getNL2025DierlijkeMestGebruiksNorm } from "./nl/2025/value/dierlijke-mest-gebruiksnorm"
import { getNL2025FosfaatGebruiksNorm } from "./nl/2025/value/fosfaatgebruiksnorm"
import { collectNL2025InputForNorms } from "./nl/2025/value/input"
import { getNL2025StikstofGebruiksNorm } from "./nl/2025/value/stikstofgebruiksnorm"
import { calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2026/filling/dierlijke-mest-gebruiksnorm"
import { getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2026/filling/dierlijke-mest-gebruiksnorm-cache"
import { calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2026/filling/fosfaatgebruiksnorm"
import { getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2026/filling/fosfaatgebruiksnorm-cache"
import * as NL2026FillingInput from "./nl/2026/filling/input"
import { calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2026/filling/renure-gebruiksnorm"
import { getNL2026FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2026/filling/renure-gebruiksnorm-cache"
import {
  calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2026/filling/stikstofgebruiksnorm-cache"
import { getNL2026DierlijkeMestGebruiksNorm } from "./nl/2026/value/dierlijke-mest-gebruiksnorm"
import { getNL2026FosfaatGebruiksNorm } from "./nl/2026/value/fosfaatgebruiksnorm"
import { getNL2026RenureGebruiksNorm } from "./nl/2026/value/renure-gebruiksnorm"
import { getNL2026StikstofGebruiksNorm } from "./nl/2026/value/stikstofgebruiksnorm"
import { isNormsYear, NORMS_YEARS } from "./years"

describe("NORMS_YEARS and isNormsYear", () => {
  it("lists 2025, 2026 and 2027", () => {
    expect(NORMS_YEARS).toEqual(["2025", "2026", "2027"])
  })

  it("accepts only the supported years", () => {
    for (const year of NORMS_YEARS) expect(isNormsYear(year)).toBe(true)
    expect(isNormsYear("2024")).toBe(false)
    expect(isNormsYear("2028")).toBe(false)
    expect(isNormsYear(2026)).toBe(false)
    expect(isNormsYear(undefined)).toBe(false)
  })
})

// 2026 and 2027 use the same functions (the rules introduced in 2026). Only the input collectors
// differ: they are bound to the norm year.
describe.each([
  ["2026", 2026],
  ["2027", 2027],
] as const)("NL %s uses the functions of the rules introduced in 2026", (year, normYear) => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockFdm = {} as FdmType
  const mockField = {
    b_id: "field-1",
    b_id_farm: "farm-1",
    b_centroid: [5.0, 52.0],
  } as unknown as Field

  it("createFunctionsForNorms returns the 2026 norm functions", () => {
    const functions = createFunctionsForNorms("NL", year)
    expect(functions.calculateNormForNitrogen).toBe(getNL2026StikstofGebruiksNorm)
    expect(functions.calculateNormForManure).toBe(getNL2026DierlijkeMestGebruiksNorm)
    expect(functions.calculateNormForPhosphate).toBe(getNL2026FosfaatGebruiksNorm)
    expect(functions.calculateNormForRenure).toBe(getNL2026RenureGebruiksNorm)
    expect(functions.aggregateNormsToFarmLevel).toBe(aggregateNormsToFarmLevel)
  })

  it("collectInputForNorms collects the input of the norm year", async () => {
    const getGrazingIntention = vi.fn(async () => true)
    const getCultivations = vi.fn(async () => [])
    const input = await createFunctionsForNorms("NL", year).collectInputForNorms(
      mockFdm,
      "principal-1",
      "field-1",
      {
        getField: async () => mockField,
        getCultivations,
        getHarvests: async () => [],
        getCurrentSoilData: async () => [] as unknown as CurrentSoilData,
        getGrazingIntention,
      } as unknown as NL2026SingleFdmCoreOperations,
    )
    expect(input.year).toBe(normYear)
    expect(getGrazingIntention).toHaveBeenCalledWith(mockFdm, "principal-1", "farm-1", normYear)
    expect(getCultivations).toHaveBeenCalledWith(mockFdm, "principal-1", "field-1", {
      start: new Date(normYear - 1, 0, 1),
      end: new Date(normYear, 11, 31),
    })
  })

  it("collectInputForNormsForFarm collects the input of the norm year", async () => {
    const getGrazingIntention = vi.fn(async () => false)
    const inputs = await createFunctionsForNorms("NL", year).collectInputForNormsForFarm(
      mockFdm,
      "principal-1",
      "farm-1",
      {
        getFields: async () => [mockField],
        getGrazingIntention,
        getCultivationsForFarm: async () => new Map(),
        getHarvestsForFarm: async () => new Map(),
        getCurrentSoilDataForFarm: async () => new Map(),
      } as unknown as NL2026FarmFdmCoreOperations,
    )
    expect(inputs.get("field-1")?.year).toBe(normYear)
    expect(getGrazingIntention).toHaveBeenCalledWith(mockFdm, "principal-1", "farm-1", normYear)
  })

  it("createFunctionsForFertilizerApplicationFilling returns the 2026 filling functions", async () => {
    const functions = createFunctionsForFertilizerApplicationFilling("NL", year)
    expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
      getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
      getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForPhosphate).toBe(
      getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForRenure).toBe(
      getNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
    )
    expect(functions.aggregateNormFillingsToFarmLevel).toBe(aggregateNormFillingsToFarmLevel)

    const collectField = vi
      .spyOn(NL2026FillingInput, "collectNL2026InputForFertilizerApplicationFilling")
      .mockResolvedValue({} as never)
    const collectFarm = vi
      .spyOn(NL2026FillingInput, "collectNL2026InputForFertilizerApplicationFillingForFarm")
      .mockResolvedValue(new Map())
    const byField = new Map([["field-1", 75]])
    await functions.collectInputForFertilizerApplicationFilling(mockFdm, "p", "field-1", 75)
    await functions.collectInputForFertilizerApplicationFillingForFarm(
      mockFdm,
      "p",
      "farm-1",
      byField,
    )
    expect(collectField).toHaveBeenCalledWith(mockFdm, "p", "field-1", 75, normYear)
    expect(collectFarm).toHaveBeenCalledWith(mockFdm, "p", "farm-1", byField, normYear)
  })

  it("createUncachedFunctionsForFertilizerApplicationFilling returns the 2026 filling functions", async () => {
    const functions = createUncachedFunctionsForFertilizerApplicationFilling("NL", year)
    expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
      calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
      calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForPhosphate).toBe(
      calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForRenure).toBe(
      calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
    )
    expect(functions.aggregateNormFillingsToFarmLevel).toBe(aggregateNormFillingsToFarmLevel)

    const collectField = vi
      .spyOn(NL2026FillingInput, "collectNL2026InputForFertilizerApplicationFilling")
      .mockResolvedValue({} as never)
    await functions.collectInputForFertilizerApplicationFilling(mockFdm, "p", "field-1", 75)
    expect(collectField).toHaveBeenCalledWith(mockFdm, "p", "field-1", 75, normYear)
  })

  it("has the same shape as 2026", () => {
    expect(Object.keys(createFunctionsForNorms("NL", year)).sort()).toEqual(
      Object.keys(createFunctionsForNorms("NL", "2026")).sort(),
    )
    expect(Object.keys(createFunctionsForFertilizerApplicationFilling("NL", year)).sort()).toEqual(
      Object.keys(createFunctionsForFertilizerApplicationFilling("NL", "2026")).sort(),
    )
  })
})

describe("createFunctionsForNorms", () => {
  it("should return the correct functions for NL region and year 2025", () => {
    const functions = createFunctionsForNorms("NL", "2025")
    expect(functions.collectInputForNorms).toBe(collectNL2025InputForNorms)
    expect(functions.calculateNormForNitrogen).toBe(getNL2025StikstofGebruiksNorm)
    expect(functions.calculateNormForManure).toBe(getNL2025DierlijkeMestGebruiksNorm)
    expect(functions.calculateNormForPhosphate).toBe(getNL2025FosfaatGebruiksNorm)
    expect(functions.aggregateNormsToFarmLevel).toBe(aggregateNormsToFarmLevel)
  })

  it("should throw an error for an unsupported year", () => {
    //@ts-expect-error
    expect(() => createFunctionsForNorms("NL", "2024")).toThrow("Year not supported")
  })

  it("should throw an error for an unsupported region", () => {
    //@ts-expect-error
    expect(() => createFunctionsForNorms("BE", "2025")).toThrow("Region not supported")
  })
})

describe("createFunctionsForFertilizerApplicationFilling", () => {
  it("should return the correct functions for NL region and year 2025", () => {
    const functions = createFunctionsForFertilizerApplicationFilling("NL", "2025")
    expect(functions.collectInputForFertilizerApplicationFilling).toBe(
      collectNL2025InputForFertilizerApplicationFilling,
    )
    expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
      getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
      getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForPhosphate).toBe(
      getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
    )
    expect(functions.aggregateNormFillingsToFarmLevel).toBe(aggregateNormFillingsToFarmLevel)
  })

  it("should throw an error for an unsupported year", () => {
    expect(() =>
      //@ts-expect-error
      createFunctionsForFertilizerApplicationFilling("NL", "2024"),
    ).toThrow("Year not supported")
  })

  it("should throw an error for an unsupported region", () => {
    expect(() =>
      //@ts-expect-error
      createFunctionsForFertilizerApplicationFilling("BE", "2025"),
    ).toThrow("Region not supported")
  })
})

describe("createUncachedFunctionsForFertilizerApplicationFilling", () => {
  it("should return the correct uncached functions for NL region and year 2025", () => {
    const functions = createUncachedFunctionsForFertilizerApplicationFilling("NL", "2025")
    expect(functions.collectInputForFertilizerApplicationFilling).toBe(
      collectNL2025InputForFertilizerApplicationFilling,
    )
    expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
      calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
      calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForPhosphate).toBe(
      calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
    )
    expect(functions.aggregateNormFillingsToFarmLevel).toBe(aggregateNormFillingsToFarmLevel)
  })

  it("should throw an error for an unsupported year", () => {
    expect(() =>
      createUncachedFunctionsForFertilizerApplicationFilling(
        "NL",
        //@ts-expect-error
        "2024",
      ),
    ).toThrow("Year not supported")
  })

  it("should throw an error for an unsupported region", () => {
    expect(() =>
      createUncachedFunctionsForFertilizerApplicationFilling(
        //@ts-expect-error
        "BE",
        "2025",
      ),
    ).toThrow("Region not supported")
  })
})
