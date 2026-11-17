import { describe, expect, it } from "vitest"
import {
  calculateGrazingAllocationArea,
  calculatePlatformArea,
  estimateGrassIntake,
} from "./allocation"
import { GRASS_GROWTH_REFERENCE_KG_DM_HA_DAY } from "./constants"

describe("calculateGrazingAllocationArea", () => {
  it("calculates the area for one day with the default grass on offer and regrowth", () => {
    // 100 cows x 10 kg DM = 1.000 kg DM; offer 1.700 + 45 x 1 = 1.745 kg DM/ha; 0,57 ha
    expect(
      calculateGrazingAllocationArea({ animals: 100, grassIntakeKgDmPerAnimalPerDay: 10 }),
    ).toEqual({ areaHa: 0.57, grassDemandKgDm: 1000, grassOnOfferKgDmPerHa: 1745 })
  })

  it("adds the regrowth of every grazing day to the grass on offer", () => {
    // Omweiden: 4 days on a plot with 2.000 kg DM/ha; offer 2.000 + 4 x 45 = 2.180 kg DM/ha
    const result = calculateGrazingAllocationArea({
      animals: 80,
      grassIntakeKgDmPerAnimalPerDay: 12,
      availableGrassKgDmPerHa: 2000,
      days: 4,
    })
    expect(result.grassDemandKgDm).toBe(3840)
    expect(result.grassOnOfferKgDmPerHa).toBe(2180)
    expect(result.areaHa).toBe(1.76)
  })

  it("ignores regrowth when it is set to 0", () => {
    const result = calculateGrazingAllocationArea({
      animals: 100,
      grassIntakeKgDmPerAnimalPerDay: 10,
      growthDuringGrazingKgDmPerHaPerDay: 0,
    })
    expect(result.areaHa).toBe(0.59)
  })

  it("rejects invalid input", () => {
    expect(() =>
      calculateGrazingAllocationArea({
        animals: 10,
        grassIntakeKgDmPerAnimalPerDay: 10,
        availableGrassKgDmPerHa: 0,
      }),
    ).toThrow("availableGrassKgDmPerHa")
    expect(() =>
      calculateGrazingAllocationArea({ animals: -1, grassIntakeKgDmPerAnimalPerDay: 10 }),
    ).toThrow("animals")
  })
})

describe("estimateGrassIntake", () => {
  it.each([
    ["voorjaar", 1600, 13.3, 1.7],
    ["zomer", 1200, 10, 5],
    ["najaar", 800, 6.7, 8.3],
  ] as const)(
    "matches the Nieuw Nederlands Weiden example XL in %s",
    (season, available, intake, supplementation) => {
      const result = estimateGrassIntake({
        animals: 120,
        platformAreaHa: 20,
        growthKgDmPerHaPerDay: GRASS_GROWTH_REFERENCE_KG_DM_HA_DAY[season],
      })
      expect(result.grassAvailableKgDmPerDay).toBe(available)
      expect(result.grassIntakeKgDmPerAnimal).toBe(intake)
      expect(result.supplementationKgDmPerAnimal).toBe(supplementation)
      expect(result.minGrazingHoursPerDay).toBe(intake)
    },
  )

  it("caps the grass intake at the total roughage intake", () => {
    const result = estimateGrassIntake({
      animals: 10,
      platformAreaHa: 20,
      growthKgDmPerHaPerDay: 80,
    })
    expect(result.grassIntakeKgDmPerAnimal).toBe(15)
    expect(result.supplementationKgDmPerAnimal).toBe(0)
  })

  it("rejects a herd without animals", () => {
    expect(() =>
      estimateGrassIntake({ animals: 0, platformAreaHa: 20, growthKgDmPerHaPerDay: 80 }),
    ).toThrow("animals")
  })
})

describe("calculatePlatformArea", () => {
  it("is the inverse of estimateGrassIntake", () => {
    // 120 cows x 13,33 kg DM / 80 kg DM/ha/day = 20 ha
    expect(
      calculatePlatformArea({
        animals: 120,
        grassIntakeKgDmPerAnimalPerDay: 1600 / 120,
        growthKgDmPerHaPerDay: 80,
      }),
    ).toBe(20)
  })

  it("rejects a growth of 0", () => {
    expect(() =>
      calculatePlatformArea({
        animals: 120,
        grassIntakeKgDmPerAnimalPerDay: 10,
        growthKgDmPerHaPerDay: 0,
      }),
    ).toThrow("growthKgDmPerHaPerDay")
  })
})
