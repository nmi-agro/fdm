import type { Heading, Root, RootContent } from "mdast"
import { toString } from "mdast-util-to-string"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { parse as parseYaml } from "yaml"
import { remarkHeadingIds, TOKEN_PATTERN } from "./markdown"
import {
  type BackgroundFrontmatter,
  backgroundFrontmatterSchema,
  type ChapterFrontmatter,
  chapterFrontmatterSchema,
} from "./schema"

/** The two kinds of manual page: a how-to chapter or a background page. */
export type ManualKind = "chapter" | "background"

/** A heading on a manual page, used for the table of contents and anchor checks. */
export interface ManualHeading {
  depth: number
  text: string
  id: string
}

/** A value found in the Markdown source, with its line number in the file. */
export interface ManualSourceRef {
  value: string
  line: number
}

/** A question and answer from the "Veelgestelde vragen" section of a page. */
export interface ManualFaqItem {
  question: string
  answer: string
}

interface ManualPageBase {
  slug: string
  /** Path of the source file, relative to the fdm-app package. */
  file: string
  /** Public URL path of the page. */
  href: string
  /** The Markdown body without frontmatter, with tokens not yet replaced. */
  body: string
  headings: ManualHeading[]
  links: ManualSourceRef[]
  images: ManualSourceRef[]
  bold: ManualSourceRef[]
  tokens: ManualSourceRef[]
  faq: ManualFaqItem[]
}

/** A parsed how-to chapter. */
export interface ManualChapterPage extends ManualPageBase {
  kind: "chapter"
  frontmatter: ChapterFrontmatter
}

/** A parsed background page. */
export interface ManualBackgroundPage extends ManualPageBase {
  kind: "background"
  frontmatter: BackgroundFrontmatter
}

/** A parsed manual page of either kind. */
export type ManualPage = ManualChapterPage | ManualBackgroundPage

/** The id of the heading whose h3 children are read as frequently asked questions. */
export const FAQ_HEADING_ID = "veelgestelde-vragen"

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkHeadingIds)

/**
 * Returns the public URL path of a manual page.
 *
 * @param kind - The kind of page.
 * @param slug - The slug of the page.
 * @returns For example `/manual/bouwplan` or `/manual/background/stikstofbalans`.
 */
export function manualHref(kind: ManualKind, slug: string): string {
  return kind === "chapter" ? `/manual/${slug}` : `/manual/background/${slug}`
}

/**
 * Parses Markdown into a tree with heading ids, the same way the manual renders it.
 *
 * @param markdown - The Markdown body.
 * @returns The transformed mdast tree.
 */
export function parseManualMarkdown(markdown: string): Root {
  const tree = processor.parse(markdown)
  return processor.runSync(tree) as Root
}

function extractFaq(tree: Root): ManualFaqItem[] {
  const items: ManualFaqItem[] = []
  let inFaq = false
  let current: { question: string; answer: string[] } | undefined
  const flush = () => {
    if (current) items.push({ question: current.question, answer: current.answer.join(" ").trim() })
    current = undefined
  }
  for (const node of tree.children as RootContent[]) {
    if (node.type === "heading" && node.depth <= 2) {
      flush()
      inFaq = (node.data as { id?: string } | undefined)?.id === FAQ_HEADING_ID
      continue
    }
    if (!inFaq) continue
    if (node.type === "heading" && node.depth === 3) {
      flush()
      current = { question: toString(node), answer: [] }
    } else if (current) {
      current.answer.push(toString(node))
    }
  }
  flush()
  return items
}

/**
 * Parses one manual source file: validates the frontmatter and extracts the headings, links,
 * images, bold text and tokens that the manual and its tests need.
 *
 * @param kind - Whether the file is a chapter or a background page.
 * @param file - Path of the file relative to the fdm-app package, used in error messages.
 * @param raw - The full file contents.
 * @returns The parsed page.
 * @throws Error when the frontmatter is missing or invalid.
 */
export function parseManualFile(kind: ManualKind, file: string, raw: string): ManualPage {
  const match = FRONTMATTER_PATTERN.exec(raw)
  if (!match) throw new Error(`${file}: frontmatter ontbreekt`)
  const lineOffset = match[0].split("\n").length - 1
  const schema = kind === "chapter" ? chapterFrontmatterSchema : backgroundFrontmatterSchema
  const result = schema.safeParse(parseYaml(match[1]))
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ")
    throw new Error(`${file}: ongeldige frontmatter: ${issues}`)
  }

  const body = raw.slice(match[0].length)
  const tree = parseManualMarkdown(body)
  const line = (node: { position?: { start: { line: number } } }) =>
    (node.position?.start.line ?? 0) + lineOffset

  const headings: ManualHeading[] = []
  const links: ManualSourceRef[] = []
  const images: ManualSourceRef[] = []
  const bold: ManualSourceRef[] = []
  visit(tree, (node) => {
    if (node.type === "heading") {
      const heading = node as Heading
      const id = (heading.data as { id?: string } | undefined)?.id ?? ""
      headings.push({ depth: heading.depth, text: toString(heading), id })
    } else if (node.type === "link" || node.type === "definition") {
      links.push({ value: node.url, line: line(node) })
    } else if (node.type === "image") {
      images.push({ value: node.url, line: line(node) })
    } else if (node.type === "strong") {
      bold.push({ value: toString(node), line: line(node) })
    }
  })

  const tokens: ManualSourceRef[] = []
  raw.split(/\r?\n/).forEach((text, index) => {
    for (const token of text.matchAll(TOKEN_PATTERN)) {
      tokens.push({ value: token[1], line: index + 1 })
    }
  })

  const slug = file.replace(/^.*\//, "").replace(/\.md$/, "")
  const base = {
    slug,
    file,
    href: manualHref(kind, slug),
    body,
    headings,
    links,
    images,
    bold,
    tokens,
    faq: extractFaq(tree),
  }
  return kind === "chapter"
    ? { ...base, kind, frontmatter: result.data as ChapterFrontmatter }
    : { ...base, kind, frontmatter: result.data as BackgroundFrontmatter }
}
