/**
 * Pure rules of the season planning wizard.
 *
 * The functions in this module do not access the database. They are evaluated on
 * {@link SeasonPlanData} collected by `season-plan.ts`, so they can be tested and reused without a
 * database connection.
 *
 * Choices that may change from year to year are kept in {@link seasonPlanRules}. To support a new
 * year with different choices, add an entry with its `rulesYear`; years without an own entry use
 * the newest older entry and are marked as provisional.
 *
 * @module
 */
import type {
  ResolvedSeasonPlanRules,
  SeasonPlanCropRotation,
  SeasonPlanCultivation,
  SeasonPlanData,
  SeasonPlanFertilizerTemplate,
  SeasonPlanField,
  SeasonPlanFieldProposal,
  SeasonPlanFieldStatus,
  SeasonPlanFieldType,
  SeasonPlanHistoryEntry,
  SeasonPlanMeasure,
  SeasonPlanMeasureGroups,
  SeasonPlanOptions,
  SeasonPlanProgress,
  SeasonPlanProposal,
  SeasonPlanRotationWarning,
  SeasonPlanRules,
  SeasonPlanStep,
  SeasonPlanStepProgress,
  SeasonPlanTarget,
} from "./season-plan.types"
import type { Timeframe } from "./timeframe"
import { adjustEndDateAtYearStart, startOfDayInFdmTimeZone, toFdmDateString } from "./date"
import { findHoofdteelt } from "./hoofdteelt"

/** The steps of the season planning wizard, in order. */
export const SEASON_PLAN_STEPS: readonly SeasonPlanStep[] = [
  "start",
  "fields",
  "cultivations",
  "catch_crops",
  "measures",
  "fertilizers",
  "harvests",
] as const

/**
 * The season plan rules per year, oldest first.
 *
 * `minYearsBetween` is rotation advice (a warning in the wizard), not a legal requirement.
 */
export const seasonPlanRules: readonly SeasonPlanRules[] = [
  {
    rulesYear: 2025,
    historyYears: 6,
    rotationCycles: [3, 4, 5],
    nonArableCropRotations: ["grass", "nature"],
    unfertilizedCropRotations: ["nature"],
    catchCropRotations: ["catchcrop"],
    minYearsBetween: {
      potato: 3,
      sugarbeet: 3,
      rapeseed: 3,
      starch: 3,
      maize: 2,
      cereal: 2,
    },
  },
]

/**
 * Returns the season plan rules that apply to a target year: the entry for that year, or else the
 * newest entry of an earlier year (marked as provisional).
 *
 * @param targetYear - The year that is planned.
 * @param rules - The available rules. Defaults to {@link seasonPlanRules}.
 * @returns The rules that apply, or `null` when no entry applies (the year is before the first
 *   entry).
 */
export function findSeasonPlanRules(
  targetYear: number,
  rules: readonly SeasonPlanRules[] = seasonPlanRules,
): ResolvedSeasonPlanRules | null {
  let selected: SeasonPlanRules | undefined
  for (const entry of rules) {
    if (entry.rulesYear <= targetYear && (!selected || entry.rulesYear > selected.rulesYear)) {
      selected = entry
    }
  }
  if (!selected) return null
  return { ...selected, provisional: selected.rulesYear !== targetYear }
}

/**
 * Returns the season plan rules that apply to a target year, like {@link findSeasonPlanRules}, but
 * throws when no entry applies.
 *
 * @param targetYear - The year that is planned.
 * @param rules - The available rules. Defaults to {@link seasonPlanRules}.
 * @returns The rules that apply.
 * @throws {Error} If no rules are defined for the target year or any earlier year.
 */
export function resolveSeasonPlanRules(
  targetYear: number,
  rules: readonly SeasonPlanRules[] = seasonPlanRules,
): ResolvedSeasonPlanRules {
  const resolved = findSeasonPlanRules(targetYear, rules)
  if (!resolved) {
    throw new Error(`No season plan rules available for ${targetYear}`)
  }
  return resolved
}

/**
 * Returns the calendar year of a moment in Europe/Amsterdam.
 *
 * @param date - The moment.
 * @returns The calendar year.
 */
export function getYearInFdmTimeZone(date: Date): number {
  return Number(toFdmDateString(date).slice(0, 4))
}

