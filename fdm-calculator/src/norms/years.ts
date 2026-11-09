/**
 * Norms per target year, with a provisional fallback for years whose norm tables are not
 * available yet.
 *
 * {@link NORMS_YEARS} lists the norm years that have their own implementation. For a target year
 * with its own implementation, the factories in this module return the same functions as
 * `createFunctionsForNorms` and `createFunctionsForFertilizerApplicationFilling`. For a later
 * target year, they return the functions of the newest norm year, wrapped so that:
 *
 * - the data is collected for the target year (fields, cultivations, harvests, soil data,
 *   fertilizer applications, grazing intention and organic certification of that year), and
 * - before each calculation, the dates in the input are moved to the same calendar date in the
 *   norm year, so the date rules of the norm year (such as the hoofdteelt period of 15 May to
 *   15 July) are applied to the plan of the target year.
 *
 * The result is marked as `provisional`. To support a new norm year, add its implementation to
 * `createFunctionsForNorms` and the filling factories, add the year to {@link NORMS_YEARS}, and
 * update {@link LATEST_NORMS_YEAR} and the input types used here when the input shape changes.
 *
 * @module
 */
import {
  type BaseFertilizerApplication,
  type Cultivation,
  type FdmType,
  getCultivations,
  getCultivationsForFarm,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getField,
  getFields,
  getGrazingIntention,
  getHarvests,
  getHarvestsForFarm,
  isOrganicCertificationValid,
  type PrincipalId,
  shiftDateToYear,
  startOfDayInFdmTimeZone,
  type Timeframe,
  toFdmDateString,
} from "@nmi-agro/fdm-core"
import type { NL2026NormsFillingInput } from "./nl/2026/filling/types"
import type { NL2026FdmCoreOperations } from "./nl/2026/value/input"
import type { NL2026NormsInput, NL2026NormsInputForCultivation } from "./nl/2026/value/types"
import {
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  createUncachedFunctionsForFertilizerApplicationFilling,
} from "./index"

/** The norm years that have their own implementation, oldest first. */
export const NORMS_YEARS = ["2025", "2026"] as const

/** A norm year that has its own implementation. */
export type NormsYear = (typeof NORMS_YEARS)[number]

/** The newest norm year. Later target years use its functions provisionally. */
export const LATEST_NORMS_YEAR = "2026" satisfies NormsYear

/** The norm year that applies to a target year. */
export type NormsYearResolution = {
  /** The year that is calculated. */
  targetYear: number
  /** The norm year whose tables and rules are used. */
  normsYear: NormsYear
  /** `true` when the target year has no own norms and the tables of `normsYear` are used. */
  provisional: boolean
}

/**
 * Returns the norm year that applies to a target year: the target year itself when it has its own
 * implementation, else the newest norm year before it (provisional).
 *
 * @param b_region - The region. Only `NL` is supported.
 * @param targetYear - The year that is calculated.
 * @returns The norm year and whether it is provisional.
 * @throws {Error} When the region is not supported, or the year is not an integer or is before the
 *   first norm year.
 */
export function resolveNormsYear(b_region: "NL", targetYear: number): NormsYearResolution {
  if (b_region !== "NL") {
    throw new Error("Region not supported")
  }
  if (!Number.isInteger(targetYear)) {
    throw new Error(`Invalid year: ${targetYear}`)
  }
  let normsYear: NormsYear | undefined
  for (const year of NORMS_YEARS) {
    if (Number(year) <= targetYear) normsYear = year
  }
  if (!normsYear) {
    throw new Error("Year not supported")
  }
  return { targetYear, normsYear, provisional: Number(normsYear) !== targetYear }
}

/**
 * Moves a date by a number of years, keeping the calendar date and time of day in
 * Europe/Amsterdam (29 February becomes 28 February in a year that is not a leap year).
 *
 * @param date - The date to move. `null` and `undefined` are returned unchanged.
 * @param years - The number of years to move; negative moves back.
 * @returns The moved date.
 */
export function shiftDateByYears<T extends Date | null | undefined>(date: T, years: number): T {
  if (!(date instanceof Date) || years === 0 || Number.isNaN(date.getTime())) return date
  const year = Number(toFdmDateString(date).slice(0, 4))
  return shiftDateToYear(date, year + years) as T
}

/** Moves the start and end of a timeframe by a number of years. */
function shiftTimeframe(timeframe: Timeframe | undefined, years: number): Timeframe | undefined {
  if (!timeframe) return timeframe
  return {
    start: shiftDateByYears(timeframe.start, years),
    end: shiftDateByYears(timeframe.end, years),
  }
}

