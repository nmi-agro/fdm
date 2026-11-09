import {
  addCultivation,
  checkPermission,
  getDefaultDatesOfCultivation,
  getSeasonPlanProposal,
  removeCultivation,
  startOfDayInFdmTimeZone,
  toFdmDateString,
  updateCultivation,
} from "@nmi-agro/fdm-core"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { CropPicker, type CropOption } from "~/components/blocks/plan-next/crop-picker"
import { PlanNextStepFooter } from "~/components/blocks/plan-next/step-footer"
import { getPlanNextPath, getPlanNextStep } from "~/components/blocks/plan-next/steps"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
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
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  getCandidatePlanYears,
  getCultivationCatalogueForPlanYear,
  parsePlanYear,
} from "~/lib/season-plan.server"

/** Prefix of the search parameters with the source year chosen per field. */
const SOURCE_PARAM_PREFIX = "source."

/** A field as shown in the step. */
type PlanCultivationRow = {
  b_id: string
  b_name: string
  status: "kept" | "new"
  fieldType: "permanent" | "rotation" | "new"
  rotationCycle: number | null
  sourceYear: number | null
  availableSourceYears: number[]
  history: { year: number; b_lu_name: string }[]
  current: { b_lu: string; b_lu_catalogue: string; b_lu_name: string } | null
  continuing: boolean
  suggested: { b_lu_catalogue: string; b_lu_name: string } | null
  rotationWarnings: { minYearsBetween: number; lastYear: number }[]
}

/** Reads the source years chosen per field from the search parameters. */
function getSourceYears(searchParams: URLSearchParams): Map<string, number> {
  const sourceYears = new Map<string, number>()
  for (const [key, value] of searchParams) {
    if (key.startsWith(SOURCE_PARAM_PREFIX) && /^\d{4}$/.test(value)) {
      sourceYears.set(key.slice(SOURCE_PARAM_PREFIX.length), Number(value))
    }
  }
  return sourceYears
}

/** Loads the proposal per field and the cultivations that can be chosen in the target year. */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    const year = parsePlanYear(params.year, getCandidatePlanYears())
    if (year === null) {
      return redirect(getPlanNextPath(b_id_farm))
    }
    const session = await getSession(request)

    const [proposal, catalogue, canWrite] = await Promise.all([
      getSeasonPlanProposal(
        fdm,
        session.principal_id,
        b_id_farm,
        year,
        getSourceYears(url.searchParams),
      ),
      getCultivationCatalogueForPlanYear(fdm, session.principal_id, b_id_farm, year),
      checkPermission(fdm, "farm", "write", b_id_farm, session.principal_id, url.pathname, false),
    ])

    const rows: PlanCultivationRow[] = proposal.fields.map((field) => ({
      b_id: field.b_id,
      b_name: field.b_name,
      status: field.status === "new" ? "new" : "kept",
      fieldType: field.fieldType,
      rotationCycle: field.rotationCycle,
      sourceYear: field.sourceYear,
      availableSourceYears: field.availableSourceYears,
      history: field.history.slice(-3).map((entry) => ({
        year: entry.year,
        b_lu_name: entry.b_lu_name,
      })),
      current: field.current
        ? {
            b_lu: field.current.b_lu,
            b_lu_catalogue: field.current.b_lu_catalogue,
            b_lu_name: field.current.b_lu_name,
          }
        : null,
      continuing: field.continuing,
      suggested: field.suggested
        ? { b_lu_catalogue: field.suggested.b_lu_catalogue, b_lu_name: field.suggested.b_lu_name }
        : null,
      rotationWarnings: field.rotationWarnings.map((warning) => ({
        minYearsBetween: warning.minYearsBetween,
        lastYear: warning.lastYear,
      })),
    }))

    const options: CropOption[] = catalogue.map((entry) => ({
      value: entry.b_lu_catalogue,
      label: entry.b_lu_name,
    }))

    return { b_id_farm, year, rows, options, canWrite }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** Returns the start of the day a number of days after the calendar date of a moment (Europe/Amsterdam). */
function addDays(date: Date, days: number): Date {
  const [y, m, d] = toFdmDateString(date).split("-").map(Number)
  return startOfDayInFdmTimeZone(y, m, d + days)
}

/**
 * Saves the main cultivation of each field for the target year:
 * - a field without a main cultivation gets the chosen cultivation with its default dates;
 * - a recorded cultivation of the target year can be replaced by another one;
 * - a continuing cultivation (such as grassland) can be ended on a date and replaced.
 */
