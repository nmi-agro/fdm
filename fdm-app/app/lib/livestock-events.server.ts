/**
 * Saving the quick livestock entries that several Melkvee pages offer: adding an animal
 * (`AddAnimalDialog`) and changing herds (`HerdCard`: count, name, moving and removing).
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
    if (targetCount > previousCount) {
      const toAdd = targetCount - previousCount
      await addAnimalsToHerd(fdm, principal_id, l_id_herd, toAdd)
      return dataWithSuccess(
        { targetCount },
        { message: `${toAdd} ${toAdd === 1 ? "dier" : "dieren"} toegevoegd.` },
      )
    }
    if (targetCount < previousCount) {
      const toRemove = previousCount - targetCount
      await removeAnimalsFromHerd(fdm, principal_id, l_id_herd, toRemove, {
        l_leaving_method: "sold",
      })
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
      Number.parseInt(formText(formData, "count", "0"), 10),
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
