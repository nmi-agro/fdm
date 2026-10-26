import { useState } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import type { BulkFieldOption } from "./types"

function FieldCheckboxList({
  fields,
  selected,
  onToggle,
}: {
  fields: BulkFieldOption[]
  selected: Set<string>
  onToggle: (b_id: string) => void
}) {
  return (
    <div className="max-h-[30vh] space-y-1 overflow-y-auto rounded-md border p-2">
      {fields.map((field) => (
        <div key={field.b_id} className="hover:bg-accent flex items-center gap-2 rounded-md p-2">
          <Checkbox
            id={`select-${field.b_id}`}
            checked={selected.has(field.b_id)}
            onCheckedChange={() => onToggle(field.b_id)}
          />
          <Label htmlFor={`select-${field.b_id}`} className="flex-1 cursor-pointer">
            {field.b_name}
          </Label>
          <Badge variant="secondary">{field.b_area.toLocaleString("nl-NL")} ha</Badge>
        </div>
      ))}
    </div>
  )
}

/**
 * Dialog to change which fields are selected on the bulk fertilizer application page.
 *
 * In the rotation flow (`cultivationIds` set), fields with the selected crop are listed first and
 * the other fields are tucked away in a collapsible list.
 */
export function FieldSelectionDialog({
  fieldOptions,
  selectedFieldIds,
  cultivationIds,
  cultivationName,
  onApply,
}: {
  fieldOptions: BulkFieldOption[]
  selectedFieldIds: string[]
  cultivationIds: string[]
  cultivationName?: string
  onApply: (fieldIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(() => new Set(selectedFieldIds))
  const [query, setQuery] = useState("")

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setSelected(new Set(selectedFieldIds))
      setQuery("")
    }
    setOpen(next)
  }

  const toggle = (b_id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(b_id)) next.delete(b_id)
      else next.add(b_id)
      return next
    })

  // Search on field name and main cultivation
  const needle = query.trim().toLocaleLowerCase("nl-NL")
  const visible = needle
    ? fieldOptions.filter((field) =>
        `${field.b_name} ${field.mainCultivationName ?? ""}`
          .toLocaleLowerCase("nl-NL")
          .includes(needle),
      )
    : fieldOptions

  const isRotation = cultivationIds.length > 0
  const withCrop = isRotation
    ? visible.filter((field) => field.cultivations.some((c) => cultivationIds.includes(c)))
    : visible
  const withoutCrop = isRotation
    ? visible.filter((field) => !field.cultivations.some((c) => cultivationIds.includes(c)))
    : []

  const setMany = (fields: BulkFieldOption[], include: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const field of fields) {
        if (include) next.add(field.b_id)
        else next.delete(field.b_id)
      }
      return next
    })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Wijzig selectie
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Percelen selecteren</DialogTitle>
          <DialogDescription>Selecteer de percelen voor de bemesting.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek op perceel of gewas"
              aria-label="Zoek op perceel of gewas"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMany(isRotation ? withCrop : visible, true)}
              >
                {isRotation
                  ? `Alle percelen met ${cultivationName || "dit gewas"}`
                  : "Alles selecteren"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMany(visible, false)}
              >
                Niets selecteren
              </Button>
            </div>
          </div>
          {withCrop.length === 0 && withoutCrop.length === 0 ? (
            <p className="text-muted-foreground text-sm">Geen percelen gevonden.</p>
          ) : (
            <FieldCheckboxList fields={withCrop} selected={selected} onToggle={toggle} />
          )}
          {withoutCrop.length > 0 && (
            <Accordion type="single" collapsible>
              <AccordionItem value="without-crop">
                <AccordionTrigger className="text-sm">
                  Percelen zonder {cultivationName || "dit gewas"}
                </AccordionTrigger>
                <AccordionContent>
                  <FieldCheckboxList fields={withoutCrop} selected={selected} onToggle={toggle} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              onApply(fieldOptions.filter((f) => selected.has(f.b_id)).map((f) => f.b_id))
              setOpen(false)
            }}
          >
            Selectie bijwerken ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
