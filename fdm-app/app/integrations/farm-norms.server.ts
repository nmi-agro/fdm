import type {
  BaseFertilizerApplication,
  CachedCalculation,
  FdmType,
  Field,
  PrincipalId,
} from "@nmi-agro/fdm-core"
import {
  type AggregatedNormFillingsToFarmLevel,
  type AggregatedNormsToFarmLevel,
  aggregateNormFillingsToFarmLevel,
  aggregateNormsToFarmLevel,
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  type GebruiksnormResult,
  type NormFilling,
  NormNotApplicableError,
} from "@nmi-agro/fdm-calculator"
import type { FieldNormFillings, FieldNormValues } from "~/integrations/calculator"

/** The calendar years for which legal application norms (gebruiksnormen) are available. */
export type NormsCalendar = "2025" | "2026"

/**
 * Returns whether legal application norms are available for the given calendar.
 *
 * @param calendar - The calendar year, as used in the route.
 * @returns `true` for 2025 and 2026.
 */
export function isNormsCalendar(calendar: string): calendar is NormsCalendar {
  return calendar === "2025" || calendar === "2026"
}

/** The norms and fillings of a single field, or the reason why they could not be calculated. */
export interface FieldNormsResult {
  b_id: string
  b_area: number
  norms?: FieldNormValues
  normsFilling?: FieldNormFillings
  errorMessage?: string
  /** `true` when the norm does not apply to the field, rather than having failed. */
  isWarning?: boolean
}

/** The norms and fillings of a farm, aggregated from its fields. */
export interface FarmNormsResult {
  fieldNorms: FieldNormsResult[]
  /** The farm norms in kg (total over all fields). */
  farmNorms: AggregatedNormsToFarmLevel
  /** The farm fillings in kg (total over all fields). */
  farmFillings: AggregatedNormFillingsToFarmLevel
  hasFieldNormErrors: boolean
  fieldErrorMessages: string[]
  fieldWarningMessages: string[]
}

type FillingInput = {
  applications: BaseFertilizerApplication[]
  [key: string]: unknown
}

/**
 * The data needed to calculate the norms and fillings of all fields of a farm. Collect it once
 * with {@link collectFarmNormsContext} and reuse it for the current state and for previews.
 */
export interface FarmNormsContext {
  calendar: NormsCalendar
  fields: Pick<Field, "b_id" | "b_name" | "b_area">[]
  /** Norm values per field. A field is missing when its norms could not be calculated. */
  normValues: Map<string, FieldNormValues>
  /** Errors per field for the norm values. */
  normErrors: Map<string, unknown>
  /** Input for the filling calculation per field. */
  fillingInputs: Map<string, FillingInput>
}

/** The manure, phosphate, nitrogen and (from 2026) renure norm or filling of one field. */
type NormGroup<T> = { manure: T; phosphate: T; nitrogen: T; renure: T | undefined }

/** The cached calculator functions for each norm, or for each filling. */
type NormGroupFunctions<T> = NormGroup<CachedCalculation<object, T>>

/**
 * Calculates the norms (or fillings) of the given fields. Each norm function looks up all
 * fields in the calculation cache with one query and calculates only the misses.
 *
 * @param inputs - The calculator input per field ID.
 * @returns Per field ID, the values, or the first error in the order manure, phosphate,
 *   nitrogen, renure.
 */
async function calculateNormGroups<T>(
  fdm: FdmType,
  functions: NormGroupFunctions<T>,
  inputs: Map<string, object>,
): Promise<Map<string, { values: NormGroup<T> } | { error: unknown }>> {
  const values = [...inputs.values()]
  const settle = (fn: CachedCalculation<object, T> | undefined) =>
    fn ? Promise.allSettled(fn.many(fdm, values)) : Promise.resolve(undefined)
  const [manure, phosphate, nitrogen, renure] = await Promise.all([
    settle(functions.manure),
    settle(functions.phosphate),
    settle(functions.nitrogen),
    settle(functions.renure),
  ])

  const results = new Map<string, { values: NormGroup<T> } | { error: unknown }>()
  for (const [index, b_id] of [...inputs.keys()].entries()) {
    const group = [manure, phosphate, nitrogen, renure].map((settled) => settled?.[index])
    const rejected = group.find((result) => result?.status === "rejected")
    if (rejected?.status === "rejected") {
      results.set(b_id, { error: rejected.reason })
      continue
    }
    const [m, p, n, r] = group.map((result) =>
      result?.status === "fulfilled" ? result.value : undefined,
    )
    results.set(b_id, {
      values: { manure: m as T, phosphate: p as T, nitrogen: n as T, renure: r },
    })
  }
  return results
}

