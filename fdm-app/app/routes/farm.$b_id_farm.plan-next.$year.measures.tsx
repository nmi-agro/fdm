import {
  checkPermission,
  getSeasonPlanProposal,
  type SeasonPlanMeasure,
  startOfDayInFdmTimeZone,
  toFdmDateString,
  updateMeasure,
} from "@nmi-agro/fdm-core"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  NavLink,
  redirect,
  useFetcher,
  useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { PlanNextStepFooter } from "~/components/blocks/plan-next/step-footer"
import { getPlanNextPath, getPlanNextStep } from "~/components/blocks/plan-next/steps"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getCandidatePlanYears, parsePlanYear } from "~/lib/season-plan.server"

/** A measure as shown in the step. */
type MeasureItem = {
  b_id_measure: string
  m_name: string
  /** Start date (YYYY-MM-DD), or `null`. */
  m_start: string | null
  /** Last day (YYYY-MM-DD), or `null` for an ongoing measure. */
  m_end: string | null
}

/** The measures of a field, grouped for the target year. */
type MeasureFieldRow = {
  b_id: string
  b_name: string
  ongoing: MeasureItem[]
  expiring: MeasureItem[]
  ended: MeasureItem[]
}

/** Reduces a measure to what the step shows. */
function toItem(measure: SeasonPlanMeasure): MeasureItem {
  return {
    b_id_measure: measure.b_id_measure,
    m_name: measure.m_name,
    m_start: measure.m_start ? toFdmDateString(measure.m_start) : null,
    m_end: measure.m_end ? toFdmDateString(measure.m_end) : null,
  }
}

/** Loads the measures of the fields of the target year and of the fields no longer available. */
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

    const [proposal, canWrite] = await Promise.all([
      getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year),
      checkPermission(fdm, "farm", "write", b_id_farm, session.principal_id, url.pathname, false),
    ])

    const fields: MeasureFieldRow[] = proposal.fields
      .map((field) => ({
        b_id: field.b_id,
        b_name: field.b_name,
        ongoing: field.measures.ongoing.map(toItem),
        expiring: field.measures.expiring.map(toItem),
        ended: field.measures.ended.map(toItem),
      }))
      .filter((field) => field.ongoing.length + field.expiring.length + field.ended.length > 0)

    const droppedFields: MeasureFieldRow[] = proposal.droppedFields
      .map((field) => ({
        b_id: field.b_id,
        b_name: field.b_name,
        ongoing: field.measures.ongoing.map(toItem),
        expiring: field.measures.expiring.map(toItem),
        ended: field.measures.ended.map(toItem),
      }))
      .filter((field) => field.ongoing.length + field.expiring.length + field.ended.length > 0)

    return { b_id_farm, year, fields, droppedFields, canWrite }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renews a measure that ended in the year before the target year: ongoing (no end date) or up to
 * and including 31 December of the target year. Doing nothing lets the measure lapse.
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
    const b_id_measure = formData.get("b_id_measure")
    const until = formData.get("until")
    if (
      formData.get("intent") !== "renew_measure" ||
      typeof b_id_measure !== "string" ||
      (until !== "ongoing" && until !== "target")
    ) {
      throw data("Ongeldige actie", { status: 400 })
    }

    // Only measures that are expiring on a field that is in use in the target year
    const proposal = await getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year)
    const measure = proposal.fields
      .flatMap((field) => field.measures.expiring)
      .find((m) => m.b_id_measure === b_id_measure)
    if (!measure) {
      throw data("Maatregel niet gevonden of niet verlopen", { status: 404 })
    }

    await updateMeasure(
      fdm,
      session.principal_id,
      b_id_measure,
      undefined,
      until === "ongoing" ? null : startOfDayInFdmTimeZone(year, 12, 31),
    )
    return dataWithSuccess(
      null,
      until === "ongoing"
        ? `${measure.m_name} loopt door.`
        : `${measure.m_name} is verlengd tot en met 31 december ${year}.`,
    )
  } catch (error) {
    return handleActionError(error)
  }
}

/** Formats a date input value (YYYY-MM-DD) as DD-MM-YYYY. */
function formatDate(value: string | null): string {
  if (!value) return "–"
  const [y, m, d] = value.split("-")
  return `${d}-${m}-${y}`
}

