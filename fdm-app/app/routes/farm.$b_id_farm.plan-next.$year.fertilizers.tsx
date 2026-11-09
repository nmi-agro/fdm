import { type FarmNutrientAdviceRow, startFarmNutrientAdviceRows } from "@nmi-agro/fdm-calculator"
import {
  checkPermission,
  copyFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getFields,
  getSeasonPlanProposal,
  startOfDayInFdmTimeZone,
  toFdmDateString,
} from "@nmi-agro/fdm-core"
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  NavLink,
  redirect,
  useLoaderData,
  useNavigation,
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { PlanNextNormsCard } from "~/components/blocks/plan-next/norms-card"
import { PlanNextStepFooter } from "~/components/blocks/plan-next/step-footer"
import { getPlanNextPath, getPlanNextStep } from "~/components/blocks/plan-next/steps"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getCandidatePlanYears, getPlanNormsSummary, parsePlanYear } from "~/lib/season-plan.server"

/** A fertilizer application as shown in the step. */
type ApplicationItem = {
  p_app_id: string
  p_name_nl: string
  /** Amount in the unit of the fertilizer, or `null`. */
  amount: number | null
  unit: string
  /** Date (YYYY-MM-DD). */
  date: string
}

/** A field with its fertilizer plan as shown in the step. */
type FertilizerRow = {
  b_id: string
  b_name: string
  mainCrop: string | null
  /** Applications already recorded for the target year. */
  existing: ApplicationItem[]
  /** Applications proposed for copying, with the dates of the target year. */
  template: {
    b_id: string
    b_name: string
    year: number
    sameField: boolean
    applications: ApplicationItem[]
  } | null
  /** Remaining nutrient advice when there is no template, or `null`. */
  advice: { N?: number; P?: number; K?: number } | null
  adviceError: boolean
}

/** Formats an amount with Dutch number formatting. */
function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: digits })
}

/** Formats a date input value (YYYY-MM-DD) as DD-MM-YYYY. */
function formatDate(value: string): string {
  const [y, m, d] = value.split("-")
  return `${d}-${m}-${y}`
}

