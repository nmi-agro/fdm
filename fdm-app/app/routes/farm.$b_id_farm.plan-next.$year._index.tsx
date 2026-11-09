import { getSeasonPlanProgress } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs, redirect } from "react-router"
import { getPlanNextPath } from "~/components/blocks/plan-next/steps"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  getCandidatePlanYears,
  getResumeStep,
  parsePlanYear,
  summarizeSeasonPlanProgress,
} from "~/lib/season-plan.server"

/** Continues the wizard of a year at the start step or at the first step that is not done. */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    // The layout validates the year for the farm; a year that can never be planned goes back to
    // the start of the wizard
    const year = parsePlanYear(params.year, getCandidatePlanYears())
    if (year === null) {
      return redirect(getPlanNextPath(b_id_farm))
    }
    const session = await getSession(request)
    const progress = await getSeasonPlanProgress(fdm, session.principal_id, b_id_farm, year)
    return redirect(
      getPlanNextPath(b_id_farm, year, getResumeStep(summarizeSeasonPlanProgress(progress))),
    )
  } catch (error) {
    throw handleLoaderError(error)
  }
}
