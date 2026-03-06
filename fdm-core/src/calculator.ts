import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import stableStringify from "safe-stable-stringify"
import {
    calculationCache as calculationCacheTable,
    calculationErrors as calculationErrorsTable,
} from "./db/schema-calculator"
import type { FdmType } from "./fdm"
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
    return result.then((rows: { result: T_Output }[]) =>
        rows?.length ? (rows[0].result as T_Output) : null,
    )
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
    // this operation will likely cause a unique constraint violation error, as upsert was removed.
    await fdm.insert(calculationCacheTable).values({
        calculation_hash: calculationHash,
        calculation_function: calculationFunctionName,
        calculator_version: calculatorVersion,
        input: input,
        result: result,
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
        const calculationHash = generateCalculationHash(
            calculationFunctionName,
            calculatorVersion,
            inputForCache,
        )

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
            // then attempt to store the new calculation result in the cache.
            if (cacheResultOfCalculation) {
                try {
                    await setCachedCalculation(
                        fdm,
                        calculationHash,
                        calculationFunctionName,
                        calculatorVersion,
                        inputForCache,
                        result,
                    )
                } catch (e: unknown) {
                    const errorMessage =
                        e instanceof Error ? e.message : String(e)
                    console.error(
                        `Failed to write to calculation cache for ${calculationFunctionName} (hash: ${calculationHash}): ${errorMessage}`,
                    )
                    // Continue execution - the calculation succeeded, only caching failed
                }
                // console.log(
                //     `Calculation for ${calculationFunctionName} (hash: ${calculationHash}) completed and cached.`,
                // )
            } else {
                // If cache read failed, log that the result is not being cached.
                // console.log(
                //     `Calculation for ${calculationFunctionName} (hash: ${calculationHash}) completed and not cached due to prior cache read failure.`,
                // )
            }

            return result
        } catch (e: unknown) {
            // If the calculation itself fails, record the error in the database
            // and re-throw it to propagate the failure to the caller.
            const errorMessage = e instanceof Error ? e.message : String(e)
            const stackTrace = e instanceof Error ? e.stack : undefined

            try {
                await setCalculationError(
                    fdm,
                    calculationFunctionName,
                    calculatorVersion,
                    inputForCache,
                    errorMessage,
                    stackTrace,
                )
            } catch (loggingError: unknown) {
                const loggingErrorMessage =
                    loggingError instanceof Error
                        ? loggingError.message
                        : String(loggingError)
                console.error(
                    `Failed to log calculation error for ${calculationFunctionName}: ${loggingErrorMessage}`,
                )
                // Continue to re-throw the original calculation error
            }

            throw e
        }
    }
}
