import {
  calculateNitrogenBalancesFieldToFarm,
  collectInputForNitrogenBalance,
  createFunctionsForNorms,
  fdmCalculator,
  type GebruiksnormResult,
  getNitrogenBalanceField,
  getNutrientAdvice,
  GROENE_BRAAK,
  type NitrogenBalanceFieldNumeric,
  type NitrogenBalanceFieldResultNumeric,
  type NitrogenBalanceNumeric,
} from "@nmi-agro/fdm-calculator"
/**
 * Generic registry for the per-field calculations that farm/organization-level pages want to show
 * from cache immediately while stale/missing entries are recomputed in the background.
 *
 * Every job type here wraps one of the existing, already-cached calculator functions
 * (`getNitrogenBalanceField`, `getNutrientAdvice`, the NL norm value getters). We deliberately do
 * not duplicate their calculation logic: we compute the exact same input they would compute, ask
 * `fdm-core` for the current cache status of that `(function, version, input)` triple, and — if a
 * recompute is needed — acquire the shared `calculation_cache.is_processing` lock before invoking
 * the existing cached getter. Because the getter's own cache write uses `ON CONFLICT DO NOTHING`,
 * it safely no-ops against our lock placeholder; our own `releaseCalculationLock` call is what
 * actually persists the final result.
 */
import {
  computeCacheKey,
  type Field,
  type FdmType,
  getCachedCalculationEntry,
  getCalculationCacheStatus,
  getCultivations,
  getCurrentSoilData,
  getField,
  type PrincipalId,
  releaseCalculationLock,
  type Timeframe,
  tryAcquireCalculationLock,
} from "@nmi-agro/fdm-core"
import type { CalculationJobRequest } from "~/lib/calculation-jobs"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"

export type { CalculationJobRequest, CalculationJobType } from "~/lib/calculation-jobs"
export { getCalculationJobKey } from "~/lib/calculation-jobs"

interface CalculationJobContext {
  fdm: FdmType
  principal_id: PrincipalId
  timeframe: Timeframe
}

interface CalculationJobMeta {
  calculationFunctionName: string
  calculatorVersion: string
  sensitiveKeys: string[]
  input: object
  entityType: string
  entityId: string
  run: () => Promise<unknown>
}

const NORM_NITROGEN_2025 = "calculateNL2025StikstofGebruiksNorm"
const NORM_PHOSPHATE_2025 = "calculateNL2025FosfaatGebruiksNorm"
const NORM_MANURE_2025 = "calculateNL2025DierlijkeMestGebruiksNorm"
const NORM_NITROGEN_2026 = "calculateNL2026StikstofGebruiksNorm"
const NORM_PHOSPHATE_2026 = "calculateNL2026FosfaatGebruiksNorm"
const NORM_MANURE_2026 = "calculateNL2026DierlijkeMestGebruiksNorm"
const NORM_RENURE_2026 = "calculateNL2026RenureGebruiksNorm"

