import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it, vi } from "vitest"
import {
    generateCalculationHash,
    setCachedCalculation,
    withCalculationCache,
} from "./calculator"
import { calculationCache, calculationErrors } from "./db/schema-calculator"
import type { FdmType } from "./fdm"
import { createFdmServer } from "./fdm-server"

describe("generateCalculationHash", () => {
    it("should produce the same hash for identical inputs regardless of object key order", () => {
        const functionName = "testFunction"
        const packageVersion = "1.0.0"
        const input1 = { a: 1, b: "test", c: true }
        const input2 = { b: "test", c: true, a: 1 } // Same content, different key order
        const input3 = { a: 1, b: "test", c: false } // Different content

        const hash1 = generateCalculationHash(
            functionName,
            packageVersion,
            input1,
        )
        const hash2 = generateCalculationHash(
            functionName,
            packageVersion,
            input2,
        )
        const hash3 = generateCalculationHash(
            functionName,
            packageVersion,
            input3,
        )

        expect(hash1).toBe(hash2)
        expect(hash1).not.toBe(hash3)
    })

    it("should produce different hashes for different function names", () => {
        const packageVersion = "1.0.0"
        const input = { a: 1 }

        const hash1 = generateCalculationHash(
            "functionA",
            packageVersion,
            input,
        )
        const hash2 = generateCalculationHash(
            "functionB",
            packageVersion,
            input,
        )

        expect(hash1).not.toBe(hash2)
    })

    it("should produce different hashes for different package versions", () => {
        const functionName = "testFunction"
        const input = { a: 1 }

        const hash1 = generateCalculationHash(functionName, "1.0.0", input)
        const hash2 = generateCalculationHash(functionName, "1.0.1", input)

        expect(hash1).not.toBe(hash2)
    })

    it("should handle empty objects and strings", () => {
        const hash1 = generateCalculationHash("func", "1.0", {})
        const hash2 = generateCalculationHash("func", "1.0", {})
        const hash3 = generateCalculationHash("func2", "1.0", {})

        expect(hash1).toBe(hash2)
        expect(hash1).not.toBe(hash3)
    })
})

