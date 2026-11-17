import { format } from "date-fns"
import { useState } from "react"
import { useFetcher } from "react-router"
import { DatePicker } from "~/components/custom/date-picker-v2"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"

/**
 * Dialog to add one animal to a herd. It posts `intent=add_animal` to the action of the current
 * route, which handles it with `handleLivestockEvent` (`~/lib/livestock-events.server`). Used on the
 * Melkvee overview and the Dieren page.
 */
export function AddAnimalDialog({
  open,
  onOpenChange,
  herds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  herds: Array<{ l_id_herd: string; l_herd_name: string | null; l_category?: string | null }>
}) {
  const fetcher = useFetcher()
  const [herdId, setHerdId] = useState(herds[0]?.l_id_herd ?? "")
  const [eartag, setEartag] = useState("")
  const [worknumber, setWorknumber] = useState("")
  const [birthdate, setBirthdate] = useState("")
  const [sex, setSex] = useState<"female" | "male">("female")

  const herdLabel = (h: (typeof herds)[number]) =>
    h.l_category ? `${h.l_herd_name ?? "Koppel"} (${h.l_category})` : (h.l_herd_name ?? "Koppel")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!herdId) return

    const formData = new FormData()
    formData.set("intent", "add_animal")
    formData.set("l_id_herd", herdId)
    formData.set("l_id_eartag", eartag.trim())
    formData.set("l_id_worknumber", worknumber.trim())
    if (birthdate) formData.set("l_birth_date", birthdate)
    formData.set("l_sex", sex)

    void fetcher.submit(formData, { method: "post" })
    onOpenChange(false)
    setEartag("")
    setWorknumber("")
    setBirthdate("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Dier toevoegen</DialogTitle>
            <DialogDescription>
              Voeg een nieuw dier toe en wijs het direct toe aan een koppel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="add-herd-select">Koppel *</FieldLabel>
                <Select
                  value={herdId}
                  items={herds.map((h) => ({ value: h.l_id_herd, label: herdLabel(h) }))}
                  onValueChange={(v) => {
                    if (v !== null) setHerdId(v)
                  }}
                >
                  <SelectTrigger id="add-herd-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {herds.map((h) => (
                      <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                        {herdLabel(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="add-worknumber">Werknummer</FieldLabel>
                  <Input
                    id="add-worknumber"
                    value={worknumber}
                    onChange={(e) => setWorknumber(e.target.value)}
                    placeholder="Auto indien leeg"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="add-eartag">Levensnummer</FieldLabel>
                  <Input
                    id="add-eartag"
                    value={eartag}
                    onChange={(e) => setEartag(e.target.value)}
                    placeholder="NL 999 9999 9999"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  label="Geboortedatum"
                  field={{
                    name: "add_birthdate",
                    value: birthdate,
                    onChange: (val) => setBirthdate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                    onBlur: () => {},
                    ref: () => {},
                  }}
                  fieldState={{
                    invalid: false,
                    isTouched: false,
                    isDirty: false,
                    isValidating: false,
                  }}
                />
                <Field>
                  <FieldLabel htmlFor="add-sex">Geslacht</FieldLabel>
                  <Select
                    value={sex}
                    items={[
                      { value: "female", label: "Vrouwelijk" },
                      { value: "male", label: "Mannelijk" },
                    ]}
                    onValueChange={(v) => {
                      if (v !== null) setSex(v)
                    }}
                  >
                    <SelectTrigger id="add-sex">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Vrouwelijk</SelectItem>
                      <SelectItem value="male">Mannelijk</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit">Dier toevoegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
