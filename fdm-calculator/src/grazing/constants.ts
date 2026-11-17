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

/**
 * Total daily roughage intake per dairy cow (kg DM/day) that the Nieuw Nederlands Weiden examples
 * assume. Grass from the pasture covers part of it; the rest is supplemented as roughage.
 * Source: Stichting Weidegang, "Nieuw Nederlands Weiden - Eenvoudig, goed weiden", example XL
 * ("Deze berekening geldt bij een totale opname 15 kg ds opname uit ruwvoer per dag").
 */
export const NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM = 15

/**
 * Reference values for the average daily grass growth in the Netherlands (kg DM/ha/day) in spring,
 * summer and autumn. The growth curve peaks around 80 in late April and May, is around 60 in summer
 * and around 40 in September.
 * Source: Stichting Weidegang, "Nieuw Nederlands Weiden - Eenvoudig, goed weiden",
 * "Gemiddelde grasgroei in Nederland". The split into three seasons is a simplification of that curve.
 */
export const GRASS_GROWTH_REFERENCE_KG_DM_HA_DAY = {
  voorjaar: 80,
  zomer: 60,
  najaar: 40,
} as const

export type GrassGrowthSeason = keyof typeof GRASS_GROWTH_REFERENCE_KG_DM_HA_DAY

/**
 * Minimum number of grazing hours per kg DM grass intake: tune the grazing hours to the intake from
 * the pasture.
 * Source: Stichting Weidegang, "Nieuw Nederlands Weiden - Eenvoudig, goed weiden"
 * ("minimaal 1 uur per kg droge stof").
 */
export const GRAZING_HOURS_PER_KG_DM_MIN = 1

/**
 * Sward height (cm) at in-grazing (inscharen) and out-grazing (uitscharen) per grazing system.
 * Source: Groen Kennisnet, "4.1.1 Graslandbeheer en beweidingssystemen".
 */
export const SWARD_HEIGHT_CM = {
  omweiden: { inscharen: [17, 17], uitscharen: [6, 6] },
  stripgrazen: { inscharen: [18, 20], uitscharen: [6, 6] },
  nieuw_nederlands_weiden: { inscharen: [10, 12], uitscharen: [9, 11] },
} as const

/**
 * Sward height (cm) at out-grazing that signals the supplementation is off: above the upper value
 * feed less, below the lower value feed more.
 * Source: Stichting Weidegang, "Nieuw Nederlands Weiden - Eenvoudig, goed weiden".
 */
export const UITSCHAREN_SUPPLEMENTATION_SIGNAL_CM = { lower: 8, upper: 12 } as const
