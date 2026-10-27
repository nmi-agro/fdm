import { describe, expect, it } from "vitest"
import { phosphateSoilTypeParameters } from "./alpha-max"
import { calculatePhosphateSaturation, estimatePsdFromPAl } from "./saturation"

describe("calculatePhosphateSaturation", () => {
  it("should calculate the PSD from the oxalate data of one soil analysis", () => {
    const result = calculatePhosphateSaturation(
      [
        {
          a_source: "nl-other-nmi",
          b_sampling_date: new Date("2025-03-01"),
          a_p_ox: 12,
          a_fe_ox: 29,
          a_al_ox: 36,
          b_soiltype_agr: "dekzand",
        },
      ],
      false,
    )
    expect(result.source).toBe("oxalate")
    expect(result.analysis_sources).toEqual(["nl-other-nmi"])
    expect(result.psc?.value).toBeCloseTo(32.5)
    expect(result.psd?.value).toBeCloseTo((12 / 32.5) * 100)
    // alpha_max 0.4–0.6 gives the range
    expect(result.psd?.min).toBeCloseTo((12 / (0.6 * 65)) * 100)
    expect(result.psd?.max).toBeCloseTo((12 / (0.4 * 65)) * 100)
    expect(result.warnings).toEqual([])
  })

  it("should prefer the most recent analysis with the complete oxalate triplet", () => {
    const result = calculatePhosphateSaturation(
      [
        { b_sampling_date: new Date("2020-01-01"), a_p_ox: 5, a_fe_ox: 50, a_al_ox: 50 },
        { b_sampling_date: new Date("2024-01-01"), a_p_ox: 10, a_fe_ox: 50, a_al_ox: 50 },
        { b_sampling_date: new Date("2025-01-01"), a_p_ox: 99 },
      ],
      false,
    )
    expect(result.a_p_ox).toBe(10)
  })

  it("should use a_p_sg when the oxalate triplet is incomplete", () => {
    const result = calculatePhosphateSaturation(
      [{ a_p_sg: 30, a_fe_ox: 40, a_al_ox: 40, b_soiltype_agr: "zeeklei" }],
      false,
    )
    expect(result.source).toBe("a_p_sg")
    expect(result.psd?.value).toBe(30)
    expect(result.a_p_ox).toBeCloseTo(0.3 * 40)
  })

  it("should estimate the PSD from P-AL with the soil-type default PSC when nothing else is available", () => {
    const result = calculatePhosphateSaturation([{ a_p_al: 40, b_soiltype_agr: "dekzand" }], false)
    const defaults = phosphateSoilTypeParameters.dekzand
    const psc = 0.5 * (defaults.a_fe_ox_default[1] + defaults.a_al_ox_default[1])
    expect(result.source).toBe("estimated_from_p_al")
    expect(result.psd?.value).toBeCloseTo(estimatePsdFromPAl(40, psc))
    expect(result.warnings.length).toBe(2)
  })

  it("should report a missing PSD and flag calcareous sand", () => {
    const result = calculatePhosphateSaturation([{ b_soiltype_agr: "duinzand" }], true)
    expect(result.source).toBe("missing")
    expect(result.psd).toBeNull()
    expect(result.psd_valid).toBe(false)
  })
})

describe("estimatePsdFromPAl", () => {
  it("should reproduce the example of van Doorn (2026): P-AL 30 and PSC 80 give about 25%", () => {
    expect(estimatePsdFromPAl(30, 80)).toBeCloseTo(25.2, 0)
  })
})
