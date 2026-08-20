import { Semaphore } from "../shared/geotiff"

function promiseDelayed<T>(cb: () => Promise<T>, after: number) {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      cb().then(resolve, reject)
    }, after)
  })
}

/**
 * Tries to parse the given string value as a positive number. If the value was undefined or
 * doesn't parse into a valid positive number, defaultValue is returned instead.
 *
 * @param value Value to parse.
 * @param defaultValue Value to return if the parsing fails or the parsed value is not a
 * positive number.
 * @returns The parsed positive number, or defaultValue if parsing fails or the number is not positive.
 */
function tryAsPositive(value: string | undefined, defaultValue: number) {
  if (!value) return defaultValue
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return defaultValue
}

/**
 * API client with timeout, automatic retries, and exponential back-off.
 */
export class NmiApiClient {
  semaphore: Semaphore
  maxRetries: number
  timeout: number

  /**
   * API client with timeout, automatic retries, and exponential back-off.
   *
   * @param options Initialization options.
   */
  constructor(options?: {
    /** Maximum number of concurrent requests to initialize the internal semaphore for. Default: 10 */
    maxConcurrency?: number
    /** Maximum number of retries per request. Default: 3 */
    maxRetries?: number
    /** Timeout for each trial for a request in ms. Default: 30000ms */
    timeout?: number
  }) {
    const {
      maxConcurrency = tryAsPositive(process.env.NMI_MAX_CONCURRENCY, 10),
      maxRetries = tryAsPositive(process.env.NMI_MAX_RETRIES, 3),
      timeout = tryAsPositive(process.env.NMI_REQUEST_TIMEOUT, 30000),
    } = options ?? {}

    this.semaphore = new Semaphore(maxConcurrency)
    this.maxRetries = maxRetries
    this.timeout = timeout
  }

  /**
   * Fetch with the given parameters. It will always resolve with a Response object, or reject with
   * an error. In addition, the `onRejection` callback that can be passed via the options object is
   * called with each response that triggers a retry, or each error after which there will be a retry.
   * This can be used for debugging and reporting purposes.
   *
   * For timeout errors, `e.name === "TimeoutError"` will hold.
   *
   * An AbortSignal can be passed via the options object. If this is aborted, the retries will stop
   * and an error will be thrown. If there was already a response to be returned or an error thrown
   * when the abortion happened, these will still be returned or thrown.
   *
   * @param url URL to fetch.
   * @param options fetch request init + `onRejection`
   * @param timeout Override the timeout in ms for this request.
   * @param maxRetries Override max retries for this request.
   * @param retryAfter Override the initial retry duration for this request. This will double after
   * each valid server response that triggers a retry.
   * @returns a Response object after which there won't be a retry.
   * @throws any exceptions after which there won't be a retry, including the abort errors if
   * externally aborted.
   */
  async request(
    url: string,
    options?: RequestInit & { onRejection?: (e: any) => void | Promise<void> },
    timeout: number = this.timeout,
    maxRetries: number = this.maxRetries,
    retryAfter: number = 500,
  ): Promise<Response> {
    const abortController = new AbortController()

    const inputSignal = options?.signal

    if (inputSignal?.aborted) {
      throw inputSignal.reason
    }

    const onInputSignalAbort = () => {
      if (inputSignal) abortController.abort(inputSignal.reason)
    }

    if (inputSignal) {
      inputSignal.addEventListener("abort", onInputSignalAbort)
    }

    // Wait for pending requests in queue to complete if there are too many.
    await this.semaphore.acquire(abortController.signal)
    let released = false

    try {
      // Time out
      const timeoutRef = setTimeout(() => {
        const err = new Error(`Timed out after ${timeout}ms`)
        err.name = "TimeoutError"
        abortController.abort(err)
      }, timeout)

      // Fetch
      const response = await fetch(url, {
        ...options,
        signal: abortController.signal,
      })

      // No need to time out any more
      clearTimeout(timeoutRef)

      // Immediately release the semaphore because we are done with the NMI API connection
      this.semaphore.release()
      released = true

      // Parse body as JSON for OK responses
      if (response.ok) {
        return response
      }
      // If it is possible that request will succeed last time, try again with exponential back-off
      else if ((response.status >= 500 && response.status <= 599) || response.status === 429) {
        if (maxRetries > 1) {
          let decidedRetryAfter = retryAfter
          const retryAfterHeader = response.headers?.get("retry-after")
          if (retryAfterHeader) {
            const retryAfterHeaderVal = Number.parseInt(retryAfterHeader, 10)
            if (Number.isFinite(retryAfterHeaderVal)) {
              decidedRetryAfter = retryAfterHeaderVal * 1000
            }
          }

          try {
            await options?.onRejection?.(response)
          } catch {}

          // With exponential backoff
          return promiseDelayed(
            () => this.request(url, options, timeout, maxRetries - 1, retryAfter * 2),
            decidedRetryAfter,
          )
        }

        return response
      }
      // Do not try anymore for unrecognized error codes
      return Promise.resolve(response)
    } catch (e) {
      if (!released) {
        this.semaphore.release()
      }

      let returnedError = e

      if (
        e instanceof Error &&
        e.name === "AbortError" &&
        abortController.signal.reason?.name === "TimeoutError"
      ) {
        returnedError = abortController.signal.reason
      }

      if (maxRetries > 1) {
        try {
          await options?.onRejection?.(returnedError)
        } catch {}

        // No exponential backoff
        return promiseDelayed(
          () => this.request(url, options, timeout, maxRetries - 1, retryAfter),
          retryAfter,
        )
      } else {
        throw returnedError
      }
    } finally {
      inputSignal?.removeEventListener("abort", onInputSignalAbort)
    }
  }
}

export const bln3Client = new NmiApiClient()
export const soilEstimatesClient = new NmiApiClient()
export const soilReaderClient = new NmiApiClient()