/**
 * Moves the dates of the cultivations and their harvests in a norms input by a number of years.
 *
 * @param input - The norms input.
 * @param years - The number of years to move; negative moves back.
 * @returns A copy of the input with moved dates.
 */
export function shiftNormsInput(input: NL2026NormsInput, years: number): NL2026NormsInput {
  return {
    ...input,
    cultivations: input.cultivations.map((cultivation): NL2026NormsInputForCultivation => ({
      ...cultivation,
      b_lu_start: shiftDateByYears(cultivation.b_lu_start, years),
      b_lu_end: shiftDateByYears(cultivation.b_lu_end, years),
      harvests: cultivation.harvests?.map((harvest) => ({
        ...harvest,
        b_lu_harvest_date: shiftDateByYears(harvest.b_lu_harvest_date, years),
      })),
    })),
  }
}

/**
 * Moves the dates of the cultivations and fertilizer applications in a filling input by a number
 * of years.
 *
 * @param input - The filling input.
 * @param years - The number of years to move; negative moves back.
 * @returns A copy of the input with moved dates.
 */
export function shiftFillingInput(
  input: NL2026NormsFillingInput,
  years: number,
): NL2026NormsFillingInput {
  return {
    ...input,
    cultivations: input.cultivations.map((cultivation): Cultivation => ({
      ...cultivation,
      b_lu_start: shiftDateByYears(cultivation.b_lu_start, years),
      b_lu_end: shiftDateByYears(cultivation.b_lu_end, years),
    })),
    applications: input.applications.map((application): BaseFertilizerApplication => ({
      ...application,
      p_app_date: shiftDateByYears(application.p_app_date, years),
    })),
  }
}

/**
 * Returns the timeframe of a calendar year in Europe/Amsterdam, from 1 January 00:00 up to and
 * including 31 December 23:59:59.999, independent of the time zone of the server.
 */
function getYearTimeframeInFdmTimeZone(year: number): Timeframe {
  return {
    start: startOfDayInFdmTimeZone(year, 1, 1),
    end: new Date(startOfDayInFdmTimeZone(year + 1, 1, 1).getTime() - 1),
  }
}

/** The fdm-core functions used to collect norms data for a target year. */
export type NormsYearFdmCoreOperations = NL2026FdmCoreOperations & {
  getFertilizerApplications: typeof getFertilizerApplications
  getFertilizerApplicationsForFarm: typeof getFertilizerApplicationsForFarm
  getFertilizers: typeof getFertilizers
  isOrganicCertificationValid: typeof isOrganicCertificationValid
}

const defaultOperations: NormsYearFdmCoreOperations = {
  getField,
  getFields,
  getCultivations,
  getCultivationsForFarm,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getGrazingIntention,
  getHarvests,
  getHarvestsForFarm,
  getFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  isOrganicCertificationValid,
}

/**
 * Returns fdm-core operations that read the data of a year `years` later than the timeframes and
 * years they are called with. The returned data keeps its own dates.
 */
function shiftOperations(
  operations: NormsYearFdmCoreOperations,
  years: number,
): NL2026FdmCoreOperations {
  return {
    getField: operations.getField,
    getFields: (fdm, principal_id, b_id_farm, timeframe) =>
      operations.getFields(fdm, principal_id, b_id_farm, shiftTimeframe(timeframe, years)),
    getCultivations: (fdm, principal_id, b_id, timeframe) =>
      operations.getCultivations(fdm, principal_id, b_id, shiftTimeframe(timeframe, years)),
    getCultivationsForFarm: (fdm, principal_id, b_id_farm, timeframe) =>
      operations.getCultivationsForFarm(
        fdm,
        principal_id,
        b_id_farm,
        shiftTimeframe(timeframe, years),
      ),
    getCurrentSoilData: (fdm, principal_id, b_id, timeframe) =>
      operations.getCurrentSoilData(fdm, principal_id, b_id, shiftTimeframe(timeframe, years)),
    getCurrentSoilDataForFarm: (fdm, principal_id, b_id_farm, timeframe) =>
      operations.getCurrentSoilDataForFarm(
        fdm,
        principal_id,
        b_id_farm,
        shiftTimeframe(timeframe, years),
      ),
    getGrazingIntention: (fdm, principal_id, b_id_farm, year) =>
      operations.getGrazingIntention(fdm, principal_id, b_id_farm, year + years),
    getHarvests: (fdm, principal_id, b_lu, timeframe) =>
      operations.getHarvests(fdm, principal_id, b_lu, shiftTimeframe(timeframe, years)),
    getHarvestsForFarm: (fdm, principal_id, b_id_farm, timeframe) =>
      operations.getHarvestsForFarm(fdm, principal_id, b_id_farm, shiftTimeframe(timeframe, years)),
  }
}

