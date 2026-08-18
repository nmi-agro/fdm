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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { format } from "date-fns"
import { LogIn, LogOut, MapPin } from "lucide-react"
import { useEffect, useState } from "react"
import { useFetcher } from "react-router"

export interface QuickEntrySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  b_id_farm?: string
  calendar?: string
  herds: Array<{
    l_id_herd: string
    l_herd_name: string
    l_id_category: string
    l_lsu: number
    count?: number
  }>
  fields: Array<{
    b_id: string
    b_name: string
    b_area: number
  }>
  openGrazings: Array<{
    l_id_grazing: string
    l_id_herd: string
    b_id?: string | null
    b_name?: string | null
    l_grazing_start: string
    l_grazing_hours?: number | null
  }>
  initialFieldId?: string
  canWrite?: boolean
}

export function QuickEntrySheet({
  open,
  onOpenChange,
  herds,
  fields,
  openGrazings,
  initialFieldId,
  canWrite = true,
}: QuickEntrySheetProps) {
  const fetcher = useFetcher()

  const [selectedHerdId, setSelectedHerdId] = useState(herds[0]?.l_id_herd ?? "")
  const [selectedFieldId, setSelectedFieldId] = useState(initialFieldId ?? fields[0]?.b_id ?? "")
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [hours, setHours] = useState<number>(8)
  const [hourPreset, setHourPreset] = useState<"8" | "24" | "12" | "custom">("8")

  useEffect(() => {
    if (initialFieldId) {
      setSelectedFieldId(initialFieldId)
    }
  }, [initialFieldId])

  // Check if current herd has an open grazing record
  const activeOpenGrazing = openGrazings.find((g) => g.l_id_herd === selectedHerdId)
  const isOpenMode = Boolean(activeOpenGrazing)

  const handleHourPreset = (preset: "8" | "24" | "12" | "custom") => {
    setHourPreset(preset)
    if (preset === "8") setHours(8)
    if (preset === "24") setHours(24)
    if (preset === "12") setHours(12)
  }

  const handleOutSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set("intent", "add_grazing")
    formData.set("b_id", selectedFieldId)
    formData.set("l_id_herd", selectedHerdId)
    formData.set("l_grazing_start", startDate)
    formData.set("l_grazing_hours", String(hours))
    formData.set("l_grazing_type", "full")

    void fetcher.submit(formData, { method: "post" })
    onOpenChange(false)
  }

  const handleInSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOpenGrazing) return

    const formData = new FormData()
    formData.set("intent", "update_grazing")
    formData.set("l_id_grazing", activeOpenGrazing.l_id_grazing)
    formData.set("l_grazing_end", endDate)
    formData.set("l_grazing_hours", String(hours))

    void fetcher.submit(formData, { method: "post" })
    onOpenChange(false)
  }

  const selectedHerd = herds.find((h) => h.l_id_herd === selectedHerdId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2">
            {isOpenMode ? (
              <div className="rounded-md bg-amber-500/15 p-1.5 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                <LogIn className="h-5 w-5" />
              </div>
            ) : (
              <div className="rounded-md bg-emerald-500/15 p-1.5 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <LogOut className="h-5 w-5" />
              </div>
            )}
            <div>
              <DialogTitle>{isOpenMode ? "Koeien naar binnen" : "Koeien naar buiten"}</DialogTitle>
              <DialogDescription className="text-xs">
                {isOpenMode
                  ? "Sluit de lopende beweidingsperiode af."
                  : "Leg snel vast waar de dieren vandaag grazen."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <FieldGroup>
            {/* Herd Selector */}
            <Field>
              <FieldLabel htmlFor="quick-herd">Koppel</FieldLabel>
              <Select value={selectedHerdId} onValueChange={setSelectedHerdId}>
                <SelectTrigger id="quick-herd">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {herds.map((h) => (
                    <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                      {h.l_herd_name} {h.count ? `(${h.count} dieren)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {isOpenMode && activeOpenGrazing ? (
              /* Koeien naar binnen form */
              <form id="quick-in-form" onSubmit={handleInSubmit} className="space-y-4">
                <div className="rounded-lg border bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">
                    {selectedHerd?.l_herd_name} loopt sinds{" "}
                    {format(new Date(activeOpenGrazing.l_grazing_start), "dd-MM-yyyy")} op{" "}
                    {activeOpenGrazing.b_name ?? "perceel"}.
                  </p>
                </div>

                <DatePicker
                  label="Einddatum"
                  field={{
                    name: "l_grazing_end",
                    value: endDate,
                    onChange: (val) => setEndDate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                    onBlur: () => {},
                    ref: () => {},
                  }}
                  fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                  required
                />

                <Field>
                  <FieldLabel>Uren per dag</FieldLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {(["8", "24", "12", "custom"] as const).map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant={hourPreset === preset ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleHourPreset(preset)}
                        className="text-xs"
                      >
                        {preset === "custom" ? "Ander" : `${preset}u`}
                      </Button>
                    ))}
                  </div>
                  {hourPreset === "custom" && (
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(parseFloat(e.target.value || "0"))}
                      className="mt-2 w-24"
                    />
                  )}
                </Field>
              </form>
            ) : (
              /* Koeien naar buiten form */
              <form id="quick-out-form" onSubmit={handleOutSubmit} className="space-y-4">
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="quick-field">Perceel *</FieldLabel>
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <MapPin className="h-3 w-3" />
                      Dichtstbijzijnd
                    </span>
                  </div>
                  <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                    <SelectTrigger id="quick-field">
                      <SelectValue placeholder="Kies een perceel" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.b_id} value={f.b_id}>
                          {f.b_name} ({f.b_area} ha)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <DatePicker
                  label="Vanaf"
                  field={{
                    name: "l_grazing_start",
                    value: startDate,
                    onChange: (val) => setStartDate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                    onBlur: () => {},
                    ref: () => {},
                  }}
                  fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                  required
                />

                <Field>
                  <FieldLabel>Uren per dag</FieldLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {(["8", "24", "12", "custom"] as const).map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant={hourPreset === preset ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleHourPreset(preset)}
                        className="text-xs"
                      >
                        {preset === "custom" ? "Ander" : `${preset}u`}
                      </Button>
                    ))}
                  </div>
                  {hourPreset === "custom" && (
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(parseFloat(e.target.value || "0"))}
                      className="mt-2 w-24"
                    />
                  )}
                </Field>
              </form>
            )}
          </FieldGroup>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            type="submit"
            form={isOpenMode ? "quick-in-form" : "quick-out-form"}
            disabled={!canWrite}
            className="w-full"
          >
            {isOpenMode ? "Koeien naar binnen vastleggen" : "Koeien naar buiten vastleggen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

