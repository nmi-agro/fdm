import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { NmiApiClient, bln3Client, soilEstimatesClient, soilReaderClient } from "./client"

describe("NmiApiClient.constructor", () => {
  it("should construct with no arguments", () => {
    const client = new NmiApiClient()
    expect(client.maxRetries).toBe(3)
  })

  it("should construct with an empty options object", () => {
    const client = new NmiApiClient({})
    expect(client.maxRetries).toBe(3)
  })

  it("should construct with custom number of max retries", () => {
    const client = new NmiApiClient({ maxRetries: 10 })
    expect(client.maxRetries).toBe(10)
  })

  describe("environment variables", () => {
    const originalEnv = { ...process.env }

    afterEach(() => {
      process.env = { ...originalEnv }
    })

    it("should read maxConcurrency, maxRetries and timeout from env vars", async () => {
      process.env.NMI_MAX_CONCURRENCY = "2"
      process.env.NMI_MAX_RETRIES = "7"
      process.env.NMI_REQUEST_TIMEOUT = "12345"

      const client = new NmiApiClient()

      expect(client.maxRetries).toBe(7)
      expect(client.timeout).toBe(12345)

      // Verify NMI_MAX_CONCURRENCY was applied by exhausting the semaphore's slots.
      await client.semaphore.acquire()
      await client.semaphore.acquire()
      let thirdAcquired = false
      client.semaphore.acquire().then(() => {
        thirdAcquired = true
      })
      await Promise.resolve()
      expect(thirdAcquired).toBe(false)
    })

    it("should let explicit options override env vars", () => {
      process.env.NMI_MAX_RETRIES = "7"

      const client = new NmiApiClient({ maxRetries: 2 })

      expect(client.maxRetries).toBe(2)
    })

    it("should fall back to defaults when env vars are invalid or missing", () => {
      process.env.NMI_MAX_RETRIES = "-1"
      delete process.env.NMI_REQUEST_TIMEOUT

      const client = new NmiApiClient()

      expect(client.maxRetries).toBe(3)
      expect(client.timeout).toBe(30000)
    })
  })
})

function rejectOnAbort(signal?: AbortSignal | null | undefined) {
  return new Promise<Response>((_, reject) => {
    if (signal) {
      signal.onabort = () => {
        reject(signal.reason)
      }
    }
  })
}

