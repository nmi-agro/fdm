import {
  addHarvest,
  checkPermission,
  findHoofdteelt,
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getDefaultsForHarvestParameters,
  getFields,
  getHarvestsForFarm,
  getSeasonPlanProgress,
  getSeasonPlanProposal,
  type Harvest,
  shiftDateToYear,
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
import { dataWithError, dataWithSuccess } from "remix-toast"
import { PlanNextNormsCard } from "~/components/blocks/plan-next/norms-card"
import { PlanNextStepFooter } from "~/components/blocks/plan-next/step-footer"
import {
  getPlanNextPath,
  getPlanNextStep,
  PLAN_NEXT_STEPS,
} from "~/components/blocks/plan-next/steps"
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
import { getNitrogenBalanceForFarm } from "~/integrations/calculator"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  getCandidatePlanYears,
  getPlanNormsSummary,
  parsePlanYear,
  summarizeSeasonPlanProgress,
} from "~/lib/season-plan.server"

/** A harvest as shown in the step. */
type HarvestItem = {
  b_id_harvesting: string
  /** Date (YYYY-MM-DD), or `null`. */
  date: string | null
  /** Dry matter yield (kg DS/ha), or `null`. */
  yield: number | null
}

/** A field with the harvests of its main cultivation in the target year. */
type HarvestRow = {
  b_id: string
  b_name: string
  b_lu: string
  b_lu_name: string
  harvests: HarvestItem[]
  /** Whether a harvest is expected but none is recorded yet. */
  missing: boolean
  /** Number of harvests of the year before that will be copied, or 0 for the catalogue default. */
  copyCount: number
}

/** Nitrogen balance figures of the farm (kg N/ha) for one year. */
type BalanceFigures = { balance: number; ammonia: number; nitrate: number }

/** Timeframe of a calendar year in Europe/Amsterdam. */
function yearTimeframe(year: number) {
  return {
    start: startOfDayInFdmTimeZone(year, 1, 1),
    end: new Date(startOfDayInFdmTimeZone(year + 1, 1, 1).getTime() - 1),
  }
}

/** Returns whether a moment lies within a timeframe. */
function isWithin(date: Date | null, timeframe: { start: Date; end: Date }): boolean {
  return (
    date !== null &&
    date.getTime() >= timeframe.start.getTime() &&
    date.getTime() <= timeframe.end.getTime()
  )
}

/** The analysis values of a harvest that are copied to the target year. */
function getHarvestProperties(harvest: Harvest) {
  const analysis = harvest.harvestable.harvestable_analyses[0]
  if (!analysis) return {}
  const keys = [
    "b_lu_yield",
    "b_lu_yield_bruto",
    "b_lu_yield_fresh",
    "b_lu_tarra",
    "b_lu_dm",
    "b_lu_moist",
    "b_lu_uww",
    "b_lu_cp",
    "b_lu_n_harvestable",
    "b_lu_n_residue",
    "b_lu_p_harvestable",
    "b_lu_p_residue",
    "b_lu_k_harvestable",
    "b_lu_k_residue",
  ] as const
  const properties: Partial<Record<(typeof keys)[number], number>> = {}
  for (const key of keys) {
    const value = (analysis as unknown as Partial<Record<(typeof keys)[number], number | null>>)[
      key
    ]
    if (typeof value === "number") properties[key] = value
  }
  return properties
}

