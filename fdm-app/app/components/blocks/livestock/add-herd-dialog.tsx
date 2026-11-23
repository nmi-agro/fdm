import { useState } from "react"
import { useFetcher } from "react-router"
import { HerdArrivalField } from "~/components/blocks/livestock/herd-arrival-field"
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
import { useKeyedState } from "~/hooks/use-keyed-state"

/**
 * Dialog to add a herd with a number of animals of one category. It posts the intent `add_herd`
 * to the action of the current route.
 */
export function AddHerdDialog({
  open,
  onOpenChange,
  categories,
  defaultArrivalDay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Array<{ l_id_category: string; l_category: string; l_lsu: number | null }>
  /** The day the animals arrive unless the user picks another, as `YYYY-MM-DD`. */
  defaultArrivalDay: string
}) {
  const fetcher = useFetcher()
  // Dairy cows when the farm has that category, else its first category; none when it has none
  const [categoryId, setCategoryId] = useState(
    (categories.find((c) => c.l_id_category === "rvo_100") ?? categories[0])?.l_id_category ?? "",
  )
  const hasCategories = categories.length > 0
  const [name, setName] = useState("Melkkoeien")
  const [count, setCount] = useState(20)
  // Follows the chosen year until the user picks a day
  const [arrivalDay, setArrivalDay] = useKeyedState(defaultArrivalDay, (day) => day)

  const categoryLabel = (c: (typeof categories)[number]) =>
    `${c.l_category} (${(c.l_lsu ?? 1).toLocaleString("nl-NL")} GVE/dier)`

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set("intent", "add_herd")
    formData.set("l_id_category", categoryId)
    formData.set("l_herd_name", name.trim())
    formData.set("count", String(count))
    formData.set("l_arriving_date", arrivalDay)
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
                {!hasCategories ? (
                  <p className="text-muted-foreground text-sm">
                    Voor dit bedrijf zijn geen diercategorieën beschikbaar, dus er kan nog geen
                    koppel worden toegevoegd. Neem contact op met de ondersteuning.
                  </p>
                ) : (
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
                )}
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

              <HerdArrivalField value={arrivalDay} onChange={setArrivalDay} />
            </FieldGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={!hasCategories || !categoryId}>
              Koppel aanmaken
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
