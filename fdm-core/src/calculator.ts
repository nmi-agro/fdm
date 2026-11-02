import { inArray } from "drizzle-orm"
import { createHash } from "node:crypto"
import stableStringify from "safe-stable-stringify"
import type { FdmType } from "./fdm.types"
import {
  calculationCache as calculationCacheTable,
  calculationErrors as calculationErrorsTable,
} from "./db/schema-calculator"
import { createId } from "./id"

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
  return getCachedCalculations<T_Output>(fdm, [calculation_hash]).then(
    // See if a cached calculation for this input hash was retrieved and if so return it, otherwise return null.
    (results) => results.get(calculation_hash) ?? null,
  )
}

/**
 * Retrieves multiple cached calculation results for a list of calculation hashes from the database.
 *
 * @template T_Output - The expected type of the calculation result.
 * @param {FdmType} fdm - The FDM instance, providing database access.
 * @param {string} calculation_hash - List of hashes identifying the cached calculations.
 * @returns {Promise<Map<string, T_Output>>} A promise that resolves to a Map from each calculation hash to its
 * found cached calculation. Some calculation hashes might me missing from the returned map, which means no cached
 * calculation was found for those hashes.
 */
export async function getCachedCalculations<T_Output>(
  fdm: FdmType,
  calculation_hashes: string[],
): Promise<Map<string, T_Output>> {
  const dedupedHashes = [...new Set(calculation_hashes)]
  // Query the calculation cache table for a record matching the provided hash.
  // Limits to 1 result as the hash is a primary key.
  const result = await fdm
    .select({
      calculation_hash: calculationCacheTable.calculation_hash,
      result: calculationCacheTable.result,
    })
    .from(calculationCacheTable)
    .where(inArray(calculationCacheTable.calculation_hash, dedupedHashes))
    .limit(dedupedHashes.length)

  // Build a Map from the retrieved cached calculation results.
  return new Map(result.map((row) => [row.calculation_hash, row.result as T_Output]))
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
  return await setCachedCalculations(fdm, calculationFunctionName, calculatorVersion, [
    { calculation_hash: calculationHash, inputForCache: input, result: result },
  ])
}

async function setCachedCalculations<T_Input extends object, T_Output>(
  fdm: FdmType,
  calculationFunctionName: string,
  calculatorVersion: string,
  values: {
    calculation_hash: string
    inputForCache: T_Input
    result: T_Output
  }[],
) {
  // Inserts new cache records. If a record with the same calculation_hash already exists,
  // skip the insert — the stored result is identical since the hash is deterministic.
  await fdm
    .insert(calculationCacheTable)
    .values(
      values.map((v) => ({
        calculation_hash: v.calculation_hash,
        calculation_function: calculationFunctionName,
        calculator_version: calculatorVersion,
        input: v.inputForCache,
        result: v.result,
      })),
    )
    .onConflictDoNothing()
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
  return await setCalculationErrors(fdm, calculationFunctionName, calculatorVersion, [
    { inputForCache: input, error_message: error_message, stack_trace: stack_trace },
  ])
}

async function setCalculationErrors<T_Input extends object>(
  fdm: FdmType,
  calculationFunctionName: string,
  calculatorVersion: string,
  values: {
    inputForCache: T_Input
    error_message: string
    stack_trace: string | undefined
  }[],
) {
  return fdm.insert(calculationErrorsTable).values(
    values.map((v) => ({
      calculation_error_id: createId(), // Generate a unique ID for each error record
      calculation_function: calculationFunctionName,
      calculator_version: calculatorVersion,
      input: v.inputForCache,
      error_message: v.error_message,
      stack_trace: v.stack_trace ?? null, // Store stack trace, or null if not provided
    })),
  )
}

/**
 * Limit on the number of IDs to include in one cache lookup query, needed because of the SQL query
 * parameter limit.
 */
const MAX_CACHE_LOOKUPS_PER_DB_QUERY = 1000

/**
 * Limit the number of concurrent calculate... calls. There is also the ApiClient used for NMI API
 * calls, which works independently to this.
 */
const MAX_RECOMPUTATION_CONCURRENCY = 100

/*
 * Limit on the number of cache items to write in one DB query, needed because of the SQL query
 * parameter limit.
 */
