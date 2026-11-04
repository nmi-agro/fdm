import type { FdmType, Field, FieldGeometry } from "@nmi-agro/fdm-core"
import type { RvoImportReviewItem, UserChoiceMap } from "./types"
import { applyRvoImport, type RvoImportResult } from "./apply"
import { type ImportChoice, resolveImportChoices } from "./review"
import { getItemId } from "./utils"

type ProcessLocalField = Pick<Field, "b_id"> & Partial<Omit<Field, "b_id">>

/**
 * Processes the RVO import review results by applying one action per review item.
 *
 * Equivalent to {@link resolveImportChoices} followed by `applyRvoImport`, without per-value
 * overrides. Items without a choice, items with `IGNORE` or `NO_ACTION`, and choices for items
 * that are not in the review are left unchanged.
 *
 * @param fdm - The FDM client instance for database operations.
 * @param principal_id - The ID of the principal (user) performing the import.
 * @param b_id_farm - The ID of the farm the fields belong to.
 * @param rvoImportReviewData - The list of review items resulting from the comparison.
 * @param userChoices - A map where keys are item IDs and values are the chosen `ImportReviewAction`.
 * @param year - The calendar year for the import context.
 * @param onFieldAdded - Optional hook called inside the transaction for every added field.
 * @returns The IDs of the created, updated, closed and removed fields.
 * @throws {ImportChoiceError} When a choice does not fit the status of its item.
 */
export async function processRvoImport(
  fdm: FdmType,
  principal_id: string,
  b_id_farm: string,
  rvoImportReviewData: RvoImportReviewItem<ProcessLocalField>[],
  userChoices: UserChoiceMap,
  year: number,
  onFieldAdded?: (tx: FdmType, b_id: string, geometry: FieldGeometry) => Promise<void>,
): Promise<RvoImportResult> {
  const itemIds = new Set(rvoImportReviewData.map((item) => getItemId(item)))
  const choices: Record<string, ImportChoice> = {}
  for (const [item_id, action] of Object.entries(userChoices)) {
    // Choices for items that are not in the review are ignored. `IGNORE` and `NO_ACTION` mean
    // "change nothing" for any item here, as before the review flow gave each status its own
    // action that changes nothing.
    if (!itemIds.has(item_id) || action === "IGNORE" || action === "NO_ACTION") continue
    choices[item_id] = { action }
  }
  const plan = resolveImportChoices(
    rvoImportReviewData as RvoImportReviewItem<Field>[],
    choices,
    year,
  )
  return applyRvoImport(fdm, principal_id, b_id_farm, plan, year, { onFieldAdded })
}