export async function action({ request, params, url }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    const year = parsePlanYear(params.year, getCandidatePlanYears())
    if (year === null) {
      throw data("Ongeldig jaar", { status: 400, statusText: "Ongeldig jaar" })
    }
    const session = await getSession(request)
    const canWrite = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      url.pathname,
      false,
    )
    if (!canWrite) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const formData = await request.formData()
    if (formData.get("intent") !== "save_cultivations") {
      throw data("Ongeldige actie", { status: 400 })
    }

    const proposal = await getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year)
    const failed: string[] = []
    let saved = 0

    for (const field of proposal.fields) {
      const crop = formData.get(`crop.${field.b_id}`)
      const mode = formData.get(`mode.${field.b_id}`)
      if (typeof crop !== "string" || crop === "") continue

      try {
        if (!field.current) {
          const dates = await getDefaultDatesOfCultivation(
            fdm,
            session.principal_id,
            b_id_farm,
            crop,
            year,
          )
          await addCultivation(
            fdm,
            session.principal_id,
            crop,
            field.b_id,
            dates.b_lu_start,
            dates.b_lu_end,
          )
          saved++
          continue
        }

        if (mode !== "replace") continue

        const dates = await getDefaultDatesOfCultivation(
          fdm,
          session.principal_id,
          b_id_farm,
          crop,
          year,
        )

        if (field.continuing) {
          // End the continuing cultivation on the chosen date, or the day before the new one starts
          const endValue = formData.get(`end.${field.b_id}`)
          const [y, m, d] =
            typeof endValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endValue)
              ? endValue.split("-").map(Number)
              : [0, 0, 0]
          const b_lu_end_current =
            y > 0 ? startOfDayInFdmTimeZone(y, m, d) : addDays(dates.b_lu_start, -1)
          await updateCultivation(
            fdm,
            session.principal_id,
            field.current.b_lu,
            undefined,
            undefined,
            b_lu_end_current,
          )
          const b_lu_start =
            dates.b_lu_start.getTime() > b_lu_end_current.getTime()
              ? dates.b_lu_start
              : addDays(b_lu_end_current, 1)
          const b_lu_end =
            dates.b_lu_end && dates.b_lu_end.getTime() > b_lu_start.getTime()
              ? dates.b_lu_end
              : undefined
          await addCultivation(fdm, session.principal_id, crop, field.b_id, b_lu_start, b_lu_end)
          saved++
          continue
        }

        if (crop === field.current.b_lu_catalogue) continue
        await removeCultivation(fdm, session.principal_id, field.current.b_lu)
        await addCultivation(
          fdm,
          session.principal_id,
          crop,
          field.b_id,
          dates.b_lu_start,
          dates.b_lu_end,
        )
        saved++
      } catch (error) {
        console.warn(`[plan-next] Saving the cultivation of ${field.b_id} failed:`, error)
        failed.push(field.b_name)
      }
    }

    if (failed.length > 0) {
      return dataWithError(
        null,
        `${saved} ${saved === 1 ? "gewas is" : "gewassen zijn"} opgeslagen. Niet gelukt voor: ${failed.join(", ")}. Controleer de datums en probeer het opnieuw.`,
      )
    }
    return redirectWithSuccess(
      getPlanNextPath(b_id_farm, year, "catch_crops"),
      saved > 0
        ? `${saved} ${saved === 1 ? "gewas is" : "gewassen zijn"} opgeslagen voor ${year}.`
        : "Er waren geen wijzigingen om op te slaan.",
    )
  } catch (error) {
    return handleActionError(error)
  }
}

/** Returns the label of the kind of field. */
function getFieldTypeLabel(row: PlanCultivationRow): string {
  if (row.fieldType === "permanent") {
    return row.continuing ? "Doorlopende teelt" : "Elk jaar hetzelfde gewas"
  }
  if (row.fieldType === "new") return "Nieuw perceel"
  return row.rotationCycle ? `Rotatie (${row.rotationCycle} jaar)` : "Rotatie"
}

