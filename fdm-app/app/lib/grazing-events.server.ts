/**
 * Adding, changing and removing a grazing from the grazing dialog (`GrazingPopover`), the same on
 * every page that offers it: the grazing calendar, the Atlas layer Beweiding and the grazing page
 * of a field.
 */

import { addGrazing, removeGrazing, updateGrazing } from "@nmi-agro/fdm-core"
import { data } from "react-router"
import { dataWithSuccess } from "remix-toast"
import { fdm } from "~/lib/fdm.server"
import { formText } from "~/lib/form"
import {
  GRAZING_AREA_FIELD,
  GRAZING_ZONE_FIELD,
  parseGrazingDate,
  parseGrazingExtent,
  parseGrazingHours,
} from "~/lib/grazing-zone"

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
 * @throws {Response} With status 400 for an unknown intent or an invalid date, hours or extent.
 */
export async function handleGrazingEvent(
  formData: FormData,
  context: { principal_id: string; calendar: string },
) {
  const intent = formText(formData, "intent")
  const l_grazing_hours = parseGrazingHours(formText(formData, "l_grazing_hours"))
  const l_grazing_start = parseGrazingDate(formText(formData, "l_grazing_start"))
  const l_grazing_end = parseGrazingDate(formText(formData, "l_grazing_end"))

  if (intent === "add_grazing") {
    const b_id = formText(formData, "b_id")
    // A grazing is always on a field; fdm-core allows an unknown field, the app does not
    if (!b_id) {
      throw data("Kies een perceel", { status: 400 })
    }
    if (!l_grazing_start) {
      throw data("Kies een datum", { status: 400 })
    }
    await addGrazing(fdm, context.principal_id, formText(formData, "l_id_herd"), l_grazing_start, {
      b_id,
      // Without an end date the grazing runs until it gets one
      l_grazing_end,
      l_grazing_hours,
      ...parseGrazingExtent(formData),
    })
    // Only the first grazing of a year turns grazing on, so the message does not claim it
    return dataWithSuccess({}, { message: "Beweiding vastgelegd." })
  }

  if (intent === "update_grazing") {
    const extent = parseGrazingExtent(formData)
    await updateGrazing(fdm, context.principal_id, formText(formData, "l_id_grazing"), {
      l_grazing_start,
      // An empty end keeps the stored end, so a grazing that still runs keeps running
      l_grazing_end,
      // Hours that are not sent stay as they are
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
    await removeGrazing(fdm, context.principal_id, formText(formData, "l_id_grazing"))
    return dataWithSuccess({}, { message: "Beweiding verwijderd." })
  }

  throw data("Ongeldige actie", { status: 400 })
}
