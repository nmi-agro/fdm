import type { BaseFertilizerApplication, Fertilizer } from "@nmi-agro/fdm-core"
import {
  aggregateNormFillingsToFarmLevel,
  calculateDose,
  calculateFertilizerApplicationFillingsWithRegion,
  calculateNitrogenBalanceField,
  type NitrogenBalanceFieldResultNumeric,
} from "@nmi-agro/fdm-calculator/browser"
import { useEffect, useMemo, useState } from "react"
import { FormSchema } from "~/components/blocks/fertilizer-applications/formschema"
import type {
  BulkBalancePreview,
  BulkBlockResult,
  BulkFarmNorms,
  BulkFieldIssue,
  BulkImpactPreview,
  BulkNormValues,
  BulkNutrientValues,
  BulkPreviewInput,
} from "./types"
import { toFriendlyCalculationError } from "./errors"

/**
 * Wait this long after the last change before recalculating. The calculation itself is fast,
 * this only keeps typing smooth on large selections.
 */
const PREVIEW_DEBOUNCE_MS = 150

/** The form values the preview is calculated from. Missing values mean the form is incomplete. */
export interface PreviewFormValues {
  p_id?: string
  p_app_amount_display?: number
  p_app_method?: string
  /** Usually a `Date`, but a restored draft or the date picker can also give a string. */
  p_app_date?: Date | string | null
}

/** The values of a fertilizer application that has not been saved yet. */
export interface PreviewApplicationValues {
  p_id: string
  p_app_amount_display: number
  p_app_method: string
  p_app_date: Date
  /**
   * The amount in kg/ha. When given, it is used instead of converting `p_app_amount_display`,
   * for example to keep the stored amount of an application whose amount is not changed.
   */
  p_app_amount?: number
}

/** The change on a single field: existing applications that are removed, and new applications. */
export interface PreviewFieldChange {
  removeAppIds: string[]
  add: PreviewApplicationValues[]
}

/** The changes to preview, keyed by `b_id`. Fields without an entry are not changed. */
export type PreviewChanges = Record<string, PreviewFieldChange>

/** Returns the date as a timestamp, or `undefined` when it is missing or not a valid date. */
function toTimestamp(value: PreviewFormValues["p_app_date"]): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const time = (value instanceof Date ? value : new Date(value)).getTime()
  return Number.isNaN(time) ? undefined : time
}

/**
 * Validates form values as a complete application.
 *
 * @returns The application values, or `null` when the form is not complete or not valid yet.
 */
export function parsePreviewValues(values: PreviewFormValues): PreviewApplicationValues | null {
  const timestamp = toTimestamp(values.p_app_date)
  const parsed = FormSchema.safeParse({
    ...values,
    p_app_date: timestamp === undefined ? undefined : new Date(timestamp),
  })
  return parsed.success ? parsed.data : null
}

/**
 * Resolves a streamed block promise into state, so that values from several blocks can be
 * combined. Returns `undefined` until the promise settles, and again when a new promise is passed.
 * A rejected promise, for example when the stream is interrupted, gives an error result, so the
 * block shows its error instead of loading forever.
 */
export function useSettled<T>(
  promise: Promise<BulkBlockResult<T>>,
): BulkBlockResult<T> | undefined {
  const [state, setState] = useState<
    { promise: Promise<BulkBlockResult<T>>; value: BulkBlockResult<T> } | undefined
  >(undefined)
  useEffect(() => {
    let active = true
    promise.then(
      (value) => {
        if (active) setState({ promise, value })
      },
      () => {
        if (active) {
          setState({
            promise,
            value: {
              status: "error",
              message: "Berekening is mislukt. Probeer het later opnieuw.",
            },
          })
        }
      },
    )
    return () => {
      active = false
    }
  }, [promise])
  return state?.promise === promise ? state.value : undefined
}

/**
 * Debounces form values for the preview. Values are compared by content, so a new object with
 * the same values does not count as a change.
 *
 * @returns The debounced values, and whether newer values are still waiting.
 */
export function useDebouncedPreviewValues(values: PreviewFormValues): {
  values: PreviewFormValues
  pending: boolean
} {
  const key = JSON.stringify([
    values.p_id ?? null,
    values.p_app_amount_display ?? null,
    values.p_app_method ?? null,
    toTimestamp(values.p_app_date) ?? null,
  ])
  const [debouncedKey, setDebouncedKey] = useState(key)
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedKey(key), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [key])
  const debounced = useMemo(() => {
    const [p_id, amount, method, timestamp] = JSON.parse(debouncedKey) as [
      string | null,
      number | null,
      string | null,
      number | null,
    ]
    return {
      p_id: p_id ?? undefined,
      p_app_amount_display: amount ?? undefined,
      p_app_method: method ?? undefined,
      p_app_date: timestamp === null ? undefined : new Date(timestamp),
    }
  }, [debouncedKey])
  return { values: debounced, pending: key !== debouncedKey }
}

function pickNutrients(dose: { p_dose_nw: number; p_dose_p: number; p_dose_k: number }) {
  return { n: dose.p_dose_nw, p: dose.p_dose_p, k: dose.p_dose_k }
}

