import type { EntryContext } from "react-router"
import { clientConfig } from "~/lib/config"
import { MANUAL_CACHE_CONTROL } from "~/lib/manual/seo"

/** Cache header for responses that no cache may keep, such as the result of a form submission. */
const NO_STORE_CACHE_CONTROL = "no-store, no-cache, must-revalidate"

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
 *
 * Only document requests reach this function: static files are served by `server.js`, and
 * resource routes (such as `/api/*` and `/health`) and single-fetch `.data` requests do not pass
 * through `entry.server.tsx`. A request for a missing static file or API path does arrive here,
 * as the 404 page.
 */
export function getCacheControlHeaders(request: Request, _context: EntryContext): Headers {
  const url = new URL(request.url)
  const headers = new Headers()

  // Public user manual: static content that changes only with a release
  if (isInSection(url.pathname, "/manual")) {
    headers.set("Cache-Control", MANUAL_CACHE_CONTROL)
    return headers
  }

  // Farm form submissions without JavaScript (POST, PUT, DELETE) are never stored
  if (isInSection(url.pathname, "/farm") && request.method !== "GET" && request.method !== "HEAD") {
    headers.set("Cache-Control", NO_STORE_CACHE_CONTROL)
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
 * Set the cache headers of a document response. They replace any `Cache-Control` that a route's
 * `headers` export set, so every document follows the policy of {@link getCacheControlHeaders}.
 */
export function applyCacheControlHeaders(
  request: Request,
  context: EntryContext,
  responseHeaders: Headers,
): void {
  getCacheControlHeaders(request, context).forEach((value, key) => {
    responseHeaders.set(key, value)
  })
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
