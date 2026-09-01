import { and, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm"
import { createHash } from "node:crypto"
import stableStringify from "safe-stable-stringify"
import type { FdmType } from "./fdm.types"
import {
  calculationCache as calculationCacheTable,
  type CalculationCacheTypeSelect,
  calculationErrors as calculationErrorsTable,
} from "./db/schema-calculator"
import { createId } from "./id"

/**
 * Default duration (in milliseconds) after which an `is_processing` lock is considered stuck
 * and can be reclaimed by another caller, even if the original worker never released it
 * (e.g. because the process crashed or the request was aborted).
 */
export const DEFAULT_CALCULATION_LOCK_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Generates a reliable and quick hash for caching calculation results.
 * This hash is used as a unique identifier for a given calculation function, its version, and its input.
 * It ensures that the same calculation with the same inputs always produces the same cache key.
 *
 * @template T_Input - The type of the input object for the calculation function.
 * @param {string} functionName - The name of the calculation function.
 * @param {string} packageVersion - The version of the package/module containing the function.
 * @param {T_Input} functionInput - The input object for the function.
 * @returns {string} A SHA-256 hash as a hex string.
 */
export function generateCalculationHash<T_Input extends object>(
  functionName: string,
  packageVersion: string,
  functionInput: T_Input,
): string {
  // 1. Deterministically serialize the input object to ensure consistent hashing.
  //    `safe-stable-stringify` is used to handle various JavaScript object types reliably.
  const serializedInput = stableStringify(functionInput)

  // 2. Combine all components (function name, package version, and serialized input)
  //    into a single string. This ensures that changes to any of these components
  //    will result in a different hash, effectively invalidating the cache for that specific calculation.
  const dataToHash = `${functionName}:${packageVersion}:${serializedInput}`

  // 3. Compute the SHA-256 hash of the combined string.
  return createHash("sha256").update(dataToHash).digest("hex")
}

/**
 * Retrieves a cached calculation result from the database.
 *
 * @template T_Output - The expected type of the calculation result.
 * @param {FdmType} fdm - The FDM instance, providing database access.
 * @param {string} calculation_hash - The unique hash identifying the cached calculation.
 * @returns {Promise<T_Output | null>} A promise that resolves to the cached result if found, otherwise `null`.
 */
export function getCachedCalculation<T_Output>(
  fdm: FdmType,
  calculation_hash: string,
): Promise<T_Output | null> {
  // Query the calculation cache table for a record matching the provided hash.
  // Limits to 1 result as the hash is a primary key.
  const result = fdm
    .select({
      result: calculationCacheTable.result,
    })
    .from(calculationCacheTable)
    .where(eq(calculationCacheTable.calculation_hash, calculation_hash))
    .limit(1)

  // Process the query result: if a row is found, return its 'result' field, otherwise return null.
  return result.then((rows) => (rows?.length ? (rows[0].result as T_Output) : null))
}

/**
 * Stores a calculation result in the cache.
 *
 * This function is not compatible with `releaseCalculationLock`. `releaseCalculationLock` is able to
 * still release the lock even if `setCachedCalculation` has been called since, possibly overwriting
 * the result stored by `setCachedCalculation`.
 *
 * @template T_Input - The type of the input object for the calculation function.
 * @template T_Output - The type of the calculation result.
 * @param {FdmType} fdm - The FDM instance, providing database access.
 * @param {string} calculationHash - The unique hash of the calculation.
 * @param {string} calculationFunctionName - The name of the calculation function.
 * @param {string} calculatorVersion - The version of the calculator.
 * @param {T_Input} input - The input object used for the calculation.
 * @param {T_Output} result - The computed result of the calculation.
 * @param {string} [entityType] - The type of entity this calculation belongs to (e.g. 'field', 'farm').
 * @param {string} [entityId] - The id of the entity this calculation belongs to.
 * @returns {Promise<void>} A promise that resolves when the cache operation is complete.
 */
export async function setCachedCalculation<T_Input extends object, T_Output>(
  fdm: FdmType,
  calculationHash: string,
  calculationFunctionName: string,
  calculatorVersion: string,
  input: T_Input,
  result: T_Output,
  entityType?: string,
  entityId?: string,
) {
  // Inserts a new cache record. If a record with the same calculation_hash already exists,
  // skip the insert — the stored result is identical since the hash is deterministic.
  await fdm
    .insert(calculationCacheTable)
    .values({
      calculation_hash: calculationHash,
      calculation_function: calculationFunctionName,
      calculator_version: calculatorVersion,
      input: input,
      result: result,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      is_processing: false,
      is_processing_since: null,
    })
    .onConflictDoUpdate({
      target: calculationCacheTable.calculation_hash,
      setWhere: isNull(calculationCacheTable.result),
      set: {
        calculation_function: calculationFunctionName,
        calculator_version: calculatorVersion,
        input: input,
        result: result,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        is_processing: false,
        is_processing_since: null,
      },
    })
}

/**
 * Records an error that occurred during a calculation in the database.
 *
 * @template T_Input - The type of the input object that caused the error.
 * @param {FdmType} fdm - The FDM instance, providing database access.
 * @param {string} calculationFunctionName - The name of the calculation function where the error occurred.
 * @param {string} calculatorVersion - The version of the calculator.
 * @param {T_Input} input - The input object that was being processed when the error occurred.
 * @param {string} error_message - The error message.
 * @param {string | undefined} stack_trace - The stack trace of the error, if available.
 * @returns {Promise<void>} A promise that resolves when the error record is inserted.
 */
export async function setCalculationError<T_Input extends object>(
  fdm: FdmType,
  calculationFunctionName: string,
  calculatorVersion: string,
  input: T_Input,
  error_message: string,
  stack_trace: string | undefined,
) {
  return fdm.insert(calculationErrorsTable).values({
    calculation_error_id: createId(), // Generate a unique ID for each error record
    calculation_function: calculationFunctionName,
    calculator_version: calculatorVersion,
    input: input,
    error_message: error_message,
    stack_trace: stack_trace ?? null, // Store stack trace, or null if not provided
  })
}

/**
 * Redacts sensitive keys from an object (recursively), so they never end up in the cache key or
 * in the stored `input` payload. Shared by `withCalculationCache` and `getCalculationCacheStatus`
 * so the two always compute the exact same cache key for the same logical input.
 */
function redactSensitiveKeys(obj: unknown, sensitiveKeys: string[]): unknown {
  if (typeof obj !== "object" || obj === null) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveKeys(item, sensitiveKeys))
  }
  // Check if it's a plain object or similar to avoid breaking classes/Dates if they shouldn't be touched
  // Ideally input is a plain object for hashing/json.
  if (obj instanceof Date) {
    return obj
  }

  const newObj = { ...(obj as object) } as Record<string, unknown>
  for (const key of Object.keys(newObj)) {
    if (sensitiveKeys.includes(key)) {
      newObj[key] = "REDACTED"
    } else {
      newObj[key] = redactSensitiveKeys(newObj[key], sensitiveKeys)
    }
  }
  return newObj
}

