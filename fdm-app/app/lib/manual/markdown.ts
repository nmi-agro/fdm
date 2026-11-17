import type { Heading, Root, Text } from "mdast"
import { toString } from "mdast-util-to-string"
import { defaultUrlTransform } from "react-markdown"
import { visit } from "unist-util-visit"

/**
 * Tokens that manual content may use. They are replaced per request, because the product name
 * and URL differ per deployment of this white-label application.
 */
export const KNOWN_TOKENS = ["appName", "appUrl", "apiDocsUrl", "mcpUrl", "mcpServerName"] as const

/** A token name that manual content may use, such as `appName` in `{{appName}}`. */
export type ManualToken = (typeof KNOWN_TOKENS)[number]

/** Matches a `{{token}}` placeholder; group 1 is the token name. */
export const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g

/** URL scheme for screenshots in manual content: `![Alt](screenshot:bouwplan-tabel)`. */
export const SCREENSHOT_PROTOCOL = "screenshot:"

/** Matches an explicit heading id at the end of a heading: `## Titel {#eigen-id}`. */
const EXPLICIT_ID_PATTERN = /\s*\{#([a-z0-9][a-z0-9-]*)\}\s*$/

/**
 * Turns Dutch text into a stable URL fragment.
 *
 * Diacritics are removed ("één" becomes "een"), `&` becomes "en", and every run of other
 * characters becomes a single hyphen.
 *
 * @param text - The text to turn into a slug, such as a heading.
 * @returns The slug, or `"sectie"` when the text has no letters or digits.
 * @example slugify("Bodem & bemesting: één keer") // "bodem-en-bemesting-een-keer"
 */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " en ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "sectie"
}

/**
 * Replaces `{{appName}}` and `{{appUrl}}` with the values of this deployment. Unknown tokens are
 * left as they are; the content tests make sure there are none.
 *
 * @param markdown - Manual content with tokens.
 * @param values - The value for each known token.
 * @returns The content with every known token replaced.
 */
export function substituteTokens(markdown: string, values: Record<ManualToken, string>): string {
  return markdown.replace(TOKEN_PATTERN, (match, name: string) =>
    (KNOWN_TOKENS as readonly string[]).includes(name) ? values[name as ManualToken] : match,
  )
}

/**
 * Removes an explicit `{#id}` from the end of a heading and returns it.
 *
 * @param heading - The heading node; its last text child is changed in place.
 * @returns The explicit id, or `undefined` when the heading has none.
 */
function takeExplicitId(heading: Heading): string | undefined {
  const last = heading.children.at(-1)
  if (!last || last.type !== "text") return undefined
  const match = EXPLICIT_ID_PATTERN.exec(last.value)
  if (!match) return undefined
  ;(last as Text).value = last.value.replace(EXPLICIT_ID_PATTERN, "")
  return match[1]
}

/**
 * Remark plugin that gives every heading a stable `id`.
 *
 * The id is the explicit `{#id}` at the end of the heading, or else the {@link slugify}-ed heading
 * text. Duplicate ids within one document get a suffix (`-2`, `-3`, …). The id is stored in
 * `data.hProperties`, so react-markdown renders it without a rehype plugin, and in `data.id` for
 * code that reads the tree.
 */
export function remarkHeadingIds() {
  return (tree: Root) => {
    const seen = new Map<string, number>()
    visit(tree, "heading", (node: Heading) => {
      const base = takeExplicitId(node) ?? slugify(toString(node))
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      const id = count === 0 ? base : `${base}-${count + 1}`
      node.data = {
        ...node.data,
        id,
        hProperties: { ...node.data?.hProperties, id },
      } as Heading["data"]
    })
  }
}

/**
 * URL transform for react-markdown that keeps `screenshot:` URLs, which the default transform
 * would strip as an unknown protocol. All other URLs go through the default transform.
 *
 * @param url - The URL from the Markdown source.
 * @returns The URL to render.
 */
export function manualUrlTransform(url: string): string {
  if (url.startsWith(SCREENSHOT_PROTOCOL)) return url
  return defaultUrlTransform(url)
}
