import type { FertilizerApplication } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { type Navigation, NavLink, useFetcher, useLocation, useNavigation } from "react-router"
import type { FertilizerOption } from "~/components/blocks/fertilizer-applications/types.d"
import { FertilizerApplicationForm } from "~/components/blocks/fertilizer-applications/form"
import { FormSchemaPartialModify } from "~/components/blocks/fertilizer-applications/formschema"
import { getApplicationAmountUnitLabel } from "~/components/blocks/fertilizer-applications/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button, buttonVariants } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Spinner } from "~/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { getCommonApplicationValues } from "~/lib/fertilizer-application-helpers"
import { cn } from "~/lib/utils"
import type { BulkCurrentState, BulkFieldOption } from "./types"
import { FieldImpactTable } from "./field-impact-table"
import { useImpactState } from "./impact-state"
import { ImpactSummaryCard, SaveVerdict } from "./impact-summary"
import {
  type PreviewChanges,
  type PreviewFormValues,
  parsePreviewValues,
  useDebouncedPreviewValues,
} from "./use-impact-preview"
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard"

/** An existing application of the fertilizer on one of the fields. */
export interface ModifiableApplication extends FertilizerApplication {
  b_id: string
  b_name: string
  /** Whether the user may change or remove this application. */
  canModify: boolean
  /** The label of the application method. */
  p_app_method_name?: string
}

const FORM_ID = "modify-fertilizer-application-form"

function applicationsLabel(count: number) {
  return `${count} ${count === 1 ? "gift" : "giften"}`
}

function formatAmount(app: ModifiableApplication) {
  return app.p_app_amount_display !== null
    ? `${app.p_app_amount_display.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} ${getApplicationAmountUnitLabel(app.p_app_amount_unit)}`
    : "–"
}

/**
 * The page to change or remove the applications of one fertilizer on one or more fields.
 *
 * The applications are listed with a checkbox; the selected ones are changed together with the
 * form, which is prefilled with the values they have in common. Values that are left empty keep
 * the value of each application. While the form is filled in, the impact blocks and the field
 * table show the effect of the change, calculated in the browser. Nothing is saved until the form
 * is submitted.
 *
 * @param props.applications - The applications of the fertilizer on the fields, sorted by date.
 * @param props.fields - The fields that have an application of the fertilizer.
 * @param props.fieldNames - Names of all fields of the farm.
 * @param props.current - The streamed current state, from `loadBulkCurrentState` for these fields.
 */
