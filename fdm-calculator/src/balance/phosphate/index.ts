import { type FdmType, withCalculationCache } from "@nmi-agro/fdm-core"
import type {
  PhosphateBalance,
  PhosphateBalanceFieldInput,
  PhosphateBalanceFieldResult,
  PhosphateBalanceInput,
} from "./types"
import pkg from "../../package"
import {
  calculatePhosphateBalanceField,
  calculatePhosphateBalancesFieldToFarm,
  getPhosphateFieldExclusion,
} from "./field"

/**
 * Calculates the phosphate balance of a farm as the area-weighted average per ha of its fields.
 *
 * This function orchestrates the calculation for all fields of the farm. Buffer strips, nature and
 * landscape elements are not calculated (`exclusion`, see `getPhosphateFieldExclusion`) and not part
 * of the farm average. A failing field is reported in `fields[].errorMessage` instead of failing the
 * farm.
 *
 * @param fdm - The FDM instance for database access (caching).
 * @param phosphateBalanceInput - The farm input.
 * @returns The farm balance and the results per field.
 * @alpha
 */
export async function calculatePhosphateBalance(
  fdm: FdmType,
  phosphateBalanceInput: PhosphateBalanceInput,
): Promise<PhosphateBalance> {
  return calculatePhosphateBalanceForFarms(fdm, [
    {
      ...phosphateBalanceInput,
      b_id_farm:
        (phosphateBalanceInput as PhosphateBalanceInput & { b_id_farm?: string }).b_id_farm ??
        "farm",
    },
  ])
}

/**
 * Calculates the phosphate balance of all fields of several farms together.
 *
 * Each field is calculated with the fertilizer and cultivation details of its own farm, and with its
 * own earlier years for the long-term average. Use `getPhosphateBalanceForFarms` for the balance per
 * farm as well.
 *
 * @param fdm - The FDM instance for database access (caching).
 * @param inputs - The input per farm, with its `b_id_farm`.
 * @returns The balance of all fields together, with the results per field.
 * @alpha
 */
export async function calculatePhosphateBalanceForFarms(
  fdm: FdmType,
  inputs: (PhosphateBalanceInput & { b_id_farm: string })[],
): Promise<PhosphateBalance> {
  const fieldInputs: PhosphateBalanceFieldInput[] = inputs.flatMap((input) =>
    input.fields.map((fieldInput) => {
      const history = (input.history ?? []).flatMap((year) => {
        const past = year.fields.find((f) => f.field.b_id === fieldInput.field.b_id)
        return past ? [{ timeFrame: year.timeFrame, fieldInput: past }] : []
      })
      return {
        fieldInput,
        fertilizerDetails: input.fertilizerDetails,
        cultivationDetails: input.cultivationDetails,
        timeFrame: input.timeFrame,
        ...(history.length > 0 ? { history } : {}),
      }
    }),
  )
  return calculatePhosphateBalanceBatched(fdm, fieldInputs)
}

async function calculatePhosphateBalanceBatched(
  fdm: FdmType,
  fieldInputs: PhosphateBalanceFieldInput[],
): Promise<PhosphateBalance> {
  // Fail early if no fields are in input
  if (fieldInputs.length === 0) {
    const errorMessage = "No fields in input"
    return {
      errorMessage,
      ...calculatePhosphateBalancesFieldToFarm([], true, [errorMessage]),
    }
  }

  // Excluded fields are not calculated; look up the others in the cache at once and calculate only
  // the misses
  const exclusions = fieldInputs.map((input) =>
    getPhosphateFieldExclusion(input.fieldInput, input.timeFrame),
  )
  const calculated = fieldInputs.filter((_, index) => exclusions[index] === null)
  const balances = await Promise.allSettled(getPhosphateBalanceField.many(fdm, calculated))

  let next = 0
  const fieldsWithBalanceResults: PhosphateBalanceFieldResult[] = fieldInputs.map(
    (input, index) => {
      const field = {
        b_id: input.fieldInput.field.b_id,
        b_area: input.fieldInput.field.b_area ?? 0,
        b_bufferstrip: input.fieldInput.field.b_bufferstrip ?? false,
      }
      const exclusion = exclusions[index]
      if (exclusion) return { ...field, exclusion }
      const result = balances[next++]
      return result.status === "fulfilled"
        ? { ...field, balance: result.value }
        : {
            ...field,
            errorMessage:
              result.reason instanceof Error ? result.reason.message : String(result.reason),
          }
    },
  )

  const fieldErrorMessages = fieldsWithBalanceResults
    .filter((result) => result.errorMessage !== undefined)
    .map((result) => result.errorMessage as string)

  return calculatePhosphateBalancesFieldToFarm(
    fieldsWithBalanceResults,
    fieldErrorMessages.length > 0,
    fieldErrorMessages,
  )
}

/**
 * Cached version of `calculatePhosphateBalanceField` (same input and output). The cache key includes
 * `pkg.calculatorVersion`, so results are recalculated after a calculator release.
 *
 * @alpha
 */
export const getPhosphateBalanceField = withCalculationCache(
  calculatePhosphateBalanceField,
  "calculatePhosphateBalanceField",
  pkg.calculatorVersion,
)

export {
  calculatePhosphateBalanceField,
  calculatePhosphateBalancesFieldToFarm,
  getPhosphateFieldExclusion,
} from "./field"
