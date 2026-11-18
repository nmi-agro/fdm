import { type FdmType, withCalculationCache } from "@nmi-agro/fdm-core"
import type {
  NitrogenBalanceFieldInput,
  NitrogenBalanceFieldNumeric,
  NitrogenBalanceFieldResultNumeric,
  NitrogenBalanceInput,
  NitrogenBalanceNumeric,
} from "./types"
import pkg from "../../package"
import { calculateNitrogenBalanceField, calculateNitrogenBalancesFieldToFarm } from "./field"

/**
 * Calculates the nitrogen balance for an entire farm.
 *
 * This function orchestrates the nitrogen balance calculation for all fields on a farm.
 * It calls `getNitrogenBalanceField` for each field and then aggregates the results
 * using `calculateNitrogenBalancesFieldToFarm`.
 *
 * @param fdm - The FDM instance for database access (caching).
 * @param nitrogenBalanceInput - The input data for the nitrogen balance calculation, including all fields.
 *   Set `useEffectiveNitrogen: true` to calculate the supply by fertilizers with effective nitrogen.
 * @returns A promise that resolves with the aggregated nitrogen balance for the farm.
 */
export async function calculateNitrogenBalance(
  fdm: FdmType,
  nitrogenBalanceInput: NitrogenBalanceInput,
) {
  return calculateNitrogenBalanceForFarms(fdm, [
    {
      ...nitrogenBalanceInput,
      b_id_farm:
        (
          nitrogenBalanceInput as NitrogenBalanceInput & {
            b_id_farm?: string
          }
        ).b_id_farm ?? "farm",
    },
  ])
}

/**
 * Calculates the nitrogen balance for all the farms.
 *
 * This function orchestrates the nitrogen balance calculation for all fields on multiple farms.
 * It calls `getNitrogenBalanceField` for each field and then aggregates the results
 * using `calculateNitrogenBalancesFieldToFarm`.
 *
 * @param fdm - The FDM instance for database access (caching).
 * @param inputs - The input data for the nitrogen balance calculation for multiple farms.
 * @returns A promise that resolves an array where each item is the aggregated nitrogen balance of a farm,
 * including the b_id_farm.
 */
export async function calculateNitrogenBalanceForFarms(
  fdm: FdmType,
  inputs: (NitrogenBalanceInput & { b_id_farm: string })[],
) {
  const fieldInputs: (NitrogenBalanceFieldInput & { b_id_farm: string })[] = inputs.flatMap(
    (input) =>
      input.fields.map((field) => ({
        b_id_farm: input.b_id_farm,
        fieldInput: field,
        fertilizerDetails: input.fertilizerDetails,
        cultivationDetails: input.cultivationDetails,
        timeFrame: input.timeFrame,
        useEffectiveNitrogen: input.useEffectiveNitrogen,
      })),
  )
  return calculateNitrogenBalanceBatched(fdm, fieldInputs)
}

async function calculateNitrogenBalanceBatched(
  fdm: FdmType,
  fieldInputs: NitrogenBalanceFieldInput[],
): Promise<NitrogenBalanceNumeric> {
  // Fail early if no fields are in input
  if (fieldInputs.length === 0) {
    const errorMessage = "No fields in input"
    return {
      errorMessage,
      ...calculateNitrogenBalancesFieldToFarm([], true, [errorMessage]),
    }
  }

  // Look up all fields in the cache at once and calculate only the misses
  const balances = await Promise.allSettled(
    getNitrogenBalanceFieldCached.many(fdm, fieldInputs.map(toCacheInput)),
  )
  const fieldsWithBalanceResults: NitrogenBalanceFieldResultNumeric[] = fieldInputs.map(
    (fieldInput, index) => {
      const result = balances[index]
      const field = {
        b_id: fieldInput.fieldInput.field.b_id,
        b_area: fieldInput.fieldInput.field.b_area ?? 0,
        b_bufferstrip: fieldInput.fieldInput.field.b_bufferstrip ?? false,
      }
      return result.status === "fulfilled"
        ? { ...field, balance: result.value }
        : {
            ...field,
            errorMessage:
              result.reason instanceof Error ? result.reason.message : String(result.reason),
          }
    },
  )

  const hasErrors = fieldsWithBalanceResults.some((result) => result.errorMessage !== undefined)
  const fieldErrorMessages = fieldsWithBalanceResults
    .filter((result) => result.errorMessage !== undefined)
    .map((result) => result.errorMessage as string)

  return calculateNitrogenBalancesFieldToFarm(
    fieldsWithBalanceResults,
    hasErrors,
    fieldErrorMessages,
  )
}

const getNitrogenBalanceFieldCached = withCalculationCache(
  calculateNitrogenBalanceField,
  "calculateNitrogenBalanceField",
  pkg.calculatorVersion,
)

/**
 * Returns the input for the cache. The option `useEffectiveNitrogen` is only included when it is
 * enabled, so that the cache key for the balance with total nitrogen does not depend on whether
 * the caller passed `false` or left it out.
 */
function toCacheInput(nitrogenBalanceInput: NitrogenBalanceFieldInput): NitrogenBalanceFieldInput {
  const { useEffectiveNitrogen, ...input } = nitrogenBalanceInput
  return useEffectiveNitrogen ? { ...input, useEffectiveNitrogen: true } : input
}

/**
 * A cached version of the `calculateNitrogenBalanceField` function.
 *
 * This function provides the same functionality as `calculateNitrogenBalanceField` but
 * includes a caching mechanism to improve performance for repeated calls with the
 * same input. The cache is managed by `withCalculationCache` and uses the
 * `pkg.calculatorVersion` as part of its cache key.
 *
 * `useEffectiveNitrogen: false` and an omitted `useEffectiveNitrogen` give the same result and
 * therefore share the same cache entry.
 *
 * @param fdm - The FDM instance for database access (caching).
 * @param nitrogenBalanceInput - The input data for the nitrogen balance calculation for a single field.
 * @returns A promise that resolves with the calculated nitrogen balance, with numeric values as numbers.
 */
export function getNitrogenBalanceField(
  fdm: FdmType,
  nitrogenBalanceInput: NitrogenBalanceFieldInput,
): Promise<NitrogenBalanceFieldNumeric> {
  return getNitrogenBalanceFieldCached(fdm, toCacheInput(nitrogenBalanceInput))
}

export { calculateNitrogenBalanceField, calculateNitrogenBalancesFieldToFarm } from "./field"