/**
 * Computes the deterministic cache key (hash + sanitized input) for a calculation, exactly as
 * `withCalculationCache` would. Used so a caller can check the current cache state of a
 * calculation, or acquire/release its lock, without invoking the (potentially expensive)
 * calculation function itself.
 */
export function computeCacheKey<T_Input extends object>(
  calculationFunctionName: string,
  calculatorVersion: string,
  input: T_Input,
  sensitiveKeys: string[] = [],
): { calculationHash: string; inputForCache: T_Input } {
  const inputForCache =
    sensitiveKeys.length > 0 ? (redactSensitiveKeys(input, sensitiveKeys) as T_Input) : input

  const calculationHash = generateCalculationHash(
    calculationFunctionName,
    calculatorVersion,
    inputForCache,
  )

  return { calculationHash, inputForCache }
}

/**
 * Options controlling how `withCalculationCache` tags cache rows with the entity (e.g. field or
 * farm) the calculation belongs to. This powers entity-scoped lookups such as
 * `getLatestCachedResultForEntity`, used by farm/organization-level pages to show a stale-but-fast
 * cached result for a field while its up-to-date value is recomputed in the background.
 */
export interface WithCalculationCacheOptions<T_Input> {
  /** The kind of entity this calculation is scoped to, e.g. `"field"`. */
  entityType?: string
  /** Derives the entity id (e.g. `b_id`) from the (non-redacted) function input. */
  getEntityId?: (input: T_Input) => string | undefined
}

