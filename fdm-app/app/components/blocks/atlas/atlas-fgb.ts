import { deserialize } from "flatgeobuf/lib/mjs/geojson.js"

const NOT_FGB_ERROR = "Not a FlatGeobuf file"

type Bbox = { minX: number; minY: number; maxX: number; maxY: number }

/**
 * Wraps flatgeobuf's `deserialize` with automatic recovery from browser HTTP
 * cache poisoning. On the first `"Not a FlatGeobuf file"` error it retries
 * once with `nocache=true`, which adds `Cache-Control: no-cache, no-store` to
 * every Range request — bypassing and replacing the poisoned cache entry.
 */
export async function* deserializeFgb(url: string, bbox: Bbox) {
    try {
        yield* deserialize(url, bbox)
    } catch (error) {
        if (error instanceof Error && error.message.includes(NOT_FGB_ERROR)) {
            console.warn(
                `[atlas-fgb] Received "${NOT_FGB_ERROR}" for ${url}. ` +
                    "Retrying with no-cache to bypass a potentially poisoned browser cache.",
            )

            try {
                yield* deserialize(url, bbox, undefined, true)
            } catch (retryError) {
                throw new Error(
                    `[atlas-fgb] Failed to load FlatGeobuf data from ${url} even after bypassing the browser cache.`,
                    {
                        cause: {
                            originalError: error,
                            retryError,
                        },
                    },
                )
            }
        } else {
            throw error
        }
    }
}