/** Returns the cached norm functions of the calendar year. */
function getNormFunctions(calendar: NormsCalendar): NormGroupFunctions<GebruiksnormResult> {
  const functions = createFunctionsForNorms("NL", calendar)
  return {
    manure: functions.calculateNormForManure as CachedCalculation<object, GebruiksnormResult>,
    phosphate: functions.calculateNormForPhosphate as CachedCalculation<object, GebruiksnormResult>,
    nitrogen: functions.calculateNormForNitrogen as CachedCalculation<object, GebruiksnormResult>,
    renure:
      "calculateNormForRenure" in functions
        ? (functions.calculateNormForRenure as CachedCalculation<object, GebruiksnormResult>)
        : undefined,
  }
}

/** Returns the cached filling functions of the calendar year. */
function getFillingFunctions(calendar: NormsCalendar): NormGroupFunctions<NormFilling> {
  const functions = createFunctionsForFertilizerApplicationFilling("NL", calendar)
  return {
    manure: functions.calculateFertilizerApplicationFillingForManure as CachedCalculation<
      object,
      NormFilling
    >,
    phosphate: functions.calculateFertilizerApplicationFillingForPhosphate as CachedCalculation<
      object,
      NormFilling
    >,
    nitrogen: functions.calculateFertilizerApplicationFillingForNitrogen as CachedCalculation<
      object,
      NormFilling
    >,
    renure:
      "calculateFertilizerApplicationFillingForRenure" in functions
        ? (functions.calculateFertilizerApplicationFillingForRenure as CachedCalculation<
            object,
            NormFilling
          >)
        : undefined,
  }
}

/** The input of the given fields; a field without input gets an error. */
function selectInputs<T extends object>(
  fields: Pick<Field, "b_id">[],
  inputs: Map<string, T>,
): { found: Map<string, T>; missing: string[] } {
  const found = new Map<string, T>()
  const missing: string[] = []
  for (const field of fields) {
    const input = inputs.get(field.b_id)
    if (input) found.set(field.b_id, input)
    else missing.push(field.b_id)
  }
  return { found, missing }
}

const FIELD_NOT_FOUND_MESSAGE = "Perceel niet gevonden voor dit jaar."

/**
 * Collects the norm values and the filling input for all given fields of a farm.
 *
 * The norm values are calculated with the cached calculator functions. The input for both
 * the norms and the fillings is collected once for the whole farm.
 *
 * @param params.fields - The fields to include, typically the fields of the farm in the calendar year.
 * @returns The context to pass to {@link calculateFarmNorms}.
 */
export async function collectFarmNormsContext({
  fdm,
  principal_id,
  b_id_farm,
  calendar,
  fields,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: string
  calendar: NormsCalendar
  fields: Pick<Field, "b_id" | "b_name" | "b_area">[]
}): Promise<FarmNormsContext> {
  const normInputs = (await createFunctionsForNorms("NL", calendar).collectInputForNormsForFarm(
    fdm,
    principal_id,
    b_id_farm,
  )) as Map<string, object>

  const normValues = new Map<string, FieldNormValues>()
  const normErrors = new Map<string, unknown>()
  const { found, missing } = selectInputs(fields, normInputs)
  for (const b_id of missing) {
    normErrors.set(b_id, new Error(FIELD_NOT_FOUND_MESSAGE))
  }
  const results = await calculateNormGroups(fdm, getNormFunctions(calendar), found)
  for (const [b_id, result] of results) {
    if ("error" in result) normErrors.set(b_id, result.error)
    else normValues.set(b_id, result.values)
  }

  const phosphateNormByField = new Map<string, number>()
  for (const [b_id, value] of normValues) {
    phosphateNormByField.set(b_id, value.phosphate.normValue)
  }

  const fillingFunctions = createFunctionsForFertilizerApplicationFilling("NL", calendar)
  const fillingInputs = (await fillingFunctions.collectInputForFertilizerApplicationFillingForFarm(
    fdm,
    principal_id,
    b_id_farm,
    phosphateNormByField,
  )) as Map<string, FillingInput>

  return { calendar, fields, normValues, normErrors, fillingInputs }
}