/**
 * A decorator function that adds caching capabilities to any asynchronous calculation function.
 * It first attempts to retrieve a result from the cache. If a cached result is found, it's returned immediately.
 * If not, the original calculation function is executed, its result is cached (if cache read was successful),
 * and then returned. Errors during calculation are logged and re-thrown.
 *
 * @template T_Input - The type of the input object for the calculation function.
 * @template T_Output - The expected type of the calculation result.
 * @param {(inputs: T_Input) => T_Output | Promise<T_Output>} calculationFunction - The original function to compute the result.
 * @param {string} calculationFunctionName - The name of the calculation function, used for caching.
 * @param {string} calculatorVersion - A version string tied to the current calculation function.
 *                                     Changing this version will invalidate old cache entries.
 * @returns {(fdm: FdmType, input: T_Input) => Promise<T_Output>} A new function that wraps the original
 *          calculation with caching logic.
 *
 * @example
 * ```typescript
 * // Define a calculation function
 * async function myExpensiveCalculation(data: { value: number }): Promise<number> {
 *   // Simulate an expensive operation
 *   await new Promise(resolve => setTimeout(resolve, 1000));
 *   return data.value * 2;
 * }
 *
 * // Decorate it with caching
 * const cachedCalculation = withCalculationCache(myExpensiveCalculation, 'myExpensiveCalculation', 'v1.0.0');
 *
 * // Use the decorated function
 * // Assuming 'fdm' is an initialized FdmType instance
 * const result1 = await cachedCalculation(fdm, { value: 10 }); // Cache MISS, performs calculation
 * const result2 = await cachedCalculation(fdm, { value: 10 }); // Cache HIT, returns cached result instantly
 * ```
 */
export function withCalculationCache<T_Input extends object, T_Output>(
  calculationFunction: (inputs: T_Input) => T_Output | Promise<T_Output>,
  calculationFunctionName: string,
  calculatorVersion: string,
  sensitiveKeys: string[] = [],
  options: WithCalculationCacheOptions<T_Input> = {},
) {
  return async (fdm: FdmType, input: T_Input) => {
    if (!calculationFunctionName) {
      throw new Error(
        "Calculation function name not provided for caching. Please provide a valid function name.",
      )
    }

    if (!calculatorVersion) {
      throw new Error(
        "Calculator version not provided for caching. Please provide a valid version string.",
      )
    }

    // Generate a unique hash for the current calculation based on function name, version, and input.
    const { calculationHash, inputForCache } = computeCacheKey(
      calculationFunctionName,
      calculatorVersion,
      input,
      sensitiveKeys,
    )
    const entityId = options.getEntityId?.(input)

    let cachedResult: T_Output | null = null
    // Flag to determine if the result of the current calculation should be cached.
    // This is set to false if reading from cache fails.
    let cacheResultOfCalculation = true

    // Attempt to retrieve the result from cache.
    try {
      cachedResult = await getCachedCalculation(fdm, calculationHash)
    } catch (e: unknown) {
      // If reading from cache fails, log the error and mark that the result should not be cached.
      // This makes the caching mechanism resilient to temporary database issues.
      cacheResultOfCalculation = false
      const errorMessage = e instanceof Error ? e.message : String(e)
      console.error(
        `Failed to read from calculation cache for ${calculationFunctionName} (hash: ${calculationHash}): ${errorMessage}`,
      )
      // Treat as a cache miss and proceed with calculation, but do not attempt to set a new cache entry
      // as the cache might be in an unhealthy state.
    }

    // If a cached result was successfully retrieved, return it immediately.
    if (cachedResult) {
      // console.log(
      //     `Cache HIT for ${calculationFunctionName} (hash: ${calculationHash})`,
      // )
      return cachedResult
    }

    // If no cached result was found (either genuinely a miss or cache read failed),
    // perform the actual calculation.
    try {
      // console.log(
      //     `Cache MISS for ${calculationFunctionName} (hash: ${calculationHash}). Performing calculation...`,
      // )
      const result = await calculationFunction(input)

      // If the initial cache read was successful (meaning the cache is healthy),
      // then store the new calculation result in the cache.
      // Fire-and-forget: don't await the cache write to avoid blocking the response
      // when many parallel calculations complete simultaneously (lock contention).
      if (cacheResultOfCalculation) {
        setCachedCalculation(
          fdm,
          calculationHash,
          calculationFunctionName,
          calculatorVersion,
          inputForCache,
          result,
          options.entityType,
          entityId,
        ).catch((e: unknown) => {
          const errorMessage = e instanceof Error ? e.message : String(e)
          console.error(
            `Failed to write to calculation cache for ${calculationFunctionName} (hash: ${calculationHash}): ${errorMessage}`,
          )
        })
      }

      return result
    } catch (e: unknown) {
      // Record the error in the database (fire-and-forget to avoid blocking error propagation).
      const errorMessage = e instanceof Error ? e.message : String(e)
      const stackTrace = e instanceof Error ? e.stack : undefined

      setCalculationError(
        fdm,
        calculationFunctionName,
        calculatorVersion,
        inputForCache,
        errorMessage,
        stackTrace,
      ).catch((loggingError: unknown) => {
        const loggingErrorMessage =
          loggingError instanceof Error ? loggingError.message : String(loggingError)
        console.error(
          `Failed to log calculation error for ${calculationFunctionName}: ${loggingErrorMessage}`,
        )
      })

      throw e
    }
  }
}

