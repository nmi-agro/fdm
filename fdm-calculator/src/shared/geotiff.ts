import { fromArrayBuffer, fromUrl, type GeoTIFF } from "geotiff"

/**
 * Simple semaphore to limit concurrent GeoTIFF raster read operations.
 * This prevents overwhelming the Node.js socket pool with too many concurrent
 * HTTP Range requests when Promise.all is used across many fields.
 */
class Semaphore {
    private queue: (() => void)[] = []
    private active = 0
    constructor(private maxConcurrent: number) {}

    acquire(signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) {
            return Promise.reject(signal.reason)
        }
        if (this.active < this.maxConcurrent) {
            this.active++
            return Promise.resolve()
        }
        return new Promise<void>((resolve, reject) => {
            const onRelease = () => {
                // Slot transfers from the releasing caller — active stays the same.
                signal?.removeEventListener("abort", onAbort)
                resolve()
            }
            const onAbort = () => {
                const idx = this.queue.indexOf(onRelease)
                if (idx !== -1) {
                    this.queue.splice(idx, 1)
                }
                // No slot was ever granted, so active is not incremented.
                reject(signal!.reason)
            }
            this.queue.push(onRelease)
            signal?.addEventListener("abort", onAbort, { once: true })
        })
    }

    release(): void {
        const next = this.queue.shift()
        if (next) {
            next()
        } else if (this.active > 0) {
            this.active--
        }
    }
}

/**
 * In-memory LRU cache for resolved GeoTIFF objects.
 * Evicts the least-recently-used entry when the cache exceeds MAX_TIFF_CACHE_SIZE.
 */
const tiffCache = new Map<string, GeoTIFF>()
const tiffPromiseCache = new Map<string, Promise<GeoTIFF>>()

const MAX_TIFF_CACHE_SIZE = 50

function tiffCacheGet(url: string): GeoTIFF | undefined {
    const tiff = tiffCache.get(url)
    if (tiff !== undefined) {
        // Refresh recency: move the entry to the end of insertion order
        tiffCache.delete(url)
        tiffCache.set(url, tiff)
    }
    return tiff
}

function tiffCacheSet(url: string, tiff: GeoTIFF): void {
    if (tiffCache.has(url)) {
        tiffCache.delete(url)
    } else if (tiffCache.size >= MAX_TIFF_CACHE_SIZE) {
        // Evict the oldest (least-recently-used) entry
        const lruKey = tiffCache.keys().next().value
        if (lruKey !== undefined) tiffCache.delete(lruKey)
    }
    tiffCache.set(url, tiff)
}

// Threshold for downloading the entire file into memory (2 MB)
const IN_MEMORY_THRESHOLD_BYTES = 2 * 1024 * 1024

// Default timeout for network requests (10 seconds)
const DEFAULT_TIMEOUT_MS = 10000

// Shared semaphore to limit concurrent raster reads across all TIFFs
const rasterSemaphore = new Semaphore(10)

/**
 * Waits for `ms` milliseconds, but rejects immediately if `signal` is aborted.
 * Cleans up both the timer and the abort listener on resolution or rejection.
 */
function abortableDelay(ms: number, signal?: AbortSignal | null): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason)
            return
        }

        const onAbort = () => {
            clearTimeout(timer)
            reject(signal.reason)
        }

        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort)
            resolve()
        }, ms)

        signal?.addEventListener("abort", onAbort, { once: true })
    })
}

/**
 * Performs a fetch with automatic retries and exponential backoff.
 *
 * @param url - The URL to fetch.
 * @param options - Fetch options.
 * @param retries - Number of retries (default 3).
 * @param backoff - Initial backoff in ms (default 500).
 * @returns A promise that resolves to the Response object.
 */
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    backoff = 500,
): Promise<Response> {
    try {
        const response = await fetch(url, options)

        // Retry on 5xx server errors
        if (!response.ok && response.status >= 500 && retries > 0) {
            // Drain the body to free the keep-alive connection before retrying
            await response.text().catch(() => {})
            throw new Error(`Server error: ${response.status}`)
        }

        return response
    } catch (error) {
        const isAbortError = error instanceof Error && error.name === "AbortError"

        // Do not retry if the request was explicitly aborted
        if (retries > 0 && !isAbortError) {
            await abortableDelay(backoff, options.signal as AbortSignal | undefined)
            return fetchWithRetry(url, options, retries - 1, backoff * 2)
        }
        throw error
    }
}

/**
 * Races a shared promise against a caller-specific AbortSignal.
 * The shared promise itself is never cancelled — only this caller's view of it is.
 */
function raceWithSignal(promise: Promise<GeoTIFF>, signal: AbortSignal): Promise<GeoTIFF> {
    return new Promise<GeoTIFF>((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason)
            return
        }
        const onAbort = () => reject(signal.reason)
        signal.addEventListener("abort", onAbort, { once: true })
        promise.then(
            (value) => {
                signal.removeEventListener("abort", onAbort)
                resolve(value)
            },
            (err) => {
                signal.removeEventListener("abort", onAbort)
                reject(err)
            },
        )
    })
}

/**
 * Fetches and caches the GeoTIFF object from a given URL.
 * It checks if the TIFF object is already in the cache. If not, it fetches it
 * from the provided URL and stores it in the cache for future use.
 *
 * @param url - The URL of the GeoTIFF file.
 * @param signal - Optional AbortSignal to cancel the operation.
 * @returns A promise that resolves with the GeoTIFF object.
 * @throws Throws an error if the GeoTIFF file cannot be fetched or parsed.
 */
