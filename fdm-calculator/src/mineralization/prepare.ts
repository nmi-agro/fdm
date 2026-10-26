/**
 * @packageDocumentation
 * @module mineralization/prepare
 *
 * Builds the Dyna v2 request for one field and calendar year from FDM data.
 *
 * The functions here are pure: the caller fetches the data from FDM and passes it in.
 */

import {
  type Cultivation,
  type CurrentSoilData,
  type Fertilizer,
  type FertilizerApplication,
  toFdmDateString,
} from "@nmi-agro/fdm-core"
import type { DynaV2ApplicationMethod, DynaV2Request } from "./types"
import { getYearTimeframe } from "../bln3"
import { type FieldExclusionReason, getFieldExclusionReason } from "../shared/field-exclusion"

/** Cultivation properties used for the mineralization calculation. */
export type MineralizationCultivation = Pick<
  Cultivation,
  | "b_lu"
  | "b_lu_catalogue"
  | "b_lu_name"
  | "b_lu_croprotation"
  | "b_lu_harvestable"
  | "b_lu_start"
  | "b_lu_end"
  | "m_cropresidue"
>

/** Harvest properties used for the mineralization calculation. */
export interface MineralizationHarvest {
  b_id_harvesting: string
  b_lu_harvest_date: Date | null
  harvestable?: {
    harvestable_analyses: {
      b_lu_yield?: number | null
      b_lu_n_harvestable?: number | null
    }[]
  } | null
}

/** Fertilizer application properties used for the mineralization calculation. */
export type MineralizationApplication = Pick<
  FertilizerApplication,
  | "p_app_id"
  | "p_id"
  | "p_name_nl"
  | "p_app_amount"
  | "p_app_amount_display"
  | "p_app_amount_unit"
  | "p_app_method"
  | "p_app_date"
>

/** Fertilizer properties used for the mineralization calculation. */
export type MineralizationFertilizer = Pick<
  Fertilizer,
  "p_id" | "p_type" | "p_n_rt" | "p_n_if" | "p_n_of" | "p_om" | "p_no3_rt" | "p_nh4_rt" | "p_s_rt"
>

/** Soil parameter value used for the mineralization calculation. */
export type MineralizationSoilItem = Pick<
  CurrentSoilData[number],
  "parameter" | "value" | "a_source" | "b_sampling_date"
>

/** All FDM data of one field that is needed to prepare a Dyna v2 calculation. */
export interface MineralizationFieldData {
  field: {
    b_id: string
    b_name: string | null
    /** Centroid of the field as `[longitude, latitude]` (WGS84). */
    b_centroid: [number, number] | null
    b_bufferstrip: boolean | null
  }
  /** Current soil data of the field. */
  soil: MineralizationSoilItem[]
  /** Cultivations of the field (any year). */
  cultivations: MineralizationCultivation[]
  /** Harvests per cultivation (`b_lu`). */
  harvests: Map<string, MineralizationHarvest[]>
  /** Fertilizer applications of the field (any year). */
  applications: MineralizationApplication[]
  /** Fertilizers of the farm by `p_id`. */
  fertilizers: Map<string, MineralizationFertilizer>
}

/** Event on the field that influences the nitrogen dynamics. */
export interface MineralizationEvent {
  /** Calendar date (`YYYY-MM-DD`). */
  date: string
  type: "sowing" | "fertilizer" | "harvest" | "cultivation_end"
  /** Short description, e.g. the cultivation or fertilizer name. */
  label: string
  /** Whether the event lies after today (planned) or not (carried out). */
  planned: boolean
  b_lu?: string
  p_app_id?: string
  fertilizerKind?: "mineral" | "organic"
  /** Amount in `unit`: applied amount for fertilizers, yield for harvests. */
  amount?: number
  unit?: string
}

