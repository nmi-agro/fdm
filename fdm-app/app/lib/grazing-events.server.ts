/**
 * Adding, changing and removing a grazing from the grazing dialog (`GrazingPopover`), the same on
 * every page that offers it: the grazing calendar, the Atlas layer Beweiding and the grazing page
 * of a field.
 */

import { addGrazing, removeGrazing, updateGrazing } from "@nmi-agro/fdm-core"
import { data } from "react-router"
import { dataWithSuccess } from "remix-toast"
import { fdm } from "~/lib/fdm.server"
import { GRAZING_AREA_FIELD, GRAZING_ZONE_FIELD, parseGrazingExtent } from "~/lib/grazing-zone"

const GRAZING_INTENTS = ["add_grazing", "update_grazing", "remove_grazing"]

/** Whether an intent is one of the grazing dialog. */
export function isGrazingIntent(intent: unknown): boolean {
  return typeof intent === "string" && GRAZING_INTENTS.includes(intent)
}

/**
 * Saves the grazing dialog. Access is checked by the fdm-core functions.
 *
 * @param formData - The form data of the dialog.
 * @param context - The acting principal and the calendar year of the page.
 * @returns A toast response.
 * @throws {Response} With status 400 for an unknown intent.
 */
export async function handleGrazingEvent(
  formData: FormData,
  context: { principal_id: string; calendar: string },
) {
  const intent = String(formData.get("intent") ?? "")
  const hoursVal = formData.get("l_grazing_hours")
  const l_grazing_hours = hoursVal ? Number.parseFloat(String(hoursVal)) : undefined
  const startVal = formData.get("l_grazing_start")
  const endVal = formData.get("l_grazing_end")

  if (intent === "add_grazing") {
    const b_id = String(formData.get("b_id") ?? "")
    await addGrazing(
      fdm,
      context.principal_id,
      String(formData.get("l_id_herd") ?? ""),
      new Date(String(startVal)),
      {
        b_id: b_id || undefined,
        // Without an end date the grazing runs until it gets one
        l_grazing_end: endVal ? new Date(String(endVal)) : undefined,
        l_grazing_hours,
        ...parseGrazingExtent(formData),
      },
    )
    return dataWithSuccess(
      {},
      {
        message: `Beweiding vastgelegd. Beweiding ${context.calendar} staat aan en telt mee voor de stikstofgebruiksnorm.`,
      },
    )
  }

  if (intent === "update_grazing") {
    const extent = parseGrazingExtent(formData)
    await updateGrazing(fdm, context.principal_id, String(formData.get("l_id_grazing") ?? ""), {
      l_grazing_start: startVal ? new Date(String(startVal)) : undefined,
      // An empty end keeps the stored end, so a grazing that still runs keeps running
      l_grazing_end: endVal ? new Date(String(endVal)) : undefined,
      l_grazing_hours,
      // Only change the grazed part when the form sends it
      ...(formData.has(GRAZING_ZONE_FIELD)
        ? { l_grazing_geometry_zone: extent.l_grazing_geometry_zone }
        : {}),
      ...(formData.has(GRAZING_AREA_FIELD) ? { l_grazing_area: extent.l_grazing_area } : {}),
    })
    return dataWithSuccess({}, { message: "Beweiding bijgewerkt." })
  }

  if (intent === "remove_grazing") {
    await removeGrazing(fdm, context.principal_id, String(formData.get("l_id_grazing") ?? ""))
    return dataWithSuccess({}, { message: "Beweiding verwijderd." })
  }

  throw data("Ongeldige actie", { status: 400 })
}
