import type { MiddlewareHandler } from "hono"
import { ApiError } from "./error"

const MAX_BODY_BYTES = 5 * 1024 * 1024
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"])

/**
 * Validates request bodies for API write operations before they reach route handlers.
 *
 * @param c - Hono request context used to inspect headers and continue the middleware chain.
 * @param next - Callback that advances processing once the request passes validation.
 * @returns A promise that resolves after the request passes validation and control moves to the next middleware.
 * @throws {ApiError} Throws when a write request exceeds 5 MB or does not use the `application/json` media type.
 * @example
 * ```ts
 * app.use("*", requestGuard)
 * ```
 */
export const requestGuard: MiddlewareHandler = async (c, next) => {
    const method = c.req.method

    if (WRITE_METHODS.has(method)) {
        const contentLength = c.req.header("content-length")
        if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
            throw new ApiError(413, "payload-too-large", "Request body exceeds the 5 MB limit.")
        }

        const rawContentType = c.req.header("content-type") ?? ""
        const mediaType = rawContentType.split(";")[0]?.trim().toLowerCase()
        if (mediaType !== "application/json") {
            throw new ApiError(415, "unsupported-media-type", "Content-Type must be application/json.")
        }
    }

    return next()
}

/**
 * Ensures a GeoJSON geometry stays within the API's coordinate-count limit.
 *
 * @param geometry - GeoJSON-like value whose `coordinates` tree should be inspected.
 * @returns Nothing.
 * @throws {ApiError} Throws when the geometry contains more than 10,000 coordinate positions.
 * @example
 * ```ts
 * assertGeoJsonCoordinates(feature.geometry)
 * ```
 */
export function assertGeoJsonCoordinates(geometry: unknown): void {
    let count = 0

    function walk(coords: unknown) {
        if (!Array.isArray(coords)) return
        if (typeof coords[0] === "number") {
            count++
            return
        }
        for (const c of coords) walk(c)
    }

    walk((geometry as { coordinates?: unknown })?.coordinates)

    if (count > 10_000) {
        throw new ApiError(422, "unprocessable-entity", "GeoJSON geometry exceeds the 10,000 coordinate limit.")
    }
}
