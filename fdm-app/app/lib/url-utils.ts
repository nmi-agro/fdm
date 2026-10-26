/**
 * Applies a function on the search params from a relative or absolute path,
 * or a full URL, then returns the modified value.
 *
 * Note that it will treat input like `example.com/about` as
 * `/example.com/about` since it looks for a http:// or https:// at the
 * beginning to determine full URLs
 *
 * @param href relative or absolute path, or a full URL
 * @param modifier function to be applied on the search params
 * @returns a relative or absolute path, or a full URL, whichever format was
 * provided
 */
export function modifySearchParams(
  href: string,
  modifier: (searchParams: URLSearchParams) => void,
): string {
  const hasProtocol = href.startsWith("http://") || href.startsWith("https://")
  const hasSlash = href.startsWith("/")
  const url = new URL(
    hasProtocol ? href : hasSlash ? `http://localhost${href}` : `http://localhost/${href}`,
  )
  modifier(url.searchParams)
  const relativeToOrigin = `${url.pathname}${url.search}${url.hash}`
  return hasProtocol ? url.href : hasSlash ? relativeToOrigin : relativeToOrigin.substring(1)
}

/**
 * Gets the search params from a relative or absolute path, or a full URL.
 *
 * Note that it will treat input like `example.com/about` as
 * `/example.com/about` since it looks for a http:// or https:// at the
 * beginning to determine full URLs
 *
 * @param href relative or absolute path, or a full URL
 * @returns the search parameters, or empty search parameters if none was found
 */
export function getSearchParams(href: string) {
  let searchParams: URLSearchParams | undefined
  if (href.length > 0) {
    modifySearchParams(href, (p) => {
      searchParams = p
    })
  }
  return searchParams ?? new URLSearchParams()
}

/**
 * Normalises a pathname for use as a low-cardinality Sentry tag.
 * Replaces dynamic segments with typed placeholders so the tag value
 * represents the route shape rather than a specific resource.
 *
 * Handles:
 * - FDM nanoid IDs (16 chars from the custom read-safe alphabet) → `:id`
 * - Pure numeric segments (years, numeric IDs) → `:year`
 * - Coordinate-like segments (digits mixed with dots or commas) → `:centroid`
 *
 * @param page - The raw pathname string (e.g. from `location.pathname`).
 * @returns The normalised route pattern (e.g. `/farm/:id/:year/atlas/fields/:centroid`).
 */
export function normalizePage(page: string): string {
  // Strip query string and hash (pathname typically excludes these, but be defensive)
  const path = page.split("?")[0].split("#")[0]
  return path
    .split("/")
    .map((segment) => {
      if (!segment) return segment
      // FDM nanoid IDs: exactly 16 chars from the custom read-safe alphabet
      if (/^[6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwza]{16}$/.test(segment)) {
        return ":id"
      }
      // Pure numeric segments (years, numeric IDs)
      if (/^\d+$/.test(segment)) {
        return ":year"
      }
      // Coordinate-like segments: mix of digits with dots or commas
      if (/[,.]/.test(segment) && /\d/.test(segment)) {
        return ":centroid"
      }
      return segment
    })
    .join("/")
}

/**
 * Checks whether the given URL-like stays on the given origin. Full URLs must be
 * same-origin HTTP(S); protocol-relative input (`//`) is rejected; relative and
 * root-relative input is resolved against the origin and must not change it.
 *
 * @param href URL-like
 * @param origin origin to compare with, like `https://example.com`
 * @returns whether following `href` stays on `origin`
 */
export function isOfOrigin(href: string, origin: string) {
  try {
    // Explicitly reject protocol-relative URLs (e.g., //example.com)
    // These can be exploited for open redirects when used in browser contexts
    if (href.startsWith("//")) return false

    // Root-relative and path-like input (e.g. /path/to/page) is resolved against the origin,
    // because backslashes and control characters can change the host: "/\evil.com" is read by
    // browsers as the protocol-relative "//evil.com"
    const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href)
    if (!hasScheme) return new URL(href, origin).origin === origin

    // For absolute URLs, only allow same-origin HTTP(S)
    const parsed = new URL(href)
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:"
    return isHttp && parsed.origin === origin
  } catch {
    return false
  }
}

/**
 * Normalises the given address to be a safe, root-relative redirect target,
 * or `/farm` by default. Resolves the candidate against a fixed same-origin
 * base and only accepts it if the resolved origin is unchanged, which closes
 * host-confusion bypasses that a simple `startsWith("/")` check misses (e.g.
 * a backslash-based address like `/\evil.com` is normalized by browsers/URL
 * parsers to the protocol-relative `//evil.com`, silently changing the host).
 *
 * @param address address to check for safety, null/undefined if not specified
 * @returns the normalized, safe redirect address
 */
export function getSafeRedirect(address: string | null | undefined): string {
  if (!address) return "/farm"
  try {
    const base = new URL("http://localhost")
    const resolved = new URL(address, base)
    if (resolved.origin !== base.origin) return "/farm"
    return `${resolved.pathname}${resolved.search}${resolved.hash}` || "/farm"
  } catch {
    return "/farm"
  }
}
