import { describe, expect, it } from "vitest"
import {
  getPhosphateSoilTypeParameters,
  ghgPerGroundwaterClass,
  ghgRangePerGroundwaterClass,
  phosphateSoilTypeParameters,
} from "./alpha-max"

const soilTypes = Object.keys(
  phosphateSoilTypeParameters,
) as (keyof typeof phosphateSoilTypeParameters)[]

describe("phosphateSoilTypeParameters", () => {
  it.each(soilTypes)("should have a consistent P-AL buffer and defaults for %s", (soilType) => {
    const params = phosphateSoilTypeParameters[soilType]
    const [central, low, high] = params.p_al_buffer
    expect(low).toBeLessThanOrEqual(central)
    expect(central).toBeLessThanOrEqual(high)
    // kg P2O5 / ha per P-AL unit in 0–25 cm: between 40 (peat) and 70 (sand)
    expect(low).toBeGreaterThanOrEqual(40)
    expect(high).toBeLessThanOrEqual(70)
    expect(params.alpha_max).toBe(0.5)
    expect(params.a_density_sa_default).toBeGreaterThan(0)
    // No fallback Fe-ox and Al-ox: they come from a soil analysis or the NMI estimate
    expect(params).not.toHaveProperty("a_fe_ox_default")
    expect(params).not.toHaveProperty("a_al_ox_default")
  })

  it("should use a fixation of 20 kg P2O5 / ha on mineral soils and none on peat", () => {
    for (const soilType of soilTypes) {
      expect(phosphateSoilTypeParameters[soilType].fixation).toBe(soilType === "veen" ? 0 : 20)
    }
  })

  it("should only mark the PSD as unreliable on calcareous dune sand", () => {
    const invalid = soilTypes.filter((s) => !phosphateSoilTypeParameters[s].psd_valid)
    expect(invalid).toEqual(["duinzand"])
  })

  it("should give a larger buffer on sand than on clay and peat", () => {
    const central = (s: keyof typeof phosphateSoilTypeParameters) =>
      phosphateSoilTypeParameters[s].p_al_buffer[0]
    expect(central("dekzand")).toBeGreaterThan(central("zeeklei"))
    expect(central("zeeklei")).toBeGreaterThan(central("veen"))
  })
})

describe("getPhosphateSoilTypeParameters", () => {
  it("should return the parameters of the soil type", () => {
    expect(getPhosphateSoilTypeParameters("rivierklei")).toBe(
      phosphateSoilTypeParameters.rivierklei,
    )
  })

  it("should fall back to dekzand with a note when the soil type is unknown", () => {
    const params = getPhosphateSoilTypeParameters(undefined)
    expect(params.p_al_buffer).toEqual(phosphateSoilTypeParameters.dekzand.p_al_buffer)
    expect(params.note).toMatch(/Grondsoort onbekend/)
    expect(getPhosphateSoilTypeParameters(null).note).toMatch(/Grondsoort onbekend/)
  })
})

describe("ghgPerGroundwaterClass", () => {
  it("should become deeper from wet to dry groundwater classes", () => {
    expect(ghgPerGroundwaterClass.I).toBeLessThan(ghgPerGroundwaterClass.IV)
    expect(ghgPerGroundwaterClass.IV).toBeLessThan(ghgPerGroundwaterClass.VII)
    expect(ghgPerGroundwaterClass.VII).toBeLessThan(ghgPerGroundwaterClass.VIII)
  })

  it("should give the b-classes a GHG of 25–40 cm", () => {
    for (const gt of ["IIb", "IIIb", "Vb", "Vbo", "Vbd"] as const) {
      expect(ghgPerGroundwaterClass[gt]).toBeGreaterThanOrEqual(25)
      expect(ghgPerGroundwaterClass[gt]).toBeLessThanOrEqual(40)
    }
  })

  it("should stay within the GHG range of every class", () => {
    for (const [gt, { min, max }] of Object.entries(ghgRangePerGroundwaterClass)) {
      const ghg = ghgPerGroundwaterClass[gt as keyof typeof ghgPerGroundwaterClass]
      expect(ghg).toBeGreaterThanOrEqual(min)
      expect(ghg).toBeLessThanOrEqual(max)
    }
  })

  it("should use the middle of a closed range and the lower bound of an open-ended range", () => {
    expect(ghgPerGroundwaterClass.I).toBe(10)
    expect(ghgPerGroundwaterClass.III).toBe(20)
    expect(ghgPerGroundwaterClass.VII).toBe(110)
    // Open-ended "c" classes and Gt VIII: the shallowest level of the class
    expect(ghgPerGroundwaterClass.Ic).toBe(25)
    expect(ghgPerGroundwaterClass.IIc).toBe(40)
    expect(ghgPerGroundwaterClass.IVc).toBe(80)
    expect(ghgPerGroundwaterClass.VIII).toBe(140)
  })
})