const MAX_CACHE_WRITE_PER_DB_QUERY = 100

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
): ((fdm: FdmType, input: T_Input) => Promise<T_Output>) & {
  many: (fdm: FdmType, inputs: T_Input[]) => Promise<Promise<T_Output>[]>
} {
  const many = async (fdm: FdmType, inputs: T_Input[]) => {
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

    const calculationInputs: {
      input: T_Input
      inputForCache: T_Input
      calculation_hash: string
    }[] = []
    // Collect each calculation hash
    for (const input of inputs) {
      // Sanitize input if sensitive keys are provided
      let inputForCache = input
      if (sensitiveKeys.length > 0) {
        const redact = (obj: unknown): unknown => {
          if (typeof obj !== "object" || obj === null) {
            return obj
          }
          if (Array.isArray(obj)) {
            return obj.map(redact)
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
              newObj[key] = redact(newObj[key])
            }
          }
          return newObj
        }
        inputForCache = redact(input) as T_Input
      }

      // Generate a unique hash for the current calculation based on function name, version, and input.
      const calculationHash = await generateCalculationHash(
        calculationFunctionName,
        calculatorVersion,
        inputForCache,
      )

      calculationInputs.push({
        input: input,
        inputForCache: inputForCache,
        calculation_hash: calculationHash,
      })
    }

    const cacheLookupPromises: Promise<{
      hashes: string[]
      cachedResults: Map<string, T_Output>
      cacheResultOfCalculation: boolean
    }>[] = []

    for (let i = 0; i < calculationInputs.length; i += MAX_CACHE_LOOKUPS_PER_DB_QUERY) {
      const hashes = calculationInputs
        .slice(i, i + MAX_CACHE_LOOKUPS_PER_DB_QUERY)
        .map((input) => input.calculation_hash)
      cacheLookupPromises.push(
        (async () => {
          for (let trial = 0; trial < 3; trial++) {
            try {
              return {
                hashes: hashes,
                cachedResults: await getCachedCalculations(fdm, hashes),
                cacheResultOfCalculation: true,
              }
            } catch (e) {
              // If reading from cache fails, log the error and mark that the result should not be cached.
              // This makes the caching mechanism resilient to temporary database issues.
              const errorMessage = e instanceof Error ? e.message : String(e)
              console.error(
                `Failed to read from calculation cache for ${calculationFunctionName}: ${errorMessage}`,
              )
              // Treat as a cache miss and proceed with calculation, but do not attempt to set a new cache entry
              // as the cache might be in an unhealthy state.
            }
          }
          return {
            hashes: hashes,
            cachedResults: new Map(),
            cacheResultOfCalculation: false,
          }
        })(),
      )
    }

    const cacheLookups = await Promise.all(cacheLookupPromises)
    const toRecompute: {
      input: T_Input
      inputForCache: T_Input
      calculation_hash: string
      cacheResultOfCalculation: boolean
    }[] = []

    const returnValue = new Map<string, Promise<T_Output>>()

    for (let i = 0; i < inputs.length; i++) {
      const { calculation_hash, input, inputForCache } = calculationInputs[i]
      const batchNr = Math.floor(i / MAX_CACHE_LOOKUPS_PER_DB_QUERY)
      const cachedResult = cacheLookups[batchNr].cachedResults.get(calculation_hash) ?? null
      if (cachedResult !== null) {
        returnValue.set(calculation_hash, Promise.resolve(cachedResult))
      } else {
        toRecompute.push({
          input: input,
          inputForCache: inputForCache,
          calculation_hash: calculation_hash,
          cacheResultOfCalculation: cacheLookups[batchNr].cacheResultOfCalculation,
        })
      }
    }

    const resultsToWrite: {
      calculation_hash: string
      inputForCache: T_Input
      result: T_Output
    }[] = []

    const errorsToWrite: {
      calculation_hash: string
      inputForCache: T_Input
      error_message: string
      stack_trace: any
    }[] = []

    for (
      let recomputeBatchStart = 0;
      recomputeBatchStart < toRecompute.length;
      recomputeBatchStart += MAX_RECOMPUTATION_CONCURRENCY
    ) {
      const batch = toRecompute.slice(
        recomputeBatchStart,
        recomputeBatchStart + MAX_RECOMPUTATION_CONCURRENCY,
      )
      await Promise.allSettled(
        batch.map(async ({ input, inputForCache, calculation_hash, cacheResultOfCalculation }) => {
          try {
            const result = await calculationFunction(input)
            if (cacheResultOfCalculation) {
              resultsToWrite.push({
                calculation_hash,
                inputForCache,
                result,
              })
            }
            returnValue.set(calculation_hash, Promise.resolve(result))
          } catch (e) {
            const error_message = e instanceof Error ? e.message : String(e)
            const stack_trace = e instanceof Error ? e.stack : undefined
            errorsToWrite.push({
              calculation_hash,
              inputForCache,
              error_message,
              stack_trace,
            })
            returnValue.set(calculation_hash, Promise.reject(e))
          }
        }),
      )
    }

    for (
      let resultsToWriteStart = 0;
      resultsToWriteStart < resultsToWrite.length;
      resultsToWriteStart += MAX_CACHE_WRITE_PER_DB_QUERY
    ) {
      const batch = resultsToWrite.slice(
        resultsToWriteStart,
        resultsToWriteStart + MAX_CACHE_WRITE_PER_DB_QUERY,
      )
      // Fire and forget
      setCachedCalculations(fdm, calculationFunctionName, calculatorVersion, batch).catch(
        (e: unknown) => {
          const errorMessage = e instanceof Error ? e.message : String(e)
          console.error(
            `Failed to write to calculation cache for ${calculationFunctionName}: ${errorMessage}`,
          )
        },
      )
    }

    for (
      let errorsToWriteStart = 0;
      errorsToWriteStart < errorsToWrite.length;
      errorsToWriteStart += MAX_CACHE_WRITE_PER_DB_QUERY
    ) {
      const batch = errorsToWrite.slice(
        errorsToWriteStart,
        errorsToWriteStart + MAX_CACHE_WRITE_PER_DB_QUERY,
      )
      setCalculationErrors(fdm, calculationFunctionName, calculatorVersion, batch).catch(
        (loggingError: unknown) => {
          const loggingErrorMessage =
            loggingError instanceof Error ? loggingError.message : String(loggingError)
          console.error(
            `Failed to log calculation error for ${calculationFunctionName}: ${loggingErrorMessage}`,
          )
        },
      )
    }

    return calculationInputs.map((input) => returnValue.get(input.calculation_hash)!)
  }

  const single = async (fdm: FdmType, input: T_Input) => {
    return many(fdm, [input]).then((m) => m[0])
  }

  single.many = many

  return single
}
