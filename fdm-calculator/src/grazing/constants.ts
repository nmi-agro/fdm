/**
 * Standard agronomic constants and benchmarks for grazing management in the Netherlands.
 *
 * References:
 * - Handboek Melkveehouderij (Wageningen Livestock Research), Chapter 3:
 *   "Grasland en voedergewassen", §3.9 Grasgroei and §3.10 Graslandgebruik.
 * - Stichting Weidegang guidelines (Weidemelk criteria 120 days x 6 hours).
 * - Statutory GVE / RVO animal categories (Tabel 4 & Tabel 6).
 */

/**
 * Benchmark rest period threshold in days during the growing season.
 * If a grassland parcel is grazed or mown again within fewer than 14 days,
 * an advisory alert is generated.
 * Source: Handboek Melkveehouderij §3.10.2 & §3.10.3.
 */
export const REST_PERIOD_THRESHOLD_DAYS = 14

/**
 * Start of the active grassland growing season (15 February).
 * Source: Handboek Melkveehouderij §3.9.1 & statutory fertilization windows.
 */
export const GROWING_SEASON_START_MONTH = 1 // 0-based month (February)
export const GROWING_SEASON_START_DAY = 15

/**
 * Statutory and industry standard Weidemelk criteria:
 * Minimum 120 days of outdoor grazing with at least 6 hours of grazing per day
 * for all dairy and milking cows (category RVO 100).
 * Source: Stichting Weidegang / ZuivelNL.
 */
export const WEIDEMELK_TARGET_DAYS = 120
export const WEIDEMELK_MIN_HOURS_PER_DAY = 6
export const WEIDEMELK_CATEGORY_CODE = "rvo_100"

/**
 * Typical target dry matter yield to aim for at in-grazing (inscharen).
 * As a rule of thumb, ± 1.700 kg DM/ha is targeted for fresh pasture.
 * Source: Handboek Melkveehouderij §3.10.2.
 */
export const INSCHAREN_DRY_MATTER_TARGET_KG_HA = 1700

/**
 * Livestock density benchmarks on grassland (GVE / ha):
 * - < 2.0 GVE/ha: Extensive (extensief)
 * - 2.0 - 2.6 GVE/ha: Average (gemiddeld)
 * - > 2.6 GVE/ha: Intensive (intensief)
 * Source: Handboek Melkveehouderij §3.10 & Agrimatie / LMM monitoring.
 */
export const STOCKING_DENSITY_BENCHMARKS = {
  extensiveMax: 2.0,
  averageMax: 2.6,
} as const

/**
 * System specifications and defaults for Dutch grazing systems.
 * Source: Handboek Melkveehouderij §3.10.2 (Handleiding Weiden of Opstallen).
 */
export const GRAZING_SYSTEMS = {
  omweiden: {
    name: "Omweiden",
    description: "Steeds een nieuw perceel na enkele dagen",
    defaultPeriodDays: 4,
    defaultHoursPerDay: 8,
    grazingType: "full" as const,
    requiresGrazingRecords: true,
  },
  standweiden: {
    name: "Standweiden",
    description: "Continu weiden op één vast perceel of blok",
    defaultPeriodDays: 21,
    defaultHoursPerDay: 8,
    grazingType: "full" as const,
    requiresGrazingRecords: true,
  },
  modern_standweiden: {
    name: "Modern standweiden",
    description: "Roterend standweiden / Nieuw Nederlands Weiden op deelblokken van het perceel",
    defaultPeriodDays: 14,
    defaultHoursPerDay: 8,
    grazingType: "partial" as const,
    requiresGrazingRecords: true,
  },
  stripgrazen: {
    name: "Stripgrazen",
    description: "Elke dag een nieuwe strook vers gras",
    defaultPeriodDays: 1,
    defaultHoursPerDay: 8,
    grazingType: "partial" as const,
    requiresGrazingRecords: true,
  },
  rantsoenbeweiding: {
    name: "Rantsoenbeweiding",
    description: "Nieuwe strook aansluitend op het vorige land",
    defaultPeriodDays: 1,
    defaultHoursPerDay: 8,
    grazingType: "partial" as const,
    requiresGrazingRecords: true,
  },
  zomerstalvoedering: {
    name: "Zomerstalvoedering",
    description: "Geen weidegang; vers gras op stal gevoerd",
    defaultPeriodDays: 0,
    defaultHoursPerDay: 0,
    grazingType: null,
    requiresGrazingRecords: false,
    normConsequence: "geheel_maaien",
  },
  summerfeeding: {
    name: "Summerfeeding",
    description: "Geen weidegang; kuilvoerrantsoen op stal",
    defaultPeriodDays: 0,
    defaultHoursPerDay: 0,
    grazingType: null,
    requiresGrazingRecords: false,
    normConsequence: "geheel_maaien",
  },
} as const

export type GrazingSystemKey = keyof typeof GRAZING_SYSTEMS
