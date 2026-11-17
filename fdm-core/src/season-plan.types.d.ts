import type * as schema from "./db/schema"

/**
 * The steps of the season planning wizard, in the order in which they are shown.
 *
 * - `start`: choose the target year and review the source of each field.
 * - `fields`: keep, drop or add fields for the target year.
 * - `cultivations`: record the main cultivation (hoofdteelt) of each field.
 * - `catch_crops`: record catch crops (vanggewassen) and green manures after the main cultivation.
 * - `measures`: review the measures that continue, expire or have ended.
 * - `fertilizers`: record the fertilizer applications of each field.
 * - `harvests`: record the expected harvests and review the plan.
 */
export type SeasonPlanStep =
  | "start"
  | "fields"
  | "cultivations"
  | "catch_crops"
  | "measures"
  | "fertilizers"
  | "harvests"

/** Crop rotation category of a cultivation in the cultivation catalogue. */
export type SeasonPlanCropRotation = NonNullable<
  schema.cultivationsCatalogueTypeSelect["b_lu_croprotation"]
>

/**
 * Rules used to plan a season. They contain the choices that may change from year to year, so
 * that a new year can be supported by adding a new entry instead of changing the planning logic.
 *
 * Legal requirements that need spatial data (such as the catch crop obligation on sand and loess
 * soils) are not part of these rules. They are evaluated by the caller and passed in through
 * {@link SeasonPlanOptions}.
 */
export interface SeasonPlanRules {
  /** The first year from which these rules apply. */
  rulesYear: number
  /** Number of years before the target year that are used as history (rotation, templates). */
  historyYears: number
  /** Rotation cycle lengths, in years, that are recognised in the history of a field. */
  rotationCycles: number[]
  /** Crop rotation categories that are not arable land, so no catch crop is asked for. */
  nonArableCropRotations: SeasonPlanCropRotation[]
  /** Crop rotation categories for which no fertilizer plan is expected. */
  unfertilizedCropRotations: SeasonPlanCropRotation[]
  /** Crop rotation categories that identify a catch crop or green manure. */
  catchCropRotations: SeasonPlanCropRotation[]
  /**
   * Minimum number of years between two main cultivations of the same crop rotation category,
   * used for rotation advice only. A value of 2 means "not in two consecutive years".
   * Categories that are not listed have no minimum.
   */
  minYearsBetween: Partial<Record<SeasonPlanCropRotation, number>>
}

/** The rules that apply to a target year. */
export interface ResolvedSeasonPlanRules extends SeasonPlanRules {
  /** `true` when no rules are defined for the target year itself and older rules are used. */
  provisional: boolean
}

/** Options for the season plan functions. */
export interface SeasonPlanOptions {
  /**
   * Returns whether a catch crop is legally required on a field in the target year. Fields
   * for which this returns `false` (the default) are not blocking, but a catch crop can still
   * be recorded.
   */
  isCatchCropRequired?: (b_id: string, targetYear: number) => boolean
  /** The moment used to determine the current year. Defaults to now. */
  now?: Date
}

/** Minimal field shape used by the season plan rules. */
export interface SeasonPlanField {
  b_id: string
  b_name: string
  b_start: Date | null
  b_end: Date | null
  b_bufferstrip: boolean
}

/** Minimal cultivation shape used by the season plan rules. */
export interface SeasonPlanCultivation {
  b_lu: string
  b_id: string
  b_lu_catalogue: string
  b_lu_name: string
  b_lu_croprotation: SeasonPlanCropRotation | null
  b_lu_harvestable: "none" | "once" | "multiple"
  b_lu_start: Date | null
  b_lu_end: Date | null
}

/** Minimal fertilizer application shape used by the season plan rules. */
export interface SeasonPlanFertilizerApplication {
  p_app_id: string
  p_id: string
  p_app_date: Date
}

/** Minimal harvest shape used by the season plan rules. */
export interface SeasonPlanHarvest {
  b_id_harvesting: string
  b_lu: string
  b_lu_harvest_date: Date | null
}

/** Minimal measure shape used by the season plan rules. */
export interface SeasonPlanMeasure {
  b_id_measure: string
  b_id: string
  m_id: string
  m_name: string
  m_start: Date | null
  m_end: Date | null
}

/** The farm data that the season plan rules are evaluated on. */
export interface SeasonPlanData {
  fields: SeasonPlanField[]
  /** Cultivations per field (`b_id`). */
  cultivations: Map<string, SeasonPlanCultivation[]>
  /** Fertilizer applications per field (`b_id`). */
  fertilizerApplications: Map<string, SeasonPlanFertilizerApplication[]>
  /** Harvests per cultivation (`b_lu`). */
  harvests: Map<string, SeasonPlanHarvest[]>
  /** Measures per field (`b_id`). */
  measures: Map<string, SeasonPlanMeasure[]>
}

