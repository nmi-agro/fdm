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
    const hasProtocol =
        href.startsWith("http://") || href.startsWith("https://")
    const hasSlash = href.startsWith("/")
    const url = new URL(
        hasProtocol
            ? href
            : hasSlash
              ? `http://localhost${href}`
              : `http://localhost/${href}`,
    )
    modifier(url.searchParams)
    const relativeToOrigin = `${url.pathname}${url.search}${url.hash}`
    return hasProtocol
        ? url.href
        : hasSlash
          ? relativeToOrigin
          : relativeToOrigin.substring(1)
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
 * Replaces dynamic segments (IDs, years, coordinates) with `:id` placeholders
 * so the tag value represents the route shape rather than a specific resource.
 *
 * Handles:
 * - FDM nanoid IDs (16 chars from the custom read-safe alphabet)
 * - Pure numeric segments (years, numeric IDs)
 * - Coordinate-like segments (digits mixed with dots or commas)
 *
 * @param page - The raw pathname string (e.g. from `location.pathname`).
 * @returns The normalised route pattern (e.g. `/farm/:id/:id/atlas/fields/:id`).
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
 * Checks if the given URL-like might be a full URL, and if so, if it is of the
 * origin given. No origin checks are performed if neither a URI scheme nor a
 * protocol-relative prefix (`//`) is detected.
 *
 * @param href URL-like
 * @param origin origin, like `example.com` to check if full URL is detected
 * @returns the validation result for full URLs, true if no full URL is found
 */
export function isOfOrigin(href: string, origin: string) {
    try {
        // Explicitly reject protocol-relative URLs (e.g., //example.com)
        // These can be exploited for open redirects when used in browser contexts
        if (href.startsWith("//")) return false

        // Allow root-relative paths (e.g., /path/to/page)
        if (href.startsWith("/")) return true

        // If no URI scheme is present, treat as relative/path-like input
        const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href)
        if (!hasScheme) return true

        // For absolute URLs, only allow same-origin HTTP(S)
        const parsed = new URL(href)
        const isHttp =
            parsed.protocol === "http:" || parsed.protocol === "https:"
        return isHttp && parsed.origin === origin
    } catch {
        return false
    }
}
