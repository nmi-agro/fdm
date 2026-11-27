import { Minus, MoreHorizontal, Plus, Warehouse } from "lucide-react"
import { useState } from "react"
import { NavLink, useFetcher } from "react-router"
import { HerdArrivalField } from "~/components/blocks/livestock/herd-arrival-field"
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
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { sexLabel } from "~/lib/animal-sex"
import { farmTodayKey } from "~/lib/grazing-dates"

export interface HerdCardProps {
  b_id_farm: string
  calendar: string
  herd: {
    l_id_herd: string
    l_herd_name: string | null
    l_id_category: string | null
    l_category: string | null
    l_lsu: number | null
    count: number
    /** The herds all animals of this herd can move to, and the sex animals of unknown sex get. */
    moveTargets: Array<{ l_id_herd: string; l_sex_after: string | null }>
  }
  allHerds: Array<{ l_id_herd: string; l_herd_name: string | null }>
  status: {
    type: "grazing_now" | "planned" | "idle"
    fieldName?: string | null
    dateStr?: string | null
  }
  canWrite?: boolean
}

export function HerdCard({
  b_id_farm,
  calendar,
  herd,
  allHerds,
  status,
  canWrite = true,
}: HerdCardProps) {
  const fetcher = useFetcher()

  // Optimistic count: the local value is shown while a change is being submitted; otherwise the
  // count from the loader.
  const [localCount, setLocalCount] = useState<number | null>(null)
  const isCountPending = fetcher.formData?.get("intent") === "update_count"
  const count = isCountPending && localCount !== null ? localCount : herd.count
  const [pendingReduceCount, setPendingReduceCount] = useState<number | null>(null)
  // Adding animals: how many, and since when they are in the herd (today unless chosen)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addCountText, setAddCountText] = useState("1")
  const [arrivalDay, setArrivalDay] = useState("")

  // Dialogs
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [newName, setNewName] = useState(herd.l_herd_name ?? "")
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [targetHerdId, setTargetHerdId] = useState("")
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  // Only the herds every animal of this herd can move to
  const targetHerds = herd.moveTargets.map((target) => ({
    ...target,
    l_herd_name: allHerds.find((h) => h.l_id_herd === target.l_id_herd)?.l_herd_name ?? "Koppel",
  }))
  const sexAfterMove = targetHerds.find((t) => t.l_id_herd === targetHerdId)?.l_sex_after

  const submitCountChange = (newCount: number, l_arriving_date?: string) => {
    if (newCount === herd.count) return
    const formData = new FormData()
    formData.set("intent", "update_count")
    formData.set("l_id_herd", herd.l_id_herd)
    formData.set("target_count", String(newCount))
    formData.set("previous_count", String(herd.count))
    if (l_arriving_date) formData.set("l_arriving_date", l_arriving_date)
    void fetcher.submit(formData, { method: "post" })
  }

  const handleIncrement = () => {
    // Today in the Netherlands, taken when the dialog opens
    setArrivalDay(farmTodayKey())
    setAddCountText("1")
    setIsAddOpen(true)
  }

  const addCount = Number.parseInt(addCountText, 10)
  const canAdd = Number.isInteger(addCount) && addCount > 0 && arrivalDay !== ""

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAdd) return
    const next = herd.count + addCount
    setLocalCount(next)
    submitCountChange(next, arrivalDay)
    setIsAddOpen(false)
  }

  const handleDecrement = () => {
    if (count <= 0) return
    const next = count - 1
    // Show confirmation dialog before reducing animals
    setPendingReduceCount(next)
  }

  const confirmReduction = () => {
    if (pendingReduceCount !== null) {
      const next = pendingReduceCount
      setLocalCount(next)
      setPendingReduceCount(null)
      submitCountChange(next)
    }
  }

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set("intent", "update_herd")
    formData.set("l_id_herd", herd.l_id_herd)
    formData.set("l_herd_name", newName)
    void fetcher.submit(formData, { method: "post" })
    setIsRenameOpen(false)
  }

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetHerdId) return
    const formData = new FormData()
    formData.set("intent", "reassign_herd")
    formData.set("source_l_id_herd", herd.l_id_herd)
    formData.set("target_l_id_herd", targetHerdId)
    void fetcher.submit(formData, { method: "post" })
    setIsReassignOpen(false)
  }

  const handleDeleteSubmit = () => {
    const formData = new FormData()
    formData.set("intent", "remove_herd")
    formData.set("l_id_herd", herd.l_id_herd)
    void fetcher.submit(formData, { method: "post" })
    setIsDeleteOpen(false)
  }

  const lsuFactor = herd.l_lsu ?? 1.0
  const totalGve = Number((count * lsuFactor).toFixed(1))

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            {/* One line for the category, so the rows of cards next to each other line up */}
            <div className="min-w-0">
              <h3 className="text-base leading-none font-semibold">
                {herd.l_herd_name ?? "Koppel"}
              </h3>
              <p
                className="text-muted-foreground mt-1 line-clamp-1 text-xs"
                title={herd.l_category ?? undefined}
              >
                {herd.l_category ?? "Diercategorie"}
              </p>
            </div>
            {canWrite && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Koppelopties</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
                    Naam wijzigen
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsReassignOpen(true)}
                    disabled={allHerds.length <= 1 || count === 0}
                  >
                    Dieren verplaatsen naar andere koppel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsDeleteOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    Koppel verwijderen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Count Stepper */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleDecrement}
              disabled={!canWrite || count <= 0}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md"
            >
              <Minus className="h-4 w-4" />
              <span className="sr-only">Dier minder</span>
            </Button>
            <div className="text-center">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{count}</span>
              <span className="text-muted-foreground ml-1.5 text-xs">dieren</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleIncrement}
              disabled={!canWrite || isCountPending}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Dieren toevoegen</span>
            </Button>
          </div>

          {/* GVE stats */}
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              <strong className="text-foreground font-semibold">
                {totalGve.toLocaleString("nl-NL")}
              </strong>{" "}
              GVE
            </span>
            <span>{lsuFactor.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} GVE/dier</span>
          </div>

          {/* Grazing Status Badge */}
          <div>
            {status.type === "grazing_now" && (
              <Badge variant="outline" className="text-emerald-900">
                <span>Loopt nu op {status.fieldName ?? "onbekend perceel"}</span>
              </Badge>
            )}
            {status.type === "planned" && (
              <Badge variant="outline">
                <span>Gepland vanaf {status.dateStr ?? ""}</span>
              </Badge>
            )}
            {status.type === "idle" && (
              <Badge variant="outline" className="text-muted-foreground">
                <span>Wordt vandaag niet geweid</span>
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="mt-auto border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs font-medium"
            nativeButton={false}
            render={
              <NavLink
                to={`/farm/${b_id_farm}/${calendar}/livestock/animals?herd=${herd.l_id_herd}#vee-dieren`}
              />
            }
          >
            <Warehouse className="h-3.5 w-3.5" />
            Dieren bekijken ({count})
          </Button>
        </CardFooter>
      </Card>

      {/* Reduce Count Confirm Alert */}
      <AlertDialog
        open={pendingReduceCount !== null}
        onOpenChange={(open) => !open && setPendingReduceCount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dier afvoeren uit {herd.l_herd_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Het verlagen van het aantal dieren sluit de meest recente toewijzing af en registreert
              dat het dier het bedrijf heeft verlaten. Dieren zonder oormerk worden als eerste
              afgevoerd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReduction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Afvoeren bevestigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add animals: how many and since when */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleAddSubmit}>
            <DialogHeader>
              <DialogTitle>Dieren toevoegen aan {herd.l_herd_name ?? "koppel"}</DialogTitle>
              <DialogDescription>
                De dieren komen erbij zonder oormerk; vul dat later per dier aan.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor={`add-count-${herd.l_id_herd}`}>Aantal dieren *</FieldLabel>
                <Input
                  id={`add-count-${herd.l_id_herd}`}
                  type="number"
                  min="1"
                  max="5000"
                  value={addCountText}
                  onChange={(e) => setAddCountText(e.target.value)}
                  required
                />
              </Field>
              <HerdArrivalField
                value={arrivalDay}
                onChange={setArrivalDay}
                description="Vandaag, tenzij de dieren er al eerder waren."
              />
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={!canAdd}>
                Toevoegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>Koppelnaam wijzigen</DialogTitle>
              <DialogDescription>Geef de koppel een herkenbare naam.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Field>
                <FieldLabel htmlFor="new-herd-name">Naam</FieldLabel>
                <Input
                  id="new-herd-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit">Opslaan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleReassignSubmit}>
            <DialogHeader>
              <DialogTitle>Dieren verplaatsen</DialogTitle>
              <DialogDescription>
                Verplaats alle actieve dieren van {herd.l_herd_name} naar een andere koppel op dit
                bedrijf. De toewijzingshistorie blijft bewaard.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Field>
                <FieldLabel htmlFor="target-herd-select">Doelkoppel</FieldLabel>
                <Select
                  value={targetHerdId}
                  items={targetHerds.map((h) => ({ value: h.l_id_herd, label: h.l_herd_name }))}
                  onValueChange={(v) => {
                    if (v !== null) setTargetHerdId(v)
                  }}
                  disabled={targetHerds.length === 0}
                >
                  <SelectTrigger id="target-herd-select">
                    <SelectValue placeholder="Kies een koppel" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetHerds.map((h) => (
                      <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                        {h.l_herd_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetHerds.length === 0 ? (
                  <FieldDescription key="no-targets">
                    Er is geen koppel waar al deze dieren naartoe kunnen. Dieren gaan alleen naar
                    een koppel van dezelfde diercategorie of van een volgende levensfase van
                    dezelfde diersoort.
                  </FieldDescription>
                ) : sexAfterMove ? (
                  <FieldDescription key="sex-after">
                    Dieren met een onbekend geslacht worden {sexLabel(sexAfterMove)}.
                  </FieldDescription>
                ) : null}
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsReassignOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={!targetHerdId}>
                Verplaatsen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Koppel {herd.l_herd_name} verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {count > 0
                ? "Deze koppel bevat nog actieve dieren. Voer eerst de dieren af of verplaats ze naar een andere koppel voordat je de koppel kunt verwijderen."
                : "Weet je zeker dat je deze koppel wilt verwijderen? Dit kan niet ongedaan worden gemaakt als er al beweidingsregistraties aan gekoppeld zijn."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            {count === 0 && (
              <AlertDialogAction
                onClick={handleDeleteSubmit}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Verwijderen
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