/**
 * Loads per field the fertilizer applications of the target year, the applications proposed for
 * copying, the remaining nutrient advice for fields without a proposal, and the filling of the
 * legal norms of the farm.
 */
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
    const targetTimeframe = {
      start: startOfDayInFdmTimeZone(year, 1, 1),
      end: new Date(startOfDayInFdmTimeZone(year + 1, 1, 1).getTime() - 1),
    }

    const [proposal, fields, applicationsByField, canWrite] = await Promise.all([
      getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year),
      getFields(fdm, session.principal_id, b_id_farm, targetTimeframe),
      getFertilizerApplicationsForFarm(fdm, session.principal_id, b_id_farm, {
        start: startOfDayInFdmTimeZone(year - 6, 1, 1),
        end: targetTimeframe.end,
      }),
      checkPermission(fdm, "farm", "write", b_id_farm, session.principal_id, url.pathname, false),
    ])
    const fieldById = new Map(fields.map((field) => [field.b_id, field]))
    const applicationById = new Map(
      [...applicationsByField.values()]
        .flat()
        .map((application) => [application.p_app_id, application]),
    )
    const nameById = new Map(proposal.fields.map((field) => [field.b_id, field.b_name]))

    /** Reduces an application to what the step shows, with an optional other date. */
    const toItem = (p_app_id: string, date?: Date): ApplicationItem | null => {
      const application = applicationById.get(p_app_id)
      if (!application) return null
      return {
        p_app_id,
        p_name_nl: application.p_name_nl ?? "Onbekende meststof",
        amount: application.p_app_amount_display,
        unit: application.p_app_amount_unit,
        date: toFdmDateString(date ?? application.p_app_date),
      }
    }

    const planFields = proposal.fields.filter((field) => !fieldById.get(field.b_id)?.b_bufferstrip)

    // Remaining nutrient advice for fields without a proposal and without applications
    const adviceFields = planFields.filter(
      (field) => !field.fertilizerTemplate && field.existingApplications === 0,
    )
    const adviceRows = new Map<string, FarmNutrientAdviceRow>()
    const adviceInput = adviceFields.flatMap((field) => {
      const details = fieldById.get(field.b_id)
      return details
        ? [
            {
              b_id: details.b_id,
              b_name: details.b_name,
              b_area: details.b_area,
              b_centroid: details.b_centroid,
              b_bufferstrip: details.b_bufferstrip,
            },
          ]
        : []
    })
    if (adviceInput.length > 0) {
      const rows = await Promise.all(
        startFarmNutrientAdviceRows({
          fdm,
          principal_id: session.principal_id,
          b_id_farm,
          year,
          timeframe: targetTimeframe,
          fields: adviceInput,
          nmiApiKey: getNmiApiKey(),
        }),
      )
      for (const row of rows) adviceRows.set(row.b_id, row)
    }

    const rows: FertilizerRow[] = planFields.map((field) => {
      const existing = (applicationsByField.get(field.b_id) ?? [])
        .filter(
          (application) =>
            application.p_app_date.getTime() >= targetTimeframe.start.getTime() &&
            application.p_app_date.getTime() <= targetTimeframe.end.getTime(),
        )
        .sort((a, b) => a.p_app_date.getTime() - b.p_app_date.getTime())
        .flatMap((application) => toItem(application.p_app_id) ?? [])
      const template = field.fertilizerTemplate
      const advice = adviceRows.get(field.b_id)
      return {
        b_id: field.b_id,
        b_name: field.b_name,
        mainCrop: field.current?.b_lu_name ?? null,
        existing,
        template: template
          ? {
              b_id: template.b_id,
              b_name: nameById.get(template.b_id) ?? fieldById.get(template.b_id)?.b_name ?? "",
              year: template.year,
              sameField: template.b_id === field.b_id,
              applications: template.applications.flatMap(
                (application) => toItem(application.p_app_id, application.p_app_date) ?? [],
              ),
            }
          : null,
        advice:
          advice && !advice.error
            ? {
                N: advice.values.N?.remaining,
                P: advice.values.P?.remaining,
                K: advice.values.K?.remaining,
              }
            : null,
        adviceError: advice !== undefined && advice.error !== undefined,
      }
    })

    // Filling of the legal norms of the farm (provisional for a year without own norms)
    const norms = await getPlanNormsSummary(fdm, session.principal_id, b_id_farm, year, fields)

    return {
      b_id_farm,
      year,
      rows,
      bufferstrips: proposal.fields.length - planFields.length,
      norms,
      canWrite,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Copies the proposed fertilizer applications to the target year for the selected fields:
 * the applications of the same field when its crop is unchanged, otherwise those of the most
 * recent field and year with the same crop.
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
    if (formData.get("intent") !== "copy_fertilizer_applications") {
      throw data("Ongeldige actie", { status: 400 })
    }

    const proposal = await getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year)
    const failed: string[] = []
    let copiedFields = 0
    let copiedApplications = 0
    for (const field of proposal.fields) {
      const template = field.fertilizerTemplate
      if (!template || formData.get(`copy.${field.b_id}`) !== "on") continue
      try {
        const inserted = await copyFertilizerApplications(
          fdm,
          session.principal_id,
          template.b_id,
          field.b_id,
          template.year,
          year,
          template.applications.map((application) => application.p_app_id),
        )
        if (inserted.length > 0) copiedFields++
        copiedApplications += inserted.length
      } catch (error) {
        console.warn(`[plan-next] Copying fertilizer applications to ${field.b_id} failed:`, error)
        failed.push(field.b_name)
      }
    }

    if (failed.length > 0) {
      return dataWithError(
        null,
        `Niet gelukt voor: ${failed.join(", ")}. De andere percelen zijn opgeslagen; probeer het opnieuw.`,
      )
    }
    return redirectWithSuccess(
      getPlanNextPath(b_id_farm, year, "harvests"),
      copiedApplications > 0
        ? `${copiedApplications} ${copiedApplications === 1 ? "bemesting" : "bemestingen"} overgenomen op ${copiedFields} ${copiedFields === 1 ? "perceel" : "percelen"}.`
        : "Er waren geen bemestingen om over te nemen.",
    )
  } catch (error) {
    return handleActionError(error)
  }
}

/** Formats an application as one line of text. */
function formatApplication(application: ApplicationItem): string {
  const amount =
    application.amount !== null ? `${formatNumber(application.amount, 1)} ${application.unit}` : ""
  return `${formatDate(application.date)} · ${application.p_name_nl}${amount ? ` · ${amount}` : ""}`
}

