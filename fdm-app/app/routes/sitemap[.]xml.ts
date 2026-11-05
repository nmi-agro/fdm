import { manualPages } from "~/lib/manual/content.server"
import { getManualContext } from "~/lib/manual/context.server"
import { buildSitemapXml, MANUAL_CACHE_CONTROL, type SitemapEntry } from "~/lib/manual/seo"

/** `/sitemap.xml`: the public pages that search engines may index. */
export function loader() {
  const { seo } = getManualContext()
  const latest = (dates: (string | undefined)[]) =>
    dates
      .filter((d): d is string => Boolean(d))
      .sort((a, b) => a.localeCompare(b))
      .at(-1)

  const pages: SitemapEntry[] = manualPages.map((page) => ({
    path: page.href,
    lastmod: latest([
      page.frontmatter.updated,
      page.kind === "background" ? page.frontmatter.lastReviewed : undefined,
    ]),
  }))
  const entries: SitemapEntry[] = [
    { path: "/signin" },
    { path: "/privacy" },
    { path: "/manual", lastmod: latest(pages.map((p) => p.lastmod)) },
    {
      path: "/manual/background",
      lastmod: latest(
        pages.filter((p) => p.path.startsWith("/manual/background/")).map((p) => p.lastmod),
      ),
    },
    ...pages,
  ]

  return new Response(buildSitemapXml(entries, seo.origin), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": MANUAL_CACHE_CONTROL,
    },
  })
}
