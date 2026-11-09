import { data, type LoaderFunctionArgs, redirect } from "react-router"
import { redirectWithWarning } from "remix-toast"
import { getPlanNextPath } from "~/components/blocks/plan-next/steps"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getResumeStep, getSeasonPlanEntry } from "~/lib/season-plan.server"

/**
 * Opens the season planning wizard: resolves the year to plan and continues at the start step
 * (nothing recorded yet) or at the first step that is not done.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    const session = await getSession(request)

    const entry = await getSeasonPlanEntry(fdm, session.principal_id, b_id_farm)
    if (!entry) {
      return redirectWithWarning(
        `/farm/${b_id_farm}`,
        "Er zijn nog geen percelen met gewassen om een seizoen op te baseren. Voeg eerst percelen en gewassen toe.",
      )
    }
    return redirect(getPlanNextPath(b_id_farm, entry.summary.year, getResumeStep(entry.summary)))
  } catch (error) {
    throw handleLoaderError(error)
  }
}