/**
 * Retrieves the full cache row for a given calculation hash, including its processing/lock state.
 * Unlike {@link getCachedCalculation}, this returns the full row (including a `null` `result` for
 * an in-progress placeholder) rather than only a resolved result.
 *
 * @param {FdmType} fdm - The FDM instance, providing database access.
 * @param {string} calculation_hash - The unique hash identifying the cached calculation.
 * @returns {Promise<CalculationCacheTypeSelect | null>} The cache row, or `null` if none exists.
 */
export async function getCachedCalculationEntry(
  fdm: FdmType,
  calculation_hash: string,
): Promise<CalculationCacheTypeSelect | null> {
  const rows = await fdm
    .select()
    .from(calculationCacheTable)
    .where(eq(calculationCacheTable.calculation_hash, calculation_hash))
    .limit(1)

  return rows.length ? rows[0] : null
}

/**
 * Retrieves the most recently produced result for a given entity and calculation function,
 * regardless of whether it matches the current input hash. This is what farm/organization-level
 * pages use to render a (possibly stale) result immediately, while a fresh value for the current
 * input is recomputed in the background.
 *
 * @template T_Output - The expected type of the calculation result.
 * @param {FdmType} fdm - The FDM instance, providing database access.
 * @param {string} calculationFunctionName - The name of the calculation function.
 * @param {string} entityType - The type of entity, e.g. `"field"`.
 * @param {string} entityId - The id of the entity, e.g. a `b_id`.
 * @returns {Promise<T_Output | null>} The latest available result, or `null` if none exists yet.
 */
export async function getLatestCachedResultForEntity<T_Output>(
  fdm: FdmType,
  calculationFunctionName: string,
  entityType: string,
  entityId: string,
): Promise<T_Output | null> {
  const rows = await fdm
    .select({ result: calculationCacheTable.result })
    .from(calculationCacheTable)
    .where(
      and(
        eq(calculationCacheTable.calculation_function, calculationFunctionName),
        eq(calculationCacheTable.entity_type, entityType),
        eq(calculationCacheTable.entity_id, entityId),
        isNotNull(calculationCacheTable.result),
      ),
    )
    .orderBy(desc(calculationCacheTable.created_at))
    .limit(1)

  return rows.length ? (rows[0].result as T_Output) : null
}

type LockedCalculationCacheEntry = Pick<
  CalculationCacheTypeSelect & { is_processing_since: Date },
  "calculation_hash" | "is_processing" | "is_processing_since"
