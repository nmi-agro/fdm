import { afterEach } from "node:test"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NmiApiClient, bln3Client, soilEstimatesClient, soilReaderClient } from "./client"

describe("SemaphoreApiClient.constructor", () => {
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
      const client = new NmiApiClient({ maxConcurrent: 2 })
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
      const client = new NmiApiClient({ maxConcurrent: 1 })
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

  it("should respect the passed AbortSignal", async () => {
    const abortController = new AbortController()
    const client = new NmiApiClient({ maxRetries: 2 })
    abortController.abort(new Error("reason"))
    await expect(client.request("", { signal: abortController.signal })).rejects.toThrow("reason")
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
