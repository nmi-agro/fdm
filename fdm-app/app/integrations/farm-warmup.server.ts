/**
 * Fills the calculation cache of a farm before the user opens its calculation pages.
 *
 * The indicators, measures, nutrient advice and usage norms ("gebruiksruimte") pages read their
 * results through `withCalculationCache`. On a cache miss they call the NMI API per field, which
 * takes tens of seconds on larger farms. The warm-up runs the same farm-level calculations ahead
 * of time, so these pages usually find their results in the cache.
 */
import { getFields } from "@nmi-agro/fdm-core"
import { getTimeframe } from "~/lib/calendar"
import { reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { startFarmNutrientAdviceRows } from "~/lib/nutrient-advice.server"
import { withTiming } from "~/lib/timing.server"
import {
  collectFarmMeasureInputs,
  getIndicatorsForFarm,
  getMeasureAdviceForFields,
  getMeasureApplicabilityForFields,
} from "./bln3.server"
import { calculateFarmNorms, collectFarmNormsContext, isNormsCalendar } from "./farm-norms.server"

/** Name of the PostHog event that records how long a warm-up took. */
const TIMING_EVENT = "farm_calculations_warmup"

/** The arguments of {@link warmFarmCalculations}. */
export interface WarmFarmCalculationsArgs {
  /** Principal of the current session; the calculations read the farm as this principal. */
  principal_id: string
  /** The farm to warm. */
  b_id_farm: string
  /** The calendar year (e.g. `"2026"`), as used in the routes of the calculation pages. */
  calendar: string
}

/** The warm-ups that are running on this instance, by farm and calendar year. */
const running = new Map<string, Promise<void>>()

/**
 * Runs the farm-level calculations of the indicators, measures, nutrient advice and usage norms
 * pages, so their results are in the calculation cache when the user opens these pages.
 *
 * The calculations use the same input collectors and helpers as the pages, because a cached
 * result is only found when the inputs are exactly the same. The groups run one after another,
 * so the farm never has more NMI API requests open at the same time than a page itself:
 *
 * 1. Nutrient advice and usage norms (the norms only for the years that have them).
 * 2. BLN3 scores.
 * 3. BLN3 measure applicability and advice.
 *
 * A warm-up only fills the cache. A failing step is reported and the next step still runs; the
 * returned promise never rejects. When a warm-up of the same farm and year is already running
 * on this instance, the returned promise waits for that one instead of starting another; that
 * warm-up may have collected its inputs before a recent edit, which the pages then calculate on
 * their first visit. Other
 * instances do not see it, so two instances can warm the same farm at the same time; that only
 * repeats work, because both write the same results.
 *
 * The caller must check that the principal may read the farm.
 *
 * @param args - Session principal, farm and calendar year.
 * @returns Resolves when all calculations have finished. New results can reach the cache up to
 *   about a second later, because the cache writes them in batches.
 */
export function warmFarmCalculations(args: WarmFarmCalculationsArgs): Promise<void> {
  const key = `${args.b_id_farm}:${args.calendar}`
  const existing = running.get(key)
  if (existing) return existing

  const warmup = withTiming(
    args.principal_id,
    TIMING_EVENT,
    { b_id_farm: args.b_id_farm, calendar: args.calendar },
    () => runWarmup(args),
  )
    .catch((error: unknown) => {
      reportError(error, { scope: "farm-warmup" }, { b_id_farm: args.b_id_farm })
    })
    .finally(() => running.delete(key))
  running.set(key, warmup)
  return warmup
}

async function runWarmup({ principal_id, b_id_farm, calendar }: WarmFarmCalculationsArgs) {
  const timeframe = getTimeframe({ calendar })
  const fields = await getFields(fdm, principal_id, b_id_farm, timeframe)
  if (fields.length === 0) return

  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      await run()
    } catch (error) {
      reportError(error, { scope: "farm-warmup", step: name }, { b_id_farm, calendar })
    }
  }

  await Promise.all([
    // As on the nutrient advice page; the rows never reject
    step("nutrient-advice", () =>
      Promise.all(
        startFarmNutrientAdviceRows({ principal_id, b_id_farm, calendar, timeframe }, fields),
      ),
    ),
    // As on the usage norms page
    step("norms", async () => {
      if (!isNormsCalendar(calendar)) return
      const context = await collectFarmNormsContext({
        fdm,
        principal_id,
        b_id_farm,
        calendar,
        fields,
      })
      await calculateFarmNorms(fdm, context)
    }),
  ])

  // As on the indicators page; the measures page reads the same scores
  await step("bln3-scores", () =>
    getIndicatorsForFarm({ principal_id, b_id_farm, timeframe, preloadedFields: fields }),
  )

  // As on the measures page, which covers all fields; the indicators page asks for a subset
  await step("bln3-measures", async () => {
    const inputs = await collectFarmMeasureInputs({
      principal_id,
      b_id_farm,
      b_ids: fields.map((field) => field.b_id),
      b_year: Number(calendar),
      timeframe,
    })
    await Promise.all([getMeasureApplicabilityForFields(inputs), getMeasureAdviceForFields(inputs)])
  })
}
