import { eq, inArray } from "drizzle-orm"
import { createHash } from "node:crypto"
import stableStringify from "safe-stable-stringify"
import type { FdmType } from "./fdm.types"
import {
  type CalculationCacheTypeInsert,
  calculationCache as calculationCacheTable,
  calculationErrors as calculationErrorsTable,
} from "./db/schema-calculator"
import { createId } from "./id"

/** Maximum number of hashes looked up in a single cache query. */
const CACHE_READ_CHUNK_SIZE = 500

/** Maximum number of rows written in a single cache insert. Inputs can be large JSON documents. */
const CACHE_WRITE_CHUNK_SIZE = 100

/** Options for the `many` method of a {@link CachedCalculation}. */
export interface CachedCalculationManyOptions {
  /**
   * Maximum number of cache misses that are calculated at the same time.
   * Defaults to no limit. Set it when the calculation calls an external service.
   */
  concurrency?: number
}

/**
 * A calculation function with caching, as returned by {@link withCalculationCache}.
 *
 * Call it with a single input, or use `many` to look up and calculate several inputs with one
 * cache query.
 *
 * @template T_Input - The type of the input object for the calculation function.
 * @template T_Output - The type of the calculation result.
 */
export type CachedCalculation<T_Input extends object, T_Output> = ((
  fdm: FdmType,
  input: T_Input,
) => Promise<T_Output>) & {
  /**
   * Returns the results for several inputs, reading the cache with one query (per 500 inputs)
   * and writing all new results with one insert (per 100 results).
   *
   * Only the inputs without a cached result are calculated, and identical inputs only once.
   * Each input gets its own promise, in the order of `inputs`: a hit resolves as soon as the
   * cache has been read, a miss as soon as its calculation has finished, and a failed
   * calculation rejects only the promise of that input. Use `Promise.allSettled` to wait for all.
   *
   * @param fdm - The FDM instance, providing database access.
   * @param inputs - The inputs to calculate.
   * @param options - See {@link CachedCalculationManyOptions}.
   * @returns One promise per input, in the same order as `inputs`.
   */
  many: (
    fdm: FdmType,
    inputs: readonly T_Input[],
    options?: CachedCalculationManyOptions,
  ) => Promise<T_Output>[]
}

/**
 * Returns whether a cached value counts as a hit. Empty results (such as `null`) are not stored
 * and are always calculated again.
 */
function isUsableResult<T_Output>(result: T_Output | null | undefined): result is T_Output {
  return Boolean(result)
}

function errorToMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

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
 * Retrieves the cached results of several calculations from the database.
 *
 * Duplicate hashes are looked up once. The hashes are queried in chunks of 500, so a large
 * list still uses the primary key index.
 *
 * @template T_Output - The expected type of the calculation results.
 * @param fdm - The FDM instance, providing database access.
 * @param calculation_hashes - The hashes identifying the cached calculations.
 * @returns A map from hash to cached result. Hashes without a cached result are missing.
 */
export async function getCachedCalculations<T_Output>(
  fdm: FdmType,
  calculation_hashes: readonly string[],
): Promise<Map<string, T_Output>> {
  const uniqueHashes = [...new Set(calculation_hashes)]
  const results = new Map<string, T_Output>()
  for (let i = 0; i < uniqueHashes.length; i += CACHE_READ_CHUNK_SIZE) {
    const rows = await fdm
      .select({
        calculation_hash: calculationCacheTable.calculation_hash,
        result: calculationCacheTable.result,
      })
      .from(calculationCacheTable)
      .where(
        inArray(
          calculationCacheTable.calculation_hash,
          uniqueHashes.slice(i, i + CACHE_READ_CHUNK_SIZE),
        ),
      )
    for (const row of rows) {
      results.set(row.calculation_hash, row.result as T_Output)
    }
  }
  return results
}

/**
 * Stores a calculation result in the cache.
 *
 * @template T_Input - The type of the input object for the calculation function.
 * @template T_Output - The type of the calculation result.
 * @param {FdmType} fdm - The FDM instance, providing database access.
 * @param {string} calculationHash - The unique hash of the calculation.
 * @param {string} calculationFunctionName - The name of the calculation function.
 * @param {string} calculatorVersion - The version of the calculator.
 * @param {T_Input} input - The input object used for the calculation.
 * @param {T_Output} result - The computed result of the calculation.
 * @returns {Promise<void>} A promise that resolves when the cache operation is complete.
 */
export async function setCachedCalculation<T_Input extends object, T_Output>(
  fdm: FdmType,
  calculationHash: string,
  calculationFunctionName: string,
  calculatorVersion: string,
  input: T_Input,
  result: T_Output,
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
    })
    .onConflictDoNothing()
}

/** A calculation result to store with {@link setCachedCalculations}. */
export type CachedCalculationRow = Pick<
  CalculationCacheTypeInsert,
  "calculation_hash" | "calculation_function" | "calculator_version" | "input" | "result"
>

