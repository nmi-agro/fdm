import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it, vi } from "vitest"
import type { FdmType } from "./fdm.types"
import {
  generateCalculationHash,
  getCachedCalculations,
  setCachedCalculation,
  setCachedCalculations,
  withCalculationCache,
} from "./calculator"
import { calculationCache, calculationErrors } from "./db/schema-calculator"
import { createFdmServer } from "./fdm-server"

describe("generateCalculationHash", () => {
  it("should produce the same hash for identical inputs regardless of object key order", () => {
    const functionName = "testFunction"
    const packageVersion = "1.0.0"
    const input1 = { a: 1, b: "test", c: true }
    const input2 = { b: "test", c: true, a: 1 } // Same content, different key order
    const input3 = { a: 1, b: "test", c: false } // Different content

    const hash1 = generateCalculationHash(functionName, packageVersion, input1)
    const hash2 = generateCalculationHash(functionName, packageVersion, input2)
    const hash3 = generateCalculationHash(functionName, packageVersion, input3)

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
  })

  it("should produce different hashes for different function names", () => {
    const packageVersion = "1.0.0"
    const input = { a: 1 }

    const hash1 = generateCalculationHash("functionA", packageVersion, input)
    const hash2 = generateCalculationHash("functionB", packageVersion, input)

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
    const getCalculation = withCalculationCache(calculate, "calculate", calculatorVersion)

    // First call: should calculate and cache
    await expect(getCalculation(fdm, input)).resolves.toBe("correct result for my value")
    expect(calculate).toHaveBeenCalledTimes(1)

    const expectedHash = generateCalculationHash("calculate", calculatorVersion, input)
    // The cache write is fire-and-forget, so wait until it is visible
    const cached = await vi.waitFor(async () => {
      const rows = await fdm
        .select()
        .from(calculationCache)
        .where(eq(calculationCache.calculation_hash, expectedHash))
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(cached[0].result).toBe("correct result for my value")
  })

  it("should return cached result if present for the same input", async () => {
    const calculate = vi.fn(async (inputs: { a: string }) => {
      return `correct result for ${inputs.a}`
    })
    const calculatorVersion = "1.0.0"
    const input = { a: "same value" }
    const getCalculation = withCalculationCache(calculate, "calculate", calculatorVersion)

    // Manually set a cached result
    const expectedHash = generateCalculationHash("calculate", calculatorVersion, input)
    await setCachedCalculation(
      fdm,
      expectedHash,
      "calculate",
      calculatorVersion,
      input,
      "pre-cached result",
    )

    // Second call: should use cache, not calculate
    await expect(getCalculation(fdm, input)).resolves.toBe("pre-cached result")
    expect(calculate).not.toHaveBeenCalled() // Should not call the original function
  })

  it("should record errors when calculation fails and re-throw", async () => {
    const calculate = vi.fn(async () => {
      throw new Error("calculation error occurred")
    })
    const calculatorVersion = "1.0.0"
    const input = { data: 123 }
    const getCalculation = withCalculationCache(calculate, "calculate", calculatorVersion)

    await expect(getCalculation(fdm, input)).rejects.toThrow("calculation error occurred")
    expect(calculate).toHaveBeenCalledTimes(1)

    const expectedHash = generateCalculationHash("calculate", calculatorVersion, input)
    const cached = await fdm
      .select()
      .from(calculationCache)
      .where(eq(calculationCache.calculation_hash, expectedHash))
    expect(cached).toHaveLength(0) // Should not cache errors

    // The error record is written fire-and-forget, so wait until it is visible
    const errors = await vi.waitFor(async () => {
      const rows = await fdm
        .select()
        .from(calculationErrors)
        .where(
          and(
            eq(calculationErrors.calculation_function, "calculate"),
            eq(calculationErrors.error_message, "calculation error occurred"),
          ),
        )
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(errors[0].stack_trace).toBeDefined()
  })

  it("should record errors when calculation throws a non-Error object", async () => {
    const calculate = vi.fn(async () => {
      throw "a simple string error" // Throwing a string
    })
    const calculatorVersion = "1.0.0"
    const input = { data: 456 }
    const getCalculation = withCalculationCache(calculate, "calculate", calculatorVersion)

    await expect(getCalculation(fdm, input)).rejects.toBe("a simple string error")
    expect(calculate).toHaveBeenCalledTimes(1)

    const expectedHash = generateCalculationHash("calculate", calculatorVersion, input)
    const cached = await fdm
      .select()
      .from(calculationCache)
      .where(eq(calculationCache.calculation_hash, expectedHash))
    expect(cached).toHaveLength(0) // Should not cache errors

    const errors = await vi.waitFor(async () => {
      const rows = await fdm
        .select()
        .from(calculationErrors)
        .where(
          and(
            eq(calculationErrors.calculation_function, "calculate"),
            eq(calculationErrors.error_message, "a simple string error"),
          ),
        )
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(errors[0].stack_trace).toBeNull() // Stack trace should be null for non-Error objects
  })

  it("should handle cache read failure and proceed with calculation without caching", async () => {
    const calculate = vi.fn(async (inputs: { val: number }) => {
      return inputs.val * 10
    })
    const calculatorVersion = "1.0.0"
    const input = { val: 5 }
    const getCalculation = withCalculationCache(calculate, "calculate", calculatorVersion)

    // Mock getCachedCalculation to throw an error
    vi.spyOn(fdm, "select").mockImplementationOnce(() => {
      throw new Error("Database connection lost during cache read")
    })

    await expect(getCalculation(fdm, input)).resolves.toBe(50)
    expect(calculate).toHaveBeenCalledTimes(1) // Original calculation should still run

    const expectedHash = generateCalculationHash("calculate", calculatorVersion, input)
    const cached = await fdm
      .select()
      .from(calculationCache)
      .where(eq(calculationCache.calculation_hash, expectedHash))
    expect(cached).toHaveLength(0) // Should NOT cache the result if cache read failed
  })

  it("should redact sensitive keys from cache key and storage", async () => {
    const calculate = vi.fn(async (inputs: { data: string; apiKey: string }) => {
      return `result for ${inputs.data}`
    })
    const calculatorVersion = "1.0.0"
    const input = { data: "public data", apiKey: "secret-key" }
    const getCalculation = withCalculationCache(
      calculate,
      "calculateWithSecrets",
      calculatorVersion,
      ["apiKey"],
    )

    // Call the function
    await expect(getCalculation(fdm, input)).resolves.toBe("result for public data")

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
    const cached = await vi.waitFor(async () => {
      const rows = await fdm
        .select()
        .from(calculationCache)
        .where(eq(calculationCache.calculation_hash, expectedHash))
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(cached[0].result).toBe("result for public data")

    // Verify stored input in DB is redacted
    // Note: The input column type in DB might be JSON, drizzle handles it.
    const storedInput = cached[0].input as any
    expect(storedInput.apiKey).toBe("REDACTED")
    expect(storedInput.data).toBe("public data")
  })

  it("should redact nested sensitive keys from cache key and storage", async () => {
    const calculate = vi.fn(async (inputs: { data: { apiKey: string; value: string } }) => {
      return `result for ${inputs.data.value}`
    })
    const calculatorVersion = "1.0.0"
    const input = { data: { apiKey: "nested-secret", value: "public" } }
    const getCalculation = withCalculationCache(
      calculate,
      "calculateWithNestedSecrets",
      calculatorVersion,
      ["apiKey"],
    )

    await expect(getCalculation(fdm, input)).resolves.toBe("result for public")

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

    const cached = await vi.waitFor(async () => {
      const rows = await fdm
        .select()
        .from(calculationCache)
        .where(eq(calculationCache.calculation_hash, expectedHash))
      expect(rows).toHaveLength(1)
      return rows
    })

    const storedInput = cached[0].input as any
    expect(storedInput.data.apiKey).toBe("REDACTED")
  })

  it("should not store an empty result", async () => {
    const calculate = vi.fn(async () => null)
    const input = { empty: true }
    const getCalculation = withCalculationCache(calculate, "calculateEmpty", "1.0.0")
    const insertSpy = vi.spyOn(fdm, "insert")

    await expect(getCalculation(fdm, input)).resolves.toBeNull()
    await expect(getCalculation(fdm, input)).resolves.toBeNull()

    // An empty result is never a hit, so it is calculated again and never written
    expect(calculate).toHaveBeenCalledTimes(2)
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe("getCachedCalculations and setCachedCalculations", () => {
  let fdm: FdmType

  beforeEach(async () => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    await fdm.delete(calculationCache)
  })

  it("should write several rows and read them back by hash", async () => {
    const rows = [1, 2, 3].map((value) => ({
      calculation_hash: generateCalculationHash("batchTest", "1.0.0", { value }),
      calculation_function: "batchTest",
      calculator_version: "1.0.0",
      input: { value },
      result: { doubled: value * 2 },
    }))
    // A duplicate row in the same call and a second call are both skipped
    await setCachedCalculations(fdm, [...rows, rows[0]])
    await setCachedCalculations(fdm, [rows[1]])

    const missingHash = generateCalculationHash("batchTest", "1.0.0", { value: 4 })
    const results = await getCachedCalculations<{ doubled: number }>(fdm, [
      rows[0].calculation_hash,
      rows[2].calculation_hash,
      rows[0].calculation_hash,
      missingHash,
    ])

    expect(results.size).toBe(2)
    expect(results.get(rows[0].calculation_hash)).toEqual({ doubled: 2 })
    expect(results.get(rows[2].calculation_hash)).toEqual({ doubled: 6 })
    expect(results.has(missingHash)).toBe(false)
  })

  it("should split large requests into chunks", async () => {
    const rows = Array.from({ length: 501 }, (_, value) => ({
      calculation_hash: generateCalculationHash("chunkTest", "1.0.0", { value }),
      calculation_function: "chunkTest",
      calculator_version: "1.0.0",
      input: { value },
      result: { value },
    }))
    const insertSpy = vi.spyOn(fdm, "insert")
    await setCachedCalculations(fdm, rows)
    expect(insertSpy).toHaveBeenCalledTimes(6) // 100 rows per insert

    const selectSpy = vi.spyOn(fdm, "select")
    const results = await getCachedCalculations(
      fdm,
      rows.map((row) => row.calculation_hash),
    )
    expect(selectSpy).toHaveBeenCalledTimes(2) // 500 hashes per query
    expect(results.size).toBe(501)
  })

  it("should do nothing for empty lists", async () => {
    const selectSpy = vi.spyOn(fdm, "select")
    const insertSpy = vi.spyOn(fdm, "insert")
    await expect(getCachedCalculations(fdm, [])).resolves.toEqual(new Map())
    await setCachedCalculations(fdm, [])
    expect(selectSpy).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe("withCalculationCache many", () => {
  let fdm: FdmType
  const calculatorVersion = "1.0.0"

  beforeEach(async () => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    await fdm.delete(calculationCache)
    await fdm.delete(calculationErrors)
  })

  /** Waits until all given hashes are visible in the cache table. */
  async function waitForCachedHashes(hashes: string[]) {
    return vi.waitFor(async () => {
      const results = await getCachedCalculations(fdm, hashes)
      expect(results.size).toBe(new Set(hashes).size)
      return results
    })
  }

  it("should read the cache once, calculate all misses and write them with one insert", async () => {
    const calculate = vi.fn(async (input: { value: number }) => input.value * 2)
    const getCalculation = withCalculationCache(calculate, "manyMiss", calculatorVersion)
    const inputs = [1, 2, 3, 4].map((value) => ({ value }))
    const selectSpy = vi.spyOn(fdm, "select")
    const insertSpy = vi.spyOn(fdm, "insert")

    const results = await Promise.all(getCalculation.many(fdm, inputs))

    expect(results).toEqual([2, 4, 6, 8])
    expect(calculate).toHaveBeenCalledTimes(4)
    expect(selectSpy).toHaveBeenCalledTimes(1)
    const hashes = inputs.map((input) =>
      generateCalculationHash("manyMiss", calculatorVersion, input),
    )
    const cached = await waitForCachedHashes(hashes)
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(cached.get(hashes[2])).toBe(6)
  })

  it("should only calculate the inputs without a cached result", async () => {
    const calculate = vi.fn(async (input: { value: number }) => input.value * 2)
    const getCalculation = withCalculationCache(calculate, "manyPartial", calculatorVersion)
    await setCachedCalculation(
      fdm,
      generateCalculationHash("manyPartial", calculatorVersion, { value: 1 }),
      "manyPartial",
      calculatorVersion,
      { value: 1 },
      "cached",
    )

    const results = await Promise.all(getCalculation.many(fdm, [{ value: 1 }, { value: 2 }]))

    expect(results).toEqual(["cached", 4])
    expect(calculate).toHaveBeenCalledTimes(1)
    expect(calculate).toHaveBeenCalledWith({ value: 2 })
  })

  it("should calculate identical inputs once and keep the order of the inputs", async () => {
    const calculate = vi.fn(async (input: { value: number; delay: number }) => {
      await new Promise((resolve) => setTimeout(resolve, input.delay))
      return input.value
    })
    const getCalculation = withCalculationCache(calculate, "manyOrder", calculatorVersion)
    const inputs = [
      { value: 1, delay: 30 },
      { value: 2, delay: 0 },
      { value: 1, delay: 30 },
    ]

    const results = await Promise.all(getCalculation.many(fdm, inputs))

    expect(results).toEqual([1, 2, 1])
    expect(calculate).toHaveBeenCalledTimes(2)
  })

  it("should reject only the promise of an input whose calculation fails", async () => {
    const calculate = vi.fn(async (input: { value: number }) => {
      if (input.value === 2) throw new Error("value 2 is not allowed")
      return input.value
    })
    const getCalculation = withCalculationCache(calculate, "manyError", calculatorVersion)

    const results = await Promise.allSettled(
      getCalculation.many(fdm, [{ value: 1 }, { value: 2 }, { value: 3 }]),
    )

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"])
    expect((results[1] as PromiseRejectedResult).reason).toEqual(
      new Error("value 2 is not allowed"),
    )

    // The error is recorded and the successful results are still cached
    await vi.waitFor(async () => {
      const rows = await fdm
        .select()
        .from(calculationErrors)
        .where(eq(calculationErrors.calculation_function, "manyError"))
      expect(rows).toHaveLength(1)
    })
    await waitForCachedHashes([
      generateCalculationHash("manyError", calculatorVersion, { value: 1 }),
      generateCalculationHash("manyError", calculatorVersion, { value: 3 }),
    ])
  })

  it("should record the errors of several inputs with one insert", async () => {
    const calculate = vi.fn(async (input: { value: number }) => {
      throw new Error(`value ${input.value} is not allowed`)
    })
    const getCalculation = withCalculationCache(calculate, "manyErrors", calculatorVersion)
    const insertSpy = vi.spyOn(fdm, "insert")

    const results = await Promise.allSettled(
      getCalculation.many(fdm, [{ value: 1 }, { value: 2 }, { value: 3 }]),
    )

    expect(results.every((result) => result.status === "rejected")).toBe(true)
    const rows = await vi.waitFor(async () => {
      const errorRows = await fdm
        .select()
        .from(calculationErrors)
        .where(eq(calculationErrors.calculation_function, "manyErrors"))
      expect(errorRows).toHaveLength(3)
      return errorRows
    })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(rows.map((row) => row.error_message).sort()).toEqual([
      "value 1 is not allowed",
      "value 2 is not allowed",
      "value 3 is not allowed",
    ])
    expect(rows.every((row) => row.stack_trace)).toBe(true)
  })

  it("should calculate without caching when the cache read fails", async () => {
    const calculate = vi.fn(async (input: { value: number }) => input.value * 10)
    const getCalculation = withCalculationCache(calculate, "manyReadFailure", calculatorVersion)
    vi.spyOn(fdm, "select").mockImplementationOnce(() => {
      throw new Error("Database connection lost during cache read")
    })
    const insertSpy = vi.spyOn(fdm, "insert")

    const results = await Promise.all(getCalculation.many(fdm, [{ value: 1 }, { value: 2 }]))

    expect(results).toEqual([10, 20])
    // Give a fire-and-forget write the chance to happen
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it("should limit the number of misses calculated at the same time", async () => {
    let running = 0
    let maxRunning = 0
    const calculate = vi.fn(async (input: { value: number }) => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await new Promise((resolve) => setTimeout(resolve, 10))
      running -= 1
      return input.value
    })
    const getCalculation = withCalculationCache(calculate, "manyConcurrency", calculatorVersion)
    const inputs = Array.from({ length: 7 }, (_, value) => ({ value }))

    const results = await Promise.all(getCalculation.many(fdm, inputs, { concurrency: 2 }))

    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(maxRunning).toBe(2)
  })

  it("should resolve cache hits without waiting for the misses", async () => {
    const calculate = vi.fn(
      (input: { value: number }) =>
        new Promise<number>((resolve) => setTimeout(() => resolve(input.value), 200)),
    )
    const getCalculation = withCalculationCache(calculate, "manyStreaming", calculatorVersion)
    await setCachedCalculation(
      fdm,
      generateCalculationHash("manyStreaming", calculatorVersion, { value: 1 }),
      "manyStreaming",
      calculatorVersion,
      { value: 1 },
      100,
    )

    const [hit, miss] = getCalculation.many(fdm, [{ value: 1 }, { value: 2 }])
    const first = await Promise.race([hit.then(() => "hit"), miss.then(() => "miss")])

    expect(first).toBe("hit")
    await expect(hit).resolves.toBe(100)
    await expect(miss).resolves.toBe(2)
  })

  it("should redact sensitive keys and use the same cache entries as a single call", async () => {
    const calculate = vi.fn(
      async (input: { data: string; apiKey: string }) => `result ${input.data}`,
    )
    const getCalculation = withCalculationCache(calculate, "manyRedact", calculatorVersion, [
      "apiKey",
    ])
    const input = { data: "public", apiKey: "secret" }

    await expect(Promise.all(getCalculation.many(fdm, [input]))).resolves.toEqual(["result public"])
    expect(calculate).toHaveBeenCalledWith(input)

    const hash = generateCalculationHash("manyRedact", calculatorVersion, {
      data: "public",
      apiKey: "REDACTED",
    })
    await waitForCachedHashes([hash])
    const rows = await fdm
      .select()
      .from(calculationCache)
      .where(eq(calculationCache.calculation_hash, hash))
    expect((rows[0].input as { apiKey: string }).apiKey).toBe("REDACTED")

    // A single call with another key finds the entry written by `many`
    await expect(getCalculation(fdm, { ...input, apiKey: "other" })).resolves.toBe("result public")
    expect(calculate).toHaveBeenCalledTimes(1)
  })

  it("should return an empty list for no inputs", async () => {
    const calculate = vi.fn(async () => 1)
    const getCalculation = withCalculationCache(calculate, "manyEmpty", calculatorVersion)
    expect(getCalculation.many(fdm, [])).toEqual([])
    expect(calculate).not.toHaveBeenCalled()
  })

  it("should reject all inputs when the cache configuration is invalid", async () => {
    const getCalculation = withCalculationCache(async () => 1, "", calculatorVersion)
    const results = await Promise.allSettled(getCalculation.many(fdm, [{ a: 1 }, { a: 2 }]))
    expect(results.every((result) => result.status === "rejected")).toBe(true)
  })
})