async function collectNormJobMeta(
  ctx: CalculationJobContext,
  job: CalculationJobRequest,
): Promise<CalculationJobMeta> {
  if (job.calendar === "2026") {
    const functionsForNorms = createFunctionsForNorms("NL", "2026")
    const input = await functionsForNorms.collectInputForNorms(ctx.fdm, ctx.principal_id, job.b_id)
    const byType = {
      normNitrogen: { fn: functionsForNorms.calculateNormForNitrogen, name: NORM_NITROGEN_2026 },
      normPhosphate: {
        fn: functionsForNorms.calculateNormForPhosphate,
        name: NORM_PHOSPHATE_2026,
      },
      normManure: { fn: functionsForNorms.calculateNormForManure, name: NORM_MANURE_2026 },
      normRenure: { fn: functionsForNorms.calculateNormForRenure, name: NORM_RENURE_2026 },
    } as const
    if (
      job.type !== "normNitrogen" &&
      job.type !== "normPhosphate" &&
      job.type !== "normManure" &&
      job.type !== "normRenure"
    ) {
      throw new Error(`Unsupported norm job type: ${job.type}`)
    }
    const entry = byType[job.type]
    return {
      calculationFunctionName: entry.name,
      calculatorVersion: fdmCalculator.calculatorVersion,
      sensitiveKeys: [],
      input,
      entityType: "field",
      entityId: job.b_id,
      run: () => entry.fn(ctx.fdm, input),
    }
  }

  if (job.type === "normRenure") {
    throw new Error("Renure norm only applies to calendar year 2026")
  }

  const functionsForNorms = createFunctionsForNorms("NL", "2025")
  const input = await functionsForNorms.collectInputForNorms(ctx.fdm, ctx.principal_id, job.b_id)
  const byType = {
    normNitrogen: { fn: functionsForNorms.calculateNormForNitrogen, name: NORM_NITROGEN_2025 },
    normPhosphate: { fn: functionsForNorms.calculateNormForPhosphate, name: NORM_PHOSPHATE_2025 },
    normManure: { fn: functionsForNorms.calculateNormForManure, name: NORM_MANURE_2025 },
  } as const
  if (job.type !== "normNitrogen" && job.type !== "normPhosphate" && job.type !== "normManure") {
    throw new Error(`Unsupported norm job type: ${job.type}`)
  }
  const entry = byType[job.type]
  return {
    calculationFunctionName: entry.name,
    calculatorVersion: fdmCalculator.calculatorVersion,
    sensitiveKeys: [],
    input,
    entityType: "field",
    entityId: job.b_id,
    run: () => entry.fn(ctx.fdm, input),
  }
}

async function collectJobMeta(
  ctx: CalculationJobContext,
  job: CalculationJobRequest,
): Promise<CalculationJobMeta> {
  switch (job.type) {
    case "nitrogenBalance": {
      const { fields, ...rest } = await collectInputForNitrogenBalance(
        ctx.fdm,
        ctx.principal_id,
        job.b_id_farm,
        ctx.timeframe,
        job.b_id,
      )
      if (fields.length === 0) {
        throw new Error(`Field ${job.b_id} not found for farm ${job.b_id_farm}`)
      }
      const input = { fieldInput: fields[0], ...rest }
      return {
        calculationFunctionName: "calculateNitrogenBalanceField",
        calculatorVersion: fdmCalculator.calculatorVersion,
        sensitiveKeys: [],
        input,
        entityType: "field",
        entityId: job.b_id,
        run: () => getNitrogenBalanceField(ctx.fdm, input),
      }
    }
    case "nutrientAdvice": {
      const nmiApiKey = getNmiApiKey()
      const [currentSoilData, field, cultivations] = await Promise.all([
        getCurrentSoilData(ctx.fdm, ctx.principal_id, job.b_id),
        getField(ctx.fdm, ctx.principal_id, job.b_id),
        getCultivations(ctx.fdm, ctx.principal_id, job.b_id, ctx.timeframe),
      ])
      let b_lu_catalogue: string
      if (!cultivations.length) {
        b_lu_catalogue = GROENE_BRAAK
      } else {
        const mainCultivation = getMainCultivation(cultivations, job.calendar)
        b_lu_catalogue = mainCultivation?.b_lu_catalogue ?? GROENE_BRAAK
      }
      const input = {
        b_lu_catalogue,
        b_centroid: field.b_centroid,
        currentSoilData,
        nmiApiKey,
        b_bufferstrip: field.b_bufferstrip,
        b_id: job.b_id,
      }
      return {
        calculationFunctionName: "requestNutrientAdvice",
        calculatorVersion: fdmCalculator.calculatorVersion,
        sensitiveKeys: ["nmiApiKey", "b_id"],
        input,
        entityType: "field",
        entityId: job.b_id,
        run: () => getNutrientAdvice(ctx.fdm, input),
      }
    }
    case "normNitrogen":
    case "normPhosphate":
    case "normManure":
    case "normRenure":
      return collectNormJobMeta(ctx, job)
    default: {
      const exhaustiveCheck: never = job.type
      throw new Error(`Unsupported calculation job type: ${String(exhaustiveCheck)}`)
    }
  }
}

