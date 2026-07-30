import { format, startOfDay } from "date-fns"
import { nl } from "date-fns/locale"
import type {
  FertilizerTypeInfo,
  TimelineCultivation,
  TimelineField,
  TimelineFertilizerApplication,
  TimelineHarvest,
  TimelineSoilAnalysis,
} from "./gantt-view"

export type TimelineEventType =
  | "fertilizer"
  | "harvest"
  | "soil_sampling"
  | "cultivation_start"
  | "cultivation_end"

export type TimelineEvent = {
  id: string
  date: Date
  type: TimelineEventType
  fieldId: string
  fieldName: string
  fieldBufferstrip: boolean
  label: string
  sublabel?: string
  href: string
  p_type?: "manure" | "mineral" | "compost" | null
  p_type_rvo?: string | null
  cultivationType?: string | null
}

export type TimelineDateGroup = {
  date: Date
  key: string
  events: TimelineEvent[]
}

export type TimelineFieldGroup = {
  field: TimelineField
  events: TimelineEvent[]
}

export type MonthYearOption = {
  value: string
  label: string
  date: Date
}

function formatAmount(amount: number | null, unit: string | null): string | null {
  if (amount == null) return null
  return unit ? `${amount} ${unit}` : String(amount)
}

function cultivationHref(b_id_farm: string, calendar: string, fieldId: string): string {
  return `/farm/${b_id_farm}/${calendar}/field/${fieldId}/cultivation`
}

function fertilizerHref(b_id_farm: string, calendar: string, fieldId: string): string {
  return `/farm/${b_id_farm}/${calendar}/field/${fieldId}/fertilizer`
}

function soilHref(b_id_farm: string, calendar: string, fieldId: string): string {
  return `/farm/${b_id_farm}/${calendar}/field/${fieldId}/soil`
}

function pushCultivationEvents(
  events: TimelineEvent[],
  field: TimelineField,
  cultivations: TimelineCultivation[],
  b_id_farm: string,
  calendar: string,
) {
  for (const cultivation of cultivations) {
    const base = {
      fieldId: field.b_id,
      fieldName: field.b_name,
      fieldBufferstrip: field.b_bufferstrip,
      cultivationType: cultivation.b_lu_croprotation,
      href: cultivationHref(b_id_farm, calendar, field.b_id),
    }

    if (cultivation.b_lu_start) {
      events.push({
        ...base,
        id: `cultivation-start-${cultivation.b_lu}`,
        date: cultivation.b_lu_start,
        type: "cultivation_start",
        label: cultivation.b_lu_name ?? "Onbekend gewas",
        sublabel: "Gewas gestart",
      })
    }

    if (cultivation.b_lu_end && cultivation.b_lu_harvestable !== "once") {
      events.push({
        ...base,
        id: `cultivation-end-${cultivation.b_lu}`,
        date: cultivation.b_lu_end,
        type: "cultivation_end",
        label: cultivation.b_lu_name ?? "Onbekend gewas",
        sublabel: "Gewas beëindigd",
      })
    }
  }
}

function pushFertilizerEvents(
  events: TimelineEvent[],
  field: TimelineField,
  applications: TimelineFertilizerApplication[],
  fertilizerTypeById: Map<string, FertilizerTypeInfo>,
  b_id_farm: string,
  calendar: string,
) {
  for (const app of applications) {
    const fertilizerInfo = fertilizerTypeById.get(app.p_id)
    events.push({
      id: `fertilizer-${app.p_app_id}`,
      date: app.p_app_date,
      type: "fertilizer",
      fieldId: field.b_id,
      fieldName: field.b_name,
      fieldBufferstrip: field.b_bufferstrip,
      label: app.p_name_nl ?? "Bemesting",
      sublabel: formatAmount(app.p_app_amount_display, app.p_app_amount_unit) ?? undefined,
      href: fertilizerHref(b_id_farm, calendar, field.b_id),
      p_type: fertilizerInfo?.p_type ?? null,
      p_type_rvo: fertilizerInfo?.p_type_rvo ?? null,
    })
  }
}

function pushHarvestEvents(
  events: TimelineEvent[],
  field: TimelineField,
  harvests: TimelineHarvest[],
  b_id_farm: string,
  calendar: string,
) {
  for (const harvest of harvests) {
    if (!harvest.b_lu_harvest_date) continue

    const parameterText = harvest.parameters
      .map(({ label, value }) => `${label}: ${value}`)
      .join(" · ")

    events.push({
      id: `harvest-${harvest.b_id_harvesting}`,
      date: harvest.b_lu_harvest_date,
      type: "harvest",
      fieldId: field.b_id,
      fieldName: field.b_name,
      fieldBufferstrip: field.b_bufferstrip,
      label: harvest.b_lu_name ? `Oogst ${harvest.b_lu_name}` : "Oogst",
      sublabel: parameterText || undefined,
      href: cultivationHref(b_id_farm, calendar, field.b_id),
    })
  }
}

