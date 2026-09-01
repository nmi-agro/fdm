import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it, vi } from "vitest"
import type { FdmType } from "./fdm.types"
import {
  generateCalculationHash,
  getCachedCalculationEntry,
  getCalculationCacheStatus,
  getLatestCachedResultForEntity,
  releaseCalculationLock,
  setCachedCalculation,
  tryAcquireCalculationLock,
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

    const errors = await fdm
      .select()
      .from(calculationErrors)
      .where(
        and(
          eq(calculationErrors.calculation_function, "calculate"),
          eq(calculationErrors.error_message, "calculation error occurred"),
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
    const getCalculation = withCalculationCache(calculate, "calculate", calculatorVersion)

    await expect(getCalculation(fdm, input)).rejects.toBe("a simple string error")
    expect(calculate).toHaveBeenCalledTimes(1)

    const expectedHash = generateCalculationHash("calculate", calculatorVersion, input)
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
          eq(calculationErrors.error_message, "a simple string error"),
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
    const calculate = vi.fn(async (inputs: { data: { apiKey: string; value: string } }) => {
      return `result for ${inputs.data.value}`
    })
    const date = new Date()
    const calculatorVersion = "1.0.0"
    const input = {
      data: {
        apiKey: "nested-secret",
        value: "public",
        date: date,
        items: [{ apiKey: "nested-secret" }],
      },
    }
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
      data: { apiKey: "REDACTED", value: "public", date: date, items: [{ apiKey: "REDACTED" }] },
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

  it("should tag the cache row with entity type/id when getEntityId is provided", async () => {
    const calculate = vi.fn(async (inputs: { b_id: string }) => `result for ${inputs.b_id}`)
    const calculatorVersion = "1.0.0"
    const input = { b_id: "field-1" }
    const getCalculation = withCalculationCache(
      calculate,
      "calculateForField",
      calculatorVersion,
      [],
      {
        entityType: "field",
        getEntityId: (i) => i.b_id,
      },
    )

    await expect(getCalculation(fdm, input)).resolves.toBe("result for field-1")

    const expectedHash = generateCalculationHash("calculateForField", calculatorVersion, input)
    const cached = await fdm
      .select()
      .from(calculationCache)
      .where(eq(calculationCache.calculation_hash, expectedHash))
    expect(cached).toHaveLength(1)
    expect(cached[0].entity_type).toBe("field")
    expect(cached[0].entity_id).toBe("field-1")
  })
})

describe("calculation cache locking", () => {
  let fdm: FdmType

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")
    fdm = createFdmServer(host, port, user, password, database)

    await fdm.delete(calculationCache)
    await fdm.delete(calculationErrors)
  })

  it("acquires the lock for a genuinely missing hash", async () => {
    const hash = "hash-missing"
    const acquired = await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculate",
      calculatorVersion: "1.0.0",
      input: { a: 1 },
      entityType: "field",
      entityId: "field-1",
    })

    expect(acquired).not.toBeNull()
    const entry = await getCachedCalculationEntry(fdm, hash)
    expect(entry?.is_processing).toBe(true)
    expect(entry?.result).toBeNull()
    expect(entry?.entity_type).toBe("field")
    expect(entry?.entity_id).toBe("field-1")
  })

  it("does not let a second caller acquire an already-held, non-expired lock", async () => {
    const hash = "hash-contended"
    const lockArgs = {
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculate",
      calculatorVersion: "1.0.0",
      input: { a: 1 },
    }

    const first = await tryAcquireCalculationLock(lockArgs)
    const second = await tryAcquireCalculationLock(lockArgs)

    expect(first).not.toBeNull()
    expect(second).toBeNull()
  })

  it("allows reclaiming a lock that has been held longer than the timeout", async () => {
    const hash = "hash-stuck"
    await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculate",
      calculatorVersion: "1.0.0",
      input: { a: 1 },
    })

    // Simulate a stuck lock by backdating updated_at.
    await fdm
      .update(calculationCache)
      .set({ updated_at: new Date(Date.now() - 20 * 60 * 1000) })
      .where(eq(calculationCache.calculation_hash, hash))

    const reclaimed = await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculate",
      calculatorVersion: "1.0.0",
      input: { a: 1 },
      lockTimeoutMs: 15 * 60 * 1000,
    })

    expect(reclaimed).not.toBeNull()
  })

  it("releases the lock and stores the result on success", async () => {
    const hash = "hash-release-success"
    const acquired = await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculate",
      calculatorVersion: "1.0.0",
      input: { a: 1 },
    })

    if (!acquired) {
      throw new Error("Expected locking to succeed.")
    }

    await expect(
      releaseCalculationLock(
        fdm,
        hash,
        { success: true, result: "final result" },
        acquired.updated_at,
      ),
    ).resolves.toBe(true)

    const entry = await getCachedCalculationEntry(fdm, hash)
    expect(entry?.is_processing).toBe(false)
    expect(entry?.updated_at).toBeNull()
    expect(entry?.result).toBe("final result")
  })

  it("fails to release the lock if it was locked again at a later time somehow", async () => {
    // Let's assume this was locked 5 minutes ago, and lock it again today.
    const input = { success: true, result: "old result" }
    const hash = generateCalculationHash("calculate", "1.0.0", input)
    const acquired = await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculate",
      calculatorVersion: "1.0.0",
      input: input,
    })

    if (!acquired) {
      throw new Error("Expected locking to succeed.")
    }

    // Assume this is for the hypothetical locking event 5 minutes ago. It will fail.
    await expect(
      releaseCalculationLock(
        fdm,
        hash,
        { success: true, result: "final result" },
        new Date(acquired.updated_at.getTime() - 5 * 60 * 1000),
      ),
    ).resolves.toBe(false)

    const entry = await getCachedCalculationEntry(fdm, hash)
    expect(entry?.is_processing).toBe(true)
    expect(entry?.updated_at).not.toBeNull()
    expect(entry?.result).toBeNull()
  })

  it("releases the lock without a result on failure, allowing a future retry", async () => {
    const hash = "hash-release-failure"
    const acquired = await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculate",
      calculatorVersion: "1.0.0",
      input: { a: 1 },
    })

    if (!acquired) {
      throw new Error("Expected locking to succeed.")
    }

    await expect(
      releaseCalculationLock(fdm, hash, { success: false }, acquired?.updated_at),
    ).resolves.toBe(true)

    const entry = await getCachedCalculationEntry(fdm, hash)
    expect(entry?.is_processing).toBe(false)
    expect(entry?.result).toBeNull()

    const reacquired = await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculate",
      calculatorVersion: "1.0.0",
      input: { a: 1 },
    })
    expect(reacquired).not.toBeNull()
  })

  it("returns the latest cached result for an entity across different hashes", async () => {
    await setCachedCalculation(
      fdm,
      "hash-old",
      "calculateForField",
      "1.0.0",
      { b_id: "field-1", version: "old" },
      "old result",
      "field",
      "field-1",
    )
    // Ensure a distinct created_at ordering.
    await new Promise((resolve) => setTimeout(resolve, 10))
    await setCachedCalculation(
      fdm,
      "hash-new",
      "calculateForField",
      "1.0.0",
      { b_id: "field-1", version: "new" },
      "new result",
      "field",
      "field-1",
    )

    const latest = await getLatestCachedResultForEntity(
      fdm,
      "calculateForField",
      "field",
      "field-1",
    )
    expect(latest).toBe("new result")
  })

  it("should fail on invalid calculation function name", async () => {
    const calculationFunction = vi.fn(() => 42)

    await expect(
      withCalculationCache(calculationFunction, "", "fdm-calculator:0.7.0")(fdm, {}),
    ).rejects.toThrow(
      "Calculation function name not provided for caching. Please provide a valid function name.",
    )
  })

  it("should fail on invalid calculator version", async () => {
    const calculationFunction = vi.fn(() => 42)

    await expect(
      withCalculationCache(calculationFunction, "calculateDeepThought", "")(fdm, {}),
    ).rejects.toThrow(
      "Calculator version not provided for caching. Please provide a valid version string.",
    )
  })
})

