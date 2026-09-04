import {
  addAnimalsToHerd,
  checkPermission,
  createHerdWithAnimals,
  getAnimalCategoriesForFarm,
  getCensusForFarm,
  getCultivationsForFarm,
  getFarm,
  getFarms,
  getFields,
  getGrazingCalendarForFarm,
  getHerdsForFarm,
  reassignHerdAnimals,
  removeAnimalsFromHerd,
  removeHerd,
  updateHerd,
} from "@nmi-agro/fdm-core"
import { Info, Plus, Warehouse } from "lucide-react"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useFetcher,
  useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { HerdCard } from "~/components/blocks/livestock/herd-card"
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
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Veestapel | ${clientConfig.name}` },
    {
      name: "description",
      content: "Overzicht van de veestapel, koppels, dieren en veebezetting.",
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
    const timeframe = getTimeframe(params)

    const [farm, farms, herds, census, categories, allFields, cultivationsByField, grazings] =
      await Promise.all([
        getFarm(fdm, session.principal_id, b_id_farm),
        getFarms(fdm, session.principal_id),
        getHerdsForFarm(fdm, session.principal_id, b_id_farm),
        getCensusForFarm(fdm, session.principal_id, b_id_farm),
        getAnimalCategoriesForFarm(fdm, session.principal_id, b_id_farm),
        getFields(fdm, session.principal_id, b_id_farm, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getGrazingCalendarForFarm(fdm, session.principal_id, b_id_farm, timeframe),
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

    // Calculate total grassland area (excluding buffer strips)
    const grasslandArea = allFields
      .filter((f) => {
        if (f.b_bufferstrip) return false
        const cults = cultivationsByField.get(f.b_id) ?? []
        return cults.some((c) => c.b_lu_croprotation === "grass")
      })
      .reduce((acc, f) => acc + (f.b_area ?? 0), 0)

    const censusMap = new Map<string, number>()
    for (const c of census) {
      censusMap.set(c.l_id_herd, c.count)
    }

    // Determine current grazing status for each herd
    const now = new Date()
    const herdStatusMap = new Map<
      string,
      { type: "grazing_now" | "planned" | "idle"; fieldName?: string | null; dateStr?: string | null }
    >()

    for (const h of herds) {
      const herdGrazings = grazings.filter((g) => g.l_id_herd === h.l_id_herd)
      const current = herdGrazings.find((g) => {
        const start = new Date(g.l_grazing_start)
        const end = g.l_grazing_end ? new Date(g.l_grazing_end) : null
        return start <= now && (!end || end >= now)
      })

      if (current) {
        herdStatusMap.set(h.l_id_herd, {
          type: "grazing_now",
          fieldName: current.b_name ?? "onbekend perceel",
        })
      } else {
        const planned = herdGrazings
          .filter((g) => new Date(g.l_grazing_start) > now)
          .sort((a, b) => new Date(a.l_grazing_start).getTime() - new Date(b.l_grazing_start).getTime())[0]

        if (planned) {
          const d = new Date(planned.l_grazing_start)
          herdStatusMap.set(h.l_id_herd, {
            type: "planned",
            dateStr: `${d.getDate()} ${["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][d.getMonth()]}`,
          })
        } else {
          herdStatusMap.set(h.l_id_herd, { type: "idle" })
        }
      }
    }

    const herdCardsData = herds.map((h) => ({
      l_id_herd: h.l_id_herd,
      l_herd_name: h.l_herd_name,
      l_id_category: h.l_id_category,
      l_category: h.l_category,
      l_lsu: h.l_lsu ?? 1.0,
      count: censusMap.get(h.l_id_herd) ?? 0,
      status: herdStatusMap.get(h.l_id_herd) ?? { type: "idle" as const },
    }))

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      farmOptions,
      herds: herdCardsData,
      categories,
      grasslandArea: Math.round(grasslandArea * 10) / 10,
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

    if (intent === "update_count") {
      const l_id_herd = String(formData.get("l_id_herd") ?? "")
      const targetCount = parseInt(String(formData.get("target_count") ?? "0"), 10)
      const previousCount = parseInt(String(formData.get("previous_count") ?? "0"), 10)

      if (targetCount > previousCount) {
        const toAdd = targetCount - previousCount
        await addAnimalsToHerd(fdm, session.principal_id, l_id_herd, toAdd)
        return dataWithSuccess({ targetCount }, { message: `${toAdd} ${toAdd === 1 ? "dier" : "dieren"} toegevoegd.` })
      } else if (targetCount < previousCount) {
        const toRemove = previousCount - targetCount
        await removeAnimalsFromHerd(fdm, session.principal_id, l_id_herd, toRemove, {
          l_leaving_method: "sold",
        })
        return dataWithSuccess({ targetCount }, { message: `${toRemove} ${toRemove === 1 ? "dier" : "dieren"} afgevoerd.` })
      }
      return { success: true }
    }

    if (intent === "add_herd") {
      const l_id_category = String(formData.get("l_id_category") ?? "")
      const l_herd_name = String(formData.get("l_herd_name") ?? "Koppel").trim()
      const count = parseInt(String(formData.get("count") ?? "0"), 10)

      await createHerdWithAnimals(
        fdm,
        session.principal_id,
        b_id_farm,
        {
          l_herd_name,
          l_id_category,
        },
        count,
      )

      return dataWithSuccess({ l_herd_name }, { message: `Koppel ${l_herd_name} aangemaakt.` })
    }

    if (intent === "update_herd") {
      const l_id_herd = String(formData.get("l_id_herd") ?? "")
      const l_herd_name = String(formData.get("l_herd_name") ?? "").trim()
      await updateHerd(fdm, session.principal_id, l_id_herd, { l_herd_name })
      return dataWithSuccess({}, { message: "Koppelnaam bijgewerkt." })
    }

    if (intent === "reassign_herd") {
      const source_l_id_herd = String(formData.get("source_l_id_herd") ?? "")
      const target_l_id_herd = String(formData.get("target_l_id_herd") ?? "")
      await reassignHerdAnimals(fdm, session.principal_id, source_l_id_herd, target_l_id_herd)
      return dataWithSuccess({}, { message: "Dieren succesvol overgezet naar de nieuwe koppel." })
    }

    if (intent === "remove_herd") {
      const l_id_herd = String(formData.get("l_id_herd") ?? "")
      await removeHerd(fdm, session.principal_id, l_id_herd)
      return dataWithSuccess({}, { message: "Koppel verwijderd." })
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function VeestapelOverview() {
  const {
    b_id_farm,
    calendar,
    farmOptions,
    herds,
    categories,
    grasslandArea,
    farmWritePermission,
  } = useLoaderData<typeof loader>()

  // Add herd modal state
  const [isAddHerdOpen, setIsAddHerdOpen] = useState(false)
  const [newCatId, setNewCatId] = useState("rvo_100")
  const [newHerdName, setNewHerdName] = useState("Melkkoeien")
  const [newHerdCount, setNewHerdCount] = useState(20)
  const fetcher = useFetcher()

  const totalAnimals = herds.reduce((acc, h) => acc + h.count, 0)
  const totalGve = Number(
    herds.reduce((acc, h) => acc + h.count * (h.l_lsu ?? 1.0), 0).toFixed(1),
  )
  const gvePerHaGrassland =
    grasslandArea > 0 ? Number((totalGve / grasslandArea).toFixed(1)) : null

  const handleAddHerdSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set("intent", "add_herd")
    formData.set("l_id_category", newCatId)
    formData.set("l_herd_name", newHerdName.trim())
    formData.set("count", String(newHerdCount))
    fetcher.submit(formData, { method: "post" })
    setIsAddHerdOpen(false)
  }

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}`,
          label: "Terug naar bedrijf",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem>Veestapel</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title={`Veestapel ${calendar}`}
          description="Beheer je koppels, veebezetting en individuele dieren."
          rightNode={
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild size="sm" className="gap-1.5 text-xs">
                <NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/animals`}>
                  <Warehouse className="h-4 w-4" />
                  Alle dieren bekijken
                </NavLink>
              </Button>
              {farmWritePermission && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAddHerdOpen(true)}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Koppel toevoegen
                </Button>
              )}
            </div>
          }
        />

        <FarmContent>
          <div className="space-y-6">
            {herds.length === 0 ? (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <Warehouse className="text-muted-foreground mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">Nog geen koppels aanwezig</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Voeg een eerste koppel toe om te starten met veestapel- en beweidingsbeheer.
                </p>
                <Button className="mt-6 gap-1.5" asChild>
                  <NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/new`}>
                    <Plus className="h-4 w-4" />
                    Melkvee toevoegen
                  </NavLink>
                </Button>
              </div>
            ) : (
              <>
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

                {/* Overall Stats Footer */}
                <div className="rounded-xl border bg-card p-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Totaal: </span>
                        <strong className="text-foreground font-semibold">{totalAnimals} dieren</strong>
                      </div>
                      <span className="text-muted-foreground">·</span>
                      <div>
                        <span className="text-muted-foreground">GVE: </span>
                        <strong className="text-foreground font-semibold">{totalGve.toLocaleString("nl-NL")} GVE</strong>
                      </div>
                      {gvePerHaGrassland !== null && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <div>
                            <span className="text-muted-foreground">Veebezetting grasland: </span>
                            <strong className="text-foreground font-semibold">
                              {gvePerHaGrassland.toLocaleString("nl-NL")} GVE/ha
                            </strong>
                            <span className="text-muted-foreground ml-1 text-xs">({grasslandArea} ha gras)</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 border-t pt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Aantallen zijn afgeleid uit de dieren in de koppel — er wordt geen aantal opgeslagen. GVE-factoren: diercategorieëncatalogus (l_lsu).</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </FarmContent>
      </main>

      {/* Add Herd Dialog */}
      <Dialog open={isAddHerdOpen} onOpenChange={setIsAddHerdOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAddHerdSubmit}>
            <DialogHeader>
              <DialogTitle>Nieuwe koppel toevoegen</DialogTitle>
              <DialogDescription>
                Voeg een nieuwe groep dieren toe aan je bedrijf.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cat-select">Diercategorie *</FieldLabel>
                  <Select value={newCatId} onValueChange={setNewCatId}>
                    <SelectTrigger id="cat-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.l_id_category} value={c.l_id_category}>
                          {c.l_category} ({c.l_lsu} GVE/dier)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="add-herd-name">Naam van de koppel</FieldLabel>
                  <Input
                    id="add-herd-name"
                    value={newHerdName}
                    onChange={(e) => setNewHerdName(e.target.value)}
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
                    value={newHerdCount}
                    onChange={(e) => setNewHerdCount(parseInt(e.target.value || "1", 10))}
                    required
                  />
                </Field>
              </FieldGroup>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddHerdOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit">Koppel aanmaken</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  )
}