function pushSoilEvents(
  events: TimelineEvent[],
  field: TimelineField,
  analyses: TimelineSoilAnalysis[],
  b_id_farm: string,
  calendar: string,
) {
  for (const analysis of analyses) {
    if (!analysis.b_sampling_date) continue

    events.push({
      id: `soil-${analysis.a_id}`,
      date: analysis.b_sampling_date,
      type: "soil_sampling",
      fieldId: field.b_id,
      fieldName: field.b_name,
      fieldBufferstrip: field.b_bufferstrip,
      label: analysis.a_source ?? "Bodemmanalyse",
      href: soilHref(b_id_farm, calendar, field.b_id),
    })
  }
}

export function flattenEvents(
  fields: TimelineField[],
  fertilizerTypeById: Map<string, FertilizerTypeInfo>,
  b_id_farm: string,
  calendar: string,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const field of fields) {
    pushCultivationEvents(events, field, field.cultivations, b_id_farm, calendar)
    pushFertilizerEvents(
      events,
      field,
      field.fertilizerApplications,
      fertilizerTypeById,
      b_id_farm,
      calendar,
    )
    pushHarvestEvents(events, field, field.harvests, b_id_farm, calendar)
    pushSoilEvents(events, field, field.soilAnalyses, b_id_farm, calendar)
  }

  return events
}

export function filterEventsByType(
  events: TimelineEvent[],
  filters: {
    showCultivations: boolean
    showFertilizers: boolean
    showHarvests: boolean
    showSoilSamplings: boolean
    showFutureEvents: boolean
  },
  now: Date,
): TimelineEvent[] {
  return events.filter((event) => {
    if (!filters.showFutureEvents && event.date > now) return false

    switch (event.type) {
      case "cultivation_start":
      case "cultivation_end":
        return filters.showCultivations
      case "fertilizer":
        return filters.showFertilizers
      case "harvest":
        return filters.showHarvests
      case "soil_sampling":
        return filters.showSoilSamplings
      default:
        return true
    }
  })
}

export function groupEventsByDate(events: TimelineEvent[]): TimelineDateGroup[] {
  const sorted = [...events].sort((a, b) => b.date.getTime() - a.date.getTime())
  const groups = new Map<string, TimelineDateGroup>()

  for (const event of sorted) {
    const key = format(event.date, "yyyy-MM-dd")
    const existing = groups.get(key)
    if (existing) {
      existing.events.push(event)
    } else {
      groups.set(key, {
        date: event.date,
        key,
        events: [event],
      })
    }
  }

  return Array.from(groups.values())
}

export function groupEventsByField(
  events: TimelineEvent[],
  fields: TimelineField[],
): TimelineFieldGroup[] {
  const eventsByField = new Map<string, TimelineEvent[]>()

  for (const event of events) {
    const list = eventsByField.get(event.fieldId) ?? []
    list.push(event)
    eventsByField.set(event.fieldId, list)
  }

  return fields.map((field) => ({
    field,
    events: (eventsByField.get(field.b_id) ?? []).sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    ),
  }))
}

export function getMonthYearOptions(events: TimelineEvent[]): MonthYearOption[] {
  const seen = new Map<string, Date>()

  for (const event of events) {
    const key = format(event.date, "yyyy-MM")
    if (!seen.has(key)) {
      seen.set(key, event.date)
    }
  }

  return Array.from(seen.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([value, date]) => ({
      value,
      label: format(date, "MMMM yyyy", { locale: nl }),
      date,
    }))
}

export function isInMonthYear(date: Date, monthYear: string): boolean {
  return format(date, "yyyy-MM") === monthYear
}

export type ActiveCultivation = {
  fieldId: string
  fieldName: string
  b_lu: string
  b_lu_name: string | null
  b_lu_croprotation: string | null
  b_lu_start: Date
  b_lu_end: Date | null
}

export function getActiveCultivations(fields: TimelineField[]): ActiveCultivation[] {
  const today = startOfDay(new Date())
  const active: ActiveCultivation[] = []

  for (const field of fields) {
    for (const cultivation of field.cultivations) {
      if (!cultivation.b_lu_start) continue
      const end = cultivation.b_lu_end
      if (cultivation.b_lu_start <= today && (end == null || end >= today)) {
        active.push({
          fieldId: field.b_id,
          fieldName: field.b_name,
          b_lu: cultivation.b_lu,
          b_lu_name: cultivation.b_lu_name,
          b_lu_croprotation: cultivation.b_lu_croprotation,
          b_lu_start: cultivation.b_lu_start,
          b_lu_end: end,
        })
      }
    }
  }

  return active
}

export function formatEventDateHeader(date: Date): string {
  return format(date, "d MMM", { locale: nl })
}
