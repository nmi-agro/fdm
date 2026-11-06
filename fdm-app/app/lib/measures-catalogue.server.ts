import { getFarms, getFields, getMeasuresForFarm, type PrincipalId } from "@nmi-agro/fdm-core"
import { getTimeframe, isSupportedYear } from "~/lib/calendar"
import { fdm } from "~/lib/fdm.server"
import { CATALOGUE_CALENDAR_PARAM, CATALOGUE_FARM_PARAM } from "~/lib/measures-catalogue"

/** A field on which a measure is applied in the selected year. */
export type AppliedField = {
  b_id: string
  b_name: string | null
  m_start: Date | null
  m_end: Date | null
}

export type CatalogueFarmData = {
  /** Farms the user can read, for the farm selector */
  farms: { b_id_farm: string; b_name_farm: string | null }[]
  /** The selected farm, or `null` when no (valid) farm is selected */
  farm: { b_id_farm: string; b_name_farm: string | null } | null
  /** The selected calendar year */
  calendar: string
  /** Per catalogue ID, the fields of the selected farm on which the measure is applied */
  appliedFields: Map<string, AppliedField[]>
}

/**
 * Loads the farm context of the measures catalogue from the query parameters `farm` and
 * `calendar`: the farms the user can choose from and, for the selected farm and year, the
 * fields on which each measure is applied.
 *
 * An unknown farm, or a farm the user cannot read, is treated as no farm. An unsupported
 * year falls back to the current year.
 *
 * @param principal_id - The signed-in user.
 * @param url - URL of the request, with the query parameters.
 */
export async function getCatalogueFarmData(
  principal_id: PrincipalId,
  url: URL,
): Promise<CatalogueFarmData> {
  const requestedCalendar = url.searchParams.get(CATALOGUE_CALENDAR_PARAM)
  const calendar =
    requestedCalendar && isSupportedYear(Number(requestedCalendar))
      ? requestedCalendar
      : new Date().getFullYear().toString()

  const farms = (await getFarms(fdm, principal_id)).map((farm) => ({
    b_id_farm: farm.b_id_farm,
    b_name_farm: farm.b_name_farm,
  }))

  const requestedFarm = url.searchParams.get(CATALOGUE_FARM_PARAM)
  const farm = farms.find((item) => item.b_id_farm === requestedFarm) ?? null
  const appliedFields = new Map<string, AppliedField[]>()
  if (!farm) return { farms, farm, calendar, appliedFields }

  const timeframe = getTimeframe({ calendar })
  const [fields, measuresByField] = await Promise.all([
    getFields(fdm, principal_id, farm.b_id_farm, timeframe),
    getMeasuresForFarm(fdm, principal_id, farm.b_id_farm, timeframe),
  ])
  const fieldNames = new Map(fields.map((field) => [field.b_id, field.b_name]))

  for (const [b_id, measures] of measuresByField) {
    for (const measure of measures) {
      const list = appliedFields.get(measure.m_id) ?? []
      list.push({
        b_id,
        b_name: fieldNames.get(b_id) ?? null,
        m_start: measure.m_start,
        m_end: measure.m_end,
      })
      appliedFields.set(measure.m_id, list)
    }
  }
  for (const list of appliedFields.values()) {
    list.sort((a, b) => (a.b_name ?? "").localeCompare(b.b_name ?? "", "nl"))
  }

  return { farms, farm, calendar, appliedFields }
}