/**
 * Stores several calculation results in the cache.
 *
 * The rows are inserted with one statement per 100 rows. Rows whose hash is already cached are
 * skipped, since the stored result is identical for the same hash.
 *
 * @param fdm - The FDM instance, providing database access.
 * @param rows - The calculation results to store.
 * @returns A promise that resolves when all rows have been written.
 */
export async function setCachedCalculations(
  fdm: FdmType,
  rows: readonly CachedCalculationRow[],
): Promise<void> {
  const uniqueRows = [...new Map(rows.map((row) => [row.calculation_hash, row])).values()]
  for (let i = 0; i < uniqueRows.length; i += CACHE_WRITE_CHUNK_SIZE) {
    await fdm
      .insert(calculationCacheTable)
      .values(uniqueRows.slice(i, i + CACHE_WRITE_CHUNK_SIZE))
      .onConflictDoNothing()
  }
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
 * Records several failed calculations with one insert per 100 errors.
 */
async function setCalculationErrors(
  fdm: FdmType,
  errors: readonly {
    calculation_function: string
    calculator_version: string
    input: object
    error_message: string
    stack_trace: string | undefined
  }[],
): Promise<void> {
  for (let i = 0; i < errors.length; i += CACHE_WRITE_CHUNK_SIZE) {
    await fdm.insert(calculationErrorsTable).values(
      errors.slice(i, i + CACHE_WRITE_CHUNK_SIZE).map((error) => ({
        ...error,
        calculation_error_id: createId(),
        stack_trace: error.stack_trace ?? null,
      })),
    )
  }
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
 * @param {string[]} sensitiveKeys - Keys whose values are replaced by `"REDACTED"` in the cache key and
 *                                   in the stored input, such as API keys.
 * @returns {CachedCalculation<T_Input, T_Output>} A new function that wraps the original calculation
 *          with caching logic. Use its `many` method to process several inputs with one cache query.
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
 *
 * // Process several inputs with one cache query and one cache insert
 * const results = await Promise.allSettled(
 *   cachedCalculation.many(fdm, [{ value: 10 }, { value: 20 }]),
 * ); // value 10 is a HIT, value 20 is calculated
 * ```
 */
export function withCalculationCache<T_Input extends object, T_Output>(
  calculationFunction: (inputs: T_Input) => T_Output | Promise<T_Output>,
  calculationFunctionName: string,
  calculatorVersion: string,
  sensitiveKeys: string[] = [],
): CachedCalculation<T_Input, T_Output> {
  /** Validates the configuration and returns the redacted input and hash for the cache. */
  const prepareCacheEntry = (input: T_Input) => {
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

    // Sanitize input if sensitive keys are provided
    const inputForCache =
      sensitiveKeys.length > 0 ? (redactSensitiveKeys(input, sensitiveKeys) as T_Input) : input

    // Generate a unique hash for the current calculation based on function name, version, and input.
    const calculationHash = generateCalculationHash(
      calculationFunctionName,
      calculatorVersion,
      inputForCache,
    )
    return { inputForCache, calculationHash }
  }

  /** Records a failed calculation in the database without blocking the caller. */
  const recordError = (fdm: FdmType, inputForCache: T_Input, e: unknown) => {
    recordErrors(fdm, [{ inputForCache, error: e }])
  }

  /** Records failed calculations in the database with one insert, without blocking the caller. */
  const recordErrors = (
    fdm: FdmType,
    failures: readonly { inputForCache: T_Input; error: unknown }[],
  ) => {
    setCalculationErrors(
      fdm,
      failures.map(({ inputForCache, error }) => ({
        calculation_function: calculationFunctionName,
        calculator_version: calculatorVersion,
        input: inputForCache,
        error_message: errorToMessage(error),
        stack_trace: error instanceof Error ? error.stack : undefined,
      })),
    ).catch((loggingError: unknown) => {
      console.error(
        `Failed to log calculation error for ${calculationFunctionName}: ${errorToMessage(loggingError)}`,
      )
    })
  }

  const many: CachedCalculation<T_Input, T_Output>["many"] = (fdm, inputs, options = {}) => {
    // Hash the inputs, read the cache once and start the calculation of the misses. Resolves
    // with one promise per unique hash, before the misses have been calculated.
    const pending = (async () => {
      const entries = inputs.map((input) => ({ input, ...prepareCacheEntry(input) }))

      let cached = new Map<string, T_Output>()
      let cacheResults = true
      try {
        cached = await getCachedCalculations<T_Output>(
          fdm,
          entries.map((entry) => entry.calculationHash),
        )
      } catch (e: unknown) {
        // Same as for a single input: calculate everything, but do not write to the cache
        cacheResults = false
        console.error(
          `Failed to read from calculation cache for ${calculationFunctionName} (${entries.length} inputs): ${errorToMessage(e)}`,
        )
      }

      const resultByHash = new Map<string, Promise<T_Output>>()
      const misses: (() => Promise<void>)[] = []
      const rowsToCache: CachedCalculationRow[] = []
      const failures: { inputForCache: T_Input; error: unknown }[] = []
      for (const { input, inputForCache, calculationHash } of entries) {
        if (resultByHash.has(calculationHash)) continue
        const cachedResult = cached.get(calculationHash)
        if (isUsableResult(cachedResult)) {
          resultByHash.set(calculationHash, Promise.resolve(cachedResult))
          continue
        }
        let resolve!: (result: T_Output) => void
        let reject!: (error: unknown) => void
        const promise = new Promise<T_Output>((res, rej) => {
          resolve = res
          reject = rej
        })
        // The caller handles the rejection through the promise returned for its input
        promise.catch(() => undefined)
        resultByHash.set(calculationHash, promise)
        misses.push(async () => {
          try {
            const result = await calculationFunction(input)
            if (isUsableResult(result)) {
              rowsToCache.push({
                calculation_hash: calculationHash,
                calculation_function: calculationFunctionName,
                calculator_version: calculatorVersion,
                input: inputForCache,
                result,
              })
            }
            resolve(result)
          } catch (e: unknown) {
            failures.push({ inputForCache, error: e })
            reject(e)
          }
        })
      }

      // Calculate the misses in the background, then write their results and their errors with
      // one insert each
      void runWithConcurrency(misses, options.concurrency).then(() => {
        if (failures.length > 0) {
          recordErrors(fdm, failures)
        }
        if (!cacheResults || rowsToCache.length === 0) return
        setCachedCalculations(fdm, rowsToCache).catch((e: unknown) => {
          console.error(
            `Failed to write to calculation cache for ${calculationFunctionName} (${rowsToCache.length} results): ${errorToMessage(e)}`,
          )
        })
      })

      return { entries, resultByHash }
    })()
    // Without inputs, nobody awaits `pending`; its errors reach the callers through the map below
    pending.catch(() => undefined)

    return inputs.map((_, index) =>
      pending.then(({ entries, resultByHash }) => {
        const result = resultByHash.get(entries[index].calculationHash)
        if (!result) throw new Error("Missing calculation result")
        return result
      }),
    )
  }

  const single = async (fdm: FdmType, input: T_Input): Promise<T_Output> => {
    const { inputForCache, calculationHash } = prepareCacheEntry(input)

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
      console.error(
        `Failed to read from calculation cache for ${calculationFunctionName} (hash: ${calculationHash}): ${errorToMessage(e)}`,
      )
      // Treat as a cache miss and proceed with calculation, but do not attempt to set a new cache entry
      // as the cache might be in an unhealthy state.
    }

    // If a cached result was successfully retrieved, return it immediately.
    if (isUsableResult(cachedResult)) {
      return cachedResult
    }

    // If no cached result was found (either genuinely a miss or cache read failed),
    // perform the actual calculation.
    try {
      const result = await calculationFunction(input)

      // If the initial cache read was successful (meaning the cache is healthy),
      // then store the new calculation result in the cache. Empty results are never read as a
      // hit, so they are not stored.
      // Fire-and-forget: don't await the cache write to avoid blocking the response
      // when many parallel calculations complete simultaneously (lock contention).
      if (cacheResultOfCalculation && isUsableResult(result)) {
        setCachedCalculation(
          fdm,
          calculationHash,
          calculationFunctionName,
          calculatorVersion,
          inputForCache,
          result,
        ).catch((e: unknown) => {
          console.error(
            `Failed to write to calculation cache for ${calculationFunctionName} (hash: ${calculationHash}): ${errorToMessage(e)}`,
          )
        })
      }

      return result
    } catch (e: unknown) {
      // Record the error in the database (fire-and-forget to avoid blocking error propagation).
      recordError(fdm, inputForCache, e)
      throw e
    }
  }

  return Object.assign(single, { many })
}

/**
 * Returns a copy of `value` in which the values of `sensitiveKeys` are replaced by `"REDACTED"`,
 * at any depth. Dates and other non-plain values are kept as they are.
 */
function redactSensitiveKeys(value: unknown, sensitiveKeys: readonly string[]): unknown {
  if (typeof value !== "object" || value === null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveKeys(item, sensitiveKeys))
  }
  if (value instanceof Date) {
    return value
  }

  const newObj = { ...(value as object) } as Record<string, unknown>
  for (const key of Object.keys(newObj)) {
    newObj[key] = sensitiveKeys.includes(key)
      ? "REDACTED"
      : redactSensitiveKeys(newObj[key], sensitiveKeys)
  }
  return newObj
}

/**
 * Runs the tasks with at most `concurrency` tasks at the same time (no limit when omitted).
 * The tasks must handle their own errors.
 */
async function runWithConcurrency(
  tasks: readonly (() => Promise<void>)[],
  concurrency = Number.POSITIVE_INFINITY,
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next]
      next += 1
      await task()
    }
  }
  const workers = Math.max(1, Math.min(concurrency, tasks.length))
  await Promise.all(Array.from({ length: workers }, worker))
}
