import { useMemo } from "react"
import type { BulkCurrentState, BulkFieldIssue, BulkFieldOption, BulkNormKey } from "./types"
import {
  buildFieldImpactRows,
  type FieldImpactRow,
  getAgronomicNotes,
  getNormOutcomes,
  summarizeAdvice,
  summarizeBalance,
} from "./aggregate"
import { FIELD_STATUS_LABELS } from "./status"
import { type PreviewChanges, useLocalImpactPreview, useSettled } from "./use-impact-preview"

/** The reason why an included field is left out of an aggregation. */
function toIssue(row: FieldImpactRow): BulkFieldIssue {
  const status = row.statuses.find((s) => s !== "ok" && s !== "over_advice" && s !== "over_target")
  return {
    b_id: row.b_id,
    b_name: row.b_name,
    message: row.messages[0] ?? (status ? FIELD_STATUS_LABELS[status] : "Wordt nog berekend"),
  }
}

/**
 * Combines the streamed current state of a page with the preview of unsaved changes into
 * everything the impact blocks and the field table show.
 *
 * Used by the bulk page, the field page and the page to change applications, so that they show
 * the same numbers in the same way.
 *
 * @param params.current - The streamed current state from `loadBulkCurrentState`.
 * @param params.fields - The fields to show and aggregate.
 * @param params.included - The fields that count in the advice and balance aggregation.
 * @param params.fieldNames - Names of all fields of the farm.
 * @param params.cultivationIds - In the rotation flow, the selected crop. Empty otherwise.
 * @param params.changes - The changes to preview, or `null` when the form is not complete.
 * @param params.pending - Whether newer form values are still being debounced.
 */
export function useImpactState({
  current,
  fields,
  included,
  fieldNames,
  cultivationIds = [],
  changes,
  pending,
}: {
  current: BulkCurrentState
  fields: BulkFieldOption[]
  included: Set<string>
  fieldNames: Map<string, string>
  cultivationIds?: string[]
  changes: PreviewChanges | null
  pending: boolean
}) {
  const farmNormsResult = useSettled(current.farmNorms)
  const adviceResult = useSettled(current.advice)
  const balanceResult = useSettled(current.balance)
  const previewInput = useSettled(current.previewInput)

  const norms = farmNormsResult?.status === "ok" ? farmNormsResult.data : undefined
  const preview = useLocalImpactPreview({
    previewInput: previewInput?.status === "ok" ? previewInput.data : undefined,
    changes,
    pending,
    farmNorms: norms,
    fieldNames,
  })

  const impactPreview = preview.impact?.status === "ok" ? preview.impact : undefined
  const balancePreview = preview.balance?.status === "ok" ? preview.balance : undefined
  const previewMessage =
    preview.impact?.status === "invalid"
      ? preview.impact.message
      : preview.balance?.status === "invalid"
        ? preview.balance.message
        : undefined

  const rows = useMemo(
    () =>
      buildFieldImpactRows({
        fields,
        included,
        cultivationIds,
        advice: adviceResult?.status === "ok" ? adviceResult.data : undefined,
        balance: balanceResult?.status === "ok" ? balanceResult.data : undefined,
        previewDoses: impactPreview?.doses,
        previewBalance: balancePreview?.fields,
        fieldNorms:
          farmNormsResult?.status === "ok" ? farmNormsResult.data.selectedFields : undefined,
        previewNormFillings: impactPreview?.norms?.fieldsAfter,
      }),
    [
      fields,
      included,
      cultivationIds,
      adviceResult,
      balanceResult,
      impactPreview,
      balancePreview,
      farmNormsResult,
    ],
  )
  const adviceSummary = useMemo(() => summarizeAdvice(rows), [rows])
  const balanceSummary = useMemo(() => summarizeBalance(rows), [rows])
  const adviceIssues = rows
    .filter((row) => row.included && (!row.advice || row.statuses.includes("bufferstrip")))
    .map(toIssue)
  const balanceIssues = rows
    .filter((row) => row.included && (!row.balance || row.statuses.includes("bufferstrip")))
    .map(toIssue)

  const normsAfter = impactPreview?.norms
  const normOutcomes =
    norms?.farmNorms && norms.farmFillings && normsAfter
      ? getNormOutcomes(norms.farmNorms, normsAfter.current, normsAfter.after, norms.showRenure)
      : []

  /** The outcomes of a single field, in kg per ha, for pages that show the norms of one field. */
  const getFieldNormOutcomes = (b_id: string) => {
    const field = norms?.selectedFields?.[b_id]
    const after = normsAfter?.fieldsAfter[b_id]
    return field && after
      ? getNormOutcomes(field.norms, field.fillings, after, norms?.showRenure ?? false)
      : []
  }
  const agronomicNotes = preview.isActive ? getAgronomicNotes(rows, balanceSummary) : []

  return {
    farmNormsResult,
    adviceResult,
    balanceResult,
    norms,
    normsAfter,
    normOutcomes,
    normExceeded: normOutcomes.some((outcome) => outcome.remaining < 0),
    getFieldNormOutcomes,
    agronomicNotes,
    /** The norms to show as columns in the field table; empty for years without norms. */
    normKeys: (norms?.available
      ? norms.showRenure
        ? ["nitrogen", "phosphate", "manure", "renure"]
        : ["nitrogen", "phosphate", "manure"]
      : []) as BulkNormKey[],
    rows,
    adviceSummary,
    balanceSummary,
    adviceIssues,
    balanceIssues,
    preview,
    previewMessage,
  }
}

/** The result of {@link useImpactState}. */
export type ImpactState = ReturnType<typeof useImpactState>
