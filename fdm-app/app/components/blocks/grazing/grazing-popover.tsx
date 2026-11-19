import type { MultiPolygon } from "geojson"
import { addDays, format } from "date-fns"
import { nl } from "date-fns/locale"
import { Info, Trash2 } from "lucide-react"
import { useState } from "react"
import { useFetcher } from "react-router"
import { ZoneEditor } from "~/components/blocks/grazing/zone-editor"
import { DatePicker } from "~/components/custom/date-picker-v2"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { useToday } from "~/hooks/use-today"
import { formatHa } from "~/lib/format"
import { GRAZING_SEASON_LABEL, isInGrazingSeason } from "~/lib/grazing-status"
import { type Area, areaHa } from "~/lib/grazing-strip"
import { GRAZING_AREA_FIELD, GRAZING_ZONE_FIELD } from "~/lib/grazing-zone"

/** Which part of the field was grazed. */
type AreaMode = "full" | "partial" | "zone"

export interface GrazingPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  b_id_farm?: string
  calendar?: string
  field: { b_id: string; b_name: string; b_area: number } | null
  initialHerdId?: string
  initialStartDate?: string // YYYY-MM-DD
  initialEndDate?: string // YYYY-MM-DD
  existingGrazing?: {
    l_id_grazing: string
    l_id_herd: string
    l_grazing_start: string
    l_grazing_end?: string | null
    l_grazing_hours?: number | null
    /** Grazed part of the field without a known location (ha). */
    l_grazing_area?: number | null
    /** Grazed zone within the field. */
    l_grazing_geometry_zone?: MultiPolygon | null
  } | null
  herds: Array<{
    l_id_herd: string
    l_herd_name: string
    l_id_category: string
    l_lsu: number
    /** Number of animals, used to size a strip. */
    count?: number
  }>
  canWrite?: boolean
}

