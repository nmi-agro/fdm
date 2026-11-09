import {
  checkPermission,
  closeOngoingMeasuresOfField,
  getFields,
  getSeasonPlanProposal,
  startOfDayInFdmTimeZone,
  toFdmDateString,
  updateField,
} from "@nmi-agro/fdm-core"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  NavLink,
  redirect,
  useFetcher,
  useLoaderData,
} from "react-router"
import { dataWithSuccess, dataWithWarning } from "remix-toast"
import { PlanNextStepFooter } from "~/components/blocks/plan-next/step-footer"
import { getPlanNextPath, getPlanNextStep } from "~/components/blocks/plan-next/steps"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
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
import { getCandidatePlanYears, parsePlanYear } from "~/lib/season-plan.server"

/** What happens with a field in the target year. */
type FieldChoice = "keep" | "drop"

/** A field as shown in the step. */
type PlanFieldRow = {
  b_id: string
  b_name: string
  b_area: number | null
  status: "kept" | "new" | "dropped"
  /** Last day of use (YYYY-MM-DD), or `null`. */
  b_end: string | null
  current: string | null
  continuing: boolean
  /** Whether data is recorded for the target year that would fall outside the field period. */
  targetYearData: boolean
  /** Number of ongoing measures. */
  measures: number
}

/** Loads the fields of the year before and of the target year with their status. */
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

    const [proposal, fields, canWrite] = await Promise.all([
      getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year),
      getFields(fdm, session.principal_id, b_id_farm, {
        start: startOfDayInFdmTimeZone(year - 1, 1, 1),
        end: new Date(startOfDayInFdmTimeZone(year + 1, 1, 1).getTime() - 1),
      }),
      checkPermission(fdm, "farm", "write", b_id_farm, session.principal_id, url.pathname, false),
    ])
    const fieldById = new Map(fields.map((field) => [field.b_id, field]))

    const rows: PlanFieldRow[] = [
      ...proposal.fields.map((field): PlanFieldRow => {
        const details = fieldById.get(field.b_id)
        const b_end = details?.b_end ? toFdmDateString(details.b_end) : null
        return {
          b_id: field.b_id,
          b_name: field.b_name,
          b_area: details?.b_area ?? null,
          status: field.status,
          b_end,
          current: field.current?.b_lu_name ?? null,
          continuing: field.continuing,
          targetYearData:
            (field.current !== null && !field.continuing) || field.existingApplications > 0,
          measures: field.measures.ongoing.length,
        }
      }),
      ...proposal.droppedFields.map((field): PlanFieldRow => {
        const details = fieldById.get(field.b_id)
        return {
          b_id: field.b_id,
          b_name: field.b_name,
          b_area: details?.b_area ?? null,
          status: "dropped",
          b_end: details?.b_end ? toFdmDateString(details.b_end) : null,
          current: null,
          continuing: false,
          targetYearData: false,
          measures: 0,
        }
      }),
    ]

    return { b_id_farm, year, rows, canWrite }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Saves what happens with a field in the target year:
 * - `keep`: the field stays in use (no end date);
 * - `drop`: the field is not available in the target year; it ends on 31 December of the year
 *   before and its ongoing measures end on the same day. Data of earlier years stays.
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
    const intent = formData.get("intent")
    const b_id = formData.get("b_id")
    if (intent !== "set_field_choice" || typeof b_id !== "string") {
      throw data("Ongeldige actie", { status: 400 })
    }
    const choice = formData.get("choice")
    if (choice !== "keep" && choice !== "drop") {
      throw data("Ongeldige keuze", { status: 400 })
    }

    // Only fields of this farm that are active in the target year or the year before
    const proposal = await getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year)
    const field =
      proposal.fields.find((f) => f.b_id === b_id) ??
      proposal.droppedFields.find((f) => f.b_id === b_id)
    if (!field) {
      throw data("Perceel niet gevonden", { status: 404 })
    }

    if (choice === "keep") {
      await updateField(
        fdm,
        session.principal_id,
        b_id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        null,
      )
      return dataWithSuccess(null, `${field.b_name} blijft in gebruik in ${year}.`)
    }

    // drop: only fields that were already in use in the year before
    if ("status" in field && field.status === "new") {
      throw data("Een nieuw perceel kan niet vóór het plan-jaar eindigen.", { status: 400 })
    }
    const endOfPrevious = startOfDayInFdmTimeZone(year - 1, 12, 31)
    await updateField(
      fdm,
      session.principal_id,
      b_id,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      endOfPrevious,
    )
    const { closed, startingAfterEnd } = await closeOngoingMeasuresOfField(
      fdm,
      session.principal_id,
      b_id,
      endOfPrevious,
    )
    if (startingAfterEnd.length > 0) {
      return dataWithWarning(
        null,
        `${field.b_name} is niet meer beschikbaar in ${year}. ${startingAfterEnd.length} ${startingAfterEnd.length === 1 ? "maatregel begint" : "maatregelen beginnen"} na 31 december ${year - 1}; controleer ze bij Maatregelen.`,
      )
    }
    return dataWithSuccess(
      null,
      `${field.b_name} is niet meer beschikbaar in ${year}.${closed.length > 0 ? ` ${closed.length} lopende ${closed.length === 1 ? "maatregel is" : "maatregelen zijn"} beëindigd per 31 december ${year - 1}.` : ""}`,
    )
  } catch (error) {
    return handleActionError(error)
  }
}

