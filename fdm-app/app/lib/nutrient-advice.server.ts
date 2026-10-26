import type { getFields, Timeframe } from "@nmi-agro/fdm-core"
import { calculateDose, getNutrientAdvice } from "@nmi-agro/fdm-calculator"
import {
  getCultivationsForFarm,
  getCurrentSoilDataForFarm,
  getFertilizerApplicationsForFarm,
  getFertilizers,
} from "@nmi-agro/fdm-core"
import type { FieldNutrientRow } from "~/components/blocks/nutrient-advice/overview-types"
import { getNutrientsDescription } from "~/components/blocks/nutrient-advice/nutrients"
import { toFriendlyAdviceError } from "~/components/blocks/nutrient-advice/overview-errors"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getCultivationSuggestion } from "~/lib/cultivation-suggestion.server"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"

/**
 * Cap on simultaneous `getNutrientAdvice` calls per farm, so farms with many fields don't overload
 * the external NMI API with unbounded parallel requests.
 */
export const NUTRIENT_ADVICE_CONCURRENCY = 4

/** A field as returned by `getFields`. */
type FarmField = Awaited<ReturnType<typeof getFields>>[number]

/** Request context needed to calculate the nutrient advice of a farm. */
export type FarmNutrientAdviceArgs = {
  /** Principal of the current session, used for permission checks in fdm-core. */
  principal_id: string
  /** Farm whose fields are evaluated. */
  b_id_farm: string
  /** Calendar year (e.g. `"2026"`), used to select the main cultivation ("hoofdteelt"). */
  calendar: string
  /** Timeframe of the calendar year, used to select cultivations and fertilizer applications. */
  timeframe: Timeframe
}

/**
 * Creates a limiter that runs at most `limit` tasks at the same time. A new task starts as soon as
 * any running task settles, so one slow task does not hold back a whole batch.
 *
 * @param limit - Maximum number of tasks running at once; must be at least 1.
 * @returns A function that schedules a task and resolves or rejects with its result.
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

/**
 * Builds a row for a field whose advice could not be calculated.
 *
 * @param field - The field the row belongs to.
 * @param errorMessage - User-facing (Dutch) reason.
 * @returns A {@link FieldNutrientRow} without nutrient values.
 */
function errorRow(field: FarmField, errorMessage: string): FieldNutrientRow {
  return {
    b_id: field.b_id,
    b_name: field.b_name,
    b_area: field.b_area ?? 0,
    mainCultivation: null,
    errorMessage,
    values: {},
  }
}

/**
 * Starts calculating the nutrient advice and the already applied dose for every field of a farm,
 * and returns one promise per field, so callers can show each field as soon as it is ready.
 *
 * Farm-wide data (cultivations, fertilizer applications, soil data and fertilizers) is fetched once
 * in a single batch. The NMI advice API is then called per field, with at most
 * {@link NUTRIENT_ADVICE_CONCURRENCY} requests running at the same time; the next field starts as
 * soon as any running request finishes.
 *
 * The promises never reject for data problems: every failure is turned into a row with
 * `errorMessage` set, so one failing field does not break the overview table or the atlas layer.
 * React Router can stream the returned promises to the client one by one.
 *
 * Shared by the Bemestingsadvies overview (`nutrient_advice._index`) and the Atlas layer
 * (`atlas.nutrient-advice._index`).
 *
 * @param args - Session principal, farm, calendar year and timeframe.
 * @param fields - Fields of the farm, as returned by `getFields`.
 * @returns One promise of a {@link FieldNutrientRow} per field, in the same order as `fields`.
 * Values are in kg/ha.
 */