export function GrazingPopover({
  open,
  onOpenChange,
  b_id_farm,
  calendar,
  field,
  initialHerdId,
  initialStartDate,
  initialEndDate,
  existingGrazing,
  herds,
  canWrite = true,
}: GrazingPopoverProps) {
  const fetcher = useFetcher()

  const defaultHerdId = existingGrazing?.l_id_herd ?? initialHerdId ?? herds[0]?.l_id_herd ?? ""
  const [herdId, setHerdId] = useState(defaultHerdId)

  // "Today" is only known on the client; empty until then
  const todayDate = useToday()
  const today = todayDate ? format(todayDate, "yyyy-MM-dd") : ""

  const defaultStart = existingGrazing?.l_grazing_start
    ? format(new Date(existingGrazing.l_grazing_start), "yyyy-MM-dd")
    : (initialStartDate ?? today)

  // A grazing that still runs (cows out without an end date) keeps an empty end, so saving it
  // does not end it
  const isRunning = Boolean(existingGrazing) && !existingGrazing?.l_grazing_end
  const defaultEnd = existingGrazing?.l_grazing_end
    ? format(new Date(existingGrazing.l_grazing_end), "yyyy-MM-dd")
    : isRunning
      ? ""
      : (initialEndDate ?? defaultStart)

  // Start from the defaults, which may still change once "today" is known
  const [startDate, setStartDate] = useKeyedState(defaultStart, (day) => day)
  const [pickedEndDate, setEndDate] = useKeyedState(defaultEnd, (day) => day)
  // A grazing of one day ends on its start day; one of several days, or one that still runs, has
  // its own end
  const [duration, setDuration] = useState<"single" | "multiple">(
    isRunning || (defaultEnd !== "" && defaultEnd !== defaultStart) ? "multiple" : "single",
  )
  // The end never lies before the start, also when the start moves past a default end
  const endDate =
    duration === "single"
      ? startDate
      : pickedEndDate !== "" && pickedEndDate < startDate
        ? startDate
        : pickedEndDate

  const handleDurationChange = (next: "single" | "multiple") => {
    setDuration(next)
    // Several days: suggest an end the day after the start
    if (
      next === "multiple" &&
      startDate !== "" &&
      (pickedEndDate === "" || pickedEndDate <= startDate) &&
      !isRunning
    ) {
      setEndDate(format(addDays(new Date(`${startDate}T12:00:00`), 1), "yyyy-MM-dd"))
    }
  }

  // A new grazing starts at 8 hours, which is the "Beperkt (8u)" preset
  const initialHours = existingGrazing?.l_grazing_hours ?? 8
  const [hourPreset, setHourPreset] = useState<"8" | "24" | "custom">(
    initialHours === 24 ? "24" : initialHours === 8 ? "8" : "custom",
  )
  const [hours, setHours] = useState<number>(initialHours)

  const fieldArea = field?.b_area ?? 0
  const storedZone = existingGrazing?.l_grazing_geometry_zone ?? null
  const [areaMode, setAreaMode] = useState<AreaMode>(
    storedZone ? "zone" : existingGrazing?.l_grazing_area ? "partial" : "full",
  )
  // The part of the field without a location, as a percentage of the field area
  const [partialPercentage, setPartialPercentage] = useState<number>(
    existingGrazing?.l_grazing_area && fieldArea > 0
      ? Math.min(100, Math.round((existingGrazing.l_grazing_area / fieldArea) * 100))
      : 50,
  )
  const [zone, setZone] = useState<Area | null>(storedZone)

  const handleHourPresetChange = (preset: "8" | "24" | "custom") => {
    setHourPreset(preset)
    if (preset === "8") setHours(8)
    if (preset === "24") setHours(24)
  }

  const partialArea = Number(((fieldArea * partialPercentage) / 100).toFixed(2))
  const effectiveArea =
    areaMode === "full"
      ? fieldArea
      : areaMode === "partial"
        ? partialArea
        : zone
          ? Number(Math.min(areaHa(zone), fieldArea).toFixed(2))
          : 0
  const herdCount = herds.find((h) => h.l_id_herd === herdId)?.count

  // Calculations for live preview
  const sDate = new Date(startDate)
  // A running grazing counts up to today
  const eDate = new Date(endDate || today)
  const diffDays =
    !isNaN(sDate.getTime()) && !isNaN(eDate.getTime())
      ? Math.max(1, Math.floor((eDate.getTime() - sDate.getTime()) / 86400000) + 1)
      : 1
  const totalHours = diffDays * (hours || 0)

  const isFuture = today !== "" && startDate > today
  // The grazing calendar only shows the grazing season; a grazing outside it is kept, but only
  // shows on the field's grazing tab
  const outsideSeason =
    (startDate !== "" && !isInGrazingSeason(startDate)) ||
    (endDate !== "" && !isInGrazingSeason(endDate))
  const zoneMissing = areaMode === "zone" && !zone
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!field) return

    const formData = new FormData()
    if (existingGrazing) {
      formData.set("intent", "update_grazing")
      formData.set("l_id_grazing", existingGrazing.l_id_grazing)
    } else {
      formData.set("intent", "add_grazing")
      formData.set("b_id", field.b_id)
      formData.set("l_id_herd", herdId)
    }

    formData.set("l_grazing_start", startDate)
    // Without an end date the grazing keeps running
    if (endDate !== "") formData.set("l_grazing_end", endDate)
    formData.set("l_grazing_hours", String(hours))
    // Always send both, so an update can switch between whole field, area and zone
    formData.set(GRAZING_AREA_FIELD, areaMode === "partial" ? String(partialArea) : "")
    formData.set(GRAZING_ZONE_FIELD, areaMode === "zone" && zone ? JSON.stringify(zone) : "")

    void fetcher.submit(formData, { method: "post" })
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (!existingGrazing) return
    const formData = new FormData()
    formData.set("intent", "remove_grazing")
    formData.set("l_id_grazing", existingGrazing.l_id_grazing)
    void fetcher.submit(formData, { method: "post" })
    setIsDeleteOpen(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* One width for every area choice, so the dialog does not jump when the map appears */}
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              Beweiding · {field?.b_name ?? "Perceel"} ({formatHa(fieldArea)} ha)
            </DialogTitle>
            <DialogDescription>
              Leg de beweidingsperiode en uren vast voor dit perceel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FieldGroup>
              {/* One day or several days */}
              <Field>
                <FieldLabel id="popover-duration-label">Duur *</FieldLabel>
                <div
                  role="group"
                  aria-labelledby="popover-duration-label"
                  className="grid grid-cols-2 gap-2"
                >
                  <Button
                    type="button"
                    variant={duration === "single" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={duration === "single"}
                    onClick={() => handleDurationChange("single")}
                    disabled={isRunning}
                    className="text-xs"
                  >
                    1 dag
                  </Button>
                  <Button
                    type="button"
                    variant={duration === "multiple" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={duration === "multiple"}
                    onClick={() => handleDurationChange("multiple")}
                    className="text-xs"
                  >
                    Meerdere dagen
                  </Button>
                </div>
              </Field>

              {/* Koppel Select */}
              <Field>
                <FieldLabel htmlFor="popover-herd">Koppel *</FieldLabel>
                <Select
                  value={herdId}
                  items={herds.map((h) => ({ value: h.l_id_herd, label: h.l_herd_name }))}
                  onValueChange={(v) => {
                    if (v !== null) setHerdId(v)
                  }}
                  disabled={Boolean(existingGrazing)}
                >
                  <SelectTrigger id="popover-herd">
                    <SelectValue placeholder="Kies een koppel" />
                  </SelectTrigger>
                  <SelectContent>
                    {herds.map((h) => (
                      <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                        {h.l_herd_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* The day, or the first and last day */}
              <div className={duration === "multiple" ? "grid grid-cols-2 gap-3" : undefined}>
                <DatePicker
                  label={duration === "multiple" ? "Van *" : "Datum *"}
                  field={{
                    name: "l_grazing_start",
                    value: startDate,
                    onChange: (val) => {
                      const str = val ? format(new Date(val), "yyyy-MM-dd") : ""
                      setStartDate(str)
                    },
                    onBlur: () => {},
                    ref: () => {},
                  }}
                  fieldState={{
                    invalid: false,
                    isTouched: false,
                    isDirty: false,
                    isValidating: false,
                  }}
                  required
                />
                {duration === "multiple" && (
                  <DatePicker
                    label={isRunning ? "t/m" : "t/m *"}
                    description={isRunning ? "Leeg laten: de koeien lopen nog buiten." : undefined}
                    field={{
                      name: "l_grazing_end",
                      value: endDate,
                      onChange: (val) => {
                        const str = val ? format(new Date(val), "yyyy-MM-dd") : ""
                        setEndDate(str)
                      },
                      onBlur: () => {},
                      ref: () => {},
                    }}
                    fieldState={{
                      invalid: false,
                      isTouched: false,
                      isDirty: false,
                      isValidating: false,
                    }}
                    required={!isRunning}
                  />
                )}
              </div>

              {/* Hours per Day */}
              <Field>
                <FieldLabel id="popover-hours-label">Uren per dag *</FieldLabel>
                <div
                  role="group"
                  aria-labelledby="popover-hours-label"
                  className="grid grid-cols-3 gap-2"
                >
                  <Button
                    type="button"
                    variant={hourPreset === "24" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={hourPreset === "24"}
                    onClick={() => handleHourPresetChange("24")}
                    className="text-xs"
                  >
                    Dag & nacht (24u)
                  </Button>
                  <Button
                    type="button"
                    variant={hourPreset === "8" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={hourPreset === "8"}
                    onClick={() => handleHourPresetChange("8")}
                    className="text-xs"
                  >
                    Beperkt (8u)
                  </Button>
                  <Button
                    type="button"
                    variant={hourPreset === "custom" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={hourPreset === "custom"}
                    onClick={() => handleHourPresetChange("custom")}
                    className="text-xs"
                  >
                    Aangepast
                  </Button>
                </div>

                {hourPreset === "custom" && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      id="popover-hours"
                      type="number"
                      min="1"
                      max="24"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(parseFloat(e.target.value || "0"))}
                      className="w-24"
                      aria-label="Aantal uren per dag"
                    />
                    <span className="text-muted-foreground text-xs">uur per dag</span>
                  </div>
                )}
              </Field>

              {/* Area Mode */}
              <Field>
                <FieldLabel>Oppervlak</FieldLabel>
                <RadioGroup
                  value={areaMode}
                  onValueChange={(val) => setAreaMode(val as AreaMode)}
                  className="space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="area-full" />
                    <Label htmlFor="area-full" className="cursor-pointer text-xs font-normal">
                      Volledig perceel ({formatHa(fieldArea)} ha)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="zone" id="area-zone" />
                    <Label htmlFor="area-zone" className="cursor-pointer text-xs font-normal">
                      Zone op de kaart
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partial" id="area-partial" />
                    <Label htmlFor="area-partial" className="cursor-pointer text-xs font-normal">
                      Deel van perceel, zonder kaart
                    </Label>
                  </div>
                </RadioGroup>

                {areaMode === "zone" && field && b_id_farm && calendar && (
                  <div className="mt-2">
                    <ZoneEditor
                      b_id_farm={b_id_farm}
                      calendar={calendar}
                      b_id={field.b_id}
                      zone={zone}
                      onZoneChange={setZone}
                      storedZone={storedZone}
                      animals={herdCount}
                      hoursPerDay={hours}
                      days={diffDays}
                      startDate={startDate}
                    />
                  </div>
                )}

                {areaMode === "partial" && (
                  <div className="mt-2 space-y-2 pl-6">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[50, 33, 25].map((percentage) => (
                        <Button
                          key={percentage}
                          type="button"
                          variant={partialPercentage === percentage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPartialPercentage(percentage)}
                          aria-pressed={partialPercentage === percentage}
                          className="h-7 px-2 text-xs"
                        >
                          {percentage}%
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={partialPercentage}
                        onChange={(e) =>
                          setPartialPercentage(
                            Math.min(100, Math.max(0, parseFloat(e.target.value || "0"))),
                          )
                        }
                        className="h-8 w-20 text-xs"
                        aria-label="Deel van het perceel in procent"
                      />
                      <span className="text-muted-foreground text-xs">
                        % van {formatHa(fieldArea)} ha = {formatHa(partialArea)} ha
                      </span>
                    </div>
                  </div>
                )}
              </Field>
            </FieldGroup>

            {/* Live summary of what will be recorded */}
            <div
              className="bg-muted/30 text-muted-foreground space-y-1 rounded-lg border p-3 text-xs"
              aria-live="polite"
            >
              <p className="text-foreground flex items-center gap-1.5 font-medium">
                <Info aria-hidden="true" className="text-primary h-3.5 w-3.5 shrink-0" />
                <span>
                  {diffDays.toLocaleString("nl-NL")} {diffDays === 1 ? "weidedag" : "weidedagen"} ·{" "}
                  {totalHours.toLocaleString("nl-NL")}{" "}
                  {totalHours === 1 ? "weide-uur" : "weide-uren"} op {field?.b_name} (
                  {formatHa(effectiveArea)} ha).
                </span>
              </p>
              {isFuture && (
                <p className="text-amber-800">
                  De startdatum ligt in de toekomst: de beweiding wordt vastgelegd als plan.
                </p>
              )}
              {outsideSeason && (
                <p className="text-amber-800">
                  Valt (deels) buiten de beweidingskalender ({GRAZING_SEASON_LABEL}). De beweiding
                  telt wel mee en staat op de tab Beweiding van het perceel.
                </p>
              )}
              {zoneMissing && <p>Teken eerst een zone op de kaart of kies er een.</p>}
              {!existingGrazing && calendar && (
                <p>
                  Met deze beweiding staat Beweiding {calendar} aan voor dit bedrijf; dat telt mee
                  voor de stikstofgebruiksnorm.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between border-t pt-4 sm:justify-between">
            {existingGrazing && canWrite ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteOpen(true)}
                className="gap-1.5"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                <span>Verwijderen</span>
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button
                type="submit"
                disabled={
                  !canWrite || zoneMissing || (areaMode === "partial" && !(partialArea > 0))
                }
              >
                <span key={existingGrazing ? "save" : "record"}>
                  {existingGrazing ? "Opslaan" : "Vastleggen"}
                </span>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beweiding verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              De beweiding van {field?.b_name ?? "dit perceel"} vanaf{" "}
              {startDate
                ? format(new Date(`${startDate}T12:00:00`), "d MMMM yyyy", { locale: nl })
                : "de startdatum"}{" "}
              wordt verwijderd. Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
