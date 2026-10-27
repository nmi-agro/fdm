import { describe, expect, it } from "vitest"
import { calculatePhosphateSaturation } from "./saturation"
import { calculatePhosphateStock, P_TO_P2O5 } from "./stock"

describe("calculatePhosphateStock", () => {
  const soil = [
    {
      a_p_ox: 12,
      a_fe_ox: 29,
      a_al_ox: 36,
      a_density_sa: 1.35,
      a_depth_upper: 0,
      a_depth_lower: 25,
      b_soiltype_agr: "dekzand" as const,
    },
  ]
  const saturation = calculatePhosphateSaturation(soil, false)

  it("should convert a yearly deficit into a decrease of P-ox and the PSD", () => {
    const stock = calculatePhosphateStock(-60, saturation, soil, false)
    const kgPPerMmol = 1350 * 0.25 * 0.31
    expect(stock?.depth).toEqual({ value: 0.25, source: "soil_analysis" })
    expect(stock?.delta_p_ox_per_year).toBeCloseTo(-60 / P_TO_P2O5 / kgPPerMmol)
    expect(stock?.delta_psd_per_year.value).toBeCloseTo((-60 / P_TO_P2O5 / kgPPerMmol / 32.5) * 100)
    // From about 37% to the 25% reference at about 0.77% per year: about 15 years
    expect(stock?.years_to_reference?.value).toBeGreaterThan(12)
    expect(stock?.years_to_reference?.value).toBeLessThan(18)
    expect(stock?.years_to_reference?.min).toBeLessThanOrEqual(
      stock?.years_to_reference?.value ?? 0,
    )
    expect(stock?.years_to_reference?.max).toBeGreaterThanOrEqual(
      stock?.years_to_reference?.value ?? 0,
    )
  })

  it("should give 0 years when a deficit has already brought the PSD below the reference", () => {
    const stock = calculatePhosphateStock(-60, saturation, soil, false, 30)
    expect(stock?.years_to_reference?.value).toBeGreaterThan(0)
    const low = calculatePhosphateStock(-60, saturation, soil, false, 50)
    expect(low?.years_to_reference?.value).toBe(0)
  })

  it("should not give years to the reference when the balance moves away from it", () => {
    const stock = calculatePhosphateStock(30, saturation, soil, false)
    expect(stock?.years_to_reference).toBeNull()
  })

  it("should use the default grassland depth and soil-type bulk density when missing", () => {
    const grass = [{ a_p_ox: 12, a_fe_ox: 29, a_al_ox: 36, b_soiltype_agr: "veen" as const }]
    const stock = calculatePhosphateStock(
      -20,
      calculatePhosphateSaturation(grass, true),
      grass,
      true,
    )
    expect(stock?.depth).toEqual({ value: 0.1, source: "default_grassland" })
    expect(stock?.a_density_sa).toEqual({ value: 0.6, source: "default_soil_type" })
  })
})
