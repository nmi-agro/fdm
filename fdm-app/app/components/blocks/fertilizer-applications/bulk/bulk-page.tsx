import { AlertTriangle } from "lucide-react"
import { useMemo, useState } from "react"
import { type Navigation, NavLink, useNavigation, useSearchParams } from "react-router"
import type { FertilizerOption } from "~/components/blocks/fertilizer-applications/types.d"
import { FertilizerApplicationForm } from "~/components/blocks/fertilizer-applications/form"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"
import { modifySearchParams } from "~/lib/url-utils"
import { cn } from "~/lib/utils"
import { FieldImpactTable } from "./field-impact-table"
import { FieldSelectionDialog } from "./field-selection-dialog"
import { useImpactState } from "./impact-state"
import { ImpactSummaryCard, SaveVerdict } from "./impact-summary"
import {
  BULK_ANALYTICS_PARAMS as ANALYTICS_PARAMS,
  type BulkCurrentState,
  type BulkFieldOption,
} from "./types"
import {
  type PreviewChanges,
  type PreviewFormValues,
  parsePreviewValues,
  useDebouncedPreviewValues,
} from "./use-impact-preview"
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard"

const FORM_ID = "bulk-fertilizer-application-form"

function formatArea(hectares: number) {
  return hectares.toLocaleString("nl-NL", { maximumFractionDigits: 1 })
}

function fieldCountLabel(count: number) {
  return `${count} ${count === 1 ? "perceel" : "percelen"}`
}

/**
 * The bulk fertilizer application page, shared by the fields table and the rotation table.
 *
 * The user fills in one application for several fields. Next to the form, the page shows the
 * farm's legal application norms (gebruiksruimte), the area-weighted advice and nitrogen balance of
 * the selected fields, and a per-field breakdown, each before and after the application. Nothing
 * is saved until the form is submitted.
 *
 * @param props.fieldOptions - All fields of the farm in the calendar year.
 * @param props.selectedFieldIds - The fields selected for the application.
 * @param props.cultivationIds - In the rotation flow, the selected crop. Empty otherwise.
 * @param props.current - The streamed current state (norms, advice and balance).
 * @param props.formAction - The URL the form posts to.
 * @param props.formStoreKey - Key to keep a draft of the form while creating a new fertilizer.
 */