/** The current cache state of a single job, as determined without running the calculation. */
export interface CalculationJobStatus {
  job: CalculationJobRequest
  state: "fresh" | "processing" | "stale" | "missing"
  /** The fresh result (state `"fresh"`) or the best available stale fallback, if any. */
  result: unknown
}

/**
 * Cheaply determines whether a job's result is fresh, stale, missing, or already being recomputed
 * by another request — without running the (potentially expensive) calculation. Used by
 * farm/organization-level loaders to decide what to render immediately and which jobs to hand off
 * to the background NDJSON refresh route.
 */
export async function getCalculationJobStatus(
  ctx: CalculationJobContext,
  job: CalculationJobRequest,
): Promise<CalculationJobStatus> {
  const meta = await collectJobMeta(ctx, job)
  const status = await getCalculationCacheStatus({
    fdm: ctx.fdm,
    calculationFunctionName: meta.calculationFunctionName,
    calculatorVersion: meta.calculatorVersion,
    input: meta.input,
    entityType: meta.entityType,
    entityId: meta.entityId,
    sensitiveKeys: meta.sensitiveKeys,
  })

  return {
    job,
    state: status.state,
    result: status.state === "fresh" ? status.result : status.staleResult,
  }
}

/** How a job's recompute attempt was resolved. */
export interface CalculationJobRunResult {
  job: CalculationJobRequest
  outcome: "computed" | "attached" | "error"
  error?: string
}

const ATTACH_POLL_INTERVAL_MS = 1000
const ATTACH_MAX_WAIT_MS = 60 * 1000

/**
 * Ensures a fresh result exists for the given job: recomputes it if this call wins the
 * `calculation_cache.is_processing` lock, or attaches to (waits on) an in-flight computation
 * started by another request/tab if the lock is already held. Never runs the calculation twice
 * for the same input concurrently.
 */
export async function runCalculationJob(
  ctx: CalculationJobContext,
  job: CalculationJobRequest,
): Promise<CalculationJobRunResult> {
  const meta = await collectJobMeta(ctx, job)
  const { calculationHash, inputForCache } = computeCacheKey(
    meta.calculationFunctionName,
    meta.calculatorVersion,
    meta.input,
    meta.sensitiveKeys,
  )

  const acquired = await tryAcquireCalculationLock({
    fdm: ctx.fdm,
    calculationHash,
    calculationFunctionName: meta.calculationFunctionName,
    calculatorVersion: meta.calculatorVersion,
    input: inputForCache,
    entityType: meta.entityType,
    entityId: meta.entityId,
  })

  if (!acquired) {
    // Another request is already computing this exact hash: attach instead of duplicating work.
    const start = Date.now()
    while (Date.now() - start < ATTACH_MAX_WAIT_MS) {
      const entry = await getCachedCalculationEntry(ctx.fdm, calculationHash)
      if (entry && !entry.is_processing) {
        return { job, outcome: "attached" }
      }
      await new Promise((resolve) => setTimeout(resolve, ATTACH_POLL_INTERVAL_MS))
    }
    // Timed out waiting: report as attached anyway, the loader's own cache-status check will
    // simply see it as still stale/processing on the next revalidation.
    return { job, outcome: "attached" }
  }

  try {
    const result = await meta.run()
    await releaseCalculationLock(ctx.fdm, calculationHash, { success: true, result })
    return { job, outcome: "computed" }
  } catch (e: unknown) {
    await releaseCalculationLock(ctx.fdm, calculationHash, { success: false })
    const errorMessage = e instanceof Error ? e.message : String(e)
    return { job, outcome: "error", error: errorMessage }
  }
}

/** The cached-while-recomputing farm-level nitrogen balance result and the jobs still stale. */
export interface FarmNitrogenBalanceCachedResult {
  nitrogenBalanceResult: NitrogenBalanceNumeric
  staleJobs: CalculationJobRequest[]
}

/**
 * Builds the farm-level nitrogen balance from each field's cached result (falling back to the
 * field's last known result if the current input hash isn't cached yet), instead of blocking on a
 * full recompute. Fields whose cache entry is missing/stale/being recomputed are returned in
 * `staleJobs`, for the caller to hand off to the `/api/calculation-refresh` route.
 */