describe("withCalculationCache", () => {
    let fdm: FdmType

    beforeEach(async () => {
        const host = inject("host")
        const port = inject("port")
        const user = inject("user")
        const password = inject("password")
        const database = inject("database")
        fdm = createFdmServer(host, port, user, password, database)

        // Clear tables before each test
        await fdm.delete(calculationCache)
        await fdm.delete(calculationErrors)
    })

    it("should calculate if no cached result is present and cache the result", async () => {
        const calculate = vi.fn(async (inputs: { a: string }) => {
            return `correct result for ${inputs.a}`
        })
        const calculatorVersion = "1.0.0"
        const input = { a: "my value" }
        const getCalculation = withCalculationCache(
            calculate,
            "calculate",
            calculatorVersion,
        )

        // First call: should calculate and cache
        await expect(getCalculation(fdm, input)).resolves.toBe(
            "correct result for my value",
        )
        expect(calculate).toHaveBeenCalledTimes(1)

        const expectedHash = generateCalculationHash(
            "calculate",
            calculatorVersion,
            input,
        )
        const cached = await fdm
            .select()
            .from(calculationCache)
            .where(eq(calculationCache.calculation_hash, expectedHash))
        expect(cached).toHaveLength(1)
        expect(cached[0].result).toBe("correct result for my value")
    })

    it("should return cached result if present for the same input", async () => {
        const calculate = vi.fn(async (inputs: { a: string }) => {
            return `correct result for ${inputs.a}`
        })
        const calculatorVersion = "1.0.0"
        const input = { a: "same value" }
        const getCalculation = withCalculationCache(
            calculate,
            "calculate",
            calculatorVersion,
        )

        // Manually set a cached result
        const expectedHash = generateCalculationHash(
            "calculate",
            calculatorVersion,
            input,
        )
        await setCachedCalculation(
            fdm,
            expectedHash,
            "calculate",
            calculatorVersion,
            input,
            "pre-cached result",
        )

        // Second call: should use cache, not calculate
        await expect(getCalculation(fdm, input)).resolves.toBe(
            "pre-cached result",
        )
        expect(calculate).not.toHaveBeenCalled() // Should not call the original function
    })

    it("should record errors when calculation fails and re-throw", async () => {
        const calculate = vi.fn(async () => {
            throw new Error("calculation error occurred")
        })
        const calculatorVersion = "1.0.0"
        const input = { data: 123 }
        const getCalculation = withCalculationCache(
            calculate,
            "calculate",
            calculatorVersion,
        )

        await expect(getCalculation(fdm, input)).rejects.toThrow(
            "calculation error occurred",
        )
        expect(calculate).toHaveBeenCalledTimes(1)

        const expectedHash = generateCalculationHash(
            "calculate",
            calculatorVersion,
            input,
        )
        const cached = await fdm
            .select()
            .from(calculationCache)
            .where(eq(calculationCache.calculation_hash, expectedHash))
        expect(cached).toHaveLength(0) // Should not cache errors

        const errors = await fdm
            .select()
            .from(calculationErrors)
            .where(
                and(
                    eq(calculationErrors.calculation_function, "calculate"),
                    eq(
                        calculationErrors.error_message,
                        "calculation error occurred",
                    ),
                ),
            )
        expect(errors).toHaveLength(1)
        expect(errors[0].stack_trace).toBeDefined()
    })

    it("should record errors when calculation throws a non-Error object", async () => {
        const calculate = vi.fn(async () => {
            throw "a simple string error" // Throwing a string
        })
        const calculatorVersion = "1.0.0"
        const input = { data: 456 }
        const getCalculation = withCalculationCache(
            calculate,
            "calculate",
            calculatorVersion,
        )

        await expect(getCalculation(fdm, input)).rejects.toBe(
            "a simple string error",
        )
        expect(calculate).toHaveBeenCalledTimes(1)

        const expectedHash = generateCalculationHash(
            "calculate",
            calculatorVersion,
            input,
        )
        const cached = await fdm
            .select()
            .from(calculationCache)
            .where(eq(calculationCache.calculation_hash, expectedHash))
        expect(cached).toHaveLength(0) // Should not cache errors

        const errors = await fdm
            .select()
            .from(calculationErrors)
            .where(
                and(
                    eq(calculationErrors.calculation_function, "calculate"),
                    eq(
                        calculationErrors.error_message,
                        "a simple string error",
                    ),
                ),
            )
        expect(errors).toHaveLength(1)
        expect(errors[0].stack_trace).toBeNull() // Stack trace should be null for non-Error objects
    })

    it("should handle cache read failure and proceed with calculation without caching", async () => {
        const calculate = vi.fn(async (inputs: { val: number }) => {
            return inputs.val * 10
        })
        const calculatorVersion = "1.0.0"
        const input = { val: 5 }
        const getCalculation = withCalculationCache(
            calculate,
            "calculate",
            calculatorVersion,
        )

        // Mock getCachedCalculation to throw an error
        vi.spyOn(fdm, "select").mockImplementationOnce(() => {
            throw new Error("Database connection lost during cache read")
        })

        await expect(getCalculation(fdm, input)).resolves.toBe(50)
        expect(calculate).toHaveBeenCalledTimes(1) // Original calculation should still run

        const expectedHash = generateCalculationHash(
            "calculate",
            calculatorVersion,
            input,
        )
        const cached = await fdm
            .select()
            .from(calculationCache)
            .where(eq(calculationCache.calculation_hash, expectedHash))
        expect(cached).toHaveLength(0) // Should NOT cache the result if cache read failed
    })

    it("should redact sensitive keys from cache key and storage", async () => {
        const calculate = vi.fn(
            async (inputs: { data: string; apiKey: string }) => {
                return `result for ${inputs.data}`
            },
        )
        const calculatorVersion = "1.0.0"
        const input = { data: "public data", apiKey: "secret-key" }
        const getCalculation = withCalculationCache(
            calculate,
            "calculateWithSecrets",
            calculatorVersion,
            ["apiKey"],
        )

        // Call the function
        await expect(getCalculation(fdm, input)).resolves.toBe(
            "result for public data",
        )

        // Verify original function received full input including secret
        expect(calculate).toHaveBeenCalledWith(input)

        // Expected input for cache (with REDACTED secret)
        const expectedCacheInput = { data: "public data", apiKey: "REDACTED" }
        const expectedHash = generateCalculationHash(
            "calculateWithSecrets",
            calculatorVersion,
            expectedCacheInput,
        )

        // Verify cache entry exists with the redacted hash
        const cached = await fdm
            .select()
            .from(calculationCache)
            .where(eq(calculationCache.calculation_hash, expectedHash))
        expect(cached).toHaveLength(1)
        expect(cached[0].result).toBe("result for public data")

        // Verify stored input in DB is redacted
        // Note: The input column type in DB might be JSON, drizzle handles it.
        const storedInput = cached[0].input as any
        expect(storedInput.apiKey).toBe("REDACTED")
        expect(storedInput.data).toBe("public data")
    })

    it("should redact nested sensitive keys from cache key and storage", async () => {
        const calculate = vi.fn(
            async (inputs: { data: { apiKey: string; value: string } }) => {
                return `result for ${inputs.data.value}`
            },
        )
        const calculatorVersion = "1.0.0"
        const input = { data: { apiKey: "nested-secret", value: "public" } }
        const getCalculation = withCalculationCache(
            calculate,
            "calculateWithNestedSecrets",
            calculatorVersion,
            ["apiKey"],
        )

        await expect(getCalculation(fdm, input)).resolves.toBe(
            "result for public",
        )

        // Verify original function received full input
        expect(calculate).toHaveBeenCalledWith(input)

        // Expected input for cache (with nested REDACTED secret)
        const expectedCacheInput = {
            data: { apiKey: "REDACTED", value: "public" },
        }
        const expectedHash = generateCalculationHash(
            "calculateWithNestedSecrets",
            calculatorVersion,
            expectedCacheInput,
        )

        const cached = await fdm
            .select()
            .from(calculationCache)
            .where(eq(calculationCache.calculation_hash, expectedHash))
        expect(cached).toHaveLength(1)

        const storedInput = cached[0].input as any
        expect(storedInput.data.apiKey).toBe("REDACTED")
    })
})