>
const lockedCalculationCacheEntryFields = {
  calculation_hash: calculationCacheTable.calculation_hash,
  is_processing: calculationCacheTable.is_processing,
  is_processing_since: calculationCacheTable.is_processing_since,
}
/**
 * Attempts to acquire the `is_processing` lock for a calculation hash, so at most one background
 * worker recomputes a given (function, version, input) at a time. Other callers attempting the
 * same calculation should attach to the in-flight computation instead of duplicating it (e.g. by
 * polling {@link getCachedCalculationEntry} until it clears).
 *
 * The lock is acquired by either:
 * 1. Inserting a new placeholder row (`result: null`, `is_processing: true`) when the hash is not
 *    yet known at all, or
 * 2. Reclaiming an existing row whose lock is not currently held (`is_processing: false`) or whose
 *    lock has been held for longer than `lockTimeoutMs` (a stuck lock, e.g. from a crashed worker).
 *
 * @template T_Input - The type of the input object for the calculation function.
 * @param {object} args
 * @param {FdmType} args.fdm - The FDM instance, providing database access.
 * @param {string} args.calculationHash - The unique hash of the calculation to lock.
 * @param {string} args.calculationFunctionName - The name of the calculation function.
 * @param {string} args.calculatorVersion - The version of the calculator.
 * @param {T_Input} args.input - The (already sanitized) input to store alongside a new placeholder row.
 * @param {string} [args.entityType] - The type of entity this calculation belongs to.
 * @param {string} [args.entityId] - The id of the entity this calculation belongs to.
 * @param {number} [args.lockTimeoutMs] - How long a lock may be held before it's considered stuck. Defaults to 15 minutes.
 * @returns {Promise<boolean>} `true` if the lock was acquired by this call, `false` if another worker already holds it.
 */
export async function tryAcquireCalculationLock<T_Input extends object>({
  fdm,
  calculationHash,
  calculationFunctionName,
  calculatorVersion,
  input,
  entityType,
  entityId,
  lockTimeoutMs = DEFAULT_CALCULATION_LOCK_TIMEOUT_MS,
}: {
  fdm: FdmType
  calculationHash: string
  calculationFunctionName: string
  calculatorVersion: string
  input: T_Input
  entityType?: string
  entityId?: string
  lockTimeoutMs?: number
}): Promise<LockedCalculationCacheEntry | null> {
  // 1. The hash is genuinely missing: try to insert a fresh placeholder row that claims the lock.
  const inserted = await fdm
    .insert(calculationCacheTable)
    .values({
      calculation_hash: calculationHash,
      calculation_function: calculationFunctionName,
      calculator_version: calculatorVersion,
      input: input,
      result: null,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      is_processing: true,
      is_processing_since: sql`now()`,
    })
    .onConflictDoNothing()
    .returning(lockedCalculationCacheEntryFields)

  if (inserted.length > 0) {
    return inserted[0] as LockedCalculationCacheEntry
  }

  // 2. A row already exists for this hash: reclaim the lock only if it's not currently held, or if
  // it's been held for longer than the timeout (a stuck lock).
  const updated = await fdm
    .update(calculationCacheTable)
    .set({
      is_processing: true,
      is_processing_since: sql`now()`,
    })
    .where(
      and(
        eq(calculationCacheTable.calculation_hash, calculationHash),
        or(
          eq(calculationCacheTable.is_processing, false),
          isNull(calculationCacheTable.is_processing_since),
          lt(
            calculationCacheTable.is_processing_since,
            sql`now() - (${lockTimeoutMs} * interval '1 ms')`,
          ),
        ),
      ),
    )
    .returning(lockedCalculationCacheEntryFields)

  return updated.length > 0 ? (updated[0] as LockedCalculationCacheEntry) : null
}

/**
 * Releases the `is_processing` lock previously acquired via {@link tryAcquireCalculationLock},
 * either storing the freshly computed result (on success) or simply clearing the lock so a future
 * attempt can retry (on failure).
 *
 * If the lock has been acquired by another process since the computation has started, the lock will
 * not be released and the function will return false. This is based on the was_processing_since
 * parameter, and the lock will only be released if `is_processing_since` in the database is not after
 * `was_processing_since`. If `is_processing_since` is null in the database, the lock release will
 * succeed and the result will be stored.
 *
 * @template T_Output - The type of the calculation result.
 * @param {FdmType} fdm - The FDM instance, providing database access.
 * @param {string} calculationHash - The unique hash of the calculation whose lock should be released.
 * @param {{ success: true; result: T_Output } | { success: false }} outcome - The outcome of the calculation.
 * @returns {Promise<boolean>} A promise that resolves for whether the lock is released *for* this calculation.
 */
