import { describe, expect, it } from "vitest"
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
import { collectNL2026InputForFertilizerApplicationFilling } from "./nl/2026/filling/input"
import {
  calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2026/filling/stikstofgebruiksnorm-cache"
import { getNL2026DierlijkeMestGebruiksNorm } from "./nl/2026/value/dierlijke-mest-gebruiksnorm"
import { getNL2026FosfaatGebruiksNorm } from "./nl/2026/value/fosfaatgebruiksnorm"
import { collectNL2026InputForNorms } from "./nl/2026/value/input"
import { getNL2026StikstofGebruiksNorm } from "./nl/2026/value/stikstofgebruiksnorm"
import { calculateNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2027/filling/dierlijke-mest-gebruiksnorm"
import { getNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2027/filling/dierlijke-mest-gebruiksnorm-cache"
import { calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2027/filling/fosfaatgebruiksnorm"
import { getNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2027/filling/fosfaatgebruiksnorm-cache"
import {
  collectNL2027InputForFertilizerApplicationFilling,
  collectNL2027InputForFertilizerApplicationFillingForFarm,
} from "./nl/2027/filling/input"
import { calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2027/filling/renure-gebruiksnorm"
import { getNL2027FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2027/filling/renure-gebruiksnorm-cache"
import {
  calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2027/filling/stikstofgebruiksnorm-cache"
import { getNL2027DierlijkeMestGebruiksNorm } from "./nl/2027/value/dierlijke-mest-gebruiksnorm"
import { getNL2027FosfaatGebruiksNorm } from "./nl/2027/value/fosfaatgebruiksnorm"
import {
  collectNL2027InputForNorms,
  collectNL2027InputForNormsForFarm,
} from "./nl/2027/value/input"
import { getNL2027RenureGebruiksNorm } from "./nl/2027/value/renure-gebruiksnorm"
import { getNL2027StikstofGebruiksNorm } from "./nl/2027/value/stikstofgebruiksnorm"
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

describe("2027 factories (provisional copy of 2026)", () => {
  it("createFunctionsForNorms returns the 2027 functions, with the same shape as 2026", () => {
    const functions = createFunctionsForNorms("NL", "2027")
    expect(functions).toEqual({
      collectInputForNorms: collectNL2027InputForNorms,
      collectInputForNormsForFarm: collectNL2027InputForNormsForFarm,
      calculateNormForNitrogen: getNL2027StikstofGebruiksNorm,
      calculateNormForManure: getNL2027DierlijkeMestGebruiksNorm,
      calculateNormForPhosphate: getNL2027FosfaatGebruiksNorm,
      calculateNormForRenure: getNL2027RenureGebruiksNorm,
      aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
    })
    expect(Object.keys(functions).sort()).toEqual(
      Object.keys(createFunctionsForNorms("NL", "2026")).sort(),
    )
  })

  it("createFunctionsForFertilizerApplicationFilling returns the 2027 functions, with the same shape as 2026", () => {
    const functions = createFunctionsForFertilizerApplicationFilling("NL", "2027")
    expect(functions).toEqual({
      collectInputForFertilizerApplicationFilling:
        collectNL2027InputForFertilizerApplicationFilling,
      collectInputForFertilizerApplicationFillingForFarm:
        collectNL2027InputForFertilizerApplicationFillingForFarm,
      calculateFertilizerApplicationFillingForNitrogen:
        getNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
      calculateFertilizerApplicationFillingForManure:
        getNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
      calculateFertilizerApplicationFillingForPhosphate:
        getNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm,
      calculateFertilizerApplicationFillingForRenure:
        getNL2027FertilizerApplicationFillingForRenureGebruiksNorm,
      aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
    })
    expect(Object.keys(functions).sort()).toEqual(
      Object.keys(createFunctionsForFertilizerApplicationFilling("NL", "2026")).sort(),
    )
  })

  it("createUncachedFunctionsForFertilizerApplicationFilling returns the 2027 functions, with the same shape as 2026", () => {
    const functions = createUncachedFunctionsForFertilizerApplicationFilling("NL", "2027")
    expect(functions).toEqual({
      collectInputForFertilizerApplicationFilling:
        collectNL2027InputForFertilizerApplicationFilling,
      calculateFertilizerApplicationFillingForNitrogen:
        calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
      calculateFertilizerApplicationFillingForManure:
        calculateNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
      calculateFertilizerApplicationFillingForPhosphate:
        calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm,
      calculateFertilizerApplicationFillingForRenure:
        calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm,
      aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
    })
    expect(Object.keys(functions).sort()).toEqual(
      Object.keys(createUncachedFunctionsForFertilizerApplicationFilling("NL", "2026")).sort(),
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

  it("should return the correct functions for NL region and year 2026", () => {
    const functions = createFunctionsForNorms("NL", "2026")
    expect(functions.collectInputForNorms).toBe(collectNL2026InputForNorms)
    expect(functions.calculateNormForNitrogen).toBe(getNL2026StikstofGebruiksNorm)
    expect(functions.calculateNormForManure).toBe(getNL2026DierlijkeMestGebruiksNorm)
    expect(functions.calculateNormForPhosphate).toBe(getNL2026FosfaatGebruiksNorm)
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

  it("should return the correct functions for NL region and year 2026", () => {
    const functions = createFunctionsForFertilizerApplicationFilling("NL", "2026")
    expect(functions.collectInputForFertilizerApplicationFilling).toBe(
      collectNL2026InputForFertilizerApplicationFilling,
    )
    expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
      getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
      getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForPhosphate).toBe(
      getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
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

  it("should return the correct uncached functions for NL region and year 2026", () => {
    const functions = createUncachedFunctionsForFertilizerApplicationFilling("NL", "2026")
    expect(functions.collectInputForFertilizerApplicationFilling).toBe(
      collectNL2026InputForFertilizerApplicationFilling,
    )
    expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
      calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
      calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    )
    expect(functions.calculateFertilizerApplicationFillingForPhosphate).toBe(
      calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
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
