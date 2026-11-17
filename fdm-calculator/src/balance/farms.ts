import type { FdmType, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import type { NitrogenBalanceFieldResultNumeric, NitrogenBalanceNumeric } from "./nitrogen/types"
import type {
  OrganicMatterBalanceFieldResultNumeric,
  OrganicMatterBalanceNumeric,
} from "./organic-matter/types"
import { calculateNitrogenBalanceForFarms, calculateNitrogenBalancesFieldToFarm } from "./nitrogen"
import { collectInputForNitrogenBalanceForFarms } from "./nitrogen/input"
import {
  calculateOrganicMatterBalanceForFarms,
  calculateOrganicMatterBalancesFieldToFarm,
} from "./organic-matter"
import { collectInputForOrganicMatterBalanceForFarms } from "./organic-matter/input"

/** The balance of one farm within a multi-farm calculation. */
export type FarmBalanceResult<T> = {
  /** The farm. */
  b_id_farm: string
  /** The balance of the farm. Absent when it could not be calculated. */
  balance?: T
  /** Why the balance of the farm could not be calculated. */
  errorMessage?: string
}

/** The balance of several farms: the combined balance and the balance per farm. */
export type MultiFarmBalance<T> = {
  /** The balance of all fields of all farms together. */
  total: T
  /** The balance per farm, in the order of the requested farm IDs. */
  farms: FarmBalanceResult<T>[]
}

type FieldResult = { b_id: string; errorMessage?: string }

/**
 * Splits field results of a multi-farm calculation into one balance per farm.
 */
function splitPerFarm<TField extends FieldResult, TFarm>(
  farmIds: string[],
  inputs: { b_id_farm: string; fields: { field: { b_id: string } }[] }[],
  fieldResults: TField[],
  aggregate: (fields: TField[], hasErrors: boolean, messages: string[]) => TFarm,
): FarmBalanceResult<TFarm>[] {
  const farmOfField = new Map<string, string>()
  for (const input of inputs) {
    for (const fieldInput of input.fields) farmOfField.set(fieldInput.field.b_id, input.b_id_farm)
  }
  const fieldsPerFarm = new Map<string, TField[]>()
  for (const result of fieldResults) {
    const b_id_farm = farmOfField.get(result.b_id)
    if (!b_id_farm) continue
    const list = fieldsPerFarm.get(b_id_farm) ?? []
    list.push(result)
    fieldsPerFarm.set(b_id_farm, list)
  }

  return [...new Set(farmIds)].map((b_id_farm) => {
    const fields = fieldsPerFarm.get(b_id_farm) ?? []
    if (fields.length === 0) return { b_id_farm, errorMessage: "No fields in input" }
    try {
      const messages = fields
        .map((field) => field.errorMessage)
        .filter((message): message is string => message !== undefined)
      return { b_id_farm, balance: aggregate(fields, messages.length > 0, messages) }
    } catch (error) {
      return { b_id_farm, errorMessage: error instanceof Error ? error.message : String(error) }
    }
  })
}

/**
 * Calculates the nitrogen balance of several farms: the balance of all their fields together
 * and the balance per farm. A field that cannot be calculated is reported in the result of its
 * farm and does not stop the others.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal requesting the balance. Needs read access to every farm.
 * @param farmIds - The farms.
 * @param timeframe - The period of the balance.
 * @returns The combined balance and the balance per farm.
 */
export async function getNitrogenBalanceForFarms(
  fdm: FdmType,
  principal_id: PrincipalId,
  farmIds: string[],
  timeframe: Timeframe,
): Promise<MultiFarmBalance<NitrogenBalanceNumeric>> {
  const inputs = await collectInputForNitrogenBalanceForFarms(fdm, principal_id, farmIds, timeframe)
  const total = await calculateNitrogenBalanceForFarms(fdm, inputs)
  const farms = splitPerFarm(
    farmIds,
    inputs,
    total.fields as NitrogenBalanceFieldResultNumeric[],
    calculateNitrogenBalancesFieldToFarm,
  )
  return { total, farms }
}

/**
 * Calculates the organic matter balance of several farms: the balance of all their fields
 * together and the balance per farm. A field that cannot be calculated is reported in the result
 * of its farm and does not stop the others.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal requesting the balance. Needs read access to every farm.
 * @param farmIds - The farms.
 * @param timeframe - The period of the balance.
 * @returns The combined balance and the balance per farm.
 */
export async function getOrganicMatterBalanceForFarms(
  fdm: FdmType,
  principal_id: PrincipalId,
  farmIds: string[],
  timeframe: Timeframe,
): Promise<MultiFarmBalance<OrganicMatterBalanceNumeric>> {
  const inputs = await collectInputForOrganicMatterBalanceForFarms(
    fdm,
    principal_id,
    farmIds,
    timeframe,
  )
  const total = await calculateOrganicMatterBalanceForFarms(fdm, inputs)
  const farms = splitPerFarm(
    farmIds,
    inputs,
    total.fields as OrganicMatterBalanceFieldResultNumeric[],
    calculateOrganicMatterBalancesFieldToFarm,
  )
  return { total, farms }
}
