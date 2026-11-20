import type { ActionFunctionArgs } from "react-router"
import { checkPermission } from "@nmi-agro/fdm-core"
import { warmFarmCalculations } from "~/integrations/farm-warmup.server"
import { getSession } from "~/lib/auth.server"
import { isSupportedYear } from "~/lib/calendar"
import { containsErrorMessage, PERMISSION_DENIED_MESSAGE, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/**
 * API route: fill the calculation cache of a farm for a calendar year, so its indicators,
 * measures, nutrient advice, usage norms and balance pages open without waiting for the
 * calculations.
 *
 * The farm dashboard posts here after it has rendered. The calculations run inside this request,
 * so they do not depend on work that continues after a response. Nobody waits for the answer,
 * so the route answers with a bare status and never sets a toast:
 *
 * - `204` when the warm-up has finished (also when some calculations failed; they are reported).
 * - `400` for a missing farm or an unsupported year, `401` without a session, `403` without
 *   read permission on the farm, `405` for another method than POST.
 *
 * Request (form): `calendar`, the year (e.g. `2026`).
 */
export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } })
  }

  const b_id_farm = params.b_id_farm
  let calendar: FormDataEntryValue | null
  try {
    calendar = (await request.formData()).get("calendar")
  } catch {
    return new Response(null, { status: 400 })
  }
  // Only the plain year, as in the routes of the calculation pages, so the inputs are the same
  if (
    !b_id_farm ||
    typeof calendar !== "string" ||
    !/^\d{4}$/.test(calendar) ||
    !isSupportedYear(Number(calendar))
  ) {
    return new Response(null, { status: 400 })
  }

  let principal_id: string
  try {
    principal_id = (await getSession(request)).principal_id
  } catch {
    return new Response(null, { status: 401 })
  }

  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "api.farm.warm")
  } catch (error) {
    if (containsErrorMessage(error, PERMISSION_DENIED_MESSAGE)) {
      return new Response(null, { status: 403 })
    }
    reportError(error, { scope: "farm-warmup" }, { b_id_farm })
    return new Response(null, { status: 500 })
  }

  await warmFarmCalculations({ principal_id, b_id_farm, calendar })
  return new Response(null, { status: 204 })
}
