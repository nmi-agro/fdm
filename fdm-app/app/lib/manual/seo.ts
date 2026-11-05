import type { MetaDescriptor } from "react-router"
import type { ManualFaqItem } from "./parse"

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

/** Deployment settings that the manual pages need for their metadata. */
export interface ManualSeoContext {
  /** Public origin without trailing slash, such as `https://app.example.org`. Empty when unset. */
  origin: string
  appName: string
  /** Whether search engines may index the page. */
  indexing: boolean
}

/** What a manual page tells search engines and link previews about itself. */
export interface ManualMetaInput {
  title: string
  description: string
  /** Path of the page, such as `/manual/bouwplan`. */
  path: string
  /** Trail from the manual index to the page; the last item is the page itself. */
  breadcrumb: { title: string; path: string }[]
  seo: ManualSeoContext
  /** `article` for chapter and background pages, `website` for index pages. */
  type: "article" | "website"
  modified?: string
  keywords?: string[]
  faq?: ManualFaqItem[]
  /** Absolute or root-relative URL of the preview image. */
  image?: string
}

function absolute(origin: string, path: string): string {
  return path.startsWith("http") ? path : `${origin}${path}`
}

/**
 * Builds the meta descriptors of a manual page: title, description, canonical URL, Open Graph
 * and Twitter tags, structured data (JSON-LD) and `noindex` when indexing is off.
 *
 * @param input - The page and deployment details.
 * @returns The descriptors for a React Router `meta` export.
 */
export function buildManualMeta(input: ManualMetaInput): MetaDescriptor[] {
  const { seo } = input
  const fullTitle = `${input.title} | Handleiding | ${seo.appName}`
  const url = absolute(seo.origin, input.path)
  const image = input.image ? absolute(seo.origin, input.image) : undefined

  const descriptors: MetaDescriptor[] = [
    { title: fullTitle },
    { name: "description", content: input.description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: input.type },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: url },
    { property: "og:site_name", content: seo.appName },
    { property: "og:locale", content: "nl_NL" },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
  ]
  if (image) {
    descriptors.push(
      { property: "og:image", content: image },
      { name: "twitter:image", content: image },
    )
  }
  if (input.keywords?.length) {
    descriptors.push({ name: "keywords", content: input.keywords.join(", ") })
  }
  if (!seo.indexing) {
    descriptors.push({ name: "robots", content: "noindex, nofollow" })
  }

  const graph: Record<string, unknown>[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: input.breadcrumb.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.title,
        item: absolute(seo.origin, item.path),
      })),
    },
  ]
  if (input.type === "article") {
    graph.push({
      "@type": "TechArticle",
      headline: input.title,
      description: input.description,
      url,
      inLanguage: "nl-NL",
      ...(input.modified ? { dateModified: input.modified } : {}),
      ...(input.keywords?.length ? { keywords: input.keywords.join(", ") } : {}),
      ...(image ? { image } : {}),
      isPartOf: { "@type": "WebSite", name: seo.appName, url: absolute(seo.origin, "/") },
      publisher: { "@type": "Organization", name: seo.appName },
    })
  }
  if (input.faq?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: input.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    })
  }
  descriptors.push({ "script:ld+json": { "@context": "https://schema.org", "@graph": graph } })
  return descriptors
}
