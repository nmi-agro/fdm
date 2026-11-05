import { describe, expect, it } from "vitest"
import { calculatePhosphateSaturation, calculatePhosphateSaturationThreshold } from "./saturation"

describe("calculatePhosphateSaturation sources", () => {
  it("should report the source of P-AL separately from the source of the PSD", () => {
    const result = calculatePhosphateSaturation(
      [
        {
          a_p_al: 37,
          a_source: "nl-rva-l122",
          b_sampling_date: new Date("2025-03-01"),
          b_soiltype_agr: "dekzand",
        },
        {
          a_p_ox: 12,
          a_fe_ox: 29,
          a_al_ox: 36,
          a_source: "nl-other-nmi",
          b_sampling_date: new Date("2024-01-01"),
        },
      ],
      false,
    )
    expect(result.analysis_sources).toEqual(["nl-other-nmi"])
    expect(result.a_p_al_source).toBe("nl-rva-l122")
  })
})

describe("calculatePhosphateSaturation", () => {
  it("should calculate the PSD from the oxalate data with alpha_max 0.5 and no range", () => {
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
    expect(result.alpha_max).toBe(0.5)
    expect(result.psc).toBeCloseTo(32.5)
    expect(result.psd?.value).toBeCloseTo((12 / 32.5) * 100)
    expect(result.psd?.min).toBe(result.psd?.value)
    expect(result.psd?.max).toBe(result.psd?.value)
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
      [{ a_p_sg: 30, a_fe_ox: 40, a_al_ox: 40, b_soiltype_agr: "rivierklei" }],
      false,
    )
    expect(result.source).toBe("a_p_sg")
    expect(result.psd?.value).toBe(30)
    expect(result.a_p_ox).toBeCloseTo(0.3 * 40)
  })

  it("should not estimate the PSD from P-AL", () => {
    const result = calculatePhosphateSaturation([{ a_p_al: 40, b_soiltype_agr: "dekzand" }], false)
    expect(result.source).toBe("missing")
    expect(result.psd).toBeNull()
    expect(result.a_p_al).toBe(40)
  })

  it("should calculate the PSD on calcareous sand but add a warning", () => {
    const result = calculatePhosphateSaturation(
      [{ a_p_ox: 5, a_fe_ox: 10, a_al_ox: 10, b_soiltype_agr: "duinzand" }],
      true,
    )
    expect(result.source).toBe("oxalate")
    expect(result.psd_valid).toBe(false)
    expect(result.warnings.length).toBe(1)
  })

  it("should not divide by zero when Fe-ox and Al-ox are 0", () => {
    const result = calculatePhosphateSaturation([{ a_p_ox: 5, a_fe_ox: 0, a_al_ox: 0 }], false)
    expect(result.source).toBe("missing")
    expect(result.psd).toBeNull()
    expect(result.warnings.join(" ")).toMatch(/Fe-ox \+ Al-ox is nul/)
  })

  it("should report a missing PSD without data", () => {
    const result = calculatePhosphateSaturation([{ b_soiltype_agr: "zeeklei" }], true)
    expect(result.source).toBe("missing")
    expect(result.psd).toBeNull()
  })
})

describe("calculatePhosphateSaturationThreshold", () => {
  const soil = [
    {
      a_p_ox: 12,
      a_fe_ox: 29,
      a_al_ox: 36,
      a_p_cc: 3,
      b_gwl_class: "IIIa" as const,
      b_soiltype_agr: "dekzand" as const,
    },
  ]

  it("should calculate the environmental threshold of van Doorn (Eq. 5.5) for a wet sandy field", () => {
    const saturation = calculatePhosphateSaturation(soil, false)
    const threshold = calculatePhosphateSaturationThreshold(saturation, soil)
    expect(threshold.source).toBe("field")
    expect(threshold.ghg).toBe(15)
    expect(threshold.c_p_env).toBeCloseTo(0.1)
    // PSD about 37%, P-CaCl2 3 mg/kg: KL about 20 m³/mol, threshold about 17%
    expect(threshold.psd_env).toBeGreaterThan(15)
    expect(threshold.psd_env).toBeLessThan(19)
    expect(threshold.value).toBe(threshold.psd_env)
  })

  it("should give a higher threshold with a deeper groundwater level", () => {
    const dry = [{ ...soil[0], b_gwl_class: "VII" as const }]
    const saturation = calculatePhosphateSaturation(dry, false)
    const threshold = calculatePhosphateSaturationThreshold(saturation, dry)
    expect(threshold.c_p_env).toBeCloseTo(0.3)
    expect(threshold.psd_env).toBeGreaterThan(30)
  })

  it("should interpolate the critical concentration between 25 and 100 cm", () => {
    const medium = [{ ...soil[0], b_gwl_class: "VI" as const }]
    const saturation = calculatePhosphateSaturation(medium, false)
    const threshold = calculatePhosphateSaturationThreshold(saturation, medium)
    expect(threshold.ghg).toBe(60)
    expect(threshold.c_p_env).toBeCloseTo(0.1 + (0.2 * 35) / 75)
  })

  it("should fall back to 25% without P-CaCl2", () => {
    const noCc = [{ ...soil[0], a_p_cc: undefined }]
    const saturation = calculatePhosphateSaturation(noCc, false)
    const threshold = calculatePhosphateSaturationThreshold(saturation, noCc)
    expect(threshold.source).toBe("default_25")
    expect(threshold.value).toBe(25)
  })
})
