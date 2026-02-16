import { fromUrl, type GeoTIFF } from "geotiff"

/**
 * In-memory cache for the GeoTIFF object.
 * This is a simple singleton pattern to ensure that for a given server instance,
 * the potentially large TIFF file is only downloaded and parsed once.
 * Subsequent calls will reuse the cached object, saving network and CPU resources.
 */
const tiffCache = new Map<string, GeoTIFF>()
const tiffPromiseCache = new Map<string, Promise<GeoTIFF>>()

/**
 * Fetches and caches the GeoTIFF object from a given URL.
 * It checks if the TIFF object is already in the cache. If not, it fetches it
 * from the provided URL and stores it in the cache for future use.
 *
 * @param url - The URL of the GeoTIFF file.
 * @returns A promise that resolves with the GeoTIFF object.
 * @throws Throws an error if the GeoTIFF file cannot be fetched or parsed.
 */
export async function getTiff(url: string): Promise<GeoTIFF> {
    // Return cached object if it exists
    const cached = tiffCache.get(url)
    if (cached) return cached

    // Deduplicate in-flight fetches
    const inFlight = tiffPromiseCache.get(url)
    if (inFlight) return inFlight

    const promise = (async () => {
        try {
            // fromUrl fetches headers first (HTTP Range) and lazily reads data
            const tiff = await fromUrl(url)
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
 * @returns A promise that resolves with the GeoTIFF value at the specified location, or null if outside the TIFF bounds or no data.
 */
export async function getGeoTiffValue(
    url: string,
    longitude: number,
    latitude: number,
): Promise<number | null> {
    const tiff = await getTiff(url)
    const image = await tiff.getImage()
    const bbox = image.getBoundingBox()
    const pixelWidth = image.getWidth()
    const pixelHeight = image.getHeight()
    const bboxWidth = bbox[2] - bbox[0]
    const bboxHeight = bbox[3] - bbox[1]
    const _noData = await image.fileDirectory.loadValue("GDAL_NODATA")
    const noDataValue =
        typeof _noData === "string" ? Number.parseFloat(_noData) : (_noData as number | null)

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
}