/** Returns why the application cannot be previewed, or what is needed to build it. */
function validateApplication(
  input: BulkPreviewInput,
  values: PreviewApplicationValues,
): { message: string } | { fertilizer: Fertilizer; p_app_amount: number } {
  const fertilizer = input.fertilizers.find((f) => f.p_id === values.p_id)
  if (!fertilizer) return { message: "Meststof niet gevonden." }
  const { start, end } = input.timeframe
  if ((start && values.p_app_date < start) || (end && values.p_app_date > end)) {
    return { message: "De datum valt buiten het jaar. Het effect kan niet worden berekend." }
  }
  // A known amount in kg/ha needs no conversion
  if (values.p_app_amount !== undefined) return { fertilizer, p_app_amount: values.p_app_amount }
  const kgPerDisplayUnit = input.kgPerDisplayUnit[fertilizer.p_id]
  if (kgPerDisplayUnit === null || kgPerDisplayUnit === undefined) {
    return {
      message:
        "De dichtheid van deze meststof ontbreekt, waardoor de hoeveelheid niet kan worden omgerekend.",
    }
  }
  return { fertilizer, p_app_amount: values.p_app_amount_display * kgPerDisplayUnit }
}

/**
 * Calculates the effect of unsaved changes to fertilizer applications, in the browser.
 *
 * Each changed field can lose existing applications and get new ones, which covers adding an
 * application, changing one, and changing several at once.
 *
 * - The dose of a changed field is recalculated from its applications after the change.
 * - The farm norms "after" value adds the change of the changed fields to the current farm
 *   filling; the other fields keep their current filling.
 * - The nitrogen balance is recalculated for the changed fields, except buffer strips.
 *
 * @param params.input - The preview input from the loader.
 * @param params.changes - The changes per field.
 * @param params.farmNorms - The current norms and fillings of the farm.
 * @param params.fieldNames - Field names, for the list of fields that could not be calculated.
 * @returns The preview of the norms and dose, and of the nitrogen balance.
 */