type LatestNormsFunctions = ReturnType<typeof createFunctionsForNorms<typeof LATEST_NORMS_YEAR>>
type LatestFillingFunctions = ReturnType<
  typeof createFunctionsForFertilizerApplicationFilling<typeof LATEST_NORMS_YEAR>
>
type LatestUncachedFillingFunctions = ReturnType<
  typeof createUncachedFunctionsForFertilizerApplicationFilling<typeof LATEST_NORMS_YEAR>
>

/** Norm functions for a target year, with the norm year that is used. */
export type NormsFunctionsForYear = (
  | ReturnType<typeof createFunctionsForNorms<"2025">>
  | LatestNormsFunctions
) &
  NormsYearResolution

/** Fertilizer application filling functions for a target year, with the norm year that is used. */
export type FillingFunctionsForYear = (
  | ReturnType<typeof createFunctionsForFertilizerApplicationFilling<"2025">>
  | LatestFillingFunctions
) &
  NormsYearResolution

/** Uncached fertilizer application filling functions for a target year, with the norm year. */
export type UncachedFillingFunctionsForYear = (
  | ReturnType<typeof createUncachedFunctionsForFertilizerApplicationFilling<"2025">>
  | LatestUncachedFillingFunctions
) &
  NormsYearResolution

/**
 * Wraps the norm functions of a norm year for a later target year: inputs are collected for the
 * target year and their dates are moved to the norm year before each calculation.
 *
 * @param base - The norm functions of the norm year.
 * @param resolution - The target year and norm year.
 * @param operations - The fdm-core functions used to collect data. Defaults to fdm-core.
 * @returns The wrapped norm functions.
 */
export function createProvisionalNormsFunctions(
  base: LatestNormsFunctions,
  resolution: NormsYearResolution,
  operations: NormsYearFdmCoreOperations = defaultOperations,
): LatestNormsFunctions & NormsYearResolution {
  const years = resolution.targetYear - Number(resolution.normsYear)
  const shifted = shiftOperations(operations, years)
  const toNormsYear = (input: NL2026NormsInput) => shiftNormsInput(input, -years)
  return {
    ...resolution,
    collectInputForNorms: (fdm, principal_id, b_id) =>
      base.collectInputForNorms(fdm, principal_id, b_id, shifted),
    collectInputForNormsForFarm: (fdm, principal_id, b_id_farm) =>
      base.collectInputForNormsForFarm(fdm, principal_id, b_id_farm, shifted),
    calculateNormForNitrogen: (fdm, input) =>
      base.calculateNormForNitrogen(fdm, toNormsYear(input)),
    calculateNormForManure: (fdm, input) => base.calculateNormForManure(fdm, toNormsYear(input)),
    calculateNormForPhosphate: (fdm, input) =>
      base.calculateNormForPhosphate(fdm, toNormsYear(input)),
    calculateNormForRenure: (fdm, input) => base.calculateNormForRenure(fdm, toNormsYear(input)),
    aggregateNormsToFarmLevel: base.aggregateNormsToFarmLevel,
  }
}

/**
 * Collects the filling input of a field for a target year. Mirrors the collector of the newest
 * norm year, with the timeframe, grazing intention and organic certification of the target year.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The ID of the principal.
 * @param b_id - The ID of the field.
 * @param fosfaatgebruiksnorm - The phosphate usage norm of the field (kg P2O5/ha).
 * @param targetYear - The year that is calculated.
 * @param operations - The fdm-core functions used to collect data. Defaults to fdm-core.
 * @returns The filling input, with the dates of the target year.
 */
export async function collectFillingInputForYear(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  fosfaatgebruiksnorm: number,
  targetYear: number,
  operations: NormsYearFdmCoreOperations = defaultOperations,
): Promise<NL2026NormsFillingInput> {
  const timeframe = getYearTimeframeInFdmTimeZone(targetYear)
  const field = await operations.getField(fdm, principal_id, b_id)
  if (!field) {
    throw new Error(`Field with id ${b_id} not found`)
  }
  const [
    has_grazing_intention,
    has_organic_certification,
    cultivations,
    applications,
    fertilizers,
  ] = await Promise.all([
    operations.getGrazingIntention(fdm, principal_id, field.b_id_farm, targetYear),
    operations.isOrganicCertificationValid(
      fdm,
      principal_id,
      field.b_id_farm,
      new Date(targetYear, 4, 15),
    ),
    operations.getCultivations(fdm, principal_id, b_id, timeframe),
    operations.getFertilizerApplications(fdm, principal_id, b_id, timeframe),
    operations.getFertilizers(fdm, principal_id, field.b_id_farm),
  ])
  return {
    cultivations,
    applications,
    fertilizers,
    has_organic_certification,
    has_grazing_intention,
    fosfaatgebruiksnorm,
    b_centroid: field.b_centroid,
  }
}

