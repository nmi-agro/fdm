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
 * Checks whether a URL segment is a long opaque token, such as an invitation
 * token or another better-auth ID. Static route segments of this length are
 * lowercase words joined by `-` or `_`, so they never contain a digit or an
 * uppercase letter.
 *
 * @param segment - A single path segment, without slashes.
 * @returns Whether the segment should be treated as a secret.
 */
function isOpaqueToken(segment: string): boolean {
  return /^[\w-]{20,}$/.test(segment) && /[\dA-Z]/.test(segment)
}

/**
 * Masks secrets in any text that contains URLs or paths, such as a full URL,
 * a pathname or a breadcrumb message, while leaving the rest readable:
 * - long opaque path segments (see `normalizePage`) → `:token`
 * - values of the `code`, `token` and `secret` query parameters → `:token`
 *
 * @param text - Text that may contain URLs or paths.
 * @returns The text with secrets replaced.
 */
export function maskUrlSecrets(text: string): string {
  return (
    text
      // A segment ends at anything but a word character, `-` or a file extension;
      // React Router's `.data` suffix is not a file extension
      .replace(/(?<=\/)[\w-]{20,}(?![\w-]|\.(?!data\b))/g, (segment) =>
        isOpaqueToken(segment) ? ":token" : segment,
      )
      .replace(/(?<=(?:^|[?&])(?:code|token|secret)=)[^&#\s"'`]+/gi, ":token")
  )
}

/**
 * Applies {@link maskUrlSecrets} to every string inside a JSON-like value, for
 * use on analytics and error-tracking payloads before they leave the app.
 * Only arrays and plain objects are traversed; other values are returned as is.
 *
 * @param value - The payload to scrub.
 * @returns A copy of the payload with secrets in URLs and paths replaced.
 */
export function maskSecretsDeep<T>(value: T): T {
  const scrub = (item: unknown, depth: number): unknown => {
    if (typeof item === "string") return maskUrlSecrets(item)
    if (depth > 32 || item === null || typeof item !== "object") return item
    if (Array.isArray(item)) return item.map((child) => scrub(child, depth + 1))
    const prototype = Object.getPrototypeOf(item)
    if (prototype !== Object.prototype && prototype !== null) return item
    return Object.fromEntries(
      Object.entries(item).map(([key, child]) => [key, scrub(child, depth + 1)]),
    )
  }
  return scrub(value, 0) as T
}

/**
 * Normalises a pathname for use as a low-cardinality Sentry tag.
 * Replaces dynamic segments with typed placeholders so the tag value
 * represents the route shape rather than a specific resource.
 *
 * Handles:
 * - FDM nanoid IDs (16 chars from the custom read-safe alphabet) → `:id`
 * - Pure numeric segments (years, numeric IDs) → `:year`
 * - Long opaque tokens, such as invitation tokens and other better-auth IDs
 *   (20+ URL-safe chars including a digit or an uppercase letter) → `:token`
 * - Coordinate-like segments (digits mixed with dots or commas) → `:centroid`
 * - Organization slugs (the segment after `/organization/`) → `:slug`
 *
 * Tokens can grant access (e.g. an invitation link), so they must never end up
 * in analytics or error tracking.
 *
 * @param page - The raw pathname string (e.g. from `location.pathname`).
 * @returns The normalised route pattern (e.g. `/farm/:id/:year/atlas/fields/:centroid`).
 */
export function normalizePage(page: string): string {
  // Strip query string and hash (pathname typically excludes these, but be defensive)
  const path = page.split("?")[0].split("#")[0]
  return path
    .split("/")
    .map((segment, index, segments) => {
      if (!segment) return segment
      // FDM nanoid IDs: exactly 16 chars from the custom read-safe alphabet
      if (/^[6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwza]{16}$/.test(segment)) {
        return ":id"
      }
      // Pure numeric segments (years, numeric IDs)
      if (/^\d+$/.test(segment)) {
        return ":year"
      }
      if (isOpaqueToken(segment)) {
        return ":token"
      }
      // Organization slugs are chosen by users and may contain names
      if (segments[index - 1] === "organization" && !["new", "invitations"].includes(segment)) {
        return ":slug"
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

/**
 * Strips any .data suffixes from a URL pathname that might have been introduced
 * by React Router V8+.
 *
 * Use this for redirect-URL sanitization only, and use the pathname of the
 * framework-provided URL object that is found in LoaderArgs and ActionArgs for
 * other purposes.
 *
 * @param pathname pathname like `/farm/farm-id/fertilizers.data` to sanitize.
 * @returns the pathname with any `.data` or `/_.data` suffixes stripped off.
 */
export function stripDataSuffix(pathname: string): string {
  return pathname.replace(/(?:\.data)+$/, "").replace(/\/_$/, "/")
}

/**
 * Strips any .data suffix from the pathname of a full address, leaving the
 * query string and hash intact. Use this for return URLs read from search
 * parameters.
 *
 * @param address address like `/farm/farm-id/fertilizers.data?a=1#top` to sanitize.
 * @returns the address with the `.data` suffix removed from its path.
 */
export function stripDataSuffixFromAddress(address: string): string {
  const suffixStart = address.search(/[?#]/)
  if (suffixStart === -1) return stripDataSuffix(address)
  return `${stripDataSuffix(address.slice(0, suffixStart))}${address.slice(suffixStart)}`
}
