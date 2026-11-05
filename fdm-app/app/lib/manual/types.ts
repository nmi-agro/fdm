import type { ManualHeading, ManualKind } from "./parse"

/** A page in the manual navigation. */
export interface ManualNavItem {
  kind: ManualKind
  slug: string
  href: string
  title: string
  description: string
}

/** A section of the manual navigation with its pages in reading order. */
export interface ManualNavSection {
  kind: ManualKind
  title: string
  items: ManualNavItem[]
}

/** What a manual page route sends to the browser: the page with its tokens already replaced. */
export interface ManualPageView {
  kind: ManualKind
  slug: string
  href: string
  title: string
  description: string
  section: string
  /** Markdown body, ready to render. */
  body: string
  headings: ManualHeading[]
  inApp?: string[]
  /** Date of the last content change or review, as `YYYY-MM-DD`. */
  modified?: string
  lastReviewed?: string
  prev?: ManualNavItem
  next?: ManualNavItem
  related: ManualNavItem[]
}