export async function getNitrogenBalanceForFarmCached({
  fdm,
  principal_id,
  b_id_farm,
  fields,
  calendar,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: string
  fields: Pick<Field, "b_id" | "b_area" | "b_bufferstrip">[]
  calendar: string
  timeframe: Timeframe
}): Promise<FarmNitrogenBalanceCachedResult> {
  const ctx: CalculationJobContext = { fdm, principal_id, timeframe }
  const jobs: CalculationJobRequest[] = fields.map((field) => ({
    type: "nitrogenBalance",
    b_id: field.b_id,
    b_id_farm,
    calendar,
  }))

  const statuses = await Promise.all(jobs.map((job) => getCalculationJobStatus(ctx, job)))

  const fieldsWithBalanceResults: NitrogenBalanceFieldResultNumeric[] = fields
    .map((field, index) => {
      const status = statuses[index]
      if (status.state !== "fresh") return null
      return {
        b_id: field.b_id,
        b_area: field.b_area ?? 0,
        b_bufferstrip: field.b_bufferstrip ?? false,
        balance: status.result as NitrogenBalanceFieldNumeric | undefined,
      }
    })
    .filter((x) => x !== null)

  const hasErrors = fieldsWithBalanceResults.some((result) => result.errorMessage !== undefined)
  const fieldErrorMessages = fieldsWithBalanceResults
    .filter((result) => result.errorMessage !== undefined)
    .map((result) => result.errorMessage as string)

  const nitrogenBalanceResult = calculateNitrogenBalancesFieldToFarm(
    fieldsWithBalanceResults,
    hasErrors,
    fieldErrorMessages,
  )

  const staleJobs = jobs.filter((_job, index) => statuses[index].state !== "fresh")

  return { nitrogenBalanceResult, staleJobs }
}

/** The cached-while-recomputing organization-level nitrogen balance result and stale jobs. */
export interface OrgNitrogenBalanceCachedResult {
  combinedResult: NitrogenBalanceNumeric
  /** Per-farm aggregated result, keyed by `b_id_farm`. */
  farmResultsMap: Map<string, NitrogenBalanceNumeric & { errorMessage?: string }>
  staleJobs: CalculationJobRequest[]
}

/**
 * Builds the organization-level (and per-farm) nitrogen balance from each field's cached result
 * across multiple farms, instead of blocking on a full recompute of every farm's fields.
 */
export async function getNitrogenBalanceForFarmsCached({
  fdm,
  principal_id,
  farms,
  calendar,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  farms: { b_id_farm: string; fields: Pick<Field, "b_id" | "b_area" | "b_bufferstrip">[] }[]
  calendar: string
  timeframe: Timeframe
}): Promise<OrgNitrogenBalanceCachedResult> {
  const ctx: CalculationJobContext = { fdm, principal_id, timeframe }

  const jobs: CalculationJobRequest[] = farms.flatMap((farm) =>
    farm.fields.map((field) => ({
      type: "nitrogenBalance" as const,
      b_id: field.b_id,
      b_id_farm: farm.b_id_farm,
      calendar,
    })),
  )

  const statuses = await Promise.all(jobs.map((job) => getCalculationJobStatus(ctx, job)))

  const farmResultsMap = new Map<string, NitrogenBalanceNumeric & { errorMessage?: string }>()
  const allFieldResults: NitrogenBalanceFieldResultNumeric[] = []
  const staleJobs: CalculationJobRequest[] = []

  let index = 0
  for (const farm of farms) {
    const farmFieldResults: NitrogenBalanceFieldResultNumeric[] = []
    for (const field of farm.fields) {
      const status = statuses[index]
      const job = jobs[index]
      index++

      if (status.state === "fresh") {
        const fieldResult: NitrogenBalanceFieldResultNumeric = {
          b_id: field.b_id,
          b_area: field.b_area ?? 0,
          b_bufferstrip: field.b_bufferstrip ?? false,
          balance: status.result as NitrogenBalanceFieldNumeric | undefined,
        }

        farmFieldResults.push(fieldResult)
        allFieldResults.push(fieldResult)
      } else {
        staleJobs.push(job)
      }
    }

    if (farmFieldResults.length === 0) {
      farmResultsMap.set(farm.b_id_farm, {
        hasErrors: true,
        errorMessage: "No fields in input",
      } as NitrogenBalanceNumeric & { errorMessage?: string })
      continue
    }

    const farmResult = calculateNitrogenBalancesFieldToFarm(
      farmFieldResults,
      farmFieldResults.some((result) => result.errorMessage !== undefined),
      farmFieldResults
        .filter((result) => result.errorMessage !== undefined)
        .map((result) => result.errorMessage as string),
    )
    farmResultsMap.set(farm.b_id_farm, farmResult)
  }

  const combinedResult = calculateNitrogenBalancesFieldToFarm(
    allFieldResults,
    allFieldResults.some((result) => result.errorMessage !== undefined),
    allFieldResults
      .filter((result) => result.errorMessage !== undefined)
      .map((result) => result.errorMessage as string),
  )

  return { combinedResult, farmResultsMap, staleJobs }
}