/**
 * Collects the filling input of every field of a farm for a target year. Mirrors the farm
 * collector of the newest norm year, with the data of the target year.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The ID of the principal.
 * @param b_id_farm - The ID of the farm.
 * @param fosfaatgebruiksnormByField - The phosphate usage norm per field (kg P2O5/ha).
 * @param targetYear - The year that is calculated.
 * @param operations - The fdm-core functions used to collect data. Defaults to fdm-core.
 * @returns The filling input per field, with the dates of the target year.
 */
export async function collectFillingInputForYearForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  fosfaatgebruiksnormByField: Map<string, number>,
  targetYear: number,
  operations: NormsYearFdmCoreOperations = defaultOperations,
): Promise<Map<string, NL2026NormsFillingInput>> {
  const timeframe = getYearTimeframeInFdmTimeZone(targetYear)
  const [
    farmFields,
    has_grazing_intention,
    has_organic_certification,
    fertilizers,
    cultivationsByField,
    applicationsByField,
  ] = await Promise.all([
    operations.getFields(fdm, principal_id, b_id_farm),
    operations.getGrazingIntention(fdm, principal_id, b_id_farm, targetYear),
    operations.isOrganicCertificationValid(
      fdm,
      principal_id,
      b_id_farm,
      new Date(targetYear, 4, 15),
    ),
    operations.getFertilizers(fdm, principal_id, b_id_farm),
    operations.getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    operations.getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
  ])
  const result = new Map<string, NL2026NormsFillingInput>()
  for (const field of farmFields) {
    result.set(field.b_id, {
      cultivations: cultivationsByField.get(field.b_id) ?? [],
      applications: applicationsByField.get(field.b_id) ?? [],
      fertilizers,
      has_organic_certification,
      has_grazing_intention,
      fosfaatgebruiksnorm: fosfaatgebruiksnormByField.get(field.b_id) ?? 0,
      b_centroid: field.b_centroid,
    })
  }
  return result
}

/**
 * Wraps the filling functions of a norm year for a later target year: inputs are collected for
 * the target year and their dates are moved to the norm year before each calculation.
 *
 * @param base - The filling functions of the norm year.
 * @param resolution - The target year and norm year.
 * @param operations - The fdm-core functions used to collect data. Defaults to fdm-core.
 * @returns The wrapped filling functions.
 */
export function createProvisionalFillingFunctions(
  base: LatestFillingFunctions,
  resolution: NormsYearResolution,
  operations: NormsYearFdmCoreOperations = defaultOperations,
): LatestFillingFunctions & NormsYearResolution {
  const years = resolution.targetYear - Number(resolution.normsYear)
  const toNormsYear = (input: NL2026NormsFillingInput) => shiftFillingInput(input, -years)
  return {
    ...resolution,
    collectInputForFertilizerApplicationFilling: (fdm, principal_id, b_id, fosfaatgebruiksnorm) =>
      collectFillingInputForYear(
        fdm,
        principal_id,
        b_id,
        fosfaatgebruiksnorm,
        resolution.targetYear,
        operations,
      ),
    collectInputForFertilizerApplicationFillingForFarm: (
      fdm,
      principal_id,
      b_id_farm,
      fosfaatgebruiksnormByField,
    ) =>
      collectFillingInputForYearForFarm(
        fdm,
        principal_id,
        b_id_farm,
        fosfaatgebruiksnormByField,
        resolution.targetYear,
        operations,
      ),
    calculateFertilizerApplicationFillingForNitrogen: (fdm, input) =>
      base.calculateFertilizerApplicationFillingForNitrogen(fdm, toNormsYear(input)),
    calculateFertilizerApplicationFillingForManure: (fdm, input) =>
      base.calculateFertilizerApplicationFillingForManure(fdm, toNormsYear(input)),
    calculateFertilizerApplicationFillingForPhosphate: (fdm, input) =>
      base.calculateFertilizerApplicationFillingForPhosphate(fdm, toNormsYear(input)),
    calculateFertilizerApplicationFillingForRenure: (fdm, input) =>
      base.calculateFertilizerApplicationFillingForRenure(fdm, toNormsYear(input)),
    aggregateNormFillingsToFarmLevel: base.aggregateNormFillingsToFarmLevel,
  }
}

