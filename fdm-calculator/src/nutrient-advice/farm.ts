import type { Cultivation, FdmType, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import {
  getCultivationsForFarm,
  getCurrentSoilDataForFarm,
  getFertilizerApplicationsForFarm,
  getFertilizers,
} from "@nmi-agro/fdm-core"
import type { Dose } from "../doses/d"
import type { NutrientAdvice } from "./types"
import { calculateDose } from "../doses/calculate-dose"
import {
  type CultivationSuggestion,
  getCultivationSuggestion,
} from "../other/cultivation-suggestion"
import { findHoofdteelt } from "../shared/hoofdteelt"
import { getNutrientAdvice } from "./index"

/**
 * The nutrients reported in a farm nutrient advice overview, with the advice and dose parameter
 * that belong to each. Advice values come from the NMI nutrient advice (`d_*_req`), dose values
 * from the applied fertilizers (`p_dose_*`). Both are in kg per hectare.
 */
export const FARM_NUTRIENT_ADVICE_NUTRIENTS = [
  { symbol: "N", unit: "kg N/ha", adviceParameter: "d_n_req", doseParameter: "p_dose_nw" },
  { symbol: "P", unit: "kg P2O5/ha", adviceParameter: "d_p_req", doseParameter: "p_dose_p" },
  { symbol: "K", unit: "kg K2O/ha", adviceParameter: "d_k_req", doseParameter: "p_dose_k" },
  { symbol: "EOC", unit: "kg EOC/ha", adviceParameter: "d_c_req", doseParameter: "p_dose_eoc" },
  { symbol: "S", unit: "kg S/ha", adviceParameter: "d_s_req", doseParameter: "p_dose_s" },
  { symbol: "Mg", unit: "kg MgO/ha", adviceParameter: "d_mg_req", doseParameter: "p_dose_mg" },
  { symbol: "Ca", unit: "kg CaO/ha", adviceParameter: "d_ca_req", doseParameter: "p_dose_ca" },
  { symbol: "Na", unit: "kg Na/ha", adviceParameter: "d_na_req", doseParameter: "p_dose_na" },
  { symbol: "Cu", unit: "kg Cu/ha", adviceParameter: "d_cu_req", doseParameter: "p_dose_cu" },
  { symbol: "Zn", unit: "kg Zn/ha", adviceParameter: "d_zn_req", doseParameter: "p_dose_zn" },
  { symbol: "Co", unit: "kg Co/ha", adviceParameter: "d_co_req", doseParameter: "p_dose_co" },
  { symbol: "Mn", unit: "kg Mn/ha", adviceParameter: "d_mn_req", doseParameter: "p_dose_mn" },
  { symbol: "Mo", unit: "kg Mo/ha", adviceParameter: "d_mo_req", doseParameter: "p_dose_mo" },
  { symbol: "B", unit: "kg B/ha", adviceParameter: "d_b_req", doseParameter: "p_dose_b" },
] as const satisfies readonly {
  symbol: string
  unit: string
  adviceParameter: Exclude<keyof NutrientAdvice, "cuts">
  doseParameter: keyof Dose
}[]

/** Symbol of a nutrient in a farm nutrient advice overview, for example `N` or `P`. */
export type FarmNutrientSymbol = (typeof FARM_NUTRIENT_ADVICE_NUTRIENTS)[number]["symbol"]

/** Maximum number of nutrient advice requests per farm that run at the same time. */
export const NUTRIENT_ADVICE_CONCURRENCY = 4

/**
 * Why the nutrient advice of a field could not be calculated.
 *
 * - `no_cultivation`: the field has no cultivation in the timeframe.
 * - `no_main_cultivation`: the field has cultivations, but none is the main cultivation of the year.
 * - `farm_data_unavailable`: the farm's cultivations, applications, soil data or fertilizers could not be read.
 * - `advice_failed`: the dose or the nutrient advice could not be calculated.
 */
export type FarmNutrientAdviceErrorCode =
  | "no_cultivation"
  | "no_main_cultivation"
  | "farm_data_unavailable"
  | "advice_failed"

/** Advice, applied dose and remaining advice of one nutrient on one field. */
export type FarmNutrientAdviceValue = {
  /** Advised amount, from the nutrient advice. */
  advice: number
  /** Amount already applied with fertilizers. */
  dose: number
  /** `advice - dose`. A negative value means more was applied than advised. */
  remaining: number
}

/** The nutrient advice of one field of a farm. */
export type FarmNutrientAdviceRow = {
  /** ID of the field. */
  b_id: string
  /** Name of the field. */
  b_name: string
  /** Area of the field in hectares. */
  b_area: number
  /** The main cultivation of the year the advice is for, or `null` when there is none. */
  mainCultivation: {
    b_lu: string
    b_lu_catalogue: string
    b_lu_name: string
    b_lu_croprotation: string | null
  } | null
  /** A suggested main cultivation, only set when the field has no main cultivation. */
  cultivationSuggestion?: CultivationSuggestion
  /** Set when the advice could not be calculated. `message` is a technical description in English. */
  error?: { code: FarmNutrientAdviceErrorCode; message: string }
  /** Values per nutrient. Empty when `error` is set. */
  values: Partial<Record<FarmNutrientSymbol, FarmNutrientAdviceValue>>
}

/** The fields of a farm to calculate the nutrient advice for. */
export type FarmNutrientAdviceField = {
  b_id: string
  b_name: string
  b_area: number | null
  b_centroid: [number, number]
  b_bufferstrip: boolean
}

/** Input for {@link startFarmNutrientAdviceRows}. */
export type FarmNutrientAdviceInput = {
  /** The FDM instance. */
  fdm: FdmType
  /** The principal making the request. Permissions are checked by fdm-core. */
  principal_id: PrincipalId
  /** The farm to calculate the advice for. */
  b_id_farm: string
  /** Calendar year of the advice, used to select the main cultivation. */
  year: number
  /** Timeframe used to select cultivations, fertilizer applications and soil data. */
  timeframe: Timeframe
  /** Fields of the farm, for example from `getFields`. */
  fields: FarmNutrientAdviceField[]
  /** NMI API key used for the nutrient advice and cultivation suggestions. */
  nmiApiKey: string | undefined
  /** Maximum number of advice requests running at the same time. Defaults to {@link NUTRIENT_ADVICE_CONCURRENCY}. */
  concurrency?: number
}

/**
 * Returns the main cultivation of a year, or `undefined` when no cultivation is present in the
 * period of 15 May to 15 July of that year. Unlike `findHoofdteelt`, this never falls back to the
 * regulatory default crop, so it is suitable for showing to users.
 *
 * @param cultivations - Cultivations of a field.
 * @param year - Calendar year.
 * @returns The main cultivation, or `undefined`.
 */
export function findMainCultivation<T extends Cultivation>(
  cultivations: T[],
  year: number,
): T | undefined {
  if (cultivations.length === 0) return undefined
  return findHoofdteelt(cultivations, year, true) ?? undefined
}

/**
 * Creates a limiter that runs at most `limit` tasks at the same time. A new task starts as soon
 * as a running task settles.
 */
function createLimiter(limit: number) {
  let active = 0
  const queue: (() => void)[] = []

  const next = () => {
    if (active >= limit) return
    const start = queue.shift()
    if (!start) return
    active += 1
    start()
  }

  return function run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1
            next()
          })
      })
      next()
    })
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorRow(
  field: FarmNutrientAdviceField,
  code: FarmNutrientAdviceErrorCode,
  message: string,
): FarmNutrientAdviceRow {
  return {
    b_id: field.b_id,
    b_name: field.b_name,
    b_area: field.b_area ?? 0,
    mainCultivation: null,
    error: { code, message },
    values: {},
  }
}

