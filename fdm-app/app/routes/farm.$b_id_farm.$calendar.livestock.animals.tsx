import {
  checkPermission,
  getAnimalCategoriesForFarm,
  getAnimalsForFarm,
  getFarm,
  getFarms,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
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
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { AddAnimalDialog } from "~/components/blocks/livestock/add-animal-dialog"
import { AddHerdDialog } from "~/components/blocks/livestock/add-herd-dialog"
import { HerdCard } from "~/components/blocks/livestock/herd-card"
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
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getHerdCards } from "~/lib/herd-cards.server"
import { handleLivestockEvent, isLivestockIntent } from "~/lib/livestock-events.server"

export const handle: HelpHandle = { help: "veestapel-dieren" }

export const meta: MetaFunction = () => {
  return [
    { title: `Vee | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk alle individuele dieren en koppels op dit bedrijf.",
    },
  ]
}

/** A date in the list, e.g. "3 mei 2024". */
const formatAnimalDate = (iso: string) => format(new Date(iso), "d MMM yyyy", { locale: nl })

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const [farm, farms, herds, animals, categories] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      // The herds with their number of animals and today's grazing, for the herd cards
      getHerdCards(session.principal_id, b_id_farm, timeframe),
      getAnimalsForFarm(fdm, session.principal_id, b_id_farm),
      getAnimalCategoriesForFarm(fdm, session.principal_id, b_id_farm),
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
      herds,
      categories,
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

    // Animals and the herd actions of the herd cards
    const formData = await request.formData()
    if (isLivestockIntent(formData.get("intent"))) {
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
  const { b_id_farm, calendar, farmOptions, herds, categories, animals, farmWritePermission } =
    useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // The herd filter lives in the URL, so "Dieren bekijken" on a herd card filters the table
  const selectedHerdFilter = searchParams.get("herd") ?? "all"
  const [search, setSearch] = useState("")

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isAddHerdOpen, setIsAddHerdOpen] = useState(false)

  const herdNameMap = useMemo(
    () => new Map(herds.map((h) => [h.l_id_herd, h.l_herd_name])),
    [herds],
  )

  // Columns that no animal has a value for stay hidden
  const hasBirthDates = animals.some((a) => a.l_birth_date)
  const hasSexes = animals.some((a) => a.l_sex)
  const columnCount = 5 + (hasBirthDates ? 1 : 0) + (hasSexes ? 1 : 0)

  const filteredAnimals = useMemo(() => {
    const matches = animals.filter((a) => {
      if (selectedHerdFilter !== "all" && a.l_id_herd !== selectedHerdFilter) {
        return false
      }
      // The search looks at every column as it is shown: numbers, herd, dates and sex
      const q = search.toLowerCase().trim()
      if (q) {
        const shown = [
          a.l_id_worknumber,
          a.l_id_eartag,
          a.l_id_herd ? herdNameMap.get(a.l_id_herd) : null,
          a.l_birth_date ? formatAnimalDate(a.l_birth_date) : null,
          a.l_sex === "female" ? "Vrouwelijk" : a.l_sex === "male" ? "Mannelijk" : null,
          a.l_arriving_date ? formatAnimalDate(a.l_arriving_date) : null,
        ]
        if (!shown.some((value) => value?.toLowerCase().includes(q))) return false
      }
      return true
    })
    // By work number as the farmer counts (2 before 10); animals without one last
    return matches.sort((a, b) => {
      if (!a.l_id_worknumber) return b.l_id_worknumber ? 1 : 0
      if (!b.l_id_worknumber) return -1
      return a.l_id_worknumber.localeCompare(b.l_id_worknumber, "nl", { numeric: true })
    })
  }, [animals, selectedHerdFilter, search, herdNameMap])

  const handleHerdFilterChange = (val: string) => {
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
          description="Je koppels en de dieren erin. Pas het aantal dieren aan, verplaats dieren tussen koppels of bekijk een dier."
          rightNode={
            farmWritePermission && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddHerdOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Koppel toevoegen</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  disabled={herds.length === 0}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Dier toevoegen</span>
                </Button>
              </div>
            )
          }
        />

        <FarmContent>
          <div className="space-y-8">
            {/* Herds first: how many animals each has, and the actions to manage them */}
            <section className="space-y-3" aria-labelledby="vee-koppels">
              <div className="space-y-0.5">
                <h2 id="vee-koppels" className="text-lg font-semibold">
                  Koppels
                </h2>
                <p className="text-muted-foreground text-xs">
                  Met − en + voer je een dier af of voeg je er een toe. Via het menu van een koppel
                  wijzig je de naam, verplaats je alle dieren naar een andere koppel of verwijder je
                  de koppel.
                </p>
              </div>
              {herds.length === 0 ? (
                <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
                  Nog geen koppels. Voeg een koppel toe om dieren te registreren.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {herds.map((herd) => (
                    <HerdCard
                      key={herd.l_id_herd}
                      b_id_farm={b_id_farm}
                      calendar={calendar}
                      herd={herd}
                      allHerds={herds}
                      status={herd.status}
                      canWrite={farmWritePermission}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4" aria-labelledby="vee-dieren">
              <h2 id="vee-dieren" className="text-lg font-semibold">
                Dieren ({animals.length})
              </h2>
              {/* Filters Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex max-w-md flex-1 items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="Zoek op werknummer, levensnummer, koppel of datum"
                      aria-label="Zoek in de dieren"
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
                      {hasBirthDates && <TableHead>Geboortedatum</TableHead>}
                      {hasSexes && <TableHead>Geslacht</TableHead>}
                      <TableHead>Sinds</TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Openen</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnimals.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={columnCount}
                          className="text-muted-foreground py-12 text-center"
                        >
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
                            <TableCell className="text-xs font-semibold tabular-nums">
                              {/* The link makes the row reachable by keyboard */}
                              <NavLink
                                to={`/farm/${b_id_farm}/${calendar}/livestock/animal/${animal.l_id_animal}`}
                                onClick={(e) => e.stopPropagation()}
                                className="underline-offset-2 hover:underline focus-visible:underline"
                              >
                                {animal.l_id_worknumber ?? "Zonder werknr"}
                              </NavLink>
                            </TableCell>
                            <TableCell className="text-xs tabular-nums">
                              {animal.l_id_eartag ? (
                                <span>{animal.l_id_eartag}</span>
                              ) : (
                                <span className="text-muted-foreground">
                                  <span aria-hidden="true">—</span>
                                  <span className="sr-only">Geen levensnummer</span>
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-medium">{herdName}</TableCell>
                            {hasBirthDates && (
                              <TableCell className="text-muted-foreground text-xs tabular-nums">
                                {animal.l_birth_date ? formatAnimalDate(animal.l_birth_date) : "—"}
                              </TableCell>
                            )}
                            {hasSexes && (
                              <TableCell className="text-xs">
                                {animal.l_sex === "female"
                                  ? "Vrouwelijk"
                                  : animal.l_sex === "male"
                                    ? "Mannelijk"
                                    : "—"}
                              </TableCell>
                            )}
                            <TableCell className="text-muted-foreground text-xs tabular-nums">
                              {animal.l_arriving_date
                                ? formatAnimalDate(animal.l_arriving_date)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <ChevronRight
                                aria-hidden="true"
                                className="text-muted-foreground inline-block h-4 w-4"
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        </FarmContent>
      </main>

      <AddAnimalDialog open={isAddOpen} onOpenChange={setIsAddOpen} herds={herds} />
      <AddHerdDialog open={isAddHerdOpen} onOpenChange={setIsAddHerdOpen} categories={categories} />
    </SidebarInset>
  )
}
