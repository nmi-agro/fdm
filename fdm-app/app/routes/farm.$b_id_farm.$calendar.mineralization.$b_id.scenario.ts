import { getMineralizationScenarioSchema } from "@nmi-agro/fdm-calculator"
import { data, type LoaderFunctionArgs } from "react-router"
import type { FieldMineralizationOutcome } from "~/lib/mineralization"
import { calculateScenario, getMineralizationYear } from "~/integrations/mineralization.server"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"

/**
 * Calculates a what-if scenario for a field without saving it.
 *
 * The scenario is passed as JSON in the `scenario` search parameter and echoed back as `key`.
 * Problems with the scenario or the calculation are returned as an outcome with
 * `status: "error"`, so the page keeps working.
 */
export async function loader({ request, params, url }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const b_id = params.b_id
    if (!b_id_farm || !b_id) {
      throw data("invalid: b_id_farm or b_id", { status: 400 })
    }
    const session = await getSession(request)
    const year = getMineralizationYear(params.calendar)

    const invalid: FieldMineralizationOutcome = {
      b_id,
      b_name: null,
      b_area: null,
      status: "error",
      message: "Het scenario is niet compleet: controleer de datums en hoeveelheden.",
    }
    // The key lets the page ignore results of an earlier version of the scenario
    const key = url.searchParams.get("scenario") ?? ""
    let raw: unknown
    try {
      raw = JSON.parse(key)
    } catch {
      return { key, outcome: invalid }
    }
    const parsed = getMineralizationScenarioSchema(year).safeParse(raw)
    if (!parsed.success) {
      // Show the rule that was broken (e.g. harvests too close together) when there is one
      const message = parsed.error.issues.find((issue) => issue.code === "custom")?.message
      return { key, outcome: message ? { ...invalid, message } : invalid }
    }

    const outcome = await calculateScenario({
      principal_id: session.principal_id,
      b_id_farm,
      b_id,
      year,
      scenario: parsed.data,
    })
    return { key, outcome }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}
