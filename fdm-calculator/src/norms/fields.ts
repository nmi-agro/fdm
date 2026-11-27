import type { CachedCalculation, FdmType } from "@nmi-agro/fdm-core"
import type { GebruiksnormResult, NormFilling } from "./nl/types"
import type { NormsYear } from "./years"
import { createFunctionsForFertilizerApplicationFilling, createFunctionsForNorms } from "./index"

/**
 * The manure, phosphate and nitrogen norm (or filling) of a field, and the Renure norm (or
 * filling) for years that have one.
 */
export type NormGroup<T> = {
  manure: T
  phosphate: T
  nitrogen: T
  /** Only set for years with a Renure norm (from 2026). */
  renure?: T
}

/** The norms (or fillings) of a field, or the error that prevented calculating them. */
export type NormGroupResult<T> = { values: NormGroup<T> } | { error: unknown }

/**
 * Calculates the norms (or fillings) of each input with the cached functions. Each norm reads
 * the calculation cache with one query for all inputs and calculates only the misses.
 */
async function calculateNormGroups<T>(
  fdm: FdmType,
  functions: {
    manure: CachedCalculation<object, T>
    phosphate: CachedCalculation<object, T>
    nitrogen: CachedCalculation<object, T>
    renure: CachedCalculation<object, T> | undefined
  },
  inputs: readonly (object | undefined)[],
): Promise<(NormGroupResult<T> | undefined)[]> {
  const requested = inputs.flatMap((input, index) => (input ? [{ input, index }] : []))
  const values = requested.map(({ input }) => input)
  const settle = (fn: CachedCalculation<object, T> | undefined) =>
    fn ? Promise.allSettled(fn.many(fdm, values)) : Promise.resolve(undefined)
  const [manure, phosphate, nitrogen, renure] = await Promise.all([
    settle(functions.manure),
    settle(functions.phosphate),
    settle(functions.nitrogen),
    settle(functions.renure),
  ])

  const results: (NormGroupResult<T> | undefined)[] = inputs.map(() => undefined)
  for (const [i, { index }] of requested.entries()) {
    const group = [manure, phosphate, nitrogen, renure].map((settled) => settled?.[i])
    const rejected = group.find((result) => result?.status === "rejected")
    if (rejected?.status === "rejected") {
      results[index] = { error: rejected.reason }
      continue
    }
    const [m, p, n, r] = group.map((result) =>
      result?.status === "fulfilled" ? result.value : undefined,
    )
    results[index] = {
      values: { manure: m as T, phosphate: p as T, nitrogen: n as T, renure: r },
    }
  }
  return results
}

/**
 * Calculates the legal application norms (gebruiksnormen) of several fields with the cached
 * norm functions of the year. Each norm reads the calculation cache with one query for all
 * fields, instead of one query per field.
 *
 * @param fdm - The FDM instance, used for the calculation cache.
 * @param b_region - The region of the norms.
 * @param year - The year of the norms.
 * @param inputs - The norm input of each field, as collected with `collectInputForNorms` or
 *   `collectInputForNormsForFarm` of {@link createFunctionsForNorms}. An entry may be
 *   `undefined` for a field that should not be calculated.
 * @returns Per input, in the same order: the norms, or the first error in the order manure,
 *   phosphate, nitrogen, Renure; `undefined` for an `undefined` input.
 */
export function calculateNormsForFields(
  fdm: FdmType,
  b_region: "NL",
  year: NormsYear,
  inputs: readonly (object | undefined)[],
): Promise<(NormGroupResult<GebruiksnormResult> | undefined)[]> {
  const functions = createFunctionsForNorms(b_region, year)
  type NormFunction = CachedCalculation<object, GebruiksnormResult>
  return calculateNormGroups(
    fdm,
    {
      manure: functions.calculateNormForManure as NormFunction,
      phosphate: functions.calculateNormForPhosphate as NormFunction,
      nitrogen: functions.calculateNormForNitrogen as NormFunction,
      renure:
        "calculateNormForRenure" in functions
          ? (functions.calculateNormForRenure as NormFunction)
          : undefined,
    },
    inputs,
  )
}

/**
 * Calculates how far the fertilizer applications of several fields fill their legal
 * application norms, with the cached filling functions of the year. Each norm reads the
 * calculation cache with one query for all fields, instead of one query per field.
 *
 * @param fdm - The FDM instance, used for the calculation cache.
 * @param b_region - The region of the norms.
 * @param year - The year of the norms.
 * @param inputs - The filling input of each field, as collected with
 *   `collectInputForFertilizerApplicationFilling(ForFarm)` of
 *   {@link createFunctionsForFertilizerApplicationFilling}. An entry may be `undefined` for a
 *   field that should not be calculated.
 * @returns Per input, in the same order: the fillings, or the first error in the order
 *   manure, phosphate, nitrogen, Renure; `undefined` for an `undefined` input.
 */
export function calculateNormFillingsForFields(
  fdm: FdmType,
  b_region: "NL",
  year: NormsYear,
  inputs: readonly (object | undefined)[],
): Promise<(NormGroupResult<NormFilling> | undefined)[]> {
  const functions = createFunctionsForFertilizerApplicationFilling(b_region, year)
  type FillingFunction = CachedCalculation<object, NormFilling>
  return calculateNormGroups(
    fdm,
    {
      manure: functions.calculateFertilizerApplicationFillingForManure as FillingFunction,
      phosphate: functions.calculateFertilizerApplicationFillingForPhosphate as FillingFunction,
      nitrogen: functions.calculateFertilizerApplicationFillingForNitrogen as FillingFunction,
      renure:
        "calculateFertilizerApplicationFillingForRenure" in functions
          ? (functions.calculateFertilizerApplicationFillingForRenure as FillingFunction)
          : undefined,
    },
    inputs,
  )
}
