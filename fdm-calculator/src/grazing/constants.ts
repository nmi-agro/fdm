/**
 * Agronomic constants and reference values for grazing management in the Netherlands.
 *
 * References:
 * - Handboek Melkveehouderij 2023-2024 (Wageningen Livestock Research), chapter 3 "Grasland en
 *   voedergewassen": §3.9 Grasgroei (tables 3.7 and 3.8) and §3.10 Graslandgebruik.
 * - Stichting Weidegang, "Nieuw Nederlands Weiden - Eenvoudig, goed weiden".
 * - Groen Kennisnet, "4.1.1 Graslandbeheer en beweidingssystemen".
 * - Weidemelk definition (120 days x 6 hours) of the Convenant Weidegang / ZuivelNL.
 *
 * Values that are not stated in these sources are marked as assumptions.
 */

/**
 * Weidemelk criteria: at least 120 days of grazing with at least 6 hours per day for the dairy
 * cows (category RVO 100). This constant is the number of days.
 * Source: Weidemelk definition of the Convenant Weidegang / ZuivelNL.
 */
export const WEIDEMELK_TARGET_DAYS = 120

/** Weidemelk: the least grazing hours a day must have to count; see `WEIDEMELK_TARGET_DAYS`. */
export const WEIDEMELK_MIN_HOURS_PER_DAY = 6

/** Weidemelk: the animal category whose grazing counts (dairy cows, RVO 100). */
export const WEIDEMELK_CATEGORY_CODE = "rvo_100"

/**
 * Grass on offer at in-grazing (inscharen) for a grazing cut (kg DM/ha).
 * Source: Handboek Melkveehouderij §3.10.2 (omweiden: inscharen bij 1.700 kg ds/ha) and Table 3.8
 * (streefopbrengst weidesnede 1.700 kg ds/ha).
 */
export const INSCHAREN_DRY_MATTER_TARGET_KG_HA = 1700

/**
 * Regrowth of grass on offer per day of grazing (kg DM/ha/day), added to the grass on offer at
 * in-grazing. Regrowth during grazing is about half the undisturbed growth.
 * Source: Handboek Melkveehouderij §3.9.2 ("Tel per dag beweiding dus respectievelijk 50 of 45 kg
 * droge stof per hectare op bij het aanbod op het moment van inscharen", at 400 or 300 kg N/ha per
 * year). The value for 300 kg N/ha is used.
 */
export const GROWTH_DURING_GRAZING_KG_DM_HA_DAY = 45

/**
 * Indicative thresholds to label the stocking density on the grazing platform (GVE/ha):
 * below 2,0 extensief, 2,0 to 2,6 gemiddeld, above 2,6 intensief.
 * Assumption: there is no official classification into extensive and intensive grazing in GVE/ha;
 * these thresholds are indicative and not taken from the sources above.
 */
export const STOCKING_DENSITY_BENCHMARKS = {
  extensiveMax: 2.0,
  averageMax: 2.6,
} as const

/**
 * Grazing systems with default period and grazing hours, used to plan grazing.
 * Source: Handboek Melkveehouderij §3.10.2 (Handleiding Weiden of Opstallen) for the systems and
 * their periods; Stichting Weidegang, "Nieuw Nederlands Weiden - Eenvoudig, goed weiden" and
 * Groen Kennisnet, "4.1.1 Graslandbeheer en beweidingssystemen" for Nieuw Nederlands Weiden.
 * Assumption: 8 grazing hours per day as the default for all systems (limited grazing); adjust it
 * per farm.
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
    description: "Standweiden in blokken; na drie tot zes weken naar het volgende blok",
    // Handboek §3.10.2: "De dieren worden na drie tot zes weken verplaatst naar het volgende blok"
    defaultPeriodDays: 21,
    defaultHoursPerDay: 8,
    grazingType: "full" as const,
    requiresGrazingRecords: true,
  },
  nieuw_nederlands_weiden: {
    name: "Nieuw Nederlands Weiden",
    description: "Elke dag een nieuw perceel van gelijke grootte op het weideplatform",
    // NNW brochure: the platform is divided into fields of equal size and the cows get a new field
    // every day. The rotation over blocks of fields (Groen Kennisnet) is not part of the plan.
    defaultPeriodDays: 1,
    defaultHoursPerDay: 8,
    grazingType: "full" as const,
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
 * Size of a plot per cow (ha) when the home plot is divided into plots of equal size for Nieuw
 * Nederlands Weiden: every example divides the home plot into plots of 2,5 ha for 120 cows.
 * Assumption: the plot size scales with the number of cows.
 * Source: Stichting Weidegang, "Nieuw Nederlands Weiden - Eenvoudig, goed weiden" ("Bij elk
 * voorbeeld gaan we uit van 120 koeien en verdelen we de huiskavel in percelen van 2,5 hectare").
 */
export const NNW_PLOT_AREA_HA_PER_COW = 2.5 / 120

/**
 * Grazing hours per day above which the cows graze day and night and get a new plot in the
 * morning and in the evening.
 * Source: Stichting Weidegang, "Nieuw Nederlands Weiden - Eenvoudig, goed weiden", example XL
 * ("Dag en nacht weiden > 12 uur", "Ochtend en avond een nieuw perceel").
 */
export const NNW_DAY_AND_NIGHT_HOURS = 12

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
