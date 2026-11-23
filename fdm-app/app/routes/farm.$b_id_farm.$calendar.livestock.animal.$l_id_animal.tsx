import {
  assignAnimalToHerd,
  checkPermission,
  getAnimal,
  getAnimalAssignmentHistory,
  getFarm,
  getFarms,
  getGrazingCalendarForFarm,
  getHerdsForFarm,
  leavingMethodOptions,
  updateAnimal,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { ArrowRightLeft, CalendarDays, LogOut, Save } from "lucide-react"
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
import {
  AnimalNumberFields,
  focusEartagInput,
  getEartagError,
} from "~/components/blocks/livestock/animal-number-fields"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Badge } from "~/components/ui/badge"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { useToday } from "~/hooks/use-today"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { formText } from "~/lib/form"
import { endOfFarmDay, farmTodayKey } from "~/lib/grazing-dates"
import { serverNow } from "~/lib/server-now.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Dierdetails | ${clientConfig.name}` },
    {
      name: "description",
      content: "Bekijk en bewerk details, toewijzingshistorie en beweidingshistorie van dit dier.",
    },
  ]
}

/** A day on this page, e.g. "3 mei", or "3 mei 2024" with the year. */
/** A stored calendar day (midnight UTC, or `YYYY-MM-DD`) as a date, the same day in any time zone. */
const calendarDay = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`)

const formatAnimalDay = (iso: string, withYear = false) =>
  format(calendarDay(iso), withYear ? "d MMM yyyy" : "d MMM", { locale: nl })

/** The `YYYY-MM-DD` keys of the days from `first` up to and including `last`. */
function daysBetween(first: string, last: string): string[] {
  const days: string[] = []
  for (
    let day = new Date(`${first}T00:00:00.000Z`);
    day.toISOString().slice(0, 10) <= last;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    days.push(day.toISOString().slice(0, 10))
  }
  return days
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const l_id_animal = params.l_id_animal
    const calendar = getCalendar(params)

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
    // The animal is shown under the farm it belongs to only
    if (animal.b_id_farm !== b_id_farm) {
      throw data("Dier niet gevonden op dit bedrijf", { status: 404 })
    }
    const now = serverNow()
    const todayKey = farmTodayKey(now)
    // Grazing dates and the birth date are calendar days, stored as midnight UTC
    const dayKey = (date: Date | string) => new Date(date).toISOString().slice(0, 10)
    // The year bounds and assignments are moments: their day is the calendar day in the
    // Netherlands
    const farmDayKey = (date: Date | string) => farmTodayKey(new Date(date))
    const yearFrom = timeframe.start ? farmDayKey(timeframe.start) : "0000-01-01"
    const yearTo = timeframe.end ? farmDayKey(timeframe.end) : "9999-12-31"

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

    // The grazing of the animal: the grazings of its herds, on the days it was in that herd and in
    // the selected year. A move ends an assignment at the start of that day, so that day belongs to
    // the new herd.
    const realisedHours = new Map<string, number>()
    const animalGrazings = history
      .flatMap((assign) => {
        const aFrom = assign.l_assigning_start ? farmDayKey(assign.l_assigning_start) : yearFrom
        const aBefore = assign.l_assigning_end ? farmDayKey(assign.l_assigning_end) : "9999-12-31"
        return grazings
          .filter((g) => g.l_id_herd === assign.l_id_herd)
          .flatMap((g) => {
            const days = daysBetween(
              dayKey(g.l_grazing_start),
              dayKey(g.l_grazing_end ?? g.l_grazing_start),
            ).filter((day) => day >= aFrom && day < aBefore && day >= yearFrom && day <= yearTo)
            if (days.length === 0) return []
            // Days up to today have happened: the hours of the herd's grazings on a day add up
            for (const day of days) {
              if (day > todayKey) continue
              realisedHours.set(
                day,
                Math.min(24, (realisedHours.get(day) ?? 0) + (g.l_grazing_hours ?? 0)),
              )
            }
            return [
              {
                l_id_grazing: g.l_id_grazing,
                l_id_herd: g.l_id_herd,
                l_herd_name: g.l_herd_name ?? "Koppel",
                b_id: g.b_id,
                b_name: g.b_name ?? "Onbekend perceel",
                b_area: g.b_area,
                l_grazing_start: days[0],
                l_grazing_end: days[days.length - 1],
                l_grazing_hours: g.l_grazing_hours ?? null,
                days: days.length,
                isPlanned: dayKey(g.l_grazing_start) > todayKey,
              },
            ]
          })
      })
      .sort((a, b) => b.l_grazing_start.localeCompare(a.l_grazing_start))

    // Each day once, and only the days that have happened
    const totalGrazingDays = realisedHours.size
    const totalGrazingHours = [...realisedHours.values()].reduce((sum, hours) => sum + hours, 0)

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
        // A calendar day, the same in any time zone
        l_birth_date: animal.l_birth_date ? dayKey(animal.l_birth_date) : null,
        l_sex: animal.l_sex,
        l_arriving_date: animal.l_arriving_date
          ? new Date(animal.l_arriving_date).toISOString()
          : null,
        l_arriving_method: animal.l_arriving_method,
        l_leaving_date: animal.l_leaving_date
          ? new Date(animal.l_leaving_date).toISOString()
          : null,
        l_leaving_method: animal.l_leaving_method,
        // Gone once the departure date has passed; a departure in the future keeps it in its herd
        isLeft: animal.l_leaving_date !== null && new Date(animal.l_leaving_date) <= now,
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
        l_id_category: h.l_id_category,
        l_category: h.l_category,
      })),
      // Dutch labels of the leaving methods, for the departure form and the status
      leavingMethods: leavingMethodOptions.map((o) => ({ value: o.value, label: o.label })),
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
    // Only an animal of this farm is changed from this farm's page
    const owned = await getAnimal(fdm, session.principal_id, l_id_animal)
    if (owned.b_id_farm !== b_id_farm) {
      throw data("Dier niet gevonden op dit bedrijf", { status: 404 })
    }

    const formData = await request.formData()
    const intent = formText(formData, "intent")

    if (intent === "update_details") {
      // An empty levensnummer removes it; fdm-core checks and normalizes a filled one
      const l_id_eartag = formData.has("l_id_eartag")
        ? formText(formData, "l_id_eartag").trim()
        : undefined
      const l_id_worknumber = formText(formData, "l_id_worknumber").trim() || undefined
      // An empty birth date removes it; an omitted one leaves it as it is
      const birthDateVal = formData.has("l_birth_date")
        ? formText(formData, "l_birth_date")
        : undefined
      const l_sex = (formData.get("l_sex") as "female" | "male" | null) ?? undefined

      await updateAnimal(fdm, session.principal_id, l_id_animal, {
        l_id_eartag,
        l_id_worknumber,
        l_birth_date:
          birthDateVal === undefined ? undefined : birthDateVal ? new Date(birthDateVal) : null,
        l_sex,
      })

      return dataWithSuccess({}, { message: "Diergegevens opgeslagen." })
    }

    if (intent === "reassign_herd") {
      const target_l_id_herd = formText(formData, "target_l_id_herd")
      if (!target_l_id_herd) {
        throw data("Doelkoppel is verplicht.", { status: 400 })
      }

      await assignAnimalToHerd(fdm, session.principal_id, l_id_animal, target_l_id_herd)
      return dataWithSuccess({}, { message: "Dier succesvol overgeplaatst naar nieuwe koppel." })
    }

    if (intent === "record_departure") {
      const leavingDateVal = formText(formData, "l_leaving_date")
      const l_leaving_method =
        (formData.get("l_leaving_method") as "died" | "sold" | "slaughtered" | "exported" | null) ??
        "sold"

      // A departure today is recorded now, so the animal leaves its herd from this moment; a
      // departure on another day at the end of that day in the Netherlands, so the animal still
      // counts on that day
      const now = serverNow()
      const l_leaving_date =
        !leavingDateVal || leavingDateVal === farmTodayKey(now) ? now : endOfFarmDay(leavingDateVal)

      await updateAnimal(fdm, session.principal_id, l_id_animal, {
        l_leaving_date,
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
    leavingMethods,
    farmWritePermission,
  } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  const leavingMethodLabel = (method: string | null | undefined) =>
    leavingMethods.find((m) => m.value === method)?.label

  const [editWorknumber, setEditWorknumber] = useState(animal.l_id_worknumber ?? "")
  const [editEartag, setEditEartag] = useState(animal.l_id_eartag ?? "")
  const [showNumberErrors, setShowNumberErrors] = useState(false)
  const isCattle = animal.l_specie === "cattle"
  const [editBirthdate, setEditBirthdate] = useState(animal.l_birth_date?.slice(0, 10) ?? "")
  // Empty while the sex is not known, so the form does not suggest one
  const [editSex, setEditSex] = useState<"female" | "male" | "">(
    animal.l_sex === "female" || animal.l_sex === "male" ? animal.l_sex : "",
  )
  const animalName = animal.l_id_worknumber
    ? `Werknummer ${animal.l_id_worknumber}`
    : "Dier zonder werknummer"

  const [targetHerdId, setTargetHerdId] = useState("")
  // Defaults to today, which is only known on the client; a date the user picks sticks
  const today = useToday()
  const [leavingDate, setLeavingDate] = useKeyedState(
    today ? format(today, "yyyy-MM-dd") : "",
    (day) => day,
  )
  const [leavingMethod, setLeavingMethod] = useState<"sold" | "died" | "slaughtered" | "exported">(
    "sold",
  )

  const isLeft = animal.isLeft
  const currentHerd = herds.find((h) => h.l_id_herd === animal.l_id_herd)

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (getEartagError(editEartag, isCattle)) {
      setShowNumberErrors(true)
      focusEartagInput("detail")
      return
    }
    const formData = new FormData()
    formData.set("intent", "update_details")
    formData.set("l_id_worknumber", editWorknumber)
    formData.set("l_id_eartag", editEartag)
    // Always sent, so clearing the field removes the birth date
    formData.set("l_birth_date", editBirthdate)
    if (editSex) formData.set("l_sex", editSex)
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
    <div className="bg-background relative flex w-full flex-1 flex-col">
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/livestock/animals`,
          label: "Terug naar dierenoverzicht",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator className="hidden xl:block" />
        <BreadcrumbItem className="hidden xl:block">
          <BreadcrumbLink render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock`} />}>
            Melkvee
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden xl:block" />
        <BreadcrumbItem className="hidden xl:block">
          <BreadcrumbLink
            render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/animals`} />}
          >
            Vee
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>{animalName}</BreadcrumbItem>
      </Header>

      <div>
        <FarmTitle
          title={animalName}
          description={[animal.l_category, currentHerd?.l_herd_name].filter(Boolean).join(" · ")}
          rightNode={
            isLeft ? (
              <Badge variant="outline" className="text-muted-foreground">
                Afgevoerd (
                {leavingMethodLabel(animal.l_leaving_method)?.toLowerCase() ?? "vertrokken"})
              </Badge>
            ) : (
              <Badge variant="outline">Op het bedrijf</Badge>
            )
          }
        />

        <FarmContent>
          <div className="space-y-6">
            {/* Key facts of the animal */}
            <Card className="p-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Levensnummer</dt>
                  <dd className="truncate font-semibold tabular-nums">
                    {animal.l_id_eartag ?? "Geen levensnummer"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Huidige koppel</dt>
                  <dd className="truncate font-semibold">
                    {currentHerd?.l_herd_name ?? "Geen koppel"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Diercategorie</dt>
                  <dd className="truncate font-semibold">{animal.l_category ?? "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Weidegang {calendar}</dt>
                  <dd className="font-semibold tabular-nums">
                    {grazingSummary.totalDays.toLocaleString("nl-NL")}{" "}
                    {grazingSummary.totalDays === 1 ? "dag" : "dagen"} (
                    {grazingSummary.totalHours.toLocaleString("nl-NL")} uur)
                  </dd>
                </div>
              </dl>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left Column: Edit Details & Departure Forms */}
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Kenmerken & Gegevens</CardTitle>
                    <CardDescription className="text-xs">
                      Pas levensnummer, werknummer, geboortedatum of geslacht aan.
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={handleDetailsSubmit}>
                    <CardContent className="space-y-4">
                      <FieldGroup>
                        <AnimalNumberFields
                          idPrefix="detail"
                          eartag={editEartag}
                          worknumber={editWorknumber}
                          onEartagChange={(value) => {
                            setEditEartag(value)
                            setShowNumberErrors(false)
                          }}
                          onWorknumberChange={setEditWorknumber}
                          isCattle={isCattle}
                          showErrors={showNumberErrors}
                          worknumberDescription={
                            isCattle ? "Volgt uit een Nederlands levensnummer." : undefined
                          }
                          disabled={!farmWritePermission}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <DatePicker
                            label="Geboortedatum"
                            field={{
                              name: "l_birth_date",
                              value: editBirthdate,
                              onChange: (val) =>
                                setEditBirthdate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                              onBlur: () => {},
                              ref: () => {},
                              disabled: !farmWritePermission,
                            }}
                            fieldState={{
                              invalid: false,
                              isTouched: false,
                              isDirty: false,
                              isValidating: false,
                            }}
                          />
                          <Field>
                            <FieldLabel htmlFor="detail-sex">Geslacht</FieldLabel>
                            <Select
                              value={editSex}
                              items={[
                                { value: "female", label: "Vrouwelijk" },
                                { value: "male", label: "Mannelijk" },
                              ]}
                              onValueChange={(v) => {
                                if (v === "female" || v === "male") setEditSex(v)
                              }}
                              disabled={!farmWritePermission}
                            >
                              <SelectTrigger id="detail-sex">
                                <SelectValue placeholder="Onbekend" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="female">Vrouwelijk</SelectItem>
                                <SelectItem value="male">Mannelijk</SelectItem>
                              </SelectContent>
                            </Select>
                            {animal.l_category && (
                              <p className="text-muted-foreground text-xs">
                                Categorie ({animal.l_category}) bepaalt de toegestane geslachten.
                              </p>
                            )}
                          </Field>
                        </div>
                      </FieldGroup>
                    </CardContent>
                    {farmWritePermission && (
                      <CardFooter className="border-t pt-4">
                        <Button
                          type="submit"
                          disabled={fetcher.state !== "idle"}
                          className="gap-1.5"
                        >
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
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <CalendarDays aria-hidden="true" className="h-4 w-4 text-emerald-700" />
                          Beweidingshistorie {calendar}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          De percelen waar dit dier met zijn koppel heeft geweid, of volgens plan
                          gaat weiden.
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        {grazingSummary.totalDays.toLocaleString("nl-NL")}{" "}
                        {grazingSummary.totalDays === 1 ? "weidedag" : "weidedagen"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* The outer columns line up with the card title */}
                    <Table className="[&_tr>*:first-child]:pl-(--card-spacing) [&_tr>*:last-child]:pr-(--card-spacing)">
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
                            <TableCell
                              colSpan={4}
                              className="text-muted-foreground py-6 text-center text-xs"
                            >
                              Nog geen beweidingsregistraties voor dit dier in {calendar}.
                            </TableCell>
                          </TableRow>
                        ) : (
                          grazingHistory.map((g, idx) => (
                            <TableRow key={idx} className="text-xs">
                              <TableCell className="tabular-nums">
                                {g.l_grazing_start === g.l_grazing_end
                                  ? formatAnimalDay(g.l_grazing_start)
                                  : `${formatAnimalDay(g.l_grazing_start)} – ${formatAnimalDay(g.l_grazing_end)}`}
                                {g.isPlanned && (
                                  <span className="text-muted-foreground"> (gepland)</span>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {g.b_name}{" "}
                                {g.b_area
                                  ? `(${g.b_area.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} ha)`
                                  : ""}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {g.l_herd_name}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {g.l_grazing_hours === null
                                  ? "uren onbekend"
                                  : `${g.l_grazing_hours.toLocaleString("nl-NL")} uur`}
                              </TableCell>
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
                      <div className="bg-muted/40 space-y-1 rounded-lg border p-4 text-xs">
                        <p>
                          <strong>Vertrekdatum: </strong>
                          {animal.l_leaving_date
                            ? format(calendarDay(animal.l_leaving_date), "d MMMM yyyy", {
                                locale: nl,
                              })
                            : "—"}
                        </p>
                        <p>
                          <strong>Reden / Methode: </strong>
                          <span>
                            {leavingMethodLabel(animal.l_leaving_method) ?? "Niet gespecificeerd"}
                          </span>
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
                                onChange: (val) =>
                                  setLeavingDate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                                onBlur: () => {},
                                ref: () => {},
                              }}
                              fieldState={{
                                invalid: false,
                                isTouched: false,
                                isDirty: false,
                                isValidating: false,
                              }}
                              required
                            />
                            <Field>
                              <FieldLabel htmlFor="dep-method">Reden</FieldLabel>
                              <Select
                                value={leavingMethod}
                                items={leavingMethods}
                                onValueChange={(v) => {
                                  if (v !== null) setLeavingMethod(v)
                                }}
                              >
                                <SelectTrigger id="dep-method">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {leavingMethods.map((method) => (
                                    <SelectItem key={method.value} value={method.value}>
                                      {method.label}
                                    </SelectItem>
                                  ))}
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
                          <Select
                            value={targetHerdId}
                            items={herds
                              .filter((h) => h.l_id_herd !== animal.l_id_herd)
                              .map((h) => ({ value: h.l_id_herd, label: h.l_herd_name }))}
                            onValueChange={(v) => {
                              if (v !== null) setTargetHerdId(v)
                            }}
                          >
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
                    {/* The outer columns line up with the card title */}
                    <Table className="[&_tr>*:first-child]:pl-(--card-spacing) [&_tr>*:last-child]:pr-(--card-spacing)">
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
                            <TableCell
                              colSpan={3}
                              className="text-muted-foreground py-6 text-center text-xs"
                            >
                              Geen toewijzingshistorie gevonden.
                            </TableCell>
                          </TableRow>
                        ) : (
                          history.map((h, idx) => (
                            <TableRow key={idx} className="text-xs">
                              <TableCell className="font-medium">{h.l_herd_name}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {h.l_assigning_start
                                  ? formatAnimalDay(h.l_assigning_start, true)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {h.l_assigning_end ? (
                                  <span className="text-muted-foreground">
                                    {formatAnimalDay(h.l_assigning_end, true)}
                                  </span>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    Nu
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
          </div>
        </FarmContent>
      </div>
    </div>
  )
}