/** Returns the period of a measure as text. */
function formatPeriod(measure: MeasureItem): string {
  if (!measure.m_end) return `Sinds ${formatDate(measure.m_start)}, doorlopend`
  return `${formatDate(measure.m_start)} – ${formatDate(measure.m_end)}`
}

/** Step 5: review the measures that continue, expire or have ended. */
export default function PlanNextMeasures() {
  const { b_id_farm, year, fields, droppedFields, canWrite } = useLoaderData<typeof loader>()
  const step = getPlanNextStep("measures")
  const expiringCount = fields.reduce((total, field) => total + field.expiring.length, 0)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maatregelen in {year}</CardTitle>
          <CardDescription>
            {`Doorlopende maatregelen gaan automatisch mee naar ${year}. Maatregelen die in ${year - 1} zijn geëindigd kunt u verlengen; doet u niets, dan vervallen ze en worden ze in het overzicht gemeld.${expiringCount > 0 ? ` ${expiringCount} ${expiringCount === 1 ? "maatregel vraagt" : "maatregelen vragen"} een keuze.` : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Er zijn geen maatregelen op de percelen van {year}.
            </p>
          ) : (
            fields.map((field) => (
              <MeasureField key={field.b_id} field={field} year={year} canWrite={canWrite} />
            ))
          )}
          {canWrite ? (
            <Button asChild variant="outline">
              <NavLink to={`/farm/${b_id_farm}/${year}/measures`}>
                <span>Nieuwe maatregel toevoegen</span>
              </NavLink>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {droppedFields.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Percelen niet meer beschikbaar</CardTitle>
            <CardDescription>
              {`De maatregelen op deze percelen zijn beëindigd toen het perceel niet meer beschikbaar werd. Ze zijn hier niet te wijzigen.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {droppedFields.map((field) => (
              <MeasureField key={field.b_id} field={field} year={year} canWrite={false} readOnly />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <PlanNextStepFooter b_id_farm={b_id_farm} year={year} step="measures" />
    </div>
  )
}

/** The measures of one field, grouped, with renew buttons for expiring measures. */
function MeasureField({
  field,
  year,
  canWrite,
  readOnly = false,
}: {
  field: MeasureFieldRow
  year: number
  canWrite: boolean
  readOnly?: boolean
}) {
  const fetcher = useFetcher()
  const isBusy = fetcher.state !== "idle"
  const items = readOnly ? [...field.ongoing, ...field.expiring, ...field.ended] : null

  return (
    <div className="space-y-2 rounded-md border p-4">
      <span className="font-medium whitespace-nowrap">{field.b_name}</span>
      {items ? (
        <ul className="space-y-1 text-sm">
          {items.map((measure) => (
            <li key={measure.b_id_measure} className="flex flex-wrap items-center gap-2">
              <span>{measure.m_name}</span>
              <span className="text-muted-foreground text-xs">{formatPeriod(measure)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2 text-sm">
          {field.expiring.map((measure) => (
            <li key={measure.b_id_measure} className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                {`Geëindigd in ${year - 1}`}
              </Badge>
              <span>{measure.m_name}</span>
              <span className="text-muted-foreground text-xs">{formatPeriod(measure)}</span>
              {canWrite ? (
                <div className="ml-auto flex flex-wrap gap-2">
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="renew_measure" />
                    <input type="hidden" name="b_id_measure" value={measure.b_id_measure} />
                    <input type="hidden" name="until" value="ongoing" />
                    <Button type="submit" size="sm" variant="outline" disabled={isBusy}>
                      <span>Doorlopend verlengen</span>
                    </Button>
                  </fetcher.Form>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="renew_measure" />
                    <input type="hidden" name="b_id_measure" value={measure.b_id_measure} />
                    <input type="hidden" name="until" value="target" />
                    <Button type="submit" size="sm" variant="outline" disabled={isBusy}>
                      <span>{`Verlengen t/m ${year}`}</span>
                    </Button>
                  </fetcher.Form>
                </div>
              ) : null}
            </li>
          ))}
          {field.ongoing.map((measure) => (
            <li key={measure.b_id_measure} className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Loopt door</Badge>
              <span>{measure.m_name}</span>
              <span className="text-muted-foreground text-xs">{formatPeriod(measure)}</span>
            </li>
          ))}
          {field.ended.length > 0 ? (
            <li className="text-muted-foreground text-xs">
              {`Eerder beëindigd: ${field.ended.map((measure) => measure.m_name).join(", ")}`}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
