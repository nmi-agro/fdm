import type { Measure, MeasureCatalogue } from "@nmi-agro/fdm-core"
/**
 * Add Measure dialog for the Maatregelen field detail page.
 *
 * Features:
 * - Two-step flow: step 1 = search + select measure; step 2 = configure dates + fields
 * - Fuzzy search (fuzzysort) filtering catalogue by m_name, m_id, m_description
 * - Conflict detection: flags/blocks measures conflicting with already-active ones
 * - On selection: immediately transitions to configure step
 * - Back button in configure step returns to select step
 * - Date picker step with 3 presets: Doorlopend, Einde teeltseizoen, Vaste einddatum
 * - Field list: selected fields sorted to top, with cultivation badge + area
 * - Submits a POST form with intent=add
 */
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import fuzzysort from "fuzzysort"
import { AlertTriangle, ChevronLeft, Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Controller } from "react-hook-form"
import { useFetcher } from "react-router"
import { useRemixForm } from "remix-hook-form"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { cn } from "~/lib/utils"
import { type MeasureDateFormValues, MeasureDateSchema } from "./formschema"

type DatePreset = "doorlopend" | "einde_teeltseizoen" | "vaste_einddatum"
type DialogStep = "select" | "configure"

type FieldItem = {
  b_id: string
  b_name: string | null
  b_area?: number | null
  mainCultivation?: {
    b_lu_name: string | null
    b_lu_croprotation: string | null
  } | null
}

type AddMeasureDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Full catalogue of available measures */
  catalogue: MeasureCatalogue[]
  /** Measures already active on this field (for conflict detection) */
  activeMeasures: Measure[]
  /** Calendar year start (YYYY-MM-DD) used as default start date */
  calendarYearStart: string
  /** Harvest/end date for "Einde teeltseizoen" preset (YYYY-MM-DD or null) */
  harvestDate: string | null
  /**
   * When provided, renders a field selector (checkboxes) so the user can
   * apply the measure to multiple fields at once. Posts multiple hidden
   * `b_id` inputs. When absent, no field selector is shown and the action
   * reads `b_id` from URL params (field detail page behaviour).
   */
  fields?: FieldItem[]
  /**
   * Field IDs to pre-select when the dialog opens. Only used when `fields`
   * is provided. Defaults to no selection.
   */
  initialFieldIds?: string[]
  /**
   * Explicit URL to POST to. Required when the dialog is used inside a layout
   * route (e.g. the farm _index) so that React Router doesn't post to the
   * parent layout instead of the index action.
   */
  action?: string
}

