/**
 * @file mineralization.server.ts
 *
 * Server-side orchestration of the Mineralisatie feature.
 *
 * Gathers the FDM data of a farm once, prepares the Dyna v2 calculation per field with
 * `@nmi-agro/fdm-calculator`, runs the (cached) calculation and weather forecast, and interprets
 * the result. Per-field failures are returned as an outcome instead of being thrown, so one field
 * never breaks a page.
 */

import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import {
  applyScenarioToRequest,
  diffScenario,
  type DynaV2Request,
  HARVEST_PARAMETER_KEYS,
  type HarvestParameterValues,
  type DynaV2Result,
  deriveMineralizationInsights,
  getDynaV2,
  getWeatherForecast,
  type MineralizationCultivation,
  type MineralizationUsedInput,
  type MineralizationFieldData,
  type MineralizationScenario,
  NmiApiError,
  prepareMineralizationInput,
  restrictToMainCultivation,
  roundCoordinate,
  type WeatherForecast,
} from "@nmi-agro/fdm-calculator"
import {
  addFertilizerApplication,
  addHarvest,
  type Fertilizer,
  type Field,
  getCultivationsForFarm,
  getCurrentSoilDataForFarm,
  getDefaultDatesOfCultivation,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getFields,
  getHarvestsForFarm,
  getParametersForHarvestCat,
  removeFertilizerApplication,
  removeHarvest,
  startOfDayInFdmTimeZone,
  type Timeframe,
  toFdmDateString,
  updateFertilizerApplication,
  updateHarvest,
} from "@nmi-agro/fdm-core"
import type {
  FieldMineralizationOutcome,
  MineralizationMainCultivation,
} from "~/lib/mineralization"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { fdm } from "~/lib/fdm.server"

/** All FDM data of a farm needed for the mineralization calculations of one year. */
export interface FarmMineralizationContext {
  year: number
  today: Date
  fields: Field[]
  data: Map<string, MineralizationFieldData>
  fertilizers: Fertilizer[]
}

/**
 * Returns the timeframe of a calendar year in Europe/Amsterdam.
 *
 * @param year - Calendar year.
 * @returns Timeframe from 1 January up to and including 31 December.
 */
export function getMineralizationTimeframe(year: number): Timeframe {
  return {
    start: startOfDayInFdmTimeZone(year, 1, 1),
    end: new Date(startOfDayInFdmTimeZone(year + 1, 1, 1).getTime() - 1),
  }
}

/**
 * Parses the calendar route parameter into a year; falls back to the current year.
 *
 * @param calendar - The `calendar` route parameter.
 * @returns The calendar year.
 */
export function getMineralizationYear(calendar: string | undefined): number {
  const year = Number(calendar)
  return Number.isInteger(year) && year > 1900
    ? year
    : Number(toFdmDateString(new Date()).slice(0, 4))
}

/**
 * Loads all FDM data of a farm that is needed for the mineralization calculations of a year.
 *
 * Uses one query per data type for the whole farm.
 *
 * @param args.principal_id - Principal of the session.
 * @param args.b_id_farm - Farm identifier.
 * @param args.year - Calendar year.
 * @returns The farm context.
 */
export async function loadFarmMineralizationContext(args: {
  principal_id: string
  b_id_farm: string
  year: number
}): Promise<FarmMineralizationContext> {
  const { principal_id, b_id_farm, year } = args
  const timeframe = getMineralizationTimeframe(year)
  const [fields, cultivations, harvests, applications, fertilizers, soil] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsForFarm(fdm, principal_id, b_id_farm),
    getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizers(fdm, principal_id, b_id_farm),
    getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm),
  ])

  const fertilizerMap = new Map(fertilizers.map((f) => [f.p_id, f]))
  const data = new Map<string, MineralizationFieldData>()
  for (const field of fields) {
    data.set(field.b_id, {
      field: {
        b_id: field.b_id,
        b_name: field.b_name,
        b_centroid: field.b_centroid ?? null,
        b_bufferstrip: field.b_bufferstrip,
      },
      soil: soil.get(field.b_id) ?? [],
      cultivations: cultivations.get(field.b_id) ?? [],
      harvests,
      applications: applications.get(field.b_id) ?? [],
      fertilizers: fertilizerMap,
    })
  }

  return { year, today: new Date(), fields, data, fertilizers }
}