describe("NmiApiClient.request", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.mocked(fetch).mockClear()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it("should request immediately", async () => {
    const abortController = new AbortController()
    let firstPromise: Promise<any> | null = null
    try {
      const client = new NmiApiClient({ maxConcurrency: 2 })
      vi.mocked(fetch).mockImplementationOnce(() => rejectOnAbort(abortController.signal))
      firstPromise = client.request("")
      vi.mocked(fetch).mockResolvedValueOnce(Response.json("response"))
      await expect(client.request("").then((r) => r.json())).resolves.toBe("response")
    } finally {
      abortController.abort()
      await firstPromise?.catch(() => {})
    }
  })

  it("should wait for previous request", async () => {
    const abortController = new AbortController()
    let firstPromise: Promise<any> | null = null
    try {
      const client = new NmiApiClient({ maxConcurrency: 1 })
      vi.mocked(fetch).mockImplementationOnce(() => rejectOnAbort(abortController.signal))
      firstPromise = client.request("")
      // This fetch should never happen because the previous fetch never returns.
      vi.mocked(fetch).mockResolvedValueOnce(Response.json("response"))
      let value = ""
      const secondPromise = client.request("").then((v) =>
        v.json().then((t) => {
          value = t
        }),
      )
      await new Promise((resolve, reject) =>
        setTimeout(() => {
          try {
            expect(value).toBe("")
            resolve(undefined)
          } catch (e) {
            reject(e)
          }
        }, 100),
      )
      abortController.abort()
      await secondPromise
      expect(value).toBe("response")
    } finally {
      abortController.abort()
      await firstPromise?.catch(() => {})
    }
  })

  it("should throw if the request was aborted while waiting on semaphore", async () => {
    const abortController = new AbortController()
    const client = new NmiApiClient({ maxConcurrency: 1 })
    const originalAcquire = client.semaphore.acquire
    await originalAcquire.call(client.semaphore, abortController.signal)
    client.semaphore.acquire = () => {
      const promise = originalAcquire.call(client.semaphore, abortController.signal)
      abortController.abort()
      return promise
    }
    await expect(client.request("", { signal: abortController.signal })).rejects.toThrow("aborted")
  })

  it("should time out", async () => {
    const client = new NmiApiClient({ maxRetries: 1, timeout: 1000 })
    vi.mocked(fetch).mockImplementationOnce((_, init) => rejectOnAbort(init?.signal))
    await expect(client.request("")).rejects.toThrow("Timed out after 1000ms")
  })

  it("should retry after timeout", async () => {
    let callCount = 0
    const client = new NmiApiClient({ maxRetries: 5, timeout: 100 })
    vi.mocked(fetch).mockImplementationOnce((_, init) => {
      callCount++
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(new Response("Internal Server Error", { status: 500 }))
        }, 1000)
        const signal = init?.signal
        if (signal) {
          signal.onabort = () => {
            clearTimeout(timeout)
            reject(signal.reason)
          }
        }
      })
    })
    vi.mocked(fetch).mockResolvedValueOnce(Response.json("response 2"))
    expect(await client.request("").then((r) => r.json())).toBe("response 2")
  })

  it("should retry after a bad response code that is recoverable from", async () => {
    const client = new NmiApiClient({ maxRetries: 2 })
    vi.mocked(fetch).mockResolvedValueOnce(new Response("Bad Request", { status: 500 }))
    vi.mocked(fetch).mockResolvedValueOnce(Response.json("response 2"))
    await expect(client.request("").then((r) => r.json())).resolves.toBe("response 2")
  })

  it("should retry after a bad response code that is not recoverable from", async () => {
    const client = new NmiApiClient({ maxRetries: 2 })
    const errorResponse = new Response("I'm a teapot", { status: 418 })
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse)
    await expect(client.request("")).resolves.toBe(errorResponse)
  })

  it("should respect the Retry-After header", async () => {
    const client = new NmiApiClient({ maxRetries: 2 })
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "3" } }),
    )
    vi.mocked(fetch).mockResolvedValueOnce(Response.json("response 2"))
    let value = ""
    const promise = client.request("").then((r) =>
      r.json().then((v) => {
        value = v
      }),
    )
    await new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          expect(value).toBe("")
          resolve(undefined)
        } catch (e) {
          reject(e)
        }
      }, 1000),
    )
    await promise
    expect(value).toBe("response 2")
  })

  it("should retry normally for a negative Retry-After header", async () => {
    const client = new NmiApiClient({ maxRetries: 2 })
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "-1" } }),
    )
    vi.mocked(fetch).mockResolvedValueOnce(Response.json("response 2"))

    let value = ""
    const promise = client
      .request("", undefined)
      .then((r) => r.json())
      .then((v) => {
        value = v
        return v
      })

    setTimeout(() => {
      expect(value).toBe("")
    }, 100)

    await expect(promise).resolves.toBe("response 2")
  })

  it("should retry normally for a invalid Retry-After header", async () => {
    const client = new NmiApiClient({ maxRetries: 2 })
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "bla" } }),
    )
    vi.mocked(fetch).mockResolvedValueOnce(Response.json("response 2"))

    let value = ""
    const promise = client
      .request("", undefined)
      .then((r) => r.json())
      .then((v) => {
        value = v
        return v
      })

    setTimeout(() => {
      expect(value).toBe("")
    }, 100)

    await expect(promise).resolves.toBe("response 2")
  })

  it("should throw immediately with an already aborted AbortSignal", async () => {
    const abortController = new AbortController()
    const client = new NmiApiClient({ maxRetries: 2 })
    abortController.abort(new Error("reason"))
    await expect(client.request("", { signal: abortController.signal })).rejects.toThrow("reason")
  })

  it("should throw when the passed AbortSignal is aborted during a request", async () => {
    const abortController = new AbortController()
    const client = new NmiApiClient({ maxRetries: 2 })
    vi.mocked(fetch).mockImplementationOnce(
      (_, options) =>
        new Promise((_, reject) => {
          const signal = options?.signal
          if (signal) {
            signal.onabort = () => {
              reject(signal.reason)
            }
          }
        }),
    )
    const promise = client.request("", { signal: abortController.signal })
    const timeout = setTimeout(() => {
      abortController.abort(new Error("reason"))
    }, 100)
    try {
      await expect(promise).rejects.toThrow("reason")
    } finally {
      clearTimeout(timeout)
    }
  })

  it("should clear the timeout before throwing a final fetch error", async () => {
    const client = new NmiApiClient({ maxRetries: 1 })
    const error = new Error("fetch failed")
    vi.mocked(fetch).mockRejectedValueOnce(error)

    await expect(client.request("")).rejects.toBe(error)
  })

  it("should call onRejection properly before resolving", async () => {
    const client = new NmiApiClient({ maxRetries: 2 })
    const errorResponse = new Response("Internal Server Error", { status: 500 })
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse)
    vi.mocked(fetch).mockResolvedValueOnce(Response.json("response"))
    const onRejection = vi.fn()
    await expect(client.request("", { onRejection }).then((r) => r.json())).resolves.toBe(
      "response",
    )
    expect(onRejection).toHaveBeenCalledOnce()
    expect(onRejection).toHaveBeenCalledWith(errorResponse)
  })

  it("should call onRejection properly before rejecting", async () => {
    const client = new NmiApiClient({ maxRetries: 2 })
    const errorResponse = new Response("Internal Server Error", { status: 500 })
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse)
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse)
    const onRejection = vi.fn()
    await expect(client.request("", { onRejection })).resolves.toBe(errorResponse)
    expect(onRejection).toHaveBeenCalledOnce()
    expect(onRejection).toHaveBeenCalledWith(errorResponse)
  })
})

describe("NMI service pools", () => {
  it("should define different pools for different services", () => {
    expect(bln3Client).not.toBe(soilEstimatesClient)
    expect(bln3Client).not.toBe(soilReaderClient)
  })

  it("should define bln3 pool correctly", () => {
    expect(bln3Client).toBeInstanceOf(NmiApiClient)
  })

  it("should define soilEstimates pool correctly", () => {
    expect(soilEstimatesClient).toBeInstanceOf(NmiApiClient)
  })

  it("should define soilReader pool correctly", () => {
    expect(soilReaderClient).toBeInstanceOf(NmiApiClient)
  })
})
