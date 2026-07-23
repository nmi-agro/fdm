import type { MiddlewareHandler } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { bodyLimit } from "hono/body-limit"
import { ApiError } from "./error"

const MAX_BODY_BYTES = 5 * 1024 * 1024
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"])

const bodyLimitMiddleware = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: () => {
    throw new ApiError(413, "payload-too-large", "Request body exceeds the 5 MB limit.")
  },
})

/**
 * Creates middleware that returns a 404 problem response for paths that don't match any
 * registered route handler, short-circuiting before authentication runs.
 *
 * Hono populates `c.req.matchedRoutes` upfront with all matching entries. Entries from
 * `app.use()` (global middleware) carry `method: "ALL"`, while actual route handlers carry
 * their specific HTTP method. A request to a non-existent path therefore has no
 * `method !== "ALL"` entry, which this guard uses to detect and reject the request early —
 * before any API-key DB lookup occurs.
 *
 * @param appUrl - Canonical application URL used to build the absolute problem type URI.
 * @returns A Hono middleware that responds with 404 for unmatched paths and calls `next()` for matched ones.
 * @example
 * ```ts
 * app.use("*", createPathExistenceGuard("https://example.com"))
 * ```
 */
export function createPathExistenceGuard(appUrl: string): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") {
      return next()
    }

    const hasRouteHandler = c.req.matchedRoutes.some((r) => r.method !== "ALL")
    if (!hasRouteHandler) {
      console.debug(`[fdm-api] path-not-found path=${c.req.path}`)
      return c.json(
        {
          type: `${appUrl}/problems/not-found`,
          title: "Not Found",
          status: 404,
          detail: `${c.req.path} does not exist.`,
          instance: c.req.path,
        },
        404 as ContentfulStatusCode,
        { "content-type": "application/problem+json" },
      )
    }

    return next()
  }
}

/**
 * Validates request bodies for API write operations before they reach route handlers.
 *
 * Uses Hono's built-in `bodyLimit` middleware to enforce the 5 MB size limit for write
 * requests. This correctly handles both `Content-Length`-declared and chunked (`Transfer-Encoding:
 * chunked`) bodies by streaming and counting bytes incrementally.
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
    const rawContentType = c.req.header("content-type") ?? ""
    const mediaType = rawContentType.split(";")[0]?.trim().toLowerCase()
    if (mediaType !== "application/json") {
      throw new ApiError(415, "unsupported-media-type", "Content-Type must be application/json.")
    }

    await bodyLimitMiddleware(c, next)
    return
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

  function walkGeometry(geom: unknown) {
    if (geom == null || typeof geom !== "object") return
    const g = geom as {
      type?: string
      coordinates?: unknown
      geometries?: unknown[]
    }
    if (g.type === "GeometryCollection" && Array.isArray(g.geometries)) {
      for (const member of g.geometries) walkGeometry(member)
    } else {
      walk(g.coordinates)
    }
  }

  walkGeometry(geometry)

  if (count > 10_000) {
    throw new ApiError(
      422,
      "unprocessable-entity",
      "GeoJSON geometry exceeds the 10,000 coordinate limit.",
    )
  }
}