/**
 * Loads the harvests of the main cultivations of the target year and the overview of the plan:
 * progress per step, filling of the legal norms, nitrogen balance compared to the year before,
 * and the points that need attention.
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
    const target = yearTimeframe(year)
    const both = { start: yearTimeframe(year - 1).start, end: target.end }

    const [progress, proposal, fields, cultivationsByField, harvestsByCultivation, canWrite] =
      await Promise.all([
        getSeasonPlanProgress(fdm, session.principal_id, b_id_farm, year),
        getSeasonPlanProposal(fdm, session.principal_id, b_id_farm, year),
        getFields(fdm, session.principal_id, b_id_farm, target),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, both),
        getHarvestsForFarm(fdm, session.principal_id, b_id_farm, both),
        checkPermission(fdm, "farm", "write", b_id_farm, session.principal_id, url.pathname, false),
      ])
    const summary = summarizeSeasonPlanProgress(progress)
    const missingHarvests = new Set(
      progress.steps.find((step) => step.step === "harvests")?.pending ?? [],
    )

    const rows: HarvestRow[] = proposal.fields.flatMap((field) => {
      const cultivations = cultivationsByField.get(field.b_id) ?? []
      const main = findHoofdteelt(cultivations, year, true)
      if (!main || main.b_lu_harvestable === "none") return []
      const harvests = harvestsByCultivation.get(main.b_lu) ?? []
      const previousMain = findHoofdteelt(cultivations, year - 1, true)
      const previousHarvests =
        previousMain?.b_lu === main.b_lu
          ? harvests.filter((harvest) =>
              isWithin(harvest.b_lu_harvest_date, yearTimeframe(year - 1)),
            )
          : []
      return [
        {
          b_id: field.b_id,
          b_name: field.b_name,
          b_lu: main.b_lu,
          b_lu_name: main.b_lu_name,
          harvests: harvests
            .filter((harvest) => isWithin(harvest.b_lu_harvest_date, target))
            .sort(
              (a, b) =>
                (a.b_lu_harvest_date?.getTime() ?? 0) - (b.b_lu_harvest_date?.getTime() ?? 0),
            )
            .map((harvest) => ({
              b_id_harvesting: harvest.b_id_harvesting,
              date: harvest.b_lu_harvest_date ? toFdmDateString(harvest.b_lu_harvest_date) : null,
              yield: harvest.harvestable.harvestable_analyses[0]?.b_lu_yield ?? null,
            })),
          missing: missingHarvests.has(main.b_lu),
          copyCount: previousHarvests.length,
        },
      ]
    })

    // Points that need attention
    const fieldNames = new Map(proposal.fields.map((field) => [field.b_id, field.b_name]))
    const expiredMeasures = proposal.fields.flatMap((field) =>
      field.measures.expiring.map((measure) => `${measure.m_name} (${field.b_name})`),
    )
    const namesOf = (step: string) =>
      (progress.steps.find((s) => s.step === step)?.pending ?? []).map(
        (b_id) => fieldNames.get(b_id) ?? b_id,
      )
    const withoutCatchCrop = (
      progress.steps.find((step) => step.step === "catch_crops")?.notices ?? []
    ).map((b_id) => fieldNames.get(b_id) ?? b_id)

    // Nitrogen balance of the farm compared to the year before
    const getBalance = async (balanceYear: number): Promise<BalanceFigures | null> => {
      try {
        const result = await getNitrogenBalanceForFarm({
          fdm,
          principal_id: session.principal_id,
          b_id_farm,
          timeframe: yearTimeframe(balanceYear),
        })
        return {
          balance: result.balance,
          ammonia: result.emission.ammonia.total,
          nitrate: result.emission.nitrate,
        }
      } catch (error) {
        console.warn(`[plan-next] Nitrogen balance ${balanceYear} could not be calculated:`, error)
        return null
      }
    }
    const [norms, balanceTarget, balancePrevious] = await Promise.all([
      getPlanNormsSummary(fdm, session.principal_id, b_id_farm, year, fields),
      getBalance(year),
      getBalance(year - 1),
    ])

    return {
      b_id_farm,
      year,
      rows,
      summary,
      norms,
      balance: { target: balanceTarget, previous: balancePrevious },
      attention: {
        fieldsWithoutCrop: namesOf("cultivations"),
        fieldsWithoutFertilizer: namesOf("fertilizers"),
        requiredCatchCrops: namesOf("catch_crops"),
        withoutCatchCrop,
        expiredMeasures,
      },
      canWrite,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Adds the missing harvests of the main cultivations of the target year: a cultivation that
 * continues from the year before (such as grassland) gets the harvests of that year with their
 * values, moved to the target year; other cultivations get one harvest with the standard values
 * of the cultivation catalogue. The values can be changed on the harvest page afterwards.
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
    if (formData.get("intent") !== "add_missing_harvests") {
      throw data("Ongeldige actie", { status: 400 })
    }

    const target = yearTimeframe(year)
    const both = { start: yearTimeframe(year - 1).start, end: target.end }
    const [progress, cultivationsByField, harvestsByCultivation, catalogue] = await Promise.all([
      getSeasonPlanProgress(fdm, session.principal_id, b_id_farm, year),
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, both),
      getHarvestsForFarm(fdm, session.principal_id, b_id_farm, both),
      getCultivationsFromCatalogue(fdm, session.principal_id, b_id_farm),
    ])
    const missing = new Set(progress.steps.find((step) => step.step === "harvests")?.pending ?? [])

    let added = 0
    const failed: string[] = []
    for (const [, cultivations] of cultivationsByField) {
      const main = findHoofdteelt(cultivations, year, true)
      if (!main || !missing.has(main.b_lu)) continue
      try {
        const previousMain = findHoofdteelt(cultivations, year - 1, true)
        const previousHarvests =
          previousMain?.b_lu === main.b_lu
            ? (harvestsByCultivation.get(main.b_lu) ?? []).filter((harvest) =>
                isWithin(harvest.b_lu_harvest_date, yearTimeframe(year - 1)),
              )
            : []
        if (previousHarvests.length > 0) {
          for (const harvest of previousHarvests) {
            if (!harvest.b_lu_harvest_date) continue
            await addHarvest(
              fdm,
              session.principal_id,
              main.b_lu,
              shiftDateToYear(harvest.b_lu_harvest_date, year),
              getHarvestProperties(harvest),
            )
            added++
          }
          continue
        }

        // One harvest with the standard values of the catalogue
        const entry = catalogue.find((item) => item.b_lu_catalogue === main.b_lu_catalogue)
        const [month, day] = (entry?.b_date_harvest_default ?? "09-15").split("-").map(Number)
        const date = isWithin(main.b_lu_end, target)
          ? (main.b_lu_end as Date)
          : startOfDayInFdmTimeZone(year, month, day)
        await addHarvest(
          fdm,
          session.principal_id,
          main.b_lu,
          date,
          getDefaultsForHarvestParameters(main.b_lu_catalogue, catalogue),
        )
        added++
      } catch (error) {
        console.warn(`[plan-next] Adding the harvest of ${main.b_lu} failed:`, error)
        failed.push(main.b_lu_name)
      }
    }

    if (failed.length > 0) {
      return dataWithError(
        null,
        `${added} ${added === 1 ? "oogst" : "oogsten"} toegevoegd. Niet gelukt voor: ${failed.join(", ")}.`,
      )
    }
    return dataWithSuccess(
      null,
      added > 0
        ? `${added} ${added === 1 ? "oogst" : "oogsten"} toegevoegd voor ${year}.`
        : "Er ontbraken geen oogsten.",
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

/** Formats a number with Dutch number formatting. */
function formatNumber(value: number): string {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 0 })
}