describe("getCalculationCacheStatus", () => {
  let fdm: FdmType

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")
    fdm = createFdmServer(host, port, user, password, database)

    await fdm.delete(calculationCache)
    await fdm.delete(calculationErrors)
  })

  it("reports 'missing' when there is no row for this hash or entity", async () => {
    const status = await getCalculationCacheStatus({
      fdm,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input: { b_id: "field-1" },
      entityType: "field",
      entityId: "field-1",
    })

    expect(status.state).toBe("missing")
    if (status.state === "missing" || status.state === "stale") {
      expect(status.staleResult).toBeNull()
    }
  })

  it("reports 'fresh' when a completed, non-processing row matches the current hash", async () => {
    const input = { b_id: "field-1" }
    const hash = generateCalculationHash("calculateForField", "1.0.0", input)
    await setCachedCalculation(
      fdm,
      hash,
      "calculateForField",
      "1.0.0",
      input,
      "fresh result",
      "field",
      "field-1",
    )

    const status = await getCalculationCacheStatus({
      fdm,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input,
      entityType: "field",
      entityId: "field-1",
    })

    expect(status).toEqual(expect.objectContaining({ state: "fresh", result: "fresh result" }))
  })

  it("falls back to the entity's last known result when the input changed since the last computation", async () => {
    await setCachedCalculation(
      fdm,
      "old-hash",
      "calculateForField",
      "1.0.0",
      { b_id: "field-1", version: "old" },
      "old result",
      "field",
      "field-1",
    )

    // The current input hashes to a row that doesn't exist yet ("missing"), but the entity's
    // last known (now-stale) result should still be surfaced so the page can render it immediately.
    const status = await getCalculationCacheStatus({
      fdm,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input: { b_id: "field-1", version: "new" },
      entityType: "field",
      entityId: "field-1",
    })

    expect(status.state).toBe("missing")
    if (status.state === "stale" || status.state === "missing") {
      expect(status.staleResult).toBe("old result")
    }
  })

  it("reports 'processing' when another worker holds a non-expired lock for this hash", async () => {
    const input = { b_id: "field-1" }
    const hash = generateCalculationHash("calculateForField", "1.0.0", input)
    await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input,
      entityType: "field",
      entityId: "field-1",
    })

    const status = await getCalculationCacheStatus({
      fdm,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input,
      entityType: "field",
      entityId: "field-1",
    })

    expect(status.state).toBe("processing")
  })

  it("returns the stale result as null if the cached result for this hash is null, and the entityType or ID aren't specified for stale result retrieval either", async () => {
    const input = { b_id: "field-1" }
    const hash = generateCalculationHash("calculateForField", "1.0.0", input)
    await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input,
      entityType: "field",
      entityId: "field-1",
    })

    const status = await getCalculationCacheStatus({
      fdm,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input,
    })

    expect(status.state).toBe("processing")
    expect((status as typeof status & { state: "processing" }).staleResult).toBeNull()
  })

  it("treats an expired lock as stale/missing again, not processing", async () => {
    const input = { b_id: "field-1" }
    const hash = generateCalculationHash("calculateForField", "1.0.0", input)
    await tryAcquireCalculationLock({
      fdm,
      calculationHash: hash,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input,
    })
    await fdm
      .update(calculationCache)
      .set({ updated_at: new Date(Date.now() - 20 * 60 * 1000) })
      .where(eq(calculationCache.calculation_hash, hash))

    const status = await getCalculationCacheStatus({
      fdm,
      calculationFunctionName: "calculateForField",
      calculatorVersion: "1.0.0",
      input,
      lockTimeoutMs: 15 * 60 * 1000,
    })

    expect(status.state).toBe("stale")
  })
})