/** The cached-while-recomputing per-field norm values and the jobs still stale. */
export interface FieldNormValuesCached {
  value: {
    manure?: GebruiksnormResult
    phosphate?: GebruiksnormResult
    nitrogen?: GebruiksnormResult
    renure?: GebruiksnormResult
  }
  staleJobs: CalculationJobRequest[]
}

/**
 * Builds a single field's norm values from cache (falling back to the field's last known result
 * per norm if the current input hash isn't cached yet), instead of blocking on a full recompute.
 */
export async function getFieldNormValuesCached({
  fdm,
  principal_id,
  b_id,
  b_id_farm,
  calendar,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id: string
  b_id_farm: string
  calendar: "2025" | "2026"
  timeframe: Timeframe
}): Promise<FieldNormValuesCached> {
  const ctx: CalculationJobContext = { fdm, principal_id, timeframe }
  const jobTypes: CalculationJobRequest["type"][] =
    calendar === "2026"
      ? ["normNitrogen", "normPhosphate", "normManure", "normRenure"]
      : ["normNitrogen", "normPhosphate", "normManure"]

  const jobs: CalculationJobRequest[] = jobTypes.map((type) => ({
    type,
    b_id,
    b_id_farm,
    calendar,
  }))

  const statuses = await Promise.all(jobs.map((job) => getCalculationJobStatus(ctx, job)))

  const value: FieldNormValuesCached["value"] = {}
  jobs.forEach((job, index) => {
    // `result` can be `null` (no fresh or stale result exists yet) as well as `undefined`;
    // normalize to `undefined` so downstream `!== undefined` checks treat both as "missing".
    const result = (statuses[index].result ?? undefined) as GebruiksnormResult | undefined
    if (job.type === "normNitrogen") value.nitrogen = result
    else if (job.type === "normPhosphate") value.phosphate = result
    else if (job.type === "normManure") value.manure = result
    else if (job.type === "normRenure") value.renure = result
  })

  const staleJobs = jobs.filter((_job, index) => statuses[index].state !== "fresh")

  return { value, staleJobs }
}

/** The cached-while-recomputing nutrient advice result for a field and the jobs still stale. */
export interface NutrientAdviceCached {
  result: Awaited<ReturnType<typeof getNutrientAdvice>> | undefined
  staleJobs: CalculationJobRequest[]
}

/**
 * Builds a single field's nutrient advice from cache (falling back to its last known result if
 * the current input hash isn't cached yet), instead of blocking on a full recompute.
 */
export async function getNutrientAdviceCached({
  fdm,
  principal_id,
  b_id,
  b_id_farm,
  calendar,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id: string
  b_id_farm: string
  calendar: string
  timeframe: Timeframe
}): Promise<NutrientAdviceCached> {
  const ctx: CalculationJobContext = { fdm, principal_id, timeframe }
  const job: CalculationJobRequest = { type: "nutrientAdvice", b_id, b_id_farm, calendar }
  const status = await getCalculationJobStatus(ctx, job)

  return {
    result: (status.result ?? undefined) as NutrientAdviceCached["result"],
    staleJobs: status.state === "fresh" ? [] : [job],
  }
}
