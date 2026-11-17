import { describe, expect, it } from "vitest"
import { calculateNitrogenEmissionViaNitrousOxideBySoil } from "./soil"

const oneYear = { start: new Date("2025-01-01"), end: new Date("2025-12-31") }

describe("calculateNitrogenEmissionViaNitrousOxideBySoil", () => {
  it("returns the yearly emission for peat and peaty soil, as a negative value", () => {
    expect(
      calculateNitrogenEmissionViaNitrousOxideBySoil(
        { b_soiltype_agr: "veen" },
        oneYear,
      ).total.toNumber(),
    ).toBeCloseTo(-4.67, 5)
    expect(
      calculateNitrogenEmissionViaNitrousOxideBySoil(
        { b_soiltype_agr: "moerige_klei" },
        oneYear,
      ).total.toNumber(),
    ).toBeCloseTo(-4.09, 5)
  })

  it("returns zero for mineral soils and unknown soil types", () => {
    for (const b_soiltype_agr of ["dekzand", "rivierklei", null]) {
      const result = calculateNitrogenEmissionViaNitrousOxideBySoil(
        { b_soiltype_agr: b_soiltype_agr as never },
        oneYear,
      )
      expect(result.total.isZero()).toBe(true)
    }
  })

  it("scales the yearly emission to the length of the time frame", () => {
    const halfYear = { start: new Date("2025-01-01"), end: new Date("2025-07-01") }
    expect(
      calculateNitrogenEmissionViaNitrousOxideBySoil(
        { b_soiltype_agr: "veen" },
        halfYear,
      ).total.toNumber(),
    ).toBeCloseTo((-4.67 * 182) / 365, 5)
    const threeYears = { start: new Date("2023-01-01"), end: new Date("2025-12-31") }
    expect(
      calculateNitrogenEmissionViaNitrousOxideBySoil(
        { b_soiltype_agr: "veen" },
        threeYears,
      ).total.toNumber(),
    ).toBeCloseTo((-4.67 * 1096) / 365, 5)
  })

  it("returns zero for an empty time frame", () => {
    const empty = { start: new Date("2025-07-01"), end: new Date("2025-01-01") }
    expect(
      calculateNitrogenEmissionViaNitrousOxideBySoil(
        { b_soiltype_agr: "veen" },
        empty,
      ).total.isZero(),
    ).toBe(true)
  })
})