/** Returns the text of the confirmation to make a field unavailable in the target year. */
function getDropDescription(row: PlanFieldRow, year: number): string {
  const parts = [`Het perceel eindigt op 31 december ${year - 1}.`]
  if (row.measures > 0) {
    parts.push(
      `${row.measures} lopende ${row.measures === 1 ? "maatregel wordt" : "maatregelen worden"} op dezelfde dag beëindigd.`,
    )
  }
  if (row.targetYearData) {
    parts.push(
      `Er zijn al gegevens voor ${year} vastgelegd op dit perceel; die vallen daarna buiten de periode van het perceel.`,
    )
  }
  parts.push("Gegevens van eerdere jaren blijven bewaard.")
  return parts.join(" ")
}

/** Formats an area in hectares. */
function formatArea(b_area: number | null): string {
  if (b_area === null) return "–"
  return `${b_area.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} ha`
}

/** Step 2: keep, drop or add fields for the target year. */
export default function PlanNextFields() {
  const { b_id_farm, year, rows, canWrite } = useLoaderData<typeof loader>()
  const step = getPlanNextStep("fields")
  const kept = rows.filter((row) => row.status !== "dropped")

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Percelen in {year}</CardTitle>
          <CardDescription>
            Percelen lopen door, tenzij u aangeeft dat ze niet meer beschikbaar zijn (bijvoorbeeld
            omdat de pacht stopt). Een perceel dat niet meer beschikbaar is, eindigt op 31 december{" "}
            {year - 1}; lopende maatregelen eindigen dan ook. Gegevens van eerdere jaren blijven
            bewaard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Er zijn nog geen percelen. Voeg hieronder percelen toe.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perceel</TableHead>
                  <TableHead>Oppervlakte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">In {year}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <FieldRow key={row.b_id} row={row} year={year} canWrite={canWrite} />
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-muted-foreground mt-4 text-sm">
            {`${kept.length} ${kept.length === 1 ? "perceel" : "percelen"} in gebruik in ${year}.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe percelen</CardTitle>
          <CardDescription>
            Gaat u in {year} nieuwe percelen gebruiken, bijvoorbeeld door pacht? Voeg ze toe voor{" "}
            {year}; ze beginnen op 1 januari {year} en verschijnen daarna hier als nieuw perceel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canWrite ? (
            <>
              <Button asChild variant="outline">
                <NavLink to={`/farm/${b_id_farm}/${year}/field/new`}>
                  <span>Kies op de kaart</span>
                </NavLink>
              </Button>
              <Button asChild variant="outline">
                <NavLink to={`/farm/${b_id_farm}/${year}/rvo`}>
                  <span>Ophalen bij RVO</span>
                </NavLink>
              </Button>
              <Button asChild variant="outline">
                <NavLink to={`/farm/${b_id_farm}/${year}/upload`}>
                  <span>Shapefile uploaden</span>
                </NavLink>
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              U heeft geen schrijfrechten om percelen toe te voegen.
            </p>
          )}
        </CardContent>
      </Card>

      <PlanNextStepFooter b_id_farm={b_id_farm} year={year} step="fields" />
    </div>
  )
}

/** A field with its status and the buttons to change it. */
function FieldRow({ row, year, canWrite }: { row: PlanFieldRow; year: number; canWrite: boolean }) {
  const fetcher = useFetcher()
  const [confirmDrop, setConfirmDrop] = useState(false)
  const isBusy = fetcher.state !== "idle"

  /** Submits the choice for this field. */
  const submit = (value: FieldChoice) => {
    void fetcher.submit(
      { intent: "set_field_choice", b_id: row.b_id, choice: value },
      { method: "post" },
    )
  }

  const statusLabel =
    row.status === "new" ? "Nieuw" : row.status === "dropped" ? "Niet beschikbaar" : "Loopt door"

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="whitespace-nowrap">{row.b_name}</span>
          {row.current ? (
            <span className="text-muted-foreground text-xs">{row.current}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <span>{formatArea(row.b_area)}</span>
      </TableCell>
      <TableCell>
        <Badge key={statusLabel} variant={row.status === "dropped" ? "outline" : "secondary"}>
          {statusLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-2">
          {row.status === "dropped" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!canWrite || isBusy}
              onClick={() => submit("keep")}
            >
              <span>Toch behouden</span>
            </Button>
          ) : (
            row.status === "kept" && (
              <Button
                size="sm"
                variant="outline"
                disabled={!canWrite || isBusy}
                onClick={() => setConfirmDrop(true)}
              >
                <span>Niet beschikbaar</span>
              </Button>
            )
          )}
        </div>
        <AlertDialog open={confirmDrop} onOpenChange={setConfirmDrop}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{`${row.b_name} niet meer beschikbaar in ${year}?`}</AlertDialogTitle>
              <AlertDialogDescription>{getDropDescription(row, year)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmDrop(false)
                  submit("drop")
                }}
              >
                Niet beschikbaar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}