export function calculateLocalPreview({
  input,
  changes,
  farmNorms,
  fieldNames,
}: {
  input: BulkPreviewInput
  changes: PreviewChanges
  farmNorms?: BulkFarmNorms
  fieldNames: Map<string, string>
}): { impact: BulkImpactPreview; balance: BulkBalancePreview } {
  // Build the new applications, and stop at the first one that cannot be previewed
  const added = new Map<string, BaseFertilizerApplication[]>()
  for (const [b_id, change] of Object.entries(changes)) {
    const applications: BaseFertilizerApplication[] = []
    for (const [index, values] of change.add.entries()) {
      const valid = validateApplication(input, values)
      if ("message" in valid) {
        return {
          impact: { status: "invalid", message: valid.message },
          balance: { status: "invalid", message: valid.message },
        }
      }
      applications.push({
        p_app_id: `preview-${b_id}-${index}`,
        p_id: valid.fertilizer.p_id,
        p_id_catalogue: valid.fertilizer.p_id_catalogue,
        p_name_nl: valid.fertilizer.p_name_nl,
        p_app_amount: valid.p_app_amount,
        p_app_method: values.p_app_method as BaseFertilizerApplication["p_app_method"],
        p_app_date: values.p_app_date,
      })
    }
    added.set(b_id, applications)
  }
  const applyChange = (b_id: string, applications: BaseFertilizerApplication[]) => {
    const removed = new Set(changes[b_id]?.removeAppIds ?? [])
    return [
      ...applications.filter((application) => !removed.has(application.p_app_id)),
      ...(added.get(b_id) ?? []),
    ]
  }
  const changedFieldIds = Object.keys(changes)

  // Dose after the change, per changed field
  const doses: Record<string, BulkNutrientValues> = {}
  for (const b_id of changedFieldIds) {
    const { dose } = calculateDose({
      applications: applyChange(b_id, input.applications[b_id] ?? []),
      fertilizers: input.fertilizers,
    })
    doses[b_id] = pickNutrients(dose)
  }

  // Norms: recalculate the changed fields and add their change to the farm filling
  let norms: Extract<BulkImpactPreview, { status: "ok" }>["norms"]
  if (input.norms && farmNorms?.farmNorms && farmNorms.farmFillings) {
    const fieldIssues: BulkFieldIssue[] = [...farmNorms.fieldIssues]
    const before: Parameters<typeof aggregateNormFillingsToFarmLevel>[0] = []
    const after: Parameters<typeof aggregateNormFillingsToFarmLevel>[0] = []
    const fieldsAfter: Record<string, BulkNormValues> = {}
    for (const b_id of changedFieldIds) {
      const field = input.norms.fields[b_id]
      if (!field) continue
      try {
        const filling = calculateFertilizerApplicationFillingsWithRegion(
          input.norms.year,
          {
            ...field.input,
            fertilizers: input.fertilizers,
            applications: applyChange(b_id, field.input.applications),
          },
          field.b_region,
        )
        before.push({ b_id, b_area: field.b_area, normsFilling: field.current })
        after.push({ b_id, b_area: field.b_area, normsFilling: filling })
        fieldsAfter[b_id] = {
          nitrogen: filling.nitrogen.normFilling,
          phosphate: filling.phosphate.normFilling,
          manure: filling.manure.normFilling,
          renure: filling.renure?.normFilling,
        }
      } catch (error) {
        fieldIssues.push({
          b_id,
          b_name: fieldNames.get(b_id) ?? b_id,
          message: toFriendlyCalculationError(
            error instanceof Error ? error.message : String(error),
          ),
        })
      }
    }
    const beforeTotals = aggregateNormFillingsToFarmLevel(before)
    const afterTotals = aggregateNormFillingsToFarmLevel(after)
    const current = farmNorms.farmFillings
    norms = {
      farmNorms: farmNorms.farmNorms,
      current,
      after: {
        nitrogen: current.nitrogen + afterTotals.nitrogen - beforeTotals.nitrogen,
        phosphate: current.phosphate + afterTotals.phosphate - beforeTotals.phosphate,
        manure: current.manure + afterTotals.manure - beforeTotals.manure,
        renure: (current.renure ?? 0) + afterTotals.renure - beforeTotals.renure,
      },
      fieldsAfter,
      fieldIssues,
    }
  }

  // Nitrogen balance of the changed fields
  const balanceFields: NitrogenBalanceFieldResultNumeric[] = []
  if (input.balance) {
    const { fertilizerDetails, cultivationDetails, timeFrame } = input.balance
    // A new fertilizer may not be in the details yet; add it from the farm stock
    const details = [...fertilizerDetails]
    for (const application of [...added.values()].flat()) {
      if (details.some((detail) => detail.p_id_catalogue === application.p_id_catalogue)) continue
      const fertilizer = input.fertilizers.find((f) => f.p_id === application.p_id)
      if (!fertilizer) continue
      details.push({
        p_id_catalogue: fertilizer.p_id_catalogue,
        p_n_rt: fertilizer.p_n_rt,
        p_no3_rt: fertilizer.p_no3_rt,
        p_nh4_rt: fertilizer.p_nh4_rt,
        p_s_rt: fertilizer.p_s_rt,
        p_ef_nh3: fertilizer.p_ef_nh3,
        p_type: fertilizer.p_type,
      })
    }
    for (const b_id of changedFieldIds) {
      const fieldInput = input.balance.fields[b_id]
      if (!fieldInput || fieldInput.field.b_bufferstrip) continue
      const base = { b_id, b_area: fieldInput.field.b_area ?? 0, b_bufferstrip: false }
      try {
        const balance = calculateNitrogenBalanceField({
          fieldInput: {
            ...fieldInput,
            fertilizerApplications: applyChange(b_id, fieldInput.fertilizerApplications),
          },
          fertilizerDetails: details,
          cultivationDetails,
          timeFrame,
        })
        balanceFields.push({ ...base, balance })
      } catch (error) {
        balanceFields.push({
          ...base,
          errorMessage: toFriendlyCalculationError(
            error instanceof Error ? error.message : String(error),
          ),
        })
      }
    }
  }

  return {
    impact: { status: "ok", doses, norms },
    balance: { status: "ok", fields: balanceFields },
  }
}

/**
 * Calculates the effect of unsaved changes to fertilizer applications, without saving and
 * without a request: the loader sends the input once, and the browser recalculates when the
 * changes change. Debounce the form values with {@link useDebouncedPreviewValues} before
 * building the changes.
 *
 * @param params.previewInput - The preview input from the loader, once it has streamed in.
 * @param params.changes - The changes to preview, or `null` when the form is not complete.
 * @param params.pending - Whether newer form values are still being debounced.
 * @param params.farmNorms - The current norms and fillings of the farm, once they have streamed in.
 * @param params.fieldNames - Field names, for the list of fields that could not be calculated.
 * @returns The latest previews, whether they are pending, and whether a preview has been shown.
 */
export function useLocalImpactPreview({
  previewInput,
  changes,
  pending,
  farmNorms,
  fieldNames,
}: {
  previewInput?: BulkPreviewInput
  changes: PreviewChanges | null
  pending: boolean
  farmNorms?: BulkFarmNorms
  fieldNames: Map<string, string>
}) {
  const [previewUsed, setPreviewUsed] = useState(false)

  const result = useMemo(() => {
    if (!changes || Object.keys(changes).length === 0 || !previewInput) return undefined
    return calculateLocalPreview({ input: previewInput, changes, farmNorms, fieldNames })
  }, [changes, previewInput, farmNorms, fieldNames])

  // Remember that a preview was shown, for analytics. Updating state during render is the
  // React pattern for state that follows from other values.
  if (result?.impact.status === "ok" && !previewUsed) setPreviewUsed(true)

  const isActive = changes !== null && Object.keys(changes).length > 0
  const isPending = isActive && (pending || !previewInput)

  return {
    /** `true` when the form is complete enough to calculate a preview. */
    isActive,
    impact: isActive ? result?.impact : undefined,
    balance: isActive ? result?.balance : undefined,
    impactPending: isPending,
    balancePending: isPending,
    previewUsed,
  }
}