/** Step 6: the fertilizer plan of each field and the filling of the legal norms. */
export default function PlanNextFertilizers() {
  const { b_id_farm, year, rows, bufferstrips, norms, canWrite } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const step = getPlanNextStep("fertilizers")
  const isSaving = navigation.state === "submitting"

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>

      <PlanNextNormsCard year={year} norms={norms} />

      <Tabs defaultValue="previous">
        <TabsList>
          <TabsTrigger value="previous">Vorig jaar overnemen</TabsTrigger>
          <TabsTrigger value="gerrit">Gerrit</TabsTrigger>
        </TabsList>

        <TabsContent value="previous">
          <Form method="post" className="space-y-6">
            <input type="hidden" name="intent" value="copy_fertilizer_applications" />
            <Card>
              <CardHeader>
                <CardTitle>Bemesting per perceel</CardTitle>
                <CardDescription>{getIntroduction(year, bufferstrips)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Er zijn geen percelen in gebruik in {year}.
                  </p>
                ) : (
                  rows.map((row) => (
                    <FertilizerField
                      key={row.b_id}
                      row={row}
                      b_id_farm={b_id_farm}
                      year={year}
                      canWrite={canWrite}
                    />
                  ))
                )}
              </CardContent>
            </Card>
            <PlanNextStepFooter
              b_id_farm={b_id_farm}
              year={year}
              step="fertilizers"
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
        </TabsContent>

        <TabsContent value="gerrit">
          <Card>
            <CardHeader>
              <CardTitle>Bemestingsplan met Gerrit</CardTitle>
              <CardDescription>
                {`Gerrit, de AI-assistent, stelt een bemestingsplan voor ${year} op dat rekening houdt met het bemestingsadvies en de gebruiksnormen${norms?.provisional ? ` (voorlopig de normen van ${norms.normsYear})` : ""}. Dit kan enkele minuten duren. Let op: als u het plan van Gerrit toepast, vervangt het alle bemestingen van ${year} op dit bedrijf, ook de bemestingen die u hier hebt overgenomen. Na het toepassen komt u terug in deze stap.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <NavLink
                  to={`/farm/${b_id_farm}/${year}/gerrit?returnTo=${encodeURIComponent(getPlanNextPath(b_id_farm, year, "fertilizers"))}`}
                >
                  <span>{`Gerrit openen voor ${year}`}</span>
                </NavLink>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Returns the explanation of the copy tab. */
function getIntroduction(year: number, bufferstrips: number): string {
  const parts = [
    "Neem de bemesting van een eerder jaar over.",
    "Is het gewas gelijk aan het uitgangsjaar van het perceel, dan is dat de bemesting van hetzelfde perceel; is het gewas veranderd, dan de bemesting van het meest recente perceel met hetzelfde gewas.",
    `De data worden verschoven naar ${year}. Zonder voorbeeld blijft het plan leeg en ziet u het resterende bemestingsadvies.`,
  ]
  if (bufferstrips > 0) {
    parts.push(
      `${bufferstrips} ${bufferstrips === 1 ? "bufferstrook staat" : "bufferstroken staan"} hier niet bij.`,
    )
  }
  return parts.join(" ")
}

/** A field with its recorded and proposed applications, or the remaining nutrient advice. */
function FertilizerField({
  row,
  b_id_farm,
  year,
  canWrite,
}: {
  row: FertilizerRow
  b_id_farm: string
  year: number
  canWrite: boolean
}) {
  const hasExisting = row.existing.length > 0

  return (
    <div className="space-y-2 rounded-md border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-medium whitespace-nowrap">{row.b_name}</span>
          <span className="text-muted-foreground text-xs">
            {row.mainCrop
              ? `Hoofdteelt ${year}: ${row.mainCrop}`
              : `Nog geen hoofdteelt in ${year}`}
          </span>
        </div>
        <Button asChild size="sm" variant="ghost">
          <NavLink to={`/farm/${b_id_farm}/${year}/field/${row.b_id}/fertilizer`}>
            <span>Bemesting bewerken</span>
          </NavLink>
        </Button>
      </div>

      {hasExisting ? (
        <div className="space-y-1">
          <span className="text-xs font-medium">{`Vastgelegd voor ${year}`}</span>
          <ul className="text-muted-foreground space-y-0.5 text-xs">
            {row.existing.map((application) => (
              <li key={application.p_app_id}>{formatApplication(application)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.template ? (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              name={`copy.${row.b_id}`}
              defaultChecked={!hasExisting}
              disabled={!canWrite}
            />
            <span>
              {row.template.sameField
                ? `Bemesting van ${row.template.year} overnemen`
                : `Bemesting van ${row.template.b_name} (${row.template.year}, zelfde gewas) overnemen`}
            </span>
          </label>
          <ul className="text-muted-foreground space-y-0.5 pl-6 text-xs">
            {row.template.applications.map((application) => (
              <li key={application.p_app_id}>{formatApplication(application)}</li>
            ))}
          </ul>
        </div>
      ) : hasExisting ? null : (
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground">
            Geen eerdere bemesting met dit gewas om over te nemen.
          </span>
          {row.advice ? (
            <p className="text-xs">
              {`Resterend bemestingsadvies: ${[
                row.advice.N !== undefined ? `N ${formatNumber(row.advice.N)} kg/ha` : null,
                row.advice.P !== undefined ? `P2O5 ${formatNumber(row.advice.P)} kg/ha` : null,
                row.advice.K !== undefined ? `K2O ${formatNumber(row.advice.K)} kg/ha` : null,
              ]
                .filter(Boolean)
                .join(" · ")}`}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {row.adviceError
                ? "Het bemestingsadvies is niet beschikbaar voor dit perceel (controleer hoofdteelt en bodemgegevens)."
                : "Leg eerst de hoofdteelt vast om het bemestingsadvies te zien."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