/** Overview of the input that was sent to Dyna, for display to users. */
export interface MineralizationUsedInput {
  location: { a_lat: number; a_lon: number }
  soil: { parameter: string; value: number | string; source: string | null; date: string | null }[]
  /** Soil parameters that Dyna can use but that are not known for the field. */
  missingSoilParameters: string[]
  cultivations: {
    b_lu: string
    b_lu_name: string | null
    b_lu_catalogue: string
    /** Crop rotation group, e.g. `grass` or `cereal`; used to color the crop in the app. */
    b_lu_croprotation: string | null
    start: string
    end: string
    role: "main" | "after"
  }[]
  harvests: { b_lu: string; date: string; b_lu_yield: number | null; planned: boolean }[]
  fertilizerApplications: {
    p_app_id: string
    p_id: string
    p_name_nl: string | null
    date: string
    amount: number | null
    unit: string
    method: string | null
    kind: "mineral" | "organic"
    p_n_rt: number | null
  }[]
  skippedApplications: { p_app_id: string; reason: "unknown_fertilizer" }[]
  /**
   * Harvests in the year that were not sent, because Dyna accepts at most
   * {@link DYNA_V2_MAX_HARVESTS_PER_CULTIVATION} harvests per cultivation.
   */
  omittedHarvests: { b_lu: string; date: string }[]
}

/** Outcome of {@link prepareMineralizationInput}. */
export type MineralizationPreparation =
  | { status: "excluded"; reason: FieldExclusionReason }
  | { status: "missing_location" }
  | { status: "no_cultivation" }
  | { status: "missing_harvest"; mainCultivation: MineralizationCultivation }
  | {
      status: "ready"
      mainCultivation: MineralizationCultivation
      request: DynaV2Request
      usedInput: MineralizationUsedInput
      events: MineralizationEvent[]
    }

/** Maximum number of harvests per cultivation that the Dyna v2 endpoint accepts. */
export const DYNA_V2_MAX_HARVESTS_PER_CULTIVATION = 6

/** Soil parameters that Dyna v2 accepts. */
export const DYNA_V2_SOIL_PARAMETERS: readonly string[] = [
  "a_som_loi",
  "a_clay_mi",
  "a_silt_mi",
  "a_n_rt",
  "a_ph_cc",
  "a_nmin_cc_d30",
  "a_nmin_cc_d60",
  "b_soiltype_agr",
  "b_gwl_glg",
  "b_gwl_ghg",
]

const DYNA_V2_APPLICATION_METHODS: readonly DynaV2ApplicationMethod[] = [
  "injection",
  "shallow injection",
  "incorporation",
  "slotted coulter",
  "spraying",
  "broadcasting",
  "spoke wheel",
  "pocket placement",
  "incorporation 2 tracks",
  "narrowband",
]

/**
 * Maps an FDM application method to a method accepted by Dyna v2.
 *
 * @param method - FDM application method.
 * @returns The same method when Dyna supports it, otherwise `"broadcasting"`.
 */
export function mapApplicationMethod(method: string | null): DynaV2ApplicationMethod {
  return DYNA_V2_APPLICATION_METHODS.find((m) => m === method) ?? "broadcasting"
}

/**
 * Builds the Dyna v2 composition of a fertilizer; only known nutrient contents are included.
 *
 * @param fertilizer - Fertilizer of the farm.
 * @returns The fertilizer properties for the Dyna v2 request.
 */
export function buildFertilizerProperties(
  fertilizer: MineralizationFertilizer,
): NonNullable<DynaV2Request["fertilizer_properties"]>[number] {
  const props: NonNullable<DynaV2Request["fertilizer_properties"]>[number] = {
    p_id: fertilizer.p_id,
    p_type_mineral: fertilizer.p_type === "mineral",
  }
  for (const key of [
    "p_n_rt",
    "p_n_if",
    "p_n_of",
    "p_om",
    "p_no3_rt",
    "p_nh4_rt",
    "p_s_rt",
  ] as const) {
    const value = fertilizer[key]
    if (value != null) props[key] = value
  }
  return props
}

/**
 * Determines the main cultivation for a given year using the "May 15th" rule.
 *
 * The crop that is active on 15 May of the year is the main cultivation; catch crops only count
 * when no other crop is active on that date. When several crops qualify, the most recently started
 * one is chosen. Without a crop on 15 May, the first non-catch crop is used, then any crop.
 *
 * @param cultivations - Cultivations that overlap the year.
 * @param year - Calendar year.
 * @returns The main cultivation, or `undefined` when the list is empty.
 */
