import {
  GRAZING_HOURS_PER_KG_DM_MIN,
  INSCHAREN_DRY_MATTER_TARGET_KG_HA,
  NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM,
} from "./constants"

/**
 * Input for {@link calculateGrazingAllocationArea}.
 */
export interface GrazingAllocationInput {
  /** Number of animals in the herd. */
  animals: number
  /** Grass intake from the pasture per animal per day (kg DM). */
  grassIntakeKgDmPerAnimalPerDay: number
  /**
   * Grass on offer per hectare at in-grazing (kg DM/ha). Defaults to
   * {@link INSCHAREN_DRY_MATTER_TARGET_KG_HA} (1.700 kg DM/ha).
   */
  availableGrassKgDmPerHa?: number
  /** Number of days the herd stays on the allocated area. Defaults to 1. */
  days?: number
}

/**
 * Result of {@link calculateGrazingAllocationArea}.
 */
export interface GrazingAllocationResult {
  /** Area to allocate to the herd (ha). */
  areaHa: number
  /** Grass the herd takes up from the allocated area (kg DM). */
  grassDemandKgDm: number
}

/**
 * Calculates the pasture area to allocate to a herd for a number of days, for example the size of a
 * strip (stripgrazen), a daily plot (Nieuw Nederlands Weiden) or a plot for omweiden:
 *
 * area (ha) = animals × grass intake per animal per day (kg DM) × days ÷ grass on offer (kg DM/ha)
 *
 * Assumption: all grass on offer at in-grazing is available to the herd. Grass left behind at
 * out-grazing is not subtracted, so pass a lower `availableGrassKgDmPerHa` to allow for it. The
 * default of 1.700 kg DM/ha is the in-grazing target for omweiden in the Handboek Melkveehouderij
 * §3.10.2.
 *
 * @param input - Herd size, grass intake, grass on offer and number of days.
 * @returns The area to allocate (ha) and the grass demand (kg DM).
 * @throws {Error} If a value is negative, or the grass on offer is not positive.
 */
export function calculateGrazingAllocationArea(
  input: GrazingAllocationInput,
): GrazingAllocationResult {
  const {
    animals,
    grassIntakeKgDmPerAnimalPerDay,
    availableGrassKgDmPerHa = INSCHAREN_DRY_MATTER_TARGET_KG_HA,
    days = 1,
  } = input
  assertNonNegative({ animals, grassIntakeKgDmPerAnimalPerDay, days })
  if (!(availableGrassKgDmPerHa > 0)) {
    throw new Error("availableGrassKgDmPerHa must be greater than 0")
  }

  const grassDemandKgDm = animals * grassIntakeKgDmPerAnimalPerDay * days
  return {
    areaHa: round(grassDemandKgDm / availableGrassKgDmPerHa, 2),
    grassDemandKgDm: round(grassDemandKgDm, 1),
  }
}

/**
 * Input for {@link estimateGrassIntake}.
 */
export interface GrassIntakeInput {
  /** Number of animals grazing on the platform. */
  animals: number
  /** Area of the grazing platform (ha). */
  platformAreaHa: number
  /** Daily grass growth (kg DM/ha/day), for example from {@link GRASS_GROWTH_REFERENCE_KG_DM_HA_DAY}. */
  growthKgDmPerHaPerDay: number
  /**
   * Total daily roughage intake per animal (kg DM). Defaults to
   * {@link NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM} (15 kg DM).
   */
  totalRoughageIntakeKgDmPerAnimal?: number
}

/**
 * Result of {@link estimateGrassIntake}.
 */
export interface GrassIntakeResult {
  /** Grass growing on the platform per day (kg DM). */
  grassAvailableKgDmPerDay: number
  /** Grass intake from the pasture per animal per day (kg DM). */
  grassIntakeKgDmPerAnimal: number
  /** Roughage to supplement per animal per day (kg DM). */
  supplementationKgDmPerAnimal: number
  /** Minimum grazing hours per day for this grass intake. */
  minGrazingHoursPerDay: number
}

/**
 * Estimates how much of the daily roughage a herd can take up from its grazing platform, following
 * Nieuw Nederlands Weiden: the herd grazes what grows on the platform each day, and the rest of the
 * roughage intake is supplemented.
 *
 * - grass available per day = growth (kg DM/ha/day) × platform area (ha)
 * - grass intake per animal = min(total roughage intake, grass available ÷ animals)
 * - supplementation per animal = total roughage intake − grass intake
 * - minimum grazing hours = grass intake × 1 hour per kg DM
 *
 * Example (Nieuw Nederlands Weiden, XL): 120 cows on a 20 ha platform with a growth of 80, 60 or
 * 40 kg DM/ha/day take up 13,3, 10,0 or 6,7 kg DM grass and get 1,7, 5,0 or 8,3 kg DM roughage.
 *
 * @param input - Herd size, platform area, grass growth and total roughage intake.
 * @returns The grass available, grass intake and supplementation, and the minimum grazing hours.
 * @throws {Error} If a value is negative, or the herd has no animals.
 */
export function estimateGrassIntake(input: GrassIntakeInput): GrassIntakeResult {
  const {
    animals,
    platformAreaHa,
    growthKgDmPerHaPerDay,
    totalRoughageIntakeKgDmPerAnimal = NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM,
  } = input
  assertNonNegative({ platformAreaHa, growthKgDmPerHaPerDay, totalRoughageIntakeKgDmPerAnimal })
  if (!(animals > 0)) {
    throw new Error("animals must be greater than 0")
  }

  const grassAvailableKgDmPerDay = growthKgDmPerHaPerDay * platformAreaHa
  const grassIntake = Math.min(totalRoughageIntakeKgDmPerAnimal, grassAvailableKgDmPerDay / animals)
  return {
    grassAvailableKgDmPerDay: round(grassAvailableKgDmPerDay, 1),
    grassIntakeKgDmPerAnimal: round(grassIntake, 1),
    supplementationKgDmPerAnimal: round(totalRoughageIntakeKgDmPerAnimal - grassIntake, 1),
    minGrazingHoursPerDay: round(grassIntake * GRAZING_HOURS_PER_KG_DM_MIN, 1),
  }
}

/**
 * Input for {@link calculatePlatformArea}.
 */
export interface PlatformAreaInput {
  /** Number of animals grazing on the platform. */
  animals: number
  /** Intended grass intake from the pasture per animal per day (kg DM). */
  grassIntakeKgDmPerAnimalPerDay: number
  /** Daily grass growth (kg DM/ha/day). */
  growthKgDmPerHaPerDay: number
}

/**
 * Calculates the grazing platform needed for an intended grass intake, the inverse of
 * {@link estimateGrassIntake}: area (ha) = animals × grass intake ÷ growth.
 *
 * @param input - Herd size, intended grass intake and grass growth.
 * @returns The platform area (ha).
 * @throws {Error} If a value is negative, or the growth is not positive.
 */
export function calculatePlatformArea(input: PlatformAreaInput): number {
  const { animals, grassIntakeKgDmPerAnimalPerDay, growthKgDmPerHaPerDay } = input
  assertNonNegative({ animals, grassIntakeKgDmPerAnimalPerDay })
  if (!(growthKgDmPerHaPerDay > 0)) {
    throw new Error("growthKgDmPerHaPerDay must be greater than 0")
  }
  return round((animals * grassIntakeKgDmPerAnimalPerDay) / growthKgDmPerHaPerDay, 2)
}

function assertNonNegative(values: Record<string, number>): void {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${name} must be a number of at least 0`)
    }
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
