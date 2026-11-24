/**
 * Adding, changing and removing harvests and fertilizer applications of a field from a page that
 * shows several fields over time, such as the Tijdlijn and the grazing calendar. The page action
 * parses the form with {@link FIELD_EVENT_SCHEMAS} and passes the values to
 * {@link handleFieldEvent}.
 */

import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import {
  addFertilizerApplication,
  addHarvest,
  getAppAmountDisplayRange,
  getCultivation,
  getFertilizerParametersDescription,
  getFertilizers,
  getHarvests,
  getParametersForHarvestCat,
  type HarvestParameters,
  removeFertilizerApplication,
  removeHarvest,
  updateFertilizerApplication,
  updateHarvest,
} from "@nmi-agro/fdm-core"
import { dataWithError, dataWithSuccess, dataWithWarning } from "remix-toast"
import z from "zod"
import {
  FormSchema as FertilizerApplicationFormSchema,
  FormSchemaModify as FertilizerApplicationFormSchemaModify,
} from "~/components/blocks/fertilizer-applications/formschema"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import { FormSchema as HarvestFormSchema } from "~/components/blocks/harvest/schema"
import { getEffectiveHarvestable, getHarvestTerm } from "~/components/blocks/harvest/utils"
import { captureEvent } from "~/lib/analytics.server"
import { fdm } from "~/lib/fdm.server"

/** Form schemas of the field events, to include in the page's discriminated union. */
export const FIELD_EVENT_SCHEMAS = [
  HarvestFormSchema.safeExtend({ intent: z.literal("single_harvest") }),
  HarvestFormSchema.safeExtend({ intent: z.literal("update_single_harvest") }),
  FertilizerApplicationFormSchema.safeExtend({ intent: z.literal("add_fertilizer") }),
  FertilizerApplicationFormSchemaModify.safeExtend({ intent: z.literal("update_fertilizer") }),
  z.object({ intent: z.literal("remove_harvest"), b_id_harvesting: z.string() }),
  z.object({ intent: z.literal("remove_fertilizer"), p_app_id: z.string() }),
] as const

/** Values of a field event form. */
export type FieldEventValues = z.infer<(typeof FIELD_EVENT_SCHEMAS)[number]>

/** Schema that parses only the field events, for a page whose other intents are parsed apart. */
export const FieldEventSchema = z.discriminatedUnion("intent", [...FIELD_EVENT_SCHEMAS])

const FIELD_EVENT_INTENTS: readonly string[] = FIELD_EVENT_SCHEMAS.map(
  (schema) => schema.shape.intent.value,
)

/** Whether an intent is one of the field events. */
export function isFieldEventIntent(intent: unknown): boolean {
  return typeof intent === "string" && FIELD_EVENT_INTENTS.includes(intent)
}

/** Whether parsed form values are a field event. */
export function isFieldEvent(values: { intent: string }): values is FieldEventValues {
  return isFieldEventIntent(values.intent)
}

/**
 * Saves a field event: adds, changes or removes a harvest or a fertilizer application. Access is
 * checked by the fdm-core functions. Returns a toast response; a successful save returns
 * `{ closeSheet: true }`, so the page can close its form.
 *
 * @param values - The parsed form values.
 * @param context - The acting principal, the farm and calendar of the page, and the source for
 *   analytics.
 * @returns A toast response.
 */
