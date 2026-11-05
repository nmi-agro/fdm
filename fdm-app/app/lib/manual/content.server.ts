import type { ManualNavItem, ManualNavSection, ManualPageView } from "./types"
import { type ManualToken, substituteTokens } from "./markdown"
import { type ManualKind, type ManualPage, parseManualFile } from "./parse"
import { BACKGROUND_SECTIONS, CHAPTER_SECTIONS } from "./schema"

export type { ManualNavItem, ManualNavSection, ManualPageView }

const chapterFiles = import.meta.glob<string>("/app/content/manual/chapters/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
})

const backgroundFiles = import.meta.glob<string>("/app/content/manual/background/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
})

function sectionIndex(page: ManualPage): number {
  return page.kind === "chapter"
    ? CHAPTER_SECTIONS.indexOf(page.frontmatter.section)
    : BACKGROUND_SECTIONS.indexOf(page.frontmatter.section)
}

function byReadingOrder(a: ManualPage, b: ManualPage): number {
  return (
    sectionIndex(a) - sectionIndex(b) ||
    a.frontmatter.order - b.frontmatter.order ||
    a.slug.localeCompare(b.slug)
  )
}

function load(kind: ManualKind, files: Record<string, string>): ManualPage[] {
  return Object.entries(files)
    .map(([path, raw]) => parseManualFile(kind, path.replace(/^\//, ""), raw))
    .sort(byReadingOrder)
}

/**
 * Every manual page, parsed once at module load: first the chapters, then the background pages,
 * each in reading order. Invalid content throws here; the content tests catch that in CI.
 */
export const manualPages: readonly ManualPage[] = [
  ...load("chapter", chapterFiles),
  ...load("background", backgroundFiles),
]

/**
 * Returns the page with the given slug.
 *
 * @param kind - The kind of page.
 * @param slug - The slug from the URL.
 * @returns The page, or `undefined` when there is none.
 */
export function getManualPage(kind: ManualKind, slug: string): ManualPage | undefined {
  return manualPages.find((page) => page.kind === kind && page.slug === slug)
}

/**
 * Looks up an old slug that a page lists in `aliases`.
 *
 * @param kind - The kind of page.
 * @param slug - The slug from the URL.
 * @returns The page that the alias points to, or `undefined`.
 */
export function resolveManualAlias(kind: ManualKind, slug: string): ManualPage | undefined {
  return manualPages.find(
    (page) => page.kind === kind && page.frontmatter.aliases?.includes(slug) === true,
  )
}

/**
 * Resolves a `related` reference such as `bouwplan` or `background/stikstofbalans`.
 *
 * @param ref - The reference from frontmatter.
 * @returns The page, or `undefined` when the reference does not resolve.
 */
export function resolveManualRef(ref: string): ManualPage | undefined {
  return ref.startsWith("background/")
    ? getManualPage("background", ref.slice("background/".length))
    : getManualPage("chapter", ref)
}

/** The values for the `{{token}}` placeholders of this deployment. */
export type ManualTokens = Record<ManualToken, string>

/**
 * Converts a page to a navigation item.
 *
 * @param page - The page.
 * @param tokens - The values for the token placeholders in the title and description.
 * @returns The navigation item.
 */
export function toNavItem(page: ManualPage, tokens: ManualTokens): ManualNavItem {
  return {
    kind: page.kind,
    slug: page.slug,
    href: page.href,
    title: substituteTokens(page.frontmatter.title, tokens),
    description: substituteTokens(page.frontmatter.description, tokens),
  }
}

/**
 * Returns the navigation of the manual: the chapter sections followed by the background sections.
 *
 * @returns The sections with their pages in reading order.
 */
export function getManualNav(tokens: ManualTokens): ManualNavSection[] {
  const sections: ManualNavSection[] = []
  for (const page of manualPages) {
    const title = page.frontmatter.section
    let section = sections.find((s) => s.kind === page.kind && s.title === title)
    if (!section) {
      section = { kind: page.kind, title, items: [] }
      sections.push(section)
    }
    section.items.push(toNavItem(page, tokens))
  }
  return sections
}

/**
 * Returns the previous and next page of the same kind in reading order.
 *
 * @param page - The current page.
 * @param tokens - The values for the token placeholders.
 * @returns The neighbouring pages; either may be `undefined` at the ends.
 */
export function getManualPrevNext(
  page: ManualPage,
  tokens: ManualTokens,
): {
  prev?: ManualNavItem
  next?: ManualNavItem
} {
  const sameKind = manualPages.filter((p) => p.kind === page.kind)
  const index = sameKind.findIndex((p) => p.slug === page.slug)
  const prev = index > 0 ? sameKind[index - 1] : undefined
  const next = index >= 0 && index < sameKind.length - 1 ? sameKind[index + 1] : undefined
  return { prev: prev && toNavItem(prev, tokens), next: next && toNavItem(next, tokens) }
}

/**
 * Prepares a page for the browser: replaces the tokens and adds its neighbours and related pages.
 *
 * @param page - The page.
 * @param tokens - The values for the token placeholders.
 * @returns The page as the route sends it to the browser.
 */
export function toManualPageView(page: ManualPage, tokens: ManualTokens): ManualPageView {
  const { frontmatter } = page
  const lastReviewed = page.kind === "background" ? page.frontmatter.lastReviewed : undefined
  const related = (frontmatter.related ?? [])
    .map(resolveManualRef)
    .filter((target): target is ManualPage => target !== undefined)
    .map((target) => toNavItem(target, tokens))
  return {
    kind: page.kind,
    slug: page.slug,
    href: page.href,
    title: substituteTokens(frontmatter.title, tokens),
    description: substituteTokens(frontmatter.description, tokens),
    section: frontmatter.section,
    body: substituteTokens(page.body, tokens),
    headings: page.headings.map((h) => ({ ...h, text: substituteTokens(h.text, tokens) })),
    inApp: frontmatter.inApp,
    modified: [frontmatter.updated, lastReviewed]
      .filter((date): date is string => Boolean(date))
      .sort((a, b) => a.localeCompare(b))
      .at(-1),
    lastReviewed,
    ...getManualPrevNext(page, tokens),
    related,
  }
}
