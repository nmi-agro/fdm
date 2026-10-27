import { describe, expect, it } from "vitest"
import { calculatePhosphateProjection, classifyYears, P_TO_P2O5 } from "./projection"
import { calculatePhosphateSaturation, calculatePhosphateSaturationThreshold } from "./saturation"

const project = (
  balance: number,
  soil: Parameters<typeof calculatePhosphateSaturation>[0],
  isGrassland = false,
) => {
  const saturation = calculatePhosphateSaturation(soil, isGrassland)
  const threshold = calculatePhosphateSaturationThreshold(saturation, soil, isGrassland)
  return calculatePhosphateProjection(balance, saturation, threshold, soil, isGrassland)
}

describe("calculatePhosphateProjection", () => {
  it("should reproduce the worked example of the issue on clay arable land", () => {
    // P-AL 60, no P input, offtake 60: (−60 − 20) / 50 = −1.6 per year; (60 − 45) / 1.6 ≈ 9 years
    const projection = project(-60, [{ a_p_al: 60, b_soiltype_agr: "zeeklei" }])
    expect(projection.fixation).toBe(20)
    expect(projection.p_al?.delta_per_year.value).toBeCloseTo(-1.6)
    expect(projection.p_al?.floor).toBe(45)
    expect(projection.p_al?.years?.value).toBeCloseTo(9.375)
    expect(projection.p_al?.years_class).toBe("5_10")
  })

  it("should give a band from the buffer range on dekzand", () => {
    const projection = project(-60, [{ a_p_al: 60, b_soiltype_agr: "dekzand" }])
    expect(projection.p_al?.buffer).toEqual({ value: 65, min: 60, max: 70 })
    expect(projection.p_al?.years?.min).toBeLessThan(projection.p_al?.years?.value ?? 0)
    expect(projection.p_al?.years?.max).toBeGreaterThan(projection.p_al?.years?.value ?? 0)
  })

  it("should scale the P-AL buffer to the grassland sampling depth and use no fixation on peat", () => {
    const projection = project(-20, [{ a_p_al: 50, b_soiltype_agr: "veen" }], true)
    expect(projection.depth).toEqual({ value: 0.1, source: "default_grassland" })
    expect(projection.fixation).toBe(0)
    expect(projection.p_al?.buffer.value).toBeCloseTo(45 * 0.4)
  })

  it("should project the PSD towards the field threshold with Eq. 5.7", () => {
    const soil = [
      {
        a_p_ox: 12,
        a_fe_ox: 29,
        a_al_ox: 36,
        a_p_cc: 3,
        a_density_sa: 1.35,
        a_depth_upper: 0,
        a_depth_lower: 25,
        b_gwl_class: "VII" as const,
        b_soiltype_agr: "dekzand" as const,
      },
    ]
    const projection = project(-40, soil)
    const kgPPerMmol = 1350 * 0.25 * 0.31
    expect(projection.psd?.delta_per_year).toBeCloseTo((-60 / P_TO_P2O5 / kgPPerMmol / 32.5) * 100)
    expect(projection.psd?.years).not.toBeNull()
  })

  it("should not give years when the balance moves away from the floor", () => {
    const projection = project(40, [{ a_p_al: 60, b_soiltype_agr: "zeeklei" }])
    expect(projection.p_al?.years).toBeNull()
    expect(projection.p_al?.years_class).toBe("not_reached")
  })
})

describe("classifyYears", () => {
  it("should convert years into classes", () => {
    expect(classifyYears(null)).toBe("not_reached")
    expect(classifyYears(0)).toBe("reached")
    expect(classifyYears(3)).toBe("lt_5")
    expect(classifyYears(7)).toBe("5_10")
    expect(classifyYears(15)).toBe("10_20")
    expect(classifyYears(30)).toBe("gt_20")
  })
})