export function startFarmNutrientAdviceRows(
  args: FarmNutrientAdviceArgs,
  fields: FarmField[],
): Promise<FieldNutrientRow>[] {
  const { principal_id, b_id_farm, calendar, timeframe } = args

  if (fields.length === 0) {
    return []
  }

  const nutrientsDescription = getNutrientsDescription()
  const nmiApiKey = getNmiApiKey()

  // Fetch farm-wide data in a handful of batched queries instead of N queries per field. If this
  // batch fails, every field gets an error row instead of the route error boundary.
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
    (error: unknown) => ({ ok: false as const, errorMessage: toFriendlyAdviceError(error) }),
  )

  /** Calculates the row of a single field. May throw; the caller maps rejections to error rows. */
  async function getRow(
    field: FarmField,
    data: Extract<Awaited<typeof farmData>, { ok: true }>,
  ): Promise<FieldNutrientRow> {
    const cultivations = data.cultivationsByField.get(field.b_id) ?? []
    const b_area = field.b_area ?? 0

    if (cultivations.length === 0) {
      return errorRow(field, "Geen gewas geregistreerd voor dit perceel.")
    }

    const activeCultivation = getMainCultivation(cultivations, calendar)
    const fertilizerApplications = data.fertilizerApplicationsByField.get(field.b_id) ?? []
    const currentSoilData = data.soilDataByField.get(field.b_id) ?? []

    // Only ask the NMI API for a crop suggestion when no main cultivation is registered.
    const cultivationSuggestion = activeCultivation
      ? undefined
      : await getCultivationSuggestion(
          fdm,
          principal_id,
          b_id_farm,
          field.b_id,
          calendar,
          nmiApiKey,
        )

    if (!activeCultivation) {
      return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_area,
        mainCultivation: null,
        cultivationSuggestion,
        errorMessage: "Geen hoofdteelt bepaald voor dit jaar.",
        values: {},
      }
    }

    const mainCultivation = {
      b_lu: activeCultivation.b_lu,
      b_lu_name: activeCultivation.b_lu_name,
      b_lu_croprotation: activeCultivation.b_lu_croprotation ?? null,
    }

    try {
      const doses = calculateDose({
        applications: fertilizerApplications,
        fertilizers: data.fertilizers,
      })
      const nutrientAdvice = await getNutrientAdvice(fdm, {
        b_lu_catalogue: activeCultivation.b_lu_catalogue,
        b_centroid: field.b_centroid,
        currentSoilData,
        nmiApiKey,
        b_bufferstrip: field.b_bufferstrip,
      })

      // Same advice/dose mapping as the overview table: `d_*_req` vs `p_dose_*`, both kg/ha.
      const values: FieldNutrientRow["values"] = {}
      for (const nutrient of nutrientsDescription) {
        values[nutrient.symbol] = {
          filling: (doses.dose[nutrient.doseParameter as keyof typeof doses.dose] as number) ?? 0,
          advice:
            nutrientAdvice[
              nutrient.adviceParameter as Exclude<keyof typeof nutrientAdvice, "cuts">
            ] ?? 0,
        }
      }

      return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_area,
        mainCultivation,
        cultivationSuggestion,
        values,
      }
    } catch (error) {
      return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_area,
        mainCultivation,
        cultivationSuggestion,
        errorMessage: toFriendlyAdviceError(error),
        values: {},
      }
    }
  }

  const limit = createLimiter(NUTRIENT_ADVICE_CONCURRENCY)
  return fields.map(async (field) => {
    const data = await farmData
    if (!data.ok) return errorRow(field, data.errorMessage)
    try {
      return await limit(() => getRow(field, data))
    } catch (error) {
      return errorRow(field, toFriendlyAdviceError(error))
    }
  })
}

/**
 * Calculates the nutrient advice and the already applied dose for every field of a farm and waits
 * for all of them. Use {@link startFarmNutrientAdviceRows} instead to show fields as they arrive.
 *
 * @param args - Session principal, farm, calendar year and timeframe.
 * @param fields - Fields of the farm, as returned by `getFields`.
 * @returns One {@link FieldNutrientRow} per field, in the same order as `fields`. Values are in kg/ha.
 */
export function getFarmNutrientAdviceRows(
  args: FarmNutrientAdviceArgs,
  fields: FarmField[],
): Promise<FieldNutrientRow[]> {
  return Promise.all(startFarmNutrientAdviceRows(args, fields))
}