export async function releaseCalculationLock<T_Output>(
  fdm: FdmType,
  calculationHash: string,
  outcome: { success: true; result: T_Output } | { success: false },
  was_processing_since: Date,
): Promise<boolean> {
  const releasedLocks = await fdm
    .update(calculationCacheTable)
    .set(
      outcome.success
        ? {
            result: outcome.result,
            is_processing: false,
            is_processing_since: null,
            created_at: new Date(),
          }
        : {
            is_processing: false,
            is_processing_since: null,
          },
    )
    .where(
      and(
        eq(calculationCacheTable.calculation_hash, calculationHash),
        or(
          isNull(calculationCacheTable.is_processing_since),
          sql`date_trunc('milliseconds', ${calculationCacheTable.is_processing_since}) = ${was_processing_since.toISOString()}::timestamptz`,
        ),
      ),
    )
    .returning({ calculationHash: calculationCacheTable.calculation_hash })

  return releasedLocks.length > 0
}

/** The current state of a calculation's cache entry, as returned by {@link getCalculationCacheStatus}. */
export type CalculationCacheStatus<T_Output> =
  | { state: "fresh"; calculationHash: string; result: T_Output }
  | { state: "processing"; calculationHash: string; staleResult: T_Output | null }
  | { state: "stale" | "missing"; calculationHash: string; staleResult: T_Output | null }

/**
 * Cheaply determines whether a calculation's result is fresh, stale, missing, or already being
 * (re)computed by another worker — without invoking the (potentially expensive) calculation
 * function itself. This is the building block farm/organization-level loaders use to decide, per
 * field, whether to render the cached result immediately or queue a background recompute.
 *
 * @template T_Input - The type of the input object for the calculation function.
 * @template T_Output - The expected type of the calculation result.
 * @param {object} args
 * @param {FdmType} args.fdm - The FDM instance, providing database access.
 * @param {string} args.calculationFunctionName - The name of the calculation function, as used by `withCalculationCache`.
 * @param {string} args.calculatorVersion - The version of the calculator, as used by `withCalculationCache`.
 * @param {T_Input} args.input - The (non-redacted) input for the calculation.
 * @param {string} [args.entityType] - The type of entity this calculation belongs to, used to look up a stale fallback result.
 * @param {string} [args.entityId] - The id of the entity this calculation belongs to.
 * @param {string[]} [args.sensitiveKeys] - Keys to redact before hashing/storing, as used by `withCalculationCache`.
 * @param {number} [args.lockTimeoutMs] - How long a lock may be held before it's considered stuck. Defaults to 15 minutes.
 * @returns {Promise<CalculationCacheStatus<T_Output>>} The current cache status for this calculation.
 */
export async function getCalculationCacheStatus<T_Input extends object, T_Output>({
  fdm,
  calculationFunctionName,
  calculatorVersion,
  input,
  entityType,
  entityId,
  sensitiveKeys = [],
  lockTimeoutMs = DEFAULT_CALCULATION_LOCK_TIMEOUT_MS,
}: {
  fdm: FdmType
  calculationFunctionName: string
  calculatorVersion: string
  input: T_Input
  entityType?: string
  entityId?: string
  sensitiveKeys?: string[]
  lockTimeoutMs?: number
}): Promise<CalculationCacheStatus<T_Output>> {
  const { calculationHash } = computeCacheKey(
    calculationFunctionName,
    calculatorVersion,
    input,
    sensitiveKeys,
  )

  const entry = await getCachedCalculationEntry(fdm, calculationHash)

  if (entry && entry.result != null && !entry.is_processing) {
    return { state: "fresh", calculationHash, result: entry.result as T_Output }
  }

  if (entry?.is_processing) {
    const since = entry.is_processing_since
    const lockExpired = !since || Date.now() - since.getTime() > lockTimeoutMs
    if (!lockExpired) {
      // Someone else is already (re)computing this exact hash; attach rather than duplicate.
      const staleResult =
        (entry.result as T_Output | null) ??
        (entityType && entityId
          ? await getLatestCachedResultForEntity<T_Output>(
              fdm,
              calculationFunctionName,
              entityType,
              entityId,
            )
          : null)
      return { state: "processing", calculationHash, staleResult }
    }
  }

  // Either no row exists yet for this hash, or its lock has expired: fall back to whatever
  // result (for this exact hash, or the entity's last known result) is available to render
  // immediately while a recompute is triggered.
  const staleResult =
    (entry?.result as T_Output | null) ??
    (entityType && entityId
      ? await getLatestCachedResultForEntity<T_Output>(
          fdm,
          calculationFunctionName,
          entityType,
          entityId,
        )
      : null)

  return { state: entry ? "stale" : "missing", calculationHash, staleResult }
}