export function getMainCultivation<
  T extends {
    b_lu_catalogue?: string | null
    b_lu_start?: Date | null
    b_lu_end?: Date | null
    b_lu_croprotation?: string | null
  },
>(cultivations: T[], year: number): T | undefined {
  // Use 12:00 noon to avoid timezone edge cases at midnight
  const targetDate = new Date(`${year}-05-15T12:00:00`)
  const spansTarget = (c: T) =>
    !!c.b_lu_start && (c.b_lu_end ?? targetDate) >= targetDate && c.b_lu_start <= targetDate
  const latestStart = (best: T | undefined, c: T) =>
    !best || (c.b_lu_start?.getTime() ?? 0) > (best.b_lu_start?.getTime() ?? 0) ? c : best

  const activeMain = cultivations
    .filter((c) => c.b_lu_croprotation !== "catchcrop" && spansTarget(c))
    .reduce<T | undefined>(latestStart, undefined)
  if (activeMain) return activeMain

  const activeAny = cultivations.filter(spansTarget).reduce<T | undefined>(latestStart, undefined)
  if (activeAny) return activeAny

  return cultivations.find((c) => c.b_lu_croprotation !== "catchcrop") ?? cultivations[0]
}

/**
 * Determines the start date sent to Dyna for a cultivation.
 *
 * Crops sown in the selected or the previous year keep their sowing date, so the growth of winter
 * crops is modelled from sowing. Multi-year crops (harvested multiple times, or started before the
 * previous year) start on 1 January of the selected year.
 */
function getRequestStart(cultivation: MineralizationCultivation, year: number): string {
  const start = toFdmDateString(cultivation.b_lu_start as Date)
  const isMultiYear = cultivation.b_lu_harvestable === "multiple" || start < `${year - 1}-01-01`
  if (start >= `${year}-01-01` || !isMultiYear) return start
  return `${year}-01-01`
}

/**
 * Prepares the Dyna v2 calculation of one field for a calendar year.
 *
 * Rules:
 * - The field is excluded when it is a buffer strip or its main cultivation is a landscape element
 *   or nature (see {@link getFieldExclusionReason}).
 * - Only the main cultivation of the year and the cultivations started after it (e.g. green manure
 *   and catch crops) are sent. Crops sown in the previous year keep their sowing date; multi-year
 *   crops start on 1 January. Cultivations end at the last harvest for crops harvested once,
 *   otherwise at their end date or 31 December.
 * - The main cultivation needs a (measured or planned) harvest in the year, unless it is not
 *   harvestable.
 * - Only fertilizer applications within the year are sent; applications of fertilizers that are
 *   not known on the farm are skipped.
 *
 * @param data - FDM data of the field.
 * @param year - Calendar year to calculate.
 * @param today - Current date; events after today are marked as planned.
 * @returns The request with the input overview and events, or the reason why it cannot be calculated.
 */
