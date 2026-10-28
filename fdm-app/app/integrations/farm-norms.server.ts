import type { BaseFertilizerApplication, FdmType, Field, PrincipalId } from "@nmi-agro/fdm-core"
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

/** Number of fields whose norms are calculated at the same time. */
const FARM_NORMS_CONCURRENCY = 8

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

type CachedNormFunction = (fdm: FdmType, input: unknown) => Promise<GebruiksnormResult>
type CachedFillingFunction = (fdm: FdmType, input: unknown) => Promise<NormFilling>

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

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
  const normFunctions = createFunctionsForNorms("NL", calendar)
  const normInputs = (await normFunctions.collectInputForNormsForFarm(
    fdm,
    principal_id,
    b_id_farm,
  )) as Map<string, unknown>

  const calculateNitrogen = normFunctions.calculateNormForNitrogen as CachedNormFunction
  const calculateManure = normFunctions.calculateNormForManure as CachedNormFunction
  const calculatePhosphate = normFunctions.calculateNormForPhosphate as CachedNormFunction
  const calculateRenure =
    "calculateNormForRenure" in normFunctions
      ? (normFunctions.calculateNormForRenure as CachedNormFunction)
      : undefined

  const normValues = new Map<string, FieldNormValues>()
  const normErrors = new Map<string, unknown>()
  for (const batch of chunk(fields, FARM_NORMS_CONCURRENCY)) {
    await Promise.all(
      batch.map(async (field) => {
        try {
          const input = normInputs.get(field.b_id)
          if (!input) throw new Error("Perceel niet gevonden voor dit jaar.")
          const [manure, phosphate, nitrogen, renure] = await Promise.all([
            calculateManure(fdm, input),
            calculatePhosphate(fdm, input),
            calculateNitrogen(fdm, input),
            calculateRenure ? calculateRenure(fdm, input) : Promise.resolve(undefined),
          ])
          normValues.set(field.b_id, { manure, phosphate, nitrogen, renure })
        } catch (error) {
          normErrors.set(field.b_id, error)
        }
      }),
    )
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

/** Calculates the fillings of a single field with the cached calculator functions. */
async function calculateFieldFillings(
  fdm: FdmType,
  calendar: NormsCalendar,
  input: FillingInput,
): Promise<FieldNormFillings> {
  const functions = createFunctionsForFertilizerApplicationFilling("NL", calendar)
  const renure =
    "calculateFertilizerApplicationFillingForRenure" in functions
      ? (functions.calculateFertilizerApplicationFillingForRenure as CachedFillingFunction)
      : undefined
  const [manure, phosphate, nitrogen, renureFilling] = await Promise.all([
    (functions.calculateFertilizerApplicationFillingForManure as CachedFillingFunction)(fdm, input),
    (functions.calculateFertilizerApplicationFillingForPhosphate as CachedFillingFunction)(
      fdm,
      input,
    ),
    (functions.calculateFertilizerApplicationFillingForNitrogen as CachedFillingFunction)(
      fdm,
      input,
    ),
    renure ? renure(fdm, input) : Promise.resolve(undefined),
  ])
  return { manure, phosphate, nitrogen, renure: renureFilling }
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

  const fieldNorms: FieldNormsResult[] = []
  for (const batch of chunk(context.fields, FARM_NORMS_CONCURRENCY)) {
    const results = await Promise.all(
      batch.map(async (field): Promise<FieldNormsResult> => {
        const norms = context.normValues.get(field.b_id)
        if (!norms) {
          return toErrorResult(field, context.normErrors.get(field.b_id) ?? "Onbekende fout.")
        }
        try {
          const input = context.fillingInputs.get(field.b_id)
          if (!input) throw new Error("Perceel niet gevonden voor dit jaar.")
          const normsFilling = await calculateFieldFillings(fdm, context.calendar, input)
          return { b_id: field.b_id, b_area: field.b_area ?? 0, norms, normsFilling }
        } catch (error) {
          return { ...toErrorResult(field, error), norms }
        }
      }),
    )
    fieldNorms.push(...results)
  }

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
