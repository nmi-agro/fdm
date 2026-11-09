import {
  checkPermission,
  getFarm,
  getFarms,
  getSeasonPlanProgress,
  resolveSeasonPlanTarget,
} from "@nmi-agro/fdm-core"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  useLoaderData,
} from "react-router"
import { redirectWithWarning } from "remix-toast"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderPlanNext } from "~/components/blocks/header/plan-next"
import { PlanNextStepNav } from "~/components/blocks/plan-next/step-nav"
import { getPlanNextPath } from "~/components/blocks/plan-next/steps"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { parsePlanYear, summarizeSeasonPlanProgress } from "~/lib/season-plan.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Plan volgend seizoen | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Stel het plan voor een seizoen samen op basis van eerdere jaren: percelen, gewassen, vanggewassen, maatregelen, bemesting en oogst.",
    },
  ]
}

/**
 * Loads the farm, the year to plan and the progress of each step. Redirects to the start of the
 * wizard when the year in the URL cannot be planned.
 */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    const session = await getSession(request)

    const target = await resolveSeasonPlanTarget(fdm, session.principal_id, b_id_farm)
    if (!target) {
      return redirectWithWarning(
        `/farm/${b_id_farm}`,
        "Er zijn nog geen percelen met gewassen om een seizoen op te baseren. Voeg eerst percelen en gewassen toe.",
      )
    }
    const year = parsePlanYear(params.year, target.availableYears)
    if (year === null) {
      return redirectWithWarning(
        getPlanNextPath(b_id_farm),
        `Voor ${params.year ?? "dit jaar"} kan geen seizoen worden gepland. Kies ${target.availableYears.join(" of ")}.`,
      )
    }

    const [farm, farms, progress, canWrite] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      getSeasonPlanProgress(fdm, session.principal_id, b_id_farm, year),
      checkPermission(fdm, "farm", "write", b_id_farm, session.principal_id, url.pathname, false),
    ])

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      farmOptions: farms.map((f) => ({ b_id_farm: f.b_id_farm, b_name_farm: f.b_name_farm })),
      year,
      availableYears: target.availableYears,
      summary: summarizeSeasonPlanProgress(progress),
      canWrite,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** Layout of the season planning wizard: step navigation next to the current step. */
export default function PlanNextLayout() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${loaderData.b_id_farm}`,
          label: "Terug naar bedrijf",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <HeaderPlanNext b_id_farm={loaderData.b_id_farm} />
      </Header>
      <main className="min-w-0">
        <FarmTitle
          title={`Plan volgend seizoen (${loaderData.year})`}
          description="Stel het seizoen samen op basis van eerdere jaren. Elke stap wordt apart opgeslagen, zodat u later verder kunt gaan."
        />
        <div className="space-y-6 px-2 pb-8 md:px-4 lg:px-6">
          {loaderData.canWrite ? null : (
            <Alert>
              <AlertTitle>Alleen lezen</AlertTitle>
              <AlertDescription>
                U heeft geen schrijfrechten op dit bedrijf. U kunt het plan bekijken, maar niet
                wijzigen.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col space-y-6 lg:flex-row lg:space-y-0 lg:space-x-4 xl:space-x-8">
            <aside className="shrink-0 lg:w-48 xl:w-56">
              <PlanNextStepNav
                b_id_farm={loaderData.b_id_farm}
                year={loaderData.year}
                steps={loaderData.summary.steps}
              />
            </aside>
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </SidebarInset>
  )
}
