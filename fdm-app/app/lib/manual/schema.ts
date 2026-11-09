import { z } from "zod"

/** Sections of the how-to chapters, in the order of the navigation. */
export const CHAPTER_SECTIONS = [
  "Aan de slag",
  "Gegevens vastleggen",
  "Resultaten",
  "Samenwerken en account",
] as const

/** Sections of the background pages, in the order of the navigation. */
export const BACKGROUND_SECTIONS = ["Balansen", "Normen en advies", "Bodem"] as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Gebruik een datum als JJJJ-MM-DD")

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Gebruik kleine letters, cijfers en -")

/**
 * A reference to another manual page: a chapter slug (`bouwplan`) or a background slug with the
 * `background/` prefix (`background/stikstofbalans`).
 */
const pageRef = z.string().regex(/^(?:background\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/)

const baseFrontmatter = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  order: z.number().int(),
  /**
   * Globs, relative to `fdm-app/app/routes/`, of the routes that the page describes. A change to
   * one of these files without a change to the page triggers the route-drift warning.
   */
  routes: z.array(z.string().min(1)),
  /** Extra globs, relative to the repository root, that the drift warning also watches. */
  watch: z.array(z.string().min(1)).optional(),
  keywords: z.array(z.string().min(1)).optional(),
  /**
   * The labels a reader clicks to reach the page in the app, such as `[Balans, Stikstof]`. Shown
   * as "Zo vind je het in de app" and checked by the label test like bold text.
   */
  inApp: z.array(z.string().min(1)).min(1).optional(),
  /** Old slugs that redirect (301) to this page. */
  aliases: z.array(slug).optional(),
  related: z.array(pageRef).optional(),
  /** Screenshot id used as the social preview image. */
  image: z.string().min(1).optional(),
  updated: isoDate.optional(),
})

/** Frontmatter of a how-to chapter in `app/content/manual/chapters`. */
export const chapterFrontmatterSchema = baseFrontmatter.extend({
  section: z.enum(CHAPTER_SECTIONS),
})

/**
 * Frontmatter of a background page in `app/content/manual/background`. These pages explain the
 * agronomy behind a result and are reviewed on every release, so `lastReviewed` is required.
 */
export const backgroundFrontmatterSchema = baseFrontmatter.extend({
  section: z.enum(BACKGROUND_SECTIONS),
  lastReviewed: isoDate,
})

/** Parsed frontmatter of a how-to chapter. */
export type ChapterFrontmatter = z.infer<typeof chapterFrontmatterSchema>

/** Parsed frontmatter of a background page. */
export type BackgroundFrontmatter = z.infer<typeof backgroundFrontmatterSchema>
