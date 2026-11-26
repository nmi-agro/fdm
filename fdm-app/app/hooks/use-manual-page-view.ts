import { useEffect } from "react"
import { useAnalytics } from "~/hooks/use-analytics"
import { classifyManualEntry, MANUAL_EVENTS, type ManualEntry } from "~/lib/manual/analytics"

/**
 * Whether this document has shown a manual page before. `document.referrer` does not change on
 * client-side navigation, so only the first view in a document can be classified by it.
 */
let viewedBefore = false

/**
 * Captures `manual_page_viewed` once per page, with how the visitor got there.
 *
 * @param properties - The page: its kind, slug and section, or `index` pages with a slug of their own.
 */
export function useManualPageView(properties: {
  manual_kind: "chapter" | "background" | "index"
  manual_slug: string
  manual_section?: string
}) {
  const { capture } = useAnalytics()
  const { manual_kind, manual_slug, manual_section } = properties

  useEffect(() => {
    const entry: ManualEntry = viewedBefore
      ? "manual"
      : classifyManualEntry(document.referrer, window.location.origin)
    viewedBefore = true
    capture(MANUAL_EVENTS.pageViewed, { manual_kind, manual_slug, manual_section, entry })
  }, [capture, manual_kind, manual_slug, manual_section])
}