/** Step 3: the main cultivation of each field in the target year. */
export default function PlanNextCultivations() {
  const { b_id_farm, year, rows, options, canWrite } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const step = getPlanNextStep("cultivations")
  const isSaving = navigation.state === "submitting"

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>

      <Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save_cultivations" />
        <Card>
          <CardHeader>
            <CardTitle>Hoofdteelt {year}</CardTitle>
            <CardDescription>
              Het voorstel gaat uit van het uitgangsjaar van het perceel: vorig jaar bij doorlopende
              teelten, het jaar dat in de vruchtwisseling terugkomt bij rotatiepercelen. Kies een
              ander uitgangsjaar om het voorstel aan te passen. Doorlopende teelten, zoals grasland,
              kunt u beëindigen en vervangen door een ander gewas. Zaai- en oogstdata worden de
              standaarddata in {year}; u kunt ze daarna in het bouwplan aanpassen. Bij Opslaan en
              verder worden de gekozen en voorgestelde gewassen opgeslagen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Er zijn geen percelen in gebruik in {year}. Voeg percelen toe in de stap Percelen.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Perceel</TableHead>
                    <TableHead>Vorige jaren</TableHead>
                    <TableHead>Uitgangsjaar</TableHead>
                    <TableHead className="min-w-72">Hoofdteelt {year}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <CultivationRow
                      key={`${row.b_id}-${row.sourceYear ?? "none"}`}
                      row={row}
                      options={options}
                      canWrite={canWrite}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <PlanNextStepFooter
          b_id_farm={b_id_farm}
          year={year}
          step="cultivations"
          primary={
            canWrite ? (
              <Button type="submit" disabled={isSaving}>
                <span key={isSaving ? "saving" : "idle"}>
                  {isSaving ? "Opslaan..." : "Opslaan en verder"}
                </span>
              </Button>
            ) : undefined
          }
        />
      </Form>
    </div>
  )
}

/** A field with its history, source year and the main cultivation for the target year. */
function CultivationRow({
  row,
  options,
  canWrite,
}: {
  row: PlanCultivationRow
  options: CropOption[]
  canWrite: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [replace, setReplace] = useState(false)

  /** Shows the proposal of another source year for this field. */
  const changeSourceYear = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set(`${SOURCE_PARAM_PREFIX}${row.b_id}`, value)
    setSearchParams(next, { preventScrollReset: true, replace: true })
  }

  return (
    <TableRow className="align-top">
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1">
          <span className="whitespace-nowrap">{row.b_name}</span>
          <span className="text-muted-foreground text-xs">{getFieldTypeLabel(row)}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {row.history.length > 0 ? (
          <span>{row.history.map((entry) => `${entry.year}: ${entry.b_lu_name}`).join(" · ")}</span>
        ) : (
          <span>Geen gegevens</span>
        )}
      </TableCell>
      <TableCell>
        {row.availableSourceYears.length > 0 ? (
          <Select
            value={row.sourceYear ? String(row.sourceYear) : undefined}
            onValueChange={changeSourceYear}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="–" />
            </SelectTrigger>
            <SelectContent>
              {row.availableSourceYears.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          {row.current ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span>{row.current.b_lu_name}</span>
                <Badge variant={row.continuing ? "outline" : "secondary"}>
                  {row.continuing ? "Loopt door" : "Vastgelegd"}
                </Badge>
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setReplace((value) => !value)}
                  >
                    <span key={replace ? "cancel" : "change"}>
                      {replace ? "Annuleren" : row.continuing ? "Beëindigen" : "Wijzigen"}
                    </span>
                  </Button>
                ) : null}
              </div>
              {replace ? (
                <div className="bg-muted/40 flex flex-col gap-2 rounded-md p-3">
                  <input type="hidden" name={`mode.${row.b_id}`} value="replace" />
                  {row.continuing ? (
                    <label className="flex flex-col gap-1 text-xs">
                      <span>Laatste dag van {row.current.b_lu_name}</span>
                      <Input type="date" name={`end.${row.b_id}`} className="w-44" />
                      <span className="text-muted-foreground">
                        Leeg laten: de dag vóór de zaaidatum van het nieuwe gewas.
                      </span>
                    </label>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {`${row.current.b_lu_name} wordt vervangen, inclusief de bijbehorende oogsten.`}
                    </span>
                  )}
                  <CropPicker
                    name={`crop.${row.b_id}`}
                    options={options}
                    defaultValue={
                      row.suggested && row.suggested.b_lu_catalogue !== row.current.b_lu_catalogue
                        ? row.suggested.b_lu_catalogue
                        : null
                    }
                    placeholder="Kies het nieuwe gewas"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <CropPicker
                name={`crop.${row.b_id}`}
                options={options}
                defaultValue={row.suggested?.b_lu_catalogue ?? null}
                disabled={!canWrite}
              />
              {row.suggested ? (
                <span className="text-muted-foreground text-xs">
                  {`Voorstel op basis van ${row.sourceYear}: ${row.suggested.b_lu_name}`}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  Geen voorstel; kies zelf een gewas.
                </span>
              )}
            </>
          )}
          {row.rotationWarnings.map((warning) => (
            <span
              key={`${warning.lastYear}-${warning.minYearsBetween}`}
              className="text-xs text-amber-700 dark:text-amber-400"
            >
              {`Rotatieadvies: dit gewastype hooguit 1 op ${warning.minYearsBetween} jaar (laatst in ${warning.lastYear}).`}
            </span>
          ))}
        </div>
      </TableCell>
    </TableRow>
  )
}
