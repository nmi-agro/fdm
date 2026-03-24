import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getTiff, getGeoTiffValue } from "./geotiff"
import * as geotiff from "geotiff"

// Mock the geotiff module
vi.mock("geotiff", () => ({
    fromArrayBuffer: vi.fn(),
    fromUrl: vi.fn(),
}))

describe("geotiff module", () => {
    let fetchMock: any

    beforeEach(() => {
        // Mock global fetch
        fetchMock = vi.spyOn(global, "fetch")
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe("getTiff", () => {
        it("should load small file using fromArrayBuffer", async () => {
            // Mock HEAD request to return small content-length (1KB)
            fetchMock.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ "content-length": "1000" }),
            })
            // Mock GET request
            fetchMock.mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(1000),
            })

            vi.mocked(geotiff.fromArrayBuffer).mockResolvedValueOnce({} as any)

            const url = "http://example.com/small-1.tif"
            await getTiff(url)

            expect(fetchMock).toHaveBeenCalledTimes(2) // HEAD then GET
            expect(geotiff.fromArrayBuffer).toHaveBeenCalledTimes(1)
            expect(geotiff.fromUrl).not.toHaveBeenCalled()
        })

        it("should load large file using fromUrl", async () => {
            // Mock HEAD request to return large content-length (3MB)
            fetchMock.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ "content-length": "3000000" }),
            })

            vi.mocked(geotiff.fromUrl).mockResolvedValueOnce({} as any)

            const url = "http://example.com/large-1.tif"
            await getTiff(url)

            expect(fetchMock).toHaveBeenCalledTimes(1) // Only HEAD
            expect(geotiff.fromUrl).toHaveBeenCalledTimes(1)
            expect(geotiff.fromUrl).toHaveBeenCalledWith(url)
        })

        it("should load unknown size file using fromUrl", async () => {
            // Mock HEAD request to return no content-length
            fetchMock.mockResolvedValueOnce({
                ok: true,
                headers: new Headers(),
            })

            vi.mocked(geotiff.fromUrl).mockResolvedValueOnce({} as any)

            const url = "http://example.com/unknown-1.tif"
            await getTiff(url)

            expect(fetchMock).toHaveBeenCalledTimes(1) // Only HEAD
            expect(geotiff.fromUrl).toHaveBeenCalledTimes(1)
            expect(geotiff.fromUrl).toHaveBeenCalledWith(url)
        })

        it("should cache successful requests", async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ "content-length": "3000000" }),
            })
            vi.mocked(geotiff.fromUrl).mockResolvedValue({} as any)

            const url = "http://example.com/cached.tif"
            // First call
            await getTiff(url)
            // Second call should hit the cache
            await getTiff(url)

            // fetch and fromUrl should only be called once due to caching
            expect(fetchMock).toHaveBeenCalledTimes(1)
            expect(geotiff.fromUrl).toHaveBeenCalledTimes(1)
        })

        it("should deduplicate in-flight requests", async () => {
            fetchMock.mockImplementation(async () => {
                // Simulate network delay
                await new Promise((resolve) => setTimeout(resolve, 50))
                return {
                    ok: true,
                    headers: new Headers({ "content-length": "3000000" }),
                }
            })
            vi.mocked(geotiff.fromUrl).mockResolvedValue({} as any)

            const url = "http://example.com/inflight.tif"
            // Trigger parallel calls
            const p1 = getTiff(url)
            const p2 = getTiff(url)
            await Promise.all([p1, p2])

            // fetch should only be called once because of deduplication
            expect(fetchMock).toHaveBeenCalledTimes(1)
        })

        it("should retry on 5xx errors", async () => {
            fetchMock
                .mockResolvedValueOnce({ ok: false, status: 500 }) // 1st try HEAD
                .mockResolvedValueOnce({ ok: false, status: 503 }) // 2nd try HEAD
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: new Headers({ "content-length": "3000000" }),
                }) // 3rd try HEAD

            vi.mocked(geotiff.fromUrl).mockResolvedValue({} as any)

            const url = "http://example.com/retry.tif"
            await getTiff(url)

            // Should have been called 3 times due to 2 retries
            expect(fetchMock).toHaveBeenCalledTimes(3)
        })

        it("should throw if file size cannot be retrieved", async () => {
            fetchMock.mockResolvedValue({ ok: false, status: 404 })

            const url = "http://example.com/notfound.tif"
            await expect(getTiff(url)).rejects.toThrow(/HTTP HEAD error!/)
        })

        it("should throw if GET request for small file fails", async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ "content-length": "1000" }),
            })
            fetchMock.mockResolvedValueOnce({ ok: false, status: 500 }) // Fails then retries
            fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
            fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
            fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })

            const url = "http://example.com/small-fail.tif"
            await expect(getTiff(url)).rejects.toThrow(/HTTP GET error!/)
        })

        it("should respect abort signal", async () => {
            const controller = new AbortController()
            const err = new Error("Manual abort")
            err.name = "AbortError"

            fetchMock.mockRejectedValue(err)

            await expect(
                getTiff("http://example.com/abort.tif", controller.signal),
            ).rejects.toThrow(/Failed to fetch or parse GeoTIFF/)
        })
    })

    describe("getGeoTiffValue", () => {
        let mockImage: any

        beforeEach(() => {
            mockImage = {
                getBoundingBox: () => [0, 0, 100, 100],
                getWidth: () => 10,
                getHeight: () => 10,
                fileDirectory: { loadValue: async () => "-9999" }, // NoData value
                readRasters: vi.fn(),
            }

            // Always succeed HEAD request
            fetchMock.mockResolvedValue({
                ok: true,
                headers: new Headers({ "content-length": "3000000" }),
            })

            vi.mocked(geotiff.fromUrl).mockResolvedValue({
                getImage: async () => mockImage,
            } as any)
        })

        it("should return null if coordinates are out of bounds", async () => {
            const url = "http://example.com/oob.tif"
            // Outside of bounding box [0, 0, 100, 100]
            const val = await getGeoTiffValue(url, -10, -10)

            expect(val).toBeNull()
            expect(mockImage.readRasters).not.toHaveBeenCalled()
        })

        it("should return null if coordinates are out of bounds (positive)", async () => {
            const url = "http://example.com/oob2.tif"
            const val = await getGeoTiffValue(url, 150, 150)

            expect(val).toBeNull()
            expect(mockImage.readRasters).not.toHaveBeenCalled()
        })

        it("should return correct value for valid coordinates", async () => {
            // Set up a valid raster value
            mockImage.readRasters.mockResolvedValue([new Float32Array([42])])

            const url = "http://example.com/valid.tif"
            // Inside bounding box [0, 0, 100, 100]
            const val = await getGeoTiffValue(url, 50, 50)

            expect(val).toBe(42)
            expect(mockImage.readRasters).toHaveBeenCalled()
        })

        it("should return null for NoData value", async () => {
            // Set up raster value equal to NoData (-9999)
            mockImage.readRasters.mockResolvedValue([new Float32Array([-9999])])

            const url = "http://example.com/nodata.tif"
            const val = await getGeoTiffValue(url, 50, 50)

            expect(val).toBeNull()
        })

        it("should return value if NoData is not defined", async () => {
            // Set up undefined NoData
            mockImage.fileDirectory.loadValue = async () => null
            mockImage.readRasters.mockResolvedValue([new Float32Array([0])])

            const url = "http://example.com/nonodata.tif"
            const val = await getGeoTiffValue(url, 50, 50)

            expect(val).toBe(0)
        })

        it("should return value if NoData is NaN", async () => {
            mockImage.fileDirectory.loadValue = async () => Number.NaN
            mockImage.readRasters.mockResolvedValue([new Float32Array([10])])

            const url = "http://example.com/nan-nodata.tif"
            const val = await getGeoTiffValue(url, 50, 50)

            expect(val).toBe(10)
        })

        it("should handle numeric NoData value", async () => {
            mockImage.fileDirectory.loadValue = async () => -1
            mockImage.readRasters.mockResolvedValue([new Float32Array([-1])])

            const url = "http://example.com/num-nodata.tif"
            const val = await getGeoTiffValue(url, 50, 50)

            expect(val).toBeNull()
        })

        it("should respect abort signal when acquiring semaphore", async () => {
            const controller = new AbortController()
            const reason = new Error("Manual abort reason")
            controller.abort(reason)

            const url = "http://example.com/abort-semaphore.tif"
            await expect(
                getGeoTiffValue(url, 50, 50, controller.signal),
            ).rejects.toThrow("Manual abort reason")
        })

        it("should handle simultaneous calls via semaphore queue", async () => {
            // We simulate many calls to trigger the semaphore queue (maxConcurrent is 10)
            mockImage.readRasters.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10))
                return [new Float32Array([42])]
            })

            const url = "http://example.com/semaphore.tif"
            const promises = Array.from({ length: 15 }).map(() =>
                getGeoTiffValue(url, 50, 50),
            )
            const results = await Promise.all(promises)

            expect(results.every((r) => r === 42)).toBe(true)
        })
    })
})