export function AddMeasureDialog({
  open,
  onOpenChange,
  catalogue,
  activeMeasures,
  calendarYearStart,
  harvestDate,
  fields,
  initialFieldIds,
  action,
}: AddMeasureDialogProps) {
  const fetcher = useFetcher()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<MeasureCatalogue | null>(null)
  const [step, setStep] = useState<DialogStep>("select")
  const [datePreset, setDatePreset] = useState<DatePreset>("doorlopend")
  const searchRef = useRef<HTMLInputElement>(null)
  // Multi-field selection: default to initialFieldIds or empty
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
    () => new Set(initialFieldIds ?? []),
  )
  const [fieldSearch, setFieldSearch] = useState("")

  const form = useRemixForm<MeasureDateFormValues>({
    fetcher,
    resolver: zodResolver(MeasureDateSchema),
    defaultValues: {
      m_start: calendarYearStart,
      m_end: null,
    },
    submitHandlers: {
      onValid: (data) => {
        if (!selected?.m_id) {
          return
        }

        const fd = new FormData()
        fd.append("intent", "add")
        fd.append("m_id", selected.m_id)
        fd.append("m_start", data.m_start)
        if (data.m_end) fd.append("m_end", data.m_end)
        else fd.append("m_end", "")
        if (fields) {
          for (const b_id of selectedFieldIds) fd.append("b_id", b_id)
        }
        void fetcher.submit(fd, {
          method: "post",
          action: action ?? undefined,
        })
      },
    },
  })

  // Close dialog only on successful submission (not on errors)
  const isSubmitting = fetcher.state !== "idle"
  const prevState = useRef(fetcher.state)
  useEffect(() => {
    if (
      prevState.current !== "idle" &&
      fetcher.state === "idle" &&
      fetcher.data != null &&
      typeof fetcher.data === "object" &&
      "result" in fetcher.data
    ) {
      onOpenChange(false)
    }
    prevState.current = fetcher.state
  }, [fetcher.state, fetcher.data, onOpenChange])

  // Capture initialFieldIds in a ref so the reset effect doesn't re-run
  // whenever the parent passes a new array instance with the same content.
  const initialFieldIdsRef = useRef(initialFieldIds)
  initialFieldIdsRef.current = initialFieldIds

  // Destructure reset so the effect can depend on a stable function reference
  // (react-hook-form guarantees `reset` identity is stable across renders).
  const { reset: resetForm } = form

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelected(null)
      setStep("select")
      setDatePreset("doorlopend")
      resetForm({ m_start: calendarYearStart, m_end: null })
      setSelectedFieldIds(new Set(initialFieldIdsRef.current ?? []))
      setFieldSearch("")
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open, calendarYearStart, resetForm])

  // Derive the set of m_ids already active on the field
  const activeMeasureIds = useMemo(
    () => new Set(activeMeasures.map((m) => m.m_id)),
    [activeMeasures],
  )

  // Derive conflict map: m_id → list of conflicting active measure names
  const conflictMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const catalogueItem of catalogue) {
      if (!catalogueItem.m_conflicts) continue
      const conflicting = catalogueItem.m_conflicts.filter((cid) => activeMeasureIds.has(cid))
      if (conflicting.length > 0) {
        const names = conflicting.map(
          (cid) => activeMeasures.find((m) => m.m_id === cid)?.m_name ?? cid,
        )
        map.set(catalogueItem.m_id, names)
      }
    }
    return map
  }, [catalogue, activeMeasureIds, activeMeasures])

  // Fuzzy search — search against indexed combined strings per catalogue item
  const filteredCatalogue = useMemo(() => {
    if (!query.trim()) return catalogue
    const targets = catalogue.map(
      (item, i) => `[${i}] ${item.m_name} ${item.m_id} ${item.m_description ?? ""}`,
    )
    const results = fuzzysort.go(query, targets, { threshold: -10000 })
    return results
      .map((r) => {
        const match = r.target.match(/^\[(\d+)\]/)
        if (!match) return null
        return catalogue[Number(match[1])] ?? null
      })
      .filter((item): item is (typeof catalogue)[number] => item !== null)
  }, [query, catalogue])

  // Determine end date to submit based on preset — sync to form state
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset)
    if (preset === "doorlopend") form.setValue("m_end", null)
    else if (preset === "einde_teeltseizoen") form.setValue("m_end", harvestDate ?? null)
    else form.setValue("m_end", null)
  }

  const mStart = form.watch("m_start")
  const mEnd = form.watch("m_end")

  const canSubmit =
    selected !== null &&
    !conflictMap.has(selected.m_id) &&
    !!mStart &&
    (datePreset !== "vaste_einddatum" || !!mEnd) &&
    (fields === undefined || selectedFieldIds.size > 0)

  // Sort fields: selected first, then unselected — alphabetically within each group
  const sortedFields = useMemo(() => {
    if (!fields) return []
    return [...fields].sort((a, b) => {
      const aSelected = selectedFieldIds.has(a.b_id)
      const bSelected = selectedFieldIds.has(b.b_id)
      if (aSelected !== bSelected) return aSelected ? -1 : 1
      return (a.b_name ?? "").localeCompare(b.b_name ?? "", "nl")
    })
  }, [fields, selectedFieldIds])

  const visibleFields = useMemo(() => {
    if (!fieldSearch.trim()) return sortedFields
    const term = fieldSearch.toLowerCase()
    return sortedFields.filter(
      (f) =>
        (f.b_name ?? "").toLowerCase().includes(term) ||
        (f.mainCultivation?.b_lu_name ?? "").toLowerCase().includes(term),
    )
  }, [sortedFields, fieldSearch])

  const handleSelectMeasure = (item: MeasureCatalogue) => {
    setSelected(item)
    setStep("configure")
  }

  const handleBackToSelect = () => {
    setSelected(null)
    setStep("select")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Maatregel toevoegen</DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Select a measure ── */}
        {step === "select" && (
          <>
            {/* Search bar */}
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                ref={searchRef}
                placeholder="Zoek op naam of code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Catalogue list */}
            <div className="max-h-[55vh] overflow-y-auto rounded-md border">
              {filteredCatalogue.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Geen maatregelen gevonden voor &ldquo;
                  {query}&rdquo;
                </p>
              ) : (
                <div className="divide-y">
                  {filteredCatalogue.map((item) => {
                    const isAlreadyActive = activeMeasureIds.has(item.m_id)
                    const conflicts = conflictMap.get(item.m_id)
                    const isBlocked = isAlreadyActive || !!conflicts

                    return (
                      <button
                        key={item.m_id}
                        type="button"
                        disabled={isBlocked}
                        onClick={() => {
                          if (!isBlocked) {
                            handleSelectMeasure(item)
                          }
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                          "hover:bg-muted/50",
                          isBlocked && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground shrink-0 font-mono text-xs">
                              {item.m_id.replace("bln_", "")}
                            </span>
                            <span className="truncate text-sm font-medium">{item.m_name}</span>
                          </div>
                          {isAlreadyActive && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              Al actief op dit perceel
                            </p>
                          )}
                          {conflicts && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              Conflicteert met: {conflicts.join(", ")}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Step 2: Configure dates + fields ── */}
        {step === "configure" && selected && (
          <>
            {/* Selected measure header with back button */}
            <div className="bg-muted/30 space-y-1 rounded-md border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    <span className="text-muted-foreground mr-2 font-mono text-xs">
                      {selected.m_id.replace("bln_", "")}
                    </span>
                    {selected.m_name}
                  </p>
                  {(selected.m_summary ?? selected.m_description) && (
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {selected.m_summary ?? selected.m_description}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToSelect}
                  className="text-muted-foreground hover:text-foreground -mt-1 -mr-2 shrink-0"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Andere maatregel
                </Button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={form.handleSubmit}>
              <FieldGroup className="py-2">
                {/* Field selector (multi-field mode only) */}
                {fields && fields.length > 0 && (
                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel>
                        Percelen
                        {selectedFieldIds.size > 0 && (
                          <span className="text-muted-foreground ml-2 font-normal">
                            {selectedFieldIds.size} van {fields.length} geselecteerd
                          </span>
                        )}
                      </FieldLabel>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs"
                        onClick={() => {
                          const visibleIds = visibleFields.map((f) => f.b_id)
                          const allVisible = visibleIds.every((id) => selectedFieldIds.has(id))
                          const next = new Set(selectedFieldIds)
                          if (allVisible) {
                            for (const id of visibleIds) next.delete(id)
                          } else {
                            for (const id of visibleIds) next.add(id)
                          }
                          setSelectedFieldIds(next)
                        }}
                      >
                        {visibleFields.every((f) => selectedFieldIds.has(f.b_id)) ? "Geen" : "Alle"}
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
                      <Input
                        placeholder="Zoek perceel…"
                        value={fieldSearch}
                        onChange={(e) => setFieldSearch(e.target.value)}
                        className="h-8 pl-8 text-sm"
                      />
                      {fieldSearch && (
                        <button
                          type="button"
                          onClick={() => setFieldSearch("")}
                          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="max-h-48 divide-y overflow-y-auto rounded-md border">
                      {visibleFields.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                          Geen percelen gevonden.
                        </p>
                      ) : (
                        visibleFields.map((f) => {
                          const checked = selectedFieldIds.has(f.b_id)
                          const cultColor = getCultivationColor(
                            f.mainCultivation?.b_lu_croprotation ?? undefined,
                          )
                          return (
                            <label
                              key={f.b_id}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors",
                                checked ? "bg-primary/5" : "hover:bg-muted/50",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="shrink-0 rounded"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(selectedFieldIds)
                                  if (checked) {
                                    next.delete(f.b_id)
                                  } else {
                                    next.add(f.b_id)
                                  }
                                  setSelectedFieldIds(next)
                                }}
                              />
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate text-sm",
                                  checked && "font-medium",
                                )}
                              >
                                {f.b_name ?? f.b_id}
                              </span>
                              <div className="flex shrink-0 items-center gap-2">
                                {f.mainCultivation?.b_lu_name && (
                                  <Badge
                                    className="px-1.5 py-0 text-xs text-white"
                                    style={{
                                      backgroundColor: cultColor,
                                    }}
                                  >
                                    {f.mainCultivation.b_lu_name}
                                  </Badge>
                                )}
                                {f.b_area != null && (
                                  <span className="text-muted-foreground text-xs">
                                    {f.b_area.toFixed(1)} ha
                                  </span>
                                )}
                              </div>
                            </label>
                          )
                        })
                      )}
                    </div>
                    {selectedFieldIds.size === 0 && (
                      <p className="text-destructive mt-1 text-xs">
                        Selecteer minimaal één perceel.
                      </p>
                    )}
                  </Field>
                )}

                <Controller
                  control={form.control}
                  name="m_start"
                  render={({ field, fieldState }) => (
                    <DatePicker
                      label="Startdatum"
                      field={{
                        ...field,
                        value: field.value,
                      }}
                      fieldState={fieldState}
                      required
                    />
                  )}
                />

                <Field>
                  <FieldLabel>Periode</FieldLabel>
                  <RadioGroup
                    value={datePreset}
                    onValueChange={(v) => handleDatePresetChange(v as DatePreset)}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="doorlopend" id="preset-doorlopend" />
                      <Label htmlFor="preset-doorlopend" className="cursor-pointer font-normal">
                        Doorlopend
                        <span className="text-muted-foreground ml-1 text-xs">(geen einddatum)</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="einde_teeltseizoen"
                        id="preset-harvest"
                        disabled={!harvestDate}
                      />
                      <Label
                        htmlFor="preset-harvest"
                        className={cn(
                          "cursor-pointer font-normal",
                          !harvestDate && "cursor-not-allowed opacity-50",
                        )}
                      >
                        Einde teeltseizoen
                        {harvestDate && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            (≈ {format(new Date(harvestDate), "d MMM yyyy", { locale: nl })})
                          </span>
                        )}
                        {!harvestDate && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            (geen oogstdatum beschikbaar)
                          </span>
                        )}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="vaste_einddatum" id="preset-fixed" />
                      <Label htmlFor="preset-fixed" className="cursor-pointer font-normal">
                        Vaste einddatum
                      </Label>
                    </div>
                  </RadioGroup>

                  {datePreset === "vaste_einddatum" && (
                    <div className="mt-2">
                      <Controller
                        control={form.control}
                        name="m_end"
                        render={({ field, fieldState }) => (
                          <DatePicker
                            label=""
                            field={{
                              ...field,
                              value: field.value,
                            }}
                            fieldState={fieldState}
                            required
                          />
                        )}
                      />
                    </div>
                  )}
                </Field>

                <div className="flex justify-end pt-1 pb-2">
                  <Button type="submit" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? "Opslaan…" : "Opslaan"}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