/** Step 7: expected harvests and the overview of the plan. */
export default function PlanNextHarvests() {
  const { b_id_farm, year, rows, summary, norms, balance, attention, canWrite } =
    useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const step = getPlanNextStep("harvests")
  const isSaving = navigation.state === "submitting"
  const missingCount = rows.filter((row) => row.missing).length

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verwachte oogst {year}</CardTitle>
          <CardDescription>
            {`Ontbrekende oogsten worden aangevuld met de oogsten van ${year - 1} bij doorlopende teelten, zoals grasland, en anders met de standaardopbrengst uit de gewascatalogus. Pas de verwachte opbrengst daarna aan op de oogstpagina.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Er zijn geen hoofdteelten met een oogst in {year}. Leg eerst de gewassen vast.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perceel</TableHead>
                  <TableHead>Hoofdteelt</TableHead>
                  <TableHead>Oogsten {year}</TableHead>
                  <TableHead className="text-right">Actie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.b_id} className="align-top">
                    <TableCell className="font-medium whitespace-nowrap">{row.b_name}</TableCell>
                    <TableCell>{row.b_lu_name}</TableCell>
                    <TableCell>
                      {row.harvests.length > 0 ? (
                        <ul className="space-y-0.5 text-xs">
                          {row.harvests.map((harvest) => (
                            <li key={harvest.b_id_harvesting}>
                              {`${formatDate(harvest.date)} · ${harvest.yield !== null ? `${formatNumber(harvest.yield)} kg DS/ha` : "geen opbrengst"}`}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {row.copyCount > 0
                            ? `Wordt aangevuld met ${row.copyCount} ${row.copyCount === 1 ? "oogst" : "oogsten"} van ${year - 1}`
                            : "Wordt aangevuld met de standaardopbrengst"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <NavLink
                          to={`/farm/${b_id_farm}/${year}/field/${row.b_id}/cultivation/${row.b_lu}`}
                        >
                          <span>Oogst bewerken</span>
                        </NavLink>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {canWrite && missingCount > 0 ? (
            <Form method="post">
              <input type="hidden" name="intent" value="add_missing_harvests" />
              <Button type="submit" disabled={isSaving}>
                <span key={isSaving ? "saving" : "idle"}>
                  {isSaving
                    ? "Aanvullen..."
                    : `Ontbrekende oogsten aanvullen (${missingCount} ${missingCount === 1 ? "perceel" : "percelen"})`}
                </span>
              </Button>
            </Form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overzicht {year}</CardTitle>
          <CardDescription>
            {summary.complete
              ? `Het plan voor ${year} is compleet. U kunt elke stap blijven aanpassen.`
              : `Het plan voor ${year} heeft nog ${summary.openItems} open ${summary.openItems === 1 ? "punt" : "punten"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-border divide-y text-sm">
            {PLAN_NEXT_STEPS.map((planStep, index) => {
              const progress = summary.steps.find((s) => s.step === planStep.key)
              return (
                <li key={planStep.key} className="flex items-center justify-between gap-2 py-2">
                  <NavLink
                    to={getPlanNextPath(b_id_farm, year, planStep.key)}
                    className="hover:underline"
                  >
                    {`${index + 1}. ${planStep.title}`}
                  </NavLink>
                  <Badge
                    key={progress?.done ? "done" : "open"}
                    variant={progress?.done ? "secondary" : "outline"}
                  >
                    {progress?.done ? "Klaar" : `${progress?.pending ?? 0} open`}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <PlanNextNormsCard year={year} norms={norms} />

      <Card>
        <CardHeader>
          <CardTitle>Stikstofbalans</CardTitle>
          <CardDescription>
            {`Gemiddeld over het bedrijf, ${year} vergeleken met ${year - 1}, op basis van de vastgelegde gegevens.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {balance.target || balance.previous ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>kg N/ha</TableHead>
                  <TableHead className="text-right">{year - 1}</TableHead>
                  <TableHead className="text-right">{year}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    ["Balans", "balance"],
                    ["Ammoniakemissie", "ammonia"],
                    ["Nitraatuitspoeling", "nitrate"],
                  ] as const
                ).map(([label, key]) => (
                  <TableRow key={key}>
                    <TableCell>{label}</TableCell>
                    <TableCell className="text-right">
                      {balance.previous ? formatNumber(balance.previous[key]) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {balance.target ? formatNumber(balance.target[key]) : "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              De stikstofbalans kon niet worden berekend. Bekijk de details op de pagina
              Stikstofbalans.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aandachtspunten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {getAttentionLines(year, attention).length === 0 ? (
            <p className="text-muted-foreground">Geen aandachtspunten.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {getAttentionLines(year, attention).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline">
              <NavLink to={`/farm/${b_id_farm}/bemestingsplan`}>
                <span>Bemestingsplan (PDF)</span>
              </NavLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      <PlanNextStepFooter b_id_farm={b_id_farm} year={year} step="harvests" />
    </div>
  )
}

/** Returns the points that need attention as lines of text. */
function getAttentionLines(
  year: number,
  attention: {
    fieldsWithoutCrop: string[]
    fieldsWithoutFertilizer: string[]
    requiredCatchCrops: string[]
    withoutCatchCrop: string[]
    expiredMeasures: string[]
  },
): string[] {
  const lines: string[] = []
  if (attention.fieldsWithoutCrop.length > 0) {
    lines.push(`Geen hoofdteelt in ${year}: ${attention.fieldsWithoutCrop.join(", ")}.`)
  }
  if (attention.fieldsWithoutFertilizer.length > 0) {
    lines.push(`Nog geen bemesting in ${year}: ${attention.fieldsWithoutFertilizer.join(", ")}.`)
  }
  if (attention.requiredCatchCrops.length > 0) {
    lines.push(`Verplicht vanggewas ontbreekt: ${attention.requiredCatchCrops.join(", ")}.`)
  }
  if (attention.withoutCatchCrop.length > 0) {
    lines.push(
      `Geen vanggewas of groenbemester na de hoofdteelt: ${attention.withoutCatchCrop.join(", ")}. Op zand- en lössgrond kan dit een korting op de stikstofgebruiksnorm van ${year + 1} geven.`,
    )
  }
  if (attention.expiredMeasures.length > 0) {
    lines.push(
      `Verlopen en niet verlengd (vervallen in ${year}): ${attention.expiredMeasures.join(", ")}.`,
    )
  }
  return lines
}
