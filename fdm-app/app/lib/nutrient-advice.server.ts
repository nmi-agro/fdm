import {
  type FarmNutrientAdviceRow,
  NUTRIENT_ADVICE_CONCURRENCY,
  startFarmNutrientAdviceRows as startRows,
} from "@nmi-agro/fdm-calculator"
import { checkPermission, type getFields, type Timeframe } from "@nmi-agro/fdm-core"
import type { FieldNutrientRow } from "~/components/blocks/nutrient-advice/overview-types"
import { toFriendlyAdviceError } from "~/components/blocks/nutrient-advice/overview-errors"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { fdm } from "~/lib/fdm.server"
import { handleLoaderError } from "./error"

export { NUTRIENT_ADVICE_CONCURRENCY }

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
 * Converts a row from `fdm-calculator` to the row shape of the overview table, with a Dutch
 * error message.
 */
function toFieldNutrientRow(
  row: FarmNutrientAdviceRow,
  has_write_permission: boolean | undefined,
): FieldNutrientRow {
  const values: FieldNutrientRow["values"] = {}
  for (const [symbol, value] of Object.entries(row.values)) {
    if (value) values[symbol] = { filling: value.dose, advice: value.advice }
  }

  let errorMessage: string | undefined
  if (row.error?.code === "no_cultivation") {
    errorMessage = "Geen gewas geregistreerd voor dit perceel."
  } else if (row.error?.code === "no_main_cultivation") {
    errorMessage = "Geen hoofdteelt bepaald voor dit jaar."
  } else if (row.error) {
    errorMessage = toFriendlyAdviceError(new Error(row.error.message))
  }

  return {
    b_id: row.b_id,
    b_name: row.b_name,
    b_area: row.b_area,
    mainCultivation: row.mainCultivation
      ? {
          b_lu: row.mainCultivation.b_lu,
          b_lu_name: row.mainCultivation.b_lu_name,
          b_lu_croprotation: row.mainCultivation.b_lu_croprotation,
        }
      : null,
    cultivationSuggestion: row.cultivationSuggestion,
    has_write_permission,
    ...(errorMessage ? { errorMessage } : {}),
    values,
  }
}

/**
 * Starts calculating the nutrient advice and the already applied dose for every field of a farm,
 * and returns one promise per field, so React Router can stream each field when it is ready.
 * The calculation itself lives in `fdm-calculator` (`startFarmNutrientAdviceRows`), so the app
 * and the REST API give the same result.
 *
 * Shared by the Bemestingsadvies overview (`nutrient_advice._index`) and the Atlas layer
 * (`atlas.nutrient-advice._index`).
 *
 * @param args - Session principal, farm, calendar year and timeframe.
 * @param fields - Fields of the farm, as returned by `getFields`.
 * @returns One promise of a {@link FieldNutrientRow} per field, in the same order as `fields`.
 * Values are in kg/ha. The promises never reject.
 */
export function startFarmNutrientAdviceRows(
  args: FarmNutrientAdviceArgs,
  fields: FarmField[],
): Promise<FieldNutrientRow>[] {
  if (fields.length === 0) {
    return []
  }

  // Researchers have read-only access: the BRP suggestion is shown to them with an explanation
  // instead of the accept flow. Checked once per farm, and never throws.
  const farmWritePermission = checkPermission(
    fdm,
    "farm",
    "write",
    args.b_id_farm,
    args.principal_id,
    "nutrient-advice",
    false,
  ).catch((err) => {
    // Assume there is no farm write permission if the permission check fails.
    handleLoaderError(err)
    return false
  })

  return startRows({
    fdm,
    principal_id: args.principal_id,
    b_id_farm: args.b_id_farm,
    year: Number(args.calendar),
    timeframe: args.timeframe,
    fields,
    nmiApiKey: getNmiApiKey(),
  }).map(async (row) => {
    const resolved = await row
    // Only rows with a crop suggestion need the permission, for the accept flow.
    const has_write_permission = resolved.cultivationSuggestion
      ? await farmWritePermission
      : undefined
    return toFieldNutrientRow(resolved, has_write_permission)
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