export async function handleFieldEvent(
  values: FieldEventValues,
  context: { principal_id: string; b_id_farm: string; calendar: string; source: string },
) {
  const { principal_id } = context

  if (values.intent === "add_fertilizer") {
    if (!values.b_id) {
      return dataWithError(null, "Er is iets fout gegaan met jouw invoer.")
    }
    await addFertilizerApplication(
      fdm,
      principal_id,
      values.b_id,
      values.p_id,
      values.p_app_amount_display,
      values.p_app_method,
      values.p_app_date,
    )
    captureEvent(principal_id, "fertilizer_application_added", {
      b_id_farm: context.b_id_farm,
      b_id: values.b_id,
      p_id: values.p_id,
      calendar: context.calendar,
      source: context.source,
    })
    return dataWithSuccess(
      { closeSheet: true },
      { message: "Bemesting succesvol toegevoegd aan het perceel." },
    )
  }

  if (values.intent === "update_fertilizer") {
    await updateFertilizerApplication(
      fdm,
      principal_id,
      values.p_app_id,
      values.p_id,
      values.p_app_amount_display,
      values.p_app_method,
      values.p_app_date,
    )
    return dataWithSuccess({ closeSheet: true }, { message: "Bemesting succesvol bijgewerkt." })
  }

  if (values.intent === "remove_fertilizer") {
    await removeFertilizerApplication(fdm, principal_id, values.p_app_id)
    return dataWithSuccess({ closeSheet: true }, { message: "Bemesting is verwijderd." })
  }

  if (values.intent === "remove_harvest") {
    await removeHarvest(fdm, principal_id, values.b_id_harvesting)
    return dataWithSuccess({ closeSheet: true }, { message: "Oogst is verwijderd." })
  }

  // A harvest, new or changed
  if (!values.b_lu || (values.intent === "update_single_harvest" && !values.b_id_harvesting)) {
    return dataWithError(null, "Er is iets fout gegaan met jouw invoer.")
  }
  const cultivation = await getCultivation(fdm, principal_id, values.b_lu)
  // The grazing calendar only records mowing of grass, also on a field that grows another crop
  // later in the year
  if (context.source === "grazing_calendar" && cultivation.b_lu_croprotation !== "grass") {
    return dataWithError(
      null,
      "Een maaisnede in de beweidingskalender hoort bij een grasgewas. Leg deze oogst vast op de Tijdlijn.",
    )
  }
  const term = getHarvestTerm(
    cultivation.b_lu_croprotation,
    false,
    cultivation.b_lu_harvestable,
    true,
  )

  // The parameters the harvest category of the cultivation requires
  const requiredParameters = getParametersForHarvestCat(cultivation.b_lu_harvestcat)
  const formParameters = values as Record<string, unknown>
  const missingParameters: HarvestParameters = requiredParameters.filter(
    (param) => formParameters[param] === undefined || formParameters[param] === null,
  )
  if (missingParameters.length > 0) {
    return dataWithWarning(
      { warning: `Missing required harvest parameters: ${missingParameters.join(", ")}` },
      `Voor de volgende parameters ontbreekt een waarde: ${missingParameters
        .map((param) => getHarvestParameterLabel(param))
        .join(", ")}`,
    )
  }
  const harvestProperties: Record<string, number> = {}
  for (const param of requiredParameters) {
    if (formParameters[param] !== undefined) {
      harvestProperties[param] = formParameters[param] as number
    }
  }

  if (values.intent === "update_single_harvest") {
    await updateHarvest(
      fdm,
      principal_id,
      values.b_id_harvesting ?? "",
      values.b_lu_harvest_date,
      harvestProperties,
    )
    return dataWithSuccess(
      { closeSheet: true },
      { message: `${term} succesvol bijgewerkt aan het perceel.` },
    )
  }

  const effectiveHarvestable = getEffectiveHarvestable(
    cultivation.b_lu_harvestable ?? "once",
    cultivation.b_lu_croprotation,
  )
  await fdm.transaction(async (tx) => {
    // A crop harvested once keeps only its latest harvest
    if (effectiveHarvestable === "once") {
      for (const harvest of await getHarvests(tx, principal_id, cultivation.b_lu)) {
        await removeHarvest(tx, principal_id, harvest.b_id_harvesting)
      }
    }
    await addHarvest(
      tx,
      principal_id,
      cultivation.b_lu,
      values.b_lu_harvest_date,
      harvestProperties,
    )
  })
  return dataWithSuccess(
    { closeSheet: true },
    { message: `${term} succesvol toegevoegd aan het perceel.` },
  )
}

/**
 * The fertilizers of a farm as options for the fertilizer application form, with their
 * application methods, unit and maximum amount.
 *
 * @param principal_id - The acting principal.
 * @param b_id_farm - The farm.
 * @returns The options for `FertilizerApplicationForm`.
 */
export async function getFertilizerOptions(principal_id: string, b_id_farm: string) {
  const fertilizers = await getFertilizers(fdm, principal_id, b_id_farm)

  const applicationMethods = getFertilizerParametersDescription().find(
    (x: { parameter: string }) => x.parameter === "p_app_method_options",
  )
  if (!applicationMethods) throw new Error("Parameter metadata missing")
  const applicationMethodOptions = (applicationMethods.options ?? [])
    .filter(
      (option): option is { value: ApplicationMethods; label: string } => option.value !== null,
    )
    .map((option) => ({ value: option.value, label: option.label }))

  return fertilizers.map((fertilizer) => ({
    value: fertilizer.p_id,
    label: fertilizer.p_name_nl ?? "",
    p_type: fertilizer.p_type,
    p_type_rvo: fertilizer.p_type_rvo,
    applicationMethodOptions: (fertilizer.p_app_method_options ?? [])
      .map((opt) => applicationMethodOptions.find((x) => x.value === opt))
      .filter(
        (option): option is { value: ApplicationMethods; label: string } => option !== undefined,
      ),
    p_app_amount_unit: fertilizer.p_app_amount_unit,
    p_app_amount_display_max:
      getAppAmountDisplayRange(fertilizer.p_app_amount_unit, fertilizer.p_density)?.max ?? null,
  }))
}
