/**
 * Helpers for the label check: every **bold** text and every `inApp` label in the manual must be
 * a label that exists in the source of the app, so the manual cannot keep describing buttons that
 * were renamed or removed.
 */

/** Labels of at least this many words may also match as part of a longer string. */
export const SUBSTRING_MIN_WORDS = 3

/** Labels of at least this many characters may also match as part of a longer string. */
export const SUBSTRING_MIN_LENGTH = 20

/**
 * Normalises text for comparison: JSX `{" "}` becomes a space and runs of whitespace collapse.
 *
 * @param text - Source or label text.
 * @returns The normalised text.
 */
export function normalizeLabel(text: string): string {
  return text
    .replace(/\{\s*(["'`]) \1\s*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * One pattern per quote type, each scanned on its own: an apostrophe in Dutch JSX text ("foto's")
 * would otherwise pair with the next quote and hide the real string literals after it.
 */
const QUOTED = [/"((?:[^"\\\n]|\\.)*)"/g, /'((?:[^'\\\n]|\\.)*)'/g]
const JSX_TEXT = />([^<>{}]*(?:\{\s*["'] ["']\s*\}[^<>{}]*)*)</g
/** JSX text after an expression, such as the label in `{icon} Opnieuw</Button>`. */
const JSX_TEXT_AFTER_EXPRESSION = /\}([^<>{}=;()]+)</g
const TEMPLATE_PART = /`([^`]*)`/g

/**
 * Removes `//` and `/* *\/` comments (including JSX `{/* *\/}` comments) from TypeScript source,
 * so commented-out UI does not count as an existing label. Strings are kept intact: quotes are
 * tracked, `"` and `'` strings end at a line break, and `//` directly after `:` is kept, so URLs
 * such as `https://…` in JSX text survive.
 *
 * @param source - The contents of a `.ts` or `.tsx` file.
 * @returns The source without comments; line breaks are kept.
 */
export function stripComments(raw: string): string {
  // JSX comments go with their braces, so the text around them stays one JSX text.
  const source = raw.replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, (comment) =>
    comment.replace(/[^\n]/g, ""),
  )
  let out = ""
  let quote: string | undefined
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    const next = source[i + 1]
    if (quote) {
      out += char
      if (char === "\\") {
        out += next ?? ""
        i++
      } else if (char === quote || (char === "\n" && quote !== "`")) {
        quote = undefined
      }
      continue
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2)
      const comment = source.slice(i, end === -1 ? source.length : end + 2)
      out += comment.replace(/[^\n]/g, "")
      i += comment.length - 1
      continue
    }
    if (char === "/" && next === "/" && source[i - 1] !== ":") {
      const end = source.indexOf("\n", i)
      i = (end === -1 ? source.length : end) - 1
      continue
    }
    if (char === '"' || char === "'" || char === "`") quote = char
    out += char
  }
  return out
}

/**
 * Extracts the texts a source file can show to users: string literals, the literal parts of
 * template strings and JSX text. Comments are removed first ({@link stripComments}).
 *
 * @param source - The contents of a `.ts` or `.tsx` file.
 * @returns The normalised, non-empty texts.
 */
export function extractUiStrings(raw: string): string[] {
  const source = stripComments(raw)
  const out: string[] = []
  const push = (value: string | undefined) => {
    if (!value) return
    const text = normalizeLabel(value.replace(/\\(["'`])/g, "$1"))
    if (text) out.push(text)
  }
  for (const pattern of QUOTED) {
    for (const match of source.matchAll(pattern)) push(match[1])
  }
  for (const match of source.matchAll(TEMPLATE_PART)) {
    for (const part of match[1].split(/\$\{[^}]*\}/)) push(part)
  }
  for (const match of source.matchAll(JSX_TEXT)) push(match[1])
  for (const match of source.matchAll(JSX_TEXT_AFTER_EXPRESSION)) push(match[1])
  return out
}

/**
 * Builds a matcher over the collected UI strings.
 *
 * @param strings - All UI strings of the corpus.
 * @returns A function that tells whether a label exists in the corpus. Short labels must match a
 *   whole string; labels of at least {@link SUBSTRING_MIN_WORDS} words or
 *   {@link SUBSTRING_MIN_LENGTH} characters may also be part of a longer string.
 */
export function createLabelMatcher(strings: Iterable<string>): (label: string) => boolean {
  const exact = new Set(strings)
  const haystack = [...exact].join("\n")
  return (label: string) => {
    const text = normalizeLabel(label)
    if (exact.has(text)) return true
    const long =
      text.split(" ").length >= SUBSTRING_MIN_WORDS || text.length >= SUBSTRING_MIN_LENGTH
    return long && haystack.includes(text)
  }
}