/**
 * Runs Dyna for a prepared request.
 *
 * Requests with several cultivations can fail at the API. In that case the calculation is
 * repeated with only the main cultivation and the outcome is marked as partial.
 */
/**
 * Requests with several cultivations that the API could not calculate, so they are not sent again
 * while this server runs. Bounded to keep memory use small.
 */
const failedMultiCultivationRequests = new Set<string>()
const MAX_REMEMBERED_FAILURES = 1000

async function runDyna(
  nmiApiKey: string,
  request: DynaV2Request,
  mainB_lu: string,
  calculationDate: string,
): Promise<{ result: DynaV2Result; partial: boolean }> {
  const multipleCultivations = (request.cultivations?.length ?? 0) > 1
  const requestKey = multipleCultivations ? JSON.stringify(request) : ""
  const fallback = async () => ({
    result: await getDynaV2(fdm, {
      nmiApiKey,
      request: restrictToMainCultivation(request, mainB_lu),
      calculationDate,
    }),
    partial: true,
  })
  if (multipleCultivations && failedMultiCultivationRequests.has(requestKey)) {
    return fallback()
  }
  try {
    const result = await getDynaV2(fdm, { nmiApiKey, request, calculationDate })
    return { result, partial: false }
  } catch (error) {
    if (error instanceof NmiApiError && error.status >= 500 && multipleCultivations) {
      if (failedMultiCultivationRequests.size >= MAX_REMEMBERED_FAILURES) {
        failedMultiCultivationRequests.clear()
      }
      failedMultiCultivationRequests.add(requestKey)
      return fallback()
    }
    throw error
  }
}

/** Reduces a cultivation to the fields that are sent to the browser. */
function summarizeCultivation(c: MineralizationCultivation): MineralizationMainCultivation {
  return {
    b_lu: c.b_lu,
    b_lu_catalogue: c.b_lu_catalogue,
    b_lu_name: c.b_lu_name,
    b_lu_harvestable: c.b_lu_harvestable,
    b_lu_harvestcat: c.b_lu_harvestcat,
    b_lu_croprotation: c.b_lu_croprotation ?? null,
  }
}

/**
 * Calculates the mineralization of one field.
 *
 * Never rejects: problems are returned as an outcome with `status: "error"` and a Dutch message.
 *
 * @param ctx - Farm context from {@link loadFarmMineralizationContext}.
 * @param b_id - Field identifier.
 * @param principal_id - Principal of the session.
 * @param b_id_farm - Farm identifier.
 * @param options.calculation - Optional replacement of the prepared request (used for scenarios).
 * @returns The outcome of the field.
 */