/**
 * Starts calculating the nutrient advice, the applied dose and the remaining advice for every
 * field of a farm, and returns one promise per field so callers can show each field when it is
 * ready.
 *
 * Farm-wide data is read once. The nutrient advice is then requested per field, with at most
 * `concurrency` requests at the same time. The promises never reject: a failure becomes a row
 * with `error` set, so one field does not break the whole overview.
 *
 * @param input - Farm, year, fields and NMI API key.
 * @returns One promise per field, in the same order as `input.fields`. Values are per hectare.
 * @example
 * ```ts
 * const rows = await Promise.all(startFarmNutrientAdviceRows({ fdm, principal_id, b_id_farm, year: 2026, timeframe, fields, nmiApiKey }))
 * ```
 */
export function startFarmNutrientAdviceRows(
  input: FarmNutrientAdviceInput,
): Promise<FarmNutrientAdviceRow>[] {
  const { fdm, principal_id, b_id_farm, year, timeframe, fields, nmiApiKey } = input
  if (fields.length === 0) return []

  const farmData = Promise.all([
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizers(fdm, principal_id, b_id_farm),
  ]).then(
    ([cultivationsByField, fertilizerApplicationsByField, soilDataByField, fertilizers]) => ({
      ok: true as const,
      cultivationsByField,
      fertilizerApplicationsByField,
      soilDataByField,
      fertilizers,
    }),
    (error: unknown) => ({ ok: false as const, message: errorMessage(error) }),
  )

  async function getRow(
    field: FarmNutrientAdviceField,
    data: Extract<Awaited<typeof farmData>, { ok: true }>,
  ): Promise<FarmNutrientAdviceRow> {
    const cultivations = data.cultivationsByField.get(field.b_id) ?? []
    const b_area = field.b_area ?? 0

    if (cultivations.length === 0) {
      return errorRow(field, "no_cultivation", "No cultivation registered for this field.")
    }

    const main = findMainCultivation(cultivations, year)
    if (!main) {
      const cultivationSuggestion = await getCultivationSuggestion(
        fdm,
        principal_id,
        b_id_farm,
        field.b_id,
        year,
        nmiApiKey,
      )
      return {
        ...errorRow(field, "no_main_cultivation", `No main cultivation found for ${year}.`),
        cultivationSuggestion,
      }
    }

    const mainCultivation = {
      b_lu: main.b_lu,
      b_lu_catalogue: main.b_lu_catalogue,
      b_lu_name: main.b_lu_name,
      b_lu_croprotation: main.b_lu_croprotation ?? null,
    }

    try {
      const doses = calculateDose({
        applications: data.fertilizerApplicationsByField.get(field.b_id) ?? [],
        fertilizers: data.fertilizers,
      })
      const advice = await getNutrientAdvice(fdm, {
        b_lu_catalogue: main.b_lu_catalogue,
        b_centroid: field.b_centroid,
        currentSoilData: data.soilDataByField.get(field.b_id) ?? [],
        nmiApiKey,
        b_bufferstrip: field.b_bufferstrip,
      })

      const values: FarmNutrientAdviceRow["values"] = {}
      for (const nutrient of FARM_NUTRIENT_ADVICE_NUTRIENTS) {
        const adviceValue = advice[nutrient.adviceParameter] ?? 0
        const doseValue = (doses.dose[nutrient.doseParameter] as number | undefined) ?? 0
        values[nutrient.symbol] = {
          advice: adviceValue,
          dose: doseValue,
          remaining: adviceValue - doseValue,
        }
      }

      return { b_id: field.b_id, b_name: field.b_name, b_area, mainCultivation, values }
    } catch (error) {
      return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_area,
        mainCultivation,
        error: { code: "advice_failed", message: errorMessage(error) },
        values: {},
      }
    }
  }

  const limit = createLimiter(Math.max(1, input.concurrency ?? NUTRIENT_ADVICE_CONCURRENCY))
  return fields.map(async (field) => {
    const data = await farmData
    if (!data.ok) return errorRow(field, "farm_data_unavailable", data.message)
    try {
      return await limit(() => getRow(field, data))
    } catch (error) {
      return errorRow(field, "advice_failed", errorMessage(error))
    }
  })
}

/**
 * Calculates the nutrient advice of every field of a farm and waits for all fields.
 * See {@link startFarmNutrientAdviceRows}.
 *
 * @param input - Farm, year, fields and NMI API key.
 * @returns One row per field, in the same order as `input.fields`.
 */
export function getFarmNutrientAdviceRows(
  input: FarmNutrientAdviceInput,
): Promise<FarmNutrientAdviceRow[]> {
  return Promise.all(startFarmNutrientAdviceRows(input))
}
