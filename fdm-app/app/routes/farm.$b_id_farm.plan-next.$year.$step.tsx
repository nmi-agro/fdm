import {
  data,
  type LoaderFunctionArgs,
  NavLink,
  redirect,
  useLoaderData,
  useRouteLoaderData,
} from "react-router"
import { PlanNextStepFooter } from "~/components/blocks/plan-next/step-footer"
import {
  getPlanNextPath,
  getPlanNextStep,
  getPlanNextStepBySlug,
} from "~/components/blocks/plan-next/steps"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { handleLoaderError } from "~/lib/error"
import { getCandidatePlanYears, parsePlanYear } from "~/lib/season-plan.server"
import type { loader as layoutLoader } from "./farm.$b_id_farm.plan-next.$year"

/**
 * Pages of the regular app where the data of a step can be recorded until the step has its own
 * page in the wizard.
 */
const EXISTING_PAGES: Record<
  string,
  { label: string; path: (b_id_farm: string, year: number) => string }
> = {
  fields: { label: "Naar percelen", path: (b_id_farm, year) => `/farm/${b_id_farm}/${year}/field` },
  cultivations: {
    label: "Naar bouwplan",
    path: (b_id_farm, year) => `/farm/${b_id_farm}/${year}/rotation`,
  },
  catch_crops: {
    label: "Naar bouwplan",
    path: (b_id_farm, year) => `/farm/${b_id_farm}/${year}/rotation`,
  },
  measures: {
    label: "Naar maatregelen",
    path: (b_id_farm, year) => `/farm/${b_id_farm}/${year}/measures`,
  },
  fertilizers: {
    label: "Naar bouwplan",
    path: (b_id_farm, year) => `/farm/${b_id_farm}/${year}/rotation`,
  },
  harvests: {
    label: "Naar bouwplan",
    path: (b_id_farm, year) => `/farm/${b_id_farm}/${year}/rotation`,
  },
}

/** Validates the step of a wizard page that does not have its own route yet. */
export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    const year = parsePlanYear(params.year, getCandidatePlanYears())
    if (year === null) {
      return redirect(getPlanNextPath(b_id_farm))
    }
    const step = getPlanNextStepBySlug(params.step)
    if (!step) {
      throw data("Step not found", { status: 404, statusText: "Step not found" })
    }
    return { b_id_farm, year, stepKey: step.key }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** A step of the wizard that does not have its own page yet. */
export default function PlanNextStepPlaceholder() {
  const { b_id_farm, year, stepKey } = useLoaderData<typeof loader>()
  const layout = useRouteLoaderData<typeof layoutLoader>("routes/farm.$b_id_farm.plan-next.$year")
  const step = getPlanNextStep(stepKey)
  const progress = layout?.summary.steps.find((summary) => summary.step === stepKey)
  const existing = EXISTING_PAGES[stepKey]

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Deze stap volgt binnenkort</CardTitle>
          <CardDescription>
            Deze stap krijgt in een volgende versie een eigen pagina in de wizard. U kunt de
            gegevens voor {year} nu al vastleggen op de gewone pagina's; de wizard herkent ze
            automatisch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress ? (
            <p className="text-sm">
              {progress.done
                ? "Voor deze stap is niets meer open."
                : `Nog ${progress.pending} open ${progress.pending === 1 ? "punt" : "punten"} in deze stap.`}
            </p>
          ) : null}
          {existing ? (
            <Button asChild variant="outline">
              <NavLink to={existing.path(b_id_farm, year)}>
                <span>{existing.label}</span>
              </NavLink>
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <PlanNextStepFooter b_id_farm={b_id_farm} year={year} step={stepKey} />
    </div>
  )
}
