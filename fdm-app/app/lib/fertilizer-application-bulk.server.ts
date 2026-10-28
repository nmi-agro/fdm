import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import {
  addFertilizerApplication,
  getFertilizerApplication,
  updateFertilizerApplication,
  type Cultivation,
  type FdmType,
  type Field,
  getFertilizerParametersDescription,
  getFertilizers,
  getFields,
  type PrincipalId,
} from "@nmi-agro/fdm-core"
import type { FertilizerOption } from "~/components/blocks/fertilizer-applications/types.d"
import {
  BULK_ANALYTICS_PARAMS,
  type BulkFieldOption,
} from "~/components/blocks/fertilizer-applications/bulk/types"
import { captureEvent } from "~/lib/analytics.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"

/**
 * Returns the fertilizers of a farm as options for the fertilizer application form.
 *
 * @returns One option per fertilizer, with the application methods it supports.
 */
export async function getFertilizerOptions(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
): Promise<FertilizerOption[]> {
  const fertilizers = await getFertilizers(fdm, principal_id, b_id_farm)
  const applicationMethods = getFertilizerParametersDescription().find(
    (x) => x.parameter === "p_app_method_options",
  )
  if (!applicationMethods) throw new Error("Parameter metadata missing")
  const availableApplicationMethodOptions = (applicationMethods.options ?? [])
    .filter(
      (option): option is { value: ApplicationMethods; label: string } => option.value !== null,
    )
    .map((option) => ({ value: option.value, label: option.label }))

  return fertilizers.map((fertilizer) => ({
    value: fertilizer.p_id,
    label: fertilizer.p_name_nl ?? "",
    applicationMethodOptions: (fertilizer.p_app_method_options ?? [])
      .map((opt) => availableApplicationMethodOptions.find((x) => x.value === opt))
      .filter(
        (option): option is { value: ApplicationMethods; label: string } => option !== undefined,
      ),
    p_app_amount_unit: fertilizer.p_app_amount_unit,
  }))
}

/**
 * Builds the field options for the bulk fertilizer application page.
 *
 * @param fields - The fields of the farm in the calendar year.
 * @param cultivationsByField - The cultivations per field in the calendar year.
 * @param calendar - The calendar year, used to determine the main cultivation.
 */
export function toBulkFieldOptions(
  fields: Pick<Field, "b_id" | "b_name" | "b_area" | "b_bufferstrip">[],
  cultivationsByField: Map<string, Cultivation[]>,
  calendar: string,
): BulkFieldOption[] {
  return fields.map((field) => {
    const cultivations = cultivationsByField.get(field.b_id) ?? []
    const main = getMainCultivation(cultivations, calendar)
    return {
      b_id: field.b_id,
      b_name: field.b_name,
      b_area: Math.round((field.b_area ?? 0) * 10) / 10,
      b_bufferstrip: field.b_bufferstrip ?? false,
      cultivations: cultivations.map((c) => c.b_lu_catalogue),
      mainCultivationName: main?.b_lu_name ?? null,
      mainCultivationCropRotation: main?.b_lu_croprotation ?? null,
    }
  })
}

/** Values of the fertilizer application form, after validation. */
export interface BulkFertilizerApplicationValues {
  p_id: string
  p_app_amount_display: number
  p_app_method: string
  p_app_date: Date
}

/**
 * Adds the same fertilizer application to several fields in one transaction.
 *
 * Duplicate field ids are ignored. Fields that do not belong to the farm are rejected. When one
 * of the fields fails, no application is added.
 *
 * @returns The ids of the fields the application was added to.
 */
export async function addFertilizerApplicationToFields({
  fdm,
  principal_id,
  b_id_farm,
  fieldIds,
  values,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: string
  fieldIds: string[]
  values: BulkFertilizerApplicationValues
}): Promise<string[]> {
  const uniqueFieldIds = [...new Set(fieldIds.filter(Boolean))]
  // Queries in a transaction share one connection, so run them one after the other
  await fdm.transaction(async (tx) => {
    // The field ids come from the URL, so only accept fields of the farm of the page
    const farmFieldIds = new Set(
      (await getFields(tx, principal_id, b_id_farm)).map((field) => field.b_id),
    )
    const outside = uniqueFieldIds.filter((b_id) => !farmFieldIds.has(b_id))
    if (outside.length > 0) {
      throw new Error(`Fields do not belong to farm ${b_id_farm}: ${outside.join(", ")}`)
    }
    for (const b_id of uniqueFieldIds) {
      await addFertilizerApplication(
        tx,
        principal_id,
        b_id,
        values.p_id,
        values.p_app_amount_display,
        values.p_app_method as ApplicationMethods,
        values.p_app_date,
      )
    }
  })
  return uniqueFieldIds
}

/**
 * Records the `fertilizer_application_added` event for each field of a bulk application.
 *
 * The analytics values that the page knows about (excluded fields, norm exceeded, preview used)
 * are read from the action URL and parsed defensively.
 */
export function captureBulkFertilizerApplicationAdded({
  principal_id,
  b_id_farm,
  calendar,
  p_id,
  fieldIds,
  source,
  url,
}: {
  principal_id: string
  b_id_farm: string
  calendar: string
  p_id: string
  fieldIds: string[]
  source: "field_page" | "rotation_table"
  url: URL
}) {
  const excludedCount = Number.parseInt(
    url.searchParams.get(BULK_ANALYTICS_PARAMS.excludedCount) ?? "0",
    10,
  )
  const properties = {
    b_id_farm,
    p_id,
    calendar,
    source,
    field_count: fieldIds.length,
    excluded_count: Number.isFinite(excludedCount) && excludedCount > 0 ? excludedCount : 0,
    norm_exceeded: url.searchParams.get(BULK_ANALYTICS_PARAMS.normExceeded) === "true",
    preview_used: url.searchParams.get(BULK_ANALYTICS_PARAMS.previewUsed) === "true",
  }
  for (const b_id of fieldIds) {
    captureEvent(principal_id, "fertilizer_application_added", { ...properties, b_id })
  }
}

/** Values to change on fertilizer applications. Missing values keep the value of each application. */
export interface PartialFertilizerApplicationValues {
  p_id?: string
  p_app_amount_display?: number
  p_app_method?: string
  p_app_date?: Date
}

/**
 * Changes several fertilizer applications at once, in one transaction.
 *
 * Values that are not given keep the value of each application, so applications with, for
 * example, different amounts can get the same date without changing their amounts.
 *
 * @returns The number of changed applications.
 * @throws When an application does not exist; then no application is changed.
 */
export async function updateFertilizerApplications({
  fdm,
  principal_id,
  p_app_ids,
  values,
}: {
  fdm: FdmType
  principal_id: string
  p_app_ids: string[]
  values: PartialFertilizerApplicationValues
}): Promise<number> {
  const ids = [...new Set(p_app_ids.filter(Boolean))]
  // Queries in a transaction share one connection, so run them one after the other
  await fdm.transaction(async (tx) => {
    for (const p_app_id of ids) {
      const original = await getFertilizerApplication(tx, principal_id, p_app_id)
      if (!original) {
        throw new Error(`Application ${p_app_id} not found.`)
      }
      await updateFertilizerApplication(
        tx,
        principal_id,
        p_app_id,
        values.p_id ?? original.p_id,
        // Without a new amount the stored amount in kg/ha is kept, also when p_id changes
        values.p_app_amount_display,
        (values.p_app_method ?? original.p_app_method) as ApplicationMethods,
        values.p_app_date ?? original.p_app_date,
      )
    }
  })
  return ids.length
}