/**
 * Wraps the uncached filling functions of a norm year for a later target year: inputs are
 * collected for the target year and their dates are moved to the norm year before each
 * calculation.
 *
 * @param base - The uncached filling functions of the norm year.
 * @param resolution - The target year and norm year.
 * @param operations - The fdm-core functions used to collect data. Defaults to fdm-core.
 * @returns The wrapped filling functions.
 */
export function createProvisionalUncachedFillingFunctions(
  base: LatestUncachedFillingFunctions,
  resolution: NormsYearResolution,
  operations: NormsYearFdmCoreOperations = defaultOperations,
): LatestUncachedFillingFunctions & NormsYearResolution {
  const years = resolution.targetYear - Number(resolution.normsYear)
  const toNormsYear = (input: NL2026NormsFillingInput) => shiftFillingInput(input, -years)
  return {
    ...resolution,
    collectInputForFertilizerApplicationFilling: (fdm, principal_id, b_id, fosfaatgebruiksnorm) =>
      collectFillingInputForYear(
        fdm,
        principal_id,
        b_id,
        fosfaatgebruiksnorm,
        resolution.targetYear,
        operations,
      ),
    calculateFertilizerApplicationFillingForNitrogen: (input) =>
      base.calculateFertilizerApplicationFillingForNitrogen(toNormsYear(input)),
    calculateFertilizerApplicationFillingForManure: (input) =>
      base.calculateFertilizerApplicationFillingForManure(toNormsYear(input)),
    calculateFertilizerApplicationFillingForPhosphate: (input) =>
      base.calculateFertilizerApplicationFillingForPhosphate(toNormsYear(input)),
    calculateFertilizerApplicationFillingForRenure: (input) =>
      base.calculateFertilizerApplicationFillingForRenure(toNormsYear(input)),
    aggregateNormFillingsToFarmLevel: base.aggregateNormFillingsToFarmLevel,
  }
}

/**
 * Returns the norm functions for a target year. For a year with its own norms these are the
 * functions of `createFunctionsForNorms`; for a later year the functions of the newest norm year,
 * applied to the data of the target year and marked as provisional.
 *
 * @param b_region - The region. Only `NL` is supported.
 * @param targetYear - The year that is calculated.
 * @returns The norm functions with the norm year that is used.
 */
export function createFunctionsForNormsForYear(
  b_region: "NL",
  targetYear: number,
): NormsFunctionsForYear {
  const resolution = resolveNormsYear(b_region, targetYear)
  if (!resolution.provisional) {
    return { ...createFunctionsForNorms(b_region, resolution.normsYear), ...resolution }
  }
  return createProvisionalNormsFunctions(
    createFunctionsForNorms(b_region, LATEST_NORMS_YEAR),
    resolution,
  )
}

/**
 * Returns the fertilizer application filling functions for a target year. For a year with its own
 * norms these are the functions of `createFunctionsForFertilizerApplicationFilling`; for a later
 * year the functions of the newest norm year, applied to the data of the target year and marked
 * as provisional.
 *
 * @param b_region - The region. Only `NL` is supported.
 * @param targetYear - The year that is calculated.
 * @returns The filling functions with the norm year that is used.
 */
export function createFunctionsForFertilizerApplicationFillingForYear(
  b_region: "NL",
  targetYear: number,
): FillingFunctionsForYear {
  const resolution = resolveNormsYear(b_region, targetYear)
  if (!resolution.provisional) {
    return {
      ...createFunctionsForFertilizerApplicationFilling(b_region, resolution.normsYear),
      ...resolution,
    }
  }
  return createProvisionalFillingFunctions(
    createFunctionsForFertilizerApplicationFilling(b_region, LATEST_NORMS_YEAR),
    resolution,
  )
}

/**
 * Returns the uncached fertilizer application filling functions for a target year, like
 * {@link createFunctionsForFertilizerApplicationFillingForYear}. Use them for proposed plans that
 * are not stored.
 *
 * @param b_region - The region. Only `NL` is supported.
 * @param targetYear - The year that is calculated.
 * @returns The uncached filling functions with the norm year that is used.
 */
export function createUncachedFunctionsForFertilizerApplicationFillingForYear(
  b_region: "NL",
  targetYear: number,
): UncachedFillingFunctionsForYear {
  const resolution = resolveNormsYear(b_region, targetYear)
  if (!resolution.provisional) {
    return {
      ...createUncachedFunctionsForFertilizerApplicationFilling(b_region, resolution.normsYear),
      ...resolution,
    }
  }
  return createProvisionalUncachedFillingFunctions(
    createUncachedFunctionsForFertilizerApplicationFilling(b_region, LATEST_NORMS_YEAR),
    resolution,
  )
}