/**
 * Returns the timeframe of a calendar year in Europe/Amsterdam, from 1 January 00:00 up to and
 * including 31 December 23:59:59.999.
 *
 * @param year - The calendar year.
 * @returns The timeframe of the year.
 */
export function getYearTimeframe(year: number): { start: Date; end: Date } {
  return {
    start: startOfDayInFdmTimeZone(year, 1, 1),
    end: new Date(startOfDayInFdmTimeZone(year + 1, 1, 1).getTime() - 1),
  }
}

function isWithin(date: Date | null | undefined, timeframe: Timeframe): boolean {
  if (!date || !timeframe.start || !timeframe.end) return false
  const time = date.getTime()
  return time >= timeframe.start.getTime() && time <= timeframe.end.getTime()
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Moves a moment to the same calendar date and time of day in another year (Europe/Amsterdam).
 * 29 February becomes 28 February in a year that is not a leap year.
 *
 * @param date - The moment to move.
 * @param year - The year to move it to.
 * @returns The moment in the given year.
 */
export function shiftDateToYear(date: Date, year: number): Date {
  const [y, m, d] = toFdmDateString(date).split("-").map(Number)
  const timeOfDay = date.getTime() - startOfDayInFdmTimeZone(y, m, d).getTime()
  const day = m === 2 && d === 29 && !isLeapYear(year) ? 28 : d
  return new Date(startOfDayInFdmTimeZone(year, m, day).getTime() + timeOfDay)
}

/**
 * Returns whether a field is managed during (a part of) a calendar year.
 *
 * @param field - The field.
 * @param year - The calendar year.
 * @returns `true` when the field period overlaps the year.
 */
export function isFieldActiveInYear(
  field: Pick<SeasonPlanField, "b_start" | "b_end">,
  year: number,
): boolean {
  const { start, end } = getYearTimeframe(year)
  if (field.b_start && field.b_start.getTime() > end.getTime()) return false
  if (field.b_end && adjustEndDateAtYearStart(field.b_end).getTime() < start.getTime()) return false
  return true
}

/**
 * Returns the status of a field in the target year compared to the year before.
 *
 * @param field - The field.
 * @param targetYear - The year that is planned.
 * @returns `kept`, `new` or `dropped`, or `null` when the field is active in neither year.
 */
export function getFieldStatus(
  field: Pick<SeasonPlanField, "b_start" | "b_end">,
  targetYear: number,
): SeasonPlanFieldStatus | null {
  const activeInTarget = isFieldActiveInYear(field, targetYear)
  const activeBefore = isFieldActiveInYear(field, targetYear - 1)
  if (activeInTarget) return activeBefore ? "kept" : "new"
  return activeBefore ? "dropped" : null
}

/**
 * Returns the main cultivation (hoofdteelt) of a field in a year, or `null` when there is none.
 *
 * @param cultivations - The cultivations of the field.
 * @param year - The calendar year.
 * @returns The main cultivation or `null`.
 */
export function getMainCultivation<T extends SeasonPlanCultivation>(
  cultivations: T[],
  year: number,
): T | null {
  return findHoofdteelt(cultivations, year, true)
}

function toHistoryEntry(cultivation: SeasonPlanCultivation, year: number): SeasonPlanHistoryEntry {
  return {
    year,
    b_lu: cultivation.b_lu,
    b_lu_catalogue: cultivation.b_lu_catalogue,
    b_lu_name: cultivation.b_lu_name,
    b_lu_croprotation: cultivation.b_lu_croprotation,
  }
}

/**
 * Returns the main cultivation of each year in a range, oldest first. Years without a main
 * cultivation are left out.
 *
 * @param cultivations - The cultivations of the field.
 * @param fromYear - The first year (inclusive).
 * @param toYear - The last year (inclusive).
 * @returns The main cultivation per year.
 */
export function getMainCultivationHistory(
  cultivations: SeasonPlanCultivation[],
  fromYear: number,
  toYear: number,
): SeasonPlanHistoryEntry[] {
  const history: SeasonPlanHistoryEntry[] = []
  for (let year = fromYear; year <= toYear; year++) {
    const main = getMainCultivation(cultivations, year)
    if (main) history.push(toHistoryEntry(main, year))
  }
  return history
}

/** Key used to compare main cultivations in a rotation: the category, else the catalogue code. */
function rotationKey(entry: SeasonPlanHistoryEntry): string {
  return entry.b_lu_croprotation && entry.b_lu_croprotation !== "other"
    ? `rotation:${entry.b_lu_croprotation}`
    : `catalogue:${entry.b_lu_catalogue}`
}

/**
 * Detects the rotation cycle of a field from its main cultivation history.
 *
 * A cycle of `k` years is recognised when the history has a main cultivation in year
 * `targetYear - k`, every pair of years `k` apart has the same crop (compared by crop rotation
 * category, or by catalogue code for the category `other`), at least one such pair exists, and the
 * history is not the same crop every year. The shortest matching cycle is returned.
 *
 * @param history - Main cultivations, as returned by {@link getMainCultivationHistory}.
 * @param targetYear - The year that is planned.
 * @param cycles - The cycle lengths to try.
 * @returns The cycle length in years, or `null` when no cycle is recognised.
 */
export function detectRotationCycle(
  history: SeasonPlanHistoryEntry[],
  targetYear: number,
  cycles: number[],
): number | null {
  const byYear = new Map(history.map((entry) => [entry.year, entry]))
  const keys = new Set(history.map(rotationKey))
  if (keys.size < 2) return null

  for (const cycle of [...cycles].sort((a, b) => a - b)) {
    if (!byYear.has(targetYear - cycle)) continue
    let pairs = 0
    let consistent = true
    for (const entry of history) {
      const earlier = byYear.get(entry.year - cycle)
      if (!earlier) continue
      pairs++
      if (rotationKey(earlier) !== rotationKey(entry)) {
        consistent = false
        break
      }
    }
    if (consistent && pairs > 0) return cycle
  }
  return null
}

/**
 * Returns the rotation warnings for a main cultivation in the target year.
 *
 * @param history - Main cultivations before the target year.
 * @param targetYear - The year that is planned.
 * @param b_lu_croprotation - The crop rotation category of the proposed main cultivation.
 * @param rules - The rules that apply.
 * @returns A warning when the category was grown too recently, else an empty array.
 */
export function getRotationWarnings(
  history: SeasonPlanHistoryEntry[],
  targetYear: number,
  b_lu_croprotation: SeasonPlanCropRotation | null,
  rules: Pick<SeasonPlanRules, "minYearsBetween">,
): SeasonPlanRotationWarning[] {
  if (!b_lu_croprotation) return []
  const minYearsBetween = rules.minYearsBetween[b_lu_croprotation]
  if (!minYearsBetween) return []
  const lastYear = history
    .filter((entry) => entry.b_lu_croprotation === b_lu_croprotation && entry.year < targetYear)
    .reduce<number | null>(
      (last, entry) => (last === null || entry.year > last ? entry.year : last),
      null,
    )
  if (lastYear === null || targetYear - lastYear >= minYearsBetween) return []
  return [{ b_lu_croprotation, minYearsBetween, lastYear }]
}

/**
 * Classifies a field for planning and determines the default source year.
 *
 * - `new`: the field has no main cultivation in the history.
 * - `permanent`: the main cultivation of the previous year continues into the target year, or the
 *   last three years have the same crop and no rotation cycle is recognised. Source: previous year.
 * - `rotation`: otherwise. Source: the year one cycle ago when a cycle is recognised, else the
 *   previous year (or the most recent year with data).
 *
 * @param cultivations - The cultivations of the field.
 * @param history - Main cultivations before the target year.
 * @param targetYear - The year that is planned.
 * @param rules - The rules that apply.
 * @returns The field type, detected cycle and default source year.
 */
export function classifyField(
  cultivations: SeasonPlanCultivation[],
  history: SeasonPlanHistoryEntry[],
  targetYear: number,
  rules: Pick<SeasonPlanRules, "rotationCycles">,
): { fieldType: SeasonPlanFieldType; rotationCycle: number | null; sourceYear: number | null } {
  if (history.length === 0) {
    return { fieldType: "new", rotationCycle: null, sourceYear: null }
  }
  const latestYear = history[history.length - 1].year
  const previous = history.find((entry) => entry.year === targetYear - 1)
  if (previous) {
    const cultivation = cultivations.find((c) => c.b_lu === previous.b_lu)
    // Still present at the end of the hoofdteelt window of the target year (15 July)
    const windowEnd = new Date(`${targetYear}-07-15`)
    if (cultivation && (!cultivation.b_lu_end || cultivation.b_lu_end >= windowEnd)) {
      return { fieldType: "permanent", rotationCycle: null, sourceYear: previous.year }
    }
  }

  const rotationCycle = detectRotationCycle(history, targetYear, rules.rotationCycles)
  if (rotationCycle !== null) {
    return { fieldType: "rotation", rotationCycle, sourceYear: targetYear - rotationCycle }
  }

  const lastThree = history.slice(-3)
  if (
    lastThree.length === 3 &&
    lastThree[2].year - lastThree[0].year === 2 &&
    new Set(lastThree.map((entry) => entry.b_lu_catalogue)).size === 1
  ) {
    return { fieldType: "permanent", rotationCycle: null, sourceYear: latestYear }
  }

  return { fieldType: "rotation", rotationCycle: null, sourceYear: previous?.year ?? latestYear }
}

/**
 * Proposes a main cultivation for a rotation field without a recognised cycle: the crop of
 * 3, 4, 5, 2 or 6 years ago (in that order) that has no rotation warning.
 *
 * @returns The proposed main cultivation, or `null` when the user has to choose.
 */
function suggestFromRotation(
  history: SeasonPlanHistoryEntry[],
  targetYear: number,
  rules: SeasonPlanRules,
): SeasonPlanHistoryEntry | null {
  const byYear = new Map(history.map((entry) => [entry.year, entry]))
  for (const offset of [3, 4, 5, 2, 6]) {
    const entry = byYear.get(targetYear - offset)
    if (!entry) continue
    if (rotationKey(entry) === rotationKey(history[history.length - 1])) continue
    if (getRotationWarnings(history, targetYear, entry.b_lu_croprotation, rules).length === 0) {
      return entry
    }
  }
  return null
}

/**
 * Groups the measures of a field for the target year.
 *
 * - `ongoing`: no end date, or ending in or after the target year (and starting before its end).
 * - `expiring`: ended in the year before the target year, and not renewed by a measure with the
 *   same `m_id` that continues into the target year.
 * - `ended`: ended earlier.
 *
 * @param measures - The measures of the field.
 * @param targetYear - The year that is planned.
 * @returns The grouped measures.
 */
export function groupMeasures(
  measures: SeasonPlanMeasure[],
  targetYear: number,
): SeasonPlanMeasureGroups {
  const target = getYearTimeframe(targetYear)
  const previous = getYearTimeframe(targetYear - 1)
  const groups: SeasonPlanMeasureGroups = { ongoing: [], expiring: [], ended: [] }
  const continues = (measure: SeasonPlanMeasure) =>
    (!measure.m_start || measure.m_start.getTime() <= target.end.getTime()) &&
    (!measure.m_end || adjustEndDateAtYearStart(measure.m_end).getTime() >= target.start.getTime())

  for (const measure of measures) {
    if (continues(measure)) {
      groups.ongoing.push(measure)
      continue
    }
    if (!measure.m_end) continue // starts after the target year
    const end = adjustEndDateAtYearStart(measure.m_end)
    if (end.getTime() > target.end.getTime()) continue // starts after the target year
    if (isWithin(end, previous)) {
      const renewed = measures.some(
        (other) =>
          other.b_id_measure !== measure.b_id_measure &&
          other.m_id === measure.m_id &&
          continues(other),
      )
      if (!renewed) groups.expiring.push(measure)
      continue
    }
    if (end.getTime() < previous.start.getTime()) groups.ended.push(measure)
  }
  return groups
}

/**
 * Returns the catch crops (vanggewassen, groenbemesters) recorded after the main cultivation of a
 * year: cultivations of a catch crop category that start in the year and not before the main
 * cultivation. Undersown catch crops (sown into the standing main cultivation) are included.
 *
 * @param cultivations - The cultivations of the field.
 * @param main - The main cultivation of the year, or `null`.
 * @param year - The calendar year.
 * @param rules - The rules that apply.
 * @returns The catch crop cultivations.
 */
export function getCatchCrops<T extends SeasonPlanCultivation>(
  cultivations: T[],
  main: SeasonPlanCultivation | null,
  year: number,
  rules: Pick<SeasonPlanRules, "catchCropRotations">,
): T[] {
  const timeframe = getYearTimeframe(year)
  return cultivations.filter(
    (c) =>
      c.b_lu !== main?.b_lu &&
      c.b_lu_croprotation !== null &&
      rules.catchCropRotations.includes(c.b_lu_croprotation) &&
      isWithin(c.b_lu_start, timeframe) &&
      (!main?.b_lu_start || (c.b_lu_start as Date).getTime() >= main.b_lu_start.getTime()),
  )
}

/**
 * Returns whether a harvest is expected in the year for a main cultivation: always for crops that
 * are harvested multiple times, for crops harvested once only when the cultivation ends in that
 * year, and never for crops without a harvest.
 *
 * @param main - The main cultivation.
 * @param year - The calendar year.
 * @returns `true` when a harvest in the year is expected.
 */
export function isHarvestExpected(main: SeasonPlanCultivation, year: number): boolean {
  if (main.b_lu_harvestable === "multiple") return true
  if (main.b_lu_harvestable === "once") return isWithin(main.b_lu_end, getYearTimeframe(year))
  return false
}

/**
 * Evaluates the progress of the season plan for a target year.
 *
 * The progress is derived from the data only. A step is done when nothing that blocks completion
 * is open; skipping a step in the wizard does not change the data, so the step stays open when it
 * has blocking items:
 *
 * - `start`, `fields` and `measures` never block (they are reviews). Expired measures that were not
 *   renewed are returned as notices.
 * - `cultivations`: each field active in the target year has a main cultivation.
 * - `catch_crops`: each arable field where a catch crop is required has one. Arable fields without
 *   a catch crop are returned as notices.
 * - `fertilizers`: each field that is not a buffer strip and not of an unfertilized category has a
 *   fertilizer application in the target year, unless it was already managed without any
 *   application in the year before.
 * - `harvests`: each main cultivation that is expected to be harvested in the year has a harvest.
 *
 * @param data - The farm data.
 * @param targetYear - The year that is planned.
 * @param options - Injected legal requirements.
 * @param rules - The rules. Defaults to the rules that apply to the target year.
 * @returns The progress.
 */
export function evaluateSeasonPlanProgress(
  data: SeasonPlanData,
  targetYear: number,
  options: Pick<SeasonPlanOptions, "isCatchCropRequired"> = {},
  rules: ResolvedSeasonPlanRules = resolveSeasonPlanRules(targetYear),
): SeasonPlanProgress {
  const target = getYearTimeframe(targetYear)
  const previous = getYearTimeframe(targetYear - 1)
  const fieldStatus = new Map<string, SeasonPlanFieldStatus>()
  const progress = new Map<SeasonPlanStep, SeasonPlanStepProgress>(
    SEASON_PLAN_STEPS.map((step) => [step, { step, done: true, pending: [], notices: [] }]),
  )
  const block = (step: SeasonPlanStep, id: string) => {
    const entry = progress.get(step) as SeasonPlanStepProgress
    entry.pending.push(id)
    entry.done = false
  }
  const notice = (step: SeasonPlanStep, id: string) => {
    ;(progress.get(step) as SeasonPlanStepProgress).notices.push(id)
  }

  let started = false
  for (const field of data.fields) {
    const status = getFieldStatus(field, targetYear)
    if (!status) continue
    fieldStatus.set(field.b_id, status)
    if (status !== "kept") started = true
    if (status === "dropped") continue

    const cultivations = data.cultivations.get(field.b_id) ?? []
    const applications = data.fertilizerApplications.get(field.b_id) ?? []
    const measures = data.measures.get(field.b_id) ?? []
    if (
      cultivations.some((c) => isWithin(c.b_lu_start, target)) ||
      applications.some((a) => isWithin(a.p_app_date, target)) ||
      measures.some((m) => isWithin(m.m_start, target))
    ) {
      started = true
    }

    // Cultivations
    const main = getMainCultivation(cultivations, targetYear)
    if (!main) block("cultivations", field.b_id)

    // Catch crops
    const arable =
      main !== null &&
      !(main.b_lu_croprotation && rules.nonArableCropRotations.includes(main.b_lu_croprotation))
    if (arable && getCatchCrops(cultivations, main, targetYear, rules).length === 0) {
      if (options.isCatchCropRequired?.(field.b_id, targetYear)) {
        block("catch_crops", field.b_id)
      } else {
        notice("catch_crops", field.b_id)
      }
    }

    // Measures
    for (const measure of groupMeasures(measures, targetYear).expiring) {
      notice("measures", measure.b_id_measure)
    }

    // Fertilizers
    const unfertilized =
      field.b_bufferstrip ||
      (main?.b_lu_croprotation !== null &&
        main?.b_lu_croprotation !== undefined &&
        rules.unfertilizedCropRotations.includes(main.b_lu_croprotation))
    const appliedBefore = applications.some((a) => isWithin(a.p_app_date, previous))
    const appliedInTarget = applications.some((a) => isWithin(a.p_app_date, target))
    if (!unfertilized && !appliedInTarget && (status === "new" || appliedBefore)) {
      block("fertilizers", field.b_id)
    }

    // Harvests
    if (main && isHarvestExpected(main, targetYear)) {
      const harvests = data.harvests.get(main.b_lu) ?? []
      if (harvests.some((h) => isWithin(h.b_lu_harvest_date, target))) {
        started = true
      } else {
        block("harvests", main.b_lu)
      }
    }
  }

  const steps = SEASON_PLAN_STEPS.map((step) => progress.get(step) as SeasonPlanStepProgress)
  const firstIncomplete = steps.find((step) => !step.done)
  return {
    targetYear,
    rulesYear: rules.rulesYear,
    provisional: rules.provisional,
    started,
    complete: !firstIncomplete,
    firstIncompleteStep: firstIncomplete?.step ?? null,
    steps,
    fieldStatus,
  }
}

/**
 * Determines the target year the wizard opens by default.
 *
 * The candidates are the current year and the next year, for which season plan rules exist and the
 * farm has at least one main cultivation in the history years. The first candidate whose plan is not complete is returned; if
 * all are complete, the last candidate is returned, so the wizard stays accessible.
 *
 * @param data - The farm data, covering the history years of both candidates.
 * @param currentYear - The current calendar year.
 * @param options - Injected legal requirements.
 * @returns The default target year, or `null` when the farm has no history to plan from.
 */
export function resolveSeasonPlanTargetFromData(
  data: SeasonPlanData,
  currentYear: number,
  options: Pick<SeasonPlanOptions, "isCatchCropRequired"> = {},
): SeasonPlanTarget | null {
  const candidates: { year: number; complete: boolean }[] = []
  for (const year of [currentYear, currentYear + 1]) {
    const rules = findSeasonPlanRules(year)
    if (!rules) continue
    const hasHistory = data.fields.some(
      (field) =>
        getMainCultivationHistory(
          data.cultivations.get(field.b_id) ?? [],
          year - rules.historyYears,
          year - 1,
        ).length > 0,
    )
    if (!hasHistory) continue
    candidates.push({
      year,
      complete: evaluateSeasonPlanProgress(data, year, options, rules).complete,
    })
  }
  if (candidates.length === 0) return null
  const selected = candidates.find((c) => !c.complete) ?? candidates[candidates.length - 1]
  return {
    targetYear: selected.year,
    complete: selected.complete,
    availableYears: candidates.map((c) => c.year),
  }
}

/**
 * Finds the fertilizer applications to copy for a main cultivation: first those of the same field
 * in the source year (when that year had the same main cultivation), then those of the most recent
 * year in which any field of the farm had this main cultivation (the same field first).
 *
 * @returns The template, or `null` when no applications are found.
 */
function findFertilizerTemplate(
  data: SeasonPlanData,
  b_id: string,
  b_lu_catalogue: string,
  sourceYear: number | null,
  targetYear: number,
  rules: SeasonPlanRules,
): SeasonPlanFertilizerTemplate | null {
  const build = (fieldId: string, year: number): SeasonPlanFertilizerTemplate | null => {
    const main = getMainCultivation(data.cultivations.get(fieldId) ?? [], year)
    if (!main || main.b_lu_catalogue !== b_lu_catalogue) return null
    const timeframe = getYearTimeframe(year)
    const applications = (data.fertilizerApplications.get(fieldId) ?? [])
      .filter((a) => isWithin(a.p_app_date, timeframe))
      .sort((a, b) => a.p_app_date.getTime() - b.p_app_date.getTime())
    if (applications.length === 0) return null
    return {
      b_id: fieldId,
      year,
      b_lu_catalogue,
      applications: applications.map((a) => ({
        p_app_id: a.p_app_id,
        p_id: a.p_id,
        p_app_date: shiftDateToYear(a.p_app_date, targetYear),
      })),
    }
  }

  if (sourceYear !== null) {
    const own = build(b_id, sourceYear)
    if (own) return own
  }
  const otherFields = data.fields.map((f) => f.b_id).filter((id) => id !== b_id)
  for (let year = targetYear - 1; year >= targetYear - rules.historyYears; year--) {
    for (const fieldId of [b_id, ...otherFields]) {
      const template = build(fieldId, year)
      if (template) return template
    }
  }
  return null
}

/**
 * Builds the proposal of the season plan: for each field active in the target year its history,
 * type, source year, proposed main cultivation, fertilizer template and measures, and the fields
 * that are no longer available.
 *
 * @param data - The farm data, covering the history years.
 * @param targetYear - The year that is planned.
 * @param sourceYears - Source years chosen by the user per field (`b_id`). Values that are not
 *   one of the available source years of the field are ignored.
 * @param rules - The rules. Defaults to the rules that apply to the target year.
 * @returns The proposal.
 */
export function buildSeasonPlanProposal(
  data: SeasonPlanData,
  targetYear: number,
  sourceYears: Map<string, number> = new Map(),
  rules: ResolvedSeasonPlanRules = resolveSeasonPlanRules(targetYear),
): SeasonPlanProposal {
  const target = getYearTimeframe(targetYear)
  const proposal: SeasonPlanProposal = { targetYear, fields: [], droppedFields: [] }

  for (const field of data.fields) {
    const status = getFieldStatus(field, targetYear)
    if (!status) continue
    const cultivations = data.cultivations.get(field.b_id) ?? []
    const measures = groupMeasures(data.measures.get(field.b_id) ?? [], targetYear)
    if (status === "dropped") {
      proposal.droppedFields.push({ b_id: field.b_id, b_name: field.b_name, measures })
      continue
    }

    const history = getMainCultivationHistory(
      cultivations,
      targetYear - rules.historyYears,
      targetYear - 1,
    )
    const availableSourceYears = history.map((entry) => entry.year)
    const classified = classifyField(cultivations, history, targetYear, rules)
    const chosen = sourceYears.get(field.b_id)
    const overridden = chosen !== undefined && availableSourceYears.includes(chosen)
    const sourceYear = overridden ? chosen : classified.sourceYear

    let suggested: SeasonPlanHistoryEntry | null = null
    if (sourceYear !== null) {
      const sourceEntry = history.find((entry) => entry.year === sourceYear) ?? null
      suggested =
        overridden || classified.fieldType === "permanent" || classified.rotationCycle !== null
          ? sourceEntry
          : suggestFromRotation(history, targetYear, rules)
    }

    const currentMain = getMainCultivation(cultivations, targetYear)
    const current = currentMain ? toHistoryEntry(currentMain, targetYear) : null
    const crop = current ?? suggested
    const rotationWarnings =
      crop && classified.fieldType !== "permanent"
        ? getRotationWarnings(history, targetYear, crop.b_lu_croprotation, rules)
        : []
    const fertilizerTemplate = crop
      ? findFertilizerTemplate(data, field.b_id, crop.b_lu_catalogue, sourceYear, targetYear, rules)
      : null
    const existingApplications = (data.fertilizerApplications.get(field.b_id) ?? []).filter((a) =>
      isWithin(a.p_app_date, target),
    ).length

    proposal.fields.push({
      b_id: field.b_id,
      b_name: field.b_name,
      status,
      fieldType: classified.fieldType,
      history,
      rotationCycle: classified.rotationCycle,
      sourceYear,
      availableSourceYears,
      current,
      suggested,
      rotationWarnings,
      fertilizerTemplate,
      existingApplications,
      measures,
    } satisfies SeasonPlanFieldProposal)
  }
  return proposal
}
