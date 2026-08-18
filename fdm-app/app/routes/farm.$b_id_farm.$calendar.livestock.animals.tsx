import {
  addAnimal,
  checkPermission,
  getAnimalsForFarm,
  getFarm,
  getFarms,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { ChevronRight, Filter, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
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
import { SidebarInset } from "~/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Dieren overzicht | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk alle individuele dieren en koppels op dit bedrijf.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const [farm, farms, herds, animals] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      getHerdsForFarm(fdm, session.principal_id, b_id_farm),
      getAnimalsForFarm(fdm, session.principal_id, b_id_farm),
    ])

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      farmOptions,
      herds: herds.map((h) => ({
        l_id_herd: h.l_id_herd,
        l_herd_name: h.l_herd_name ?? "Koppel",
        l_id_category: h.l_id_category ?? "rvo_100",
        l_category: h.l_category,
        l_lsu: h.l_lsu ?? 1.0,
      })),
      animals: animals.map((a) => ({
        l_id_animal: a.l_id_animal,
        l_id_eartag: a.l_id_eartag,
        l_id_worknumber: a.l_id_worknumber,
        l_specie: a.l_specie,
        l_breed: a.l_breed,
        l_coatcolor: a.l_coatcolor,
        l_birth_date: a.l_birth_date ? new Date(a.l_birth_date).toISOString() : null,
        l_sex: a.l_sex,
        l_arriving_date: a.l_arriving_date ? new Date(a.l_arriving_date).toISOString() : null,
        l_leaving_date: a.l_leaving_date ? new Date(a.l_leaving_date).toISOString() : null,
        l_leaving_method: a.l_leaving_method,
        l_id_herd: a.l_id_herd,
        l_category: a.l_category,
      })),
      farmWritePermission,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )
    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const formData = await request.formData()
    const intent = String(formData.get("intent") ?? "")

    if (intent === "add_animal") {
      const l_id_herd = String(formData.get("l_id_herd") ?? "")
      const l_id_eartag = String(formData.get("l_id_eartag") ?? "") || undefined
      const l_id_worknumber = String(formData.get("l_id_worknumber") ?? "") || undefined
      const l_breed = String(formData.get("l_breed") ?? "") || undefined
      const l_coatcolor = String(formData.get("l_coatcolor") ?? "") || undefined
      const birthDateVal = String(formData.get("l_birth_date") ?? "")
      const l_sex = (formData.get("l_sex") as "female" | "male" | null) ?? "female"

      const newId = await addAnimal(fdm, session.principal_id, b_id_farm, l_id_herd, {
        l_id_eartag,
        l_id_worknumber,
        l_breed,
        l_coatcolor,
        l_birth_date: birthDateVal ? new Date(birthDateVal) : undefined,
        l_sex,
        l_arriving_method: "born",
      })

      return dataWithSuccess({ newId }, { message: "Dier succesvol toegevoegd." })
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function AnimalsOverviewPage() {
  const { b_id_farm, calendar, farmOptions, herds, animals, farmWritePermission } =
    useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const fetcher = useFetcher()

  const initialHerdFilter = searchParams.get("herd") ?? "all"
  const [selectedHerdFilter, setSelectedHerdFilter] = useState(initialHerdFilter)
  const [search, setSearch] = useState("")

  // Add animal modal state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newHerdId, setNewHerdId] = useState(herds[0]?.l_id_herd ?? "")
  const [newEartag, setNewEartag] = useState("")
  const [newWorknumber, setNewWorknumber] = useState("")
  const [newBreed, setNewBreed] = useState("")
  const [newCoatcolor, setNewCoatcolor] = useState("")
  const [newBirthdate, setNewBirthdate] = useState("")
  const [newSex, setNewSex] = useState<"female" | "male">("female")

  const herdNameMap = useMemo(() => new Map(herds.map((h) => [h.l_id_herd, h.l_herd_name])), [herds])

  const filteredAnimals = useMemo(() => {
    return animals.filter((a) => {
      if (selectedHerdFilter !== "all" && a.l_id_herd !== selectedHerdFilter) {
        return false
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchesWorknumber = a.l_id_worknumber?.toLowerCase().includes(q)
        const matchesEartag = a.l_id_eartag?.toLowerCase().includes(q)
        const matchesBreed = a.l_breed?.toLowerCase().includes(q)
        if (!matchesWorknumber && !matchesEartag && !matchesBreed) {
          return false
        }
      }
      return true
    })
  }, [animals, selectedHerdFilter, search])

  const handleHerdFilterChange = (val: string) => {
    setSelectedHerdFilter(val)
    if (val === "all") {
      searchParams.delete("herd")
    } else {
      searchParams.set("herd", val)
    }
    setSearchParams(searchParams, { replace: true })
  }

  const handleRowClick = (l_id_animal: string) => {
    void navigate(`/farm/${b_id_farm}/${calendar}/livestock/animal/${l_id_animal}`)
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHerdId) return

    const formData = new FormData()
    formData.set("intent", "add_animal")
    formData.set("l_id_herd", newHerdId)
    formData.set("l_id_eartag", newEartag.trim())
    formData.set("l_id_worknumber", newWorknumber.trim())
    formData.set("l_breed", newBreed.trim())
    formData.set("l_coatcolor", newCoatcolor.trim())
    if (newBirthdate) formData.set("l_birth_date", newBirthdate)
    formData.set("l_sex", newSex)

    void fetcher.submit(formData, { method: "post" })
    setIsAddOpen(false)
    setNewEartag("")
    setNewWorknumber("")
    setNewBreed("")
    setNewCoatcolor("")
    setNewBirthdate("")
  }

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/livestock`,
          label: "Terug naar Veestapel",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbLink asChild>
          <NavLink to={`/farm/${b_id_farm}/${calendar}/livestock`}>Veestapel</NavLink>
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Dieren</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title="Dieren & Koppels"
          description={`Overzicht van alle ${animals.length} geregistreerde dieren op dit bedrijf.`}
          rightNode={
            farmWritePermission && (
              <Button onClick={() => setIsAddOpen(true)} className="gap-1.5 text-xs font-medium">
                <Plus className="h-4 w-4" />
                Dier toevoegen
              </Button>
            )
          }
        />

        <FarmContent>
          <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-3 max-w-md">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                  <Input
                    placeholder="Zoek op werknummer of levensnummer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedHerdFilter} onValueChange={handleHerdFilterChange}>
                  <SelectTrigger className="w-52 text-xs">
                    <SelectValue placeholder="Filter op koppel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle koppels ({animals.length})</SelectItem>
                    {herds.map((h) => {
                      const count = animals.filter((a) => a.l_id_herd === h.l_id_herd).length
                      return (
                        <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                          {h.l_herd_name} ({count})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Animals Table */}
            <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Werknr</TableHead>
                    <TableHead className="w-44">Levensnummer</TableHead>
                    <TableHead>Koppel</TableHead>
                    <TableHead>Geboortedatum</TableHead>
                    <TableHead>Geslacht</TableHead>
                    <TableHead>Ras</TableHead>
                    <TableHead>Sinds</TableHead>
                    <TableHead className="w-12 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnimals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        {search || selectedHerdFilter !== "all"
                          ? "Geen dieren gevonden voor deze selectie."
                          : "Nog geen dieren geregistreerd op dit bedrijf."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAnimals.map((animal) => {
                      const herdName = animal.l_id_herd ? herdNameMap.get(animal.l_id_herd) ?? "Koppel" : "—"
                      return (
                        <TableRow
                          key={animal.l_id_animal}
                          onClick={() => handleRowClick(animal.l_id_animal)}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-mono font-semibold text-xs">
                            {animal.l_id_worknumber ?? "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {animal.l_id_eartag ? (
                              <span>{animal.l_id_eartag}</span>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                Geen oormerk
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                              {herdName}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {animal.l_birth_date ? format(new Date(animal.l_birth_date), "dd-MM-yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {animal.l_sex === "female" ? "Vrouwelijk" : animal.l_sex === "male" ? "Mannelijk" : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{animal.l_breed ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {animal.l_arriving_date ? format(new Date(animal.l_arriving_date), "dd-MM-yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <ChevronRight className="h-4 w-4 text-muted-foreground inline-block" />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </FarmContent>
      </main>

      {/* Add Animal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAddSubmit}>
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
                  <Select value={newHerdId} onValueChange={setNewHerdId}>
                    <SelectTrigger id="add-herd-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {herds.map((h) => (
                        <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                          {h.l_herd_name} ({h.l_category})
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
                      value={newWorknumber}
                      onChange={(e) => setNewWorknumber(e.target.value)}
                      placeholder="Auto indien leeg"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-eartag">Levensnummer</FieldLabel>
                    <Input
                      id="add-eartag"
                      value={newEartag}
                      onChange={(e) => setNewEartag(e.target.value)}
                      placeholder="NL 999 9999 9999"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    label="Geboortedatum"
                    field={{
                      name: "add_birthdate",
                      value: newBirthdate,
                      onChange: (val) => setNewBirthdate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                      onBlur: () => {},
                      ref: () => {},
                    }}
                    fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                  />
                  <Field>
                    <FieldLabel htmlFor="add-sex">Geslacht</FieldLabel>
                    <Select value={newSex} onValueChange={(v: "female" | "male") => setNewSex(v)}>
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

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="add-breed">Ras</FieldLabel>
                    <Input
                      id="add-breed"
                      value={newBreed}
                      onChange={(e) => setNewBreed(e.target.value)}
                      placeholder="Bijv. HF"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-coatcolor">Haarkleur</FieldLabel>
                    <Input
                      id="add-coatcolor"
                      value={newCoatcolor}
                      onChange={(e) => setNewCoatcolor(e.target.value)}
                      placeholder="Bijv. Zwartbont"
                    />
                  </Field>
                </div>
              </FieldGroup>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit">Dier toevoegen</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  )
}
