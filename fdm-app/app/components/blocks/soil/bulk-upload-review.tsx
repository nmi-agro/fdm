import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import {
  AlertCircle,
  CheckCircle2,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Eye,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import type { BulkSaveResult, BulkSaveRow } from "~/routes/api.soil-analysis.bulk-save"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
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
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Input } from "~/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Progress } from "~/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { Spinner } from "~/components/ui/spinner"
import { getObjectUrl } from "~/lib/object-url"
import { cn } from "~/lib/utils"
import { BULK_UPLOAD_STEPS } from "./bulk-upload-form"
import {
  type BulkField,
  type BulkRow,
  type BulkRowIssue,
  type BulkRowStatus,
  createRowContext,
  type ExistingSoilAnalysis,
  getRowIssues,
  getRowStatus,
  isRowIncluded,
  toDateKey,
} from "./bulk-upload-model"
import { SoilAnalysisForm } from "./form"
import { SoilAnalysisUploadSteps } from "./form-upload"
import { SAMPLING_PARAMETERS } from "./parameter-groups"

/** Number of analyses saved per request. */
const SAVE_BATCH_SIZE = 5

type Filter = "attention" | "ready" | "saved" | "all"

const STATUS_LABELS: Record<BulkRowStatus, string> = {
  failed: "Mislukt",
  incomplete: "Onvolledig",
  check: "Controleren",
  ready: "Klaar",
  saved: "Opgeslagen",
}

const STATUS_ORDER: Record<BulkRowStatus, number> = {
  failed: 0,
  incomplete: 1,
  check: 2,
  ready: 3,
  saved: 4,
}

const MATCH_LABELS = {
  location: "op locatie",
  name: "op naam",
  "location-and-name": "op locatie en naam",
  manual: "zelf gekozen",
} as const

interface JudgedRow {
  row: BulkRow
  issues: BulkRowIssue[]
  status: BulkRowStatus
  included: boolean
}

/**
 * Review step of a bulk upload: every analysis read from the PDFs, linked to a field, with what
 * needs attention. Built for uploads of 100 or more PDFs: a summary that doubles as filter (by
 * default only the rows that need attention), a search, one compact line per analysis, and a side
 * panel to check an analysis against its PDF. Saving happens in small batches with progress; rows
 * that fail stay in the list to try again.
 *
 * @param rows - The rows of the upload.
 * @param onRowsChange - Updates the rows.
 * @param files - The PDFs by name, to show and store them.
 * @param fields - The fields of the farm.
 * @param existing - The analyses that are already stored for the farm.
 * @param soilParameterDescription - Descriptions of all soil parameters.
 * @param onRetryRead - Reads one PDF again.
 * @param onBack - Goes back to choosing PDFs; the review is discarded.
 * @param onFinished - Called when every included analysis has been saved.
 */