/**
 * Turns a norm calculation error into a short Dutch message for the user.
 *
 * @param error - The error thrown by the calculator.
 * @returns The message, and whether the error means the norm does not apply.
 */
export function toFriendlyNormError(error: unknown): { message: string; isWarning: boolean } {
  let message = String(error).replace("NormNotApplicableError: ", "").replace("Error: ", "")
  if (message.toLowerCase().includes("missing soil analysis data")) {
    message = "Voeg een bodemanalyse toe om de fosfaatgebruiksnorm te berekenen."
  }
  return { message, isWarning: error instanceof NormNotApplicableError }
}

/**
 * Calculates the norms and fillings of each field with the cached calculator functions and
 * aggregates them to farm level.
 *
 * @param fdm - The FDM instance.
 * @param context - The context from {@link collectFarmNormsContext}.
 * @returns The norms and fillings per field and for the farm (kg, total).
 */
export async function calculateFarmNorms(
  fdm: FdmType,
  context: FarmNormsContext,
): Promise<FarmNormsResult> {
  const toErrorResult = (field: (typeof context.fields)[number], error: unknown) => {
    const { message, isWarning } = toFriendlyNormError(error)
    return {
      b_id: field.b_id,
      b_area: field.b_area ?? 0,
      errorMessage: message,
      isWarning: isWarning || undefined,
    }
  }

  // Fillings are only calculated for fields whose norms could be calculated
  const fieldsWithNorms = context.fields.filter((field) => context.normValues.has(field.b_id))
  const { found } = selectInputs(fieldsWithNorms, context.fillingInputs)
  const fillings = await calculateNormGroups<NormFilling>(
    fdm,
    getFillingFunctions(context.calendar),
    found,
  )

  const fieldNorms: FieldNormsResult[] = context.fields.map((field): FieldNormsResult => {
    const norms = context.normValues.get(field.b_id)
    if (!norms) {
      return toErrorResult(field, context.normErrors.get(field.b_id) ?? "Onbekende fout.")
    }
    const filling = fillings.get(field.b_id)
    if (!filling) {
      return { ...toErrorResult(field, new Error(FIELD_NOT_FOUND_MESSAGE)), norms }
    }
    if ("error" in filling) {
      return { ...toErrorResult(field, filling.error), norms }
    }
    const normsFilling: FieldNormFillings = filling.values
    return { b_id: field.b_id, b_area: field.b_area ?? 0, norms, normsFilling }
  })

  const names = new Map(context.fields.map((field) => [field.b_id, field.b_name]))
  const fieldErrorMessages: string[] = []
  const fieldWarningMessages: string[] = []
  for (const field of fieldNorms) {
    if (!field.errorMessage) continue
    const message = `${names.get(field.b_id) || `Perceel ${field.b_id}`}: ${field.errorMessage}`
    if (field.isWarning) fieldWarningMessages.push(message)
    else fieldErrorMessages.push(message)
  }
  const hasFieldNormErrors = fieldErrorMessages.length > 0

  const farmNorms = aggregateNormsToFarmLevel(
    fieldNorms.flatMap((field) =>
      field.norms ? [{ b_id: field.b_id, b_area: field.b_area, norms: field.norms }] : [],
    ),
  )
  const farmFillings = aggregateNormFillingsToFarmLevel(
    fieldNorms.flatMap((field) =>
      field.normsFilling
        ? [{ b_id: field.b_id, b_area: field.b_area, normsFilling: field.normsFilling }]
        : [],
    ),
  )

  return {
    fieldNorms,
    farmNorms,
    farmFillings,
    hasFieldNormErrors,
    fieldErrorMessages,
    fieldWarningMessages,
  }
}
