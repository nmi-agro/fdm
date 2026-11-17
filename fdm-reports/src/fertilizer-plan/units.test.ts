import { describe, expect, it } from "vitest"
import { getApplicationAmountTotalUnitLabel, getApplicationAmountUnitLabel } from "./units"

describe("application amount unit labels", () => {
  it.each([
    ["kg/ha", "kg/ha", "kg"],
    ["ton/ha", "ton/ha", "ton"],
    ["l/ha", "l/ha", "L"],
    ["m3/ha", "m³/ha", "m³"],
  ] as const)("labels %s", (unit, label, totalLabel) => {
    expect(getApplicationAmountUnitLabel(unit)).toBe(label)
    expect(getApplicationAmountTotalUnitLabel(unit)).toBe(totalLabel)
  })
})
