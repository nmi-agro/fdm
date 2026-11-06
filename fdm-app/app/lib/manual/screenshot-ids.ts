import type { ManualPage } from "./parse"
import { SCREENSHOT_PROTOCOL } from "./markdown"

/** Where a screenshot id is used: the source file of the page and the line in it. */
export interface ScreenshotReference {
  file: string
  line: number
}

/** Valid screenshot ids: lowercase words separated by single hyphens, such as `bouwplan-tabel`. */
export const SCREENSHOT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Collects every screenshot id that the manual refers to, from `![Alt](screenshot:<id>)` images
 * in the body and from the `image` field in the frontmatter.
 *
 * @param pages - The parsed manual pages.
 * @returns A map from screenshot id to the places that use it, sorted by id.
 */
export function collectScreenshotIds(
  pages: readonly ManualPage[],
): Map<string, ScreenshotReference[]> {
  const ids = new Map<string, ScreenshotReference[]>()
  const add = (id: string, reference: ScreenshotReference) => {
    const references = ids.get(id) ?? []
    references.push(reference)
    ids.set(id, references)
  }

  for (const page of pages) {
    for (const image of page.images) {
      if (image.value.startsWith(SCREENSHOT_PROTOCOL)) {
        add(image.value.slice(SCREENSHOT_PROTOCOL.length), { file: page.file, line: image.line })
      }
    }
    if (page.frontmatter.image) {
      add(page.frontmatter.image, { file: page.file, line: 1 })
    }
  }

  return new Map([...ids].sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * Compares the screenshot ids that the manual uses with the ids that have a capture definition.
 *
 * @param referenced - The ids used in the manual, as returned by {@link collectScreenshotIds}.
 * @param defined - The ids that have a capture definition.
 * @returns The ids without a definition (`undefined`) and the definitions no page uses (`unused`).
 */
export function compareScreenshotIds(
  referenced: Iterable<string>,
  defined: Iterable<string>,
): { undefined: string[]; unused: string[] } {
  const used = new Set(referenced)
  const known = new Set(defined)
  return {
    undefined: [...used].filter((id) => !known.has(id)).sort(),
    unused: [...known].filter((id) => !used.has(id)).sort(),
  }
}
