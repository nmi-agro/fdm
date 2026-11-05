import { getManualContext } from "~/lib/manual/content.server"
import { buildRobotsTxt, MANUAL_CACHE_CONTROL } from "~/lib/manual/seo"

/**
 * `/robots.txt`. With `FDM_SEO_INDEXING=true` it allows the public pages and points to the
 * sitemap; otherwise it keeps every crawler out.
 */
export function loader() {
  const { seo } = getManualContext()
  return new Response(buildRobotsTxt(seo.indexing, seo.origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": MANUAL_CACHE_CONTROL,
    },
  })
}