export async function getTiff(url: string, signal?: AbortSignal): Promise<GeoTIFF> {
    // Return cached object if it exists
    const cached = tiffCacheGet(url)
    if (cached) return cached

    // Deduplicate in-flight fetches. Wrap with caller's signal so only this
    // caller is cancelled on abort — the shared fetch continues for others.
    const inFlight = tiffPromiseCache.get(url)
    if (inFlight) return signal ? raceWithSignal(inFlight, signal) : inFlight

    const promise = (async () => {
        // Shared promise uses only the timeout signal — no caller signal baked in.
        const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS)

        try {
            // 1. Check the file size via a lightweight HEAD request.
            //    Any failure (network error or non-ok status) is treated as
            //    "unknown size" so execution falls through to the fromUrl path.
            let sizeBytes: number | null = null
            try {
                const headResponse = await fetchWithRetry(url, {
                    method: "HEAD",
                    signal: timeoutSignal,
                })
                if (headResponse.ok) {
                    const contentLength = headResponse.headers.get("content-length")
                    sizeBytes = contentLength ? Number.parseInt(contentLength, 10) : null
                } else {
                    console.warn(
                        `HEAD request returned ${headResponse.status} for ${url}, falling back to fromUrl`,
                    )
                }
            } catch (headErr) {
                console.warn(
                    `HEAD request failed for ${url}, falling back to fromUrl`,
                    headErr,
                )
            }

            let tiff: GeoTIFF

            // 2. Dynamically choose the loading strategy
            if (sizeBytes !== null && sizeBytes <= IN_MEMORY_THRESHOLD_BYTES) {
                // Small file: load entirely into memory to prevent concurrent HTTP Range request crashes
                const response = await fetchWithRetry(url, { signal: timeoutSignal })
                if (!response.ok) {
                    throw new Error(`HTTP GET error! status: ${response.status} for ${url}`)
                }
                const arrayBuffer = await response.arrayBuffer()
                tiff = await fromArrayBuffer(arrayBuffer)
            } else {
                // Large file (or unknown size): use fromUrl for lazy, efficient HTTP Range requests.
                // Pass timeoutSignal so in-flight range requests are cancelled on global timeout.
                tiff = await fromUrl(url, undefined, timeoutSignal)
            }

            tiffCacheSet(url, tiff)
            tiffPromiseCache.delete(url)
            return tiff
        } catch (error) {
            tiffPromiseCache.delete(url)
            const reason = error instanceof Error ? error.message : String(error)
            throw new Error(
                `Failed to fetch or parse GeoTIFF from ${url}: ${reason}`,
                { cause: error },
            )
        }
    })()
    tiffPromiseCache.set(url, promise)
    return signal ? raceWithSignal(promise, signal) : promise
}

/**
 * Fetches a GeoTIFF value at a specific geographic coordinate.
 *
 * @param url - The URL of the GeoTIFF file.
 * @param longitude - The longitude of the location.
 * @param latitude - The latitude of the location.
 * @param signal - Optional AbortSignal to cancel the operation.
 * @returns A promise that resolves with the GeoTIFF value at the specified location, or null if outside the TIFF bounds or no data.
 */
export async function getGeoTiffValue(
    url: string,
    longitude: number,
    latitude: number,
    signal?: AbortSignal,
): Promise<number | null> {
    // Acquire the semaphore before doing network-bound/heavy raster reads.
    // Rejects immediately if signal is already aborted, or if it aborts while waiting.
    await rasterSemaphore.acquire(signal)

    try {
        const tiff = await getTiff(url, signal)
        const image = await tiff.getImage()
        const bbox = image.getBoundingBox()
        const pixelWidth = image.getWidth()
        const pixelHeight = image.getHeight()
        const bboxWidth = bbox[2] - bbox[0]
        const bboxHeight = bbox[3] - bbox[1]
        const _noData = await image.fileDirectory.loadValue("GDAL_NODATA")
        const noDataValue =
            typeof _noData === "string"
                ? Number.parseFloat(_noData)
                : _noData != null
                  ? Number(_noData)
                  : null

        // Convert geographic coordinates to pixel coordinates.
        const widthPct = (longitude - bbox[0]) / bboxWidth
        const heightPct = (latitude - bbox[1]) / bboxHeight
        const xPx = Math.floor(pixelWidth * widthPct)
        const yPx = Math.floor(pixelHeight * (1 - heightPct))

        // Explicit OOB check: centroids outside the TIFF should return null
        if (xPx < 0 || xPx >= pixelWidth || yPx < 0 || yPx >= pixelHeight) {
            return null
        }

        const window = [xPx, yPx, xPx + 1, yPx + 1]

        // Read the raster data for this specific field's window.
        // This is safe even with Promise.all because of the semaphore throttling.
        const rasterData = await image.readRasters({ window, signal })

        // For a single window and band, index the band array generically
        // to support all sample formats (Float32, Float64, Int16, UInt8, etc.).
        const band = rasterData[0] as ArrayLike<number>
        const value = band[0]

        // Check if the value is valid and not the 'NoData' value.
        // NaN noData: treat a pixel as valid only when the value is also not NaN.
        // Real noData: use strict equality to filter matching pixels.
        if (
            value !== undefined &&
            (noDataValue === null ||
                (Number.isNaN(noDataValue as number)
                    ? !Number.isNaN(value)
                    : value !== noDataValue))
        ) {
            return value
        }

        return null
    } finally {
        // Always release the semaphore
        rasterSemaphore.release()
    }
}
