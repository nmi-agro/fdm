import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"
import { DatePicker } from "~/components/custom/date-picker-v2"
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
import { format } from "date-fns"
import { Info, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useFetcher } from "react-router"

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
    l_grazing_area?: number | null
    l_grazing_type?: "full" | "partial" | null
  } | null
  herds: Array<{
    l_id_herd: string
    l_herd_name: string
    l_id_category: string
    l_lsu: number
  }>
  canWrite?: boolean
}

export function GrazingPopover({
  open,
  onOpenChange,
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

  const defaultStart = existingGrazing?.l_grazing_start
    ? format(new Date(existingGrazing.l_grazing_start), "yyyy-MM-dd")
    : initialStartDate ?? format(new Date(), "yyyy-MM-dd")

  const defaultEnd = existingGrazing?.l_grazing_end
    ? format(new Date(existingGrazing.l_grazing_end), "yyyy-MM-dd")
    : initialEndDate ?? defaultStart

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)

  const [hourPreset, setHourPreset] = useState<"8" | "24" | "custom">(
    existingGrazing?.l_grazing_hours === 24
      ? "24"
      : existingGrazing?.l_grazing_hours === 8
        ? "8"
        : "custom",
  )
  const [hours, setHours] = useState<number>(existingGrazing?.l_grazing_hours ?? 8)

  const [areaMode, setAreaMode] = useState<"full" | "partial">(
    existingGrazing?.l_grazing_type === "partial" ? "partial" : "full",
  )
  const [partialArea, setPartialArea] = useState<number>(
    existingGrazing?.l_grazing_area ?? Number(((field?.b_area ?? 1) / 2).toFixed(1)),
  )

  useEffect(() => {
    if (existingGrazing) {
      setHerdId(existingGrazing.l_id_herd)
      setStartDate(format(new Date(existingGrazing.l_grazing_start), "yyyy-MM-dd"))
      setEndDate(
        existingGrazing.l_grazing_end
          ? format(new Date(existingGrazing.l_grazing_end), "yyyy-MM-dd")
          : format(new Date(existingGrazing.l_grazing_start), "yyyy-MM-dd"),
      )
      setHours(existingGrazing.l_grazing_hours ?? 8)
      setHourPreset(
        existingGrazing.l_grazing_hours === 24
          ? "24"
          : existingGrazing.l_grazing_hours === 8
            ? "8"
            : "custom",
      )
      setAreaMode(existingGrazing.l_grazing_type === "partial" ? "partial" : "full")
      if (existingGrazing.l_grazing_area) {
        setPartialArea(existingGrazing.l_grazing_area)
      }
    } else {
      if (initialHerdId) setHerdId(initialHerdId)
      if (initialStartDate) setStartDate(initialStartDate)
      if (initialEndDate) setEndDate(initialEndDate)
      setHours(8)
      setHourPreset("8")
      setAreaMode("full")
    }
  }, [existingGrazing, initialHerdId, initialStartDate, initialEndDate, field])

  const handleHourPresetChange = (preset: "8" | "24" | "custom") => {
    setHourPreset(preset)
    if (preset === "8") setHours(8)
    if (preset === "24") setHours(24)
  }

  const fieldArea = field?.b_area ?? 0
  const effectiveArea = areaMode === "full" ? fieldArea : Math.min(partialArea, fieldArea)

  // Calculations for live preview
  const sDate = new Date(startDate)
  const eDate = new Date(endDate)
  const diffDays =
    !isNaN(sDate.getTime()) && !isNaN(eDate.getTime())
      ? Math.max(1, Math.floor((eDate.getTime() - sDate.getTime()) / 86400000) + 1)
      : 1
  const totalHours = diffDays * (hours || 0)

  const isFuture = startDate > format(new Date(), "yyyy-MM-dd")

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
    formData.set("l_grazing_end", endDate)
    formData.set("l_grazing_hours", String(hours))
    formData.set("l_grazing_type", areaMode)
    if (areaMode === "partial") {
      formData.set("l_grazing_area", String(partialArea))
    }

    void fetcher.submit(formData, { method: "post" })
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (!existingGrazing) return
    const formData = new FormData()
    formData.set("intent", "remove_grazing")
    formData.set("l_id_grazing", existingGrazing.l_id_grazing)
    void fetcher.submit(formData, { method: "post" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              Beweiding · {field?.b_name ?? "Perceel"} ({field?.b_area} ha)
            </DialogTitle>
            <DialogDescription>
              Leg de beweidingsperiode en uren vast voor dit perceel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FieldGroup>
              {/* Koppel Select */}
              <Field>
                <FieldLabel htmlFor="popover-herd">Koppel *</FieldLabel>
                <Select value={herdId} onValueChange={setHerdId} disabled={Boolean(existingGrazing)}>
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

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  label="Van *"
                  field={{
                    name: "l_grazing_start",
                    value: startDate,
                    onChange: (val) => {
                      const str = val ? format(new Date(val), "yyyy-MM-dd") : ""
                      setStartDate(str)
                      if (str > endDate) setEndDate(str)
                    },
                    onBlur: () => {},
                    ref: () => {},
                  }}
                  fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                  required
                />
                <DatePicker
                  label="t/m *"
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
                  fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                  required
                />
              </div>

              {/* Hours per Day */}
              <Field>
                <FieldLabel>Uren per dag *</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={hourPreset === "24" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleHourPresetChange("24")}
                    className="text-xs"
                  >
                    Dag & nacht (24u)
                  </Button>
                  <Button
                    type="button"
                    variant={hourPreset === "8" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleHourPresetChange("8")}
                    className="text-xs"
                  >
                    Beperkt (8u)
                  </Button>
                  <Button
                    type="button"
                    variant={hourPreset === "custom" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleHourPresetChange("custom")}
                    className="text-xs"
                  >
                    Aangepast
                  </Button>
                </div>

                {hourPreset === "custom" && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(parseFloat(e.target.value || "0"))}
                      className="w-24"
                    />
                    <span className="text-muted-foreground text-xs">uur / dag</span>
                  </div>
                )}
              </Field>

              {/* Area Mode */}
              <Field>
                <FieldLabel>Oppervlak</FieldLabel>
                <RadioGroup
                  value={areaMode}
                  onValueChange={(val: "full" | "partial") => setAreaMode(val)}
                  className="space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="area-full" />
                    <Label htmlFor="area-full" className="cursor-pointer font-normal text-xs">
                      Volledig perceel ({field?.b_area} ha)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partial" id="area-partial" />
                    <Label htmlFor="area-partial" className="cursor-pointer font-normal text-xs">
                      Deel van perceel
                    </Label>
                  </div>
                </RadioGroup>

                {areaMode === "partial" && (
                  <div className="mt-2 space-y-2 pl-6">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPartialArea(Number((fieldArea * 0.5).toFixed(1)))}
                        className="h-7 px-2 text-[11px]"
                      >
                        1/2 ({(fieldArea * 0.5).toFixed(1)} ha)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPartialArea(Number((fieldArea / 3).toFixed(1)))}
                        className="h-7 px-2 text-[11px]"
                      >
                        1/3 ({(fieldArea / 3).toFixed(1)} ha)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPartialArea(Number((fieldArea * 0.25).toFixed(1)))}
                        className="h-7 px-2 text-[11px]"
                      >
                        1/4 ({(fieldArea * 0.25).toFixed(1)} ha)
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.1"
                        max={fieldArea}
                        step="0.1"
                        value={partialArea}
                        onChange={(e) => setPartialArea(parseFloat(e.target.value || "0"))}
                        className="w-24 h-8 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">ha van {fieldArea} ha</span>
                    </div>
                  </div>
                )}
              </Field>
            </FieldGroup>

            {/* Trust-building live summary */}
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                {diffDays} {diffDays === 1 ? "weidedag" : "weidedagen"} · {totalHours} weide-uren op {field?.b_name} ({effectiveArea} ha).
              </p>
              {isFuture && (
                <p className="text-amber-700 dark:text-amber-400">
                  Startdatum ligt in de toekomst → dit wordt vastgelegd als plan.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
            {existingGrazing && canWrite ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Verwijderen
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={!canWrite}>
                {existingGrazing ? "Opslaan" : "Vastleggen"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