export function BulkSoilAnalysisReview({
  rows,
  onRowsChange,
  files,
  fields,
  existing,
  soilParameterDescription,
  onRetryRead,
  onBack,
  onFinished,
}: {
  rows: BulkRow[]
  onRowsChange: (update: (rows: BulkRow[]) => BulkRow[]) => void
  files: Map<string, File>
  fields: BulkField[]
  existing: ExistingSoilAnalysis[]
  soilParameterDescription: SoilParameterDescription
  onRetryRead: (fileName: string) => Promise<void>
  onBack: () => void
  onFinished: (savedCount: number) => void
}) {
  const parameterNames = useMemo(
    () => new Map(soilParameterDescription.map((x) => [x.parameter, x.name])),
    [soilParameterDescription],
  )
  const sourceLabels = useMemo(
    () =>
      new Map(
        (soilParameterDescription.find((x) => x.parameter === "a_source")?.options ?? []).map(
          (option: { value: string; label: string }) => [option.value, option.label],
        ),
      ),
    [soilParameterDescription],
  )
  const fieldsById = useMemo(() => new Map(fields.map((field) => [field.b_id, field])), [fields])

  const judged: JudgedRow[] = useMemo(() => {
    const context = createRowContext(rows, fields, existing, parameterNames)
    return rows
      .map((row) => {
        const issues = getRowIssues(row, context)
        return {
          row,
          issues,
          status: getRowStatus(row, issues),
          included: isRowIncluded(row, issues),
        }
      })
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          a.row.fileName.localeCompare(b.row.fileName, "nl"),
      )
  }, [rows, fields, existing, parameterNames])

  const counts = useMemo(() => {
    const count = (statuses: BulkRowStatus[]) =>
      judged.filter((item) => statuses.includes(item.status)).length
    return {
      attention: count(["failed", "incomplete", "check"]),
      ready: count(["ready"]),
      saved: count(["saved"]),
      all: judged.length,
      toSave: judged.filter((item) => item.included).length,
      unsaved: judged.filter((item) => item.status !== "saved").length,
    }
  }, [judged])

  const [filter, setFilter] = useState<Filter>(counts.attention > 0 ? "attention" : "all")
  const [query, setQuery] = useState("")
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null)
  const [lastSave, setLastSave] = useState<{ saved: number; failed: number } | null>(null)

  const visible = judged.filter((item) => {
    const inFilter =
      filter === "all" ||
      (filter === "attention" && ["failed", "incomplete", "check"].includes(item.status)) ||
      (filter === "ready" && item.status === "ready") ||
      (filter === "saved" && item.status === "saved")
    if (!inFilter) return false
    const search = query.trim().toLowerCase()
    if (!search) return true
    const fieldName = item.row.fieldId ? (fieldsById.get(item.row.fieldId)?.b_name ?? "") : ""
    return (
      item.row.fileName.toLowerCase().includes(search) ||
      fieldName.toLowerCase().includes(search) ||
      (item.row.reportFieldName ?? "").toLowerCase().includes(search)
    )
  })
  const visibleIncludable = visible.filter(
    (item) =>
      item.row.kind === "analysis" && !item.row.saved && !item.issues.some((i) => i.blocking),
  )
  const allVisibleIncluded =
    visibleIncludable.length > 0 && visibleIncludable.every((item) => item.included)

  const updateRow = (id: string, change: (row: BulkRow) => BulkRow) =>
    onRowsChange((current) => current.map((row) => (row.id === id ? change(row) : row)))

  // Warn before leaving the page while analyses are being saved
  useEffect(() => {
    if (!saving) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [saving])

  const handleSave = async () => {
    const toSave = judged.filter((item) => item.included).map((item) => item.row)
    if (toSave.length === 0) return
    setLastSave(null)
    setSaving({ done: 0, total: toSave.length })
    let saved = 0
    let failed = 0

    for (let start = 0; start < toSave.length; start += SAVE_BATCH_SIZE) {
      const batch = toSave.slice(start, start + SAVE_BATCH_SIZE)
      const formData = new FormData()
      const payload: BulkSaveRow[] = batch.map((row) => ({
        id: row.id,
        fieldId: row.fieldId ?? "",
        fileName: row.fileName,
        values: row.values,
        extra: row.extra,
        geometries: row.geometries,
      }))
      formData.append("rows", JSON.stringify(payload))
      for (const fileName of new Set(batch.map((row) => row.fileName))) {
        const file = files.get(fileName)
        if (file) formData.append(`file:${fileName}`, file)
      }

      let results: BulkSaveResult[]
      try {
        const response = await fetch("/api/soil-analysis/bulk-save", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        })
        if (!response.ok) throw new Error(String(response.status))
        results = ((await response.json()) as { results: BulkSaveResult[] }).results
      } catch {
        results = batch.map((row) => ({
          id: row.id,
          status: "failed",
          message: "De verbinding is verbroken tijdens het opslaan. Probeer het opnieuw.",
        }))
      }

      const byId = new Map(results.map((result) => [result.id, result]))
      onRowsChange((current) =>
        current.map((row) => {
          const result = byId.get(row.id)
          if (!result) return row
          return result.status === "saved"
            ? { ...row, saved: { a_id: result.a_id, pdfStored: result.pdfStored }, error: null }
            : { ...row, error: result.message }
        }),
      )
      saved += results.filter((result) => result.status === "saved").length
      failed += results.filter((result) => result.status === "failed").length
      setSaving({ done: Math.min(start + batch.length, toSave.length), total: toSave.length })
    }

    setSaving(null)
    if (failed === 0) {
      onFinished(saved + counts.saved)
    } else {
      setLastSave({ saved, failed })
      setFilter("attention")
    }
  }

  const openRow = openRowId ? judged.find((item) => item.row.id === openRowId) : undefined
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "attention", label: "Aandacht nodig", count: counts.attention },
    { value: "ready", label: "Klaar", count: counts.ready },
    ...(counts.saved > 0
      ? [{ value: "saved" as const, label: "Opgeslagen", count: counts.saved }]
      : []),
    { value: "all", label: "Alles", count: counts.all },
  ]

  return (
    <div className="space-y-6">
      <SoilAnalysisUploadSteps current={saving ? 3 : 2} steps={BULK_UPLOAD_STEPS} />

      {lastSave && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden />
          <AlertTitle>
            {lastSave.saved} opgeslagen, {lastSave.failed} niet gelukt
          </AlertTitle>
          <AlertDescription>
            De analyses die niet zijn opgeslagen staan hieronder met de reden. Pas ze aan of probeer
            het opnieuw; wat al is opgeslagen wordt niet nog een keer opgeslagen.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Toon analyses">
          {filters.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className="pointer-coarse:h-10"
            >
              {option.label}
              <span
                className={cn(
                  "tabular-nums",
                  filter === option.value ? "opacity-80" : "text-muted-foreground",
                )}
              >
                {option.count}
              </span>
            </Button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek op bestand of perceel"
            aria-label="Zoek op bestand of perceel"
            className="pl-9 pointer-coarse:h-11 pointer-coarse:text-base"
          />
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="bg-muted/40 text-muted-foreground hidden grid-cols-[2rem_8rem_minmax(0,1fr)_7rem_minmax(12rem,16rem)_6.5rem] items-center gap-3 border-b px-4 py-2 text-xs font-medium md:grid">
          <Checkbox
            checked={allVisibleIncluded}
            disabled={visibleIncludable.length === 0 || saving !== null}
            onCheckedChange={(checked) => {
              const ids = new Set(visibleIncludable.map((item) => item.row.id))
              onRowsChange((current) =>
                current.map((row) =>
                  ids.has(row.id) ? { ...row, include: checked === true } : row,
                ),
              )
            }}
            aria-label="Alle zichtbare analyses opslaan"
          />
          <span>Status</span>
          <span>Rapport</span>
          <span>Datum</span>
          <span>Perceel</span>
          <span className="sr-only">Acties</span>
        </div>
        {visible.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            {query
              ? "Geen analyses gevonden voor deze zoekopdracht."
              : filter === "attention"
                ? "Niets vraagt nog om aandacht."
                : "Geen analyses in deze weergave."}
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((item) => (
              <BulkReviewRow
                key={item.row.id}
                item={item}
                fields={fields}
                fieldsById={fieldsById}
                sourceLabel={sourceLabels.get(String(item.row.values.a_source ?? ""))}
                disabled={saving !== null}
                onIncludeChange={(include) =>
                  updateRow(item.row.id, (row) => ({ ...row, include }))
                }
                onFieldChange={(fieldId) =>
                  updateRow(item.row.id, (row) => ({
                    ...row,
                    fieldId,
                    matchReason: "manual",
                    nameConflictFieldId: null,
                    error: null,
                  }))
                }
                onOpen={() => setOpenRowId(item.row.id)}
                onRetryRead={() => onRetryRead(item.row.fileName)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="bg-background sticky bottom-0 z-10 flex flex-col gap-3 border-t py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 text-sm" aria-live="polite">
          {saving ? (
            <div className="space-y-1.5">
              <p className="font-medium">
                Opslaan… {saving.done} van {saving.total}
              </p>
              <Progress value={(saving.done / saving.total) * 100} className="h-2 max-w-md" />
            </div>
          ) : (
            <p className="text-muted-foreground">
              {counts.toSave === 1 ? "1 analyse wordt" : `${counts.toSave} analyses worden`}{" "}
              opgeslagen
              {counts.unsaved - counts.toSave > 0 &&
                `, ${counts.unsaved - counts.toSave} ${counts.unsaved - counts.toSave === 1 ? "wordt" : "worden"} overgeslagen`}
              .
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row max-sm:[&>*]:w-full pointer-coarse:[&>*]:h-11">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button type="button" variant="ghost" disabled={saving !== null}>
                  Terug naar PDF's kiezen
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Terug naar PDF's kiezen?</AlertDialogTitle>
                <AlertDialogDescription>
                  {counts.saved > 0
                    ? `De ${counts.saved} opgeslagen analyses blijven bewaard. Wat nog niet is opgeslagen, inclusief je aanpassingen, gaat verloren.`
                    : "Je controle en aanpassingen van deze PDF's gaan verloren. Er is nog niets opgeslagen."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Verder controleren</AlertDialogCancel>
                <AlertDialogAction onClick={onBack}>Terug naar PDF's kiezen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            type="button"
            size="lg"
            onClick={() => void handleSave()}
            disabled={saving !== null || counts.toSave === 0}
          >
            {saving ? (
              <>
                <Spinner />
                Opslaan…
              </>
            ) : counts.toSave === 1 ? (
              "1 analyse opslaan"
            ) : (
              `${counts.toSave} analyses opslaan`
            )}
          </Button>
        </div>
      </div>

      <Sheet open={openRow !== undefined} onOpenChange={(open) => !open && setOpenRowId(null)}>
        {openRow && (
          <RowSheet
            key={openRow.row.id}
            item={openRow}
            file={files.get(openRow.row.fileName)}
            fieldName={
              openRow.row.fieldId ? fieldsById.get(openRow.row.fieldId)?.b_name : undefined
            }
            soilParameterDescription={soilParameterDescription}
            siblingsWithoutDate={
              toDateKey(openRow.row.values.b_sampling_date)
                ? 0
                : rows.filter(
                    (row) =>
                      row.id !== openRow.row.id &&
                      row.kind === "analysis" &&
                      !row.saved &&
                      row.fileName === openRow.row.fileName &&
                      !toDateKey(row.values.b_sampling_date),
                  ).length
            }
            onApply={(values, dateForSiblings) => {
              const date = values.b_sampling_date
              onRowsChange((current) =>
                current.map((row) => {
                  if (row.id === openRow.row.id) return { ...row, values, error: null }
                  // A report usually has one sampling date: fill it in for the other analyses
                  // from the same PDF that have none
                  if (
                    dateForSiblings &&
                    date &&
                    row.kind === "analysis" &&
                    !row.saved &&
                    row.fileName === openRow.row.fileName &&
                    !toDateKey(row.values.b_sampling_date)
                  ) {
                    return { ...row, values: { ...row.values, b_sampling_date: date } }
                  }
                  return row
                }),
              )
              setOpenRowId(null)
            }}
            onClose={() => setOpenRowId(null)}
          />
        )}
      </Sheet>
    </div>
  )
}

/** One analysis of the review list. */
function BulkReviewRow({
  item,
  fields,
  fieldsById,
  sourceLabel,
  disabled,
  onIncludeChange,
  onFieldChange,
  onOpen,
  onRetryRead,
}: {
  item: JudgedRow
  fields: BulkField[]
  fieldsById: Map<string, BulkField>
  sourceLabel: string | undefined
  disabled: boolean
  onIncludeChange: (include: boolean) => void
  onFieldChange: (fieldId: string) => void
  onOpen: () => void
  onRetryRead: () => Promise<void>
}) {
  const { row, issues, status, included } = item
  const [retrying, setRetrying] = useState(false)
  const canInclude = row.kind === "analysis" && !row.saved && !issues.some((i) => i.blocking)
  const date = toDateKey(row.values.b_sampling_date)
  const depth =
    row.values.a_depth_lower !== undefined
      ? `${row.values.a_depth_upper ?? 0}–${row.values.a_depth_lower} cm`
      : null
  const details = [
    sourceLabel ?? (row.values.a_source ? String(row.values.a_source) : null),
    depth,
    row.reportFieldName ? `In rapport: ${row.reportFieldName}` : null,
  ].filter(Boolean)

  return (
    <li className={cn("px-4 py-3", status === "saved" && "bg-muted/30")}>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 md:grid-cols-[2rem_8rem_minmax(0,1fr)_7rem_minmax(12rem,16rem)_6.5rem]">
        <Checkbox
          checked={included}
          disabled={!canInclude || disabled}
          onCheckedChange={(checked) => onIncludeChange(checked === true)}
          aria-label={`${row.fileName} opslaan`}
          className="pointer-coarse:size-5"
        />
        <StatusLabel status={status} />
        <div className="col-start-2 min-w-0 md:col-start-auto">
          <p className="truncate text-sm font-medium" title={row.fileName}>
            {row.fileName}
          </p>
          {details.length > 0 && (
            <p className="text-muted-foreground truncate text-xs">{details.join(" · ")}</p>
          )}
        </div>
        <p className="col-start-2 text-sm tabular-nums md:col-start-auto">
          {row.kind === "readFailed" ? (
            ""
          ) : date ? (
            format(new Date(`${date}T00:00:00`), "dd-MM-yyyy", { locale: nl })
          ) : (
            <span className="text-destructive">Datum ontbreekt</span>
          )}
        </p>
        <div className="col-start-2 min-w-0 md:col-start-auto">
          {row.kind === "analysis" && (
            <>
              <FieldCombobox
                fields={fields}
                value={row.fieldId}
                samplingDate={date}
                disabled={disabled || row.saved !== null}
                onChange={onFieldChange}
                label={`Perceel voor ${row.fileName}`}
              />
              {row.fieldId && row.matchReason && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Gekoppeld {MATCH_LABELS[row.matchReason]}
                  {fieldsById.get(row.fieldId)?.b_area
                    ? ` · ${fieldsById.get(row.fieldId)?.b_area?.toLocaleString("nl-NL")} ha`
                    : ""}
                </p>
              )}
            </>
          )}
        </div>
        <div className="col-start-2 md:col-start-auto md:justify-self-end">
          {row.kind === "readFailed" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || retrying}
              onClick={() => {
                setRetrying(true)
                void onRetryRead().finally(() => setRetrying(false))
              }}
              className="pointer-coarse:h-10"
            >
              {retrying ? <Spinner /> : <RotateCcw aria-hidden />}
              Opnieuw
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpen}
              disabled={disabled || row.saved !== null}
              className="pointer-coarse:h-10"
            >
              <Eye aria-hidden />
              Bekijken
              <span className="sr-only"> {row.fileName}</span>
            </Button>
          )}
        </div>
      </div>
      {(issues.length > 0 || row.error || row.saved) && (
        <ul className="mt-2 space-y-1 pl-11 text-sm">
          {row.error && (
            <IssueLine tone="error">
              {row.kind === "readFailed" ? row.error : `Niet opgeslagen: ${row.error}`}
            </IssueLine>
          )}
          {issues.map((issue) => (
            <IssueLine key={issue.kind} tone={issue.blocking ? "error" : "warning"}>
              {issue.message}
              {issue.kind === "exists" &&
                !row.include &&
                " · niet opnieuw opslaan, tenzij je hem aanvinkt"}
            </IssueLine>
          ))}
          {row.saved && !row.saved.pdfStored && (
            <IssueLine tone="warning">Opgeslagen, maar de PDF kon niet worden bewaard</IssueLine>
          )}
        </ul>
      )}
    </li>
  )
}

function StatusLabel({ status }: { status: BulkRowStatus }) {
  const icon = {
    failed: <AlertCircle aria-hidden className="text-destructive size-4 shrink-0" />,
    incomplete: <CircleAlert aria-hidden className="text-destructive size-4 shrink-0" />,
    check: <TriangleAlert aria-hidden className="size-4 shrink-0 text-amber-700" />,
    ready: <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-700" />,
    saved: <CheckCircle2 aria-hidden className="text-muted-foreground size-4 shrink-0" />,
  }[status]
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium max-md:hidden">
      {icon}
      {STATUS_LABELS[status]}
    </span>
  )
}

function IssueLine({ tone, children }: { tone: "error" | "warning"; children: ReactNode }) {
  return (
    <li
      className={cn(
        "flex items-start gap-1.5",
        tone === "error" ? "text-destructive" : "text-amber-800",
      )}
    >
      {tone === "error" ? (
        <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      ) : (
        <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      )}
      <span>{children}</span>
    </li>
  )
}

/**
 * Searchable choice of a field, with its area. Fields that existed on the sampling date come first.
 */
function FieldCombobox({
  fields,
  value,
  samplingDate,
  disabled,
  onChange,
  label,
}: {
  fields: BulkField[]
  value: string | null
  samplingDate: string | null
  disabled: boolean
  onChange: (fieldId: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? fields.find((field) => field.b_id === value) : undefined
  const date = samplingDate ? new Date(`${samplingDate}T00:00:00`) : null
  const isActive = (field: BulkField) => {
    if (!date) return true
    const start = field.b_start ? new Date(field.b_start) : null
    const end = field.b_end ? new Date(field.b_end) : null
    return (!start || start <= date) && (!end || end >= date)
  }
  const sorted = [...fields].sort((a, b) => a.b_name.localeCompare(b.b_name, "nl"))
  const active = sorted.filter(isActive)
  const other = sorted.filter((field) => !isActive(field))

  const renderItem = (field: BulkField) => (
    <CommandItem
      key={field.b_id}
      value={`${field.b_name} ${field.b_id}`}
      onSelect={() => {
        onChange(field.b_id)
        setOpen(false)
      }}
    >
      <span className="min-w-0 flex-1 truncate">{field.b_name}</span>
      {field.b_area ? (
        <span className="text-muted-foreground text-xs tabular-nums">
          {field.b_area.toLocaleString("nl-NL")} ha
        </span>
      ) : null}
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal pointer-coarse:h-10",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="truncate">{selected ? selected.b_name : "Kies een perceel"}</span>
            <ChevronsUpDown aria-hidden className="opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Zoek een perceel" />
          <CommandList>
            <CommandEmpty>Geen perceel gevonden.</CommandEmpty>
            <CommandGroup heading={date ? "Percelen op de bemonsteringsdatum" : "Percelen"}>
              {active.map(renderItem)}
            </CommandGroup>
            {other.length > 0 && (
              <CommandGroup heading="Andere percelen">{other.map(renderItem)}</CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Side panel to check one analysis against its PDF and correct its values. */
function RowSheet({
  item,
  file,
  fieldName,
  soilParameterDescription,
  siblingsWithoutDate,
  onApply,
  onClose,
}: {
  item: JudgedRow
  file: File | undefined
  fieldName: string | undefined
  soilParameterDescription: SoilParameterDescription
  /** Other analyses from the same PDF that have no sampling date yet. */
  siblingsWithoutDate: number
  onApply: (values: Record<string, string | number>, dateForSiblings: boolean) => void
  onClose: () => void
}) {
  const { row, issues } = item
  // A local URL for the PDF, so it can be shown without uploading it again
  const pdfUrl = file ? getObjectUrl(file) : null
  const [dateForSiblings, setDateForSiblings] = useState(true)

  const parameters = soilParameterDescription.filter(
    (x) =>
      (SAMPLING_PARAMETERS as readonly string[]).includes(x.parameter) || x.parameter in row.values,
  )

  return (
    <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-6xl">
      <SheetHeader className="border-b p-4 md:px-6">
        <SheetTitle className="truncate pr-8">{row.fileName}</SheetTitle>
        <SheetDescription>
          {fieldName ? `Gekoppeld aan ${fieldName}. ` : "Nog niet gekoppeld aan een perceel. "}
          Vergelijk de waarden met het rapport; ongebruikelijke waarden zijn gemarkeerd.
        </SheetDescription>
        {issues.length > 0 && (
          <ul className="space-y-1 pt-1 text-sm">
            {issues.map((issue) => (
              <IssueLine key={issue.kind} tone={issue.blocking ? "error" : "warning"}>
                {issue.message}
              </IssueLine>
            ))}
          </ul>
        )}
        {siblingsWithoutDate > 0 && (
          <label className="flex items-start gap-2 pt-1 text-sm">
            <Checkbox
              checked={dateForSiblings}
              onCheckedChange={(checked) => setDateForSiblings(checked === true)}
              className="mt-0.5"
            />
            <span>
              Datum ook invullen bij{" "}
              {siblingsWithoutDate === 1
                ? "de andere analyse"
                : `de ${siblingsWithoutDate} andere analyses`}{" "}
              uit dit rapport zonder datum
            </span>
          </label>
        )}
      </SheetHeader>
      <div className="grid gap-6 p-4 md:px-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-2 xl:sticky xl:top-4">
          {pdfUrl ? (
            <>
              <iframe
                src={pdfUrl}
                title={`PDF-rapport ${row.fileName}`}
                className="bg-muted hidden h-[50vh] w-full rounded-lg border md:block xl:h-[75vh]"
              />
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium underline underline-offset-4"
              >
                Open de PDF in een nieuw tabblad
              </a>
            </>
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <CircleDashed aria-hidden className="size-4" />
              De PDF is niet meer beschikbaar.
            </p>
          )}
        </div>
        <SoilAnalysisForm
          soilAnalysis={undefined}
          initialValues={row.values}
          soilParameterDescription={parameters}
          action="."
          fromReport
          submitLabel="Wijzigingen toepassen"
          onValidSubmit={(values) => {
            const cleaned: Record<string, string | number> = {}
            for (const [key, value] of Object.entries(values)) {
              if (value === undefined || value === null || value === "") continue
              if (value instanceof Date) cleaned[key] = value.toISOString()
              else if (typeof value === "number" || typeof value === "string") cleaned[key] = value
            }
            onApply(cleaned, dateForSiblings && siblingsWithoutDate > 0)
          }}
          secondaryAction={
            <Button type="button" variant="ghost" onClick={onClose}>
              Sluiten
            </Button>
          }
        />
      </div>
    </SheetContent>
  )
}