export function prepareMineralizationInput(
  data: MineralizationFieldData,
  year: number,
  today: Date,
): MineralizationPreparation {
  const timeframe = getYearTimeframe(year)
  const yearStart = timeframe.start as Date
  const yearEnd = timeframe.end as Date
  const yearEndDate = `${year}-12-31`
  const todayDate = toFdmDateString(today)
  const inYear = (date: Date | null | undefined): date is Date =>
    !!date && date >= yearStart && date <= yearEnd

  const overlapping = data.cultivations.filter(
    (c) =>
      c.b_lu_catalogue &&
      c.b_lu_start != null &&
      c.b_lu_start <= yearEnd &&
      (c.b_lu_end == null || c.b_lu_end >= yearStart),
  )
  const main = getMainCultivation(overlapping, year)

  const exclusion = getFieldExclusionReason({
    b_bufferstrip: data.field.b_bufferstrip,
    b_lu_croprotation: main?.b_lu_croprotation,
    b_lu_catalogue: main?.b_lu_catalogue,
  })
  if (exclusion) return { status: "excluded", reason: exclusion }
  if (!data.field.b_centroid) return { status: "missing_location" }
  if (!main) return { status: "no_cultivation" }

  const harvestsInYear = (b_lu: string) =>
    (data.harvests.get(b_lu) ?? [])
      .filter((h) => inYear(h.b_lu_harvest_date))
      .sort(
        (a, b) => (a.b_lu_harvest_date as Date).getTime() - (b.b_lu_harvest_date as Date).getTime(),
      )

  const mainHarvests = harvestsInYear(main.b_lu)
  if (main.b_lu_harvestable !== "none" && mainHarvests.length === 0) {
    return { status: "missing_harvest", mainCultivation: main }
  }

  const mainStart = main.b_lu_start as Date
  const selected = [
    main,
    ...overlapping
      .filter((c) => c !== main && (c.b_lu_start as Date) > mainStart)
      .sort((a, b) => (a.b_lu_start as Date).getTime() - (b.b_lu_start as Date).getTime()),
  ]

  const [a_lon, a_lat] = data.field.b_centroid
  const request: DynaV2Request = { field: { a_lat, a_lon } }
  const usedInput: MineralizationUsedInput = {
    location: { a_lat, a_lon },
    soil: [],
    missingSoilParameters: [],
    cultivations: [],
    harvests: [],
    fertilizerApplications: [],
    skippedApplications: [],
    omittedHarvests: [],
  }
  const events: MineralizationEvent[] = []

  // Soil
  const soilAnalysis: Record<string, number | string> = {}
  for (const parameter of DYNA_V2_SOIL_PARAMETERS) {
    const item = data.soil.find((s) => s.parameter === parameter)
    if (item?.value === null || item?.value === undefined) {
      usedInput.missingSoilParameters.push(parameter)
      continue
    }
    soilAnalysis[parameter] = item.value
    usedInput.soil.push({
      parameter,
      value: item.value,
      source: item.a_source ?? null,
      date: item.b_sampling_date ? toFdmDateString(item.b_sampling_date) : null,
    })
  }
  // Groundwater levels are only accepted as a pair
  if ((soilAnalysis.b_gwl_glg === undefined) !== (soilAnalysis.b_gwl_ghg === undefined)) {
    delete soilAnalysis.b_gwl_glg
    delete soilAnalysis.b_gwl_ghg
  }
  if (Object.keys(soilAnalysis).length > 0) request.soil_analysis = soilAnalysis

  // Cultivations and harvests
  const cultivations: NonNullable<DynaV2Request["cultivations"]> = []
  const harvests: NonNullable<DynaV2Request["harvests"]> = []
  for (const cultivation of selected) {
    // Dyna accepts a limited number of harvests per cultivation; later ones are reported instead
    const allHarvests = harvestsInYear(cultivation.b_lu)
    const cultivationHarvests = allHarvests.slice(0, DYNA_V2_MAX_HARVESTS_PER_CULTIVATION)
    for (const h of allHarvests.slice(DYNA_V2_MAX_HARVESTS_PER_CULTIVATION)) {
      usedInput.omittedHarvests.push({
        b_lu: cultivation.b_lu,
        date: toFdmDateString(h.b_lu_harvest_date as Date),
      })
    }
    const start = getRequestStart(cultivation, year)
    let end: string
    if (cultivation.b_lu_harvestable === "once" && cultivationHarvests.length > 0) {
      end = toFdmDateString(cultivationHarvests.at(-1)?.b_lu_harvest_date as Date)
    } else if (inYear(cultivation.b_lu_end)) {
      end = toFdmDateString(cultivation.b_lu_end)
    } else {
      end = yearEndDate
    }
    const b_lu_catalogue = cultivation.b_lu_catalogue as string
    cultivations.push({
      b_lu: b_lu_catalogue,
      b_lu_id: cultivation.b_lu,
      b_lu_start: start,
      b_lu_end: end,
    })
    usedInput.cultivations.push({
      b_lu: cultivation.b_lu,
      b_lu_name: cultivation.b_lu_name,
      b_lu_catalogue,
      b_lu_croprotation: cultivation.b_lu_croprotation ?? null,
      start,
      end,
      role: cultivation === main ? "main" : "after",
    })

    const label = cultivation.b_lu_name ?? b_lu_catalogue
    if (inYear(cultivation.b_lu_start)) {
      const date = toFdmDateString(cultivation.b_lu_start)
      events.push({
        date,
        type: "sowing",
        label,
        planned: date > todayDate,
        b_lu: cultivation.b_lu,
      })
    }
    if (cultivation !== main && end !== yearEndDate) {
      events.push({
        date: end,
        type: "cultivation_end",
        label,
        planned: end > todayDate,
        b_lu: cultivation.b_lu,
      })
    }

    for (const h of cultivationHarvests) {
      const date = toFdmDateString(h.b_lu_harvest_date as Date)
      const analysis = h.harvestable?.harvestable_analyses?.[0]
      const b_lu_yield = analysis?.b_lu_yield ?? null
      harvests.push({
        b_lu_id: cultivation.b_lu,
        b_date_harvest: date,
        ...(b_lu_yield != null ? { b_lu_yield } : {}),
        ...(analysis?.b_lu_n_harvestable != null
          ? { b_lu_n_harvestable: analysis.b_lu_n_harvestable }
          : {}),
        ...(cultivation.m_cropresidue != null ? { m_cropresidue: cultivation.m_cropresidue } : {}),
      })
      usedInput.harvests.push({
        b_lu: cultivation.b_lu,
        date,
        b_lu_yield,
        planned: date > todayDate,
      })
      events.push({
        date,
        type: "harvest",
        label,
        planned: date > todayDate,
        b_lu: cultivation.b_lu,
        ...(b_lu_yield != null ? { amount: b_lu_yield, unit: "kg DS/ha" } : {}),
      })
    }
  }
  request.cultivations = cultivations
  if (harvests.length > 0) request.harvests = harvests

  // Fertilizer applications
  const applications: NonNullable<DynaV2Request["fertilizer_applications"]> = []
  const properties = new Map<string, NonNullable<DynaV2Request["fertilizer_properties"]>[number]>()
  const sortedApplications = data.applications
    .filter((a) => inYear(a.p_app_date))
    .sort((a, b) => a.p_app_date.getTime() - b.p_app_date.getTime())
  for (const application of sortedApplications) {
    const fertilizer = data.fertilizers.get(application.p_id)
    if (!fertilizer) {
      usedInput.skippedApplications.push({
        p_app_id: application.p_app_id,
        reason: "unknown_fertilizer",
      })
      continue
    }
    const date = toFdmDateString(application.p_app_date)
    const kind = fertilizer.p_type === "mineral" ? "mineral" : "organic"
    applications.push({
      p_id: application.p_id,
      p_app_amount: application.p_app_amount ?? 0,
      p_date_fertilization: date,
      p_app_method: mapApplicationMethod(application.p_app_method),
    })
    if (!properties.has(fertilizer.p_id)) {
      properties.set(fertilizer.p_id, buildFertilizerProperties(fertilizer))
    }
    const amount = application.p_app_amount_display ?? application.p_app_amount
    usedInput.fertilizerApplications.push({
      p_app_id: application.p_app_id,
      p_id: application.p_id,
      p_name_nl: application.p_name_nl,
      date,
      amount,
      unit: application.p_app_amount_unit,
      method: application.p_app_method,
      kind,
      p_n_rt: fertilizer.p_n_rt,
    })
    events.push({
      date,
      type: "fertilizer",
      label: application.p_name_nl ?? application.p_id,
      planned: date > todayDate,
      p_app_id: application.p_app_id,
      fertilizerKind: kind,
      ...(amount != null ? { amount } : {}),
      unit: application.p_app_amount_unit,
    })
  }
  if (applications.length > 0) {
    request.fertilizer_applications = applications
    request.fertilizer_properties = [...properties.values()]
  }

  events.sort((a, b) => a.date.localeCompare(b.date))
  return { status: "ready", mainCultivation: main, request, usedInput, events }
}

/**
 * Removes all cultivations except the main cultivation from a Dyna v2 request.
 *
 * Used as a fallback when the API cannot calculate a request with several cultivations.
 *
 * @param request - Dyna v2 request.
 * @param mainB_lu - `b_lu` of the main cultivation.
 * @returns A copy of the request with only the main cultivation and its harvests.
 */
export function restrictToMainCultivation(request: DynaV2Request, mainB_lu: string): DynaV2Request {
  return {
    ...request,
    cultivations: request.cultivations?.filter((c) => c.b_lu_id === mainB_lu),
    harvests: request.harvests?.filter((h) => h.b_lu_id === mainB_lu),
  }
}