/** Status of a field in the target year compared to the year before. */
export type SeasonPlanFieldStatus = "kept" | "new" | "dropped"

/** The progress of a single step. */
export interface SeasonPlanStepProgress {
  step: SeasonPlanStep
  /** `true` when nothing is open that blocks completion of the plan. */
  done: boolean
  /** IDs of the items that block completion (field IDs, or cultivation IDs for harvests). */
  pending: string[]
  /** IDs of items that do not block completion but should be shown to the user. */
  notices: string[]
}

/** The progress of the season plan of a farm for a target year. */
export interface SeasonPlanProgress {
  targetYear: number
  /** The rules year that was used. */
  rulesYear: number
  /** `true` when rules of an older year are used. */
  provisional: boolean
  /** `true` when the farm has data for the target year that differs from the year before. */
  started: boolean
  /** `true` when all steps are done. */
  complete: boolean
  /** The first step that is not done, or `null` when the plan is complete. */
  firstIncompleteStep: SeasonPlanStep | null
  steps: SeasonPlanStepProgress[]
  /** Status of each field that is active in the target year or the year before. */
  fieldStatus: Map<string, SeasonPlanFieldStatus>
}

/** The target year that the wizard opens by default. */
export interface SeasonPlanTarget {
  targetYear: number
  /** `true` when the plan for the target year is complete. */
  complete: boolean
  /** The years that can be chosen as target year. */
  availableYears: number[]
}

/** The main cultivation of a field in a year. */
export interface SeasonPlanHistoryEntry {
  year: number
  b_lu: string
  b_lu_catalogue: string
  b_lu_name: string
  b_lu_croprotation: SeasonPlanCropRotation | null
}

/** The kind of field for planning purposes. */
export type SeasonPlanFieldType = "permanent" | "rotation" | "new"

/** A warning for a proposed main cultivation that conflicts with the rotation advice. */
export interface SeasonPlanRotationWarning {
  b_lu_croprotation: SeasonPlanCropRotation
  /** The minimum number of years between two main cultivations of this category. */
  minYearsBetween: number
  /** The most recent year in which this category was the main cultivation. */
  lastYear: number
}

/** A fertilizer application proposed for the target year. */
export interface SeasonPlanProposedApplication {
  /** The application that is copied. */
  p_app_id: string
  p_id: string
  /** The date in the target year. */
  p_app_date: Date
}

/** The fertilizer template proposed for a field. */
export interface SeasonPlanFertilizerTemplate {
  /** The field the applications are copied from. */
  b_id: string
  /** The year the applications are copied from. */
  year: number
  /** The catalogue ID of the main cultivation the applications belong to. */
  b_lu_catalogue: string
  applications: SeasonPlanProposedApplication[]
}

/** The measures of a field, grouped for the target year. */
export interface SeasonPlanMeasureGroups {
  /** Measures that continue into the target year. */
  ongoing: SeasonPlanMeasure[]
  /** Measures that ended in the year before the target year and were not renewed. */
  expiring: SeasonPlanMeasure[]
  /** Measures that ended earlier. */
  ended: SeasonPlanMeasure[]
}

/** The proposal for one field. */
export interface SeasonPlanFieldProposal {
  b_id: string
  b_name: string
  status: SeasonPlanFieldStatus
  fieldType: SeasonPlanFieldType
  /** Main cultivations in the history years, oldest first. Years without data are left out. */
  history: SeasonPlanHistoryEntry[]
  /** Detected rotation cycle length in years, or `null`. */
  rotationCycle: number | null
  /** The year the proposal is based on, or `null` for a new field. */
  sourceYear: number | null
  /** The years that can be chosen as source year. */
  availableSourceYears: number[]
  /** The main cultivation already recorded for the target year, if any. */
  current: SeasonPlanHistoryEntry | null
  /**
   * `true` when the main cultivation of the target year is the same cultivation as in the year
   * before (for example grassland without an end date), so it continues rather than being chosen
   * for the target year. It can still be ended and replaced.
   */
  continuing: boolean
  /** The proposed main cultivation, or `null` when the user has to choose. */
  suggested: SeasonPlanHistoryEntry | null
  /** Rotation warnings for the proposed (or current) main cultivation. */
  rotationWarnings: SeasonPlanRotationWarning[]
  /** Fertilizer template, or `null` when there is none (show the nutrient advice instead). */
  fertilizerTemplate: SeasonPlanFertilizerTemplate | null
  /** Number of fertilizer applications already recorded for the target year. */
  existingApplications: number
  measures: SeasonPlanMeasureGroups
}

/** The proposal for the season plan of a farm. */
export interface SeasonPlanProposal {
  targetYear: number
  fields: SeasonPlanFieldProposal[]
  /** Fields active in the year before the target year that are not available in the target year. */
  droppedFields: { b_id: string; b_name: string; measures: SeasonPlanMeasureGroups }[]
}
