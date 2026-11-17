import {
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
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { AddAnimalDialog } from "~/components/blocks/livestock/add-animal-dialog"
import { Badge } from "~/components/ui/badge"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
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
import { handleLivestockEvent } from "~/lib/livestock-events.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Vee | ${clientConfig.name}` },
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
    if (formData.get("intent") === "add_animal") {
      return await handleLivestockEvent(formData, {
        principal_id: session.principal_id,
        b_id_farm,
      })
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

  const initialHerdFilter = searchParams.get("herd") ?? "all"
  const [selectedHerdFilter, setSelectedHerdFilter] = useState(initialHerdFilter)
  const [search, setSearch] = useState("")

  const [isAddOpen, setIsAddOpen] = useState(false)

  const herdNameMap = useMemo(
    () => new Map(herds.map((h) => [h.l_id_herd, h.l_herd_name])),
    [herds],
  )

  const filteredAnimals = useMemo(() => {
    return animals.filter((a) => {
      if (selectedHerdFilter !== "all" && a.l_id_herd !== selectedHerdFilter) {
        return false
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchesWorknumber = a.l_id_worknumber?.toLowerCase().includes(q)
        const matchesEartag = a.l_id_eartag?.toLowerCase().includes(q)
        if (!matchesWorknumber && !matchesEartag) {
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

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/livestock`,
          label: "Terug naar Melkvee",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbLink render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock`} />}>
          Melkvee
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Vee</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title="Vee"
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
              <div className="flex max-w-md flex-1 items-center gap-3">
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
                <Filter className="text-muted-foreground h-4 w-4" />
                <Select
                  value={selectedHerdFilter}
                  items={[
                    { value: "all", label: `Alle koppels (${animals.length})` },
                    ...herds.map((h) => ({
                      value: h.l_id_herd,
                      label: `${h.l_herd_name} (${animals.filter((a) => a.l_id_herd === h.l_id_herd).length})`,
                    })),
                  ]}
                  onValueChange={(v) => {
                    if (v !== null) handleHerdFilterChange(v)
                  }}
                >
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
            <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Werknr</TableHead>
                    <TableHead className="w-44">Levensnummer</TableHead>
                    <TableHead>Koppel</TableHead>
                    <TableHead>Geboortedatum</TableHead>
                    <TableHead>Geslacht</TableHead>
                    <TableHead>Sinds</TableHead>
                    <TableHead className="w-12 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnimals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-12 text-center">
                        {search || selectedHerdFilter !== "all"
                          ? "Geen dieren gevonden voor deze selectie."
                          : "Nog geen dieren geregistreerd op dit bedrijf."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAnimals.map((animal) => {
                      const herdName = animal.l_id_herd
                        ? (herdNameMap.get(animal.l_id_herd) ?? "Koppel")
                        : "—"
                      return (
                        <TableRow
                          key={animal.l_id_animal}
                          onClick={() => handleRowClick(animal.l_id_animal)}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <TableCell className="font-mono text-xs font-semibold">
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
                          <TableCell className="text-muted-foreground text-xs">
                            {animal.l_birth_date
                              ? format(new Date(animal.l_birth_date), "dd-MM-yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {animal.l_sex === "female"
                              ? "Vrouwelijk"
                              : animal.l_sex === "male"
                                ? "Mannelijk"
                                : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {animal.l_arriving_date
                              ? format(new Date(animal.l_arriving_date), "dd-MM-yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <ChevronRight className="text-muted-foreground inline-block h-4 w-4" />
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

      <AddAnimalDialog open={isAddOpen} onOpenChange={setIsAddOpen} herds={herds} />
    </SidebarInset>
  )
}