export async function calculateFieldMineralization(
  ctx: FarmMineralizationContext,
  b_id: string,
  principal_id: string,
  b_id_farm: string,
  options: {
    transformRequest?: (
      request: DynaV2Request,
      mainCultivation: MineralizationCultivation,
      usedInput: MineralizationUsedInput,
    ) => DynaV2Request
  } = {},
): Promise<FieldMineralizationOutcome> {
  const field = ctx.fields.find((f) => f.b_id === b_id)
  const base = {
    b_id,
    b_name: field?.b_name ?? null,
    b_area: field?.b_area ?? null,
  }
  try {
    const data = ctx.data.get(b_id)
    if (!data) {
      return { ...base, status: "error", message: "Dit perceel is niet gevonden in dit jaar." }
    }

    const preparation = prepareMineralizationInput(data, ctx.year, ctx.today)
    switch (preparation.status) {
      case "excluded":
        return { ...base, status: "excluded", reason: preparation.reason }
      case "missing_location":
      case "no_cultivation":
        return { ...base, status: preparation.status }
      case "missing_harvest": {
        const main = preparation.mainCultivation
        let defaultHarvestDate: string | null = null
        try {
          const defaults = await getDefaultDatesOfCultivation(
            fdm,
            principal_id,
            b_id_farm,
            main.b_lu_catalogue,
            ctx.year,
          )
          defaultHarvestDate = defaults.b_lu_end ? toFdmDateString(defaults.b_lu_end) : null
        } catch {
          defaultHarvestDate = null
        }
        return {
          ...base,
          status: "missing_harvest",
          mainCultivation: summarizeCultivation(main),
          defaultHarvestDate,
        }
      }
      case "ready":
        break
    }

    const nmiApiKey = getNmiApiKey()
    if (!nmiApiKey) {
      return {
        ...base,
        status: "error",
        message: "De berekening is niet beschikbaar: er is geen NMI API-sleutel ingesteld.",
      }
    }

    const main = preparation.mainCultivation
    const request = options.transformRequest
      ? options.transformRequest(preparation.request, main, preparation.usedInput)
      : preparation.request
    const todayDate = toFdmDateString(ctx.today)
    const currentYear = Number(todayDate.slice(0, 4))

    const forecastPromise: Promise<WeatherForecast | null> =
      ctx.year === currentYear
        ? getWeatherForecast(fdm, {
            nmiApiKey,
            a_lat: roundCoordinate(request.field.a_lat),
            a_lon: roundCoordinate(request.field.a_lon),
            date: todayDate,
          }).catch(() => null)
        : Promise.resolve(null)

    const [{ result, partial }, forecast] = await Promise.all([
      runDyna(nmiApiKey, request, main.b_lu, todayDate),
      forecastPromise,
    ])

    const mainCultivation = request.cultivations?.find((c) => c.b_lu_id === main.b_lu)
    const mainStart = mainCultivation?.b_lu_start ?? `${ctx.year}-01-01`
    const mainHarvest =
      request.harvests?.filter((h) => h.b_lu_id === main.b_lu).at(-1)?.b_date_harvest ??
      mainCultivation?.b_lu_end ??
      `${ctx.year}-12-31`

    const insights = deriveMineralizationInsights({
      result,
      events: preparation.events,
      forecast,
      year: ctx.year,
      today: ctx.today,
      mainStart,
      mainHarvest,
    })

    return {
      ...base,
      status: "ok",
      mainCultivation: summarizeCultivation(main),
      result,
      insights,
      events: preparation.events,
      usedInput: preparation.usedInput,
      forecast,
      mainStart,
      mainHarvest,
      partial,
      fertilizerOptions: ctx.fertilizers.map((f) => ({
        p_id: f.p_id,
        p_name_nl: f.p_name_nl,
        p_app_amount_unit: f.p_app_amount_unit,
        p_app_method_options: f.p_app_method_options ?? [],
        p_type: f.p_type ?? null,
      })),
    }
  } catch (error) {
    console.error(`Mineralization calculation failed for field ${b_id}:`, error)
    return {
      ...base,
      status: "error",
      message: error instanceof NmiApiError ? error.message : "Er ging iets mis bij de berekening.",
    }
  }
}

/**
 * Calculates a what-if scenario for a field without saving it.
 *
 * @param args.scenario - Applications and harvest of the scenario; validate with
 *   `getMineralizationScenarioSchema(year)` first.
 * @returns The outcome of the field with the scenario applied.
 */
export async function calculateScenario(args: {
  principal_id: string
  b_id_farm: string
  b_id: string
  year: number
  scenario: MineralizationScenario
}): Promise<FieldMineralizationOutcome> {
  let ctx: FarmMineralizationContext
  try {
    ctx = await loadFarmMineralizationContext(args)
  } catch (error) {
    console.error(`Loading mineralization data failed for field ${args.b_id}:`, error)
    return {
      b_id: args.b_id,
      b_name: null,
      b_area: null,
      status: "error",
      message: "De gegevens van dit perceel konden niet worden geladen.",
    }
  }
  const fertilizers = new Map(ctx.fertilizers.map((f) => [f.p_id, f]))
  return calculateFieldMineralization(ctx, args.b_id, args.principal_id, args.b_id_farm, {
    transformRequest: (request, main, usedInput) =>
      applyScenarioToRequest({
        request,
        scenario: args.scenario,
        fertilizers,
        mainB_lu: main.b_lu,
        mainHarvestable: main.b_lu_harvestable,
        mainHarvestcat: main.b_lu_harvestcat,
        mainHarvestIds: usedInput.harvests
          .filter((h) => h.b_lu === main.b_lu)
          .map((h) => h.b_id_harvesting),
      }),
  })
}

