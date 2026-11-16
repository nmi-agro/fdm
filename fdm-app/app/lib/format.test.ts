import { describe, expect, it } from "vitest"
import { formatBalanceDifference, formatBalanceValue } from "./format"

describe("formatBalanceValue", () => {
  it("shows whole numbers, and one decimal for small fractional values", () => {
    expect(formatBalanceValue(1245.06)).toBe("1.245")
    expect(formatBalanceValue(-31.4)).toBe("-31")
    expect(formatBalanceValue(-1.34)).toBe("-1,3")
    expect(formatBalanceValue(3)).toBe("3")
    expect(formatBalanceValue(-0.04)).toBe("0")
  })
})

describe("formatBalanceDifference", () => {
  it("adds a plus sign to a positive difference", () => {
    expect(formatBalanceDifference(12.4)).toBe("+12")
    expect(formatBalanceDifference(-1.34)).toBe("-1,3")
    expect(formatBalanceDifference(0.02)).toBe("0")
  })
})
