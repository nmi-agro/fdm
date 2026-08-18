import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card"
import { Field, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Minus, MoreHorizontal, Plus, Warehouse } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { NavLink, useFetcher } from "react-router"

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

  const [count, setCount] = useState(herd.count)
  const [pendingReduceCount, setPendingReduceCount] = useState<number | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Dialogs
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [newName, setNewName] = useState(herd.l_herd_name ?? "")
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [targetHerdId, setTargetHerdId] = useState("")
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Keep count synced with incoming props if not currently editing
  useEffect(() => {
    if (fetcher.state === "idle") {
      setCount(herd.count)
    }
  }, [herd.count, fetcher.state])

  const submitCountChange = (newCount: number) => {
    if (newCount === herd.count) return
    const formData = new FormData()
    formData.set("intent", "update_count")
    formData.set("l_id_herd", herd.l_id_herd)
    formData.set("target_count", String(newCount))
    formData.set("previous_count", String(herd.count))
    void fetcher.submit(formData, { method: "post" })
  }

  const handleIncrement = () => {
    const next = count + 1
    setCount(next)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      submitCountChange(next)
    }, 600)
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
      setCount(next)
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
      <Card className="flex flex-col justify-between transition-all hover:shadow-md">
        <CardHeader className="space-y-1.5 pb-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold leading-none">{herd.l_herd_name ?? "Koppel"}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{herd.l_category ?? "Diercategorie"}</p>
            </div>
            {canWrite && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Koppelopties</span>
                  </Button>
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

        <CardContent className="space-y-4 pt-2">
          {/* Count Stepper */}
          <div className="bg-muted/40 flex items-center justify-between rounded-lg p-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleDecrement}
              disabled={!canWrite || count <= 0}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-full"
            >
              <Minus className="h-4 w-4" />
              <span className="sr-only">Dier minder</span>
            </Button>
            <div className="text-center">
              <span className="text-2xl font-bold tracking-tight">{count}</span>
              <span className="text-muted-foreground ml-1.5 text-xs">dieren</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleIncrement}
              disabled={!canWrite}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-full"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Dier meer</span>
            </Button>
          </div>

          {/* GVE stats */}
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              <strong className="text-foreground font-semibold">{totalGve.toLocaleString("nl-NL")}</strong> GVE
            </span>
            <span>{lsuFactor.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} GVE/dier</span>
          </div>

          {/* Grazing Status Badge */}
          <div className="pt-1">
            {status.type === "grazing_now" && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Loopt nu op {status.fieldName ?? "onbekend perceel"}
              </Badge>
            )}
            {status.type === "planned" && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" />
                Gepland {status.dateStr ?? ""}
              </Badge>
            )}
            {status.type === "idle" && (
              <Badge variant="outline" className="text-muted-foreground">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                Niet in beweiding
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="border-t pt-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs font-medium"
          >
            <NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/animals?herd=${herd.l_id_herd}`}>
              <Warehouse className="h-3.5 w-3.5" />
              Dieren bekijken ({count})
            </NavLink>
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
              Het verlagen van het aantal dieren sluit de meest recente toewijzing af en registreert dat het dier het bedrijf heeft verlaten. Dieren zonder oormerk worden als eerste afgevoerd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReduction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Afvoeren bevestigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>Koppelnaam wijzigen</DialogTitle>
              <DialogDescription>
                Geef de koppel een herkenbare naam.
              </DialogDescription>
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
        <DialogContent className="max-w-sm">
          <form onSubmit={handleReassignSubmit}>
            <DialogHeader>
              <DialogTitle>Dieren verplaatsen</DialogTitle>
              <DialogDescription>
                Verplaats alle actieve dieren van {herd.l_herd_name} naar een andere koppel op dit bedrijf. De toewijzingshistorie blijft bewaard.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Field>
                <FieldLabel htmlFor="target-herd-select">Doelkoppel</FieldLabel>
                <Select value={targetHerdId} onValueChange={setTargetHerdId}>
                  <SelectTrigger id="target-herd-select">
                    <SelectValue placeholder="Kies een koppel" />
                  </SelectTrigger>
                  <SelectContent>
                    {allHerds
                      .filter((h) => h.l_id_herd !== herd.l_id_herd)
                      .map((h) => (
                        <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                          {h.l_herd_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
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
              <AlertDialogAction onClick={handleDeleteSubmit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Verwijderen
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
