import {
  addGrazings,
  checkPermission,
  getCultivationsForFarm,
  getFarm,
  getFarms,
  getFields,
  getGrazingCalendarForFarm,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import {
  GRAZING_SYSTEMS,
  type GrazingSystemKey,
} from "~/components/blocks/grazing/systems"
import { format } from "date-fns"
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
} from "lucide-react"
import { useMemo, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useFetcher,
  useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
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
import { cn } from "~/lib/utils"

export const meta: MetaFunction = () => {
  return [
    { title: `Graslandgebruiksysteem planner | ${clientConfig.name}` },
    {
      name: "description",
      content: "Graslandgebruiksysteem planner en rotatieplan generator.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())
    const calendarYear = parseInt(calendar, 10) || new Date().getFullYear()

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)

    const [farm, farms, herds, allFields, cultivationsByField, existingGrazings] =
      await Promise.all([
        getFarm(fdm, session.principal_id, b_id_farm),
        getFarms(fdm, session.principal_id),
        getHerdsForFarm(fdm, session.principal_id, b_id_farm),
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

    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const grasslandFields = allFields
      .filter((f) => {
        if (f.b_bufferstrip) return false
        const cults = cultivationsByField.get(f.b_id) ?? []
        return cults.some((c) => c.b_lu_croprotation === "grass")
      })
      .map((f) => ({
        b_id: f.b_id,
        b_name: f.b_name,
        b_area: f.b_area != null ? Math.round(f.b_area * 10) / 10 : 0,
      }))

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      calendarYear,
      farmOptions,
      herds: herds.map((h) => ({
        l_id_herd: h.l_id_herd,
        l_herd_name: h.l_herd_name ?? "Koppel",
        l_id_category: h.l_id_category ?? "rvo_100",
        l_lsu: h.l_lsu ?? 1.0,
      })),
      grasslandFields,
      existingGrazings: existingGrazings.map((g) => ({
        l_id_herd: g.l_id_herd,
        b_id: g.b_id,
        l_grazing_start: new Date(g.l_grazing_start).toISOString(),
        l_grazing_end: g.l_grazing_end ? new Date(g.l_grazing_end).toISOString() : null,
      })),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())
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
    const rowsJson = String(formData.get("plan_rows") ?? "[]")
    const rows = JSON.parse(rowsJson) as Array<{
      l_id_herd: string
      b_id: string
      l_grazing_start: string
      l_grazing_end: string
      l_grazing_hours: number
      l_grazing_type: "full" | "partial"
      l_grazing_area?: number
    }>

    if (rows.length === 0) {
      throw data("Geen perioden om vast te leggen.", { status: 400 })
    }

    await addGrazings(
      fdm,
      session.principal_id,
      rows.map((r) => ({
        l_id_herd: r.l_id_herd,
        b_id: r.b_id,
        l_grazing_start: new Date(r.l_grazing_start),
        l_grazing_end: new Date(r.l_grazing_end),
        l_grazing_hours: r.l_grazing_hours,
        l_grazing_type: r.l_grazing_type,
        l_grazing_area: r.l_grazing_area,
      })),
    )

    const firstStart = format(new Date(rows[0].l_grazing_start), "dd-MM")
    const lastEnd = format(new Date(rows[rows.length - 1].l_grazing_end), "dd-MM")

    return redirectWithSuccess(
      `/farm/${b_id_farm}/${calendar}/grazing`,
      `Beweidingsplan vastgelegd: ${rows.length} perioden van ${firstStart} t/m ${lastEnd}.`,
    )
  } catch (error) {
    return handleActionError(error)
  }
}

export default function GrazingPlanAssistent() {
  const { b_id_farm, calendar, calendarYear, farmOptions, herds, grasslandFields, existingGrazings } =
    useLoaderData<typeof loader>()
  const fetcher = useFetcher()

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const defaultSeasonStart = todayStr > `${calendarYear}-05-01` ? todayStr : `${calendarYear}-05-01`
  const defaultSeasonEnd = `${calendarYear}-10-15`

  // Step 1: Systeem
  const [systemKey, setSystemKey] = useState<GrazingSystemKey>("omweiden")

  // Step 2: Huiskavel
  const [huiskavelIds, setHuiskavelIds] = useState<string[]>(
    grasslandFields.slice(0, Math.min(4, grasslandFields.length)).map((f) => f.b_id),
  )

  // Step 3: Parameters
  const [selectedHerdId, setSelectedHerdId] = useState(herds[0]?.l_id_herd ?? "")
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(
    grasslandFields.map((f) => f.b_id),
  )
  const [startDate, setStartDate] = useState(defaultSeasonStart)
  const [endDate, setEndDate] = useState(defaultSeasonEnd)
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const [periodDays, setPeriodDays] = useState(4)
  const [partialPercentage, setPartialPercentage] = useState<number>(50)

  const selectedSystem = GRAZING_SYSTEMS[systemKey]

  const handleSystemSelect = (key: GrazingSystemKey) => {
    setSystemKey(key)
    const sys = GRAZING_SYSTEMS[key]
    if (sys.defaultPeriodDays > 0) setPeriodDays(sys.defaultPeriodDays)
    if (sys.defaultHoursPerDay > 0) setHoursPerDay(sys.defaultHoursPerDay)
  }

  const toggleHuiskavel = (b_id: string) => {
    setHuiskavelIds((prev) =>
      prev.includes(b_id) ? prev.filter((id) => id !== b_id) : [...prev, b_id],
    )
  }

  const toggleField = (b_id: string) => {
    setSelectedFieldIds((prev) =>
      prev.includes(b_id) ? prev.filter((id) => id !== b_id) : [...prev, b_id],
    )
  }

  // Live calculation of Huiskavel area & stocking density
  const huiskavelArea = useMemo(
    () =>
      grasslandFields
        .filter((f) => huiskavelIds.includes(f.b_id))
        .reduce((acc, f) => acc + f.b_area, 0),
    [grasslandFields, huiskavelIds],
  )

  // Step 4: Generation and Collision Detection
  const { generatedRows, collisions } = useMemo(() => {
    if (!selectedSystem.requiresGrazingRecords) {
      return { generatedRows: [], collisions: [] }
    }

    const fieldsToUse = grasslandFields.filter((f) => selectedFieldIds.includes(f.b_id))
    if (fieldsToUse.length === 0 || !selectedHerdId) {
      return { generatedRows: [], collisions: [] }
    }

    const rows: Array<{
      l_id_herd: string
      b_id: string
      fieldName: string
      fieldArea: number
      l_grazing_start: string
      l_grazing_end: string
      l_grazing_hours: number
      l_grazing_type: "full" | "partial"
      l_grazing_area?: number
    }> = []

    const skippedCollisions: Array<{
      fieldName: string
      startDate: string
      endDate: string
      reason: string
    }> = []

    const start = new Date(startDate)
    const end = new Date(endDate)
    let currentStart = new Date(start)
    let fieldIndex = 0

    while (currentStart < end) {
      const currentEnd = new Date(currentStart)
      currentEnd.setDate(currentEnd.getDate() + periodDays - 1)
      if (currentEnd > end) {
        currentEnd.setTime(end.getTime())
      }

      const activeField = fieldsToUse[fieldIndex % fieldsToUse.length]
      const sStr = format(currentStart, "yyyy-MM-dd")
      const eStr = format(currentEnd, "yyyy-MM-dd")

      // Check for collision with existing records for this herd & field
      const hasCollision = existingGrazings.some((g) => {
        if (g.l_id_herd !== selectedHerdId) return false
        if (g.b_id && g.b_id !== activeField.b_id) return false
        const gStart = new Date(g.l_grazing_start)
        const gEnd = g.l_grazing_end ? new Date(g.l_grazing_end) : gStart
        return currentStart <= gEnd && currentEnd >= gStart
      })

      if (hasCollision) {
        skippedCollisions.push({
          fieldName: activeField.b_name,
          startDate: sStr,
          endDate: eStr,
          reason: "Overlapt met bestaande registratie",
        })
      } else {
        const partialArea =
          selectedSystem.grazingType === "partial"
            ? Number(((activeField.b_area * partialPercentage) / 100).toFixed(1))
            : undefined

        rows.push({
          l_id_herd: selectedHerdId,
          b_id: activeField.b_id,
          fieldName: activeField.b_name,
          fieldArea: activeField.b_area,
          l_grazing_start: sStr,
          l_grazing_end: eStr,
          l_grazing_hours: hoursPerDay,
          l_grazing_type: selectedSystem.grazingType ?? "full",
          l_grazing_area: partialArea,
        })
      }

      // Advance
      currentStart = new Date(currentEnd)
      currentStart.setDate(currentStart.getDate() + 1)
      fieldIndex++
    }

    return { generatedRows: rows, collisions: skippedCollisions }
  }, [
    selectedSystem,
    grasslandFields,
    selectedFieldIds,
    selectedHerdId,
    startDate,
    endDate,
    periodDays,
    hoursPerDay,
    partialPercentage,
    existingGrazings,
  ])

  const totalWeidedagen = generatedRows.length * periodDays

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/grazing`,
          label: "Terug naar Beweidingskalender",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbLink asChild>
          <NavLink to={`/farm/${b_id_farm}/${calendar}/grazing`}>Beweiding</NavLink>
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Graslandgebruiksysteem planner</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title="Graslandgebruiksysteem planner"
          description="Genereer een doordacht rotatieschema passend bij jouw huiskavel, veebezetting en gekozen graslandgebruiksysteem."
        />

        <FarmContent>
          <div className="space-y-8 max-w-4xl">
            {/* Step 1: System Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1 · Welk systeem wil je toepassen?</CardTitle>
                <CardDescription className="text-xs">
                  Gebaseerd op de richtlijnen van het Handboek Melkveehouderij (§3.10).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {(Object.keys(GRAZING_SYSTEMS) as GrazingSystemKey[]).map((key) => {
                    const sys = GRAZING_SYSTEMS[key]
                    const isSelected = systemKey === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSystemSelect(key)}
                        className={cn(
                          "cursor-pointer text-left rounded-xl border p-4 transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{sys.name}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="text-muted-foreground mt-1.5 text-xs">{sys.description}</p>
                      </button>
                    )
                  })}
                </div>

                {!selectedSystem.requiresGrazingRecords && (
                  <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-semibold">Let op bij {selectedSystem.name}:</p>
                    <p>
                      Bij dit systeem is er geen weidegang. In de stikstofgebruiksnorm telt al je grasland mee als <strong>geheel maaien</strong>, wat leidt tot een hogere stikstofgebruiksruimte. Er worden geen weidedagen vastgelegd.
                    </p>
                    <NavLink
                      to={`/farm/${b_id_farm}/${calendar}/norms`}
                      className="text-primary font-medium underline inline-block mt-1"
                    >
                      Bekijk de gebruiksruimte →
                    </NavLink>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedSystem.requiresGrazingRecords && (
              <>
                {/* Step 2: Huiskavel */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">2 · Welke percelen horen bij de huiskavel?</CardTitle>
                    <CardDescription className="text-xs">
                      FDM weet nog niet welke percelen huiskavel zijn. Je keuze wordt gebruikt voor het advies en de kalenderindeling.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {grasslandFields.map((field) => {
                        const isChecked = huiskavelIds.includes(field.b_id)
                        return (
                          <div
                            key={field.b_id}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleHuiskavel(field.b_id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                toggleHuiskavel(field.b_id)
                              }
                            }}
                            className={cn(
                              "flex cursor-pointer items-center justify-between rounded-lg border p-3 text-xs transition-colors",
                              isChecked
                                ? "border-primary/50 bg-primary/5"
                                : "border-border hover:bg-muted/30",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox checked={isChecked} tabIndex={-1} />
                              <span className="font-medium">{field.b_name}</span>
                            </div>
                            <span className="text-muted-foreground">{field.b_area} ha</span>
                          </div>
                        )
                      })}
                    </div>

                    <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary shrink-0" />
                      <span>Huiskavel: <strong>{huiskavelArea.toFixed(1)} ha</strong>. Bij Nieuw Nederlands Weiden (Handboek §3.10) bepaalt de grootte van de huiskavel en de veebezetting welk schema optimaal is.</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 3: Parameters */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">3 · Wat neem je mee in het plan?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <FieldGroup>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="plan-herd">Koppel</FieldLabel>
                          <Select value={selectedHerdId} onValueChange={setSelectedHerdId}>
                            <SelectTrigger id="plan-herd">
                              <SelectValue placeholder="Kies koppel" />
                            </SelectTrigger>
                            <SelectContent>
                              {herds.map((h) => (
                                <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                                  {h.l_herd_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        <div className="grid grid-cols-2 gap-2">
                          <DatePicker
                            label="Periode vanaf"
                            field={{
                              name: "plan_start",
                              value: startDate,
                              onChange: (val) => setStartDate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                              onBlur: () => {},
                              ref: () => {},
                            }}
                            fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                            required
                          />
                          <DatePicker
                            label="t/m"
                            field={{
                              name: "plan_end",
                              value: endDate,
                              onChange: (val) => setEndDate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                              onBlur: () => {},
                              ref: () => {},
                            }}
                            fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
                            required
                          />
                        </div>
                      </div>

                      <Field>
                        <FieldLabel>Percelen om te beweiden in dit plan</FieldLabel>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {grasslandFields.map((field) => {
                            const isChecked = selectedFieldIds.includes(field.b_id)
                            return (
                              <div
                                key={field.b_id}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleField(field.b_id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    toggleField(field.b_id)
                                  }
                                }}
                                className={cn(
                                  "flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition-colors",
                                  isChecked
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border hover:bg-muted/30",
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox checked={isChecked} tabIndex={-1} />
                                  <span className="font-medium">{field.b_name}</span>
                                </div>
                                <span className="text-muted-foreground">{field.b_area} ha</span>
                              </div>
                            )
                          })}
                        </div>
                      </Field>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="plan-hours">Uren weidegang per dag</FieldLabel>
                          <Input
                            id="plan-hours"
                            type="number"
                            min="1"
                            max="24"
                            value={hoursPerDay}
                            onChange={(e) => setHoursPerDay(parseInt(e.target.value || "8", 10))}
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="plan-days">Wissel van perceel elke (dagen)</FieldLabel>
                          <Input
                            id="plan-days"
                            type="number"
                            min="1"
                            max="60"
                            value={periodDays}
                            onChange={(e) => setPeriodDays(parseInt(e.target.value || "4", 10))}
                          />
                        </Field>
                      </div>

                      {selectedSystem.grazingType === "partial" && (
                        <Field className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
                          <FieldLabel>Schatting oppervlakte per deelblok ({selectedSystem.name})</FieldLabel>
                          <div className="flex flex-wrap items-center gap-2">
                            {[50, 33, 25].map((pct) => (
                              <Button
                                key={pct}
                                type="button"
                                variant={partialPercentage === pct ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPartialPercentage(pct)}
                                className="text-xs h-8"
                              >
                                {pct === 50 ? "1/2 blok (50%)" : pct === 33 ? "1/3 blok (33%)" : "1/4 blok (25%)"}
                              </Button>
                            ))}
                            <div className="flex items-center gap-1.5 ml-2">
                              <Input
                                type="number"
                                min="5"
                                max="95"
                                value={partialPercentage}
                                onChange={(e) =>
                                  setPartialPercentage(
                                    Math.min(95, Math.max(5, parseInt(e.target.value || "50", 10))),
                                  )
                                }
                                className="w-20 text-xs h-8"
                              />
                              <span className="text-muted-foreground text-xs">% van perceel</span>
                            </div>
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            Bij {selectedSystem.name} weidt de koppel steeds op een deel van het perceel. FDM schat de oppervlakte per weidebeurt automatisch op {partialPercentage}% van de totale perceelsgrootte.
                          </p>
                        </Field>
                      )}
                    </FieldGroup>

                    <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                      Plannen kan alleen vooruit. De periode start op zijn vroegst vandaag ({todayStr}).
                    </p>
                  </CardContent>
                </Card>

                {/* Step 4: Plan Review Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">4 · Controleer het plan</CardTitle>
                        <CardDescription className="text-xs">
                          {generatedRows.length} perioden · ± {totalWeidedagen} weidedagen
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{selectedSystem.name}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {collisions.length > 0 && (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        <p className="font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          {collisions.length} {collisions.length === 1 ? "periode overlapt" : "perioden overlappen"} met bestaande registraties en worden overgeslagen:
                        </p>
                        <ul className="list-disc pl-5 space-y-0.5 mt-1">
                          {collisions.slice(0, 3).map((c, i) => (
                            <li key={i}>
                              {c.fieldName} ({c.startDate} → {c.endDate})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="max-h-64 overflow-y-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32">Periode</TableHead>
                            <TableHead>Perceel & Oppervlak</TableHead>
                            <TableHead className="text-right">Uren/dag</TableHead>
                            <TableHead>Gebruik</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {generatedRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                Geen perioden gegenereerd. Selecteer minimaal 1 perceel.
                              </TableCell>
                            </TableRow>
                          ) : (
                            generatedRows.map((row, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">
                                  {format(new Date(row.l_grazing_start), "dd-MM")} → {format(new Date(row.l_grazing_end), "dd-MM")}
                                </TableCell>
                                <TableCell className="font-medium text-xs">
                                  {row.fieldName}{" "}
                                  <span className="text-muted-foreground font-normal">
                                    ({row.l_grazing_area ? `${row.l_grazing_area} ha van ${row.fieldArea} ha` : `${row.fieldArea} ha`})
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-xs">{row.l_grazing_hours} u</TableCell>
                                <TableCell className="text-xs capitalize">
                                  {row.l_grazing_type === "partial"
                                    ? `Deelperceel (${partialPercentage}%)`
                                    : "Volledig"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                      Rustperiodes zijn gebaseerd op een vaste richtlijn, niet op de werkelijke grasgroei.
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t pt-4">
                    <Button variant="outline" asChild>
                      <NavLink to={`/farm/${b_id_farm}/${calendar}/grazing`}>Annuleren</NavLink>
                    </Button>

                    <fetcher.Form method="post">
                      <input type="hidden" name="plan_rows" value={JSON.stringify(generatedRows)} />
                      <Button
                        type="submit"
                        disabled={generatedRows.length === 0 || fetcher.state !== "idle"}
                        className="gap-1.5"
                      >
                        <Sparkles className="h-4 w-4" />
                        Plan bevestigen en vastleggen ({generatedRows.length})
                      </Button>
                    </fetcher.Form>
                  </CardFooter>
                </Card>
              </>
            )}
          </div>
        </FarmContent>
      </main>
    </SidebarInset>
  )
}
