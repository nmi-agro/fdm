import { useState } from "react"
import { useFetcher } from "react-router"
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
 * Dialog to add a herd with a number of animals of one category. It posts the intent `add_herd`
 * to the action of the current route.
 */
export function AddHerdDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Array<{ l_id_category: string; l_category: string; l_lsu: number | null }>
}) {
  const fetcher = useFetcher()
  const [categoryId, setCategoryId] = useState("rvo_100")
  const [name, setName] = useState("Melkkoeien")
  const [count, setCount] = useState(20)

  const categoryLabel = (c: (typeof categories)[number]) =>
    `${c.l_category} (${(c.l_lsu ?? 1).toLocaleString("nl-NL")} GVE/dier)`

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set("intent", "add_herd")
    formData.set("l_id_category", categoryId)
    formData.set("l_herd_name", name.trim())
    formData.set("count", String(count))
    void fetcher.submit(formData, { method: "post" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nieuwe koppel toevoegen</DialogTitle>
            <DialogDescription>Voeg een nieuwe groep dieren toe aan je bedrijf.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cat-select">Diercategorie *</FieldLabel>
                <Select
                  value={categoryId}
                  items={categories.map((c) => ({
                    value: c.l_id_category,
                    label: categoryLabel(c),
                  }))}
                  onValueChange={(v) => {
                    if (v !== null) setCategoryId(v)
                  }}
                >
                  <SelectTrigger id="cat-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.l_id_category} value={c.l_id_category}>
                        {categoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="add-herd-name">Naam van de koppel</FieldLabel>
                <Input
                  id="add-herd-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Bijv. Droogstaande koeien"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="add-herd-count">Aantal dieren</FieldLabel>
                <Input
                  id="add-herd-count"
                  type="number"
                  min="1"
                  max="5000"
                  value={count}
                  onChange={(e) => setCount(Number.parseInt(e.target.value || "1", 10))}
                  required
                />
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit">Koppel aanmaken</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
