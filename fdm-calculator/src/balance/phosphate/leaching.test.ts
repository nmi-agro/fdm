import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type { PhosphateSaturation, PhosphateSaturationThreshold } from "./types"
import { calculatePhosphateLeaching } from "./leaching"

const saturation = (psd: number | null) =>
  ({ psd: psd === null ? null : { value: psd, min: psd, max: psd } }) as PhosphateSaturation
const threshold = (value: number | null, c_p_env: number | null) =>
  ({ value, c_p_env }) as PhosphateSaturationThreshold

describe("calculatePhosphateLeaching", () => {
  it("should be 0 without a surplus", () => {
    const result = calculatePhosphateLeaching(new Decimal(-10), saturation(60), threshold(20, 0.1))
    expect(result.total).toBe(0)
    expect(result.risk).toBe("high")
  })

  it("should be small on a non-saturated soil with deep groundwater", () => {
    // 40 × 0.01 × (0.2 / 0.3) = 0.27 kg P2O5 ≈ 0.12 kg P
    const result = calculatePhosphateLeaching(new Decimal(40), saturation(15), threshold(25, 0.3))
    expect(result.risk).toBe("low")
    expect(result.total).toBeCloseTo(-0.267, 2)
  })

  it("should be larger on a saturated soil with shallow groundwater", () => {
    // 40 × 0.06 × (0.2 / 0.1) = 4.8 kg P2O5 ≈ 2.1 kg P
    const result = calculatePhosphateLeaching(new Decimal(40), saturation(60), threshold(20, 0.1))
    expect(result.risk).toBe("high")
    expect(result.total).toBeCloseTo(-4.8)
  })

  it("should use the shallow-groundwater concentration when it is unknown", () => {
    // 10 × 0.03 × (0.2 / 0.1) = 0.6
    const result = calculatePhosphateLeaching(new Decimal(10), saturation(30), threshold(25, null))
    expect(result.risk).toBe("medium")
    expect(result.total).toBeCloseTo(-0.6)
  })

  it("should use the medium fraction when the PSD is unknown", () => {
    const result = calculatePhosphateLeaching(new Decimal(10), saturation(null), threshold(25, 0.2))
    expect(result.risk).toBe("unknown")
    expect(result.total).toBeCloseTo(-0.3)
  })
})