export function ModifyFertilizerPage({
  b_id_farm,
  calendar,
  fertilizerName,
  applications,
  fields,
  fieldNames,
  fertilizerOptions,
  current,
}: {
  b_id_farm: string
  calendar: string
  fertilizerName: string
  applications: ModifiableApplication[]
  fields: BulkFieldOption[]
  fieldNames: Map<string, string>
  fertilizerOptions: FertilizerOption[]
  current: BulkCurrentState
}) {
  const location = useLocation()
  const navigation = useNavigation()
  const removeFetcher = useFetcher()
  const isSubmitting = navigation.state !== "idle" && Boolean(navigation.formData)
  // Warn before leaving with unsaved input, but never block the redirect after saving
  const [dirty, setDirty] = useState(false)
  const unsavedDialog = useUnsavedChangesGuard(
    dirty && !(isSubmitting || removeFetcher.state !== "idle"),
  )

  // The selected applications; by default all that may be changed. A new set of applications,
  // for example after a removal, starts with the default again.
  const applicationsKey = applications.map((app) => app.p_app_id).join(",")
  const [selection, setSelection] = useState(() => ({
    key: applicationsKey,
    ids: new Set(applications.filter((app) => app.canModify).map((app) => app.p_app_id)),
  }))
  const selectedIds = useMemo(
    () =>
      selection.key === applicationsKey
        ? selection.ids
        : new Set(applications.filter((app) => app.canModify).map((app) => app.p_app_id)),
    [selection, applicationsKey, applications],
  )
  const setSelectedIds = (update: (prev: Set<string>) => Set<string>) =>
    setSelection((prev) => ({
      key: applicationsKey,
      ids: update(prev.key === applicationsKey ? prev.ids : selectedIds),
    }))
  const selected = useMemo(
    () => applications.filter((app) => selectedIds.has(app.p_app_id)),
    [applications, selectedIds],
  )
  const selectedKey = selected.map((app) => app.p_app_id).join(",")

  // Prefill the form with the values the selected applications have in common
  const { common, example } = useMemo(() => getCommonApplicationValues(selected), [selected])
  const formApplication =
    selected.length > 0 ? { ...common, p_app_ids: selected.map((a) => a.p_app_id) } : null

  const [formValues, setFormValues] = useState<PreviewFormValues>({})
  const debounced = useDebouncedPreviewValues(formValues)
  // Each selected application is replaced by itself with the changed values
  const changes = useMemo((): PreviewChanges | null => {
    if (selected.length === 0) return null
    const result: PreviewChanges = {}
    for (const app of selected) {
      const values = parsePreviewValues({
        p_id: debounced.values.p_id ?? app.p_id,
        p_app_amount_display:
          debounced.values.p_app_amount_display ?? app.p_app_amount_display ?? undefined,
        p_app_method: debounced.values.p_app_method ?? app.p_app_method ?? undefined,
        p_app_date: debounced.values.p_app_date ?? app.p_app_date,
      })
      if (!values) return null
      const change = result[app.b_id] ?? { removeAppIds: [], add: [] }
      change.removeAppIds.push(app.p_app_id)
      // Without a new amount the stored amount in kg/ha is kept, also when p_id changes, as on save
      const keepsAmount =
        debounced.values.p_app_amount_display === undefined && app.p_app_amount !== null
      change.add.push(
        keepsAmount ? { ...values, p_app_amount: app.p_app_amount ?? undefined } : values,
      )
      result[app.b_id] = change
    }
    return result
  }, [debounced.values, selected])

  const included = useMemo(() => new Set(selected.map((app) => app.b_id)), [selected])
  const state = useImpactState({
    current,
    fields,
    included,
    fieldNames,
    changes,
    pending: debounced.pending,
  })

  const allModifiable = applications.filter((app) => app.canModify)
  const allSelected =
    allModifiable.length > 0 && allModifiable.every((a) => selectedIds.has(a.p_app_id))
  const toggle = (p_app_id: string, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(p_app_id)
      else next.delete(p_app_id)
      return next
    })

  const setAll = (checked: boolean) =>
    setSelectedIds(() => (checked ? new Set(allModifiable.map((app) => app.p_app_id)) : new Set()))

  const handleRemove = () => {
    void removeFetcher.submit(
      {
        intent: "remove_application",
        appIds: selected.map((app) => `${app.b_id}:${app.p_app_id}`).join(","),
        // The page would be empty afterwards, so the action returns to the table
        ...(selected.length === applications.length ? { removeAll: "true" } : {}),
      },
      { method: "POST" },
    )
  }

  const base = `/farm/${b_id_farm}/${calendar}`
  const submitLabel = `${applicationsLabel(selected.length)} wijzigen`
  const submitDisabledReason = selected.length === 0 ? "Selecteer minimaal één gift." : undefined
  const fieldCount = new Set(selected.map((app) => app.b_id)).size

  return (
    <div className="xl:pb-10">
      {unsavedDialog}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
        <Card className="xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle>Geselecteerde giften wijzigen</CardTitle>
            <CardDescription>
              {selected.length === 0
                ? "Selecteer rechts de giften die u wilt wijzigen of verwijderen."
                : `${applicationsLabel(selected.length)} op ${fieldCount} ${fieldCount === 1 ? "perceel" : "percelen"}. Lege velden houden de waarde van elke gift.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FertilizerApplicationForm
              key={selectedKey}
              id={FORM_ID}
              options={fertilizerOptions}
              action={`${location.pathname}${location.search}`}
              navigation={navigation as unknown as Navigation}
              b_id_farm={b_id_farm}
              b_id_or_b_lu_catalogue={`modify-${fields.map((f) => f.b_id).join(",")}`}
              fertilizerApplication={formApplication}
              exampleFertilizerApplication={example}
              schema={FormSchemaPartialModify}
              fieldsClassName="xl:grid-cols-1"
              submitLabel={submitLabel}
              submitDisabledReason={submitDisabledReason}
              submitAreaClassName="max-xl:hidden"
              onValuesChange={setFormValues}
              onDirtyChange={setDirty}
              footerSlot={
                <div className="space-y-2">
                  {state.previewMessage && (
                    <p className="text-muted-foreground text-sm">{state.previewMessage}</p>
                  )}
                  <SaveVerdict outcomes={state.normOutcomes} notes={state.agronomicNotes} />
                </div>
              }
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={selected.length === 0 || removeFetcher.state !== "idle" || isSubmitting}
                >
                  <Trash2 className="size-4" />
                  {applicationsLabel(selected.length)} verwijderen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {applicationsLabel(selected.length)} verwijderen?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    De geselecteerde giften van {fertilizerName} worden verwijderd van{" "}
                    {fieldCount === 1 ? "1 perceel" : `${fieldCount} percelen`}. De gebruiksruimte,
                    het advies en de stikstofbalans worden daarna opnieuw berekend. Dit kan niet
                    ongedaan worden gemaakt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemove}
                    className={buttonVariants({ variant: "destructive" })}
                  >
                    Verwijderen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <ImpactSummaryCard state={state} base={base} />

          <Card>
            <CardHeader>
              <CardTitle>Giften van {fertilizerName}</CardTitle>
              <CardDescription>
                Vink de giften aan die u samen wilt wijzigen of verwijderen.
              </CardDescription>
            </CardHeader>
            <CardContent className="@container/apps space-y-3">
              {/* Narrow containers (phones) get a card per application instead of a wide table */}
              <label className="flex items-center gap-3 text-sm @3xl/apps:hidden">
                <Checkbox
                  className="size-5"
                  checked={allSelected ? true : selected.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(checked) => setAll(checked === true)}
                />
                Alle giften selecteren
              </label>
              <ul className="divide-y rounded-md border @3xl/apps:hidden">
                {applications.map((app) => (
                  <li
                    key={app.p_app_id}
                    className={cn(
                      "flex items-start gap-3 p-3",
                      selectedIds.has(app.p_app_id) && "bg-muted/50",
                    )}
                  >
                    <Checkbox
                      aria-label={`Gift op ${app.b_name} van ${format(app.p_app_date, "PP", { locale: nl })} selecteren`}
                      className="mt-0.5 size-5"
                      checked={selectedIds.has(app.p_app_id)}
                      disabled={!app.canModify}
                      onCheckedChange={(checked) => toggle(app.p_app_id, checked === true)}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <NavLink
                        to={`${base}/field/${app.b_id}/fertilizer`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {app.b_name}
                      </NavLink>
                      {/* Each separator stays with the value after it, so no line ends in "·" */}
                      <p className="text-muted-foreground text-xs">
                        <span className="whitespace-nowrap">
                          {format(app.p_app_date, "PP", { locale: nl })}
                        </span>{" "}
                        <span className="whitespace-nowrap">· {formatAmount(app)}</span>{" "}
                        <span>·&nbsp;{app.p_app_method_name ?? "–"}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-md border @3xl/apps:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          aria-label="Alle giften selecteren"
                          checked={
                            allSelected ? true : selected.length > 0 ? "indeterminate" : false
                          }
                          onCheckedChange={(checked) => setAll(checked === true)}
                        />
                      </TableHead>
                      <TableHead>Perceel</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-right">Hoeveelheid</TableHead>
                      <TableHead>Methode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow
                        key={app.p_app_id}
                        data-state={selectedIds.has(app.p_app_id) ? "selected" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            aria-label={`Gift op ${app.b_name} van ${format(app.p_app_date, "PP", { locale: nl })} selecteren`}
                            checked={selectedIds.has(app.p_app_id)}
                            disabled={!app.canModify}
                            onCheckedChange={(checked) => toggle(app.p_app_id, checked === true)}
                          />
                        </TableCell>
                        <TableCell className="max-w-48">
                          <NavLink
                            to={`${base}/field/${app.b_id}/fertilizer`}
                            className="truncate font-medium underline-offset-4 hover:underline"
                          >
                            {app.b_name}
                          </NavLink>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(app.p_app_date, "PP", { locale: nl })}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {formatAmount(app)}
                        </TableCell>
                        <TableCell>{app.p_app_method_name ?? "–"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <FieldImpactTable
                rows={state.rows}
                loading={!state.adviceResult || !state.balanceResult}
                b_id_farm={b_id_farm}
                calendar={calendar}
                selectable={false}
                normKeys={state.normKeys}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bg-background sticky bottom-0 z-10 -mx-2 mt-6 border-t px-4 py-3 md:-mx-4 xl:hidden">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p
              className={cn(
                "text-sm",
                state.normExceeded ? "text-red-700" : "text-muted-foreground",
              )}
            >
              {state.normExceeded
                ? "Gebruiksruimte wordt overschreden"
                : `${applicationsLabel(selected.length)} op ${fieldCount} ${fieldCount === 1 ? "perceel" : "percelen"}`}
            </p>
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              {submitLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
