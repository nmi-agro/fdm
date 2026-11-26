/**
 * Analytics events of the manual and the help links. Event names follow the app's
 * `object_action` convention; keep them stable, because dashboards and funnels depend on them.
 */
export const MANUAL_EVENTS = {
  /** A manual page was opened. Top of the funnel towards signing up. */
  pageViewed: "manual_page_viewed",
  /** A visitor clicked a sign-up call to action in the manual. */
  signupClicked: "manual_signup_clicked",
  /** A visitor opened a manual URL that does not exist, such as a broken link. */
  pageNotFound: "manual_page_not_found",
  /** A user clicked a help link in the app that opens the manual. */
  helpLinkClicked: "help_link_clicked",
} as const

/** Where in the app a help link sits. */
export type HelpLinkSource = "page_header" | "sidebar" | "empty_state" | "signin"

/** How a visitor reached a manual page. */
export type ManualEntry = "manual" | "app" | "external" | "direct"

/**
 * Classifies the referrer of a manual page view, so the dashboard can tell visitors from search
 * engines apart from users who opened help from inside the app.
 *
 * @param referrer - `document.referrer`.
 * @param origin - `window.location.origin`.
 * @returns `manual` for navigation within the manual, `app` for other pages of this app,
 *   `external` for other sites and `direct` when there is no referrer.
 */
export function classifyManualEntry(referrer: string, origin: string): ManualEntry {
  if (!referrer) return "direct"
  let url: URL
  try {
    url = new URL(referrer)
  } catch {
    return "direct"
  }
  if (url.origin !== origin) return "external"
  return url.pathname === "/manual" || url.pathname.startsWith("/manual/") ? "manual" : "app"
}
