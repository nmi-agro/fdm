import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import {
  type AppAmountUnit,
  fromKgPerHa,
  getAppAmountDisplayRange,
  isAppAmountInRange,
  P_APP_AMOUNT_MAX,
  toKgPerHa,
} from "./fertilizer-application-unit-conversion"

describe("isAppAmountInRange", () => {
  it.each([
    [0, false],
    [-1, false],
    [0.001, true],
    [P_APP_AMOUNT_MAX, true],
    [P_APP_AMOUNT_MAX + 0.001, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
  ])("returns the right result for %s kg/ha", (amount, expected) => {
    expect(isAppAmountInRange(amount)).toBe(expected)
  })
})

describe("getAppAmountDisplayRange", () => {
  it.each<[AppAmountUnit, number | null, number]>([
    ["kg/ha", null, 100_000],
    ["ton/ha", null, 100],
    ["l/ha", 1.25, 80_000],
    ["m3/ha", 1.25, 80],
  ])("returns the maximum in %s (density %s)", (unit, density, max) => {
    expect(getAppAmountDisplayRange(unit, density)).toEqual({ max })
  })

  it("returns a maximum that converts back to exactly 100,000 kg/ha", () => {
    const range = getAppAmountDisplayRange("l/ha", 1.3)
    expect(range).not.toBeNull()
    expect(toKgPerHa(range?.max ?? 0, "l/ha", 1.3)).toBeCloseTo(P_APP_AMOUNT_MAX, 6)
  })

  it.each<AppAmountUnit>(["l/ha", "m3/ha"])(
    "returns null for %s when the density is missing",
    (unit) => {
      expect(getAppAmountDisplayRange(unit, null)).toBeNull()
      expect(getAppAmountDisplayRange(unit, 0)).toBeNull()
    },
  )
})

interface ConversionUnitTestCase {
  input: number
  unit: AppAmountUnit
  density?: number | undefined
  output?: number | null
  throws?: string
}

describe("toKgPerHa", () => {
  const tests: ConversionUnitTestCase[] = [
    { input: 20, unit: "kg/ha", output: 20 },
    { input: 20, unit: "ton/ha", output: 20000 },
    { input: 20, unit: "l/ha", density: 0.8, output: 16 },
    { input: 20, unit: "m3/ha", density: 0.8, output: 16000 },
    { input: 0, unit: "kg/ha", output: 0 },
    { input: 0, unit: "ton/ha", output: 0 },
    { input: 0, unit: "l/ha", density: 0.8, output: 0 },
    { input: 0, unit: "m3/ha", density: 0.8, output: 0 },
  ]

  const throwingTests: ConversionUnitTestCase[] = [
    {
      input: 20,
      unit: "l/ha",
      density: undefined,
      throws: "Positive density (p_density) is required for l/ha → kg/ha conversion",
    },
    {
      input: 20,
      unit: "m3/ha",
      density: undefined,
      throws: "Positive density (p_density) is required for m3/ha → kg/ha conversion",
    },
    {
      input: 20,
      unit: "ft3/ha" as AppAmountUnit,
      density: 2,
      throws: "ft3/ha → kg/ha conversion is not supported",
    },
    {
      input: 20,
      unit: "m3/ha",
      density: 0,
      throws: "Positive density (p_density) is required for m3/ha → kg/ha conversion",
    },
    {
      input: 20,
      unit: "m3/ha",
      density: -1,
      throws: "Positive density (p_density) is required for m3/ha → kg/ha conversion",
    },
  ]

  for (const { input, unit, density, output } of tests) {
    it(
      density !== undefined
        ? `should convert ${unit} to kg/ha with density ${density} kg/l`
        : `should convert ${unit} to kg/ha without density specified`,
      () => {
        expect(toKgPerHa(input, unit, density)).toBe(output)
      },
    )
  }

  for (const { input, unit, density, throws } of throwingTests) {
    it(
      density !== undefined
        ? `should throw exception on conversion from ${unit} to kg/ha`
        : `should throw exception on conversion from ${unit} to kg/ha without density specified`,
      () => {
        expect(() => toKgPerHa(input, unit, density)).toThrow(throws)
      },
    )
  }

  it("should accept input of type Decimal", () => {
    expect(toKgPerHa(new Decimal(10), "m3/ha", new Decimal(2))).toBe(20000)
  })
})

describe("fromKgPerHa", () => {
  const tests: ConversionUnitTestCase[] = [
    { input: 20, unit: "kg/ha", output: 20 },
    { input: 20000, unit: "ton/ha", output: 20 },
    { input: 16, unit: "l/ha", density: 0.8, output: 20 },
    { input: 16000, unit: "m3/ha", density: 0.8, output: 20 },
    { input: 0, unit: "kg/ha", output: 0 },
    { input: 0, unit: "ton/ha", output: 0 },
    { input: 0, unit: "l/ha", density: 0.8, output: 0 },
    { input: 0, unit: "m3/ha", density: 0.8, output: 0 },
    {
      input: 20,
      unit: "l/ha",
      density: undefined,
      output: null,
    },
    {
      input: 20,
      unit: "m3/ha",
      density: undefined,
      output: null,
    },
    {
      input: 20,
      unit: "m3/ha",
      density: 0,
      output: null,
    },
    {
      input: 20,
      unit: "m3/ha",
      density: -1,
      output: null,
    },
    {
      input: 20,
      unit: "ft3/ha" as AppAmountUnit,
      density: 2,
      output: null,
    },
  ]

  for (const { input, unit, density, output } of tests) {
    it(
      density !== undefined
        ? `should convert kg/ha to ${unit} with density ${density} kg/l`
        : `should convert kg/ha to ${unit} without density specified`,
      () => {
        const value = fromKgPerHa(input, unit, density)
        expect(value).toBe(output)
      },
    )
  }

  it("should accept input of type Decimal", () => {
    expect(fromKgPerHa(new Decimal(20000), "m3/ha", new Decimal(2))).toBe(10)
  })
})
