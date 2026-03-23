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

    async acquire(): Promise<void> {
        if (this.active < this.maxConcurrent) {
            this.active++
            return
        }
        return new Promise<void>((resolve) => {
            this.queue.push(resolve)
        })
    }

    release(): void {
        const next = this.queue.shift()
        if (next) {
            next()
        } else {
            this.active--
        }
    }
}

/**
 * In-memory cache for the GeoTIFF object.
 * This is a simple singleton pattern to ensure that for a given server instance,
 * the potentially large TIFF file is only downloaded and parsed once.
 * Subsequent calls will reuse the cached object, saving network and CPU resources.
 */
const tiffCache = new Map<string, GeoTIFF>()
const tiffPromiseCache = new Map<string, Promise<GeoTIFF>>()

// Threshold for downloading the entire file into memory (2 MB)
const IN_MEMORY_THRESHOLD_BYTES = 2 * 1024 * 1024

// Default timeout for network requests (10 seconds)
const DEFAULT_TIMEOUT_MS = 10000

// Shared semaphore to limit concurrent raster reads across all TIFFs
const rasterSemaphore = new Semaphore(10)

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
            throw new Error(`Server error: ${response.status}`)
        }

        return response
    } catch (error) {
        const isAbortError = error instanceof Error && error.name === "AbortError"

        // Do not retry if the request was explicitly aborted
        if (retries > 0 && !isAbortError) {
            await new Promise((resolve) => setTimeout(resolve, backoff))
            return fetchWithRetry(url, options, retries - 1, backoff * 2)
        }
        throw error
    }
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
    const cached = tiffCache.get(url)
    if (cached) return cached

    // Deduplicate in-flight fetches
    const inFlight = tiffPromiseCache.get(url)
    if (inFlight) return inFlight

    const promise = (async () => {
        // Create a timeout signal and combine it with the optional external signal
        const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
        const combinedSignal = signal
            ? AbortSignal.any([timeoutSignal, signal])
            : timeoutSignal

        try {
            // 1. Check the file size via a lightweight HEAD request
            const headResponse = await fetchWithRetry(url, {
                method: "HEAD",
                signal: combinedSignal,
            })
            if (!headResponse.ok) {
                throw new Error(
                    `HTTP HEAD error! status: ${headResponse.status} for ${url}`,
                )
            }

            const contentLength = headResponse.headers.get("content-length")
            const sizeBytes = contentLength ? Number.parseInt(contentLength, 10) : null

            let tiff: GeoTIFF

            // 2. Dynamically choose the loading strategy
            if (sizeBytes !== null && sizeBytes <= IN_MEMORY_THRESHOLD_BYTES) {
                // Small file: load entirely into memory to prevent concurrent HTTP Range request crashes
                const response = await fetchWithRetry(url, { signal: combinedSignal })
                if (!response.ok) {
                    throw new Error(`HTTP GET error! status: ${response.status} for ${url}`)
                }
                const arrayBuffer = await response.arrayBuffer()
                tiff = await fromArrayBuffer(arrayBuffer)
            } else {
                // Large file (or unknown size): use fromUrl for lazy, efficient HTTP Range requests
                tiff = await fromUrl(url)
            }

            tiffCache.set(url, tiff)
            tiffPromiseCache.delete(url)
            return tiff
        } catch (error) {
            tiffPromiseCache.delete(url)
            throw new Error(
                `Failed to fetch or parse GeoTIFF from ${url}: ${String(error)}`,
            )
        }
    })()
    tiffPromiseCache.set(url, promise)
    return promise
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
    // Acquire the semaphore before doing network-bound/heavy raster reads
    await rasterSemaphore.acquire()

    try {
        // Check if we already aborted while waiting for the semaphore
        if (signal?.aborted) {
            throw signal.reason
        }

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
        const rasterData = await image.readRasters({ window })

        // For a single window and band, the result is typically [Float32Array(1)].
        const value = (rasterData[0] as Float32Array)[0]

        // Check if the value is valid and not the 'NoData' value.
        if (
            value !== undefined &&
            (noDataValue === null ||
                Number.isNaN(noDataValue as number) ||
                value !== noDataValue)
        ) {
            return value
        }

        return null
    } finally {
        // Always release the semaphore
        rasterSemaphore.release()
    }
}
