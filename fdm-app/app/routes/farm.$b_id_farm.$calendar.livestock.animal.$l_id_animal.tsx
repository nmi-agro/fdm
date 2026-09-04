import {
  assignAnimalToHerd,
  checkPermission,
  getAnimal,
  getAnimalAssignmentHistory,
  getFarm,
  getFarms,
  getGrazingCalendarForFarm,
  getHerdsForFarm,
  updateAnimal,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import {
  ArrowLeft,
  ArrowRightLeft,
  LogOut,
  Save,
  SquareArrowRightExit,
} from "lucide-react"
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
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
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
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Dierdetails | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk en bewerk details, toewijzingshistorie en beweidingshistorie van dit dier.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const l_id_animal = params.l_id_animal
    const calendar = params.calendar ?? String(new Date().getFullYear())

    if (!b_id_farm || !l_id_animal) {
      throw data("Farm ID and Animal ID are required", { status: 400 })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)

    const [farm, farms, animal, history, herds, grazings] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      getAnimal(fdm, session.principal_id, l_id_animal),
      getAnimalAssignmentHistory(fdm, session.principal_id, l_id_animal),
      getHerdsForFarm(fdm, session.principal_id, b_id_farm),
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

    // Correlate animal assignment history with grazing periods
    const animalGrazings = history.flatMap((assign) => {
      const aStart = assign.l_assigning_start ? new Date(assign.l_assigning_start) : new Date(0)
      const aEnd = assign.l_assigning_end ? new Date(assign.l_assigning_end) : new Date(8640000000000000)

      return grazings
        .filter((g) => {
          if (g.l_id_herd !== assign.l_id_herd) return false
          const gStart = new Date(g.l_grazing_start)
          const gEnd = g.l_grazing_end ? new Date(g.l_grazing_end) : gStart
          return gStart <= aEnd && gEnd >= aStart
        })
        .map((g) => {
          const gStart = new Date(g.l_grazing_start)
          const gEnd = g.l_grazing_end ? new Date(g.l_grazing_end) : gStart
          const days = Math.max(1, Math.floor((gEnd.getTime() - gStart.getTime()) / 86400000) + 1)
          return {
            l_id_grazing: g.l_id_grazing,
            l_id_herd: g.l_id_herd,
            l_herd_name: g.l_herd_name ?? "Koppel",
            b_id: g.b_id,
            b_name: g.b_name ?? "Onbekend perceel",
            b_area: g.b_area,
            l_grazing_start: gStart.toISOString(),
            l_grazing_end: gEnd.toISOString(),
            l_grazing_hours: g.l_grazing_hours ?? 8,
            l_grazing_type: g.l_grazing_type ?? "full",
            days,
          }
        })
    }).sort((a, b) => new Date(b.l_grazing_start).getTime() - new Date(a.l_grazing_start).getTime())

    const totalGrazingDays = animalGrazings.reduce((acc, g) => acc + g.days, 0)
    const totalGrazingHours = animalGrazings.reduce((acc, g) => acc + g.days * (g.l_grazing_hours ?? 8), 0)

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      farmOptions,
      animal: {
        l_id_animal: animal.l_id_animal,
        l_id_eartag: animal.l_id_eartag,
        l_id_worknumber: animal.l_id_worknumber,
        l_specie: animal.l_specie,
        l_breed: animal.l_breed,
        l_coatcolor: animal.l_coatcolor,
        l_birth_date: animal.l_birth_date ? new Date(animal.l_birth_date).toISOString() : null,
        l_sex: animal.l_sex,
        l_arriving_date: animal.l_arriving_date ? new Date(animal.l_arriving_date).toISOString() : null,
        l_arriving_method: animal.l_arriving_method,
        l_leaving_date: animal.l_leaving_date ? new Date(animal.l_leaving_date).toISOString() : null,
        l_leaving_method: animal.l_leaving_method,
        l_id_herd: animal.l_id_herd,
        l_id_category: animal.l_id_category,
        l_category: animal.l_category,
        l_lsu: animal.l_lsu ?? 1.0,
      },
      history: history.map((h) => ({
        l_id_herd: h.l_id_herd,
        l_herd_name: h.l_herd_name ?? "Koppel",
        l_id_category: h.l_id_category,
        l_category: h.l_category,
        l_assigning_start: h.l_assigning_start ? new Date(h.l_assigning_start).toISOString() : null,
        l_assigning_end: h.l_assigning_end ? new Date(h.l_assigning_end).toISOString() : null,
      })),
      grazingHistory: animalGrazings,
      grazingSummary: {
        totalDays: totalGrazingDays,
        totalHours: totalGrazingHours,
      },
      herds: herds.map((h) => ({
        l_id_herd: h.l_id_herd,
        l_herd_name: h.l_herd_name ?? "Koppel",
        l_id_category: h.l_id_category ?? "rvo_100",
        l_category: h.l_category,
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
    const l_id_animal = params.l_id_animal
    if (!b_id_farm || !l_id_animal) {
      throw data("Farm ID and Animal ID are required", { status: 400 })
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

    if (intent === "update_details") {
      const l_id_eartag = String(formData.get("l_id_eartag") ?? "").trim() || undefined
      const l_id_worknumber = String(formData.get("l_id_worknumber") ?? "").trim() || undefined
      const l_breed = String(formData.get("l_breed") ?? "").trim() || undefined
      const l_coatcolor = String(formData.get("l_coatcolor") ?? "").trim() || undefined
      const birthDateVal = String(formData.get("l_birth_date") ?? "")
      const l_sex = (formData.get("l_sex") as "female" | "male" | null) ?? undefined

      await updateAnimal(fdm, session.principal_id, l_id_animal, {
        l_id_eartag,
        l_id_worknumber,
        l_breed,
        l_coatcolor,
        l_birth_date: birthDateVal ? new Date(birthDateVal) : undefined,
        l_sex,
      })

      return dataWithSuccess({}, { message: "Diergegevens opgeslagen." })
    }

    if (intent === "reassign_herd") {
      const target_l_id_herd = String(formData.get("target_l_id_herd") ?? "")
      if (!target_l_id_herd) {
        throw data("Doelkoppel is verplicht.", { status: 400 })
      }

      await assignAnimalToHerd(fdm, session.principal_id, l_id_animal, target_l_id_herd)
      return dataWithSuccess({}, { message: "Dier succesvol overgeplaatst naar nieuwe koppel." })
    }

    if (intent === "record_departure") {
      const leavingDateVal = String(formData.get("l_leaving_date") ?? "")
      const l_leaving_method = (formData.get("l_leaving_method") as "died" | "sold" | "slaughtered" | "exported" | null) ?? "sold"

      await updateAnimal(fdm, session.principal_id, l_id_animal, {
        l_leaving_date: leavingDateVal ? new Date(leavingDateVal) : new Date(),
        l_leaving_method,
      })

      return dataWithSuccess({}, { message: "Afvoer van dier geregistreerd." })
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function AnimalDetailPage() {
  const {
    b_id_farm,
    calendar,
    farmOptions,
    animal,
    history,
    grazingHistory,
    grazingSummary,
    herds,
    farmWritePermission,
  } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()

  const [editWorknumber, setEditWorknumber] = useState(animal.l_id_worknumber ?? "")
  const [editEartag, setEditEartag] = useState(animal.l_id_eartag ?? "")
  const [editBreed, setEditBreed] = useState(animal.l_breed ?? "")
  const [editCoatcolor, setEditCoatcolor] = useState(animal.l_coatcolor ?? "")
  const [editBirthdate, setEditBirthdate] = useState(
    animal.l_birth_date ? format(new Date(animal.l_birth_date), "yyyy-MM-dd") : "",
  )
  const [editSex, setEditSex] = useState<"female" | "male">(
    animal.l_sex === "male" ? "male" : "female",
  )

  const [targetHerdId, setTargetHerdId] = useState("")
  const [leavingDate, setLeavingDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [leavingMethod, setLeavingMethod] = useState<"sold" | "died" | "slaughtered" | "exported">("sold")

  const isLeft = Boolean(animal.l_leaving_date)
  const currentHerd = herds.find((h) => h.l_id_herd === animal.l_id_herd)

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set("intent", "update_details")
    formData.set("l_id_worknumber", editWorknumber)
    formData.set("l_id_eartag", editEartag)
    formData.set("l_breed", editBreed)
    formData.set("l_coatcolor", editCoatcolor)
    if (editBirthdate) formData.set("l_birth_date", editBirthdate)
    formData.set("l_sex", editSex)
    void fetcher.submit(formData, { method: "post" })
  }

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetHerdId) return
    const formData = new FormData()
    formData.set("intent", "reassign_herd")
    formData.set("target_l_id_herd", targetHerdId)
    void fetcher.submit(formData, { method: "post" })
    setTargetHerdId("")
  }

  const handleDepartureSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set("intent", "record_departure")
    formData.set("l_leaving_date", leavingDate)
    formData.set("l_leaving_method", leavingMethod)
    void fetcher.submit(formData, { method: "post" })
  }

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/livestock/animals`,
          label: "Terug naar dierenoverzicht",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbLink asChild>
          <NavLink to={`/farm/${b_id_farm}/${calendar}/livestock`}>Veestapel</NavLink>
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbLink asChild>
          <NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/animals`}>Dieren</NavLink>
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {animal.l_id_worknumber ? `#${animal.l_id_worknumber}` : "Dierdetails"}
        </BreadcrumbItem>
      </Header>

      <main className="container max-w-5xl py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="h-8 gap-1 pl-0 text-muted-foreground hover:text-foreground">
                <NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/animals`}>
                  <ArrowLeft className="h-4 w-4" />
                  Dieren
                </NavLink>
              </Button>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-sm">
                Werknummer {animal.l_id_worknumber ?? animal.l_id_animal.slice(0, 8)}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <span>Dier #{animal.l_id_worknumber ?? "—"}</span>
              {isLeft ? (
                <Badge variant="outline" className="text-muted-foreground border-slate-300">
                  Afgevoerd ({animal.l_leaving_method ?? "vertrokken"})
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white">
                  Actief op bedrijf
                </Badge>
              )}
            </h1>
          </div>
        </div>

        {/* Top Summary KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Levensnummer</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="font-mono font-semibold text-sm truncate">
                {animal.l_id_eartag ?? "Geen oormerk"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Huidige koppel</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="font-semibold text-sm truncate">
                {currentHerd?.l_herd_name ?? "Geen koppel"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Diercategorie</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="font-semibold text-sm truncate">
                {animal.l_category ?? "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Weidegang ({calendar})</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="font-semibold text-sm">
                {grazingSummary.totalDays} dagen ({grazingSummary.totalHours}u)
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Edit Details & Departure Forms */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kenmerken & Gegevens</CardTitle>
                <CardDescription className="text-xs">
                  Pas werknummer, oormerk, ras, geslacht of geboortedatum aan.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleDetailsSubmit}>
                <CardContent className="space-y-4">
                  <FieldGroup>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="detail-worknumber">Werknummer</FieldLabel>
                        <Input
                          id="detail-worknumber"
                          value={editWorknumber}
                          onChange={(e) => setEditWorknumber(e.target.value)}
                          disabled={!farmWritePermission}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="detail-eartag">Levensnummer (oormerk)</FieldLabel>
                        <Input
                          id="detail-eartag"
                          value={editEartag}
                          onChange={(e) => setEditEartag(e.target.value)}
                          placeholder="Bijv. NL 999 9999 9999"
                          disabled={!farmWritePermission}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DatePicker
                        label="Geboortedatum"
                        field={{
                          name: "l_birth_date",
                          value: editBirthdate,
                          onChange: (val) => setEditBirthdate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                          onBlur: () => {},
                          ref: () => {},
                          disabled: !farmWritePermission,
                        }}
                        fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                      />
                      <Field>
                        <FieldLabel htmlFor="detail-sex">Geslacht</FieldLabel>
                        <Select
                          value={editSex}
                          onValueChange={(v: "female" | "male") => setEditSex(v)}
                          disabled={!farmWritePermission}
                        >
                          <SelectTrigger id="detail-sex">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="female">Vrouwelijk</SelectItem>
                            <SelectItem value="male">Mannelijk</SelectItem>
                          </SelectContent>
                        </Select>
                        {animal.l_category && (
                          <p className="text-muted-foreground text-[11px]">
                            Categorie ({animal.l_category}) bepaalt de toegestane geslachten.
                          </p>
                        )}
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="detail-breed">Ras</FieldLabel>
                        <Input
                          id="detail-breed"
                          value={editBreed}
                          onChange={(e) => setEditBreed(e.target.value)}
                          placeholder="Bijv. Holstein Friesian"
                          disabled={!farmWritePermission}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="detail-coatcolor">Haarkleur</FieldLabel>
                        <Input
                          id="detail-coatcolor"
                          value={editCoatcolor}
                          onChange={(e) => setEditCoatcolor(e.target.value)}
                          placeholder="Bijv. Zwartbont"
                          disabled={!farmWritePermission}
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </CardContent>
                {farmWritePermission && (
                  <CardFooter className="border-t pt-4">
                    <Button type="submit" disabled={fetcher.state !== "idle"} className="gap-1.5">
                      <Save className="h-4 w-4" />
                      Wijzigingen opslaan
                    </Button>
                  </CardFooter>
                )}
              </form>
            </Card>

            {/* Beweidingshistorie Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <SquareArrowRightExit className="h-4 w-4 text-emerald-600" />
                      Beweidingshistorie {calendar}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Overzicht van percelen waar dit dier met haar koppel heeft gegraasd.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {grazingSummary.totalDays} weidedagen
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periode</TableHead>
                      <TableHead>Perceel</TableHead>
                      <TableHead>Koppel</TableHead>
                      <TableHead className="text-right">Uren/dag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grazingHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                          Nog geen beweidingsregistraties voor dit dier in {calendar}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      grazingHistory.map((g, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-mono">
                            {format(new Date(g.l_grazing_start), "dd-MM")} → {format(new Date(g.l_grazing_end), "dd-MM")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {g.b_name} {g.b_area ? `(${g.b_area} ha)` : ""}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{g.l_herd_name}</TableCell>
                          <TableCell className="text-right font-mono">{g.l_grazing_hours} u</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Departure Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Afvoer / Vertrek</CardTitle>
                <CardDescription className="text-xs">
                  {isLeft
                    ? "Dit dier heeft het bedrijf verlaten."
                    : "Registreer wanneer dit dier het bedrijf verlaat."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLeft ? (
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-1 text-xs">
                    <p>
                      <strong>Vertrekdatum: </strong>
                      {animal.l_leaving_date ? format(new Date(animal.l_leaving_date), "dd-MM-yyyy") : "—"}
                    </p>
                    <p>
                      <strong>Reden / Methode: </strong>
                      <span className="capitalize">{animal.l_leaving_method ?? "Niet gespecificeerd"}</span>
                    </p>
                  </div>
                ) : farmWritePermission ? (
                  <form onSubmit={handleDepartureSubmit} className="space-y-4">
                    <FieldGroup>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <DatePicker
                          label="Datum vertrek"
                          field={{
                            name: "l_leaving_date",
                            value: leavingDate,
                            onChange: (val) => setLeavingDate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                            onBlur: () => {},
                            ref: () => {},
                          }}
                          fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                          required
                        />
                        <Field>
                          <FieldLabel htmlFor="dep-method">Reden</FieldLabel>
                          <Select
                            value={leavingMethod}
                            onValueChange={(v: "sold" | "died" | "slaughtered" | "exported") =>
                              setLeavingMethod(v)
                            }
                          >
                            <SelectTrigger id="dep-method">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sold">Verkocht (sold)</SelectItem>
                              <SelectItem value="slaughtered">Geslacht (slaughtered)</SelectItem>
                              <SelectItem value="died">Overleden (died)</SelectItem>
                              <SelectItem value="exported">Geëxporteerd (exported)</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </FieldGroup>
                    <Button type="submit" variant="destructive" size="sm" className="gap-1.5">
                      <LogOut className="h-4 w-4" />
                      Afvoer vastleggen
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Reassignment & Assignment History */}
          <div className="space-y-6">
            {/* Reassign Herd Card */}
            {!isLeft && farmWritePermission && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Koppeltoewijzing</CardTitle>
                  <CardDescription className="text-xs">
                    Verplaats dit dier naar een andere koppel.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleReassignSubmit}>
                  <CardContent className="space-y-3">
                    <Field>
                      <FieldLabel htmlFor="move-herd">Doelkoppel</FieldLabel>
                      <Select value={targetHerdId} onValueChange={setTargetHerdId}>
                        <SelectTrigger id="move-herd">
                          <SelectValue placeholder="Kies nieuwe koppel" />
                        </SelectTrigger>
                        <SelectContent>
                          {herds
                            .filter((h) => h.l_id_herd !== animal.l_id_herd)
                            .map((h) => (
                              <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                                {h.l_herd_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </CardContent>
                  <CardFooter className="border-t pt-3">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!targetHerdId || fetcher.state !== "idle"}
                      className="w-full gap-1.5"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      Verplaats naar koppel
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            )}

            {/* Assignment History Table Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Toewijzingshistorie</CardTitle>
                <CardDescription className="text-xs">
                  Historisch overzicht van koppels waarin dit dier gelopen heeft.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Koppel</TableHead>
                      <TableHead>Van</TableHead>
                      <TableHead>Tot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-xs">
                          Geen toewijzingshistorie gevonden.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((h, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-medium">{h.l_herd_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {h.l_assigning_start ? format(new Date(h.l_assigning_start), "dd-MM-yy") : "—"}
                          </TableCell>
                          <TableCell>
                            {h.l_assigning_end ? (
                              <span className="text-muted-foreground">
                                {format(new Date(h.l_assigning_end), "dd-MM-yy")}
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                                Huidig
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarInset>
  )
}
