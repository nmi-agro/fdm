import { describe, expect, it } from "vitest"
import {
  animalSexOptions,
  animalSpeciesOptions,
  arrivingMethodOptions,
  feedOriginOptions,
  feedTypeOptions,
  grazingTypeOptions,
  leavingMethodOptions,
} from "./schema"

describe("Livestock Schema Options Arrays", () => {
  const optionArrays = [
    animalSexOptions,
    animalSpeciesOptions,
    arrivingMethodOptions,
    leavingMethodOptions,
    feedTypeOptions,
    feedOriginOptions,
    grazingTypeOptions,
  ]

  it("defines non-empty option arrays with value and label", () => {
    for (const arr of optionArrays) {
      expect(arr.length).toBeGreaterThan(0)
      for (const item of arr) {
        expect(typeof item.value).toBe("string")
        expect(typeof item.label).toBe("string")
      }
    }
  })

  it("has unique values within each option array", () => {
    for (const arr of optionArrays) {
      const values = arr.map((item) => item.value)
      expect(new Set(values).size).toBe(values.length)
    }
  })
})