export function BulkFertilizerPage({
  b_id_farm,
  calendar,
  fertilizerOptions,
  fieldOptions,
  selectedFieldIds,
  cultivationIds,
  cultivationName,
  current,
  formAction,
  formStoreKey,
  overviewUrl,
}: {
  b_id_farm: string
  calendar: string
  fertilizerOptions: FertilizerOption[]
  fieldOptions: BulkFieldOption[]
  selectedFieldIds: string[]
  cultivationIds: string[]
  cultivationName?: string
  current: BulkCurrentState
  formAction: string
  formStoreKey: string
  /** Where to go to change the selection, for example the rotation in the creation wizard. */
  overviewUrl?: string
}) {
  const navigation = useNavigation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isSubmitting = navigation.state !== "idle" && Boolean(navigation.formData)
  // Warn before leaving with unsaved input, but never block the redirect after saving
  const [dirty, setDirty] = useState(false)
  const unsavedDialog = useUnsavedChangesGuard(dirty && !isSubmitting)

  // Fields excluded on this page. They belong to a selection, so a new selection starts empty.
  const selectionKey = selectedFieldIds.join(",")
  const [exclusion, setExclusion] = useState(() => ({
    selectionKey,
    ids: new Set<string>(),
  }))
  const excluded = useMemo(
    () => (exclusion.selectionKey === selectionKey ? exclusion.ids : new Set<string>()),
    [exclusion, selectionKey],
  )
  const setExcluded = (update: (prev: Set<string>) => Set<string>) =>
    setExclusion((prev) => ({
      selectionKey,
      ids: update(prev.selectionKey === selectionKey ? prev.ids : new Set()),
    }))

  const selectedFields = useMemo(() => {
    const selected = new Set(selectedFieldIds)
    return fieldOptions.filter((field) => selected.has(field.b_id))
  }, [fieldOptions, selectedFieldIds])
  const includedFieldIds = useMemo(
    () => selectedFields.filter((f) => !excluded.has(f.b_id)).map((f) => f.b_id),
    [selectedFields, excluded],
  )
  const included = useMemo(() => new Set(includedFieldIds), [includedFieldIds])
  const includedArea = selectedFields
    .filter((field) => included.has(field.b_id))
    .reduce((sum, field) => sum + field.b_area, 0)

  const fieldNames = useMemo(
    () => new Map(fieldOptions.map((field) => [field.b_id, field.b_name])),
    [fieldOptions],
  )
  const [formValues, setFormValues] = useState<PreviewFormValues>({})
  const debounced = useDebouncedPreviewValues(formValues)
  // The same new application on every included field
  const changes = useMemo((): PreviewChanges | null => {
    const values = parsePreviewValues(debounced.values)
    if (!values || includedFieldIds.length === 0) return null
    return Object.fromEntries(
      includedFieldIds.map((b_id) => [b_id, { removeAppIds: [], add: [values] }]),
    )
  }, [debounced.values, includedFieldIds])
  const state = useImpactState({
    current,
    fields: selectedFields,
    included,
    fieldNames,
    cultivationIds,
    changes,
    pending: debounced.pending,
  })
  const { rows, normOutcomes, normExceeded, preview, previewMessage } = state

  const action = modifySearchParams(formAction, (params) => {
    params.set("fieldIds", includedFieldIds.join(","))
    params.set(
      ANALYTICS_PARAMS.excludedCount,
      String(selectedFields.length - includedFieldIds.length),
    )
    params.set(ANALYTICS_PARAMS.normExceeded, String(normExceeded))
    params.set(ANALYTICS_PARAMS.previewUsed, String(preview.previewUsed))
  })

  const submitLabel = `Bemesting toevoegen aan ${fieldCountLabel(includedFieldIds.length)}`
  const submitDisabledReason =
    includedFieldIds.length === 0 ? "Selecteer minimaal één perceel." : undefined

  const handleSelectionChange = (fieldIds: string[]) => {
    const next = new URLSearchParams(searchParams)
    next.set("fieldIds", fieldIds.join(","))
    setSearchParams(next, { preventScrollReset: true })
  }

  const handleSetIncluded = (b_ids: string[], include: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      for (const b_id of b_ids) {
        if (include) next.delete(b_id)
        else next.add(b_id)
      }
      return next
    })

  // Buffer strips may not be fertilized, so warn when one is included and offer to leave them out
  const includedBufferStripIds = selectedFields
    .filter((field) => field.b_bufferstrip && included.has(field.b_id))
    .map((field) => field.b_id)
  // Excluded buffer strips are left out of the field table
  const excludedBufferStrips = new Set(
    selectedFields
      .filter((field) => field.b_bufferstrip && !included.has(field.b_id))
      .map((field) => field.b_id),
  )
  const tableRows = rows.filter((row) => !excludedBufferStrips.has(row.b_id))

  const base = `/farm/${b_id_farm}/${calendar}`

  return (
    <div className="relative pb-10">
      {unsavedDialog}
      {isSubmitting && (
        <div className="bg-background/80 absolute inset-0 z-20 flex items-start justify-center pt-24">
          <div className="text-muted-foreground flex items-center text-sm" role="status">
            <Spinner className="mr-2" />
            Bemesting wordt toegevoegd…
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">{fieldCountLabel(includedFieldIds.length)}</span>
          <span className="text-muted-foreground"> · {formatArea(includedArea)} ha</span>
          {cultivationName && <span className="text-muted-foreground"> · {cultivationName}</span>}
          {excluded.size > 0 && (
            <span className="text-muted-foreground"> · {excluded.size} uitgezonderd</span>
          )}
        </p>
        <FieldSelectionDialog
          fieldOptions={fieldOptions}
          selectedFieldIds={selectedFieldIds}
          cultivationIds={cultivationIds}
          cultivationName={cultivationName}
          onApply={handleSelectionChange}
        />
      </div>

      {includedBufferStripIds.length > 0 && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <AlertTriangle
            className="size-4 text-amber-700! dark:text-amber-400!"
            aria-hidden="true"
          />
          {/* A real h3, so the heading levels follow the page structure */}
          <h3 className="mb-1 leading-none font-medium tracking-tight">
            {includedBufferStripIds.length === 1
              ? "Er is een bufferstrook geselecteerd"
              : `Er zijn ${includedBufferStripIds.length} bufferstroken geselecteerd`}
          </h3>
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            <p>
              Op bufferstroken mag niet worden bemest. Ze tellen niet mee in het advies en de
              stikstofbalans, maar de bemesting wordt wel opgeslagen als u ze niet uitsluit.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={isSubmitting}
              onClick={() => handleSetIncluded(includedBufferStripIds, false)}
            >
              {includedBufferStripIds.length === 1
                ? "Bufferstrook uitsluiten"
                : "Bufferstroken uitsluiten"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {selectedFields.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-60 flex-col items-center justify-center gap-2 pt-6 text-center">
            <h2 className="text-lg font-semibold">Geen percelen geselecteerd</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              Pas uw selectie aan, of ga naar het overzicht voor meer filtermogelijkheden.
            </p>
            <Button asChild variant="link">
              <NavLink
                to={
                  overviewUrl ?? (cultivationIds.length > 0 ? `${base}/rotation` : `${base}/field`)
                }
              >
                {cultivationIds.length > 0 ? "Naar bouwplan" : "Naar percelenoverzicht"}
              </NavLink>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
          <Card className="xl:sticky xl:top-4">
            <CardContent className="space-y-4 pt-6">
              <FertilizerApplicationForm
                id={FORM_ID}
                options={fertilizerOptions}
                action={action}
                navigation={navigation as unknown as Navigation}
                b_id_farm={b_id_farm}
                b_id_or_b_lu_catalogue={formStoreKey}
                fertilizerApplication={undefined}
                fieldsClassName="xl:grid-cols-1"
                submitLabel={submitLabel}
                submitDisabledReason={submitDisabledReason}
                submitAreaClassName="max-xl:hidden"
                onValuesChange={setFormValues}
                onDirtyChange={setDirty}
                footerSlot={
                  <div className="space-y-2">
                    {previewMessage && (
                      <p className="text-muted-foreground text-sm">{previewMessage}</p>
                    )}
                    <SaveVerdict outcomes={normOutcomes} notes={state.agronomicNotes} />
                  </div>
                }
              />
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-6">
            <ImpactSummaryCard state={state} base={base} />

            <Card>
              <CardContent className="pt-6">
                <FieldImpactTable
                  rows={tableRows}
                  loading={!state.adviceResult || !state.balanceResult}
                  b_id_farm={b_id_farm}
                  calendar={calendar}
                  onSetIncluded={handleSetIncluded}
                  disabled={isSubmitting}
                  normKeys={state.normKeys}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {selectedFields.length > 0 && (
        <div className="bg-background sticky bottom-0 z-10 -mx-2 mt-6 border-t px-4 py-3 md:-mx-4 xl:hidden">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p
              className={cn(
                "text-sm",
                normExceeded ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
              )}
            >
              {normExceeded
                ? "Gebruiksruimte wordt overschreden"
                : (submitDisabledReason ??
                  `${fieldCountLabel(includedFieldIds.length)} · ${formatArea(includedArea)} ha`)}
            </p>
            <Button
              type="submit"
              form={FORM_ID}
              disabled={Boolean(submitDisabledReason) || isSubmitting}
            >
              {isSubmitting ? <Spinner /> : null}
              {submitLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