/**
 * Saves a scenario to the fertilization plan of a field: fertilizer applications in the year and
 * the harvests of the main cultivation in the year are added, changed or removed, all in one
 * transaction.
 *
 * @throws `Error` when the field has no main cultivation in the year.
 */
export async function saveScenario(args: {
  principal_id: string
  b_id_farm: string
  b_id: string
  year: number
  scenario: MineralizationScenario
  /** The scenario as the user started editing it; only its applications and harvests can be changed. */
  base: MineralizationScenario
}): Promise<void> {
  const { principal_id, b_id, year, scenario } = args
  const ctx = await loadFarmMineralizationContext(args)
  const data = ctx.data.get(b_id)
  if (!data) throw new Error("Perceel niet gevonden")

  const preparation = prepareMineralizationInput(data, year, ctx.today)
  if (preparation.status !== "ready" && preparation.status !== "missing_harvest") {
    throw new Error("Dit perceel heeft geen hoofdteelt om een scenario voor op te slaan")
  }
  const main = preparation.mainCultivation

  const prefix = `${year}-`
  const currentApplications = data.applications.filter((a) =>
    toFdmDateString(a.p_app_date).startsWith(prefix),
  )
  const currentHarvests = (data.harvests.get(main.b_lu) ?? []).flatMap((h) => {
    if (!h.b_lu_harvest_date || !toFdmDateString(h.b_lu_harvest_date).startsWith(prefix)) {
      return []
    }
    const analysis = h.harvestable?.harvestable_analyses?.[0]
    const parameters: HarvestParameterValues = {}
    for (const key of HARVEST_PARAMETER_KEYS) {
      const value = analysis?.[key]
      if (value != null) parameters[key] = value
    }
    return [
      {
        b_id_harvesting: h.b_id_harvesting,
        b_date_harvest: toFdmDateString(h.b_lu_harvest_date),
        parameters,
      },
    ]
  })

  const diff = diffScenario(currentApplications, currentHarvests, scenario, args.base)

  const toDate = (date: string) => {
    const [y, m, d] = date.split("-").map(Number)
    return startOfDayInFdmTimeZone(y, m, d)
  }

  await fdm.transaction(async (tx) => {
    for (const p_app_id of diff.remove) {
      await removeFertilizerApplication(tx, principal_id, p_app_id)
    }
    for (const app of diff.update) {
      await updateFertilizerApplication(
        tx,
        principal_id,
        app.p_app_id,
        app.p_id,
        app.p_app_amount_display,
        app.p_app_method as ApplicationMethods,
        toDate(app.p_app_date),
      )
    }
    for (const app of diff.add) {
      await addFertilizerApplication(
        tx,
        principal_id,
        b_id,
        app.p_id,
        app.p_app_amount_display,
        app.p_app_method as ApplicationMethods,
        toDate(app.p_app_date),
      )
    }
    // Harvests are saved with the parameters of their harvest class, as in the harvest form;
    // fdm-core derives the dry matter yield and nitrogen content from them
    const required = getParametersForHarvestCat(main.b_lu_harvestcat)
    const harvestProperties = (harvest: { parameters?: HarvestParameterValues }) => {
      if (!harvest.parameters || required.length === 0) return undefined
      const properties: HarvestParameterValues = {}
      for (const key of required) {
        const value = harvest.parameters[key]
        if (value === undefined) {
          throw new Error("Vul bij elke gewijzigde oogst alle gegevens in.")
        }
        properties[key] = value
      }
      return properties
    }
    for (const b_id_harvesting of diff.harvests.remove) {
      await removeHarvest(tx, principal_id, b_id_harvesting)
    }
    for (const harvest of diff.harvests.update) {
      await updateHarvest(
        tx,
        principal_id,
        harvest.b_id_harvesting,
        toDate(harvest.b_date_harvest),
        harvestProperties(harvest),
      )
    }
    for (const harvest of diff.harvests.add) {
      await addHarvest(
        tx,
        principal_id,
        main.b_lu,
        toDate(harvest.b_date_harvest),
        harvestProperties(harvest),
      )
    }
  })
}
