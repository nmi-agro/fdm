/**
 * Saving the quick livestock entries that several Melkvee pages offer: adding an animal
 * (`AddAnimalDialog`), adding a herd (`AddHerdDialog`) and changing herds (`HerdCard`: count,
 * name, moving and removing).
 */

import {
  addAnimal,
  addAnimalsToHerd,
  createHerdWithAnimals,
  reassignHerdAnimals,
  removeAnimalsFromHerd,
  removeHerd,
  updateHerd,
} from "@nmi-agro/fdm-core"
import { data } from "react-router"
import { dataWithSuccess } from "remix-toast"
import { fdm } from "~/lib/fdm.server"
import { formText } from "~/lib/form"
import { farmTodayKey } from "~/lib/grazing-dates"
import { serverNow } from "~/lib/server-now.server"

/** The most animals that one change may add, as the forms allow. */
const MAX_ANIMALS_PER_CHANGE = 5000

/**
 * The number of animals to add, from a submitted text: a whole number from 1 to 5000. The forms
 * limit the input too, but a request can bypass them, and a very large number would build that
 * many rows at once.
 *
 * @param value - The submitted number.
 * @returns The number of animals.
 * @throws A 400 response for any other value.
 */
export function parseAnimalCount(value: string): number {
  const count = Number(value)
  if (!Number.isInteger(count) || count < 1 || count > MAX_ANIMALS_PER_CHANGE) {
    throw data(`Het aantal dieren moet tussen 1 en ${MAX_ANIMALS_PER_CHANGE} liggen.`, {
      status: 400,
    })
  }
  return count
}

/**
 * The arrival of new animals (of a new herd, or added to a herd), from the submitted day
 * `l_arriving_date`
 * (`YYYY-MM-DD`). Today is recorded as now, another day as the start of that day (midnight UTC,
 * like the other date-only livestock dates). Without a day the animals arrive now.
 *
 * @param formData - The submitted form data.
 * @returns The arrival moment.
 * @throws A 400 response for an invalid day or a day in the future.
 */
export function parseHerdArrival(formData: FormData): Date {
  const now = serverNow()
  const dayKey = formText(formData, "l_arriving_date")
  const todayKey = farmTodayKey(now)
  if (!dayKey || dayKey === todayKey) return now
  const date = new Date(`${dayKey}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || Number.isNaN(date.getTime())) {
    throw data("Kies een geldige datum voor 'Aanwezig sinds'.", { status: 400 })
  }
  if (dayKey > todayKey) {
    throw data("'Aanwezig sinds' kan niet in de toekomst liggen.", { status: 400 })
  }
  return date
}

const LIVESTOCK_INTENTS = [
  "add_animal",
  "update_count",
  "add_herd",
  "update_herd",
  "reassign_herd",
  "remove_herd",
]

/** Whether an intent is one of the livestock entries. */
export function isLivestockIntent(intent: unknown): boolean {
  return typeof intent === "string" && LIVESTOCK_INTENTS.includes(intent)
}

/**
 * Saves a livestock entry. Access is checked by the fdm-core functions.
 *
 * @param formData - The submitted form data with its `intent`.
 * @param context - The acting principal and the farm.
 * @returns A toast response, or `{ success: true }` when a count did not change.
 */
export async function handleLivestockEvent(
  formData: FormData,
  context: { principal_id: string; b_id_farm: string },
) {
  const { principal_id, b_id_farm } = context
  const intent = formText(formData, "intent")

  if (intent === "add_animal") {
    const l_id_herd = formText(formData, "l_id_herd")
    const birthDateVal = formText(formData, "l_birth_date")
    const newId = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: formText(formData, "l_id_eartag") || undefined,
      l_id_worknumber: formText(formData, "l_id_worknumber") || undefined,
      l_birth_date: birthDateVal ? new Date(birthDateVal) : undefined,
      l_sex: (formData.get("l_sex") as "female" | "male" | null) ?? "female",
      l_arriving_method: "born",
    })
    return dataWithSuccess({ newId }, { message: "Dier succesvol toegevoegd." })
  }

  if (intent === "update_count") {
    const l_id_herd = formText(formData, "l_id_herd")
    const targetCount = Number.parseInt(formText(formData, "target_count", "0"), 10)
    const previousCount = Number.parseInt(formText(formData, "previous_count", "0"), 10)
    // The change is the difference with the count the user saw; fdm-core refuses it when the
    // herd no longer holds that count, for example after a change in another tab
    const options = { expected_count: previousCount }
    if (targetCount > previousCount) {
      const toAdd = parseAnimalCount(String(targetCount - previousCount))
      await addAnimalsToHerd(
        fdm,
        principal_id,
        l_id_herd,
        toAdd,
        { l_arriving_date: parseHerdArrival(formData) },
        options,
      )
      return dataWithSuccess(
        { targetCount },
        { message: `${toAdd} ${toAdd === 1 ? "dier" : "dieren"} toegevoegd.` },
      )
    }
    if (targetCount < previousCount) {
      const toRemove = previousCount - targetCount
      await removeAnimalsFromHerd(
        fdm,
        principal_id,
        l_id_herd,
        toRemove,
        { l_leaving_method: "sold" },
        options,
      )
      return dataWithSuccess(
        { targetCount },
        { message: `${toRemove} ${toRemove === 1 ? "dier" : "dieren"} afgevoerd.` },
      )
    }
    return { success: true }
  }

  if (intent === "add_herd") {
    const l_herd_name = formText(formData, "l_herd_name", "Koppel").trim()
    const l_id_category = formText(formData, "l_id_category")
    if (!l_id_category) {
      throw data("Kies een diercategorie", { status: 400 })
    }
    await createHerdWithAnimals(
      fdm,
      principal_id,
      b_id_farm,
      { l_herd_name, l_id_category },
      parseAnimalCount(formText(formData, "count")),
      { l_arriving_date: parseHerdArrival(formData) },
    )
    return dataWithSuccess({ l_herd_name }, { message: `Koppel ${l_herd_name} aangemaakt.` })
  }

  if (intent === "update_herd") {
    await updateHerd(fdm, principal_id, formText(formData, "l_id_herd"), {
      l_herd_name: formText(formData, "l_herd_name").trim(),
    })
    return dataWithSuccess({}, { message: "Koppelnaam bijgewerkt." })
  }

  if (intent === "reassign_herd") {
    await reassignHerdAnimals(
      fdm,
      principal_id,
      formText(formData, "source_l_id_herd"),
      formText(formData, "target_l_id_herd"),
    )
    return dataWithSuccess({}, { message: "Dieren succesvol overgezet naar de nieuwe koppel." })
  }

  if (intent === "remove_herd") {
    await removeHerd(fdm, principal_id, formText(formData, "l_id_herd"))
    return dataWithSuccess({}, { message: "Koppel verwijderd." })
  }

  throw data("Ongeldige actie", { status: 400 })
}
