/**
 * Cache header for the public manual pages, the sitemap and robots.txt. The content only changes
 * with a release, so shared caches may keep it for ten minutes and serve it stale for a day while
 * they revalidate.
 */
export const MANUAL_CACHE_CONTROL = "public, max-age=600, stale-while-revalidate=86400"

/**
 * Areas of the app behind sign-in. They are disallowed in robots.txt: crawlers would only meet a
 * redirect to the sign-in page.
 */
export const DISALLOWED_PATHS = [
  "/farm",
  "/organization",
  "/user",
  "/support",
  "/about",
  "/api",
  "/callback",
  "/ingest",
  "/logout",
  "/welcome",
] as const

/** A page listed in the sitemap. */
export interface SitemapEntry {
  /** Path of the page, starting with `/`. */
  path: string
  /** Date of the last content change as `YYYY-MM-DD`, when known. */
  lastmod?: string
}

/**
 * Returns the origin of the public URL without a trailing slash, or an empty string when the URL
 * is not configured.
 *
 * @param url - The configured public URL of the app (`PUBLIC_FDM_URL`).
 * @returns For example `https://app.example.org`.
 */
export function normalizeOrigin(url: string | undefined): string {
  if (!url || url === "undefined") return ""
  return url.replace(/\/+$/, "")
}

/**
 * Builds robots.txt. With indexing off, every crawler is kept out; with indexing on, crawlers may
 * read the public pages and are pointed to the sitemap.
 *
 * @param indexing - Whether search engines may index the public pages.
 * @param origin - The public origin of the app, used for the sitemap URL.
 * @returns The robots.txt body.
 */
export function buildRobotsTxt(indexing: boolean, origin: string): string {
  if (!indexing) return "User-agent: *\nDisallow: /\n"
  const lines = ["User-agent: *", "Allow: /", ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`)]
  if (origin) lines.push("", `Sitemap: ${origin}/sitemap.xml`)
  return `${lines.join("\n")}\n`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Builds sitemap.xml for the given pages.
 *
 * @param entries - The pages to list.
 * @param origin - The public origin of the app; sitemap URLs must be absolute.
 * @returns The sitemap XML.
 */
export function buildSitemapXml(entries: SitemapEntry[], origin: string): string {
  const urls = entries.map((entry) => {
    const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""
    return `  <url><loc>${escapeXml(`${origin}${entry.path}`)}</loc>${lastmod}</url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n")
}
