import type { EntryContext } from "react-router"
import { clientConfig } from "~/lib/config"
import { MANUAL_CACHE_CONTROL } from "~/lib/manual/seo"

type CacheControl = {
  maxAge: number
  staleWhileRevalidate?: number
  isPublic?: boolean
  noStore?: boolean
}

/**
 * Generate Cache-Control header value based on provided options
 */
function generateCacheControl({
  maxAge,
  staleWhileRevalidate,
  isPublic = true,
  noStore = false,
}: CacheControl): string {
  const directives: string[] = []

  if (noStore) {
    return "no-store, no-cache, must-revalidate"
  }

  directives.push(isPublic ? "public" : "private")
  directives.push(`max-age=${maxAge}`)

  if (staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`)
  }

  return directives.join(", ")
}

/**
 * Cache header for HTML pages without personal data. Browsers and shared caches revalidate on
 * every request, so after a deploy no one gets HTML that loads the JavaScript of the previous build.
 */
const PUBLIC_PAGE_CACHE_CONTROL = "no-cache"

/**
 * Cache header for HTML pages with data of the signed-in user: revalidate on every request, and
 * keep the page out of shared caches.
 */
const PRIVATE_PAGE_CACHE_CONTROL = "private, no-cache"

/** Sections of the app whose pages show no personal data. */
const PUBLIC_PAGE_SECTIONS = ["/signin", "/privacy"]

/** Whether `pathname` is `section` itself or a page below it. */
function isInSection(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(`${section}/`)
}

/**
 * Get the cache headers for an HTML document request, based on its path and method. Pages behind
 * sign-in are private; every page except the manual revalidates on every request.
 */
export function getCacheControlHeaders(request: Request, _context: EntryContext): Headers {
  const url = new URL(request.url)
  const headers = new Headers()

  // Static assets (JS, CSS, images)
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$/)) {
    headers.set(
      "Cache-Control",
      generateCacheControl({
        maxAge: 31536000, // 1 year
        staleWhileRevalidate: 86400, // 1 day
      }),
    )
    return headers
  }

  // API endpoints
  if (url.pathname.startsWith("/api")) {
    headers.set(
      "Cache-Control",
      generateCacheControl({
        maxAge: 0,
        noStore: true,
      }),
    )
    return headers
  }

  // Health check endpoint
  if (url.pathname === "/health") {
    headers.set(
      "Cache-Control",
      generateCacheControl({
        maxAge: 0,
        noStore: true,
      }),
    )
    return headers
  }

  // Public user manual: static content that changes only with a release
  if (isInSection(url.pathname, "/manual")) {
    headers.set("Cache-Control", MANUAL_CACHE_CONTROL)
    return headers
  }

  // Farm form submissions without JavaScript (POST, PUT, DELETE) are never stored
  if (isInSection(url.pathname, "/farm") && request.method !== "GET") {
    headers.set(
      "Cache-Control",
      generateCacheControl({
        maxAge: 0,
        noStore: true,
      }),
    )
    return headers
  }

  // Pages without personal data
  if (PUBLIC_PAGE_SECTIONS.some((section) => isInSection(url.pathname, section))) {
    headers.set("Cache-Control", PUBLIC_PAGE_CACHE_CONTROL)
    return headers
  }

  // All other pages, including farm pages, show data of the signed-in user
  headers.set("Cache-Control", PRIVATE_PAGE_CACHE_CONTROL)
  return headers
}

/**
 * Add security headers to the response
 */
export function addSecurityHeaders(headers: Headers): Headers {
  let reportUri = ""
  if (clientConfig.analytics?.sentry) {
    reportUri = encodeURIComponent(clientConfig.analytics.sentry.security_report_uri.trim())
  }

  // Construct the Content-Security-Policy
  let csp = `default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.maptiler.com https://*.posthog.com;
        worker-src 'self' blob:;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.posthog.com;
        font-src 'self' https://fonts.gstatic.com https://*.posthog.com data:;
        img-src 'self' data: blob: https://service.pdok.nl https://*.maptiler.com https://*.openstreetmap.org https://*.public.blob.vercel-storage.com https://images.unsplash.com https://lh3.googleusercontent.com https://graph.microsoft.com https://storage.googleapis.com/minas2/ https://storage.googleapis.com/minas2-dev/ https://*.posthog.com;
        connect-src 'self' https://service.pdok.nl https://server.arcgisonline.com https://api.maptiler.com https://nominatim.openstreetmap.org https://sentry.io https://*.sentry.io https://*.ingest.de.sentry.io https://*.nmi-agro.nl https://storage.googleapis.com/fdm-public-data/ https://*.posthog.com ws://localhost:* http://localhost:*;
        frame-src 'self' blob:;
        media-src 'self' https://*.posthog.com;
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';`

  // Add report-uri only if it exists
  if (reportUri) {
    csp += `report-uri ${reportUri};`
  }

  headers.set("Content-Security-Policy", csp.replace(/\s+/g, " ").trim()) // Removing all double spaces
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Frame-Options", "DENY")
  headers.set("X-XSS-Protection", "1; mode=block")
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  headers.set("Permissions-Policy", "geolocation=(self)")

  return headers
}
